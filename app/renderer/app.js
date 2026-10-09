'use strict';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const ICE_CONFIG = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

// Servidores STUN/TURN usados nas conexões. Os de TURN chegam do servidor
// do Discórdia ao entrar na sala (ver 'welcome').
let iceConfig = ICE_CONFIG;

// O servidor grátis do Render "dorme" sem uso e leva até ~1 min para acordar.
const WAKE_TIMEOUT_MS = 90 * 1000;
const RETRY_DELAY_MS = 3000;
// Mensagem periódica que conta como uso e impede o servidor de dormir
// enquanto tem gente na sala (o Render dorme após 15 min sem tráfego).
const KEEPALIVE_MS = 4 * 60 * 1000;
// Se a conexão com o servidor cair no meio da sala, tenta voltar por até 2 min.
const RECONNECT_TIMEOUT_MS = 2 * 60 * 1000;

const QUALITY = {
  '720p30': { width: 1280, height: 720, frameRate: 30, bitrate: 2_500_000 },
  '1080p30': { width: 1920, height: 1080, frameRate: 30, bitrate: 4_500_000 },
  '1080p60': { width: 1920, height: 1080, frameRate: 60, bitrate: 8_000_000 },
};

const SPEAKING_THRESHOLD = 0.035; // RMS do microfone local
const REMOTE_SPEAKING_LEVEL = 0.02; // audioLevel do WebRTC (0 a 1)

const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const SLASH = '<line x1="3" y1="3" x2="21" y2="21"/>';
const MIC = '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>';
const HEADPHONES = '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>';
const MONITOR = '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>';
const LEAVE = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>';
const ICONS = {
  mic: svg(MIC),
  micOff: svg(MIC + SLASH),
  headphones: svg(HEADPHONES),
  headphonesOff: svg(HEADPHONES + SLASH),
  monitor: svg(MONITOR),
  monitorOff: svg(MONITOR + SLASH),
  leave: svg(LEAVE),
  send: svg('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'),
  volume: svg('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
  expand: svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>'),
  settings: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  volumeOff: svg('<path d="M11 5 6 9H2v6h4l5 4V5Z"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>'),
  exitFullscreen: svg('<path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>'),
  image: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  smile: svg('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>'),
  eye: svg('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  fullscreen: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>'),
};

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

let ws = null;
let myId = null;
let myName = '';
let micStream = null;
let screenStream = null;
let screenQuality = QUALITY['1080p30'];
let mutedBeforeDeafen = false;
let loginError = '';
// Servidor e mensagem de entrada da sessão atual, usados para reconectar.
let session = null;
let reconnecting = false;
let currentRoom = '';
let roomList = [];
let retryTimer = null;

// watching: ids dos amigos cuja transmissão estou vendo agora.
const me = { muted: false, deafened: false, sharing: false, watching: [] };

// id -> { id, name, state, pc, polite, makingOffer, ignoreOffer, queue, screenSenders, media }
// media: Map<streamId, { kind: 'audio' | 'video', el }>
const peers = new Map();

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function storageGet(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento */ }
}

let toastTimer;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

function hueFor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function colorFor(name) {
  return `hsl(${hueFor(name)} 75% 72%)`;
}

function avatarEl(name) {
  const h = hueFor(name);
  const el = document.createElement('span');
  el.className = 'avatar';
  el.style.background = `linear-gradient(135deg, hsl(${h} 70% 60%), hsl(${(h + 40) % 360} 75% 50%))`;
  el.textContent = name.charAt(0).toUpperCase();
  return el;
}

// Sons curtos de entrada/saída, gerados na hora (sem arquivos de áudio).
function playTone(freqs) {
  if (me.deafened) return;
  audioCtx ??= new AudioContext();
  const t0 = audioCtx.currentTime;
  freqs.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const start = t0 + i * 0.09;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.25);
  });
}
const SOUND_JOIN = [660, 880];
const SOUND_LEAVE = [660, 440];
const SOUND_MUTE = [520, 390];
const SOUND_UNMUTE = [390, 520];

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Entrar / sair
// ---------------------------------------------------------------------------

function initLogin() {
  const saved = storageGet('login');
  $('#in-name').value = saved.name || '';
  $('#in-room').value = saved.room || '';
  $('#in-server').value = saved.server || window.APP_CONFIG.defaultServer;
  $('#in-password').value = saved.password || '';
  $('#login-form').addEventListener('submit', onLogin);
}

async function onLogin(event) {
  event.preventDefault();
  const name = $('#in-name').value.trim();
  const room = $('#in-room').value.trim();
  const server = $('#in-server').value.trim();
  const password = $('#in-password').value;
  if (!name || !room || !server) return;
  storageSet('login', { name, room, server, password });

  const button = $('#login-form button[type="submit"]');
  button.disabled = true;
  $('#login-status').textContent = '';

  try {
    micStream = await Voice.start();
  } catch (err) {
    console.warn('Microfone indisponível', err);
    micStream = null;
  }

  myName = name;
  loginError = '';
  session = { server, joinMsg: { type: 'join', name, room, password } };
  connectServer(Date.now() + WAKE_TIMEOUT_MS);
}

function connectServer(deadline) {
  const button = $('#login-form button[type="submit"]');
  const status = $('#login-status');
  let opened = false;
  try {
    ws = new WebSocket(session.server);
  } catch {
    button.disabled = false;
    status.textContent = 'Endereço do servidor inválido.';
    stopMic();
    return;
  }
  ws.onopen = () => {
    opened = true;
    if (!reconnecting) status.textContent = '';
    send(session.joinMsg);
  };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    onServerMessage(msg);
  };
  ws.onclose = () => {
    if (myId) {
      startReconnect();
      return;
    }
    if (reconnecting) {
      if (!loginError && Date.now() < deadline) {
        retryTimer = setTimeout(() => connectServer(deadline), RETRY_DELAY_MS);
      } else {
        leave(loginError || 'A conexão com o servidor caiu e não foi possível reconectar.');
      }
      return;
    }
    // Servidor dormindo: continua tentando até ele acordar.
    if (!opened && !loginError && Date.now() < deadline) {
      status.classList.add('waiting');
      status.textContent = 'Acordando o servidor… isso pode levar até 1 minuto.';
      retryTimer = setTimeout(() => connectServer(deadline), RETRY_DELAY_MS);
      return;
    }
    status.classList.remove('waiting');
    button.disabled = false;
    status.textContent = loginError || 'Não foi possível conectar ao servidor.';
    stopMic();
  };
}

setInterval(() => {
  if (myId) send({ type: 'ping' });
}, KEEPALIVE_MS);

// A conexão com o servidor caiu no meio da sala. Mantém microfone e
// transmissão, desfaz as conexões com os amigos e entra de novo na sala;
// os amigos reconectam com a gente como se tivéssemos acabado de entrar.
function startReconnect() {
  ws = null;
  myId = null;
  reconnecting = true;
  for (const id of [...peers.keys()]) removePeer(id);
  setReconnectBanner(true);
  connectServer(Date.now() + RECONNECT_TIMEOUT_MS);
}

