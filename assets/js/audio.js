/* 茶席音效與背景音樂。倒水聲為真實錄音（公共領域，見頁腳），其餘輕柔音效由 Web Audio 即時合成，背景音樂為古琴古曲（加廳堂殘響），按清單連播。預設靜音，須按掣開啟。 */
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
  const emitChange = () => listeners.forEach((f) => f({ sfx: prefs.sfx, music: prefs.music, track: prefs.track, error: audioError }));

  let ctx = null, master = null, sfxBus = null, noise = null, pourBand = null, pourGain = null, pourSrc = null;
  let musicEl = null, fadeTimer = 0, audioError = "";
  const src = {};            // 每個畫面各自的前一幀狀態
  const pourWant = {};       // 每個畫面想要的水聲強度與音高
  const cool = {};           // 各事件冷卻
  const playingNow = {};

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0;
    // 柔化：切走高頻刺耳成分，再加一點廳堂殘響，令音效圓潤有空間
    const soft = ctx.createBiquadFilter(); soft.type = "lowpass"; soft.frequency.value = 4800; soft.Q.value = 0.5;
    const dry = ctx.createGain(); dry.gain.value = 0.8;
    const wet = ctx.createGain(); wet.gain.value = 0.18;
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.7), ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.32; d[i] = lp * Math.pow(1 - i / d.length, 3.2); } }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    sfxBus.connect(soft); soft.connect(dry); dry.connect(master); soft.connect(conv); conv.connect(wet); wet.connect(master);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noise = buf;
    // 水聲：真實倒水錄音循環播放，音量、音高與亮度隨水流和水位變化
    pourBand = ctx.createBiquadFilter(); pourBand.type = "lowpass"; pourBand.frequency.value = 1800; pourBand.Q.value = 0.3;
    pourGain = ctx.createGain(); pourGain.gain.value = 0;
    pourBand.connect(pourGain); pourGain.connect(sfxBus);
    fetch("assets/audio/water-pour.mp3").then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((ab) => ctx.decodeAudioData(ab)).then((buf) => {
      pourSrc = ctx.createBufferSource(); pourSrc.buffer = buf; pourSrc.loop = true; pourSrc.connect(pourBand); pourSrc.start(0, 1);
    }).catch(() => { audioError = "水聲載入失敗"; emitChange(); });
    return ctx;
  }

  const now = () => ctx.currentTime;
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(f, t, peak, dur, type = "sine", detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    env(g, t, peak, 0.004, dur); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(t, dur, f, q, peak) {
    const s = ctx.createBufferSource(); s.buffer = noise; const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = f; b.Q.value = q || 0.5;
    const g = ctx.createGain(); env(g, t, peak, 0.01, dur); s.connect(b); b.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  /* 輕柔的放置聲：低頻短促的悶響，沒有叮噹的金屬或瓷鳴 */
  function thud(f, peak) { const t = now(); tone(f * (0.95 + Math.random() * 0.1), t, peak, 0.1); burst(t, 0.05, 420, 0.3, peak * 0.4); }
  const SND = {
    porcelain() { thud(210, 0.05); },
    glass() { thud(260, 0.04); },
    wood() { thud(150, 0.05); },
    metal() { thud(180, 0.035); },
    chime() {},
    drip() {},
    bubble() {},
    rustle() { const t = now(); burst(t, 0.16, 2600, 0.4, 0.012); },
    sip() { const t = now(), s = ctx.createBufferSource(); s.buffer = noise; const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.Q.value = 1; b.frequency.setValueAtTime(600, t); b.frequency.exponentialRampToValueAtTime(1400, t + 0.45); const g = ctx.createGain(); env(g, t, 0.03, 0.12, 0.4); s.connect(b); b.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.7); },
    cloth() { burst(now(), 0.14, 500, 0.4, 0.018); }
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
    const waste = Math.max(s.sW || 0, s.sC || 0);
    const stream = Math.max(s.sK, s.sG, s.sP, waste);
    if (stream > 0.05) {
      let fill = s.sK >= s.sG && s.sK >= s.sP ? (s.mode === "glass" ? s.wLevel : s.gLevel) : s.sG >= s.sP ? s.pLevel : (s["c" + Math.round(s.pTarget || 0)] || 0);
      if (waste >= stream) fill = 0.2;
      pourWant[id] = { v: Math.min(1, stream), fill: Math.max(0, Math.min(1, fill)), thin: waste >= stream || (s.sP > s.sK && s.sP > s.sG) ? 0.75 : 1 };
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
  }

  function frameUpdate() {
    if (!ctx) return;
    const t = now();
    let v = 0, fill = 0, thin = 1;
    for (const k in pourWant) { const w = pourWant[k]; if (w && w.v > v) { v = w.v; fill = w.fill; thin = w.thin; } }
    const on = prefs.sfx && v > 0;
    pourGain.gain.setTargetAtTime(on ? 0.2 * v * thin : 0, t, 0.3);
    pourBand.frequency.setTargetAtTime(1500 + 1500 * fill, t, 0.3);
    if (pourSrc) pourSrc.playbackRate.setTargetAtTime((0.82 + 0.12 * fill) * (thin < 1 ? 1.04 : 1), t, 0.4);
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
      musicEl.addEventListener("error", () => { audioError = "背景音樂載入失敗"; emitChange(); });
      musicEl.addEventListener("playing", () => { if (audioError === "背景音樂載入失敗") { audioError = ""; emitChange(); } });
      musicEl.addEventListener("ended", () => { const i = TRACKS.findIndex((t) => t.id === prefs.track); setTrack(TRACKS[(i + 1) % TRACKS.length].id, true); });
    }
    if (!musicEl.src.endsWith(trackSrc(prefs.track))) musicEl.src = trackSrc(prefs.track);
    const p = musicEl.play();
    if (p && p.catch) p.catch((e) => { if (e && e.name === "NotAllowedError") armUnlock(); });
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
    stop(id) { pourWant[id] = null; },
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
    onChange(f) { listeners.push(f); f({ sfx: prefs.sfx, music: prefs.music, track: prefs.track, error: audioError }); },
    unlock: armUnlock,
    _dbg: () => ({ state: ctx && ctx.state, pour: pourGain && pourGain.gain.value, band: pourBand && pourBand.frequency.value, music: musicEl && { paused: musicEl.paused, vol: musicEl.volume, t: musicEl.currentTime, src: musicEl.src } })
  };
  if (prefs.sfx || prefs.music) armUnlock();
})();
