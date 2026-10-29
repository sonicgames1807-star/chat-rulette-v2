import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const TOPICS = ['Музыка', 'Кино', 'Путешествия', 'Книги', 'Игры', 'Искусство', 'Технологии', 'Спорт'];
const AGE_GROUPS = ['Не указывать', '18–24', '25–34', '35–44', '45+'];
const GENDERS = [
  { value: 'unspecified', label: 'Не указывать' },
  { value: 'woman', label: 'Женщина' },
  { value: 'man', label: 'Мужчина' },
  { value: 'other', label: 'Другое' },
];
const SEEK_OPTIONS = [
  { value: 'any', label: 'Любой' },
  { value: 'woman', label: 'Женщины' },
  { value: 'man', label: 'Мужчины' },
];
const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'any', label: 'Любой язык' },
];

function Icon({ name, size = 20, stroke = 1.8 }) {
  const paths = {
    shuffle: <><path d="m16 3 4 4-4 4"/><path d="M4 17h2.5a5 5 0 0 0 4-2l3-4a5 5 0 0 1 4-2H20"/><path d="m16 17 4 4-4 4" transform="translate(0 -4)"/><path d="M4 7h2.5a5 5 0 0 1 3.6 1.6M14 15.4a5 5 0 0 0 4 1.6H20"/></>,
    text: <><path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 13h5"/></>,
    voice: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.5 8.2-8 10-4.5-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></>,
    micOff: <><path d="m3 3 18 18M9 9v3a3 3 0 0 0 5.1 2.1M15 9V6a3 3 0 0 0-5.6-1.5M5 11a7 7 0 0 0 12 5M19 11a7 7 0 0 1-.4 2.3M12 18v3m-4 0h8"/></>,
    next: <><path d="M4 7h11a5 5 0 0 1 0 10H8"/><path d="m11 13-4 4 4 4"/><path d="M19 7v10"/></>,
    flag: <><path d="M5 21V5m0 0c5-4 9 4 14 0v11c-5 4-9-4-14 0"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
    sparkle: <><path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.sparkle}</svg>;
}

function Brand() {
  return <a className="brand" href="#home" aria-label="Случай — на главную"><span className="brand-mark"><i /><i /><i /></span><span>случай<span className="brand-dot">.</span></span></a>;
}