function setReconnectBanner(visible) {
  $('#reconnect-banner').hidden = !visible;
  const input = $('#chat-input');
  input.disabled = visible;
  input.placeholder = visible ? 'Reconectando…' : 'Mandar mensagem…';
}

// Volta a internet: tenta na hora, sem esperar o próximo intervalo.
window.addEventListener('online', () => {
  if (!reconnecting || !retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = null;
  connectServer(Date.now() + RECONNECT_TIMEOUT_MS);
});

function stopMic() {
  Voice.stop();
  micStream = null;
}

function leave(reason) {
  clearTimeout(retryTimer);
  retryTimer = null;
  reconnecting = false;
  session = null;
  setReconnectBanner(false);
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  closeSettings();
  closeUserMenu();
  if (me.sharing) stopShare();
  for (const id of [...peers.keys()]) removePeer(id);
  unmonitor('local');
  stopMic();
  myId = null;
  currentRoom = '';
  Object.assign(me, { muted: false, deafened: false, sharing: false, watching: [] });
  $('#messages').replaceChildren();
  lastMessage = null;
  setAttachment(null);
  $('#screens').replaceChildren();
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#login-form button[type="submit"]').disabled = false;
  $('#login-status').textContent = reason || '';
}

// ---------------------------------------------------------------------------
// Mensagens do servidor
// ---------------------------------------------------------------------------

function onServerMessage(msg) {
  switch (msg.type) {
    case 'error':
      loginError = msg.message;
      ws.close();
      break;

    case 'welcome': {
      const wasReconnecting = reconnecting;
      const firstJoin = !currentRoom;
      reconnecting = false;
      myId = msg.id;
      currentRoom = msg.room;
      roomList = msg.rooms || [];
      renderRooms();
      $('#login-status').classList.remove('waiting');
      iceConfig = { iceServers: [...ICE_CONFIG.iceServers, ...(msg.iceServers || [])] };
      $('#login').hidden = true;
      $('#app').hidden = false;
      $('#room-title').textContent = msg.room;
      initMePanel();
      unmonitor('local');
      if (micStream) monitor('local', micStream, myId);
      else if (firstJoin) toast('Microfone não encontrado — você entrou só para ouvir.');
      $('#messages').replaceChildren();
      lastMessage = null;
      msg.history.forEach(addChatMessage);
      // Garante que não sobrou ninguém da sala anterior (troca de sala/reconexão).
      for (const id of [...peers.keys()]) removePeer(id);
      // Quem acabou de entrar espera as ofertas de quem já estava na sala.
      msg.peers.forEach((peer) => createPeer(peer, false));
      updateControls();
      renderUsers();
      // Depois de reconectar ou trocar de sala o servidor nos trata como
      // recém-chegados: reenvia mudo/transmissão.
      if (me.muted || me.deafened || me.sharing) sendState();
      if (wasReconnecting) {
        setReconnectBanner(false);
        toast('Reconectado!');
      }
      $('#chat-input').focus();
      break;
    }

    case 'rooms':
      roomList = msg.rooms;
      renderRooms();
      break;

    case 'peer-joined':
      createPeer(msg.peer, true);
      addSystemMessage(`${msg.peer.name} entrou na sala`);
      playTone(SOUND_JOIN);
      break;

    case 'peer-left': {
      const p = peers.get(msg.id);
      if (p) {
        addSystemMessage(`${p.name} saiu da sala`);
        playTone(SOUND_LEAVE);
      }
      removePeer(msg.id);
      break;
    }

    case 'peer-state': {
      const p = peers.get(msg.id);
      if (!p) break;
      if (!p.state.sharing && msg.state.sharing) addSystemMessage(`${p.name} começou a compartilhar a tela`);
      p.state = msg.state;
      if (!msg.state.sharing) removeVideoTiles(p);
      renderUsers();
      break;
    }

    case 'signal': {
      const p = peers.get(msg.from);
      if (!p) break;
      // Processa em ordem: as mensagens de sinalização dependem umas das outras.
      p.queue = p.queue.then(() => handleSignal(p, msg.data)).catch((err) => console.error(err));
      break;
    }

    case 'chat':
      addChatMessage(msg);
      if (msg.from !== myId) {
        bumpUnread();
        if (document.hidden) new Notification(msg.name, { body: msg.text || '📷 Imagem', silent: false });
      }
      break;
  }
}

function sendState() {
  send({ type: 'state', state: me });
  renderUsers();
}

// ---------------------------------------------------------------------------
// WebRTC (malha: uma conexão com cada participante)
// ---------------------------------------------------------------------------

// Só um lado inicia a conexão (quem já estava na sala). Se os dois enviarem
// ofertas ao mesmo tempo, o Chromium às vezes para de coletar os endereços de
// rede do lado que cede, e a conexão fica presa em "conectando".
function createPeer({ id, name, state }, initiator) {
  if (peers.has(id)) return;
  const pc = new RTCPeerConnection(iceConfig);
  const p = {
    id,
    name,
    state: state || {},
    pc,
    // Em caso de ofertas simultâneas, o lado "educado" cede.
    polite: myId < id,
    makingOffer: false,
    ignoreOffer: false,
    queue: Promise.resolve(),
    screenSenders: [],
    media: new Map(),
    // Quem não inicia só adiciona microfone/tela depois de responder a 1ª oferta.
    tracksPending: !initiator,
  };
  peers.set(id, p);

  pc.onnegotiationneeded = async () => {
    try {
      p.makingOffer = true;
      await pc.setLocalDescription();
      send({ type: 'signal', to: id, data: { description: pc.localDescription } });
    } catch (err) {
      console.error(err);
    } finally {
      p.makingOffer = false;
    }
  };
  pc.onicecandidate = ({ candidate }) => {
    if (candidate) send({ type: 'signal', to: id, data: { candidate } });
  };
  pc.ontrack = ({ streams }) => {
    const stream = streams[0];
    if (!stream) return;
    stream.onremovetrack = () => refreshRemoteStream(p, stream);
    refreshRemoteStream(p, stream);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') pc.restartIce();
    renderUsers();
  };

  if (initiator) {
    addLocalTracks(p);
    // Sem microfone não haveria nada para negociar: pede só para receber áudio.
    if (!micStream) pc.addTransceiver('audio', { direction: 'recvonly' });
  }
  renderUsers();
}

function addLocalTracks(p) {
  p.tracksPending = false;
  if (micStream) micStream.getTracks().forEach((t) => p.pc.addTrack(t, micStream));
  if (screenStream) addScreenTo(p);
}

async function handleSignal(p, { description, candidate }) {
  const pc = p.pc;
  if (description) {
    const collision = description.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
    p.ignoreOffer = !p.polite && collision;
    if (p.ignoreOffer) return;
    await pc.setRemoteDescription(description);
    if (description.type === 'offer') {
      await pc.setLocalDescription();
      send({ type: 'signal', to: p.id, data: { description: pc.localDescription } });
      if (p.tracksPending) addLocalTracks(p);
    }
  } else if (candidate) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (!p.ignoreOffer) throw err;
    }
  }
}

