// Endereço do servidor que já vem preenchido na tela de entrada.
// Troque pelo endereço do seu servidor antes de gerar o app para os amigos,
// ex.: 'wss://discordia-server.onrender.com'
window.APP_CONFIG = {
  defaultServer: 'wss://discordia-server-dm3c.onrender.com',
};

// Na versão web, a própria página vem do servidor: usa o mesmo endereço.
if (location.protocol === 'http:' || location.protocol === 'https:') {
  window.APP_CONFIG.defaultServer = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}
