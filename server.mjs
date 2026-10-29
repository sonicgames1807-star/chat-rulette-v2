import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHmac } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4173);
const turnUrls = (process.env.TURN_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
const turnSharedSecret = process.env.TURN_SHARED_SECRET || '';
const clients = new Map();
const waiting = [];
const rooms = new Map();
const reports = [];
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.map': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function send(client, payload) {
  if (client?.socket?.readyState === WebSocket.OPEN) client.socket.send(JSON.stringify(payload));
}
function sendRoom(room, target, payload) {
  const otherId = room.a === target.id ? room.b : room.a;
  const other = clients.get(otherId);
  send(other, payload);
}
function onlineCount() {
  let count = 0;
  for (const client of clients.values()) if (client.socket.readyState === WebSocket.OPEN) count++;
  return count;
}
function broadcastOnline() {
  const online = onlineCount();
  for (const client of clients.values()) send(client, { type: 'presence', online });
}
function ageMatches(wanted, age) {
  if (!wanted || wanted === 'Любой возраст') return true;
  if (!age || age === 'Не указывать') return false;
  return wanted === age;
}
function genderMatches(wanted, gender) {
  if (!wanted || wanted === 'any') return true;
  return gender === wanted;
}
function compatible(a, b) {
  const x = a.prefs, y = b.prefs;
  if (!x || !y || x.mode !== y.mode) return false;
  if (!ageMatches(x.seekAge, y.ageGroup) || !ageMatches(y.seekAge, x.ageGroup)) return false;
  if (!genderMatches(x.seekGender, y.gender) || !genderMatches(y.seekGender, x.gender)) return false;
  if (x.language !== 'any' && y.language !== 'any' && x.language !== y.language) return false;
  if (x.topics?.length && y.topics?.length && !x.topics.some((t) => y.topics.includes(t))) return false;
  if ((x.topics?.length || 0) > 0 && (y.topics?.length || 0) === 0) return false;
  if ((y.topics?.length || 0) > 0 && (x.topics?.length || 0) === 0) return false;
  if (a.blocked.has(b.id) || b.blocked.has(a.id)) return false;
  return true;
}
function makePeer(client) {
  return { id: client.id, name: client.name, initial: client.name.slice(-1) };
}
function leaveRoom(client, { blocked = false } = {}) {
  if (!client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) { client.roomId = null; return; }
  sendRoom(room, client, { type: 'partner-left', blocked });
  const otherId = room.a === client.id ? room.b : room.a;
  const other = clients.get(otherId);
  if (other) other.roomId = null;
  client.roomId = null;
  rooms.delete(room.id);
}
function removeFromQueue(client) {
  const index = waiting.indexOf(client.id);
  if (index !== -1) waiting.splice(index, 1);
}
function enqueue(client, prefs) {
  removeFromQueue(client);
  client.prefs = prefs;
  client.joinedAt = Date.now();
  const candidates = waiting.map((id) => clients.get(id)).filter((candidate) => candidate && compatible(client, candidate));
  if (candidates.length) {
    const partner = candidates[Math.floor(Math.random() * candidates.length)];
    removeFromQueue(partner);
    const room = { id: randomUUID(), a: partner.id, b: client.id, createdAt: Date.now() };
    rooms.set(room.id, room);
    partner.roomId = room.id;
    client.roomId = room.id;
    send(partner, { type: 'matched', roomId: room.id, peer: makePeer(client), isInitiator: true });
    send(client, { type: 'matched', roomId: room.id, peer: makePeer(partner), isInitiator: false });
    return;
  }
  waiting.push(client.id);
  send(client, { type: 'queued', online: onlineCount() });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/rtc-config') {
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (turnUrls.length && turnSharedSecret) {
      const username = `${Math.floor(Date.now() / 1000) + 600}:${randomUUID()}`;
      const credential = createHmac('sha1', turnSharedSecret).update(username).digest('base64');
      iceServers.push({ urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls, username, credential });
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ iceServers }));
    return;
  }
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, name: 'Случай demo', online: onlineCount(), queue: waiting.length, rooms: rooms.size }));
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const safePath = path.resolve(dist, `.${pathname}`);
  const relativePath = path.relative(dist, safePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(safePath, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not found. Build the app with npm run build.'); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(safePath)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
wss.on('connection', (socket, request) => {
  const origin = request.headers.origin;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.host !== request.headers.host) {
        socket.close(1008, 'origin-not-allowed');
        return;
      }
    } catch {
      socket.close(1008, 'invalid-origin');
      return;
    }
  }
  const id = randomUUID();
  const client = { id, socket, name: `Гость ${Math.floor(100 + Math.random() * 900)}`, prefs: null, roomId: null, blocked: new Set(), lastSentAt: 0 };
  clients.set(id, client);
  send(client, { type: 'welcome', id, name: client.name, online: onlineCount() });
  broadcastOnline();

  socket.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw.toString()); } catch { send(client, { type: 'error', message: 'Не удалось прочитать запрос.' }); return; }
    if (!data || typeof data.type !== 'string') return;
    if (data.type === 'queue:join') {
      const p = data.prefs || {};
      if (p.adultConfirmed !== true) { send(client, { type: 'error', message: 'Для доступа нужно подтвердить 18+ и принять правила.' }); return; }
      if (!['text', 'voice'].includes(p.mode)) { send(client, { type: 'error', message: 'Выбери режим общения.' }); return; }
      if (client.roomId) leaveRoom(client);
      const normalized = {
        mode: p.mode,
        gender: ['woman', 'man', 'other', 'unspecified'].includes(p.gender) ? p.gender : 'unspecified',
        ageGroup: ['18–24', '25–34', '35–44', '45+'].includes(p.ageGroup) ? p.ageGroup : 'Не указывать',
        seekGender: ['woman', 'man'].includes(p.seekGender) ? p.seekGender : 'any',
        seekAge: ['18–24', '25–34', '35–44', '45+'].includes(p.seekAge) ? p.seekAge : 'Любой возраст',
        language: ['ru', 'en'].includes(p.language) ? p.language : 'any',
        topics: Array.isArray(p.topics) ? p.topics.filter((v) => ['Музыка','Кино','Путешествия','Книги','Игры','Искусство','Технологии','Спорт'].includes(v)).slice(0, 8) : [],
      };
      enqueue(client, normalized);
      broadcastOnline();
      return;
    }
    if (data.type === 'queue:leave') {
      removeFromQueue(client);
      leaveRoom(client);
      client.prefs = null;
      send(client, { type: 'room-ended' });
      broadcastOnline();
      return;
    }
    if (data.type === 'next') {
      removeFromQueue(client);
      leaveRoom(client);
      send(client, { type: 'room-ended' });
      return;
    }
    if (data.type === 'chat:send') {
      if (!client.roomId) return;
      const body = typeof data.body === 'string' ? data.body.trim().slice(0, 2000) : '';
      if (!body) return;
      const now = Date.now();
      if (now - client.lastSentAt < 350) { send(client, { type: 'error', message: 'Не отправляй сообщения слишком часто.' }); return; }
      client.lastSentAt = now;
      const message = { id: randomUUID(), body, createdAt: now };
      const room = rooms.get(client.roomId);
      send(client, { type: 'chat:ack', message });
      sendRoom(room, client, { type: 'chat:message', message });
      return;
    }
    if (data.type === 'rtc:signal') {
      if (!client.roomId || !data.signal || typeof data.signal !== 'object') return;
      sendRoom(rooms.get(client.roomId), client, { type: 'rtc:signal', signal: data.signal });
      return;
    }
    if (data.type === 'block') {
      const room = client.roomId ? rooms.get(client.roomId) : null;
      if (room) {
        const otherId = room.a === client.id ? room.b : room.a;
        const other = clients.get(otherId);
        client.blocked.add(otherId);
        if (other) other.blocked.add(client.id);
        leaveRoom(client, { blocked: true });
      }
      return;
    }
    if (data.type === 'report') {
      const reason = typeof data.reason === 'string' ? data.reason.slice(0, 120) : 'Не указана';
      reports.push({ at: Date.now(), reason, mode: client.prefs?.mode || 'unknown' });
      if (reports.length > 500) reports.shift();
      send(client, { type: 'report:ok' });
      leaveRoom(client);
      return;
    }
  });

  socket.on('close', () => {
    removeFromQueue(client);
    leaveRoom(client);
    clients.delete(client.id);
    broadcastOnline();
  });
  socket.on('error', () => {});
});

server.listen(port, '0.0.0.0', () => {
  const actualPort = server.address().port;
  console.log(`Случай demo доступен на http://localhost:${actualPort}`);
  console.log('Очередь и отчёты хранятся только в памяти процесса; для production нужны постоянные сервисы и модерация.');
});