function removePeer(id) {
  const p = peers.get(id);
  if (!p) return;
  for (const key of [...p.media.keys()]) removeMedia(p, key);
  p.pc.close();
  peers.delete(id);
  if (userMenuPeer === id) closeUserMenu();
  renderUsers();
}

// Cada stream remota vira um <audio> (microfone) ou um bloco de vídeo (tela).
// A stream da tela pode chegar primeiro só com áudio e depois ganhar vídeo,
// por isso reavaliamos sempre que ela muda.
function refreshRemoteStream(p, stream) {
  if (!peers.has(p.id)) return;
  const existing = p.media.get(stream.id);
  if (stream.getTracks().length === 0) {
    removeMedia(p, stream.id);
    return;
  }
  const kind = stream.getVideoTracks().length > 0 ? 'video' : 'audio';
  if (existing && existing.kind === kind) return;
  if (existing) removeMedia(p, stream.id);

  if (kind === 'video') {
    const el = createTile(stream, p.name, false);
    p.media.set(stream.id, { kind, el });
  } else {
    const el = new Audio();
    el.autoplay = true;
    el.srcObject = stream;
    document.body.append(el);
    const m = { kind, el, track: stream.getAudioTracks()[0], boost: null };
    p.media.set(stream.id, m);
    applyVoice(p, m);
  }
  updateStageEmpty();
}

function removeMedia(p, streamId) {
  const m = p.media.get(streamId);
  if (!m) return;
  if (m.boost) m.boost.source.disconnect();
  m.el.srcObject = null;
  m.el.remove();
  unmonitor(`${p.id}:${streamId}`);
  p.media.delete(streamId);
  updateStageEmpty();
}

function removeVideoTiles(p) {
  for (const [key, m] of [...p.media]) {
    if (m.kind === 'video') removeMedia(p, key);
  }
}

// ---------------------------------------------------------------------------
// Compartilhamento de tela
// ---------------------------------------------------------------------------

let pickerSources = [];
let pickerTab = 'screen';
let pickerSelected = null;

async function openPicker() {
  if (me.sharing) {
    stopShare();
    return;
  }
  $('#picker').hidden = false;
  $('#picker-grid').textContent = 'Carregando…';
  $('#picker-go').disabled = true;
  $('#picker-audio-label').hidden = window.api.platform !== 'win32';
  pickerSelected = null;
  try {
    pickerSources = await window.api.getSources();
  } catch (err) {
    console.error(err);
    pickerSources = [];
  }
  // Wayland devolve uma única fonte já escolhida no seletor do sistema.
  if (pickerSources.length === 1) pickerSelected = pickerSources[0].id;
  if (!pickerSources.some((s) => s.isScreen)) pickerTab = 'window';
  renderPicker();
}

function renderPicker() {
  document.querySelectorAll('#picker-tabs .tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === pickerTab);
  });
  const grid = $('#picker-grid');
  grid.replaceChildren();
  const list = pickerSources.filter((s) => s.isScreen === (pickerTab === 'screen'));
  if (list.length === 0) {
    grid.textContent = 'Nada para mostrar aqui.';
  }
  for (const source of list) {
    const button = document.createElement('button');
    button.className = 'source' + (source.id === pickerSelected ? ' selected' : '');
    const thumb = document.createElement(source.thumbnail ? 'img' : 'div');
    if (source.thumbnail) thumb.src = source.thumbnail;
    else thumb.className = 'no-thumb';
    const label = document.createElement('span');
    label.textContent = source.name;
    button.append(thumb, label);
    button.onclick = () => {
      pickerSelected = source.id;
      renderPicker();
    };
    button.ondblclick = confirmPicker;
    grid.append(button);
  }
  $('#picker-go').disabled = !pickerSelected;
}

function closePicker() {
  $('#picker').hidden = true;
  pickerSources = [];
}

async function confirmPicker() {
  if (!pickerSelected) return;
  const quality = $('#picker-quality').value;
  const withAudio = window.api.platform === 'win32' && $('#picker-audio').checked;
  const sourceId = pickerSelected;
  closePicker();
  try {
    await startShare(sourceId, quality, withAudio);
  } catch (err) {
    console.error(err);
    toast('Não foi possível compartilhar a tela.');
  }
}

async function startShare(sourceId, qualityKey, withAudio) {
  const q = QUALITY[qualityKey];
  await window.api.selectSource(sourceId, withAudio);
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { max: q.width },
      height: { max: q.height },
      frameRate: { ideal: q.frameRate, max: q.frameRate },
    },
    audio: withAudio,
  });
  const video = stream.getVideoTracks()[0];
  // "motion" prioriza fluidez (jogos/vídeos); "detail" prioriza nitidez (texto/código).
  video.contentHint = q.frameRate >= 60 ? 'motion' : 'detail';
  video.onended = () => stopShare();

  screenStream = stream;
  screenQuality = q;
  peers.forEach(addScreenTo);
  createTile(stream, 'Você', true).dataset.local = 'true';
  updateViewers();
  me.sharing = true;
  updateControls();
  sendState();
  updateStageEmpty();
}

function addScreenTo(p) {
  if (p.tracksPending) return; // entra junto com o microfone, em addLocalTracks
  p.screenSenders = screenStream.getTracks().map((track) => {
    const init = { direction: 'sendonly', streams: [screenStream] };
    if (track.kind === 'video') {
      init.sendEncodings = [{ maxBitrate: screenQuality.bitrate, maxFramerate: screenQuality.frameRate }];
    }
    return p.pc.addTransceiver(track, init).sender;
  });
}

function stopShare() {
  if (!screenStream) return;
  screenStream.getTracks().forEach((t) => t.stop());
  for (const p of peers.values()) {
    for (const sender of p.screenSenders) {
      try { p.pc.removeTrack(sender); } catch { /* conexão já fechada */ }
    }
    p.screenSenders = [];
  }
  screenStream = null;
  document.querySelector('.tile[data-local]')?.remove();
  me.sharing = false;
  updateControls();
  sendState();
  updateStageEmpty();
}

