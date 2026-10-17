/* 茶席特寫動畫：以 SVG 繪畫茶具，按關鍵幀時間軸演示每一步手法。 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const HOME = {
    kettle: { x: 112, y: 366 },
    caddy: { x: 214, y: 402 },
    gaiwan: { x: 330, y: 404 },
    glass: { x: 470, y: 404 },
    towel: { x: 716, y: 448 },
    pitcher: { x: 498, y: 404 },
    cups: [{ x: 612, y: 444 }, { x: 682, y: 444 }, { x: 752, y: 444 }],
    chahe: { x: 196, y: 470 }
  };
  const L = {
    kettleTip: { x: 93, y: -80 }, kettlePivot: { x: 0, y: -52 },
    gaiwanLip: { x: 58, y: -68 }, gaiwanRim: -68,
    pitcherTip: { x: 47, y: -106 }, pitcherTop: -100,
    cupRim: -34, glassTop: -130, chaheTip: { x: 50, y: -4 }
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
  const gaiwanTop = () => ({ x: HOME.gaiwan.x, y: HOME.gaiwan.y + L.gaiwanRim });
  const glassTop = () => ({ x: HOME.glass.x, y: HOME.glass.y + L.glassTop });
  const pitcherTop = () => ({ x: HOME.pitcher.x, y: HOME.pitcher.y + L.pitcherTop });
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
      taste: glass ? { wLeaves: 1, wLevel: 0.72, wTint: 1, wx: -10, wy: 52, ws: 1.35, dance: 1 } : { gLeaves: 1, pLevel: 0.12, c0: 0.7, c1: 0.7, c2: 0.7, c1x: -282, c1y: 26, c1s: 1.9 },
      again: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.9, dance: 1 } : { gLeaves: 1, lid: 0 }
    };
    Object.assign(b, preset[id] || {});
    const c = new Clip(b);
    const gTarget = (lvl) => ({ x: gaiwanTop().x, y: gaiwanTop().y + (1 - lvl) * 10 });
    const wTarget = (lvl) => ({ x: glassTop().x, y: HOME.glass.y - 4 - lvl * 124 });

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
          c.key("c1x", 0.3, 0).key("c1y", 0.3, 0).key("c1s", 0.3, 1).key("c1y", 1.0, -30).key("c1x", 2.2, -282).key("c1y", 2.2, 26).key("c1s", 2.2, 1.9);
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
        c.label(0, "壺低懸杯上，來回巡斟");
        b.pLevel = 0.85; b.pTint = 1;
        let t = 0.1, lvl = 0.85;
        const order = [0, 1, 2, 2, 1, 0];
        order.forEach((i, k) => {
          const before = k < 3 ? 0 : 0.35;
          t = pitcherPour(c, t - (k ? 0.5 : 0), i, 0.35, lvl, lvl - 0.12, before, before + 0.33) ;
          lvl -= 0.12;
        });
        pitcherHome(c, t);
        break;
      }
      case "points": {
        c.label(0, "最後幾滴濃湯，逐杯點入");
        b.pLevel = 0.06; b.c0 = 0.66; b.c1 = 0.66; b.c2 = 0.66;
        let t = 0.1;
        [0, 1, 2].forEach((i) => {
          const a = aimPitcher(cupTop(i), 70, 48);
          c.key("px", t, c.lastPx || 0).key("py", t, c.lastPy || 0).key("pr", t, c.lastPr || 0)
            .key("px", t + 0.6, a.x).key("py", t + 0.6, a.y).key("pr", t + 0.6, 70).key("pTarget", t, i)
            .key("drop", t + 0.7, 0).key("drop", t + 1.5, 0.999).key("drop", t + 1.51, 0).key("dropTarget", t, "cup" + i)
            .key("c" + i, t + 0.9, 0.66).key("c" + i, t + 1.5, 0.72);
          c.lastPx = a.x; c.lastPy = a.y; c.lastPr = 70;
          t += 1.6;
        });
        c.key("pr", t, 70).key("pr", t + 0.4, 0);
        pitcherHome(c, t + 0.2);
        break;
      }
    }
    return c.finish();
  }

  /* ---------- 繪畫 ---------- */
  const SVG_DEFS = `
  <defs>
    <linearGradient id="tb-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe0c4"/><stop offset="1" stop-color="#d9bf97"/></linearGradient>
    <radialGradient id="tb-glow" cx="0.72" cy="0.1" r="0.7"><stop offset="0" stop-color="#fff6dc" stop-opacity=".95"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>
    <linearGradient id="tb-table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7b4f33"/><stop offset=".25" stop-color="#5e3a25"/><stop offset="1" stop-color="#3d2416"/></linearGradient>
    <linearGradient id="tb-tray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5c3c"/><stop offset="1" stop-color="#6a432a"/></linearGradient>
    <linearGradient id="tb-por" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e4ddcf"/><stop offset=".35" stop-color="#fdfbf6"/><stop offset=".7" stop-color="#f4efe5"/><stop offset="1" stop-color="#d8cfbf"/></linearGradient>
    <linearGradient id="tb-cel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfdccd"/><stop offset="1" stop-color="#9fb7a3"/></linearGradient>
    <linearGradient id="tb-cu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a3b1c"/><stop offset=".38" stop-color="#d98d58"/><stop offset=".55" stop-color="#f0b483"/><stop offset="1" stop-color="#6e3417"/></linearGradient>
    <linearGradient id="tb-iron" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2522"/><stop offset=".5" stop-color="#4a423c"/><stop offset="1" stop-color="#221e1b"/></linearGradient>
    <linearGradient id="tb-glaze" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b3326"/><stop offset=".45" stop-color="#8a6449"/><stop offset="1" stop-color="#3c281d"/></linearGradient>
    <radialGradient id="tb-fire" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#e46a24"/><stop offset="1" stop-color="#5a1d0a"/></radialGradient>
    <radialGradient id="tb-sh"><stop offset="0" stop-color="#1d0f07" stop-opacity=".42"/><stop offset=".6" stop-color="#1d0f07" stop-opacity=".2"/><stop offset="1" stop-color="#1d0f07" stop-opacity="0"/></radialGradient>
    <clipPath id="tb-gclip"><ellipse cx="0" cy="-68" rx="55" ry="10"/></clipPath>
    <clipPath id="tb-pclip"><path d="M-31 -4 L-35 -95 L35 -95 L31 -4 Z"/></clipPath>
    <clipPath id="tb-wclip"><path d="M-29 -5 L-33 -128 L33 -128 L29 -5 Z"/></clipPath>
    <clipPath id="tb-cclip"><ellipse cx="0" cy="-34" rx="27" ry="5.4"/></clipPath>
  </defs>`;

  const LEAF = "M0 -4 C4 -4 7 -1 8 0 C7 1 4 4 0 4 C-4 4 -7 1 -8 0 C-7 -1 -4 -4 0 -4Z";

  function shadow(parent, rx) { return el("ellipse", { cx: 0, cy: 2, rx: rx * 1.15, ry: rx * 0.22, fill: "url(#tb-sh)" }, parent); }

  function buildScene(svg) {
    svg.innerHTML = SVG_DEFS;
    const R = {};
    const root = el("g", {}, svg);
    el("rect", { x: 0, y: 0, width: 800, height: 330, fill: "url(#tb-wall)" }, root);
    const lat = el("g", { opacity: 0.16, stroke: "#6b4a2e", "stroke-width": 3, fill: "none" }, root);
    for (let x = 430; x <= 790; x += 60) el("line", { x1: x, y1: 0, x2: x, y2: 300 }, lat);
    for (let y = 30; y <= 300; y += 54) el("line", { x1: 400, y1: y, x2: 800, y2: y }, lat);
    el("rect", { x: 0, y: 0, width: 800, height: 330, fill: "url(#tb-glow)" }, root);
    el("rect", { x: 0, y: 300, width: 800, height: 200, fill: "url(#tb-table)" }, root);
    el("rect", { x: 0, y: 300, width: 800, height: 3, fill: "#a3714b", opacity: 0.8 }, root);
    const grain = el("g", { stroke: "#2c170c", "stroke-width": 1.2, fill: "none", opacity: 0.25 }, root);
    [330, 352, 381, 418, 452, 480].forEach((y, i) => el("path", { d: `M0 ${y} C 200 ${y - 6 + i}, 420 ${y + 8}, 800 ${y - 3}` }, grain));
    // 茶盤
    const tray = el("g", {}, root);
    el("path", { d: "M262 372 L790 372 L800 452 L252 452 Z", fill: "url(#tb-tray)" }, tray);
    el("path", { d: "M252 452 L800 452 L800 462 L252 462 Z", fill: "#4a2c1a" }, tray);
    for (let x = 282; x < 790; x += 26) el("line", { x1: x, y1: 376, x2: x - 2, y2: 448, stroke: "#4f3020", "stroke-width": 2.4, opacity: 0.55 }, tray);
    R.layer = el("g", {}, root);

    // 爐與壺
    const stove = el("g", { transform: `translate(${HOME.kettle.x},${HOME.kettle.y})` }, R.layer);
    shadow(stove, 62).setAttribute("transform", "translate(0,52)");
    el("path", { d: "M-50 0 L50 0 L54 50 L-54 50 Z", fill: "url(#tb-iron)" }, stove);
    el("rect", { x: -20, y: 16, width: 40, height: 24, rx: 5, fill: "url(#tb-fire)" }, stove);
    el("ellipse", { cx: 0, cy: 0, rx: 50, ry: 8, fill: "#3a332e" }, stove);
    R.kettle = el("g", {}, R.layer);
    const kt = el("g", {}, R.kettle);
    el("path", { d: "M44 -24 C68 -32 80 -56 89 -82 L97 -79 C89 -50 76 -22 50 -10 Z", fill: "url(#tb-cu)" }, kt);
    el("path", { d: "M-54 -10 C-64 -42 -48 -80 0 -82 C48 -80 64 -42 54 -10 C40 0 -40 0 -54 -10Z", fill: "url(#tb-cu)" }, kt);
    const dots = el("g", { fill: "#ffd9b0", opacity: 0.35 }, kt);
    [[-30, -50], [-12, -62], [10, -40], [26, -58], [-22, -28], [30, -30], [0, -20], [-38, -38]].forEach(([x, y]) => el("ellipse", { cx: x, cy: y, rx: 4, ry: 3 }, dots));
    el("ellipse", { cx: 0, cy: -80, rx: 26, ry: 6, fill: "#8a4a26" }, kt);
    el("ellipse", { cx: 0, cy: -88, rx: 7, ry: 6, fill: "#c27a48" }, kt);
    el("path", { d: "M-34 -74 C-36 -128 36 -128 34 -74", fill: "none", stroke: "#3b2a1c", "stroke-width": 7, "stroke-linecap": "round" }, kt);
    el("path", { d: "M-34 -74 C-36 -128 36 -128 34 -74", fill: "none", stroke: "#b48a5a", "stroke-width": 7, "stroke-dasharray": "3 4", opacity: 0.6 }, kt);
    R.tempChip = el("g", {}, R.layer);
    el("rect", { x: -70, y: -19, width: 140, height: 38, rx: 19, fill: "#2b211a", opacity: 0.86 }, R.tempChip);
    R.tempText = el("text", { x: 0, y: 7, "text-anchor": "middle", "font-size": 19, fill: "#f6e7c8", class: "tb-svgtext" }, R.tempChip);

    // 茶巾
    R.towel = el("g", { transform: `translate(${HOME.towel.x},${HOME.towel.y})` }, R.layer);
    shadow(R.towel, 44);
    el("path", { d: "M-44 0 L-38 -22 L40 -22 L46 0 Z", fill: "#9b6f58" }, R.towel);
    el("path", { d: "M-38 -22 L40 -22 L38 -26 L-36 -26 Z", fill: "#b48671" }, R.towel);
    el("path", { d: "M-41 -11 L43 -11", stroke: "#7d5340", "stroke-width": 1.5 }, R.towel);

    // 茶罐
    const caddy = el("g", { transform: `translate(${HOME.caddy.x},${HOME.caddy.y})` }, R.layer);
    shadow(caddy, 26);
    el("path", { d: "M-20 0 L-22 -46 Q0 -52 22 -46 L20 0 Q0 5 -20 0Z", fill: "url(#tb-glaze)" }, caddy);
    el("path", { d: "M-23 -46 Q0 -60 23 -46 Q0 -40 -23 -46Z", fill: "#5a3c2b" }, caddy);
    el("circle", { cx: 0, cy: -55, r: 5, fill: "#3c281d" }, caddy);

    // 公道杯
    R.pitcher = el("g", {}, R.layer);
    R.pitcherShadow = shadow(R.pitcher, 40);
    R.pBody = el("g", {}, R.pitcher);
    const pIn = el("g", { "clip-path": "url(#tb-pclip)" }, R.pBody);
    R.pLiquid = el("rect", { x: -80, y: 0, width: 160, height: 200 }, pIn);
    el("path", { d: "M-34 -4 L-38 -96 Q-38 -101 -30 -101 L32 -101 Q42 -102 47 -107 L46 -98 Q38 -93 38 -86 L34 -4 Q0 2 -34 -4Z", fill: "#ffffff", "fill-opacity": 0.14, stroke: "#ffffff", "stroke-opacity": 0.85, "stroke-width": 2.2 }, R.pBody);
    el("path", { d: "M-37 -86 C-62 -84 -62 -40 -35 -34", fill: "none", stroke: "#ffffff", "stroke-opacity": 0.8, "stroke-width": 4 }, R.pBody);
    el("path", { d: "M-24 -88 L-22 -14", stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 3, "stroke-linecap": "round" }, R.pBody);

    // 蓋碗
    R.saucer = el("g", {}, R.layer);
    shadow(R.saucer, 62);
    el("ellipse", { cx: 0, cy: -4, rx: 62, ry: 12, fill: "#e9e3d7" }, R.saucer);
    el("ellipse", { cx: 0, cy: -7, rx: 54, ry: 9, fill: "#fbf8f2" }, R.saucer);
    R.gaiwan = el("g", {}, R.layer);
    R.gShadow = el("g", {}, R.gaiwan);
    R.gBowl = el("g", {}, R.gaiwan);
    el("ellipse", { cx: 0, cy: -68, rx: 58, ry: 11, fill: "#d9d2c4" }, R.gBowl);
    const gIn = el("g", { "clip-path": "url(#tb-gclip)" }, R.gBowl);
    R.gLeaves = el("g", {}, gIn);
    [[-14, -66, 20], [4, -70, -30], [16, -65, 50], [-4, -63, 80], [-22, -70, -60], [24, -70, 10], [8, -62, -10]].forEach(([x, y, r]) => el("path", { d: LEAF, transform: `translate(${x},${y}) rotate(${r}) scale(1.3)` }, R.gLeaves));
    R.gLiquid = el("ellipse", { cx: 0, cy: -66, rx: 54, ry: 9 }, gIn);
    el("path", { d: "M-30 -9 C-36 -20 -54 -50 -58 -68 C-40 -58 40 -58 58 -68 C54 -50 36 -20 30 -9 C14 -5 -14 -5 -30 -9Z", fill: "url(#tb-por)" }, R.gBowl);
    el("path", { d: "M-46 -40 C-20 -32 20 -32 46 -40", fill: "none", stroke: "#8fb0b6", "stroke-width": 1.4, opacity: 0.6 }, R.gBowl);
    el("path", { d: "M-58 -68 C-40 -58 40 -58 58 -68", fill: "none", stroke: "#fff", "stroke-width": 2 }, R.gBowl);
    R.lid = el("g", {}, R.gBowl);
    el("path", { d: "M-55 0 C-50 -26 50 -26 55 0 C40 6 -40 6 -55 0Z", fill: "url(#tb-por)" }, R.lid);
    el("path", { d: "M-40 -12 C-14 -6 14 -6 40 -12", fill: "none", stroke: "#8fb0b6", "stroke-width": 1.2, opacity: 0.55 }, R.lid);
    el("path", { d: "M-7 -19 L-9 -28 L9 -28 L7 -19Z", fill: "#efe9de" }, R.lid);
    el("ellipse", { cx: 0, cy: -28, rx: 12, ry: 4, fill: "#f8f4ec", stroke: "#d6cdbd" }, R.lid);

    // 玻璃杯
    R.glass = el("g", {}, R.layer);
    shadow(R.glass, 40);
    const wIn = el("g", { "clip-path": "url(#tb-wclip)" }, R.glass);
    R.wLiquid = el("rect", { x: -40, y: 0, width: 80, height: 0 }, wIn);
    R.wSurface = el("ellipse", { cx: 0, cy: 0, rx: 32, ry: 5 }, wIn);
    R.wLeaves = el("g", {}, wIn);
    R.wLeafList = [];
    for (let i = 0; i < 11; i++) R.wLeafList.push(el("path", { d: "M0 -9 C3 -6 3 6 0 9 C-3 6 -3 -6 0 -9Z" }, R.wLeaves));
    el("path", { d: "M-32 -2 L-36 -130 L36 -130 L32 -2 Q0 4 -32 -2Z", fill: "#fff", "fill-opacity": 0.12, stroke: "#fff", "stroke-opacity": 0.85, "stroke-width": 2.2 }, R.glass);
    el("ellipse", { cx: 0, cy: -130, rx: 36, ry: 7, fill: "none", stroke: "#fff", "stroke-opacity": 0.9, "stroke-width": 2 }, R.glass);
    el("path", { d: "M-24 -118 L-22 -14", stroke: "#fff", "stroke-opacity": 0.5, "stroke-width": 3, "stroke-linecap": "round" }, R.glass);

    // 品茗杯
    R.cups = HOME.cups.map(() => {
      const g = el("g", {}, R.layer);
      shadow(g, 30);
      el("ellipse", { cx: 0, cy: -34, rx: 30, ry: 6, fill: "#d9d2c4" }, g);
      const ci = el("g", { "clip-path": "url(#tb-cclip)" }, g);
      const liq = el("ellipse", { cx: 0, cy: -34, rx: 27, ry: 5 }, ci);
      el("path", { d: "M-18 -2 C-22 -10 -28 -24 -30 -34 C-18 -29 18 -29 30 -34 C28 -24 22 -10 18 -2 C8 1 -8 1 -18 -2Z", fill: "url(#tb-por)" }, g);
      el("path", { d: "M-30 -34 C-18 -29 18 -29 30 -34", fill: "none", stroke: "#fff", "stroke-width": 1.6 }, g);
      const steam = el("g", { class: "tb-steam" }, g);
      [-8, 2, 11].forEach((x, i) => el("path", { d: `M${x} -44 c-6 -10 6 -18 0 -28 c-6 -10 6 -16 0 -26`, style: `animation-delay:${i * 0.7}s` }, steam));
      return { g, liq, steam };
    });

    // 茶荷
    R.chahe = el("g", {}, R.layer);
    R.chaheShadow = shadow(R.chahe, 46);
    R.chaheBody = el("g", {}, R.chahe);
    el("path", { d: "M-46 0 C-30 -14 30 -17 50 -4 C34 10 -26 13 -46 0Z", fill: "url(#tb-cel)", stroke: "#86a08a", "stroke-width": 1 }, R.chaheBody);
    el("path", { d: "M-34 -1 C-18 -9 22 -10 38 -3", fill: "none", stroke: "#eef4ec", "stroke-width": 1.5, opacity: 0.8 }, R.chaheBody);
    R.hLeaves = el("g", {}, R.chaheBody);
    [[-20, -4, 10], [-8, -7, -40], [4, -4, 30], [16, -6, -20], [-12, -1, 70], [8, -9, 60], [24, -3, -60], [-2, -2, 0]].forEach(([x, y, r]) => el("path", { d: LEAF, transform: `translate(${x},${y}) rotate(${r}) scale(1.15,.8)` }, R.hLeaves));

    // 水流、落葉、水滴
    R.streams = el("g", { fill: "none", "stroke-linecap": "round" }, root);
    const mkStream = (w) => ({ main: el("path", { "stroke-width": w }, R.streams), hi: el("path", { "stroke-width": Math.max(1, w * 0.3), stroke: "#fff", "stroke-opacity": 0.65, class: "tb-flow" }, R.streams) });
    R.sK = mkStream(4.2); R.sG = mkStream(5); R.sP = mkStream(3.6);
    R.fall = el("g", {}, root);
    R.fallLeaves = [];
    for (let i = 0; i < 7; i++) R.fallLeaves.push(el("path", { d: LEAF }, R.fall));
    R.drop = el("ellipse", { rx: 2.6, ry: 3.4 }, root);
    R.kSteam = el("g", { class: "tb-steam" }, root);
    [0, 1, 2].forEach((i) => el("path", { d: `M${i * 6 - 6} 0 c-6 -12 6 -20 0 -32 c-6 -12 6 -18 0 -30`, style: `animation-delay:${i * 0.8}s` }, R.kSteam));

    // 計時與標籤
    R.timer = el("g", {}, root);
    el("circle", { r: 32, fill: "#2b211a", opacity: 0.86 }, R.timer);
    el("circle", { r: 20, fill: "none", stroke: "#6d5a48", "stroke-width": 4 }, R.timer);
    R.timerArc = el("circle", { r: 20, fill: "none", stroke: "#e2b866", "stroke-width": 4, "stroke-dasharray": "125.7", transform: "rotate(-90)", "stroke-linecap": "round" }, R.timer);
    R.timerText = el("text", { y: 5, "text-anchor": "middle", "font-size": 15, fill: "#f6e7c8", class: "tb-svgtext" }, R.timer);
    R.label = el("g", { transform: "translate(400,52)" }, root);
    R.labelBg = el("rect", { x: -150, y: -26, width: 300, height: 52, rx: 26, fill: "#2b211a", opacity: 0.84 }, R.label);
    R.labelText = el("text", { x: 0, y: 9, "text-anchor": "middle", "font-size": 25, fill: "#fbf1dc", class: "tb-svgtext" }, R.label);
    [R.cups[0].g, R.cups[1].g, R.cups[2].g, R.pitcher, R.saucer, R.gaiwan, R.glass, R.chahe, R.kettle, R.tempChip].forEach((n) => R.layer.appendChild(n));
    return R;
  }

  function streamPath(from, to, dir) {
    const cx = from.x + dir.x * 18, cy = from.y + dir.y * 18;
    return `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  }

  function render(R, s, tea, now) {
    const glass = s.mode === "glass";
    const teaCol = tea.liquor, deep = tea.liquorDeep;
    const tint = (k) => mixColor(WATER, teaCol, Math.max(0, Math.min(1, k)));
    const show = s.show;
    const appear = (node, i) => {
      const k = Math.max(0, Math.min(1, show * 6 - i));
      node.style.opacity = k;
      return (1 - k) * 18;
    };

    // 煮水壺
    const kOff = appear(R.kettle, 0);
    const kp = { x: HOME.kettle.x + s.kx, y: HOME.kettle.y + s.ky + kOff };
    R.kettle.setAttribute("transform", `translate(${kp.x},${kp.y}) rotate(${s.kr} ${L.kettlePivot.x} ${L.kettlePivot.y})`);
    const tipL = rot(L.kettleTip, L.kettlePivot, s.kr);
    const tip = { x: kp.x + tipL.x, y: kp.y + tipL.y };
    R.kSteam.setAttribute("transform", `translate(${tip.x},${tip.y - 6})`);
    R.kSteam.style.opacity = s.kr < 5 ? 0.9 * Math.min(1, show * 2) : 0;
    R.tempChip.setAttribute("transform", `translate(${HOME.kettle.x},${HOME.kettle.y - 156})`);
    R.tempChip.style.opacity = s.temp * Math.max(0, 1 - Math.abs(s.kx) / 40);
    R.tempText.textContent = tea.temp[0] === tea.temp[1] ? `水溫 ${tea.temp[0]}°C` : `水溫 ${tea.temp[0]}–${tea.temp[1]}°C`;

    // 蓋碗
    R.gaiwan.style.display = glass ? "none" : "";
    R.pitcher.style.display = glass ? "none" : "";
    R.cups.forEach((c) => (c.g.style.display = glass ? "none" : ""));
    R.glass.style.display = glass ? "" : "none";
    R.towel.style.display = glass ? "" : "none";
    appear(R.towel, 4);
    const gOff = appear(R.gaiwan, 2);
    const lip = L.gaiwanLip;
    R.gaiwan.setAttribute("transform", `translate(${HOME.gaiwan.x + s.gx},${HOME.gaiwan.y + s.gy + gOff})`);
    R.saucer.setAttribute("transform", `translate(${HOME.gaiwan.x},${HOME.gaiwan.y + gOff})`);
    R.saucer.style.opacity = R.gaiwan.style.opacity;
    R.saucer.style.display = glass ? "none" : "";
    R.gBowl.setAttribute("transform", `rotate(${s.gr} ${lip.x} ${lip.y})`);
    R.gShadow.style.opacity = Math.max(0, 1 - Math.abs(s.gy) / 40);
    R.gLeaves.style.opacity = s.gLeaves;
    R.gLeaves.setAttribute("fill", tea.leaf);
    R.gLiquid.style.opacity = s.gLevel > 0.02 ? 0.92 : 0;
    R.gLiquid.setAttribute("cy", -68 + (1 - s.gLevel) * 10);
    R.gLiquid.setAttribute("rx", 54 * (0.78 + 0.22 * s.gLevel));
    R.gLiquid.setAttribute("ry", 9 * (0.78 + 0.22 * s.gLevel));
    R.gLiquid.setAttribute("fill", tint(s.gTint));
    const lidOff = { x: 70, y: -52, r: 72 };
    const lk = s.lid;
    R.lid.setAttribute("transform", `translate(${lerp(lidOff.x, s.lidX, lk)},${lerp(lidOff.y, -66, lk)}) rotate(${lerp(lidOff.r, s.lidR, lk)})`);

    // 公道杯
    const pOff = appear(R.pitcher, 3);
    const pt = L.pitcherTip;
    R.pitcher.setAttribute("transform", `translate(${HOME.pitcher.x + s.px},${HOME.pitcher.y + s.py + pOff})`);
    R.pBody.setAttribute("transform", `rotate(${s.pr} ${pt.x} ${pt.y})`);
    R.pitcherShadow.style.opacity = Math.max(0, 1 - Math.abs(s.py) / 40);
    const pTop = -4 - s.pLevel * 90;
    R.pLiquid.setAttribute("y", pTop);
    R.pLiquid.setAttribute("transform", `rotate(${-s.pr} 0 ${pTop})`);
    R.pLiquid.setAttribute("fill", mixColor(WATER, teaCol, s.pTint));
    R.pLiquid.style.opacity = s.pLevel > 0.01 ? 0.86 : 0;

    // 品茗杯
    R.cups.forEach((c, i) => {
      const off = appear(c.g, 4 + i * 0.4);
      const lv = s["c" + i];
      let x = HOME.cups[i].x, y = HOME.cups[i].y + off, sc = 1;
      if (i === 1) { x += s.c1x; y += s.c1y; sc = s.c1s; }
      c.g.setAttribute("transform", `translate(${x},${y}) scale(${sc})`);
      c.liq.style.opacity = lv > 0.02 ? 0.95 : 0;
      c.liq.setAttribute("cy", -34 + (1 - lv) * 7);
      c.liq.setAttribute("rx", 27 * (0.7 + 0.3 * lv));
      c.liq.setAttribute("ry", 5.4 * (0.7 + 0.3 * lv));
      c.liq.setAttribute("fill", mixColor(WATER, deep, s.cTint));
      c.steam.style.opacity = i === 1 ? s.steamCup * 0.8 : 0;
    });

    const c1 = R.cups[1].g;
    if (s.c1s > 1.05 && c1.nextSibling !== R.kettle) R.layer.insertBefore(c1, R.kettle);
    else if (s.c1s <= 1.05 && c1.nextSibling !== R.cups[2].g) R.layer.insertBefore(c1, R.cups[2].g);

    // 玻璃杯
    if (glass) {
      const wOff = appear(R.glass, 2);
      R.glass.setAttribute("transform", `translate(${HOME.glass.x + s.wx},${HOME.glass.y + s.wy + wOff}) rotate(${s.wr} 32 -2) scale(${s.ws})`);
      const top = -4 - s.wLevel * 124;
      R.wLiquid.setAttribute("y", top);
      R.wLiquid.setAttribute("height", Math.max(0, -4 - top + 6));
      R.wLiquid.setAttribute("transform", `rotate(${-s.wr} 0 ${top})`);
      R.wSurface.setAttribute("cy", top);
      R.wSurface.setAttribute("transform", `rotate(${-s.wr} 0 ${top})`);
      const col = mixColor(WATER, teaCol, Math.max(0, Math.min(1, s.wTint)));
      R.wLiquid.setAttribute("fill", col);
      R.wSurface.setAttribute("fill", col);
      R.wLiquid.style.opacity = R.wSurface.style.opacity = s.wLevel > 0.01 ? 0.62 : 0;
      R.wLeaves.style.opacity = s.wLeaves;
      R.wLeaves.setAttribute("fill", tea.leaf);
      R.wLeafList.forEach((lf, i) => {
        const seed = i * 1.7;
        const floatY = s.wLevel > 0.05 ? top + 10 + ((i * 23) % 70) * (s.wLevel / 0.72) : -10 - (i % 3) * 3;
        const y = lerp(-8 - (i % 3) * 3, floatY, Math.min(1, s.wLevel * 3)) + Math.sin(now / 900 + seed) * 6 * s.dance;
        const x = -22 + ((i * 37) % 44) + Math.cos(now / 1100 + seed) * 4 * s.dance;
        const r = (i * 47) % 180 + Math.sin(now / 1300 + seed) * 25 * s.dance + (s.dance > 0.5 ? 0 : 70);
        lf.setAttribute("transform", `translate(${x},${y}) rotate(${r}) scale(${0.8 + (i % 3) * 0.15})`);
      });
      R.cups[1].steam.style.opacity = 0;
      R.kSteam.style.opacity = s.kr < 5 ? R.kSteam.style.opacity : 0;
    }

    // 茶荷
    const hOff = appear(R.chahe, 1);
    R.chahe.setAttribute("transform", `translate(${HOME.chahe.x + s.hx},${HOME.chahe.y + s.hy + hOff}) scale(${s.hs})`);
    R.chaheBody.setAttribute("transform", `rotate(${s.hr} ${L.chaheTip.x} ${L.chaheTip.y})`);
    R.chaheShadow.style.opacity = Math.max(0, 1 - Math.abs(s.hy) / 30);
    R.hLeaves.style.opacity = s.hLeaves;
    R.hLeaves.setAttribute("fill", tea.leaf);

    // 落葉
    const hTip = rot(L.chaheTip, L.chaheTip, s.hr);
    const from = { x: HOME.chahe.x + s.hx + hTip.x * s.hs, y: HOME.chahe.y + s.hy + hTip.y * s.hs };
    const intoGlass = glass;
    const to = intoGlass ? { x: HOME.glass.x, y: HOME.glass.y - 40 } : { x: HOME.gaiwan.x, y: HOME.gaiwan.y - 66 };
    R.fall.setAttribute("fill", tea.leaf);
    R.fallLeaves.forEach((lf, i) => {
      const k = Math.max(0, Math.min(1, s.fall * 1.6 - i * 0.09));
      const vis = s.fall > 0 && s.fall < 1 && k > 0 && k < 1;
      lf.style.opacity = vis ? 1 : 0;
      if (vis) {
        const x = lerp(from.x, to.x + (i - 3) * 6, k), y = from.y + (to.y - from.y) * k * k;
        lf.setAttribute("transform", `translate(${x},${y}) rotate(${i * 50 + k * 220}) scale(1.1)`);
      }
    });

    // 水流
    const setStream = (S, on, a, b, dir, col) => {
      const vis = on > 0.02;
      S.main.style.opacity = S.hi.style.opacity = vis ? on : 0;
      if (!vis) return;
      const d = streamPath(a, b, dir);
      S.main.setAttribute("d", d); S.hi.setAttribute("d", d);
      S.main.setAttribute("stroke", col);
    };
    const kDir = { x: Math.cos(rad(s.kr - 60)), y: Math.sin(rad(s.kr - 60)) };
    const kTarget = glass ? { x: tip.x + 4, y: HOME.glass.y - 6 - s.wLevel * 124 } : { x: tip.x + 4, y: HOME.gaiwan.y + s.gy - 68 + (1 - s.gLevel) * 10 };
    setStream(R.sK, s.sK, tip, kTarget, kDir, "#e6f3f7");
    const lipW = { x: HOME.gaiwan.x + s.gx + lip.x, y: HOME.gaiwan.y + s.gy + lip.y };
    const gTo = s.sGTarget === "tray" ? { x: lipW.x + 6, y: HOME.pitcher.y - 2 } : { x: lipW.x + 6, y: HOME.pitcher.y - 6 - s.pLevel * 90 };
    setStream(R.sG, s.sG, lipW, gTo, { x: 0.5, y: 0.6 }, tint(s.gTint));
    const pTipW = { x: HOME.pitcher.x + s.px + pt.x, y: HOME.pitcher.y + s.py + pt.y };
    const ci = Math.round(s.pTarget || 0);
    const cupTo = { x: pTipW.x + 4, y: HOME.cups[ci].y - 34 + (1 - s["c" + ci]) * 7 };
    setStream(R.sP, s.sP, pTipW, cupTo, { x: 0.5, y: 0.6 }, mixColor(WATER, deep, s.pTint));

    // 水滴
    if (s.drop > 0 && s.drop < 1) {
      let a, bY;
      if (s.dropTarget === "pitcher") { a = lipW; bY = HOME.pitcher.y - 6 - s.pLevel * 90; }
      else { a = pTipW; bY = HOME.cups[ci].y - 32; }
      const k = (s.drop * 3) % 1;
      R.drop.style.opacity = 1;
      R.drop.setAttribute("cx", a.x + 2);
      R.drop.setAttribute("cy", a.y + (bY - a.y) * k * k);
      R.drop.setAttribute("fill", deep);
    } else R.drop.style.opacity = 0;

    // 計時
    R.timer.style.opacity = s.timer > 0 && s.timer < 1 ? 1 : 0;
    R.timer.setAttribute("transform", `translate(${HOME.gaiwan.x + 92},${HOME.gaiwan.y - 120})`);
    R.timerArc.setAttribute("stroke-dashoffset", (125.7 * s.timer).toFixed(1));
    R.timerText.textContent = s.timerText || "";

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
  }

  /* ---------- 對外介面 ---------- */
  function createStage(svg, opts = {}) {
    const R = buildScene(svg);
    R.onLabel = opts.onLabel;
    let tea = null, clip = null, clipId = null, t = 0, playing = false, last = 0, raf = 0, speed = 1;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function frame(now) {
      raf = 0;
      if (playing) {
        const dt = Math.min(0.05, (now - last) / 1000) * speed;
        t += dt;
        if (t >= clip.dur) {
          t = clip.dur; playing = false; setRun(false);
          opts.onEnd && opts.onEnd(clipId);
          opts.onState && opts.onState(false);
        }
      }
      last = now;
      if (clip) render(R, clip.sample(t), tea, reduce ? 0 : now);
      opts.onProgress && clip && opts.onProgress(t / clip.dur);
      if (playing) raf = requestAnimationFrame(frame);
    }
    function setRun(on) { svg.classList.toggle("is-playing", on); }
    function kick() {
      if (!raf) raf = requestAnimationFrame((n) => { if (!playing) last = n; frame(n); });
    }
    return {
      load(newTea, id, autoplay) {
        tea = newTea; clipId = id; clip = buildClip(id, tea);
        t = 0; playing = !!autoplay;
        if (!autoplay) t = reduce || id === "prepare" ? clip.dur : 0;
        last = performance.now(); setRun(playing);
        opts.onState && opts.onState(playing);
        kick();
      },
      play() { if (!clip) return; if (t >= clip.dur) t = 0; playing = true; setRun(true); last = performance.now(); opts.onState && opts.onState(true); kick(); },
      pause() { playing = false; setRun(false); opts.onState && opts.onState(false); },
      toggle() { playing ? this.pause() : this.play(); },
      replay() { t = 0; this.play(); },
      seek(frac) { if (clip) { t = Math.max(0, Math.min(1, frac)) * clip.dur; kick(); } },
      setSpeed(v) { speed = v; },
      get playing() { return playing; },
      get duration() { return clip ? clip.dur : 0; },
      destroy() { cancelAnimationFrame(raf); }
    };
  }

  window.TeaStage = { createStage, buildClip };
})();
