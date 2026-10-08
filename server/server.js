// Servidor do Discórdia: mantém as salas, repassa a sinalização WebRTC entre
// os participantes e distribui o chat. Áudio e vídeo NÃO passam por aqui,
// vão direto de um participante para o outro.
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.PASSWORD || '';
const HISTORY_SIZE = 100;
const MAX_MESSAGE_BYTES = 64 * 1024;

// Servidor TURN (opcional): repassa áudio/vídeo quando a conexão direta entre
// dois amigos não é possível (CGNAT, 4G, redes restritas). As credenciais ficam
// só aqui e são entregues a quem entrou com a senha certa.
//   TURN_URLS="turn:a.relay.metered.ca:80,turn:a.relay.metered.ca:443?transport=tcp"
//   TURN_USERNAME=... TURN_PASSWORD=...
const TURN_URLS = (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean);
const ICE_SERVERS = TURN_URLS.length
  ? [{ urls: TURN_URLS, username: process.env.TURN_USERNAME || '', credential: process.env.TURN_PASSWORD || '' }]
  : [];

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Servidor do Discórdia rodando.\n');
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

function join(ws, msg) {
  if (ws.room) return;
  const name = cleanText(msg.name, 32);
  const roomName = cleanText(msg.room, 32).toLowerCase();
  if (!name || !roomName) {
    return send(ws, { type: 'error', message: 'Preencha nome e sala.' });
  }
  if (PASSWORD && msg.password !== PASSWORD) {
    return send(ws, { type: 'error', message: 'Senha do servidor incorreta.' });
  }

  let room = rooms.get(roomName);
  if (!room) {
    room = { clients: new Map(), history: [] };
    rooms.set(roomName, room);
  }

  ws.id = crypto.randomUUID();
  ws.name = name;
  ws.state = { muted: false, deafened: false, sharing: false };
  ws.room = room;
  ws.roomName = roomName;

  send(ws, {
    type: 'welcome',
    id: ws.id,
    room: roomName,
    peers: [...room.clients.values()].map(publicInfo),
    history: room.history,
    iceServers: ICE_SERVERS,
  });
  broadcast(room, { type: 'peer-joined', peer: publicInfo(ws) });
  room.clients.set(ws.id, ws);
  console.log(`[${roomName}] ${name} entrou (${room.clients.size} na sala)`);
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws.id);
  broadcast(room, { type: 'peer-left', id: ws.id });
  console.log(`[${ws.roomName}] ${ws.name} saiu (${room.clients.size} na sala)`);
  if (room.clients.size === 0) rooms.delete(ws.roomName);
  ws.room = null;
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
        if (!text) return;
        const entry = { type: 'chat', from: ws.id, name: ws.name, text, ts: Date.now() };
        room.history.push(entry);
        if (room.history.length > HISTORY_SIZE) room.history.shift();
        broadcast(room, entry);
        break;
      }
      case 'state': {
        const s = msg.state || {};
        ws.state = { muted: !!s.muted, deafened: !!s.deafened, sharing: !!s.sharing };
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