function createTile(stream, label, isLocal) {
  const tile = document.createElement('div');
  tile.className = 'tile';

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal || me.deafened;
  if (!isLocal) applyOutput(video);
  video.srcObject = stream;

  const badge = document.createElement('div');
  badge.className = 'tile-badge';
  const live = document.createElement('span');
  live.className = 'live';
  live.textContent = 'AO VIVO';
  const name = document.createElement('span');
  name.textContent = label;
  badge.append(live, name);
  if (isLocal) {
    const viewers = document.createElement('span');
    viewers.className = 'viewers';
    viewers.hidden = true;
    badge.append(viewers);
  }

  const bar = document.createElement('div');
  bar.className = 'tile-bar';

  if (!isLocal) {
    const wrap = document.createElement('label');
    wrap.className = 'volume';
    wrap.title = 'Volume da transmissão';
    wrap.innerHTML = ICONS.volume;
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '1';
    volume.step = '0.05';
    volume.value = '1';
    volume.oninput = () => {
      video.dataset.volume = volume.value;
      applyOutput(video);
    };
    wrap.append(volume);
    bar.append(wrap);
  }

  const focus = document.createElement('button');
  focus.className = 'focus-btn';
  focus.innerHTML = `${ICONS.expand}<span>Ampliar</span>`;
  focus.onclick = () => {
    const focused = tile.classList.toggle('focused');
    focus.querySelector('span').textContent = focused ? 'Reduzir' : 'Ampliar';
  };
  const full = document.createElement('button');
  full.className = 'full-btn';
  full.onclick = () => toggleFullscreen(tile);
  bar.append(focus, full);

  video.ondblclick = () => toggleFullscreen(tile);

  // Em tela cheia, esconde os controles e o cursor quando o mouse fica parado.
  let idleTimer;
  tile.onmousemove = () => {
    tile.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => tile.classList.add('idle'), 2500);
  };

  tile.append(video, badge, bar);
  updateFullscreenButton(tile);
  $('#screens').append(tile);
  return isLocal ? tile : video;
}

function toggleFullscreen(tile) {
  if (document.fullscreenElement === tile) document.exitFullscreen();
  else tile.requestFullscreen();
}

function updateFullscreenButton(tile) {
  const isFull = document.fullscreenElement === tile;
  const button = tile.querySelector('.full-btn');
  button.innerHTML = isFull
    ? `${ICONS.exitFullscreen}<span>Sair da tela cheia</span>`
    : `${ICONS.fullscreen}<span>Tela cheia</span>`;
}

document.addEventListener('fullscreenchange', () => {
  document.querySelectorAll('.tile').forEach(updateFullscreenButton);
});

// Conta como "assistindo" quem tem o vídeo da transmissão na tela e o app
// visível (minimizado não conta). Avisa o servidor quando isso muda.
function updateWatching() {
  const watching = document.hidden
    ? []
    : [...peers.values()].filter((p) => [...p.media.values()].some((m) => m.kind === 'video')).map((p) => p.id);
  if (watching.join() === me.watching.join()) return;
  me.watching = watching;
  sendState();
}

function viewersOfMe() {
  return [...peers.values()].filter((p) => (p.state.watching || []).includes(myId));
}

// Mostra no meu vídeo e no meu status quantos amigos estão assistindo.
function updateViewers() {
  const viewers = viewersOfMe();
  const el = document.querySelector('.tile[data-local] .viewers');
  if (el) {
    el.hidden = viewers.length === 0;
    el.innerHTML = `${ICONS.eye}<span>${viewers.length}</span>`;
    el.title = `${viewers.map((p) => p.name).join(', ')} ${viewers.length === 1 ? 'está' : 'estão'} assistindo`;
  }
  if (me.sharing) {
    $('#me-status').textContent = viewers.length ? `Ao vivo · ${viewers.length} assistindo` : 'Transmitindo a tela';
  }
}

document.addEventListener('visibilitychange', () => {
  if (myId) updateWatching();
});

function updateStageEmpty() {
  updateWatching();
  // Remove blocos cujo <video> já foi retirado da página.
  document.querySelectorAll('.tile:not([data-local])').forEach((tile) => {
    if (!tile.querySelector('video')) tile.remove();
  });
  $('#stage-empty').hidden = $('#screens').children.length > 0;
}

// ---------------------------------------------------------------------------
// Detecção de quem está falando
// ---------------------------------------------------------------------------

let audioCtx = null;
const monitors = new Map(); // chave -> { source, analyser, data, userId }

function monitor(key, stream, userId) {
  if (stream.getAudioTracks().length === 0) return;
  audioCtx ??= new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  monitors.set(key, { source, analyser, data: new Uint8Array(analyser.fftSize), userId });
}

function unmonitor(key) {
  const m = monitors.get(key);
  if (!m) return;
  m.source.disconnect();
  monitors.delete(key);
}

// Amigos: usamos o nível de áudio que o WebRTC já calcula para cada recebimento,
// que é mais confiável que analisar a stream remota pelo Web Audio.
async function remoteSpeakers() {
  const speaking = new Set();
  await Promise.all([...peers.values()].map(async (p) => {
    for (const m of p.media.values()) {
      if (m.kind !== 'audio') continue;
      const receiver = p.pc.getReceivers().find((r) => r.track === m.track);
      if (!receiver) continue;
      const stats = await receiver.getStats();
      stats.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.audioLevel > REMOTE_SPEAKING_LEVEL) speaking.add(p.id);
      });
    }
  }));
  return speaking;
}

let checkingSpeakers = false;
setInterval(async () => {
  if (checkingSpeakers || !myId) return;
  checkingSpeakers = true;
  let speaking;
  try {
    speaking = await remoteSpeakers();
  } catch {
    speaking = new Set();
  } finally {
    checkingSpeakers = false;
  }
  for (const m of monitors.values()) {
    m.analyser.getByteTimeDomainData(m.data);
    let sum = 0;
    for (const v of m.data) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    if (Math.sqrt(sum / m.data.length) > SPEAKING_THRESHOLD) speaking.add(m.userId);
  }
  if (me.muted) speaking.delete(myId);
  document.querySelectorAll('#user-list li').forEach((li) => {
    li.classList.toggle('speaking', speaking.has(li.dataset.id));
  });
  $('#me-avatar').classList.toggle('speaking', speaking.has(myId));
}, 100);

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

function renderUsers() {
  const list = $('#user-list');
  const users = [{ id: myId, name: myName, isMe: true, state: me, connecting: false }];
  for (const p of peers.values()) {
    const cs = p.pc.connectionState;
    users.push({ id: p.id, name: p.name, state: p.state, connecting: cs !== 'connected' && cs !== 'closed' });
  }
  $('#member-count').textContent = users.length;
  list.replaceChildren(...users.map((u) => {
    const li = document.createElement('li');
    li.dataset.id = u.id;
    if (u.connecting) {
      li.classList.add('connecting');
      li.title = 'Conectando…';
    }
    const avatar = avatarEl(u.name);
    const name = document.createElement('span');
    name.className = 'user-name';
    name.textContent = u.name;
    if (u.isMe) name.insertAdjacentHTML('beforeend', ' <span class="you">(você)</span>');
    const icons = document.createElement('span');
    icons.className = 'user-icons';
    if (u.state.sharing) icons.insertAdjacentHTML('beforeend', '<span class="live">AO VIVO</span>');
    if (u.state.muted) icons.insertAdjacentHTML('beforeend', ICONS.micOff);
    if (u.state.deafened) icons.insertAdjacentHTML('beforeend', ICONS.headphonesOff);
    if (!u.isMe) {
      const pref = userVolumeFor(u.name);
      if (pref.muted) {
        icons.insertAdjacentHTML('beforeend', ICONS.volumeOff);
        icons.lastElementChild.classList.add('local-muted');
      } else if (pref.volume !== 1) {
        const tag = document.createElement('span');
        tag.className = 'volume-tag';
        tag.textContent = `${Math.round(pref.volume * 100)}%`;
        icons.append(tag);
      }
      li.classList.add('clickable');
      li.title = u.connecting ? 'Conectando…' : 'Clique para ajustar o volume';
      li.onclick = () => openUserMenu(u.id, li);
    }
    li.append(avatar, name, icons);
    return li;
  }));
  updateViewers();
}

