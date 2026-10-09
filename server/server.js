// Servidor do Discórdia: mantém as salas, repassa a sinalização WebRTC entre
// os participantes e distribui o chat. Áudio e vídeo NÃO passam por aqui,
// vão direto de um participante para o outro.
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

// Versão web do app (para celular e navegador): a mesma interface do app
// desktop, servida a partir de app/renderer.
const WEB_DIR = path.resolve(process.env.WEB_DIR || path.join(__dirname, '..', 'app', 'renderer'));
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.PASSWORD || '';
const HISTORY_SIZE = 100;
// Imagens do chat chegam como data URL (o app já reduz antes de enviar).
const MAX_IMAGE_CHARS = 900 * 1024;
const MAX_MESSAGE_BYTES = MAX_IMAGE_CHARS + 64 * 1024;
// Teto de memória do histórico de cada sala, por causa das imagens.
const HISTORY_MAX_CHARS = 12 * 1024 * 1024;
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

// Servidor TURN (opcional): repassa áudio/vídeo quando a conexão direta entre
// dois amigos não é possível (CGNAT, 4G, redes restritas). As credenciais ficam
// só aqui e são entregues a quem entrou com a senha certa.
//   TURN_URLS="turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp"
//   TURN_USERNAME=... TURN_PASSWORD=...
const TURN_URLS = (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean);
const ICE_SERVERS = TURN_URLS.length
  ? [{ urls: TURN_URLS, username: process.env.TURN_USERNAME || '', credential: process.env.TURN_PASSWORD || '' }]
  : [];

function serveWeb(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = '/';
  }
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(WEB_DIR, pathname));
  const type = MIME_TYPES[path.extname(file)];
  if (!file.startsWith(WEB_DIR + path.sep) || !type) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Não encontrado.\n');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado.\n');
    }
    // HTML/JS/CSS sempre revalidados, para quem abrir pegar a versão nova logo.
    const cache = /\.(woff2|wasm|png)$/.test(file) ? 'public, max-age=86400' : 'no-cache';
    res.writeHead(200, { 'content-type': type, 'cache-control': cache });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  serveWeb(req, res);
});

const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_BYTES });

// nome da sala -> { clients: Map<id, ws>, history: [] }
const rooms = new Map();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(room, msg, exceptId) {
  for (const [id, client] of room.clients) {
    if (id !== exceptId) send(client, msg);
  }
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function publicInfo(ws) {
  return { id: ws.id, name: ws.name, state: ws.state };
}

// Salas que sempre aparecem na lista, mesmo vazias.
const DEFAULT_ROOMS = ['geral'];

function roomsSummary() {
  const names = new Set([...DEFAULT_ROOMS, ...rooms.keys()]);
  return [...names]
    .map((name) => ({
      name,
      users: rooms.has(name) ? [...rooms.get(name).clients.values()].map((c) => c.name) : [],
    }))
    .sort((a, b) => (DEFAULT_ROOMS.includes(b.name) - DEFAULT_ROOMS.includes(a.name)) || a.name.localeCompare(b.name));
}

// Avisa todos que estão em alguma sala (ou seja, já passaram pela senha).
function broadcastRooms() {
  const msg = { type: 'rooms', rooms: roomsSummary() };
  for (const client of wss.clients) {
    if (client.room) send(client, msg);
  }
}

function historyChars(entry) {
  return entry.text.length + (entry.image ? entry.image.length : 0);
}

function addToHistory(room, entry) {
  room.history.push(entry);
  room.historyChars = (room.historyChars || 0) + historyChars(entry);
  while (room.history.length > HISTORY_SIZE || room.historyChars > HISTORY_MAX_CHARS) {
    room.historyChars -= historyChars(room.history.shift());
  }
}

function join(ws, msg) {
  const name = cleanText(msg.name, 32);
  const roomName = cleanText(msg.room, 32).toLowerCase();
  if (!name || !roomName) {
    return send(ws, { type: 'error', message: 'Preencha nome e sala.' });
  }
  if (PASSWORD && msg.password !== PASSWORD) {
    return send(ws, { type: 'error', message: 'Senha do servidor incorreta.' });
  }
  // Já está numa sala: é uma troca de sala.
  if (ws.room) {
    if (ws.roomName === roomName) return;
    leave(ws, { silent: true });
  }

  let room = rooms.get(roomName);
  if (!room) {
    room = { clients: new Map(), history: [] };
    rooms.set(roomName, room);
  }

  ws.id = crypto.randomUUID();
  ws.name = name;
  ws.state = { muted: false, deafened: false, sharing: false, watching: [] };
  ws.room = room;
  ws.roomName = roomName;

  send(ws, {
    type: 'welcome',
    id: ws.id,
    room: roomName,
    peers: [...room.clients.values()].map(publicInfo),
    history: room.history,
    iceServers: ICE_SERVERS,
    rooms: roomsSummary(),
  });
  broadcast(room, { type: 'peer-joined', peer: publicInfo(ws) });
  room.clients.set(ws.id, ws);
  console.log(`[${roomName}] ${name} entrou (${room.clients.size} na sala)`);
  broadcastRooms();
}

// silent: troca de sala, a lista de salas é atualizada logo depois, no join.
function leave(ws, { silent = false } = {}) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws.id);
  broadcast(room, { type: 'peer-left', id: ws.id });
  console.log(`[${ws.roomName}] ${ws.name} saiu (${room.clients.size} na sala)`);
  if (room.clients.size === 0) rooms.delete(ws.roomName);
  ws.room = null;
  if (!silent) broadcastRooms();
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'join') return join(ws, msg);
    const room = ws.room;
    if (!room) return;

    switch (msg.type) {
      case 'signal': {
        const target = room.clients.get(msg.to);
        if (target) send(target, { type: 'signal', from: ws.id, data: msg.data });
        break;
      }
      case 'chat': {
        const text = cleanText(msg.text, 2000);
        const image = typeof msg.image === 'string' && msg.image.length <= MAX_IMAGE_CHARS && IMAGE_PATTERN.test(msg.image)
          ? msg.image
          : undefined;
        if (!text && !image) return;
        const entry = { type: 'chat', from: ws.id, name: ws.name, text, image, ts: Date.now() };
        addToHistory(room, entry);
        broadcast(room, entry);
        break;
      }
      case 'state': {
        const s = msg.state || {};
        // watching: ids de quem a pessoa está assistindo a transmissão agora.
        const watching = Array.isArray(s.watching)
          ? s.watching.filter((id) => typeof id === 'string').slice(0, 20).map((id) => id.slice(0, 64))
          : [];
        ws.state = { muted: !!s.muted, deafened: !!s.deafened, sharing: !!s.sharing, watching };
        broadcast(room, { type: 'peer-state', id: ws.id, state: ws.state }, ws.id);
        break;
      }
    }
  });

  ws.on('close', () => leave(ws));
});

// Derruba conexões mortas (ex.: PC do amigo caiu sem fechar o app).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Servidor do Discórdia ouvindo na porta ${PORT}`);
  if (PASSWORD) console.log('Senha do servidor ativada.');
  if (ICE_SERVERS.length) console.log(`TURN configurado (${TURN_URLS.length} endereço(s)).`);
});
