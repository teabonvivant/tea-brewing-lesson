/* 茶席音效與背景音樂。音效全部由 Web Audio 即時合成（不載入音檔），背景音樂為古琴古曲（加廳堂殘響），按清單連播。預設靜音，須按掣開啟。 */
(function () {
  const KEY = "tea-audio";
  const TRACKS = [
    { id: "pingsha", name: "平沙落雁" }, { id: "liushui", name: "流水" }, { id: "peilan", name: "佩蘭" },
    { id: "kongzi", name: "孔子讀易" }, { id: "qiufeng", name: "秋風詞" }
  ];
  const trackSrc = (id) => `assets/audio/guqin-${id}.mp3`;
  const prefs = (() => { try { return Object.assign({ sfx: false, music: false, track: "pingsha" }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { sfx: false, music: false, track: "pingsha" }; } })();
  if (!TRACKS.some((t) => t.id === prefs.track)) prefs.track = TRACKS[0].id;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };
  const listeners = [];
  const emitChange = () => listeners.forEach((f) => f({ sfx: prefs.sfx, music: prefs.music, track: prefs.track }));

  let ctx = null, master = null, sfxBus = null, noise = null, pourBand = null, pourGain = null, burbleGain = null, simGain = null;
  let musicEl = null, fadeTimer = 0;
  const src = {};            // 每個畫面各自的前一幀狀態
  const pourWant = {};       // 每個畫面想要的水聲強度與音高
  const cool = {};           // 各事件冷卻
  const playingNow = {};

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    noise = buf;
    const loop = (off) => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, off); return s; };
    // 倒水：高頻水流＋低頻咕嚕
    pourBand = ctx.createBiquadFilter(); pourBand.type = "bandpass"; pourBand.frequency.value = 2200; pourBand.Q.value = 0.8;
    pourGain = ctx.createGain(); pourGain.gain.value = 0;
    loop(0).connect(pourBand); pourBand.connect(pourGain); pourGain.connect(sfxBus);
    const lo = ctx.createBiquadFilter(); lo.type = "lowpass"; lo.frequency.value = 650;
    burbleGain = ctx.createGain(); burbleGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 9; const lfoG = ctx.createGain(); lfoG.gain.value = 0.5;
    const am = ctx.createGain(); am.gain.value = 0.5; lfo.connect(lfoG); lfoG.connect(am.gain); lfo.start();
    loop(0.7).connect(lo); lo.connect(am); am.connect(burbleGain); burbleGain.connect(sfxBus);
    // 煮水：細微沸騰嘶聲
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5200;
    simGain = ctx.createGain(); simGain.gain.value = 0;
    loop(1.2).connect(hp); hp.connect(simGain); simGain.connect(sfxBus);
    return ctx;
  }

  const now = () => ctx.currentTime;
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(f, t, peak, dur, type = "sine", detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    env(g, t, peak, 0.002, dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(t, dur, f, q, peak, hp) {
    const s = ctx.createBufferSource(); s.buffer = noise; const b = ctx.createBiquadFilter(); b.type = hp ? "highpass" : "bandpass"; b.frequency.value = f; b.Q.value = q || 1;
    const g = ctx.createGain(); env(g, t, peak, 0.004, dur); s.connect(b); b.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const SND = {
    porcelain() { const t = now(), f = 1850 * (0.94 + Math.random() * 0.12); [[1, 0.2, 0.5], [2.76, 0.1, 0.28], [5.4, 0.06, 0.16], [8.9, 0.03, 0.09]].forEach(([m, p, d]) => tone(f * m, t, p, d)); burst(t, 0.03, 4200, 1, 0.05); },
    glass() { const t = now(), f = 2600 * (0.94 + Math.random() * 0.12); [[1, 0.16, 0.7], [2.32, 0.08, 0.42], [4.1, 0.05, 0.25]].forEach(([m, p, d]) => tone(f * m, t, p, d)); },
    wood() { const t = now(); tone(210 * (0.9 + Math.random() * 0.2), t, 0.18, 0.09, "triangle"); burst(t, 0.05, 900, 1.2, 0.08); },
    metal() { const t = now(); [[1, 0.1, 0.4], [2.4, 0.06, 0.25], [3.9, 0.04, 0.16]].forEach(([m, p, d]) => tone(520 * m, t, p, d)); burst(t, 0.04, 2200, 1, 0.05); },
    chime() { const t = now(); tone(1318, t, 0.07, 1.6); tone(1318 * 2.01, t, 0.025, 1.1); tone(1318 * 3.02, t, 0.012, 0.7); },
    drip() { const t = now(), o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.07); env(g, t, 0.1, 0.004, 0.09); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.14); },
    bubble() { const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), f = 260 + Math.random() * 380; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.06); env(g, t, 0.035, 0.005, 0.07); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.12); },
    rustle() { const t = now(); burst(t, 0.12, 4800 + Math.random() * 1500, 0.9, 0.05); burst(t + 0.04, 0.09, 3200, 0.9, 0.035); },
    sip() { const t = now(), s = ctx.createBufferSource(); s.buffer = noise; const b = ctx.createBiquadFilter(); b.type = "bandpass"; b.Q.value = 2.5; b.frequency.setValueAtTime(900, t); b.frequency.exponentialRampToValueAtTime(2600, t + 0.4); const g = ctx.createGain(); env(g, t, 0.09, 0.08, 0.34); s.connect(b); b.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.6); },
    cloth() { burst(now(), 0.12, 700, 0.6, 0.05); }
  };
  function play(name, key, gap) {
    if (!prefs.sfx || !ctx || ctx.state !== "running") return;
    const t = performance.now();
    if (cool[key || name] && t - cool[key || name] < (gap || 90)) return;
    cool[key || name] = t; SND[name]();
  }

  /* 每幀餵入畫面狀態：由狀態變化觸發音效，水流強度驅動倒水聲 */
  function feed(id, s, playing) {
    if (!ctx || !prefs.sfx) { pourWant[id] = null; return; }
    const p = src[id];
    playingNow[id] = playing;
    src[id] = { show: s.show, lid: s.lid, kr: s.kr, sip: s.sip, timer: s.timer, fall: s.fall, drop: s.drop, gy: s.gy, wLevel: s.wLevel };
    if (!playing || !p) { pourWant[id] = null; return; }
    const stream = Math.max(s.sK, s.sG, s.sP);
    if (stream > 0.05) {
      let fill = s.sK >= s.sG && s.sK >= s.sP ? (s.mode === "glass" ? s.wLevel : s.gLevel) : s.sG >= s.sP ? s.pLevel : (s["c" + Math.round(s.pTarget || 0)] || 0);
      pourWant[id] = { v: Math.min(1, stream), fill: Math.max(0, Math.min(1, fill)), thin: s.sP > s.sK && s.sP > s.sG ? 0.75 : 1 };
    } else pourWant[id] = null;
    // 逐件器具出場
    const k0 = p.show * 6, k1 = s.show * 6;
    for (let i = 0; i < 6; i++) if (k0 < i + 0.8 && k1 >= i + 0.8) play([ "wood", "wood", s.mode === "glass" ? "glass" : "porcelain", s.mode === "glass" ? "cloth" : "glass", "porcelain", "porcelain"][i], "app" + i, 120);
    if ((p.lid < 0.5) !== (s.lid < 0.5)) play("porcelain", "lid", 160);
    if (p.kr > 5 && s.kr <= 5) play("metal", "kset", 300);
    if (p.gy < -6 && s.gy >= -1) play("porcelain", "gset", 300);
    if (p.sip < 0.5 && s.sip >= 0.5) play("sip", "sip", 300);
    if (p.timer > 0.02 && s.timer <= 0.02 && p.timer > 0.9) play("chime", "chime", 600);
    if (s.fall > 0 && s.fall < 1) { const a = Math.floor(s.fall * 7), b = Math.floor(p.fall * 7); if (a !== b) play("rustle", "rus", 60); }
    if (s.drop > 0 && s.drop < 1) { const a = Math.floor(s.drop * 3), b = Math.floor(p.drop * 3); if (a !== b) play("drip", "drip", 120); }
    if (s.kr < 5 && s.show > 0.5 && Math.random() < 0.025) play("bubble", "bub", 140);
  }

  function frameUpdate() {
    if (!ctx) return;
    const t = now();
    let v = 0, fill = 0, thin = 1;
    for (const k in pourWant) { const w = pourWant[k]; if (w && w.v > v) { v = w.v; fill = w.fill; thin = w.thin; } }
    const on = prefs.sfx && v > 0;
    pourGain.gain.setTargetAtTime(on ? 0.34 * v * thin : 0, t, 0.05);
    burbleGain.gain.setTargetAtTime(on ? 0.22 * v * (1 - fill * 0.7) : 0, t, 0.06);
    pourBand.frequency.setTargetAtTime(1500 + 2300 * fill + (thin < 1 ? 500 : 0), t, 0.08);
    simGain.gain.setTargetAtTime(prefs.sfx && Object.values(playingNow).some(Boolean) ? 0.018 : 0, t, 0.3);
  }
  setInterval(frameUpdate, 60);

  /* 背景音樂：按需載入，淡入淡出 */
  function fade(to, ms, done) {
    clearInterval(fadeTimer);
    const from = musicEl.volume, t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      musicEl.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(fadeTimer); done && done(); }
    }, 40);
  }
  function startMusic() {
    if (!musicEl) {
      musicEl = new Audio(trackSrc(prefs.track)); musicEl.preload = "auto"; musicEl.volume = 0;
      musicEl.addEventListener("ended", () => { const i = TRACKS.findIndex((t) => t.id === prefs.track); setTrack(TRACKS[(i + 1) % TRACKS.length].id, true); });
    }
    const p = musicEl.play();
    if (p && p.catch) p.catch(() => { /* 瀏覽器要求先有點擊：下一次點擊時再試 */ armUnlock(); });
    fade(0.32, 1800);
  }
  function stopMusic() { if (!musicEl) return; fade(0, 700, () => musicEl.pause()); }
  function setTrack(id, fromEnd) {
    if (!TRACKS.some((t) => t.id === id)) return;
    prefs.track = id; save(); emitChange();
    if (!musicEl) return;
    const swap = () => { musicEl.src = trackSrc(id); if (prefs.music) startMusic(); };
    if (fromEnd || musicEl.paused) swap(); else fade(0, 500, swap);
  }
  let armed = false;
  function armUnlock() {
    if (armed) return; armed = true;
    const go = () => { armed = false; removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true); if (prefs.sfx) ensureCtx(); if (ctx && ctx.state === "suspended") ctx.resume(); if (prefs.music) startMusic(); };
    addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (musicEl) musicEl.pause(); if (ctx && ctx.state === "running") ctx.suspend(); }
    else { if (prefs.music && musicEl) musicEl.play().catch(() => {}); if (ctx && prefs.sfx) ctx.resume(); }
  });

  window.TeaAudio = {
    feed,
    get sfx() { return prefs.sfx; },
    get music() { return prefs.music; },
    setSfx(on) {
      prefs.sfx = !!on; save();
      if (on) { const c = ensureCtx(); if (c && c.state === "suspended") c.resume(); if (sfxBus) sfxBus.gain.setTargetAtTime(1, now(), 0.05); setTimeout(() => ctx && ctx.state === "running" && prefs.sfx && SND.porcelain(), 80); }
      else if (sfxBus) sfxBus.gain.setTargetAtTime(0, now(), 0.05);
      emitChange();
    },
    setMusic(on) { prefs.music = !!on; save(); on ? startMusic() : stopMusic(); emitChange(); },
    tracks: TRACKS,
    get track() { return prefs.track; },
    setTrack,
    onChange(f) { listeners.push(f); f({ sfx: prefs.sfx, music: prefs.music, track: prefs.track }); },
    unlock: armUnlock,
    _dbg: () => ({ state: ctx && ctx.state, pour: pourGain && pourGain.gain.value, band: pourBand && pourBand.frequency.value, music: musicEl && { paused: musicEl.paused, vol: musicEl.volume, t: musicEl.currentTime, src: musicEl.src } })
  };
  if (prefs.sfx || prefs.music) armUnlock();
})();