function updateControls() {
  const mic = $('#btn-mic');
  mic.innerHTML = me.muted ? ICONS.micOff : ICONS.mic;
  mic.classList.toggle('off', me.muted);
  mic.title = me.muted ? 'Ativar microfone' : 'Mutar microfone';
  mic.disabled = !micStream;

  const deafen = $('#btn-deafen');
  deafen.innerHTML = me.deafened ? ICONS.headphonesOff : ICONS.headphones;
  deafen.classList.toggle('off', me.deafened);
  deafen.title = me.deafened ? 'Ativar áudio' : 'Desativar áudio';

  const share = $('#btn-share');
  share.innerHTML = me.sharing ? ICONS.monitorOff : ICONS.monitor;
  share.classList.toggle('on', me.sharing);
  share.title = me.sharing ? 'Parar de compartilhar' : 'Compartilhar tela';
  $('#btn-share-big').hidden = me.sharing;

  const leaveBtn = $('#btn-leave');
  leaveBtn.innerHTML = ICONS.leave;
  leaveBtn.title = 'Sair da sala';

  const status = $('#me-status');
  status.className = '';
  if (me.sharing) {
    status.textContent = viewersOfMe().length ? `Ao vivo · ${viewersOfMe().length} assistindo` : 'Transmitindo a tela';
    status.className = 'live-status';
  } else if (me.deafened) {
    status.textContent = 'Áudio desativado';
    status.className = 'warn';
  } else if (!micStream) {
    status.textContent = 'Sem microfone';
    status.className = 'warn';
  } else if (me.muted) {
    status.textContent = 'Microfone mutado';
    status.className = 'warn';
  } else {
    status.textContent = 'Conectado na voz';
  }
}

function initMePanel() {
  const avatar = avatarEl(myName);
  avatar.id = 'me-avatar';
  $('#me-avatar').replaceWith(avatar);
  $('#me-name').textContent = myName;
}

function setMuted(muted) {
  me.muted = muted;
  if (micStream) micStream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
}

function toggleMute() {
  if (me.deafened) {
    toggleDeafen();
    return;
  }
  setMuted(!me.muted);
  updateControls();
  sendState();
}

function toggleDeafen() {
  me.deafened = !me.deafened;
  if (me.deafened) {
    mutedBeforeDeafen = me.muted;
    setMuted(true);
  } else {
    setMuted(mutedBeforeDeafen);
  }
  applyOutputAll();
  updateControls();
  sendState();
}

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

function normalizeRoom(name) {
  return name.trim().slice(0, 32).toLowerCase();
}

function renderRooms() {
  const list = $('#room-list');
  list.replaceChildren(...roomList.map((room) => {
    const li = document.createElement('li');
    const isCurrent = room.name === currentRoom;
    li.className = 'room' + (isCurrent ? ' current' : '');
    li.title = isCurrent ? 'Você está aqui' : `Entrar em #${room.name}`;
    const head = document.createElement('div');
    head.className = 'room-head';
    const name = document.createElement('span');
    name.className = 'room-name';
    name.textContent = room.name;
    head.append(name);
    if (room.users.length) {
      const count = document.createElement('span');
      count.className = 'room-count';
      count.textContent = room.users.length;
      head.append(count);
    }
    li.append(head);
    // Nas outras salas, mostra quem está lá (a sala atual tem a lista completa abaixo).
    if (!isCurrent && room.users.length) {
      const who = document.createElement('div');
      who.className = 'room-users';
      who.textContent = room.users.join(', ');
      li.append(who);
    }
    if (!isCurrent) li.onclick = () => switchRoom(room.name);
    return li;
  }));
}

function switchRoom(name) {
  const room = normalizeRoom(name);
  if (!room || !session || !myId || room === currentRoom) return;
  // Desfaz as conexões da sala atual; o 'welcome' da nova sala recria tudo.
  for (const id of [...peers.keys()]) removePeer(id);
  session.joinMsg = { ...session.joinMsg, room };
  storageSet('login', { ...storageGet('login'), room });
  send(session.joinMsg);
}

$('#btn-new-room').onclick = () => {
  const form = $('#new-room-form');
  form.hidden = !form.hidden;
  if (!form.hidden) $('#new-room-input').focus();
};
$('#new-room-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#new-room-input');
  switchRoom(input.value);
  input.value = '';
  $('#new-room-form').hidden = true;
});
$('#new-room-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    $('#new-room-input').value = '';
    $('#new-room-form').hidden = true;
  }
});

// Mutar/desativar pelo botão ou atalho, com um bip para saber o que aconteceu
// mesmo sem olhar a tela (ex.: no meio de um jogo).
function userToggleMute() {
  if (!micStream && !me.deafened) return;
  toggleMute();
  playTone(me.muted ? SOUND_MUTE : SOUND_UNMUTE);
}

function userToggleDeafen() {
  const deafening = !me.deafened;
  if (deafening) playTone(SOUND_MUTE);
  toggleDeafen();
  if (!deafening) playTone(SOUND_UNMUTE);
}

// ---------------------------------------------------------------------------
// Atalhos globais
// ---------------------------------------------------------------------------

const SHORTCUT_DEFAULTS = { mute: 'CommandOrControl+Shift+M', deafen: 'CommandOrControl+Shift+D' };
const shortcuts = { ...SHORTCUT_DEFAULTS, ...storageGet('shortcuts') };
let capturingAction = null;

const KEY_NAMES = {
  Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
  Backquote: '`', Backslash: '\\', Comma: ',', Period: '.', Slash: '/',
};

// Converte um evento de teclado no formato de atalho do Electron.
function acceleratorFrom(event) {
  const { code } = event;
  let key = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
  else if (/^Numpad[0-9]$/.test(code)) key = `num${code.slice(6)}`;
  else if (KEY_NAMES[code]) key = KEY_NAMES[code];
  if (!key) return null;
  const mods = [];
  if (event.ctrlKey) mods.push('CommandOrControl');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  if (event.metaKey) mods.push('Super');
  // Sem modificador, só teclas F: senão o atalho "rouba" uma tecla comum do jogo.
  if (mods.length === 0 && !/^F\d+$/.test(key)) return null;
  return [...mods, key].join('+');
}

function shortcutLabel(accelerator) {
  return accelerator
    .replace('CommandOrControl', window.api.platform === 'darwin' ? 'Cmd' : 'Ctrl')
    .replace('Super', window.api.platform === 'darwin' ? 'Cmd' : 'Win')
    .split('+').join(' + ');
}

