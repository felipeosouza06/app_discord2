const { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, net, protocol, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const RENDERER_DIR = path.join(__dirname, 'renderer');

// A interface é servida em app://discordia/ em vez de file://, para que fetch,
// módulos JS e AudioWorklets (usados pela supressão de ruído) funcionem.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Captura de tela no Linux com Wayland.
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');

// Fontes listadas no seletor (id -> DesktopCapturerSource) e a escolhida pelo usuário.
// Guardamos a lista para não chamar getSources de novo no Wayland, onde cada
// chamada abre o seletor do sistema.
let sourceCache = new Map();
let pending = { id: null, audio: false };

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    title: 'Discórdia',
    backgroundColor: '#0b0c12',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Links do chat abrem no navegador do sistema, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://')) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });
  win.on('focus', () => win.flashFrame(false));
  win.loadURL('app://discordia/index.html');
}

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  sourceCache = new Map(sources.map((s) => [s.id, s]));
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    isScreen: s.id.startsWith('screen:'),
    thumbnail: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle('select-source', (_event, id, audio) => {
  pending = { id, audio: !!audio };
});

// Atalhos globais (funcionam mesmo com outra janela, como um jogo, em foco).
// Recebe { acao: 'CommandOrControl+Shift+M', ... } e devolve { acao: registrou? }.
ipcMain.handle('set-shortcuts', (event, shortcuts) => {
  globalShortcut.unregisterAll();
  const result = {};
  for (const [action, accelerator] of Object.entries(shortcuts)) {
    if (!accelerator) continue;
    try {
      result[action] = globalShortcut.register(accelerator, () => {
        if (!event.sender.isDestroyed()) event.sender.send('shortcut', action);
      });
    } catch {
      result[action] = false;
    }
  }
  return result;
});

app.on('will-quit', () => globalShortcut.unregisterAll());

// Pisca a janela na barra de tarefas (mensagem nova com o app em segundo plano).
ipcMain.handle('flash', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isFocused()) win.flashFrame(true);
});

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(RENDERER_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response('Não encontrado', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  // Chamado quando a página faz navigator.mediaDevices.getDisplayMedia().
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    const source = sourceCache.get(pending.id);
    if (!source) return callback({});
    const streams = { video: source };
    // Áudio do sistema só é suportado no Windows.
    if (pending.audio && process.platform === 'win32') streams.audio = 'loopback';
    callback(streams);
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
