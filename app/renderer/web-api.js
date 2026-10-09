'use strict';

// Na versão web (celular/navegador) não existe o preload do Electron.
// Estas funções substituem window.api com o que o navegador consegue fazer.
if (!window.api) {
  window.api = {
    platform: 'web',
    // O navegador mostra o próprio seletor de tela no getDisplayMedia.
    getSources: async () => [],
    selectSource: async () => {},
    // Atalhos globais e atualização automática só existem no app desktop.
    setShortcuts: async () => ({}),
    onShortcut: () => {},
    flash: async () => {},
    appVersion: async () => 'web',
    installUpdate: async () => {},
    onUpdateReady: () => {},
  };
}

// Compartilhar tela pelo navegador: funciona no computador, não no celular.
window.canShareScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) &&
  !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