async function applyShortcuts() {
  const result = await window.api.setShortcuts(shortcuts);
  const failed = Object.keys(shortcuts).filter((a) => shortcuts[a] && result[a] === false);
  document.querySelectorAll('.shortcut-key').forEach((b) => {
    b.classList.toggle('invalid', failed.includes(b.dataset.action));
  });
  const error = $('#shortcut-error');
  error.hidden = failed.length === 0;
  error.textContent = 'Esse atalho já está sendo usado por outro programa. Escolha outra combinação.';
}

function renderShortcuts() {
  document.querySelectorAll('.shortcut-key').forEach((b) => {
    const action = b.dataset.action;
    const capturing = capturingAction === action;
    b.classList.toggle('capturing', capturing);
    b.classList.toggle('empty', !capturing && !shortcuts[action]);
    b.textContent = capturing ? 'Aperte as teclas…' : (shortcuts[action] ? shortcutLabel(shortcuts[action]) : 'Nenhum');
  });
}

function startCapture(action) {
  capturingAction = action;
  // Desliga os atalhos enquanto grava, para não mutar ao apertar a combinação atual.
  window.api.setShortcuts({});
  renderShortcuts();
}

function stopCapture() {
  capturingAction = null;
  renderShortcuts();
  applyShortcuts();
}

function saveShortcut(action, accelerator) {
  shortcuts[action] = accelerator;
  // Mesma combinação para as duas ações não faz sentido: tira da outra.
  for (const other of Object.keys(shortcuts)) {
    if (other !== action && accelerator && shortcuts[other] === accelerator) shortcuts[other] = '';
  }
  storageSet('shortcuts', shortcuts);
}

document.querySelectorAll('.shortcut-key').forEach((b) => {
  b.onclick = () => (capturingAction === b.dataset.action ? stopCapture() : startCapture(b.dataset.action));
});
document.querySelectorAll('.shortcut-clear').forEach((b) => {
  b.innerHTML = ICONS.close;
  b.onclick = () => {
    saveShortcut(b.dataset.action, '');
    stopCapture();
  };
});
document.addEventListener('keydown', (e) => {
  if (!capturingAction) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape') {
    stopCapture();
    return;
  }
  const accelerator = acceleratorFrom(e);
  if (!accelerator) return; // só modificadores até agora, ou tecla não suportada
  saveShortcut(capturingAction, accelerator);
  stopCapture();
}, true);

window.api.onShortcut((action) => {
  if (!myId) return;
  if (action === 'mute') userToggleMute();
  else if (action === 'deafen') userToggleDeafen();
});

renderShortcuts();
applyShortcuts();

// Mensagens seguidas da mesma pessoa (em até 5 min) ficam agrupadas.
let lastMessage = null;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function addChatMessage({ from, name, text, image, ts }) {
  const list = $('#messages');
  const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const grouped = lastMessage && lastMessage.from === from && ts - lastMessage.ts < GROUP_WINDOW_MS;
  const li = document.createElement('li');
  li.className = 'msg';
  if (!grouped) {
    li.classList.add('first');
    const head = document.createElement('div');
    head.className = 'msg-head';
    const who = document.createElement('span');
    who.className = 'msg-name';
    who.style.color = colorFor(name);
    who.textContent = name;
    const when = document.createElement('span');
    when.className = 'msg-time';
    when.textContent = timeLabel(ts);
    head.append(who, when);
    li.append(avatarEl(name), head);
  }
  if (text) {
    const body = document.createElement('div');
    body.className = 'msg-text';
    appendLinkified(body, text);
    body.title = timeLabel(ts);
    li.append(body);
  }
  if (image) {
    const img = document.createElement('img');
    img.className = 'chat-image';
    img.src = image;
    img.alt = `Imagem enviada por ${name}`;
    img.onclick = () => openLightbox(image);
    // A imagem muda a altura da lista quando termina de carregar.
    img.onload = () => {
      if (atBottom || from === myId) list.scrollTop = list.scrollHeight;
    };
    li.append(img);
  }
  list.append(li);
  lastMessage = { from, ts };
  if (atBottom || from === myId) list.scrollTop = list.scrollHeight;
}

// Transforma endereços http(s) do texto em links (abrem no navegador).
function appendLinkified(el, text) {
  const pattern = /\bhttps?:\/\/[^\s<>"]+/gi;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    // Pontuação no fim normalmente não faz parte do link ("veja https://x.com.").
    const url = match[0].replace(/[.,!?;:)\]}'"]+$/, '');
    if (match.index > last) el.append(text.slice(last, match.index));
    const a = document.createElement('a');
    a.href = url;
    a.textContent = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    el.append(a);
    last = match.index + url.length;
    pattern.lastIndex = last;
  }
  if (last < text.length) el.append(text.slice(last));
}

function addSystemMessage(text) {
  const list = $('#messages');
  const li = document.createElement('li');
  li.className = 'msg system';
  li.textContent = text;
  list.append(li);
  lastMessage = null;
  list.scrollTop = list.scrollHeight;
}

// ---------------------------------------------------------------------------
// Configurações de voz
// ---------------------------------------------------------------------------

const NOISE_HINTS = {
  off: 'Seu microfone vai cru, sem nenhum filtro.',
  standard: 'Filtro leve que já vem no navegador. Tira chiado e barulho constante sem pesar.',
  ai: 'Usa IA (RNNoise) pra separar sua voz do resto: tira teclado, ventilador, cachorro latindo… Gasta um pouco mais de CPU.',
};

// Volume final de um elemento de áudio/vídeo remoto: volume geral × volume
// individual da transmissão. Também direciona para a saída escolhida.
function applyOutput(el) {
  el.volume = Voice.settings.outputVolume * Number(el.dataset.volume ?? 1);
  applyOutputDevice(el);
}

