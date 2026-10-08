'use strict';

// Pipeline do microfone:
//   dispositivo → [supressão de ruído por IA] → volume → noise gate → stream enviada aos amigos
// A stream de saída é sempre a mesma, então trocar de microfone ou de
// configuração no meio da chamada não exige renegociar as conexões.
const Voice = (() => {
  const STORAGE_KEY = 'voice-settings';
  const DEFAULTS = {
    inputId: 'default',
    outputId: 'default',
    inputVolume: 1,
    outputVolume: 1,
    noiseSuppression: 'standard', // 'off' | 'standard' | 'ai'
    echoCancellation: true,
    autoGainControl: true,
    gate: true,
    gateThreshold: -55, // dB
  };
  const GATE_HOLD_MS = 250;
  const NEEDS_REOPEN = new Set(['inputId', 'noiseSuppression', 'echoCancellation', 'autoGainControl']);

  const settings = { ...DEFAULTS, ...load() };
  const listeners = new Set();

  let ctx = null;
  let raw = null;
  let source = null;
  let rnnoise = null;
  let rnnoiseWasm = null;
  let workletLoaded = false;
  let inputGain = null;
  let analyser = null;
  let gateGain = null;
  let dest = null;
  let samples = null;
  let timer = null;
  let testDest = null;
  let testEl = null;

  let level = -100;
  let gateOpen = true;
  let holdUntil = 0;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* sem armazenamento */ }
  }

  async function getMic() {
    const audio = {
      echoCancellation: settings.echoCancellation,
      noiseSuppression: settings.noiseSuppression === 'standard',
      autoGainControl: settings.autoGainControl,
    };
    if (settings.inputId !== 'default') audio.deviceId = { exact: settings.inputId };
    try {
      return await navigator.mediaDevices.getUserMedia({ audio, video: false });
    } catch (err) {
      // Microfone salvo foi desconectado: cai para o padrão do sistema.
      if (err.name !== 'OverconstrainedError' && err.name !== 'NotFoundError') throw err;
      delete audio.deviceId;
      return navigator.mediaDevices.getUserMedia({ audio, video: false });
    }
  }

  async function ensureRnnoise() {
    if (rnnoise) return rnnoise;
    const lib = await import('./vendor/noise/index.js');
    rnnoiseWasm ??= await lib.loadRnnoise({
      url: 'vendor/noise/rnnoise.wasm',
      simdUrl: 'vendor/noise/rnnoise_simd.wasm',
    });
    if (!workletLoaded) {
      await ctx.audioWorklet.addModule('vendor/noise/rnnoise/workletProcessor.js');
      workletLoaded = true;
    }
    rnnoise = new lib.RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary: rnnoiseWasm });
    return rnnoise;
  }

  function dropRnnoise() {
    if (!rnnoise) return;
    rnnoise.disconnect();
    rnnoise.destroy();
    rnnoise = null;
  }

  async function openInput() {
    const next = await getMic();
    if (source) source.disconnect();
    if (raw) raw.getTracks().forEach((t) => t.stop());
    raw = next;
    source = ctx.createMediaStreamSource(raw);

    if (settings.noiseSuppression === 'ai') {
      try {
        const node = await ensureRnnoise();
        node.disconnect();
        source.connect(node);
        node.connect(inputGain);
        return;
      } catch (err) {
        console.error('Falha ao carregar a supressão de ruído por IA', err);
        settings.noiseSuppression = 'standard';
        save();
        emit('ai-failed');
        return openInput();
      }
    }
    dropRnnoise();
    source.connect(inputGain);
  }

  function tick() {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const x of samples) sum += x * x;
    const rms = Math.sqrt(sum / samples.length);
    level = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;

    const now = performance.now();
    if (!settings.gate || level > settings.gateThreshold) holdUntil = now + GATE_HOLD_MS;
    const open = now < holdUntil;
    if (open !== gateOpen) {
      gateOpen = open;
      // Abre rápido (não corta o começo da fala) e fecha suave.
      gateGain.gain.setTargetAtTime(open ? 1 : 0, ctx.currentTime, open ? 0.005 : 0.05);
    }
  }

  async function start() {
    if (dest) return dest.stream;
    ctx = new AudioContext({ sampleRate: 48000 });
    inputGain = ctx.createGain();
    inputGain.gain.value = settings.inputVolume;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    samples = new Float32Array(analyser.fftSize);
    gateGain = ctx.createGain();
    dest = ctx.createMediaStreamDestination();
    inputGain.connect(analyser);
    inputGain.connect(gateGain);
    gateGain.connect(dest);
    try {
      await openInput();
    } catch (err) {
      stop();
      throw err;
    }
    timer = setInterval(tick, 20);
    return dest.stream;
  }

  function stop() {
    stopTest();
    clearInterval(timer);
    timer = null;
    if (raw) raw.getTracks().forEach((t) => t.stop());
    dropRnnoise();
    if (ctx) ctx.close();
    ctx = raw = source = inputGain = analyser = gateGain = dest = null;
    workletLoaded = false;
    level = -100;
  }

  async function set(key, value) {
    settings[key] = value;
    save();
    if (key === 'inputVolume' && inputGain) inputGain.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
    if (key === 'outputId' && testEl) testEl.setSinkId(value).catch(() => {});
    if (key === 'outputVolume' && testEl) testEl.volume = value;
    if (NEEDS_REOPEN.has(key) && ctx) await openInput();
    emit(key);
  }

  function startTest() {
    if (!ctx || testEl) return;
    testDest = ctx.createMediaStreamDestination();
    gateGain.connect(testDest);
    testEl = new Audio();
    testEl.srcObject = testDest.stream;
    testEl.volume = settings.outputVolume;
    if (settings.outputId !== 'default') testEl.setSinkId(settings.outputId).catch(() => {});
    testEl.play().catch(() => {});
  }

  function stopTest() {
    if (!testEl) return;
    testEl.pause();
    testEl.srcObject = null;
    testEl = null;
    try { gateGain.disconnect(testDest); } catch { /* já desconectado */ }
    testDest = null;
  }

  async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const pick = (kind) => devices
      .filter((d) => d.kind === kind && d.deviceId !== 'communications')
      .map((d, i) => ({ id: d.deviceId, label: d.label || `Dispositivo ${i + 1}` }));
    return { inputs: pick('audioinput'), outputs: pick('audiooutput') };
  }

  function emit(key) {
    listeners.forEach((fn) => fn(key));
  }

  return {
    settings,
    start,
    stop,
    set,
    startTest,
    stopTest,
    listDevices,
    get running() { return !!dest; },
    get testing() { return !!testEl; },
    get level() { return level; },
    get gateOpen() { return gateOpen; },
    onChange: (fn) => listeners.add(fn),
  };
})();
