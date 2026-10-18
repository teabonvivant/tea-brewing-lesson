/* 茶席特寫動畫：以 SVG 繪畫茶具，按關鍵幀時間軸演示每一步手法。 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  /* 器具擺位（舞台座標 800×500，原點為各器具底部中心）；L 為按單品圖錨點計算出的相對位置，見 applyKit()。 */
  const HOME = {
    kettle: { x: 104, y: 402 },
    caddy: { x: 196, y: 452 },
    gaiwan: { x: 404, y: 356 },
    glass: { x: 450, y: 356 },
    towel: { x: 668, y: 362 },
    pitcher: { x: 530, y: 352 },
    cups: [{ x: 634, y: 358 }, { x: 698, y: 360 }, { x: 760, y: 362 }],
    chahe: { x: 296, y: 360 }
  };
  const L = {
    kettleTip: { x: 93, y: -80 }, kettlePivot: { x: 0, y: -52 },
    gaiwanLip: { x: 58, y: -68 }, gaiwanRim: -68,
    pitcherTip: { x: 47, y: -106 }, pitcherTop: -100,
    cupRim: -34, glassTop: -130, glassFloor: -4, glassH: 124, chaheTip: { x: 50, y: -4 }
  };
  const WATER = "#dfeef3";

  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const rad = (d) => (d * Math.PI) / 180;
  function rot(p, piv, deg) {
    const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
    const dx = p.x - piv.x, dy = p.y - piv.y;
    return { x: piv.x + dx * c - dy * s, y: piv.y + dx * s + dy * c };
  }
  function mixColor(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(lerp((pa >> sh) & 255, (pb >> sh) & 255, k));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }
  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------- 時間軸 ---------- */
  class Clip {
    constructor(base) { this.base = base; this.tracks = {}; this.dur = 0; this.labels = []; }
    key(name, t, v) {
      (this.tracks[name] = this.tracks[name] || []).push([t, v]);
      if (t > this.dur) this.dur = t;
      return this;
    }
    hold(name, t0, t1, v) { return this.key(name, t0, v).key(name, t1, v); }
    label(t, text) { this.labels.push([t, text]); if (t > this.dur) this.dur = t; return this; }
    finish(extra = 0.6) {
      for (const n in this.tracks) {
        const tr = this.tracks[n].sort((a, b) => a[0] - b[0]);
        if (tr[0][0] > 0) tr.unshift([0, this.base[n] !== undefined ? this.base[n] : tr[0][1]]);
      }
      this.labels.sort((a, b) => a[0] - b[0]);
      this.dur += extra;
      return this;
    }
    sample(t) {
      const s = Object.assign({}, this.base);
      for (const n in this.tracks) {
        const tr = this.tracks[n];
        if (t <= tr[0][0]) { s[n] = tr[0][1]; continue; }
        if (t >= tr[tr.length - 1][0]) { s[n] = tr[tr.length - 1][1]; continue; }
        for (let i = 0; i < tr.length - 1; i++) {
          const [t0, v0] = tr[i], [t1, v1] = tr[i + 1];
          if (t >= t0 && t <= t1) {
            s[n] = typeof v0 === "number" && typeof v1 === "number" ? lerp(v0, v1, ease((t - t0) / (t1 - t0 || 1))) : v0;
            break;
          }
        }
      }
      s.label = "";
      for (const [lt, tx] of this.labels) if (t >= lt) s.label = tx;
      return s;
    }
  }

  function baseState(tea, mode) {
    return {
      mode, show: 1,
      kx: 0, ky: 0, kr: 0,
      gx: 0, gy: 0, gr: 0, gLevel: 0, gTint: 0, gLeaves: 0, lid: 0, lidX: 0, lidR: 0,
      wx: 0, wy: 0, wr: 0, ws: 1, wLevel: 0, wTint: 0, wLeaves: 0, dance: 0,
      px: 0, py: 0, pr: 0, pLevel: 0, pTint: 1,
      c0: 0, c1: 0, c2: 0, cTint: 1, c1x: 0, c1y: 0, c1s: 1,
      hx: 0, hy: 0, hr: 0, hs: 1, hLeaves: 0, fall: 0,
      sK: 0, sKTea: 0, sG: 0, sP: 0, sGTarget: "pitcher", pTarget: 0,
      drop: 0, dropTarget: 0, timer: 0, timerText: "", steamCup: 0, sip: 0, temp: 1
    };
  }

  /* 計算物件要移到哪裏，令壺嘴／出水點對準目標 */
  function aimKettle(target, r, h) {
    const tip = rot(L.kettleTip, L.kettlePivot, r);
    return { x: target.x - 4 - (HOME.kettle.x + tip.x), y: target.y - h - (HOME.kettle.y + tip.y) };
  }
  function aimPitcher(target, r, h) {
    const tip = rot(L.pitcherTip, L.pitcherTip, r);
    return { x: target.x - 6 - (HOME.pitcher.x + tip.x), y: target.y - h - (HOME.pitcher.y + tip.y) };
  }
  const gaiwanTop = () => ({ x: HOME.gaiwan.x + L.gaiwanRimX, y: HOME.gaiwan.y + L.gaiwanRim });
  const glassTop = () => ({ x: HOME.glass.x + L.glassRimX, y: HOME.glass.y + L.glassTop });
  const pitcherTop = () => ({ x: HOME.pitcher.x + L.pitcherRimX, y: HOME.pitcher.y + L.pitcherTop });
  const cupTop = (i) => ({ x: HOME.cups[i].x, y: HOME.cups[i].y + L.cupRim });

  function kettlePour(c, t0, target, o) {
    const r = o.r || 38, h = o.h || 34, dur = o.dur || 2;
    const a = aimKettle(target, r, h);
    c.key("kx", t0, 0).key("ky", t0, 0).key("kr", t0, 0)
      .key("kx", t0 + 0.8, a.x).key("ky", t0 + 0.8, a.y).key("kr", t0 + 0.8, r)
      .hold("sK", t0, t0 + 0.75, 0).key("sK", t0 + 0.95, 1).key("sK", t0 + 0.8 + dur, 1).key("sK", t0 + 1.0 + dur, 0);
    if (o.bob) {
      const step = dur / 6;
      for (let i = 0; i < 6; i++) c.key("ky", t0 + 0.8 + step * (i + 0.5), a.y + (i % 2 === 0 ? -46 : 0));
    }
    c.key("kx", t0 + 0.8 + dur, a.x).key("ky", t0 + 0.8 + dur, a.y).key("kr", t0 + 0.8 + dur, r)
      .key("kr", t0 + 1.5 + dur, 0).key("kx", t0 + 1.8 + dur, 0).key("ky", t0 + 1.8 + dur, 0);
    return t0 + 1.8 + dur;
  }
  function gaiwanPour(c, t0, target, dur, base) {
    const dx = target.x - (HOME.gaiwan.x + L.gaiwanLip.x), dy = target.y - 26 - (HOME.gaiwan.y + L.gaiwanLip.y);
    c.key("gx", t0, 0).key("gy", t0, 0).key("gr", t0, 0)
      .key("gx", t0 + 0.7, dx).key("gy", t0 + 0.7, dy).key("gr", t0 + 0.7, 18)
      .key("gr", t0 + 1.1, 78).hold("sG", t0, t0 + 0.95, 0).key("sG", t0 + 1.15, 1)
      .key("gr", t0 + 1.1 + dur, 92).key("sG", t0 + 1.0 + dur, 1).key("sG", t0 + 1.2 + dur, 0)
      .key("gr", t0 + 1.6 + dur, 0).key("gx", t0 + 2.0 + dur, 0).key("gy", t0 + 2.0 + dur, 0)
      .key("gx", t0 + 1.6 + dur, dx * 0.6).key("gy", t0 + 1.6 + dur, dy * 0.5);
    if (base) c.key("gLevel", t0 + 1.1, base).key("gLevel", t0 + 1.1 + dur, 0);
    return t0 + 2.0 + dur;
  }
  function pitcherPour(c, t0, i, dur, from, to, cupFrom, cupTo) {
    const r = 48, a = aimPitcher(cupTop(i), r, 44);
    c.key("px", t0, c.lastPx || 0).key("py", t0, c.lastPy || 0).key("pr", t0, c.lastPr || 0)
      .key("px", t0 + 0.6, a.x).key("py", t0 + 0.6, a.y).key("pr", t0 + 0.6, 22)
      .key("pr", t0 + 0.9, r).key("pr", t0 + 0.9 + dur, r + 6).key("pr", t0 + 1.2 + dur, 22)
      .key("px", t0 + 0.9 + dur, a.x).key("py", t0 + 0.9 + dur, a.y).key("py", t0 + 1.2 + dur, a.y - 34)
      .key("pTarget", t0, i)
      .hold("sP", t0, t0 + 0.85, 0).key("sP", t0 + 1.0, 1).key("sP", t0 + 0.85 + dur, 1).key("sP", t0 + 1.0 + dur, 0)
      .key("pLevel", t0 + 0.9, from).key("pLevel", t0 + 0.9 + dur, to)
      .key("c" + i, t0 + 0.95, cupFrom).key("c" + i, t0 + 0.95 + dur, cupTo);
    c.lastPx = a.x; c.lastPy = a.y - 34; c.lastPr = 22;
    return t0 + 1.2 + dur;
  }
  const aimGaiwan = (target, h) => ({ x: target.x - (HOME.gaiwan.x + L.gaiwanLip.x), y: target.y - h - (HOME.gaiwan.y + L.gaiwanLip.y) });
  function gaiwanCup(c, t0, i, dur, from, to, cupFrom, cupTo, r) {
    const a = aimGaiwan(cupTop(i), 30);
    c.key("gx", t0, c.lastGx || 0).key("gy", t0, c.lastGy || 0).key("gr", t0, c.lastGr || 0)
      .key("gx", t0 + 0.5, a.x).key("gy", t0 + 0.5, a.y).key("gr", t0 + 0.5, r - 22)
      .key("gr", t0 + 0.75, r).key("gr", t0 + 0.75 + dur, r + 4).key("gr", t0 + 1.0 + dur, r - 30)
      .key("gx", t0 + 0.75 + dur, a.x).key("gy", t0 + 0.75 + dur, a.y).key("gy", t0 + 1.0 + dur, a.y - 16)
      .key("pTarget", t0, i)
      .hold("sG", t0, t0 + 0.7, 0).key("sG", t0 + 0.82, 1).key("sG", t0 + 0.7 + dur, 1).key("sG", t0 + 0.85 + dur, 0)
      .key("gLevel", t0 + 0.75, from).key("gLevel", t0 + 0.75 + dur, to)
      .key("c" + i, t0 + 0.8, cupFrom).key("c" + i, t0 + 0.8 + dur, cupTo);
    c.lastGx = a.x; c.lastGy = a.y - 16; c.lastGr = r - 30;
    return t0 + 1.0 + dur;
  }
  function gaiwanHome(c, t0) {
    c.key("gx", t0, c.lastGx || 0).key("gy", t0, c.lastGy || 0).key("gr", t0, c.lastGr || 0)
      .key("gr", t0 + 0.4, 0).key("gx", t0 + 0.8, 0).key("gy", t0 + 0.8, 0);
    c.lastGx = c.lastGy = c.lastGr = 0;
    return t0 + 0.8;
  }
  function pitcherHome(c, t0) {
    c.key("px", t0, c.lastPx || 0).key("py", t0, c.lastPy || 0).key("pr", t0, c.lastPr || 0)
      .key("pr", t0 + 0.4, 0).key("px", t0 + 0.8, 0).key("py", t0 + 0.8, 0);
    c.lastPx = 0; c.lastPy = 0; c.lastPr = 0;
    return t0 + 0.8;
  }

  /* ---------- 各步動畫 ---------- */
  function buildClip(id, tea) {
    const glass = tea.vessel === "glass";
    const mode = glass ? "glass" : "gaiwan";
    const b = baseState(tea, mode);
    const temp = tea.temp[0] === tea.temp[1] ? `${tea.temp[0]}°C` : `${tea.temp[0]}–${tea.temp[1]}°C`;
    const preset = {
      prepare: {}, warm: {}, view: {}, add: { hLeaves: 1 },
      rinse: { gLeaves: 1 }, brew: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.25 } : { gLeaves: 1 },
      pour: { gLeaves: 1, gLevel: 1, gTint: 1, lid: 1 },
      share: { gLeaves: 1, pLevel: 0.82 },
      serve: glass ? { wLeaves: 1, wLevel: 0.72, wTint: 1, dance: 1 } : { gLeaves: 1, pLevel: 0.12, c0: 0.7, c1: 0.7, c2: 0.7 },
      taste: glass ? { wLeaves: 1, wLevel: 0.72, wTint: 1, wx: -10, wy: 52, ws: 1.35, dance: 1 } : { gLeaves: 1, pLevel: 0.12, c0: 0.7, c1: 0.7, c2: 0.7, c1x: -298, c1y: 62, c1s: 1.9 },
      again: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.9, dance: 1 } : { gLeaves: 1, lid: 0 }
    };
    Object.assign(b, preset[id] || {});
    const c = new Clip(b);
    const gTarget = (lvl) => ({ x: gaiwanTop().x, y: gaiwanTop().y + (1 - lvl) * 10 });
    const wTarget = (lvl) => ({ x: glassTop().x, y: HOME.glass.y + L.glassFloor - lvl * L.glassH });

    switch (id) {
      case "prepare":
        c.key("show", 0, 0).key("show", 2.6, 1).label(0, "淨手・擺具・煮水").label(2.8, `今日水溫 ${temp}`);
        c.key("temp", 0, 0).key("temp", 2.8, 0).key("temp", 3.4, 1).key("temp", 4.6, 1);
        break;
      case "warm":
        if (glass) {
          c.label(0, "注入約三分一熱水");
          let t = kettlePour(c, 0.2, wTarget(0.1), { r: 34, h: 30, dur: 1.6 });
          c.key("wLevel", 1.1, 0).key("wLevel", 2.6, 0.3);
          c.label(t, "轉動杯身，令杯壁受熱");
          c.key("wr", t, 0).key("wr", t + 0.4, -8).key("wr", t + 0.8, 8).key("wr", t + 1.2, -8).key("wr", t + 1.6, 0);
          t += 1.8;
          c.label(t, "倒去溫杯水").key("wr", t, 0).key("wr", t + 0.6, 62).key("wLevel", t + 0.5, 0.3).key("wLevel", t + 1.3, 0).key("wr", t + 1.8, 0);
        } else {
          c.label(0, "沸水注入蓋碗").key("lid", 0, 0);
          let t = kettlePour(c, 0.1, gTarget(0.4), { r: 36, h: 30, dur: 1.4 });
          c.key("gLevel", 1.0, 0).key("gLevel", 2.3, 0.55).key("gTint", 0, 0);
          c.label(t - 0.6, "再倒入公道杯").key("pTint", 0, 0).key("lid", t - 1.2, 0).key("lid", t - 0.6, 1);
          t = gaiwanPour(c, t - 0.5, pitcherTop(), 1.0, 0.55);
          c.key("pLevel", t - 2.8, 0).key("pLevel", t - 1.6, 0.6);
          c.label(t - 0.4, "分到各品茗杯").key("cTint", 0, 0);
          t = pitcherPour(c, t - 0.4, 0, 0.45, 0.6, 0.4, 0, 0.6);
          t = pitcherPour(c, t - 0.2, 1, 0.45, 0.4, 0.2, 0, 0.6);
          t = pitcherPour(c, t - 0.2, 2, 0.45, 0.2, 0, 0, 0.6);
          t = pitcherHome(c, t);
          c.label(t, "器具溫熱後，倒去溫杯水");
          ["c0", "c1", "c2"].forEach((k, i) => c.key(k, t + 0.2 + i * 0.25, 0.6).key(k, t + 0.6 + i * 0.25, 0));
        }
        break;
      case "view":
        c.label(0, "以茶則取茶，放入茶荷").key("hLeaves", 0.3, 0).key("hLeaves", 1.6, 1);
        c.label(1.9, "雙手捧茶荷，請客人賞茶");
        c.key("hx", 1.8, 0).key("hy", 1.8, 0).key("hs", 1.8, 1).key("hx", 2.8, 210).key("hy", 2.8, -6).key("hs", 2.8, 1.9)
          .key("hr", 3.2, -4).key("hr", 3.8, 4).key("hr", 4.3, 0)
          .key("hx", 4.6, 210).key("hy", 4.6, -6).key("hs", 4.6, 1.9).key("hx", 5.5, 0).key("hy", 5.5, 0).key("hs", 5.5, 1);
        c.label(4.6, `${tea.sample}・${tea.family}`);
        break;
      case "add": {
        const tgt = glass ? glassTop() : gaiwanTop();
        if (glass) {
          c.label(0, "中投法：先注三分一水");
          kettlePour(c, 0, wTarget(0.1), { r: 34, h: 30, dur: 1.4 });
          c.key("wLevel", 0.9, 0).key("wLevel", 2.2, 0.3);
        }
        const t0 = glass ? 3.2 : 0.2;
        const hx = tgt.x - 40 - (HOME.chahe.x + L.chaheTip.x), hy = tgt.y - 30 - (HOME.chahe.y + L.chaheTip.y);
        c.label(t0, "茶荷移到碗上，以茶匙撥茶入碗");
        c.key("hx", t0, 0).key("hy", t0, 0).key("hr", t0, 0).key("hx", t0 + 0.9, hx).key("hy", t0 + 0.9, hy).key("hr", t0 + 0.9, 0)
          .key("hr", t0 + 1.3, 26).key("fall", t0 + 1.2, 0).key("fall", t0 + 2.9, 1)
          .key("hLeaves", t0 + 1.2, 1).key("hLeaves", t0 + 2.8, 0).key(glass ? "wLeaves" : "gLeaves", t0 + 1.5, 0).key(glass ? "wLeaves" : "gLeaves", t0 + 2.9, 1)
          .key("hr", t0 + 3.0, 26).key("hr", t0 + 3.4, 0).key("hx", t0 + 3.0, hx).key("hy", t0 + 3.0, hy).key("hx", t0 + 4.0, 0).key("hy", t0 + 4.0, 0);
        if (glass) {
          c.label(t0 + 4.0, "輕搖杯身，令茶葉吸水舒展").key("wTint", t0 + 3.0, 0).key("wTint", t0 + 5.4, 0.25)
            .key("wr", t0 + 4.1, 0).key("wr", t0 + 4.5, -7).key("wr", t0 + 4.9, 7).key("wr", t0 + 5.3, 0);
        } else {
          c.label(t0 + 4.0, "蓋上碗蓋輕搖，聞乾茶香").key("lid", t0 + 3.8, 0).key("lid", t0 + 4.4, 1)
            .key("gr", t0 + 4.4, 0).key("gr", t0 + 4.7, -6).key("gr", t0 + 5.0, 6).key("gr", t0 + 5.3, -6).key("gr", t0 + 5.6, 0)
            .key("gy", t0 + 4.4, 0).key("gy", t0 + 4.7, -10).key("gy", t0 + 5.6, -10).key("gy", t0 + 6.0, 0);
        }
        break;
      }
      case "rinse": {
        const secs = tea.rinse ? tea.rinse.secs : 5;
        c.label(0, "沿碗邊注水，浸過茶葉即可");
        let t = kettlePour(c, 0.1, { x: gaiwanTop().x - 30, y: gaiwanTop().y + 6 }, { r: 34, h: 26, dur: 1.2 });
        c.key("gLevel", 1.0, 0).key("gLevel", 2.1, 0.5).key("gTint", 1.0, 0).key("gTint", 3.4, 0.35);
        c.key("lid", 2.3, 0).key("lid", 2.9, 1);
        c.label(t - 0.6, `約 ${secs} 秒`).key("timer", t - 0.6, 0).key("timer", t + 0.9, 1).key("timerText", t - 0.6, `${secs}秒`).key("timer", t + 1.0, 0);
        c.label(t + 1.0, "倒出潤茶湯（可用來淋壺燙杯）");
        gaiwanPour(c, t + 1.0, { x: HOME.pitcher.x - 70, y: HOME.pitcher.y - 6 }, 0.9, 0.5);
        c.key("sGTarget", t + 1.0, "tray");
        break;
      }
      case "brew":
        if (glass) {
          c.label(0, `鳳凰三點頭・注至七分滿・${temp}`);
          kettlePour(c, 0.1, wTarget(0.5), { r: 36, h: 70, dur: 3.2, bob: true });
          c.key("wLevel", 1.0, 0.3).key("wLevel", 4.2, 0.72).key("wTint", 1.0, 0.25).key("wTint", 6.4, 1)
            .key("dance", 0.9, 0).key("dance", 2.4, 1);
          c.label(5.0, "茶葉上下翻動，靜待舒展");
        } else {
          c.label(0, `懸壺高沖・${temp}`);
          let t = kettlePour(c, 0.1, gTarget(0.5), { r: 40, h: 120, dur: 1.9 });
          c.key("gLevel", 1.0, 0).key("gLevel", 2.8, 1).key("gTint", 1.0, 0).key("gTint", 5.6, 1);
          c.label(t - 0.4, "用碗蓋輕刮浮沫").key("lid", t - 0.4, 0).key("lid", t + 0.2, 1)
            .key("lidX", t + 0.2, 0).key("lidR", t + 0.2, 0).key("lidX", t + 0.5, -12).key("lidR", t + 0.5, -10)
            .key("lidX", t + 1.1, 14).key("lidR", t + 1.1, -10).key("lidX", t + 1.5, 0).key("lidR", t + 1.5, 0);
          c.label(t + 1.6, `第一泡 約 ${tea.steeps.first} 秒`).key("timer", t + 1.6, 0).key("timer", t + 3.4, 1).key("timerText", t + 1.6, `${tea.steeps.first}秒`).key("timer", t + 3.5, 0);
        }
        break;
      case "pour":
        c.label(0, "三指法：拇指中指扣碗沿，食指按蓋鈕");
        gaiwanPour(c, 0.4, pitcherTop(), 1.8, 1);
        c.key("pTint", 0, 1).key("pLevel", 1.5, 0).key("pLevel", 3.3, 0.82);
        c.label(1.6, "留一道縫出湯，茶葉留在碗內").label(3.4, "最後幾滴也要瀝乾");
        c.key("drop", 3.4, 0).key("drop", 3.9, 0.999).key("dropTarget", 0, "pitcher");
        break;
      case "share": {
        c.label(0, "公道杯分茶・低斟");
        let t = pitcherPour(c, 0.1, 0, 0.8, 0.82, 0.55, 0, 0.7);
        t = pitcherPour(c, t - 0.3, 1, 0.8, 0.55, 0.3, 0, 0.7);
        c.label(t - 0.6, "每杯七分滿，濃淡一致");
        t = pitcherPour(c, t - 0.3, 2, 0.8, 0.3, 0.06, 0, 0.7);
        pitcherHome(c, t);
        break;
      }
      case "serve":
        if (glass) {
          c.label(0, "雙手奉茶：一手托底，一手輕扶");
          c.key("wx", 0.3, 0).key("wy", 0.3, 0).key("ws", 0.3, 1).key("wx", 1.8, -10).key("wy", 1.8, 52).key("ws", 1.8, 1.35);
          c.label(2.2, "請用茶").key("steamCup", 0, 0).key("steamCup", 2, 1);
        } else {
          c.label(0, "雙手托杯奉茶");
          c.key("c1x", 0.3, 0).key("c1y", 0.3, 0).key("c1s", 0.3, 1).key("c1y", 1.0, -30).key("c1x", 2.2, -298).key("c1y", 2.2, 62).key("c1s", 2.2, 1.9);
          c.label(2.4, "放在客人右手邊：「請用茶」").key("steamCup", 0, 0).key("steamCup", 2.2, 1);
          c.label(4.0, "客人以「叩指禮」回禮");
        }
        break;
      case "taste": {
        const lv = glass ? "wLevel" : "c1";
        const v0 = 0.72;
        c.key("steamCup", 0, 1).label(0, "一看湯色：清澈明亮");
        c.label(1.8, "二聞茶香：熱聞・冷聞・杯底香");
        c.label(3.8, "三口品茗：喝・飲・品");
        [0, 1, 2].forEach((i) => {
          const t = 4.0 + i * 1.1;
          c.key("sip", t, 0).key("sip", t + 0.35, 1).key("sip", t + 0.75, 0).key(lv, t + 0.2, v0 - i * (glass ? 0.12 : 0.22)).key(lv, t + 0.6, v0 - (i + 1) * (glass ? 0.12 : 0.22));
        });
        c.label(7.6, "回甘生津，細味餘香");
        break;
      }
      case "again":
        if (glass) {
          c.label(0, "杯中剩三分一時續水");
          kettlePour(c, 0.2, wTarget(0.5), { r: 36, h: 50, dur: 2.0 });
          c.key("wLevel", 1.1, 0.3).key("wLevel", 3.0, 0.72);
          c.label(4.2, `可續 ${tea.infusions}`);
        } else {
          c.label(0, `第二泡：${tea.steeps.unit.replace("之後", "")}`);
          let t = kettlePour(c, 0.1, gTarget(0.5), { r: 40, h: 90, dur: 1.6 });
          c.key("gLevel", 1.0, 0).key("gLevel", 2.5, 1).key("gTint", 1.0, 0).key("gTint", 4.4, 1).key("lid", t - 0.3, 0).key("lid", t + 0.2, 1);
          c.label(t + 0.3, `${tea.name}一般可泡 ${tea.infusions}`).key("timer", t + 0.3, 0).key("timer", t + 2.0, 1)
            .key("timerText", t + 0.3, `${tea.steeps.first + tea.steeps.add}秒`).key("timer", t + 2.1, 0);
        }
        break;
      case "phoenix":
        c.label(0, "手腕上下提拉三次").key("wLevel", 0, 0.3).key("wLeaves", 0, 1).key("wTint", 0, 0.3);
        kettlePour(c, 0.1, wTarget(0.5), { r: 36, h: 70, dur: 3.2, bob: true });
        c.key("wLevel", 1.0, 0.3).key("wLevel", 4.2, 0.72).key("wTint", 4.2, 0.9).key("dance", 0.9, 0).key("dance", 2.4, 1);
        c.label(4.6, "茶葉翻動，濃淡均勻");
        break;
      case "patrol": {
        c.label(0, "蓋甌低懸杯上，來回巡斟");
        Object.assign(b, { gLevel: 0.9, gTint: 1, gLeaves: 1, lid: 1, pLevel: 0, sGTarget: "cup" });
        let t = 0.1, lvl = 0.9;
        const order = [0, 1, 2, 2, 1, 0];
        order.forEach((i, k) => {
          const before = k < 3 ? 0 : 0.35;
          t = gaiwanCup(c, t, i, 0.45, lvl, lvl - 0.13, before, before + 0.31, 80);
          lvl -= 0.13;
        });
        c.label(t - 1.2, "每杯輪流斟，濃淡一致");
        gaiwanHome(c, t);
        break;
      }
      case "points": {
        c.label(0, "最後幾滴濃湯，逐杯點入");
        Object.assign(b, { gLevel: 0.05, gTint: 1, gLeaves: 1, lid: 1, pLevel: 0, c0: 0.66, c1: 0.66, c2: 0.66 });
        let t = 0.1;
        [0, 1, 2].forEach((i) => {
          const a = aimGaiwan(cupTop(i), 34);
          c.key("gx", t, c.lastGx || 0).key("gy", t, c.lastGy || 0).key("gr", t, c.lastGr || 0)
            .key("gx", t + 0.6, a.x).key("gy", t + 0.6, a.y).key("gr", t + 0.6, 92).key("pTarget", t, i)
            .key("drop", t + 0.7, 0).key("drop", t + 1.5, 0.999).key("drop", t + 1.51, 0).key("dropTarget", t, "gcup" + i)
            .key("c" + i, t + 0.9, 0.66).key("c" + i, t + 1.5, 0.72);
          c.lastGx = a.x; c.lastGy = a.y; c.lastGr = 92;
          t += 1.6;
        });
        gaiwanHome(c, t);
        break;
      }
    }
    return c.finish();
  }

  /* ---------- 單品圖版面 ---------- */
  const KIT = window.TEA_KIT;
  const IMG = "assets/img/kit/";
  const PARTS = ["bowl", "saucer", "lid", "cup", "caddy", "kettle", "stove", "chahe", "towel", "pitcher", "tumbler"];
  const WET = ["wet-00", "wet-01", "wet-02", "wet-03", "wet-04", "wet-05", "wet-06", "wet-07", "wet-08", "wet-09", "wet-10", "wet-11"];
  const TEA_IDS = ["green", "white", "yellow", "oolong", "black", "shengpu", "shoupu", "jasmine"];

  function imageList(style) {
    return [IMG + style + "/bg.webp"].concat(PARTS.map((n) => `${IMG}${style}/${n}.webp`), WET.map((n) => `${IMG}${style}/${n}.webp`), TEA_IDS.map((n) => `${IMG}${style}/dry-${n}.webp`));
  }
  const loaded = {};
  function preload(style) {
    if (loaded[style]) return loaded[style];
    loaded[style] = Promise.all(imageList(style).map((u) => new Promise((res) => {
      const i = new Image();
      i.onload = i.onerror = () => res();
      i.src = u;
    })));
    return loaded[style];
  }

  /* 按單品圖尺寸與錨點，算出各器具圖片位置及動畫用的相對座標 */
  function geometry(style) {
    const A = KIT.A[style], S = KIT.sizes[style], W = KIT.W;
    const g = {};
    PARTS.forEach((n) => {
      const [w, h] = S[n], s = W[n] / w, b = A[n].base || [0.5, 1];
      g[n] = { s, w: w * s, h: h * s, x: -b[0] * w * s, y: -b[1] * h * s, a: A[n] };
    });
    const pt = (n, fx, fy, o = { x: 0, y: 0 }) => ({ x: g[n].x + fx * g[n].w + o.x, y: g[n].y + fy * g[n].h + o.y });
    const q = { g, pt };
    // 爐與煮水壺
    const seat = pt("stove", ...A.stove.seat);
    q.seat = seat;
    q.stoveFrontY = g.stove.y + A.stove.front * g.stove.h;
    q.kettleOff = { x: seat.x, y: seat.y };
    q.kettleTip = pt("kettle", ...A.kettle.tip, seat);
    q.kettlePivot = pt("kettle", ...A.kettle.pivot, seat);
    // 蓋碗：碗坐在碟心
    const well = pt("saucer", ...A.saucer.well);
    q.bowlOff = { x: well.x, y: well.y + 2 };
    const rim = A.bowl.rim, bw = g.bowl;
    q.bowlRim = { cx: bw.x + rim[0] * bw.w + q.bowlOff.x, cy: bw.y + rim[1] * bw.h + q.bowlOff.y, rx: rim[2] * bw.w, ry: rim[3] * bw.h };
    q.bowlLip = pt("bowl", ...A.bowl.lip, q.bowlOff);
    q.lidOff = { x: -A.lid.seat[0] * g.lid.w, y: -A.lid.seat[1] * g.lid.h };
    // 公道杯
    const pr = A.pitcher.rim;
    q.pRim = { cx: g.pitcher.x + pr[0] * g.pitcher.w, cy: g.pitcher.y + pr[1] * g.pitcher.h };
    q.pTip = pt("pitcher", ...A.pitcher.tip);
    q.pPoly = A.pitcher.poly.map(([fx, fy]) => pt("pitcher", fx, fy));
    q.pTop = g.pitcher.y + A.pitcher.top * g.pitcher.h;
    q.pFloor = g.pitcher.y + A.pitcher.floor * g.pitcher.h;
    // 玻璃杯
    const tr = A.tumbler.rim;
    q.tRim = { cx: g.tumbler.x + tr[0] * g.tumbler.w, cy: g.tumbler.y + tr[1] * g.tumbler.h, rx: tr[2] * g.tumbler.w, ry: tr[3] * g.tumbler.h };
    q.tPoly = A.tumbler.poly.map(([fx, fy]) => pt("tumbler", fx, fy));
    q.tTop = g.tumbler.y + A.tumbler.top * g.tumbler.h;
    q.tFloor = g.tumbler.y + A.tumbler.floor * g.tumbler.h;
    // 品茗杯
    const cr = A.cup.rim;
    q.cRim = { cx: g.cup.x + cr[0] * g.cup.w, cy: g.cup.y + cr[1] * g.cup.h, rx: cr[2] * g.cup.w, ry: cr[3] * g.cup.h };
    // 茶荷
    q.chTip = pt("chahe", ...A.chahe.tip);
    q.chPile = { x: g.chahe.x + A.chahe.pile[0] * g.chahe.w, y: g.chahe.y + A.chahe.pile[1] * g.chahe.h, w: A.chahe.pile[2] * g.chahe.w };
    return q;
  }

  function applyKit(q, style) {
    const o = KIT.home && KIT.home[style];
    if (o) for (const k in o) { if (k === "cups") o.cups.forEach((c, i) => Object.assign(HOME.cups[i], c)); else Object.assign(HOME[k], o[k]); }
    L.kettleTip = q.kettleTip; L.kettlePivot = q.kettlePivot;
    L.gaiwanLip = q.bowlLip; L.gaiwanRim = q.bowlRim.cy; L.gaiwanRimX = q.bowlRim.cx;
    L.pitcherTip = q.pTip; L.pitcherTop = q.pRim.cy; L.pitcherRimX = q.pRim.cx;
    L.pFloor = q.pFloor; L.pH = q.pFloor - q.pTop;
    L.cupRim = q.cRim.cy;
    L.glassTop = q.tRim.cy; L.glassFloor = q.tFloor; L.glassH = q.tFloor - q.tTop; L.glassRimX = q.tRim.cx;
    L.chaheTip = q.chTip;
  }

  /* ---------- 繪畫 ---------- */
  const SVG_DEFS = `
  <defs>
    <radialGradient id="tb-sh"><stop offset="0" stop-color="#0e0603" stop-opacity=".55"/><stop offset=".55" stop-color="#0e0603" stop-opacity=".26"/><stop offset="1" stop-color="#0e0603" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-steam"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#140a05" stop-opacity="0"/><stop offset="1" stop-color="#140a05" stop-opacity=".5"/></radialGradient>
    <linearGradient id="tb-sun" x1="1" y1="0" x2="0" y2=".7"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".22"/><stop offset=".6" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
    <linearGradient id="tb-lqdepth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#220d00" stop-opacity=".3"/></linearGradient>
    <radialGradient id="tb-lqhi" cx=".7" cy=".3" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-ember" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#ffb347" stop-opacity=".85"/><stop offset=".5" stop-color="#ff6a1f" stop-opacity=".35"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient>
  </defs>`;

  function shadow(parent, rx, ry) { return el("ellipse", { cx: -rx * 0.1, cy: 1, rx: rx * 1.1, ry: ry || rx * 0.2, fill: "url(#tb-sh)" }, parent); }

  let clipSeq = 0;
  function clipPoly(defs, pts) {
    const id = "tbc" + (++clipSeq);
    const cp = el("clipPath", { id }, defs);
    el("path", { d: "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("L") + "Z" }, cp);
    return id;
  }
  function clipEllipse(defs, e) {
    const id = "tbc" + (++clipSeq);
    el("ellipse", { cx: e.cx, cy: e.cy, rx: e.rx, ry: e.ry }, el("clipPath", { id }, defs));
    return id;
  }

  function buildScene(svg, style) {
    svg.innerHTML = SVG_DEFS;
    const q = geometry(style);
    applyKit(q, style);
    const g = q.g;
    const defs = svg.querySelector("defs");
    const R = { q, style, tick: 0 };
    const href = (n) => `${IMG}${style}/${n}.webp`;
    const img = (parent, n, dx = 0, dy = 0) => el("image", { href: href(n), x: g[n].x + dx, y: g[n].y + dy, width: g[n].w, height: g[n].h }, parent);
    R.cam = el("g", {}, svg);
    el("image", { href: href("bg"), x: 0, y: KIT.bg[style].y, width: 800, height: 533, preserveAspectRatio: "none" }, R.cam);
    R.layer = el("g", {}, R.cam);

    // 爐＋煮水壺
    R.stoveBack = el("g", { transform: `translate(${HOME.kettle.x},${HOME.kettle.y})` }, R.layer);
    shadow(R.stoveBack, 58, 11);
    img(R.stoveBack, "stove");
    const st = g.stove;
    R.ember = el("ellipse", { cx: 0, cy: st.y + st.h * 0.69, rx: st.w * 0.26, ry: st.h * 0.13, fill: "url(#tb-ember)", style: "mix-blend-mode:screen" }, R.stoveBack);
    R.kettle = el("g", {}, R.layer);
    const kt = el("g", {}, R.kettle);
    img(kt, "kettle", q.kettleOff.x, q.kettleOff.y);
    R.stoveFront = el("g", { transform: `translate(${HOME.kettle.x},${HOME.kettle.y})` }, R.layer);
    const frontClip = el("clipPath", { id: "tb-stf" }, defs);
    el("rect", { x: st.x - 4, y: q.stoveFrontY, width: st.w + 8, height: st.h }, frontClip);
    img(R.stoveFront, "stove").setAttribute("clip-path", "url(#tb-stf)");

    // 茶巾、茶罐
    R.towel = el("g", { transform: `translate(${HOME.towel.x},${HOME.towel.y})` }, R.layer);
    shadow(R.towel, 46, 9); img(R.towel, "towel");
    R.caddy = el("g", { transform: `translate(${HOME.caddy.x},${HOME.caddy.y})` }, R.layer);
    shadow(R.caddy, 30, 6); img(R.caddy, "caddy");

    // 蓋碗
    R.saucer = el("g", {}, R.layer);
    shadow(R.saucer, 56, 11); img(R.saucer, "saucer");
    R.gaiwan = el("g", {}, R.layer);
    R.gShadow = el("g", {}, R.gaiwan);
    R.gBowl = el("g", {}, R.gaiwan);
    img(R.gBowl, "bowl", q.bowlOff.x, q.bowlOff.y);
    const br = q.bowlRim;
    const gClip = clipEllipse(defs, { cx: br.cx, cy: br.cy + 1, rx: br.rx * 0.97, ry: br.ry * 0.9 });
    R.gIn = el("g", { "clip-path": `url(#${gClip})` }, R.gBowl);
    R.gDry = el("image", { preserveAspectRatio: "xMidYMax meet", href: href("dry-green"), x: br.cx - br.rx * 0.62, y: br.cy + br.ry * 0.05, width: br.rx * 1.24, height: br.rx * 1.24 * 0.6 }, R.gIn);
    R.gWet = el("g", {}, R.gIn);
    R.gWetList = [[-0.42, 0.45, 20, 0.5], [-0.14, 0.62, -25, 0.55], [0.2, 0.5, 40, 0.5], [0.4, 0.62, -50, 0.5], [0.02, 0.4, 70, 0.55], [-0.3, 0.7, 100, 0.45], [0.28, 0.72, -10, 0.45]].map(([fx, fy, r, sc], i) => {
      const n = WET[[4, 5, 6, 7, 0, 1, 8][i % 7]];
      const w = KIT.sizes[style][n][0], h = KIT.sizes[style][n][1], k = (br.rx * 0.78 * sc) / Math.max(w, h) * 2;
      const e = el("image", { href: href(n), width: w * k, height: h * k, x: -w * k / 2, y: -h * k / 2 }, R.gWet);
      e.setAttribute("data-t", `${(br.cx + fx * br.rx).toFixed(1)},${(br.cy + fy * br.ry).toFixed(1)},${r}`);
      return e;
    });
    R.gLiquid = el("ellipse", { cx: br.cx, cy: br.cy, rx: br.rx * 0.93, ry: br.ry * 0.82 }, R.gIn);
    R.gLiquidDepth = el("ellipse", { cx: br.cx, cy: br.cy, rx: br.rx * 0.93, ry: br.ry * 0.82, fill: "url(#tb-lqdepth)" }, R.gIn);
    R.gLiquidHi = el("ellipse", { cx: br.cx, cy: br.cy, rx: br.rx * 0.93, ry: br.ry * 0.82, fill: "url(#tb-lqhi)" }, R.gIn);
    R.lid = el("g", {}, R.gBowl);
    el("image", { href: href("lid"), x: q.lidOff.x, y: q.lidOff.y, width: g.lid.w, height: g.lid.h }, R.lid);

    // 玻璃杯（茶湯在玻璃後面，玻璃高光疊在上面）
    R.glass = el("g", {}, R.layer);
    shadow(R.glass, 34, 7);
    R.gBody = el("g", {}, R.glass);
    const tClip = clipPoly(defs, q.tPoly);
    R.wIn = el("g", { "clip-path": `url(#${tClip})` }, R.gBody);
    const tb = { x0: Math.min(...q.tPoly.map((p) => p.x)), x1: Math.max(...q.tPoly.map((p) => p.x)) };
    R.tb = tb;
    R.wLiquid = el("rect", { x: tb.x0 - 2, y: 0, width: tb.x1 - tb.x0 + 4, height: 0 }, R.wIn);
    R.wLiquidDepth = el("rect", { x: tb.x0 - 2, y: 0, width: tb.x1 - tb.x0 + 4, height: 0, fill: "url(#tb-lqdepth)" }, R.wIn);
    R.wSurface = el("ellipse", { cx: 0, cy: 0, rx: (tb.x1 - tb.x0) / 2 * 0.96, ry: (tb.x1 - tb.x0) / 2 * 0.2, fill: "#fff", "fill-opacity": 0.16, stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 0.9 }, R.wIn);
    R.wLeaves = el("g", {}, R.wIn);
    R.wLeafList = [];
    for (let i = 0; i < 11; i++) {
      const n = WET[[0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 6][i]], w = KIT.sizes[style][n][0], h = KIT.sizes[style][n][1];
      const k = (n === "wet-04" || n === "wet-05" || n === "wet-06" || n === "wet-07" ? 17 : n.startsWith("wet-0") && +n.slice(4) < 4 ? 20 : 15) / Math.max(w, h);
      R.wLeafList.push(el("image", { href: href(n), width: w * k, height: h * k, x: -w * k / 2, y: -h * k / 2 }, R.wLeaves));
    }
    img(R.gBody, "tumbler");

    // 公道杯
    R.pitcher = el("g", {}, R.layer);
    R.pitcherShadow = shadow(R.pitcher, 54, 10);
    R.pBody = el("g", {}, R.pitcher);
    const pClip = clipPoly(defs, q.pPoly);
    const pIn = el("g", { "clip-path": `url(#${pClip})` }, R.pBody);
    const px0 = Math.min(...q.pPoly.map((p) => p.x)), px1 = Math.max(...q.pPoly.map((p) => p.x));
    R.pb = { x0: px0, x1: px1 };
    R.pLiquid = el("rect", { x: px0 - 4, y: 0, width: px1 - px0 + 8, height: 200 }, pIn);
    R.pLiquidDepth = el("rect", { x: px0 - 4, y: 0, width: px1 - px0 + 8, height: 200, fill: "url(#tb-lqdepth)" }, pIn);
    R.pSurface = el("ellipse", { cx: (px0 + px1) / 2, cy: 0, rx: (px1 - px0) / 2 * 0.97, ry: (px1 - px0) / 2 * 0.17, fill: "#fff", "fill-opacity": 0.16, stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 0.9 }, pIn);
    img(R.pBody, "pitcher");

    // 品茗杯
    const cr = q.cRim;
    R.cups = HOME.cups.map(() => {
      const gr = el("g", {}, R.layer);
      shadow(gr, 30, 6);
      img(gr, "cup");
      const cid = clipEllipse(defs, { cx: cr.cx, cy: cr.cy + 0.5, rx: cr.rx * 0.97, ry: cr.ry * 0.9 });
      const ci = el("g", { "clip-path": `url(#${cid})` }, gr);
      const liq = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82 }, ci);
      const depth = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82, fill: "url(#tb-lqdepth)" }, ci);
      const hi = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82, fill: "url(#tb-lqhi)" }, ci);
      return { g: gr, liq, depth, hi };
    });

    // 茶荷
    R.chahe = el("g", {}, R.layer);
    R.chaheShadow = shadow(R.chahe, 44, 9);
    R.chaheBody = el("g", {}, R.chahe);
    img(R.chaheBody, "chahe");
    const pw = q.chPile.w;
    R.hPile = el("image", { preserveAspectRatio: "xMidYMax meet", href: href("dry-green"), x: q.chPile.x - pw / 2, y: q.chPile.y - pw * 0.30, width: pw, height: pw * 0.66 }, R.chaheBody);

    // 水流、落葉、水滴、水氣
    R.streams = el("g", {}, R.cam);
    const mk = () => ({ body: el("path", {}, R.streams), hi: el("path", { fill: "none", stroke: "#fff", "stroke-linecap": "round" }, R.streams) });
    R.sK = mk(); R.sG = mk(); R.sP = mk();
    R.fall = el("g", {}, R.cam);
    R.fallLeaves = [];
    for (let i = 0; i < 6; i++) R.fallLeaves.push(el("image", { preserveAspectRatio: "xMidYMid meet", href: href("dry-green"), width: 16, height: 11 }, R.fall));
    R.drop = el("ellipse", { rx: 2.3, ry: 3.2 }, R.cam);
    R.fx = { ripples: [], splash: [], steam: [], last: 0, acc: {} };
    R.fxLayer = el("g", { "pointer-events": "none" }, R.cam);
    for (let i = 0; i < 6; i++) R.fx.ripples.push({ n: el("ellipse", { fill: "none", stroke: "#fff", "stroke-width": 1, opacity: 0 }, R.fxLayer), life: 0 });
    for (let i = 0; i < 28; i++) R.fx.splash.push({ n: el("circle", { r: 1.3, fill: "#fff", opacity: 0 }, R.fxLayer), life: 0 });
    for (let i = 0; i < 24; i++) R.fx.steam.push({ n: el("circle", { r: 8, fill: "url(#tb-steam)", opacity: 0 }, R.fxLayer), life: 0 });

    // 光影與標籤（畫面固定，不隨鏡頭）
    el("rect", { x: 0, y: 0, width: 800, height: 500, fill: "url(#tb-sun)", "pointer-events": "none" }, svg);
    el("rect", { x: 0, y: 0, width: 800, height: 500, fill: "url(#tb-vig)", "pointer-events": "none" }, svg);
    R.label = el("g", { transform: "translate(400,52)" }, svg);
    R.labelBg = el("rect", { x: -150, y: -26, width: 300, height: 52, rx: 26, fill: "#241912", opacity: 0.84 }, R.label);
    R.labelText = el("text", { x: 0, y: 9, "text-anchor": "middle", "font-size": 25, fill: "#fbf1dc", class: "tb-svgtext" }, R.label);
    R.cam0 = { x: 400, y: 250, z: 1 };
    R.camSet = false;
    return R;
  }

  /* 水流：兩端略收窄的帶狀多邊形＋高光線 */
  function ribbon(S, on, a, b, dir, w0, col, now, hiOp) {
    const vis = on > 0.02;
    S.body.style.opacity = S.hi.style.opacity = vis ? Math.min(1, on) : 0;
    if (!vis) return;
    const c = { x: a.x + (b.x - a.x) * 0.62, y: a.y - 3 };
    const N = 14, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x, y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      const tx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x), ty = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
      const m = Math.hypot(tx, ty) || 1, nx = -ty / m, ny = tx / m;
      const w = w0 * (1 - 0.35 * t) * (1 + 0.1 * Math.sin(now / 70 + t * 11)) * Math.min(1, on * 1.4);
      left.push([x + nx * w / 2, y + ny * w / 2]); right.push([x - nx * w / 2, y - ny * w / 2]); mid.push([x + nx * w * 0.14, y + ny * w * 0.14]);
    }
    const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
    S.body.setAttribute("d", "M" + left.map(f).join("L") + "L" + right.reverse().map(f).join("L") + "Z");
    S.body.setAttribute("fill", col); S.body.style.fillOpacity = 0.6; S.body.setAttribute("stroke", "#fff"); S.body.setAttribute("stroke-opacity", 0.35); S.body.setAttribute("stroke-width", 0.5);
    S.hi.setAttribute("d", "M" + mid.map(f).join("L"));
    S.hi.setAttribute("stroke-width", Math.max(0.8, w0 * 0.22)); S.hi.style.strokeOpacity = hiOp || 0.7;
  }

  /* ---------- 特效：水花、漣漪、水氣 ---------- */
  function fxUpdate(R, now, dt, emit) {
    const F = R.fx;
    const spawn = (arr, init) => { const p = arr.find((x) => x.life <= 0); if (p) { p.life = 1; init(p); } };
    emit.forEach((e) => {
      F.acc[e.k] = (F.acc[e.k] || 0) + dt * e.rate;
      while (F.acc[e.k] >= 1) {
        F.acc[e.k] -= 1;
        if (e.type === "steam") spawn(F.steam, (p) => { p.x = e.x + (Math.random() - 0.5) * e.spread; p.y = e.y; p.vx = (Math.random() - 0.5) * 6; p.vy = -(10 + Math.random() * 8) * e.lift; p.r0 = 4 + Math.random() * 3; p.a = e.alpha; p.dur = 2.2 + Math.random() * 1.2; p.t = 0; });
        else if (e.type === "splash") spawn(F.splash, (p) => { p.x = e.x + (Math.random() - 0.5) * 5; p.y = e.y; p.vx = (Math.random() - 0.5) * 44; p.vy = -(26 + Math.random() * 46); p.dur = 0.55; p.t = 0; });
        else if (e.type === "ripple") spawn(F.ripples, (p) => { p.x = e.x; p.y = e.y; p.w = e.w; p.dur = 1.0; p.t = 0; });
      }
    });
    F.steam.forEach((p) => {
      if (p.life <= 0) { p.n.style.opacity = 0; return; }
      p.t += dt; const k = p.t / p.dur; if (k >= 1) { p.life = 0; p.n.style.opacity = 0; return; }
      p.x += (p.vx + Math.sin(now / 520 + p.r0 * 3) * 5) * dt; p.y += p.vy * dt;
      p.n.setAttribute("cx", p.x.toFixed(1)); p.n.setAttribute("cy", p.y.toFixed(1)); p.n.setAttribute("r", (p.r0 + k * 15).toFixed(1));
      p.n.style.opacity = (Math.sin(Math.PI * Math.min(1, k * 1.25)) * p.a).toFixed(3);
    });
    F.splash.forEach((p) => {
      if (p.life <= 0) { p.n.style.opacity = 0; return; }
      p.t += dt; if (p.t >= p.dur) { p.life = 0; p.n.style.opacity = 0; return; }
      p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.n.setAttribute("cx", p.x.toFixed(1)); p.n.setAttribute("cy", p.y.toFixed(1)); p.n.style.opacity = (0.85 * (1 - p.t / p.dur)).toFixed(2);
    });
    F.ripples.forEach((p) => {
      if (p.life <= 0) { p.n.style.opacity = 0; return; }
      p.t += dt; const k = p.t / p.dur; if (k >= 1) { p.life = 0; p.n.style.opacity = 0; return; }
      const rx = 2 + p.w * k;
      p.n.setAttribute("cx", p.x.toFixed(1)); p.n.setAttribute("cy", p.y.toFixed(1)); p.n.setAttribute("rx", rx.toFixed(1)); p.n.setAttribute("ry", (rx * 0.27).toFixed(1));
      p.n.style.opacity = (0.7 * (1 - k)).toFixed(2);
    });
  }

  function render(R, s, tea, now, dt, quiet) {
    const q = R.q, g = q.g;
    const glass = s.mode === "glass";
    const teaCol = tea.liquor, deep = tea.liquorDeep;
    const tint = (k) => mixColor(WATER, teaCol, Math.max(0, Math.min(1, k)));
    const show = s.show;
    const appear = (node, i) => {
      const k = Math.max(0, Math.min(1, show * 6 - i));
      node.style.opacity = k;
      return (1 - k) * 18;
    };
    const emit = [];
    if (R.teaId !== tea.id) {
      R.teaId = tea.id;
      const u = `${IMG}${R.style}/dry-${tea.id}.webp`;
      [R.gDry, R.hPile].concat(R.fallLeaves).forEach((e) => e.setAttribute("href", u));
    }

    // 煮水壺與爐
    const kOff = appear(R.kettle, 0);
    R.stoveBack.style.opacity = R.stoveFront.style.opacity = R.kettle.style.opacity;
    const kp = { x: HOME.kettle.x + s.kx, y: HOME.kettle.y + s.ky + kOff };
    R.kettle.setAttribute("transform", `translate(${kp.x},${kp.y}) rotate(${s.kr} ${L.kettlePivot.x} ${L.kettlePivot.y})`);
    const tipL = rot(L.kettleTip, L.kettlePivot, s.kr);
    const tip = { x: kp.x + tipL.x, y: kp.y + tipL.y };
    const flick = 0.55 + 0.45 * Math.sin(now / 130) * Math.sin(now / 71 + 1.7);
    R.ember.style.opacity = (0.65 + 0.35 * flick) * Math.min(1, show * 3);
    const kFront = s.kr > 1 || Math.abs(s.kx) > 4;
    if (R.kFront !== kFront) {
      R.kFront = kFront;
      if (kFront) R.layer.appendChild(R.kettle); else R.layer.insertBefore(R.kettle, R.stoveFront);
    }
    if (s.kr < 5 && show > 0.5) emit.push({ k: "kst", type: "steam", x: tip.x - 2, y: tip.y - 2, rate: 5, spread: 2, lift: 1.3, alpha: 0.5 });
    const hudTemp = s.sK > 0.05 || s.kr > 8 || (s.temp && Math.abs(s.kx) < 4) ? (tea.temp[0] === tea.temp[1] ? `水溫 ${tea.temp[0]}°C` : `水溫 ${tea.temp[0]}–${tea.temp[1]}°C`) : "";

    // 蓋碗
    R.gaiwan.style.display = glass ? "none" : "";
    R.pitcher.style.display = glass ? "none" : "";
    R.cups.forEach((c) => (c.g.style.display = glass ? "none" : ""));
    R.glass.style.display = glass ? "" : "none";
    R.towel.style.display = glass ? "" : "none";
    appear(R.towel, 4);
    appear(R.caddy, 1);
    const gOff = appear(R.gaiwan, 2);
    const lip = L.gaiwanLip, br = q.bowlRim;
    R.gaiwan.setAttribute("transform", `translate(${HOME.gaiwan.x + s.gx},${HOME.gaiwan.y + s.gy + gOff})`);
    R.saucer.setAttribute("transform", `translate(${HOME.gaiwan.x},${HOME.gaiwan.y + gOff})`);
    R.saucer.style.opacity = R.gaiwan.style.opacity;
    R.saucer.style.display = glass ? "none" : "";
    R.gBowl.setAttribute("transform", `rotate(${s.gr} ${lip.x} ${lip.y})`);
    // 蓋碗內：乾茶→濕葉→茶湯
    const wetK = Math.max(0, Math.min(1, s.gLevel * 3 + s.gTint * 2));
    R.gDry.style.opacity = s.gLeaves * (1 - wetK);
    R.gWet.style.opacity = s.gLeaves * wetK;
    R.gWet.style.filter = KIT.wetTint[tea.id];
    R.gWetList.forEach((e, i) => {
      const [x, y, r] = e.getAttribute("data-t").split(",").map(Number);
      e.setAttribute("transform", `translate(${x},${y}) rotate(${r + Math.sin(now / 1400 + i) * 3 * wetK})`);
    });
    const lv = s.gLevel;
    const gl = { cx: br.cx, cy: br.cy + (1 - lv) * br.ry * 0.9, rx: br.rx * 0.93 * (0.7 + 0.3 * lv), ry: br.ry * 0.82 * (0.7 + 0.3 * lv) };
    [R.gLiquid, R.gLiquidDepth, R.gLiquidHi].forEach((e) => { e.setAttribute("cy", gl.cy); e.setAttribute("rx", gl.rx); e.setAttribute("ry", gl.ry); e.style.opacity = lv > 0.02 ? 1 : 0; });
    R.gLiquid.style.opacity = lv > 0.02 ? 0.88 : 0;
    R.gLiquid.setAttribute("fill", tint(s.gTint));
    const lk = s.lid;
    const lidOn = { x: br.cx + s.lidX, y: br.cy - 1, r: s.lidR }, lidOff = { x: br.cx + br.rx + 20, y: -12, r: -58 };
    R.lid.setAttribute("transform", `translate(${lerp(lidOff.x, lidOn.x, lk)},${lerp(lidOff.y, lidOn.y, lk)}) rotate(${lerp(lidOff.r, lidOn.r, lk)})`);
    if (!glass && lk < 0.5 && lv > 0.15) emit.push({ k: "gst", type: "steam", x: HOME.gaiwan.x + s.gx + br.cx, y: HOME.gaiwan.y + s.gy + br.cy - 4, rate: 3.2, spread: br.rx, lift: 0.8, alpha: 0.35 });

    // 公道杯
    const pOff = appear(R.pitcher, 3);
    const pt = L.pitcherTip;
    R.pitcher.setAttribute("transform", `translate(${HOME.pitcher.x + s.px},${HOME.pitcher.y + s.py + pOff})`);
    R.pBody.setAttribute("transform", `rotate(${s.pr} ${pt.x} ${pt.y})`);
    R.pitcherShadow.style.opacity = Math.max(0, 1 - Math.abs(s.py) / 40);
    const pTop = L.pFloor - s.pLevel * L.pH;
    [R.pLiquid, R.pLiquidDepth].forEach((e) => { e.setAttribute("y", pTop); e.setAttribute("transform", `rotate(${-s.pr} 0 ${pTop})`); });
    R.pSurface.setAttribute("cy", pTop); R.pSurface.setAttribute("transform", `rotate(${-s.pr} 0 ${pTop})`);
    R.pLiquid.setAttribute("fill", mixColor(WATER, teaCol, s.pTint));
    const pOn = s.pLevel > 0.01;
    R.pLiquid.style.opacity = pOn ? 0.9 : 0; R.pLiquidDepth.style.opacity = pOn ? 1 : 0; R.pSurface.style.opacity = pOn ? 1 : 0;
    if (!glass && pOn && s.pLevel > 0.12 && s.pr < 12) emit.push({ k: "pst", type: "steam", x: HOME.pitcher.x + s.px + q.pRim.cx, y: HOME.pitcher.y + s.py + q.pRim.cy - 2, rate: 2.2, spread: 36, lift: 0.8, alpha: 0.3 });

    // 品茗杯
    const cr = q.cRim;
    R.cups.forEach((c, i) => {
      const off = appear(c.g, 4 + i * 0.4);
      const l = s["c" + i];
      let x = HOME.cups[i].x, y = HOME.cups[i].y + off, sc = 1;
      if (i === 1) { x += s.c1x; y += s.c1y; sc = s.c1s; }
      c.g.setAttribute("transform", `translate(${x},${y}) scale(${sc})`);
      const on = l > 0.02;
      const cy = cr.cy + (1 - l) * cr.ry * 1.05, rx = cr.rx * 0.9 * (0.7 + 0.3 * l), ry = cr.ry * 0.82 * (0.7 + 0.3 * l);
      [c.liq, c.depth, c.hi].forEach((e) => { e.setAttribute("cy", cy); e.setAttribute("rx", rx); e.setAttribute("ry", ry); e.style.opacity = on ? 1 : 0; });
      c.liq.style.opacity = on ? 0.95 : 0;
      c.liq.setAttribute("fill", mixColor(WATER, deep, s.cTint));
      if (!glass && l > 0.15) {
        const sy = s.sip > 0 && i === 1 ? -s.sip * 10 : 0;
        emit.push({ k: "cst" + i, type: "steam", x: x + cr.cx * sc, y: y + (cr.cy - 2) * sc + sy, rate: i === 1 ? 3 + s.steamCup * 3 : 1.4, spread: 14 * sc, lift: 0.9 * sc, alpha: 0.28 + (i === 1 ? 0.2 * s.steamCup : 0) });
      }
    });
    const c1 = R.cups[1].g;
    if (s.c1s > 1.05 && c1.nextSibling !== null && R.layer.lastChild !== c1) R.layer.appendChild(c1);
    else if (s.c1s <= 1.05 && R.layer.lastChild === c1) R.layer.insertBefore(c1, R.cups[2].g);

    // 玻璃杯
    if (glass) {
      const wOff = appear(R.glass, 2);
      const wr = s.wr, tb = R.tb;
      R.glass.setAttribute("transform", `translate(${HOME.glass.x + s.wx},${HOME.glass.y + s.wy + wOff}) scale(${s.ws})`);
      R.gBody.setAttribute("transform", `rotate(${wr} ${tb.x1 * 0.9} -2)`);
      const top = L.glassFloor - s.wLevel * L.glassH;
      const hgt = Math.max(0, L.glassFloor - top + 12);
      [R.wLiquid, R.wLiquidDepth].forEach((e) => { e.setAttribute("y", top); e.setAttribute("height", hgt); e.setAttribute("transform", `rotate(${-wr} 0 ${top})`); });
      R.wSurface.setAttribute("cy", top); R.wSurface.setAttribute("transform", `rotate(${-wr} 0 ${top})`);
      const col = tint(s.wTint);
      R.wLiquid.setAttribute("fill", col);
      const on = s.wLevel > 0.01;
      R.wLiquid.style.opacity = on ? 0.72 : 0; R.wLiquidDepth.style.opacity = on ? 1 : 0; R.wSurface.style.opacity = on ? 1 : 0;
      R.wLeaves.style.opacity = s.wLeaves;
      R.wLeaves.style.filter = KIT.wetTint[tea.id];
      R.wLeafList.forEach((lf, i) => {
        const seed = i * 1.7;
        const span = (L.glassH * 0.56) * (s.wLevel / 0.72);
        const floatY = s.wLevel > 0.05 ? top + 10 + ((i * 23) % 70) / 70 * span : L.glassFloor - 6 - (i % 3) * 4;
        const y = lerp(L.glassFloor - 6 - (i % 3) * 4, floatY, Math.min(1, s.wLevel * 3)) + Math.sin(now / 900 + seed) * 6 * s.dance;
        const w2 = (R.tb.x1 - R.tb.x0) * 0.34;
        const x = (R.tb.x0 + R.tb.x1) / 2 - w2 + ((i * 37) % 100) / 100 * w2 * 2 + Math.cos(now / 1100 + seed) * 4 * s.dance;
        const r = (i * 47) % 180 + Math.sin(now / 1300 + seed) * 25 * s.dance + (s.dance > 0.5 ? 0 : 70);
        lf.setAttribute("transform", `translate(${x},${y}) rotate(${r})`);
      });
      if (on && s.wr < 12) emit.push({ k: "wst", type: "steam", x: HOME.glass.x + s.wx + q.tRim.cx * s.ws, y: HOME.glass.y + s.wy + (q.tRim.cy - 2) * s.ws, rate: 2.4 + s.sip * 0, spread: 20, lift: 0.9, alpha: 0.3 });
    }

    // 茶荷
    const hOff = appear(R.chahe, 1);
    R.chahe.setAttribute("transform", `translate(${HOME.chahe.x + s.hx},${HOME.chahe.y + s.hy + hOff}) scale(${s.hs})`);
    R.chaheBody.setAttribute("transform", `rotate(${s.hr} ${L.chaheTip.x} ${L.chaheTip.y})`);
    R.chaheShadow.style.opacity = Math.max(0, 1 - Math.abs(s.hy) / 30);
    R.hPile.style.opacity = s.hLeaves;

    // 落葉（成撮乾茶跌入碗中）
    const hTip = rot(L.chaheTip, L.chaheTip, s.hr);
    const from = { x: HOME.chahe.x + s.hx + hTip.x * s.hs, y: HOME.chahe.y + s.hy + hTip.y * s.hs };
    const to = glass ? { x: HOME.glass.x + q.tRim.cx, y: HOME.glass.y + q.tRim.cy } : { x: HOME.gaiwan.x + br.cx, y: HOME.gaiwan.y + br.cy };
    R.fallLeaves.forEach((lf, i) => {
      const k = Math.max(0, Math.min(1, s.fall * 1.6 - i * 0.09));
      const vis = s.fall > 0 && s.fall < 1 && k > 0 && k < 1;
      lf.style.opacity = vis ? 1 : 0;
      if (vis) {
        const x = lerp(from.x, to.x + (i - 3) * 5, k), y = from.y + (to.y - from.y) * k * k;
        lf.setAttribute("transform", `translate(${x},${y}) rotate(${i * 50 + k * 220}) translate(-8,-5)`);
      }
    });

    // 水流
    const kDir = { x: Math.cos(rad(s.kr - 60)), y: Math.sin(rad(s.kr - 60)) };
    const kTarget = glass
      ? { x: tip.x + 4, y: HOME.glass.y + s.wy + L.glassFloor - s.wLevel * L.glassH }
      : { x: tip.x + 4, y: HOME.gaiwan.y + s.gy + gl.cy };
    const waterCol = "#e9f6fb";
    ribbon(R.sK, s.sK, tip, kTarget, kDir, 4.4, waterCol, now, 0.8);
    const lipW = { x: HOME.gaiwan.x + s.gx + lip.x, y: HOME.gaiwan.y + s.gy + lip.y };
    const ci = Math.round(s.pTarget || 0);
    const cupSurf = HOME.cups[ci].y + cr.cy + (1 - s["c" + ci]) * cr.ry * 1.05;
    const gTo = s.sGTarget === "tray" ? { x: lipW.x + 6, y: HOME.pitcher.y - 2 }
      : s.sGTarget === "cup" ? { x: lipW.x + 4, y: cupSurf }
      : { x: lipW.x + 6, y: HOME.pitcher.y + L.pFloor - s.pLevel * L.pH };
    ribbon(R.sG, s.sG, lipW, gTo, { x: 0.5, y: 0.6 }, 5, tint(s.gTint), now, 0.55);
    const pTipW = { x: HOME.pitcher.x + s.px + pt.x, y: HOME.pitcher.y + s.py + pt.y };
    const cupTo = { x: pTipW.x + 4, y: cupSurf };
    ribbon(R.sP, s.sP, pTipW, cupTo, { x: 0.5, y: 0.6 }, 3.8, mixColor(WATER, deep, s.pTint), now, 0.55);
    const lands = [[s.sK, kTarget, 22], [s.sG, gTo, 20], [s.sP, cupTo, 12]];
    lands.forEach(([on, p, w], i) => {
      if (on > 0.5) {
        emit.push({ k: "sp" + i, type: "splash", x: p.x, y: p.y, rate: 34 * on });
        emit.push({ k: "rp" + i, type: "ripple", x: p.x, y: p.y, w, rate: 3.2 });
      }
    });

    // 水滴
    if (s.drop > 0 && s.drop < 1) {
      let a, bY;
      if (s.dropTarget === "pitcher") { a = lipW; bY = HOME.pitcher.y + L.pFloor - s.pLevel * L.pH; }
      else if (String(s.dropTarget).startsWith("g")) { a = lipW; bY = HOME.cups[ci].y + cr.cy; }
      else { a = pTipW; bY = HOME.cups[ci].y + cr.cy; }
      const k = (s.drop * 3) % 1;
      R.drop.style.opacity = 1;
      R.drop.setAttribute("cx", a.x + 2);
      R.drop.setAttribute("cy", a.y + (bY - a.y) * k * k);
      R.drop.setAttribute("fill", deep);
    } else R.drop.style.opacity = 0;

    // 水溫、計時（畫面固定的 HTML 標示，鏡頭推近時不會被裁走）
    if (R.hud) R.hud(hudTemp, s.timer > 0 && s.timer < 1 ? s.timer : -1, s.timerText || "");

    // 標籤
    if (R.onLabel) {
      R.label.style.display = "none";
      if (R.lastLabel !== s.label) { R.lastLabel = s.label; R.onLabel(s.label); }
    } else if (R.labelText.textContent !== s.label) {
      R.labelText.textContent = s.label;
      const fs = Math.min(25, 640 / Math.max(1, s.label.length));
      R.labelText.setAttribute("font-size", fs.toFixed(1));
      const w = Math.max(140, s.label.length * fs + 52);
      R.labelBg.setAttribute("x", -w / 2); R.labelBg.setAttribute("width", w);
    }
    R.label.style.opacity = s.label ? 1 : 0;

    // 品茗：杯稍為提起
    if (s.sip > 0) {
      if (glass) R.glass.setAttribute("transform", R.glass.getAttribute("transform") + ` translate(0,${-s.sip * 14})`);
      else R.cups[1].g.setAttribute("transform", R.cups[1].g.getAttribute("transform") + ` translate(0,${-s.sip * 10})`);
    }

    // 特效與鏡頭
    fxUpdate(R, now, dt, quiet ? [] : emit);
    cameraStep(R, s, { tip, kTarget, lipW, gTo, pTipW, cupTo, from, to, br, glass }, dt);
  }

  /* 鏡頭：按當前動作自動推近，緩動跟隨 */
  function cameraStep(R, s, P, dt) {
    let f = { x: 420, y: 330, z: 1.04 };
    const mid = (a, b, k = 0.5) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
    if (s.sK > 0.05 || s.kr > 8) { const m = mid(P.tip, P.kTarget, 0.35); f = { x: m.x - 18, y: m.y - 24, z: 1.62 }; }
    else if (s.sG > 0.05 || s.gr > 10) { const m = mid(P.lipW, P.gTo, 0.5); f = { x: m.x, y: m.y - 8, z: 1.72 }; }
    else if (s.sP > 0.05 || s.pr > 10) { const m = mid(P.pTipW, P.cupTo, 0.5); f = { x: m.x - 10, y: m.y - 6, z: 1.8 }; }
    else if (s.lid > 0.02 && s.lid < 0.98 || s.lidX !== 0) f = { x: HOME.gaiwan.x + R.q.bowlRim.cx, y: HOME.gaiwan.y + R.q.bowlRim.cy - 6, z: 1.9 };
    else if (s.hs > 1.3) f = { x: HOME.chahe.x + s.hx, y: HOME.chahe.y + s.hy - 20, z: 1.5 };
    else if (s.fall > 0 && s.fall < 1 || (s.hr > 6 && s.hx > 10)) { const m = mid(P.from, P.to, 0.5); f = { x: m.x, y: m.y - 4, z: 1.8 }; }
    else if (s.c1s > 1.05) f = { x: HOME.cups[1].x + s.c1x, y: HOME.cups[1].y + s.c1y - 30, z: 1.45 };
    else if (s.ws > 1.1) f = { x: HOME.glass.x + s.wx, y: HOME.glass.y + s.wy - 50, z: 1.5 };
    else if (s.wr > 10 || s.wLevel > 0.05 && s.mode === "glass" && s.sK > 0) f = { x: HOME.glass.x, y: HOME.glass.y - 56, z: 1.6 };
    f.x = Math.max(400 / f.z, Math.min(800 - 400 / f.z, f.x));
    f.y = Math.max(250 / f.z, Math.min(500 - 250 / f.z, f.y));
    const C = R.cam0;
    if (!R.camSet || R.noCam) { Object.assign(C, R.noCam ? { x: 400, y: 250, z: 1 } : f); R.camSet = true; }
    else { const k = 1 - Math.exp(-dt / 0.42); C.x += (f.x - C.x) * k; C.y += (f.y - C.y) * k; C.z += (f.z - C.z) * k; }
    R.cam.setAttribute("transform", `translate(${(400 - C.z * C.x).toFixed(2)},${(250 - C.z * C.y).toFixed(2)}) scale(${C.z.toFixed(4)})`);
  }

  /* ---------- 對外介面 ---------- */
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const styleListeners = [];
  const store = { get() { try { return localStorage.getItem("tea-style"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem("tea-style", v); } catch (e) {} } };
  let GLOBAL_STYLE = store.get() === "I" ? "I" : "R";

  function createStage(svg, opts = {}) {
    let style = GLOBAL_STYLE;
    let R = null, tea = null, clip = null, clipId = null, t = 0, playing = false, last = 0, raf = 0, speed = 1, visible = true, ready = false, idleTick = 0, idleSince = 0, hand = null;
    const wrap = svg.parentNode;
    const mk = (tag, cls, html) => { const n = document.createElement(tag); n.className = cls; if (html) n.innerHTML = html; wrap.appendChild(n); return n; };
    const hudTemp = mk("span", "cu-temp");
    const hudTimer = mk("span", "cu-timer", '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/><circle class="arc" cx="22" cy="22" r="19"/></svg><b></b>');
    const hudArc = hudTimer.querySelector(".arc"), hudTimerText = hudTimer.querySelector("b");
    const handBox = mk("figure", "cu-hand", '<img alt="" decoding="async"><figcaption></figcaption>');
    const handImg = handBox.querySelector("img"), handCap = handBox.querySelector("figcaption");
    const note = mk("span", "cu-note", "示範已加快");
    let hudLast = "";
    function hud(temp, frac, text) {
      const key = temp + "|" + (frac < 0 ? -1 : frac.toFixed(2)) + "|" + text;
      if (key === hudLast) return;
      hudLast = key;
      hudTemp.textContent = temp; hudTemp.classList.toggle("on", !!temp);
      hudTimer.classList.toggle("on", frac >= 0);
      note.classList.toggle("on", frac >= 0);
      if (frac >= 0) { hudArc.style.strokeDashoffset = (119.4 * frac).toFixed(1); hudTimerText.textContent = text; }
    }
    function paintHand() {
      handBox.classList.toggle("has", !!hand);
      if (!hand) return;
      const src = `assets/img/hands/${hand.id}-${style}.webp`;
      if (handImg.getAttribute("src") !== src) handImg.src = src;
      handImg.alt = hand.alt || hand.cap;
      handCap.textContent = hand.cap;
    }
    const build = () => { R = buildScene(svg, style); R.onLabel = opts.onLabel; R.noCam = reduce; R.camSet = false; R.hud = hud; hudLast = ""; paintHand(); };
    function frame(now) {
      raf = 0;
      if (!ready) return;
      const dtRaw = Math.min(0.05, Math.max(0, (now - last) / 1000));
      if (playing) {
        t += dtRaw * speed;
        if (t >= clip.dur) {
          t = clip.dur; playing = false; setRun(false);
          opts.onEnd && opts.onEnd(clipId);
          opts.onState && opts.onState(false);
        }
      }
      last = now;
      if (clip && (playing || (idleTick++ % 3) === 0)) {
        const s = clip.sample(t);
        render(R, s, tea, reduce ? 0 : now, dtRaw, reduce);
        opts.onFrame && opts.onFrame(s, playing, tea);
      }
      opts.onProgress && clip && opts.onProgress(t / clip.dur);
      const handOn = !!hand && !!clip && t >= Math.min(hand.at || 0.8, clip.dur);
      if (handOn !== handBox.classList.contains("on")) { handBox.classList.toggle("on", handOn); hudTemp.style.visibility = handOn ? "hidden" : ""; }
      if (playing) idleSince = now;
      // 暫停或播完後只保留約 12 秒的輕微水氣，之後停止重繪以省電
      if (playing || (visible && !reduce && !document.hidden && now - idleSince < 12000)) raf = requestAnimationFrame(frame);
    }
    function setRun(on) { svg.classList.toggle("is-playing", on); }
    function kick() { if (!raf && ready) raf = requestAnimationFrame((n) => { last = n; idleSince = n; frame(n); }); }
    function boot() {
      ready = false;
      svg.classList.add("is-loading");
      return preload(style).then(() => {
        build();
        ready = true;
        svg.classList.remove("is-loading");
        if (tea && clipId) { clip = buildClip(clipId, tea); render(R, clip.sample(Math.min(t, clip.dur)), tea, 0, 0.016, true); }
        kick();
      });
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((en) => { visible = en.some((x) => x.isIntersecting); if (visible) kick(); }).observe(svg);
    }
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    styleListeners.push((st) => { if (st !== style) { style = st; boot(); } });
    const booted = boot();
    return {
      load(newTea, id, autoplay, handInfo) {
        tea = newTea; clipId = id; clip = buildClip(id, tea);
        hand = handInfo || null; paintHand(); handBox.classList.remove("on"); hudTemp.style.visibility = "";
        t = 0; playing = !!autoplay;
        if (!autoplay) t = reduce || id === "prepare" ? clip.dur : 0;
        last = performance.now(); setRun(playing);
        if (R) { R.camSet = false; R.fx.acc = {}; }
        opts.onState && opts.onState(playing);
        booted.then(kick);
        if (ready) kick();
      },
      play() { if (!clip) return; if (t >= clip.dur) t = 0; playing = true; setRun(true); last = performance.now(); opts.onState && opts.onState(true); kick(); },
      pause() { playing = false; setRun(false); opts.onState && opts.onState(false); },
      toggle() { playing ? this.pause() : this.play(); },
      replay() { t = 0; this.play(); },
      seek(frac) { if (clip) { t = Math.max(0, Math.min(1, frac)) * clip.dur; kick(); } },
      setSpeed(v) { speed = v; },
      get playing() { return playing; },
      get duration() { return clip ? clip.dur : 0; },
      get ready() { return ready; },
      get state() { return clip ? clip.sample(t) : null; },
      destroy() { cancelAnimationFrame(raf); }
    };
  }

  function setStyle(st) {
    st = st === "I" ? "I" : "R";
    if (st === GLOBAL_STYLE) return;
    GLOBAL_STYLE = st; store.set(st);
    styleListeners.forEach((fn) => fn(st));
  }

  window.TeaStage = { createStage, buildClip, setStyle, getStyle: () => GLOBAL_STYLE, _dbg: () => ({ L, HOME }) };
})();