function applyOutputAll() {
  for (const p of peers.values()) {
    for (const m of p.media.values()) {
      if (m.kind === 'audio') applyVoice(p, m);
      else {
        m.el.muted = me.deafened;
        applyOutput(m.el);
      }
    }
  }
  if (audioCtx && audioCtx.setSinkId) {
    const sink = Voice.settings.outputId === 'default' ? '' : Voice.settings.outputId;
    if (audioCtx.sinkId !== sink) audioCtx.setSinkId(sink).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Volume individual de cada amigo
// ---------------------------------------------------------------------------

// Guardado pelo nome, porque o id muda a cada vez que a pessoa entra.
const userVolumes = storageGet('user-volumes');

function userVolumeFor(name) {
  return { volume: 1, muted: false, ...userVolumes[name] };
}

function setUserVolume(name, changes) {
  const next = { ...userVolumeFor(name), ...changes };
  if (next.volume === 1 && !next.muted) delete userVolumes[name];
  else userVolumes[name] = next;
  storageSet('user-volumes', userVolumes);
}

// Até 100% usamos o volume do próprio <audio>. Acima disso o <audio> fica mudo
// e o som passa por um ganho do Web Audio, que consegue amplificar.
function applyVoice(p, m) {
  const pref = userVolumeFor(p.name);
  const volume = me.deafened || pref.muted ? 0 : Voice.settings.outputVolume * pref.volume;
  if (volume <= 1) {
    m.el.muted = volume === 0;
    m.el.volume = volume;
    if (m.boost) m.boost.gain.gain.value = 0;
  } else {
    m.el.muted = true;
    if (!m.boost) {
      audioCtx ??= new AudioContext();
      const source = audioCtx.createMediaStreamSource(m.el.srcObject);
      const gain = audioCtx.createGain();
      source.connect(gain).connect(audioCtx.destination);
      m.boost = { source, gain };
    }
    m.boost.gain.gain.value = volume;
  }
  applyOutputDevice(m.el);
}

function applyOutputDevice(el) {
  const sink = Voice.settings.outputId === 'default' ? '' : Voice.settings.outputId;
  if (el.sinkId !== sink) el.setSinkId(sink).catch((err) => console.warn('Saída de áudio indisponível', err));
}

let userMenuPeer = null;

function openUserMenu(id, anchor) {
  const p = peers.get(id);
  if (!p) return;
  if (userMenuPeer === id) {
    closeUserMenu();
    return;
  }
  userMenuPeer = id;
  const menu = $('#user-menu');
  const avatar = avatarEl(p.name);
  avatar.id = 'um-avatar';
  $('#um-avatar').replaceWith(avatar);
  $('#um-name').textContent = p.name;
  renderUserMenu();
  menu.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const sidebar = $('#sidebar').getBoundingClientRect();
  const top = Math.min(rect.top, window.innerHeight - menu.offsetHeight - 12);
  menu.style.left = `${sidebar.right + 8}px`;
  menu.style.top = `${Math.max(12, top)}px`;
}

function renderUserMenu() {
  const p = peers.get(userMenuPeer);
  if (!p) return;
  const pref = userVolumeFor(p.name);
  $('#um-volume').value = pref.volume;
  $('#um-volume').disabled = pref.muted;
  $('#um-volume-val').textContent = `${Math.round(pref.volume * 100)}%`;
  $('#um-mute').checked = pref.muted;
  $('#um-reset').disabled = pref.volume === 1 && !pref.muted;
}

function closeUserMenu() {
  $('#user-menu').hidden = true;
  userMenuPeer = null;
}

function changeUserVolume(changes) {
  const p = peers.get(userMenuPeer);
  if (!p) return;
  setUserVolume(p.name, changes);
  // A preferência é por nome: aplica em todos os participantes com esse nome.
  for (const peer of peers.values()) {
    if (peer.name !== p.name) continue;
    for (const m of peer.media.values()) if (m.kind === 'audio') applyVoice(peer, m);
  }
  renderUserMenu();
  renderUsers();
}

$('#um-volume').oninput = (e) => changeUserVolume({ volume: Number(e.target.value) });
$('#um-mute').onchange = (e) => changeUserVolume({ muted: e.target.checked });
$('#um-reset').onclick = () => changeUserVolume({ volume: 1, muted: false });
document.addEventListener('mousedown', (e) => {
  if ($('#user-menu').hidden) return;
  if (e.target.closest('#user-menu') || e.target.closest('#user-list li.clickable')) return;
  closeUserMenu();
});

let meterFrame = null;

async function openSettings() {
  $('#settings').hidden = false;
  $('#settings-error').hidden = true;
  renderSettings();
  if (!Voice.running) {
    try {
      const stream = await Voice.start();
      // Entrou na sala sem microfone e agora conseguiu um: passa a enviar.
      if (myId && !micStream) {
        micStream = stream;
        for (const p of peers.values()) {
          if (!p.tracksPending) micStream.getTracks().forEach((t) => p.pc.addTrack(t, micStream));
        }
        monitor('local', micStream, myId);
        updateControls();
        sendState();
      }
    } catch (err) {
      console.error(err);
      showSettingsError('Não foi possível acessar o microfone. Verifique se ele está conectado e se o app tem permissão.');
    }
  }
  await fillDevices();
  updateMeter();
}

function closeSettings() {
  if ($('#settings').hidden) return;
  $('#settings').hidden = true;
  if (capturingAction) stopCapture();
  Voice.stopTest();
  cancelAnimationFrame(meterFrame);
  // Fora de uma sala o microfone só estava aberto pra testar.
  if (!myId) stopMic();
  renderSettings();
}

function showSettingsError(text) {
  const el = $('#settings-error');
  el.textContent = text;
  el.hidden = false;
}

async function fillDevices() {
  const { inputs, outputs } = await Voice.listDevices();
  const fill = (select, list, current) => {
    select.replaceChildren(...list.map((d) => new Option(d.label, d.id)));
    if (!list.some((d) => d.id === 'default')) select.prepend(new Option('Padrão do sistema', 'default'));
    select.value = list.some((d) => d.id === current) ? current : 'default';
  };
  fill($('#set-input'), inputs, Voice.settings.inputId);
  fill($('#set-output'), outputs, Voice.settings.outputId);
}

function renderSettings() {
  const s = Voice.settings;
  $('#set-input-volume').value = s.inputVolume;
  $('#set-input-volume-val').textContent = `${Math.round(s.inputVolume * 100)}%`;
  $('#set-output-volume').value = s.outputVolume;
  $('#set-output-volume-val').textContent = `${Math.round(s.outputVolume * 100)}%`;
  $('#set-gate').checked = s.gate;
  $('#set-gate-threshold').value = s.gateThreshold;
  $('#set-gate-threshold').disabled = !s.gate;
  $('#set-echo').checked = s.echoCancellation;
  $('#set-agc').checked = s.autoGainControl;
  document.querySelectorAll('#set-noise .tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === s.noiseSuppression);
  });
  $('#set-noise-hint').textContent = NOISE_HINTS[s.noiseSuppression];
  const test = $('#set-test');
  test.textContent = Voice.testing ? 'Parar' : 'Me ouvir';
  test.classList.toggle('active', Voice.testing);
  test.disabled = !Voice.running;
}

const DB_MIN = -80;
const DB_MAX = 0;
function updateMeter() {
  const pct = Math.min(100, Math.max(0, ((Voice.level - DB_MIN) / (DB_MAX - DB_MIN)) * 100));
  $('#meter-fill').style.width = `${pct}%`;
  $('#meter').classList.toggle('open', Voice.running && Voice.gateOpen && Voice.level > DB_MIN);
  meterFrame = requestAnimationFrame(updateMeter);
}

async function changeSetting(key, value) {
  try {
    await Voice.set(key, value);
  } catch (err) {
    console.error(err);
    showSettingsError('Não foi possível aplicar essa configuração no microfone.');
  }
  renderSettings();
}

Voice.onChange((key) => {
  if (key === 'outputVolume' || key === 'outputId') applyOutputAll();
  if (key === 'ai-failed') toast('A supressão de ruído por IA não carregou. Voltei pra Padrão.');
});

// O threshold do <input range> vai de -80 a -10 dB, mas o medidor vai até 0 dB.
// Ajustamos a largura do range para o marcador ficar alinhado com o medidor.
$('#set-gate-threshold').style.width = `${((-10 - DB_MIN) / (DB_MAX - DB_MIN)) * 100}%`;

$('#btn-settings').innerHTML = ICONS.settings;
$('#settings-close').innerHTML = ICONS.close;
$('#btn-settings').onclick = openSettings;
$('#btn-settings-login').onclick = openSettings;
$('#settings-close').onclick = closeSettings;
$('#settings').addEventListener('mousedown', (e) => {
  if (e.target.id === 'settings') closeSettings();
});
$('#set-input').onchange = (e) => changeSetting('inputId', e.target.value);
$('#set-output').onchange = (e) => changeSetting('outputId', e.target.value);
$('#set-input-volume').oninput = (e) => changeSetting('inputVolume', Number(e.target.value));
$('#set-output-volume').oninput = (e) => changeSetting('outputVolume', Number(e.target.value));
$('#set-gate').onchange = (e) => changeSetting('gate', e.target.checked);
$('#set-gate-threshold').oninput = (e) => changeSetting('gateThreshold', Number(e.target.value));
$('#set-echo').onchange = (e) => changeSetting('echoCancellation', e.target.checked);
$('#set-agc').onchange = (e) => changeSetting('autoGainControl', e.target.checked);
document.querySelectorAll('#set-noise .tab').forEach((b) => {
  b.onclick = () => changeSetting('noiseSuppression', b.dataset.value);
});
$('#set-test').onclick = () => {
  if (Voice.testing) Voice.stopTest();
  else Voice.startTest();
  renderSettings();
};
navigator.mediaDevices.addEventListener('devicechange', () => {
  if (!$('#settings').hidden) fillDevices();
});

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

$('#chat-send').innerHTML = ICONS.send;
$('#btn-mic').onclick = userToggleMute;
$('#btn-deafen').onclick = userToggleDeafen;
$('#btn-share').onclick = openPicker;
$('#btn-share-big').onclick = openPicker;
$('#btn-leave').onclick = () => leave();

$('#picker-cancel').onclick = closePicker;
$('#picker-go').onclick = confirmPicker;
document.querySelectorAll('#picker-tabs .tab').forEach((tab) => {
  tab.onclick = () => {
    pickerTab = tab.dataset.tab;
    renderPicker();
  };
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#lightbox').hidden) $('#lightbox').hidden = true;
  else if (!$('#emoji-picker').hidden) $('#emoji-picker').hidden = true;
  else if (!$('#user-menu').hidden) closeUserMenu();
  else if (!$('#settings').hidden) closeSettings();
  else if (!$('#picker').hidden) closePicker();
});

$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (!text && !pendingImage) return;
  send({ type: 'chat', text, image: pendingImage || undefined });
  input.value = '';
  setAttachment(null);
  $('#emoji-picker').hidden = true;
});