function App() {
  const [mode, setMode] = useState('text');
  const [gender, setGender] = useState('unspecified');
  const [ageGroup, setAgeGroup] = useState('Не указывать');
  const [seekGender, setSeekGender] = useState('any');
  const [seekAge, setSeekAge] = useState('Любой возраст');
  const [language, setLanguage] = useState('ru');
  const [topics, setTopics] = useState([]);
  const [adult, setAdult] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [page, setPage] = useState('setup');
  const [status, setStatus] = useState('idle');
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [peer, setPeer] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [connectionLabel, setConnectionLabel] = useState('Готов к поиску');
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const chatEndRef = useRef(null);
  const prefsRef = useRef(null);
  const pageRef = useRef(page);
  const modeRef = useRef(mode);
  const reportTimer = useRef(null);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => {
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stopMedia = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    pendingCandidatesRef.current = [];
    setMicEnabled(true);
  }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close(1000, 'user-left');
  }, []);

  const cleanSession = useCallback(() => {
    stopMedia();
    closeSocket();
    setPeer(null);
    setMessages([]);
    setDraft('');
  }, [closeSocket, stopMedia]);

  useEffect(() => () => {
    window.clearTimeout(reportTimer.current);
    stopMedia();
    const ws = wsRef.current;
    if (ws && ws.readyState < WebSocket.CLOSING) ws.close();
  }, [stopMedia]);

  const showMessage = (text) => {
    setToast(text);
  };

  const send = (payload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  };

  const initPeer = async (data) => {
    if (!localStreamRef.current) return;
    let rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    try {
      const response = await fetch('/api/rtc-config', { cache: 'no-store' });
      if (response.ok) rtcConfig = await response.json();
    } catch { /* public STUN fallback */ }
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;
    localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0] || new MediaStream([event.track]);
        remoteAudioRef.current.play().catch(() => setToast('Нажмите на значок звука, чтобы включить воспроизведение.'));
      }
      setConnectionLabel('Вы на связи');
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) send({ type: 'rtc:signal', signal: { candidate: event.candidate } });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnectionLabel('Вы на связи');
      if (pc.connectionState === 'failed') setConnectionLabel('Не удалось соединиться');
      if (pc.connectionState === 'disconnected') setConnectionLabel('Связь прервалась');
    };
    if (data.isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'rtc:signal', signal: { description: pc.localDescription } });
    }
  };

  const handleSignal = async (signal) => {
    const pc = pcRef.current;
    if (!pc || !signal) return;
    try {
      if (signal.description) {
        await pc.setRemoteDescription(signal.description);
        const pending = pendingCandidatesRef.current.splice(0);
        for (const candidate of pending) await pc.addIceCandidate(candidate);
        if (signal.description.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'rtc:signal', signal: { description: pc.localDescription } });
        }
      } else if (signal.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate);
        else pendingCandidatesRef.current.push(signal.candidate);
      }
    } catch (err) {
      console.warn('WebRTC signaling failed', err);
      setConnectionLabel('Не удалось соединиться');
    }
  };

  const startSearch = async () => {
    setError('');
    if (!adult || !accepted) {
      setError('Подтверди возраст 18+ и согласись с правилами, чтобы продолжить.');
      return;
    }
    if (seekAge !== 'Любой возраст' && ageGroup === 'Не указывать') {
      setError('Чтобы использовать возрастной фильтр, укажи свой возрастной диапазон.');
      return;
    }
    if (mode === 'voice') {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Браузер не поддерживает доступ к микрофону. Открой приложение по HTTPS или на localhost.');
        return;
      }
      try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch {
        setError('Микрофон не подключен. Разреши доступ в браузере или выбери текстовый режим.');
        return;
      }
    }
    prefsRef.current = {
      mode, gender, ageGroup, seekGender, seekAge,
      language, topics, adultConfirmed: adult && accepted,
    };
    setMessages([]);
    setPeer(null);
    setPage('queue');
    setStatus('connecting');
    setConnectionLabel('Подключаемся к поиску…');
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) {
      setStatus('searching');
      setConnectionLabel('Ищем собеседника');
      existing.send(JSON.stringify({ type: 'queue:join', prefs: prefsRef.current }));
      return;
    }
    const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${scheme}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus('searching');
      setConnectionLabel('Ищем собеседника');
      ws.send(JSON.stringify({ type: 'queue:join', prefs: prefsRef.current }));
    };
    ws.onmessage = async (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (typeof data.online === 'number') setOnline(data.online);
      if (data.type === 'welcome') setOnline(data.online || 0);
      if (data.type === 'queued') {
        setStatus('searching');
        setConnectionLabel('Ищем собеседника');
      }
      if (data.type === 'matched') {
        setPeer(data.peer);
        setStatus('matched');
        setPage('chat');
        setConnectionLabel(modeRef.current === 'voice' ? 'Подключаем голос…' : 'Вы на связи');
        setMessages([{ id: `hello-${Date.now()}`, system: true, text: 'Вы встретили нового собеседника. Приятного разговора!' }]);
        if (modeRef.current === 'voice') {
          try { await initPeer(data); }
          catch (err) { console.warn(err); setConnectionLabel('Не удалось подключить голос'); }
        }
      }
      if (data.type === 'chat:message') {
        setMessages((current) => [...current, { ...data.message, mine: false }]);
      }
      if (data.type === 'chat:ack') {
        setMessages((current) => [...current, { ...data.message, mine: true }]);
      }
      if (data.type === 'rtc:signal') await handleSignal(data.signal);
      if (data.type === 'partner-left') {
        stopMedia();
        setPeer(null);
        setStatus('idle');
        setPage('setup');
        setConnectionLabel('Разговор завершён');
        setToast(data.blocked ? 'Контакт заблокирован. Вы больше не встретитесь в этой сессии.' : 'Собеседник завершил разговор.');
        if (!data.blocked) closeSocket();
      }
      if (data.type === 'room-ended') {
        setPeer(null);
        setMessages([]);
      }
      if (data.type === 'report:ok') {
        setToast('Жалоба отправлена. Спасибо, что помогаете сохранять безопасность.');
      }
      if (data.type === 'error') {
        setError(data.message || 'Не получилось выполнить действие. Попробуй ещё раз.');
        setStatus('idle');
        setPage('setup');
        stopMedia();
      }
    };
    ws.onerror = () => {
      setStatus('idle');
      setPage('setup');
      setError('Не удалось подключиться. Проверь соединение и попробуй снова.');
      stopMedia();
    };
    ws.onclose = () => {
      if (pageRef.current === 'queue' || pageRef.current === 'chat') {
        stopMedia();
        setPeer(null);
        setStatus('idle');
        setPage('setup');
        setConnectionLabel('Соединение закрыто');
      }
    };
  };

  const cancelSearch = () => {
    send({ type: 'queue:leave' });
    cleanSession();
    setStatus('idle');
    setPage('setup');
    setConnectionLabel('Поиск отменён');
  };

  const nextPartner = () => {
    send({ type: 'next' });
    stopMedia();
    setPeer(null);
    setMessages([]);
    setPage('queue');
    setStatus('searching');
    setConnectionLabel('Ищем нового собеседника');
    send({ type: 'queue:join', prefs: prefsRef.current });
  };

  const leaveChat = () => {
    send({ type: 'queue:leave' });
    cleanSession();
    setPage('setup');
    setStatus('idle');
    setConnectionLabel('Готов к поиску');
  };

  const blockPartner = () => {
    send({ type: 'block' });
    stopMedia();
    setPeer(null);
    setMessages([]);
    setBlockOpen(false);
    setPage('setup');
    setStatus('idle');
    setConnectionLabel('Контакт заблокирован');
    setToast('Собеседник заблокирован в этой сессии.');
  };

  const sendMessage = (event) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || body.length > 2000) return;
    if (send({ type: 'chat:send', body })) setDraft('');
    else setToast('Соединение прервалось. Сообщение не отправлено.');
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const next = !micEnabled;
    localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicEnabled(next);
  };

  const submitReport = (reason) => {
    send({ type: 'report', reason });
    setReportOpen(false);
    stopMedia();
    setPeer(null);
    setPage('setup');
    setStatus('idle');
    setConnectionLabel('Жалоба отправлена');
    closeSocket();
  };

  const toggleTopic = (topic) => setTopics((current) => current.includes(topic) ? current.filter((x) => x !== topic) : [...current, topic]);

  const profileSummary = useMemo(() => {
    const modeLabel = mode === 'text' ? 'Текстовый чат' : 'Голосовой чат';
    const languageLabel = LANGUAGES.find((x) => x.value === language)?.label || 'Русский';
    return { modeLabel, languageLabel };
  }, [mode, language]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className="online-pill"><span className="online-dot" />{online > 0 ? `${online} в сети` : 'Случайные знакомства'}</span>
          <button className="quiet-button" onClick={() => setInfoOpen('rules')}><Icon name="shield" size={17} /> Правила</button>
        </div>
      </header>

      <main className={`layout ${page !== 'setup' ? 'layout-session' : ''}`}>
        {page === 'setup' ? (
          <>
            <section className="setup-card" aria-labelledby="setup-title">
              <div className="eyebrow"><span className="eyebrow-line" />ЗДЕСЬ НАЧИНАЕТСЯ РАЗГОВОР</div>
              <h1 id="setup-title">Встреть<br /><span>кого-то нового.</span></h1>
              <p className="setup-subtitle">Один случайный собеседник. Никаких анкет на десять страниц.</p>

              <div className="mode-switch" role="group" aria-label="Выбор режима общения">
                <button className={`mode-option ${mode === 'text' ? 'active' : ''}`} aria-pressed={mode === 'text'} onClick={() => { setMode('text'); setError(''); }}><Icon name="text" size={19} /><span>Текст</span></button>
                <button className={`mode-option ${mode === 'voice' ? 'active' : ''}`} aria-pressed={mode === 'voice'} onClick={() => { setMode('voice'); setError(''); }}><Icon name="voice" size={19} /><span>Голос</span><span className="new-tag">LIVE</span></button>
              </div>

              <div className="form-section">
                <div className="section-heading"><span>КТО ТЫ?</span><span className="optional-label">необязательно</span></div>
                <div className="select-row">
                  <label className="field-label" htmlFor="gender">Пол</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="select-row">
                  <label className="field-label" htmlFor="ageGroup">Возраст</label>
                  <select id="ageGroup" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
                    {AGE_GROUPS.map((age) => <option key={age}>{age}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-section compact-section">
                <div className="section-heading"><span>КОГО ИЩЕМ?</span><span className="optional-label">настрой фильтр</span></div>
                <div className="choice-row" role="group" aria-label="Предпочтение по полу собеседника">
                  {SEEK_OPTIONS.map((opt) => <button key={opt.value} className={`choice-button ${seekGender === opt.value ? 'selected' : ''}`} aria-pressed={seekGender === opt.value} onClick={() => setSeekGender(opt.value)}>{opt.label}</button>)}
                </div>
                <div className="select-row age-filter">
                  <label className="field-label" htmlFor="seekAge">Возраст собеседника</label>
                  <select id="seekAge" value={seekAge} onChange={(e) => { setSeekAge(e.target.value); setError(''); }}>
                    <option>Любой возраст</option><option>18–24</option><option>25–34</option><option>35–44</option><option>45+</option>
                  </select>
                </div>
              </div>

              <div className="select-row language-row">
                <label className="field-label" htmlFor="language">Язык общения</label>
                <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => <option value={l.value} key={l.value}>{l.label}</option>)}
                </select>
              </div>

              <div className="topics-section">
                <div className="section-heading"><span>О ЧЁМ ПОГОВОРИМ?</span><span className="optional-label">можно пропустить</span></div>
                <div className="topic-list" aria-label="Темы разговора">
                  {TOPICS.map((topic) => <button key={topic} className={`topic-chip ${topics.includes(topic) ? 'selected' : ''}`} aria-pressed={topics.includes(topic)} onClick={() => toggleTopic(topic)}>{topic}</button>)}
                </div>
                <p className="topic-hint">Если выберешь темы, ищем человека с похожими интересами.</p>
              </div>

              <div className="consent-block">
                <label className="check-line"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span className="custom-check" /><span>Мне исполнилось 18 лет</span></label>
                <label className="check-line"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span className="custom-check" /><span>Принимаю <button className="inline-link" type="button" onClick={(e) => { e.preventDefault(); setInfoOpen('privacy'); }}>правила и политику приватности</button></span></label>
              </div>
              {error && <div className="error-banner" role="alert"><Icon name="info" size={17} />{error}</div>}
              <button className="start-button" onClick={startSearch}><span>{mode === 'text' ? 'Найти собеседника' : 'Начать голосовой чат'}</span><Icon name="arrow" size={20} /></button>
              <div className="start-note"><Icon name={mode === 'voice' ? 'mic' : 'lock'} size={14} />{mode === 'voice' ? 'Микрофон запросим после нажатия кнопки' : 'Без регистрации · разговор не сохраняется'}</div>
            </section>

            <section className="welcome-panel" aria-label="О сервисе">
              <div className="welcome-topline"><span className="status-marker" />СЛУЧАЙНЫЕ ВСТРЕЧИ, НАСТОЯЩИЕ РАЗГОВОРЫ</div>
              <div className="welcome-copy">
                <div className="welcome-illustration" aria-hidden="true">
                  <div className="orbit orbit-one" /><div className="orbit orbit-two" />
                  <div className="avatar avatar-a"><span>А</span><i /></div>
                  <div className="avatar avatar-b"><span>М</span><i /></div>
                  <div className="spark spark-a">✳</div><div className="spark spark-b">✦</div>
                  <div className="chat-bubble bubble-a">Привет! 👋</div><div className="chat-bubble bubble-b">Откуда ты?</div>
                </div>
                <div className="welcome-text">
                  <div className="welcome-kicker"><Icon name="sparkle" size={15} /> КАЖДЫЙ РАЗ — НОВАЯ ИСТОРИЯ</div>
                  <h2>Иногда лучший<br />разговор —<br /><em>тот, которого</em><br /><em>не планировал.</em></h2>
                  <p>Подключись к случайному человеку и начни с простого «привет».</p>
                </div>
              </div>
              <div className="welcome-bottom">
                <div className="feature-mini"><span className="feature-icon"><Icon name="shuffle" size={18} /></span><span><b>Случайная встреча</b><small>Только один на один</small></span></div>
                <div className="feature-mini"><span className="feature-icon green"><Icon name="shield" size={18} /></span><span><b>Твой выбор</b><small>Можно уйти в любой момент</small></span></div>
                <div className="welcome-footnote">ПРОТОТИП · ТЕСТОВОЕ ПОДКЛЮЧЕНИЕ</div>
              </div>
            </section>
          </>
        ) : (
          <section className="session-card" aria-live="polite">
            <div className="session-header">
              <div className="session-brand"><Brand /><span className="session-divider" /><span className="session-mode"><Icon name={mode === 'text' ? 'text' : 'voice'} size={16} />{profileSummary.modeLabel}</span></div>
              <button className="quiet-button leave-button" onClick={leaveChat}><Icon name="close" size={17} /> Завершить</button>
            </div>
            <div className="session-content">
              {page === 'queue' ? (
                <div className="queue-view">
                  <div className="queue-orbit" aria-hidden="true"><span className="queue-orbit-inner"><Icon name="shuffle" size={30} /></span><i className="orbit-dot dot-one" /><i className="orbit-dot dot-two" /><i className="orbit-dot dot-three" /></div>
                  <div className="queue-eyebrow"><span className="pulse-dot" />{status === 'connecting' ? 'ПОДКЛЮЧАЕМСЯ' : 'ИДЁТ ПОИСК'}</div>
                  <h1>{status === 'connecting' ? 'Секунду…' : 'Кто-то уже рядом.'}</h1>
                  <p>{status === 'connecting' ? 'Настраиваем безопасное соединение.' : 'Подбираем случайного собеседника по твоим фильтрам.'}</p>
                  <div className="queue-details"><span><Icon name={mode === 'text' ? 'text' : 'voice'} size={17} />{profileSummary.modeLabel}</span><i /> <span>{language === 'any' ? 'Любой язык' : profileSummary.languageLabel}</span></div>
                  <div className="queue-track"><span /></div>
                  <div className="queue-foot"><span>Найдено людей онлайн: <b>{online}</b></span><button className="text-button" onClick={cancelSearch}>Отменить поиск</button></div>
                  <div className="demo-notice"><Icon name="info" size={16} /><span>Это прототип: ты подключишься к другому человеку, только если он тоже открыт в приложении.</span></div>
                </div>
              ) : (
                <div className="chat-view">
                  <div className="chat-topline">
                    <div className="partner-info"><div className="partner-avatar">{peer?.initial || 'С'}<span /></div><div><b>{peer?.name || 'Новый собеседник'}</b><small><span className="online-dot" />{mode === 'voice' ? connectionLabel : 'Случайная встреча'}</small></div></div>
                    <div className="chat-actions">
                      <button className="icon-button" aria-label="Пожаловаться на собеседника" title="Пожаловаться" onClick={() => setReportOpen(true)}><Icon name="flag" size={18} /></button>
                      <button className="icon-button block-action" aria-label="Заблокировать собеседника" title="Заблокировать" onClick={() => setBlockOpen(true)}><Icon name="shield" size={18} /></button>
                      <button className="next-button" onClick={nextPartner}><Icon name="next" size={17} />Следующий</button>
                    </div>
                  </div>
                  {mode === 'text' ? (
                    <>
                      <div className="chat-messages" role="log" aria-label="Сообщения чата" aria-live="polite">
                        <div className="chat-date"><span>НОВАЯ ВСТРЕЧА</span></div>
                        {messages.map((msg) => msg.system ? <div className="system-message" key={msg.id}>{msg.text}</div> : <div className={`message-row ${msg.mine ? 'mine' : ''}`} key={msg.id}><div className="message-bubble">{msg.body}<time>{new Date(msg.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time></div></div>)}
                        <div ref={chatEndRef} />
                      </div>
                      <form className="composer" onSubmit={sendMessage}>
                        <input aria-label="Сообщение" placeholder="Напиши что-нибудь доброе…" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} />
                        <button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Отправить сообщение"><Icon name="arrow" size={19} /></button>
                      </form>
                      <div className="composer-hint"><Icon name="shield" size={13} />Не делись личными данными с незнакомцами</div>
                    </>
                  ) : (
                    <div className="voice-view">
                      <div className="voice-avatars"><div className="voice-avatar self-avatar">Я<span className={micEnabled ? 'voice-wave' : 'voice-muted'} /></div><div className="voice-link"><i /><i /><i /></div><div className="voice-avatar peer-avatar">{peer?.initial || 'С'}<span className="voice-wave" /></div></div>
                      <div className="voice-status"><span className="pulse-dot" />{connectionLabel}</div>
                      <h2>Разговор без сценария.</h2><p>Просто начни с приветствия.</p>
                      <audio ref={remoteAudioRef} autoPlay playsInline />
                      <div className="voice-controls">
                        <button className={`voice-control ${!micEnabled ? 'muted' : ''}`} onClick={toggleMic} aria-label={micEnabled ? 'Выключить микрофон' : 'Включить микрофон'}><Icon name={micEnabled ? 'mic' : 'micOff'} size={20} /><span>{micEnabled ? 'Микрофон' : 'Без звука'}</span></button>
                        <button className="voice-end" onClick={leaveChat} aria-label="Завершить разговор"><Icon name="close" size={19} /></button>
                        <button className="voice-control" onClick={nextPartner} aria-label="Следующий собеседник"><Icon name="next" size={20} /><span>Следующий</span></button>
                      </div>
                      <button className="voice-report" onClick={() => setReportOpen(true)}><Icon name="flag" size={15} />Пожаловаться</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="session-bottom"><span><Icon name="lock" size={14} /> Твои разговоры не записываются в этом демо</span><span>СЛУЧАЙ · DEMO</span></div>
          </section>
        )}
      </main>

      {page === 'setup' && <footer className="page-footer"><span>Случай — прототип для новых знакомств</span><div><button onClick={() => setInfoOpen('privacy')}>Приватность</button><button onClick={() => setInfoOpen('safety')}>Безопасность</button><span>Только 18+</span></div></footer>}

      {reportOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setReportOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><button className="modal-close" onClick={() => setReportOpen(false)} aria-label="Закрыть"><Icon name="close" /></button><div className="modal-icon warning"><Icon name="flag" size={21} /></div><h2 id="report-title">Что случилось?</h2><p>Выбери причину. В демо отправится только категория жалобы — без текста переписки.</p><div className="report-options">{['Оскорбления или травля', 'Нежелательный контент', 'Спам или реклама', 'Другое нарушение'].map((r) => <button key={r} onClick={() => submitReport(r)}>{r}<Icon name="arrow" size={16} /></button>)}</div><button className="modal-cancel" onClick={() => setReportOpen(false)}>Отмена</button></div></div>}

      {blockOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setBlockOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="block-title"><button className="modal-close" onClick={() => setBlockOpen(false)} aria-label="Закрыть"><Icon name="close" /></button><div className="modal-icon warning"><Icon name="shield" size={21} /></div><h2 id="block-title">Заблокировать собеседника?</h2><p>Разговор завершится. В этой демо-сессии вы не попадёте друг к другу снова.</p><button className="start-button modal-done" onClick={blockPartner}>Заблокировать и выйти</button><button className="modal-cancel" onClick={() => setBlockOpen(false)}>Отмена</button></div></div>}
      {infoOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setInfoOpen('')}><div className="modal info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title"><button className="modal-close" onClick={() => setInfoOpen('')} aria-label="Закрыть"><Icon name="close" /></button><div className="modal-icon"><Icon name={infoOpen === 'safety' || infoOpen === 'rules' ? 'shield' : 'lock'} size={21} /></div><h2 id="info-title">{infoOpen === 'rules' ? 'Правила общения' : infoOpen === 'safety' ? 'Безопасность прежде всего' : 'Приватность в прототипе'}</h2><div className="info-copy">{infoOpen === 'rules' ? <><p>Общайся уважительно. Не отправляй угрозы, спам или запрещённые материалы.</p><p>Не публикуй чужие личные данные и не проси у собеседника адрес, пароль или платёжную информацию.</p><p>Если разговор стал неприятным — нажми «Следующий» или отправь жалобу.</p></> : infoOpen === 'safety' ? <><p>Сервис предназначен только для совершеннолетних. Возраст в прототипе подтверждается самостоятельно и не является проверкой личности.</p><p>Не переходи по подозрительным ссылкам, не отправляй деньги и не делись личными контактами с незнакомцами.</p><p>Кнопки «Следующий» и «Пожаловаться» доступны во время общения.</p></> : <><p>Это демонстрационный прототип. Гостевые сессии временные; сервер пересылает сообщения собеседнику в реальном времени и не сохраняет их в базе данных.</p><p>Для голосового режима используется соединение браузер-браузер. Аудио не записывается приложением. Технические IP-адреса могут обрабатываться хостинг-провайдером.</p><p>Жалоба в демо не передаётся в работающую службу модерации. Для публичного запуска потребуются проверка законов, age assurance, политика хранения данных и настоящая модерация.</p></>}</div><button className="start-button modal-done" onClick={() => setInfoOpen('')}>Понятно</button></div></div>}
      {toast && <div className="toast" role="status"><Icon name="info" size={17} />{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
