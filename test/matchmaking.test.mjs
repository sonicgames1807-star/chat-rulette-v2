import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

function launchServer() {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: '0', TURN_URLS: 'turn:turn.test:3478?transport=udp', TURN_SHARED_SECRET: 'test-only-secret' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errorOutput = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { errorOutput += chunk.toString(); });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timeout. ${output} ${errorOutput}`)), 5000);
    const inspect = () => {
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
    };
    child.stdout.on('data', inspect);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited (${code}). ${output} ${errorOutput}`));
    });
  });
  return { child, ready };
}

async function connect(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { origin: `http://127.0.0.1:${port}` },
  });
  const inbox = [];
  const waiters = [];
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    } else inbox.push(message);
  });
  await once(socket, 'open');
  return {
    socket,
    send: (payload) => socket.send(JSON.stringify(payload)),
    waitFor(type, timeoutMs = 3000) {
      const index = inbox.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, reject, timer: null };
        waiter.timer = setTimeout(() => {
          const position = waiters.indexOf(waiter);
          if (position >= 0) waiters.splice(position, 1);
          reject(new Error(`Timed out waiting for ${type}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}

const preferences = {
  mode: 'text', gender: 'unspecified', ageGroup: 'Не указывать',
  seekGender: 'any', seekAge: 'Любой возраст', language: 'ru',
  topics: [], adultConfirmed: true,
};

 test('random pairing, ephemeral message delivery, and block exclusion', async (t) => {
  const { child, ready } = launchServer();
  t.after(() => { if (!child.killed) child.kill('SIGTERM'); });
  const port = await ready;
  const health = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true);
  const rtcConfig = await fetch(`http://127.0.0.1:${port}/api/rtc-config`).then((r) => r.json());
  assert.equal(rtcConfig.iceServers.length, 2);
  assert.equal(rtcConfig.iceServers[1].urls, 'turn:turn.test:3478?transport=udp');
  assert.match(rtcConfig.iceServers[1].username, /^\d+:/);
  assert.ok(rtcConfig.iceServers[1].credential);

  const a = await connect(port);
  const b = await connect(port);
  t.after(() => { a.socket.close(); b.socket.close(); });
  await Promise.all([a.waitFor('welcome'), b.waitFor('welcome')]);

  a.send({ type: 'queue:join', prefs: preferences });
  await a.waitFor('queued');
  b.send({ type: 'queue:join', prefs: preferences });
  const [matchA, matchB] = await Promise.all([a.waitFor('matched'), b.waitFor('matched')]);
  assert.ok(matchA.roomId);
  assert.equal(matchA.roomId, matchB.roomId);

  a.send({ type: 'chat:send', body: 'Проверка связи' });
  const [ack, delivered] = await Promise.all([a.waitFor('chat:ack'), b.waitFor('chat:message')]);
  assert.equal(ack.message.body, 'Проверка связи');
  assert.equal(delivered.message.body, 'Проверка связи');

  a.send({ type: 'block' });
  const blockedPeer = await b.waitFor('partner-left');
  assert.equal(blockedPeer.blocked, true);

  a.send({ type: 'queue:join', prefs: preferences });
  await a.waitFor('queued');
  b.send({ type: 'queue:join', prefs: preferences });
  await b.waitFor('queued');
  const unexpectedMatch = await Promise.race([
    Promise.all([a.waitFor('matched', 350), b.waitFor('matched', 350)]).then(() => true).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(false), 450)),
  ]);
  assert.equal(unexpectedMatch, false, 'blocked pair must not be matched again on the same connection');
});