// ---------------------------------------------------------------------------
// Chat: imagens, emojis e mensagens não lidas
// ---------------------------------------------------------------------------

const IMAGE_MAX_SIDE = 1600;
const IMAGE_MAX_CHARS = 850 * 1024; // o servidor aceita até 900 KB
let pendingImage = null;

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Reduz a imagem até caber no limite. GIFs pequenos vão como estão (animados).
async function prepareImage(file) {
  if (file.type === 'image/gif') {
    const url = await readAsDataURL(file);
    if (url.length <= IMAGE_MAX_CHARS) return url;
  }
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL('image/webp', 0.82);
    if (url.length <= IMAGE_MAX_CHARS) return url;
    scale *= 0.75;
  }
  throw new Error('Imagem grande demais');
}

async function attachFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Só dá pra enviar imagens.');
    return;
  }
  try {
    setAttachment(await prepareImage(file));
    $('#chat-input').focus();
  } catch (err) {
    console.error(err);
    toast('Não foi possível usar essa imagem.');
  }
}

function setAttachment(url) {
  pendingImage = url;
  $('#attachment').hidden = !url;
  $('#attachment-img').src = url || '';
}

function openLightbox(url) {
  $('#lightbox-img').src = url;
  $('#lightbox').hidden = false;
}

$('#btn-attach').innerHTML = ICONS.image;
$('#attachment-remove').innerHTML = ICONS.close;
$('#btn-attach').onclick = () => $('#file-input').click();
$('#file-input').onchange = (e) => {
  attachFile(e.target.files[0]);
  e.target.value = '';
};
$('#attachment-remove').onclick = () => setAttachment(null);
$('#chat-input').addEventListener('paste', (e) => {
  const file = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  attachFile(file);
});
$('#lightbox').onclick = () => { $('#lightbox').hidden = true; };

// Arrastar e soltar imagem no chat.
let dragDepth = 0;
const chatPanel = $('#chat');
chatPanel.addEventListener('dragenter', (e) => {
  if (![...e.dataTransfer.types].includes('Files')) return;
  dragDepth++;
  $('#drop-hint').hidden = false;
});
chatPanel.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('#drop-hint').hidden = true;
});
chatPanel.addEventListener('dragover', (e) => e.preventDefault());
chatPanel.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('#drop-hint').hidden = true;
  attachFile(e.dataTransfer.files[0]);
});
// Soltar arquivo fora do chat não pode fazer a janela "abrir" o arquivo.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

const EMOJIS = [
  '😀', '😂', '🤣', '😅', '😊', '😍', '😘', '😎', '🤔', '🙄', '😴', '😭', '😡', '🤯', '🥳', '😱',
  '🤡', '💀', '👻', '🤖', '👍', '👎', '👏', '🙏', '💪', '👀', '🙌', '🤝', '✌️', '🤞', '👋', '🫡',
  '❤️', '🔥', '💯', '✨', '🎉', '🎮', '🕹️', '🏆', '⚽', '🍕', '🍔', '🍺', '☕', '🎵', '🎧', '📺',
  '💻', '📷', '✅', '❌', '⚠️', '❓', '💤', '🚀', '🌙', '☀️', '🐶', '🐱', '🤫', '🫠', '😬', '🥲',
];
$('#btn-emoji').innerHTML = ICONS.smile;
$('#emoji-picker').append(...EMOJIS.map((emoji) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = emoji;
  button.onclick = () => {
    const input = $('#chat-input');
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(emoji, start, input.selectionEnd ?? start, 'end');
    input.focus();
  };
  return button;
}));
$('#btn-emoji').onclick = () => { $('#emoji-picker').hidden = !$('#emoji-picker').hidden; };
document.addEventListener('mousedown', (e) => {
  if ($('#emoji-picker').hidden) return;
  if (e.target.closest('#emoji-picker') || e.target.closest('#btn-emoji')) return;
  $('#emoji-picker').hidden = true;
});

// Mensagens não lidas: contador no título e janela piscando na barra de tarefas.
let unread = 0;
function bumpUnread() {
  if (document.hasFocus()) return;
  unread++;
  document.title = `(${unread}) Discórdia`;
  window.api.flash();
}
window.addEventListener('focus', () => {
  unread = 0;
  document.title = 'Discórdia';
});

window.addEventListener('beforeunload', () => {
  if (ws) ws.close();
});

initLogin();
