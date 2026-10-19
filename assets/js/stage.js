/* 茶席特寫動畫：以 SVG 繪畫茶具，按關鍵幀時間軸演示每一步手法。 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  /* 器具擺位（舞台座標 800×500，原點為各器具底部中心）；L 為按單品圖錨點計算出的相對位置，見 applyKit()。 */
  /* 茶席擺位（對齊人物場景）：茶盤居中；蓋碗、公道杯分列茶盤中線兩側；三杯在茶盤前方的桌面（不在盤上）；水洗在右上；茶巾在右前 */
  const HOME = {
    kettle: { x: 66, y: 246 },
        gaiwan: { x: 338, y: 262 },
    glass: { x: 390, y: 262 },
    towel: { x: 66, y: 296 },
    pitcher: { x: 442, y: 262 },
    cups: [{ x: 318, y: 376 }, { x: 394, y: 376 }, { x: 470, y: 376 }],
    chahe: { x: 648, y: 414 },
    holder: { x: 764, y: 408 },
    wash: { x: 74, y: 370 },
    scoop: { x: 712, y: 482 },
    tray: { x: 390, y: 262 },
    trayRect: { x0: 129, x1: 652, y0: 204, y1: 326 }
  };

  const L = {
    kettleTip: { x: 93, y: -80 }, kettlePivot: { x: 0, y: -52 },
    gaiwanLip: { x: 58, y: -68 }, gaiwanLipL: { x: -58, y: -68 }, gaiwanRim: -68,
    pitcherTip: { x: 47, y: -106 }, pitcherTop: -100,
    wRim: { cx: 0, cy: -20, rx: 30, ry: 10 }, cupCx: 0, tbx0: -20, tbx1: 20, tPivot: { x: 18, y: -2 }, cupRim: -34, glassTop: -130, glassFloor: -4, glassH: 124, chaheTip: { x: 50, y: -4 }
  };
  const WATER = "#dfeef3";
  /* 乾茶粒形狀：[長半徑, 短半徑]；捲曲顆粒近圓，條索／扁葉狹長 */
  const DRY_LEAF = {
    green: [4.8, 1.3], white: [4.4, 1.4], yellow: [4.4, 1.4], oolong: [2.5, 2.1],
    black: [4.4, 1.2], shengpu: [4.8, 1.5], shoupu: [4.4, 1.5], jasmine: [4.2, 1.1]
  };

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

  /* 單調三次插值：經過中間關鍵幀時速度連貫，在停頓／折返處自然減速到零，動作不再一段一段起停 */
  function tangents(tr) {
    if (tr.some((k) => typeof k[1] !== "number")) return null;
    const n = tr.length, m = new Array(n).fill(0), h = [], d = [];
    for (let i = 0; i < n - 1; i++) { h[i] = tr[i + 1][0] - tr[i][0]; d[i] = h[i] > 1e-6 ? (tr[i + 1][1] - tr[i][1]) / h[i] : 0; }
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0 || h[i - 1] < 1e-6 || h[i] < 1e-6) continue;
      m[i] = (3 * (h[i - 1] + h[i])) / ((2 * h[i] + h[i - 1]) / d[i - 1] + (h[i] + 2 * h[i - 1]) / d[i]);
    }
    return m;
  }
  function hermite(v0, v1, m0, m1, h, u) {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * h * m1;
  }

  /* ---------- 時間軸 ---------- */
  class Clip {
    constructor(base) { this.base = base; this.tracks = {}; this.tan = {}; this.dur = 0; this.labels = []; }
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
        this.tan[n] = tangents(tr);
      }
      this.labels.sort((a, b) => a[0] - b[0]);
      const last = this.labels[this.labels.length - 1];
      if (last) this.dur = Math.max(this.dur, last[0] + Math.max(1.6, last[1].length * 0.13) - extra);
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
            const m = this.tan[n];
            if (typeof v0 !== "number" || typeof v1 !== "number") s[n] = v0;
            else if (!m || t1 - t0 < 1e-6) s[n] = lerp(v0, v1, ease((t - t0) / (t1 - t0 || 1)));
            else s[n] = hermite(v0, v1, m[i], m[i + 1], t1 - t0, (t - t0) / (t1 - t0));
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
      gx: 0, gy: 0, gr: 0, gLevel: 0, gTint: 0, gLeaves: 0, lid: 0, lidX: 0, lidR: 0, hd: 0, ph: 0, ch: 0,
      wx: 0, wy: 0, wr: 0, ws: 1, wLevel: 0, wTint: 0, wLeaves: 0, dance: 0,
      px: 0, py: 0, pr: 0, pLevel: 0, pTint: 1,
      u0: 0, u1: 0, u2: 0, tg: 0, tgi: 0, sC: 0, hp: 0, hpw: 0, c0: 0, c1: 0, c2: 0, cTint: 1, c1x: 0, c1y: 0, c1s: 1, c1r: 0, r0: 0, r1: 0, r2: 0, y0: 0, y1: 0, y2: 0, lidGap: 0, sW: 0,
      hx: 0, hy: 0, hr: 0, hs: 1, hLeaves: 0, fall: 0,
      tr: 0, gd: 1, sK: 0, sKTea: 0, sG: 0, sP: 0, sGTarget: "pitcher", pTarget: 0,
      cw: 0, cx: 400, cy: 250, cz: 1,
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
    return { x: target.x + 6 - (HOME.pitcher.x + tip.x), y: target.y - h - (HOME.pitcher.y + tip.y) };
  }
  const gaiwanTop = () => ({ x: HOME.gaiwan.x + L.gaiwanRimX, y: HOME.gaiwan.y + L.gaiwanRim });
  const glassTop = () => ({ x: HOME.glass.x + L.glassRimX, y: HOME.glass.y + L.glassTop });
  const pitcherTop = () => ({ x: HOME.pitcher.x + L.pitcherRimX, y: HOME.pitcher.y + L.pitcherTop });
  const cupTop = (i) => ({ x: HOME.cups[i].x, y: HOME.cups[i].y + L.cupRim });
  const washMouth = () => ({ x: HOME.wash.x + L.wRim.cx, y: HOME.wash.y + L.wRim.cy });
  const cupPivot = () => ({ x: L.cupCx, y: L.cupRim + 8 });
  /* 品茗杯傾側倒水：令右邊杯沿落在水洗口上方 h 處，回傳杯的位移 */
  function aimCupToWash(i, r, h) {
    const p = rot({ x: L.cupCx - L.cupRx * 0.95, y: L.cupRim }, cupPivot(), -r), m = washMouth();
    return { u: m.x + 4 - (HOME.cups[i].x + p.x), y: m.y - h - (HOME.cups[i].y + p.y) };
  }
  /* 玻璃杯傾側倒水：令最低的杯沿落在水洗口上方 h 處 */
  function aimGlassToWash(r, h, dx = 4) {
    const lo = [{ x: L.tbx0, y: L.glassTop }, { x: L.tbx1, y: L.glassTop }].map((p) => rot(p, L.tPivot, -r)).sort((a, b) => b.y - a.y)[0], m = washMouth();
    return { x: m.x + dx - (HOME.glass.x + lo.x), y: m.y - h - (HOME.glass.y + lo.y) };
  }

  function kettlePour(c, t0, target, o) {
    const r = (o.r || 38), h = o.h || 34, dur = o.dur || 2;
    const a = aimKettle(target, r, h), a0 = o.h0 !== undefined ? aimKettle(target, r, o.h0) : a;
    c.key("kx", t0, 0).key("ky", t0, 0).key("kr", t0, 0)
      .key("kx", t0 + 0.8, a.x).key("ky", t0 + 0.8, a0.y).key("kr", t0 + 0.8, r);
    if (o.h0 !== undefined) c.key("ky", t0 + 0.8 + Math.min(0.9, dur * 0.4), a.y);
    c
      .hold("sK", t0, t0 + 0.75, 0).key("sK", t0 + 0.95, 1).key("sK", t0 + 0.8 + dur, 1).key("sK", t0 + 1.0 + dur, 0);
    if (o.bob) {
      const step = dur / 6;
      for (let i = 0; i < 6; i++) c.key("ky", t0 + 0.8 + step * (i + 0.5), a.y + (i % 2 === 0 ? -46 : 0));
    }
    c.key("kx", t0 + 0.8 + dur, a.x).key("ky", t0 + 0.8 + dur, a.y).key("kr", t0 + 0.8 + dur, r)
      .key("kr", t0 + 1.5 + dur, 0).key("kx", t0 + 1.8 + dur, 0).key("ky", t0 + 1.8 + dur, 0);
    return t0 + 1.8 + dur;
  }
  function gaiwanPour(c, t0, target, dur, base, arc, dir) {
    const d = dir || 1, lip = d < 0 ? L.gaiwanLipL : L.gaiwanLip;
    const dx = target.x - (HOME.gaiwan.x + lip.x), dy = target.y - 20 - (HOME.gaiwan.y + lip.y);
    c.hold("gd", t0, t0 + 1.7 + dur, d).key("gd", t0 + 2.05 + dur, 1).key("gx", t0, 0).key("gy", t0, 0).key("gr", t0, 0);
    if (arc) c.key("gx", t0 + 0.35, dx * 0.45).key("gy", t0 + 0.35, Math.min(dy, 0) - arc).key("gr", t0 + 0.35, 6 * d);
    c.key("gx", t0 + 0.7, dx).key("gy", t0 + 0.7, dy).key("gr", t0 + 0.7, 18 * d)
      .key("gr", t0 + 1.1, 78 * d).hold("sG", t0, t0 + 0.95, 0).key("sG", t0 + 1.15, 1)
      .key("gr", t0 + 1.1 + dur, 92 * d).key("sG", t0 + 1.0 + dur, 1).key("sG", t0 + 1.2 + dur, 0)
      .key("gr", t0 + 1.6 + dur, 0).key("gx", t0 + 2.0 + dur, 0).key("gy", t0 + 2.0 + dur, 0)
      .key("gx", t0 + 1.3 + dur, dx).key("gy", t0 + 1.3 + dur, dy)
      .key("gx", t0 + 1.6 + dur, dx * 0.6).key("gy", t0 + 1.6 + dur, dy * 0.5);
    c.key("lidGap", t0 + 0.45, 0).key("lidGap", t0 + 0.8, 1).key("lidGap", t0 + 1.25 + dur, 1).key("lidGap", t0 + 1.5 + dur, 0);
    if (base) c.key("gLevel", t0 + 1.1, base).key("gLevel", t0 + 1.1 + dur, 0);
    return t0 + 2.0 + dur;
  }
  function pitcherPour(c, t0, i, dur, from, to, cupFrom, cupTo) {
    const r = [48, 56, 64, 72].find((rr) => pitchClear(i, rr) <= 20) || 72, a = aimPitcher(cupTop(i), r, pitchClear(i, r));
    c.key("px", t0, c.lastPx || 0).key("py", t0, c.lastPy || 0).key("pr", t0, c.lastPr || 0)
      .key("px", t0 + 0.6, a.x).key("py", t0 + 0.6, a.y).key("pr", t0 + 0.6, -22)
      .key("pr", t0 + 0.9, -r).key("pr", t0 + 0.9 + dur, -(r + 6)).key("pr", t0 + 1.2 + dur, -22)
      .key("px", t0 + 0.9 + dur, a.x).key("py", t0 + 0.9 + dur, a.y).key("py", t0 + 1.2 + dur, a.y - 34)
      .key("pTarget", t0, String(i))
      .hold("sP", t0, t0 + 0.85, 0).key("sP", t0 + 1.0, 1).key("sP", t0 + 0.85 + dur, 1).key("sP", t0 + 1.0 + dur, 0)
      .key("pLevel", t0 + 0.9, from).key("pLevel", t0 + 0.9 + dur, to)
      .key("c" + i, t0 + 0.95, cupFrom).key("c" + i, t0 + 0.95 + dur, cupTo);
    c.lastPx = a.x; c.lastPy = a.y - 34; c.lastPr = -22;
    return t0 + 1.2 + dur;
  }
  /* 低斟：由低至高找出公道杯杯身不碰同一排品茗杯的最低高度（嘴離杯口約 1–2 cm 起）；前後排只是遮擋，不算相碰 */
  function pitchClear(i, r) {
    if (!L.pPoly) return 44; // 單品圖未載入前的暫用值；載入後會重建時間軸
    const rx = L.cupRx;
    for (let h = 10; h < 90; h += 2) {
      const a = aimPitcher(cupTop(i), r, h);
      const hit = L.pPoly.some((p) => {
        const q = rot(p, L.pitcherTip, -r), x = HOME.pitcher.x + a.x + q.x, y = HOME.pitcher.y + a.y + q.y;
        return HOME.cups.some((cp) => Math.abs(cp.y - HOME.cups[i].y) < 6 && Math.abs(x - cp.x) < rx + 3 && y > cp.y + L.cupRim - 3);
      });
      if (!hit) return h;
    }
    return 90;
  }
  const aimGaiwan = (target, h) => ({ x: target.x - (HOME.gaiwan.x + L.gaiwanLip.x), y: target.y - h - (HOME.gaiwan.y + L.gaiwanLip.y) });
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
      prepare: { lid: 1 }, warm: {}, view: { lid: 1 }, add: { hLeaves: 1 }, smell: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.25 } : { gLeaves: 1, lid: 1 },
      rinse: { gLeaves: 1 }, brew: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.25 } : { gLeaves: 1 },
      pour: { gLeaves: 1, gLevel: 0.8, gTint: 1, lid: 1 },
      share: { gLeaves: 1, pLevel: 0.82, lid: 1 },
      serve: glass ? { wLeaves: 1, wLevel: 0.72, wTint: 1, dance: 1, temp: 0 } : { gLeaves: 1, pLevel: 0.12, c0: 0.7, c1: 0.7, c2: 0.7, temp: 0, lid: 1 },
      taste: glass ? { wLeaves: 1, wLevel: 0.72, wTint: 1, wx: -10, wy: 52, ws: 1.2, dance: 1, temp: 0 } : { gLeaves: 1, pLevel: 0.12, c0: 0.7, c1: 0.7, c2: 0.7, c1x: 30, c1y: 80, c1s: 1.12, temp: 0, lid: 1 },
      again: glass ? { wLeaves: 1, wLevel: 0.3, wTint: 0.9, dance: 1 } : { gLeaves: 1, lid: 0 }
    };
    Object.assign(b, preset[id] || {});
    const c = new Clip(b);
    const gTarget = (lvl) => ({ x: gaiwanTop().x, y: gaiwanTop().y + (1 - lvl) * 10 });
    const gWall = () => ({ x: gaiwanTop().x - 17, y: gaiwanTop().y + 4 });
    const wTarget = (lvl) => ({ x: glassTop().x, y: HOME.glass.y + L.glassFloor - lvl * L.glassH });

    switch (id) {
      case "prepare":
        c.key("show", 0, 0).key("show", 2.6, 1).label(0, "淨手・擺具・煮水").label(2.8, `今日水溫 ${temp}`);
        c.key("temp", 0, 0).key("temp", 2.8, 0).key("temp", 3.4, 1).key("temp", 4.6, 1);
        break;
      case "warm":
        if (glass) {
          c.label(0, "注入約三分一熱水");
          let t = kettlePour(c, 0.2, glassTop(), { r: 34, h: 16, dur: 1.6 });
          c.key("wLevel", 1.1, 0).key("wLevel", 2.6, 0.3);
          c.label(t, "轉動杯身，令杯壁受熱");
          c.key("wr", t, 0).key("wr", t + 0.4, -8).key("wr", t + 0.8, 8).key("wr", t + 1.2, -8).key("wr", t + 1.6, 0);
          t += 1.8;
          const GR = 105, ga = aimGlassToWash(GR, 3, 8);
          c.label(t, "提杯傾側，把溫杯水倒入水洗").key("wr", t, 0).key("wy", t, 0).key("wx", t, 0).key("wy", t + 0.6, -54).key("wx", t + 0.6, ga.x * 0.6)
            .key("wx", t + 1.5, ga.x).key("wy", t + 1.5, ga.y).key("wr", t + 1.5, -GR)
            .key("wLevel", t + 1.6, 0.3).key("wLevel", t + 2.5, 0).hold("sW", t, t + 1.5, 0).key("sW", t + 1.7, 1).key("sW", t + 2.4, 1).key("sW", t + 2.6, 0)
            .key("wx", t + 2.7, ga.x).key("wy", t + 2.7, ga.y).key("wr", t + 2.7, -GR).key("wr", t + 3.3, 0).key("wx", t + 3.5, 0).key("wy", t + 3.5, 0);
        } else {
          c.label(0, "沸水注入蓋碗").key("lid", 0, 1).key("lid", 0.5, 0);
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
          c.label(t, "從茶道組取出茶夾");
          const F = 0.68, step = 4.9 * F, t1 = t + 0.1 + 3 * step;
          c.key("tr", t, 0).key("tr", t + 0.8, 1).hold("tr", t + 0.8, t1 - 0.2, 1).key("tr", t1 + 0.8, 0);
          [0, 1, 2].forEach((i) => {
            const u = t + 0.9 + i * step, a = aimCupToWash(i, 105, 12);
            c.label(u, i === 0 ? "茶夾夾住杯沿，提起品茗杯" : "再夾第 " + (i + 1) + " 隻杯").label(u + 0.95, "轉動杯身，令杯壁均勻受熱").label(u + 2.04, "傾杯，把水倒入水洗");
            c.hold("tgi", u - 0.2, u + 2.72, i)
              .key("tg", u, 0).key("tg", u + 0.34, 1).key("tg", u + 2.99, 1).key("tg", u + 3.20, 0)
              .key("u" + i, u + 0.34, 0).key("y" + i, u + 0.34, 0).key("r" + i, u + 0.34, 0)
              .key("y" + i, u + 0.68, -26)
              .key("r" + i, u + 0.82, 0).key("r" + i, u + 1.02, -16).key("r" + i, u + 1.26, 16).key("r" + i, u + 1.50, -16).key("r" + i, u + 1.70, 0)
              .key("u" + i, u + 1.70, 0).key("y" + i, u + 1.70, -26)
              .key("u" + i, u + 2.24, a.u).key("y" + i, u + 2.24, a.y).key("r" + i, u + 2.24, -105)
              .hold("sC", u, u + 2.24, 0).key("sC", u + 2.38, 1).key("sC", u + 2.69, 1).key("sC", u + 2.82, 0)
              .key("c" + i, u + 2.31, 0.6).key("c" + i, u + 2.79, 0)
              .key("u" + i, u + 2.86, a.u).key("y" + i, u + 2.86, a.y).key("r" + i, u + 2.86, -105)
              .key("u" + i, u + 2.99, 0).key("y" + i, u + 2.99, -10).key("r" + i, u + 2.99, 0)
              .key("y" + i, u + 3.20, 0);
          });
        }
        break;
      case "view":
        c.label(0, "以茶則取茶，放入茶荷").key("hLeaves", 0.3, 0).key("hLeaves", 1.6, 1);
        c.label(1.9, "雙手捧茶荷，請客人賞茶");
        c.key("hx", 1.8, 0).key("hy", 1.8, 0).key("hs", 1.8, 1).key("hx", 2.8, -250).key("hy", 2.8, 56).key("hs", 2.8, 1.6)
          .key("hr", 3.2, -4).key("hr", 3.8, 4).key("hr", 4.3, 0)
          .key("hx", 4.6, -250).key("hy", 4.6, 56).key("hs", 4.6, 1.6).key("hx", 5.5, 0).key("hy", 5.5, 0).key("hs", 5.5, 1);
        c.label(4.6, `${tea.sample}・${tea.family}`);
        break;
      case "add": {
        const tgt = glass ? glassTop() : gaiwanTop();
        if (glass) {
          c.label(0, "中投法：先注三分一水");
          kettlePour(c, 0, glassTop(), { r: 34, h: 14, dur: 1.4 });
          c.key("wLevel", 0.9, 0).key("wLevel", 2.2, 0.3);
        }
        const t0 = glass ? 3.2 : 0.2;
        if (!glass) c.key("lid", 0, 1).key("lid", 0.5, 0);
        const hx = tgt.x + 12 - (HOME.chahe.x + L.chaheTip.x), hy = tgt.y - 5 - (HOME.chahe.y + L.chaheTip.y);
        c.label(t0, glass ? "茶荷移至杯口上方，以茶撥將茶葉撥入杯中" : "茶荷移至碗口上方，以茶撥將茶葉輕輕撥入碗中");
        c.key("hp", t0 + 0.7, 0).key("hp", t0 + 1.2, 1).key("hpw", t0 + 1.2, 0).key("hpw", t0 + 2.9, 1).key("hp", t0 + 3.0, 1).key("hp", t0 + 3.5, 0);
        c.key("hx", t0, 0).key("hy", t0, 0).key("hr", t0, 0).key("hx", t0 + 0.9, hx).key("hy", t0 + 0.9, hy).key("hr", t0 + 0.9, 0)
          .key("hr", t0 + 1.3, -36).key("fall", t0 + 1.2, 0).key("fall", t0 + 2.9, 1)
          .key("hLeaves", t0 + 1.2, 1).key("hLeaves", t0 + 2.8, 0).key(glass ? "wLeaves" : "gLeaves", t0 + 1.5, 0).key(glass ? "wLeaves" : "gLeaves", t0 + 2.9, 1)
          .key("hr", t0 + 3.0, -36).key("hr", t0 + 3.4, 0).key("hx", t0 + 3.0, hx).key("hy", t0 + 3.0, hy).key("hx", t0 + 4.0, 0).key("hy", t0 + 4.0, 0);
        c.key("cw", t0 - 0.2, 0).key("cw", t0 + 0.6, 1).key("cw", t0 + 4.2, 1).key("cw", t0 + 5.0, 0)
          .key("cx", 0, (HOME.chahe.x + tgt.x) / 2).key("cy", 0, (HOME.chahe.y + tgt.y) / 2 - 48).key("cz", 0, 1.35);
        if (glass) {
          c.label(t0 + 4.0, "輕搖杯身，令茶葉吸水舒展").key("wTint", t0 + 3.0, 0).key("wTint", t0 + 5.4, 0.25)
            .key("wr", t0 + 4.1, 0).key("wr", t0 + 4.5, -7).key("wr", t0 + 4.9, 7).key("wr", t0 + 5.3, 0);
        } else {
          c.label(t0 + 4.0, "蓋上碗蓋").key("lid", t0 + 3.8, 0).key("lid", t0 + 4.4, 1);
        }
        break;
      }
      case "rinse": {
        const secs = tea.rinse ? tea.rinse.secs : 5;
        c.label(0, "沿碗邊注水，浸過茶葉即可");
        if (!glass) c.key("lid", 0, 1).key("lid", 0.5, 0);
        let t = kettlePour(c, 0.1, { x: gaiwanTop().x - 30, y: gaiwanTop().y + 6 }, { r: 34, h: 26, dur: 1.2 });
        c.key("gLevel", 1.0, 0).key("gLevel", 2.1, 0.5).key("gTint", 1.0, 0).key("gTint", 3.4, 0.35);
        c.key("lid", 2.3, 0).key("lid", 2.9, 1);
        c.label(t - 0.6, `約 ${secs} 秒`).key("timer", t - 0.6, 0).key("timer", t + 0.9, 1).key("timerText", t - 0.6, `${secs}秒`).key("timer", t + 1.0, 0);
        c.label(t + 1.0, "倒出潤茶湯，廢水倒入水洗");
        gaiwanPour(c, t + 1.0, washMouth(), 0.9, 0.5, 60, -1);
        c.key("sGTarget", t + 1.0, "wash");
        break;
      }
      case "brew":
        if (glass) {
          c.label(0, `鳳凰三點頭・注至七分滿・${temp}`);
          kettlePour(c, 0.1, glassTop(), { r: 36, h: 40, dur: 3.2, bob: true });
          c.key("wLevel", 1.0, 0.3).key("wLevel", 4.2, 0.72).key("wTint", 1.0, 0.25).key("wTint", 6.4, 1)
            .key("dance", 0.9, 0).key("dance", 2.4, 1);
          c.label(5.0, "茶葉上下翻動，靜待舒展");
        } else {
          c.label(0, `沿碗壁懸壺高沖・${temp}`);
          c.key("lid", 0, 1).key("lid", 0.5, 0);
          let t = kettlePour(c, 0.1, gWall(), { r: 40, h0: 20, h: 86, dur: 1.9 });
          c.key("gLevel", 1.0, 0).key("gLevel", 2.8, 0.8).key("gTint", 1.0, 0).key("gTint", 5.6, 1);
          c.label(t - 0.4, "用碗蓋輕刮浮沫").key("lid", t - 0.4, 0).key("lid", t + 0.2, 1)
            .key("lidX", t + 0.2, 0).key("lidR", t + 0.2, 0).key("lidX", t + 0.5, -12).key("lidR", t + 0.5, -10)
            .key("lidX", t + 1.1, 14).key("lidR", t + 1.1, -10).key("lidX", t + 1.5, 0).key("lidR", t + 1.5, 0);
          c.label(t + 1.6, `第一泡 約 ${tea.steeps.first} 秒`).key("timer", t + 1.6, 0).key("timer", t + 3.4, 1).key("timerText", t + 1.6, `${tea.steeps.first}秒`).key("timer", t + 3.5, 0);
        }
        break;
      case "pour":
        c.label(0, "三指法：拇指中指扣碗沿，食指按蓋鈕");
        { const te = gaiwanPour(c, 0.6, pitcherTop(), 2.6, 0.8);
          c.key("hd", 0.45, 0).key("hd", 0.85, 1).key("hd", 0.6 + 1.7 + 2.6, 1).key("hd", te - 0.2, 0); }
        c.key("pTint", 0, 1).key("pLevel", 2.0, 0).key("pLevel", 4.2, 0.82);
        c.label(2.0, "留一道縫出湯，茶葉留在碗內").label(4.4, "最後幾滴也要瀝乾");
        c.key("drop", 4.4, 0).key("drop", 5.0, 0.999).key("drop", 5.01, 0).key("dropTarget", 0, "pitcher");
        c.key("cw", 0, 0).key("cw", 0.7, 1).key("cw", 5.0, 1).key("cw", 5.7, 0).key("cx", 0, 392).key("cy", 0, 204).key("cz", 0, 1.75);
        break;
      case "share": {
        c.label(0, "公道杯分茶・低斟");
        let t = pitcherPour(c, 0.1, 0, 0.8, 0.82, 0.55, 0, 0.7);
        t = pitcherPour(c, t - 0.3, 1, 0.8, 0.55, 0.3, 0, 0.7);
        c.label(t - 0.6, "每杯七分滿，濃淡一致");
        t = pitcherPour(c, t - 0.3, 2, 0.8, 0.3, 0.06, 0, 0.7);
        t = pitcherHome(c, t);
        c.key("ph", 0, 0).key("ph", 0.5, 1).key("ph", t - 0.5, 1).key("ph", t - 0.1, 0);
        c.key("cw", 0, 0).key("cw", 0.6, 1).key("cw", t - 0.4, 1).key("cw", t + 0.4, 0).key("cx", 0, 400).key("cy", 0, 330).key("cz", 0, 1.6);
        break;
      }
      case "serve":
        if (glass) {
          c.label(0, "雙手奉茶：一手托底，一手輕扶");
          c.key("wx", 0.3, 0).key("wy", 0.3, 0).key("ws", 0.3, 1).key("wy", 0.8, -8).key("wx", 1.8, -10).key("wy", 1.8, 52).key("ws", 1.8, 1.2);
          c.label(2.2, "請用茶").key("steamCup", 0, 0).key("steamCup", 2, 1);
        } else {
          c.label(0, "雙手托杯，奉到客人面前");
          c.key("c1x", 0.4, 0).key("c1y", 0.4, 0).key("c1s", 0.4, 1).key("c1y", 1.1, -14).key("c1y", 1.5, -14).key("c1x", 3.2, 30).key("c1y", 3.2, 72).key("c1s", 3.2, 1.12)
            .key("c1y", 3.55, 82).key("c1y", 3.8, 80).key("c1x", 3.8, 30).key("c1s", 3.8, 1.12);
          c.key("ch", 0.2, 0).key("ch", 0.6, 1).key("ch", 3.9, 1).key("ch", 4.4, 0);
          c.label(3.3, "輕放在客人右前方：「請用茶」").key("steamCup", 0, 0).key("steamCup", 3.4, 1);
          c.label(4.8, "客人以「叩指禮」回禮").key("steamCup", 6.4, 1);
          c.key("cw", 0, 0).key("cw", 0.6, 1).key("cw", 6.0, 1).key("cw", 6.6, 0).key("cx", 0, 410).key("cy", 0, 330).key("cz", 0, 1.6);
        }
        break;
      case "smell":
        if (glass) {
          c.label(0, "雙手捧杯，輕搖令茶葉吸水").key("wr", 0.3, 0).key("wr", 0.7, -7).key("wr", 1.1, 7).key("wr", 1.5, 0);
          c.label(2.0, "杯口移近鼻端，深吸一口熱香").key("wx", 1.8, 0).key("wy", 1.8, 0).key("ws", 1.8, 1).key("wx", 2.8, -16).key("wy", 2.8, -70).key("wr", 2.8, 0).key("ws", 2.8, 1.18).key("wr", 3.4, -12).key("wx", 5.2, -16).key("wy", 5.2, -70).key("wr", 5.2, -12).key("ws", 5.2, 1.18).key("wr", 5.8, 0).key("wx", 6.0, 0).key("wy", 6.0, 0).key("ws", 6.0, 1);
          c.key("steamCup", 2.8, 1);
          c.label(5.4, "聞茶葉受熱後散發的香氣");
        } else {
          c.label(0, "蓋上碗蓋，輕搖數下").key("lid", 0, 1).key("gr", 0.4, 0).key("gr", 0.8, -6).key("gr", 1.2, 6).key("gr", 1.6, -6).key("gr", 2.0, 0);
          c.label(2.2, "碗蓋稍移開一道縫，聞蓋上乾香").key("lidGap", 2.2, 0).key("lidGap", 2.8, 1).key("lidGap", 5.2, 1).key("lidGap", 5.8, 0);
          c.key("gy", 2.2, 0).key("gy", 2.9, -14).key("gy", 5.2, -14).key("gy", 5.9, 0);
          c.label(5.4, "乾香、熱香，各有不同");
        }
        break;
      case "taste": {
        const lv = glass ? "wLevel" : "c1";
        const v0 = 0.72;
        c.key("steamCup", 0, 1).label(0, "一看湯色：清澈明亮");
        c.label(1.8, glass ? "二聞茶香：近杯口聞熱香" : "二聞茶香：趁熱聞湯面香氣");
        c.label(3.8, "三口品茗：小口啜飲，細品滋味");
        [0, 1, 2].forEach((i) => {
          const t = 4.0 + i * 1.1;
          c.key("sip", t, 0).key("sip", t + 0.35, 1).key("sip", t + 0.75, 0).key("c1r", t, 0).key("c1r", t + 0.35, -(16 + i * 7)).key("c1r", t + 0.75, 0).key(lv, t + 0.2, v0 - i * (glass ? 0.12 : 0.22)).key(lv, t + 0.6, v0 - (i + 1) * (glass ? 0.12 : 0.22));
        });
        c.label(7.6, glass ? "回甘生津，細味餘香" : "飲後聞杯底留香，回甘生津");
        break;
      }
      case "again":
        if (glass) {
          c.label(0, "杯中剩三分一時續水");
          kettlePour(c, 0.2, glassTop(), { r: 36, h: 24, dur: 2.0 });
          c.key("wLevel", 1.1, 0.3).key("wLevel", 3.0, 0.72);
          c.label(4.2, `可續 ${tea.infusions}`);
        } else {
          c.label(0, "第二泡：按茶湯濃淡酌量加時");
          c.key("lid", 0, 1).key("lid", 0.5, 0);
          let t = kettlePour(c, 0.1, gWall(), { r: 40, h0: 20, h: 70, dur: 1.6 });
          c.key("gLevel", 1.0, 0).key("gLevel", 2.5, 0.8).key("gTint", 1.0, 0).key("gTint", 4.4, 1).key("lid", t - 0.3, 0).key("lid", t + 0.2, 1);
          c.label(t + 0.3, `本示範第二泡約 ${tea.steeps.first + tea.steeps.add} 秒・可續泡數次`).key("timer", t + 0.3, 0).key("timer", t + 2.0, 1)
            .key("timerText", t + 0.3, `${tea.steeps.first + tea.steeps.add}秒`).key("timer", t + 2.1, 0);
        }
        break;
      case "phoenix":
        c.label(0, "手腕上下提拉三次").key("wLevel", 0, 0.3).key("wLeaves", 0, 1).key("wTint", 0, 0.3);
        kettlePour(c, 0.1, glassTop(), { r: 36, h: 40, dur: 3.2, bob: true });
        c.key("wLevel", 1.0, 0.3).key("wLevel", 4.2, 0.72).key("wTint", 4.2, 0.9).key("dance", 0.9, 0).key("dance", 2.4, 1);
        c.label(4.6, "茶葉翻動，濃淡均勻");
        break;
      case "patrol": {
        c.label(0, "蓋甌低懸杯上，來回巡斟");
        Object.assign(b, { gLevel: 0.9, gTint: 1, gLeaves: 1, lid: 1, pLevel: 0, sGTarget: "cup" });
        // 出水口離杯口約 1–2 cm，連續移動巡斟三輪，每輪各杯加一點，濃淡一致
        const H = 11, R0 = 80;
        const at = (i) => aimGaiwan(cupTop(i), H);
        const order = [0, 1, 2, 2, 1, 0, 0, 1, 2];
        let t = 0.1, lvl = 0.9;
        const lv = [0, 0, 0];
        const p0 = at(0);
        c.key("gx", t, 0).key("gy", t, 0).key("gr", t, 0).key("gx", t + 0.6, p0.x).key("gy", t + 0.6, p0.y).key("gr", t + 0.6, R0 - 30)
          .key("gr", t + 0.85, R0).key("lidGap", t + 0.4, 0).key("lidGap", t + 0.7, 1).hold("sG", t, t + 0.8, 0).key("sG", t + 0.92, 1);
        t += 0.85;
        order.forEach((i, k) => {
          const p = at(i), dwell = 0.42, move = k === 0 ? 0 : 0.22;
          if (move) c.key("sG", t, 1).key("sG", t + move * 0.5, 0.35).key("sG", t + move, 1);
          c.key("gx", t + move, p.x).key("gy", t + move, p.y).key("pTarget", t + move * 0.5, String(i))
            .key("gr", t + move, R0 + k * 1.5).key("gr", t + move + dwell, R0 + k * 1.5 + 1);
          const to = Math.min(0.72, lv[i] + 0.24);
          c.key("c" + i, t + move + 0.05, lv[i]).key("c" + i, t + move + dwell, to);
          c.key("gLevel", t + move, lvl).key("gLevel", t + move + dwell, lvl - 0.09);
          lv[i] = to; lvl -= 0.09; t += move + dwell;
        });
        c.key("sG", t, 1).key("sG", t + 0.15, 0).key("gr", t + 0.1, R0 + 14).key("gr", t + 0.45, R0 - 40).key("lidGap", t + 0.3, 1).key("lidGap", t + 0.6, 0);
        c.label(t - 2.4, "每杯輪流添斟，濃淡一致");
        c.lastGx = at(2).x; c.lastGy = at(2).y; c.lastGr = R0 - 40;
        gaiwanHome(c, t + 0.45);
        break;
      }
      case "points": {
        c.label(0, "最後幾滴濃湯，逐杯點入");
        Object.assign(b, { gLevel: 0.05, gTint: 1, gLeaves: 1, lid: 1, lidGap: 1, pLevel: 0, sGTarget: "cup", c0: 0.66, c1: 0.66, c2: 0.66 });
        let t = 0.1;
        [0, 1, 2].forEach((i) => {
          const a = aimGaiwan(cupTop(i), 9);
          c.key("gx", t, c.lastGx || 0).key("gy", t, c.lastGy || 0).key("gr", t, c.lastGr || 0)
            .key("gx", t + 0.6, a.x).key("gy", t + 0.6, a.y).key("gr", t + 0.6, 112).key("pTarget", t, String(i))
            .key("drop", t + 0.7, 0).key("drop", t + 1.5, 0.999).key("drop", t + 1.51, 0).key("dropTarget", t, "gcup" + i)
            .key("c" + i, t + 0.9, 0.66).key("c" + i, t + 1.5, 0.72);
          c.lastGx = a.x; c.lastGy = a.y - 6; c.lastGr = 112;
          t += 1.6;
        });
        gaiwanHome(c, t);
        c.key("lidGap", t + 0.4, 1).key("lidGap", t + 0.7, 0);
        break;
      }
    }
    return c.finish();
  }

  /* ---------- 單品圖版面 ---------- */
  const KIT = window.TEA_KIT;
  const IMG = "assets/img/kit/";
  const PHAND = { R: 453, I: 443 }, CHAND = { R: 469, I: 464 };
  const PARTS = ["bowl", "saucer", "lid", "cup", "kettle", "stove", "chahe", "towel", "pitcher", "tumbler", "holder", "wash", "tongs", "pick", "scoop", "gclosed"];
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
      setTimeout(res, 8000);
      i.src = u;
    })));
    return loaded[style];
  }

  /* 按單品圖尺寸與錨點，算出各器具圖片位置及動畫用的相對座標 */
  function geometry(style) {
    const A = KIT.A[style], S = KIT.sizes[style], W = KIT.W;
    const g = {};
    PARTS.forEach((n) => {
      const [w, h] = S[n], s = ((KIT.WS && KIT.WS[style] && KIT.WS[style][n]) || W[n]) / w, b = A[n].base || [0.5, 1];
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
    // 水洗口
    const wa = A.wash.rim;
    q.wRim = { cx: g.wash.x + wa[0] * g.wash.w, cy: g.wash.y + wa[1] * g.wash.h, rx: wa[2] * g.wash.w, ry: wa[3] * g.wash.h };
    return q;
  }

  function applyKit(q, style) {
    const o = KIT.home && KIT.home[style];
    if (o) for (const k in o) { if (k === "cups") o.cups.forEach((c, i) => Object.assign(HOME.cups[i], c)); else Object.assign(HOME[k], o[k]); }
    L.kettleTip = q.kettleTip; L.kettlePivot = q.kettlePivot;
    L.gaiwanLip = q.bowlLip; L.gaiwanLipL = { x: 2 * q.bowlRim.cx - q.bowlLip.x, y: q.bowlLip.y }; L.gaiwanRim = q.bowlRim.cy; L.gaiwanRimX = q.bowlRim.cx;
    L.pitcherTip = q.pTip; L.pitcherTop = q.pRim.cy; L.pitcherRimX = q.pRim.cx;
    L.pFloor = q.pFloor; L.pH = q.pFloor - q.pTop;
    L.cupRim = q.cRim.cy; L.cupRx = q.cRim.rx; L.pPoly = q.pPoly;
    L.glassTop = q.tRim.cy; L.glassFloor = q.tFloor; L.glassH = q.tFloor - q.tTop; L.glassRimX = q.tRim.cx;
    L.chaheTip = q.chTip;
    L.wRim = q.wRim; L.cupCx = q.cRim.cx;
    L.tbx0 = Math.min(...q.tPoly.map((p) => p.x)); L.tbx1 = Math.max(...q.tPoly.map((p) => p.x)); L.tPivot = { x: L.tbx0 * 0.9, y: -2 };
    L.tongsTip = q.g.tongs.h ? { x: 0, y: q.g.tongs.y + (KIT.A[style].tongs.tip[1]) * q.g.tongs.h } : { x: 0, y: 0 };
  }

  /* ---------- 繪畫 ---------- */
  const SVG_DEFS = `
  <defs>
    <radialGradient id="tb-sh"><stop offset="0" stop-color="#0e0603" stop-opacity=".55"/><stop offset=".55" stop-color="#0e0603" stop-opacity=".26"/><stop offset="1" stop-color="#0e0603" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-steam"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="tb-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#140a05" stop-opacity="0"/><stop offset="1" stop-color="#140a05" stop-opacity=".5"/></radialGradient>
    <linearGradient id="tb-sun" x1="1" y1="0" x2="0" y2=".7"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".22"/><stop offset=".6" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
    <linearGradient id="tb-lqdepth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe8" stop-opacity=".34"/><stop offset=".3" stop-color="#fff2c4" stop-opacity=".05"/><stop offset=".72" stop-color="#d4760f" stop-opacity=".16"/><stop offset="1" stop-color="#8a3a05" stop-opacity=".34"/></linearGradient>
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
    R.holder = el("g", { transform: `translate(${HOME.holder.x},${HOME.holder.y})` }, R.layer);
    shadow(R.holder, 20, 5); img(R.holder, "holder");
    R.towel = el("g", { transform: `translate(${HOME.towel.x},${HOME.towel.y})` }, R.layer);
    shadow(R.towel, 46, 9); img(R.towel, "towel");
    // 水洗（右上）、茶席插花（左前）
    R.wash = el("g", { transform: `translate(${HOME.wash.x},${HOME.wash.y})` }, R.layer);
    shadow(R.wash, 46, 9); img(R.wash, "wash");
    R.scoop = el("g", { transform: `translate(${HOME.scoop.x},${HOME.scoop.y}) rotate(-4)` }, R.layer);
    shadow(R.scoop, 28, 3); img(R.scoop, "scoop");

    // 蓋碗
    R.saucer = el("g", {}, R.layer);
    shadow(R.saucer, 56, 11); img(R.saucer, "saucer");
    R.gClosed = el("g", {}, R.layer);
    img(R.gClosed, "gclosed");
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
    R.lidImg = el("image", { href: href("lid"), x: q.lidOff.x, y: q.lidOff.y, width: g.lid.w, height: g.lid.h }, R.lid);
    // 合蓋時碗蓋坐入碗口：碗身前緣（內緣前弧以下）再疊一層，遮住蓋沿
    const fx = br.rx * 0.965, fy = br.ry * 0.8, fid = "tbc" + (++clipSeq);
    el("path", { d: `M${br.cx - fx - 30} ${br.cy}L${br.cx - fx} ${br.cy}A${fx} ${fy} 0 0 0 ${br.cx + fx} ${br.cy}L${br.cx + fx + 30} ${br.cy}L${br.cx + fx + 30} ${br.cy + 300}L${br.cx - fx - 30} ${br.cy + 300}Z` }, el("clipPath", { id: fid }, defs));
    R.gFront = img(R.gBowl, "bowl", q.bowlOff.x, q.bowlOff.y);
    R.gFront.setAttribute("clip-path", `url(#${fid})`);
    // 三指握碗：整件圖（碗＋留縫的蓋＋右手），疊在碗身上隨碗傾斜；以碗圖為基準對位
    {
      const sz = KIT.sizes[style].ghand, sb = g.bowl.w / (sz[0] - 200);
      R.gHand = el("image", { href: href("ghand"), x: g.bowl.x + q.bowlOff.x - 100 * sb, y: g.bowl.y + q.bowlOff.y - 140 * sb, width: sz[0] * sb, height: sz[1] * sb }, R.gBowl);
      R.gBowlParts = Array.from(R.gBowl.children).filter((n) => n !== R.gHand);
    }

    // 玻璃杯（茶湯在玻璃後面，玻璃高光疊在上面）
    R.glass = el("g", {}, R.layer);
    R.glassShadow = shadow(R.glass, 34, 7);
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
    const pcx = q.pPoly.reduce((a, p) => a + p.x, 0) / q.pPoly.length, pcy = q.pPoly.reduce((a, p) => a + p.y, 0) / q.pPoly.length;
    const pClip = clipPoly(defs, q.pPoly.map((p) => ({ x: pcx + (p.x - pcx) * 1.05, y: pcy + (p.y - pcy) * 1.03 })));
    const pIn = el("g", { "clip-path": `url(#${pClip})` }, R.pBody);
    const px0 = Math.min(...q.pPoly.map((p) => p.x)), px1 = Math.max(...q.pPoly.map((p) => p.x));
    R.pb = { x0: px0, x1: px1 };
    R.pLiquid = el("rect", { x: px0 - 4, y: 0, width: px1 - px0 + 8, height: 200 }, pIn);
    R.pLiquidDepth = el("rect", { x: px0 - 4, y: 0, width: px1 - px0 + 8, height: 200, fill: "url(#tb-lqdepth)" }, pIn);
    R.pSurface = el("ellipse", { cx: (px0 + px1) / 2, cy: 0, rx: (px1 - px0) / 2 * 0.97, ry: (px1 - px0) / 2 * 0.17, fill: "#fff", "fill-opacity": 0.16, stroke: "#fff", "stroke-opacity": 0.55, "stroke-width": 0.9 }, pIn);
    R.pImg = img(R.pBody, "pitcher");
    {
      const sp = g.pitcher.w / 324, ph = PHAND[style];
      R.pHand = el("image", { href: href("phand"), x: g.pitcher.x - 60 * sp, y: g.pitcher.y - 120 * sp, width: 644 * sp, height: ph * sp }, R.pBody);
      R.pHand.style.display = "none";
    }

    // 品茗杯
    const cr = q.cRim;
    HOME.cups.forEach((c) => {
      const sg = el("g", { transform: `translate(${c.x},${c.y})` }, R.layer);
      el("ellipse", { cx: 0, cy: 3, rx: 37, ry: 11, fill: "#000", opacity: 0.28 }, sg);
      el("ellipse", { cx: 0, cy: 0, rx: 35, ry: 10.5, fill: "#34302d" }, sg);
      el("ellipse", { cx: 0, cy: -0.8, rx: 26, ry: 7, fill: "#45403b" }, sg);
      el("ellipse", { cx: 0, cy: -1.4, rx: 35, ry: 10.5, fill: "none", stroke: "#8a8178", "stroke-opacity": 0.55, "stroke-width": 0.8 }, sg);
    });
    R.cups = HOME.cups.map(() => {
      const gr = el("g", {}, R.layer);
      const sh = shadow(gr, 30, 6);
      const cImg = img(gr, "cup");
      const sc = g.cup.w / 255;
      const cHand = el("image", { href: href("chand"), x: g.cup.x - 100 * sc, y: g.cup.y - 100 * sc, width: 455 * sc, height: CHAND[style] * sc }, gr);
      cHand.style.display = "none";
      const cid = clipEllipse(defs, { cx: cr.cx, cy: cr.cy + 0.5, rx: cr.rx * 0.97, ry: cr.ry * 0.9 });
      const ci = el("g", { "clip-path": `url(#${cid})` }, gr);
      const liq = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82 }, ci);
      const depth = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82, fill: "url(#tb-lqdepth)" }, ci);
      const hi = el("ellipse", { cx: cr.cx, cy: cr.cy, rx: cr.rx * 0.9, ry: cr.ry * 0.82, fill: "url(#tb-lqhi)" }, ci);
      return { g: gr, sh, liq, depth, hi, cImg, cHand };
    });

    HOME.cups.map((c, i) => [c.y, i]).sort((a, b) => a[0] - b[0]).forEach(([, i]) => R.layer.appendChild(R.cups[i].g));
    R.pitcherNext = R.pitcher.nextSibling; R.gaiwanNext = R.gaiwan.nextSibling;

    // 茶荷
    R.chahe = el("g", {}, R.layer);
    R.chaheShadow = shadow(R.chahe, 44, 9);
    R.chaheBody = el("g", {}, R.chahe);
    img(R.chaheBody, "chahe");
    const pw = q.chPile.w;
    R.hPile = el("image", { preserveAspectRatio: "xMidYMax meet", href: href("dry-green"), x: q.chPile.x - pw / 2, y: q.chPile.y - pw * 0.30, width: pw, height: pw * 0.66 }, R.chaheBody);
    // 茶撥：平時橫放在茶荷上，撥茶時抬起
    R.pick = el("g", {}, R.chahe);
    img(R.pick, "pick");

    // 茶夾：平時橫放在杯前，溫杯時夾住品茗杯
    R.tongs = el("g", {}, R.layer);
    {
      // 兩支夾臂分開裁切，繞尾端連接處轉動，做出開合
      const t = g.tongs, my = t.y + t.h * 0.5;
      R.tongHinge = { x: t.x + t.w * 0.03, y: my };
      R.tongArms = [[t.y - 2, my - t.y + 2], [my, t.h + 2]].map(([y, h], i) => {
        const cp = el("clipPath", { id: "tb-tg" + i }, defs);
        el("rect", { x: t.x - 2, y, width: t.w + 4, height: h }, cp);
        const arm = el("g", {}, R.tongs);
        img(el("g", { "clip-path": `url(#tb-tg${i})` }, arm), "tongs");
        return arm;
      });
    }

    // 水流、落葉、水滴、水氣
    R.streams = el("g", {}, R.cam);
    const mk = () => ({ body: el("path", {}, R.streams), hi: el("path", { fill: "none", stroke: "#fff", "stroke-linecap": "round" }, R.streams) });
    R.sK = mk(); R.sG = mk(); R.sP = mk(); R.sC = mk();
    R.fall = el("g", {}, R.cam);
    R.fallLeaves = [];
    // 每粒乾茶用乾茶實拍圖作紋理填色
    const pat = el("pattern", { id: "tb-dry", patternUnits: "userSpaceOnUse", width: 16, height: 9 }, defs);
    R.dryPat = el("image", { href: href("dry-green"), x: -32, y: -22, width: 80, height: 50, preserveAspectRatio: "none" }, pat);
    for (let i = 0; i < 16; i++) R.fallLeaves.push(el("ellipse", { fill: "url(#tb-dry)", stroke: "#1d140a", "stroke-width": 0.35, "stroke-opacity": 0.45 }, R.fall));
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
    uniqIds(svg);
    return R;
  }

  let SVG_SEQ = 0;
  function uniqIds(svg) {
    const pre = "tb" + (++SVG_SEQ) + "-";
    svg.querySelectorAll('[id^="tb-"]').forEach((n) => { n.id = pre + n.id.slice(3); });
    svg.querySelectorAll("*").forEach((n) => {
      ["fill", "stroke", "clip-path", "style"].forEach((a) => {
        const v = n.getAttribute(a);
        if (v && v.includes("url(#tb-")) n.setAttribute(a, v.replace(/url\(#tb-/g, "url(#" + pre));
      });
    });
  }

  /* 水流：兩端略收窄的帶狀多邊形＋高光線 */
  function ribbon(S, on, a, b, dir, w0, col, now, hiOp) {
    const vis = on > 0.02;
    S.body.style.opacity = S.hi.style.opacity = vis ? Math.min(1, on) : 0;
    if (!vis) return;
    const grow = Math.min(1, on * 2.2);
    b = { x: a.x + (b.x - a.x) * grow, y: a.y + (b.y - a.y) * (grow * grow * 0.4 + grow * 0.6) };
    const c = { x: a.x + (b.x - a.x) * 0.62, y: a.y - 3 };
    const N = 14, left = [], right = [], mid = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x, y = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
      const tx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x), ty = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
      const m = Math.hypot(tx, ty) || 1, nx = -ty / m, ny = tx / m;
      const w = w0 * 0.8 * (1 - 0.62 * t * t - 0.12 * t) * (1 + 0.06 * Math.sin(now / 90 - t * 9)) * Math.min(1, on * 1.4);
      left.push([x + nx * w / 2, y + ny * w / 2]); right.push([x - nx * w / 2, y - ny * w / 2]); mid.push([x + nx * w * 0.14, y + ny * w * 0.14]);
    }
    const f = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);
    S.body.setAttribute("d", "M" + left.map(f).join("L") + "L" + right.reverse().map(f).join("L") + "Z");
    S.body.setAttribute("fill", col); S.body.style.fillOpacity = 0.46; S.body.setAttribute("stroke", "#fff"); S.body.setAttribute("stroke-opacity", 0.5); S.body.setAttribute("stroke-width", 0.5);
    S.hi.setAttribute("d", "M" + mid.map(f).join("L"));
    S.hi.setAttribute("stroke-width", Math.max(0.7, w0 * 0.16)); S.hi.style.strokeOpacity = hiOp || 0.7;
    S.hi.setAttribute("stroke-dasharray", "14 7 5 7"); S.hi.setAttribute("stroke-dashoffset", (-now / 14).toFixed(1));
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
        else if (e.type === "splash") spawn(F.splash, (p) => { p.x = e.x + (Math.random() - 0.5) * 5; p.y = e.y; p.vx = (Math.random() - 0.5) * 22; p.vy = -(12 + Math.random() * 22); p.dur = 0.45; p.t = 0; });
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
      [R.gDry, R.hPile, R.dryPat].forEach((e) => e.setAttribute("href", u));
      const [rx, ry] = DRY_LEAF[tea.id] || DRY_LEAF.green;
      R.fallLeaves.forEach((e, i) => { const j = 0.75 + ((i * 37) % 10) / 20; e.setAttribute("rx", rx * j); e.setAttribute("ry", ry * j); });
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
    const kFront = Math.abs(s.kr) > 1 || Math.abs(s.kx) > 4;
    if (R.kFront !== kFront) {
      R.kFront = kFront;
      if (kFront) R.layer.appendChild(R.kettle); else R.layer.insertBefore(R.kettle, R.stoveFront);
    }
    if (Math.abs(s.kr) < 5 && show > 0.5) emit.push({ k: "kst", type: "steam", x: tip.x + 2, y: tip.y - 2, rate: 5, spread: 2, lift: 1.3, alpha: 0.5 });
    const hudTemp = s.sK > 0.05 || Math.abs(s.kr) > 8 || (s.temp && Math.abs(s.kx) < 4) ? (tea.temp[0] === tea.temp[1] ? `沖泡水溫 ${tea.temp[0]}°C` : `沖泡水溫 ${tea.temp[0]}–${tea.temp[1]}°C`) : "";

    // 蓋碗
    R.gaiwan.style.display = glass ? "none" : "";
    R.pitcher.style.display = glass ? "none" : "";
    R.cups.forEach((c) => (c.g.style.display = glass ? "none" : ""));
    R.glass.style.display = glass ? "" : "none";
    appear(R.towel, 4);
    appear(R.holder, 4);
    appear(R.wash, 3);
    appear(R.scoop, 5);
    const gOff = appear(R.gaiwan, 2);
    const gdir = s.gd < 0 ? -1 : 1, lip = gdir < 0 ? L.gaiwanLipL : L.gaiwanLip, br = q.bowlRim;
    R.gaiwan.setAttribute("transform", `translate(${HOME.gaiwan.x + s.gx},${HOME.gaiwan.y + s.gy + gOff})`);
    R.saucer.setAttribute("transform", `translate(${HOME.gaiwan.x},${HOME.gaiwan.y + gOff})`);
    R.saucer.style.opacity = R.gaiwan.style.opacity;
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
    const gl = { cx: br.cx, cy: br.cy + (1 - lv) * br.ry * 1.9, rx: br.rx * 0.93 * (0.6 + 0.4 * lv), ry: br.ry * 0.82 * (0.6 + 0.4 * lv) };
    [R.gLiquid, R.gLiquidDepth, R.gLiquidHi].forEach((e) => { e.setAttribute("cy", gl.cy); e.setAttribute("rx", gl.rx); e.setAttribute("ry", gl.ry); e.style.opacity = lv > 0.02 ? 1 : 0; });
    R.gLiquid.style.opacity = lv > 0.02 ? 0.88 : 0;
    R.gLiquid.setAttribute("fill", tint(s.gTint));
    const lk = s.lid;
    const lidOn = { x: br.cx + s.lidX - 4 * s.lidGap * gdir, y: br.cy + 1 - 0.6 * s.lidGap, r: s.lidR - 5 * s.lidGap * gdir }, lidOff = { x: br.cx - br.rx - 14, y: br.cy + 38, r: -8 };
    R.lid.setAttribute("transform", `translate(${lerp(lidOff.x, lidOn.x, lk)},${lerp(lidOff.y, lidOn.y, lk)}) rotate(${lerp(lidOff.r, lidOn.r, lk)})`);
    R.gFront.style.display = lk > 0.6 ? "" : "none";
    R.gHand.style.display = "none";
    const closed = !glass && lk > 0.99 && s.lidGap < 0.02 && Math.abs(s.lidX) < 0.05 && Math.abs(s.lidR) < 0.05 && Math.abs(s.gr) < 0.05 && Math.abs(s.gx) < 0.05 && Math.abs(s.gy) < 0.05;
    const ck = R.closedK = quiet || R.closedK == null ? (closed ? 1 : 0) : (R.closedK || 0) + ((closed ? 1 : 0) - (R.closedK || 0)) * (1 - Math.exp(-Math.max(dt, 0.001) / 0.07));
    const gOp = +R.gaiwan.style.opacity;
    R.gClosed.setAttribute("transform", `translate(${HOME.gaiwan.x},${HOME.gaiwan.y + gOff})`);
    R.gClosed.style.opacity = (gOp * ck).toFixed(3);
    R.gClosed.style.display = ck > 0.01 && !glass ? "" : "none";
    R.saucer.style.display = glass || ck > 0.99 ? "none" : "";
    R.gaiwan.style.display = glass || ck > 0.99 ? "none" : "";
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
        R.pImg.style.opacity = (1 - 0.1 * Math.min(1, s.pLevel * 8)).toFixed(2);
    R.pLiquid.style.opacity = pOn ? 0.74 : 0; R.pLiquidDepth.style.opacity = pOn ? 1 : 0; R.pSurface.style.opacity = pOn ? 1 : 0;
    if (!glass && pOn && s.pLevel > 0.12 && s.pr > -12) emit.push({ k: "pst", type: "steam", x: HOME.pitcher.x + s.px + q.pRim.cx, y: HOME.pitcher.y + s.py + q.pRim.cy - 2, rate: 2.2, spread: 36, lift: 0.8, alpha: 0.3 });

    // 品茗杯
    const cr = q.cRim;
    R.cups.forEach((c, i) => {
      const off = appear(c.g, 4 + i * 0.4);
      const l = s["c" + i];
      let x = HOME.cups[i].x + s["u" + i], y = HOME.cups[i].y + off + s["y" + i], sc = 1, r = s["r" + i];
      if (i === 1) { x += s.c1x; y += s.c1y; sc = s.c1s; r += s.c1r; y -= s.sip * 10; }
      c.g.setAttribute("transform", `translate(${x},${y}) scale(${sc}) rotate(${r} ${cr.cx} ${cr.cy + 8})`);
      { const lift = Math.max(0, HOME.cups[i].y + off - y); c.sh.setAttribute("transform", `translate(0,${(lift / sc).toFixed(1)}) scale(${(1 + lift / 90).toFixed(3)},1)`); c.sh.style.opacity = Math.max(0.25, 1 - lift / 70).toFixed(2); }
            const on = l > 0.02;
      const cy = cr.cy + (1 - l) * cr.ry * 1.05, rx = cr.rx * 0.9 * (0.7 + 0.3 * l), ry = cr.ry * 0.82 * (0.7 + 0.3 * l);
      [c.liq, c.depth, c.hi].forEach((e) => { e.setAttribute("cy", cy); e.setAttribute("rx", rx); e.setAttribute("ry", ry); e.style.opacity = on ? 1 : 0; });
      c.liq.style.opacity = on ? 0.95 : 0;
      c.liq.setAttribute("fill", mixColor(WATER, deep, s.cTint));
      if (!glass && l > 0.15 && Math.abs(r) < 10) {
        emit.push({ k: "cst" + i, type: "steam", x: x + cr.cx * sc, y: y + (cr.cy - 2) * sc, rate: i === 1 ? 3 + s.steamCup * 3 : 1.4, spread: 14 * sc, lift: 0.9 * sc, alpha: 0.28 + (i === 1 ? 0.2 * s.steamCup : 0) });
      }
    });

    // 斟茶時，公道杯／蓋碗排在目標杯同一排之前：後排杯在其後，前排杯在其前
    const rowNext = (ti) => R.cups.map((c, j) => [HOME.cups[j].y, c.g]).filter(([y]) => y >= HOME.cups[ti].y - 5).sort((a, b) => a[0] - b[0])[0][1];
    const ti = Math.round(s.pTarget || 0);
    [[R.pitcher, R.pitcherNext, s.px !== 0 || s.py !== 0], [R.gaiwan, R.gaiwanNext, (s.sGTarget === "cup" || s.sGTarget === "wash") && (s.gx !== 0 || s.gy !== 0)]].forEach(([node, home, away]) => {
      const want = away ? (node === R.gaiwan ? R.chahe : rowNext(ti)) : home;
      if (node.nextSibling !== want) R.layer.insertBefore(node, want);
    });

    // 玻璃杯
    if (glass) {
      const wOff = appear(R.glass, 2);
      const wr = s.wr, tb = R.tb;
      R.glass.setAttribute("transform", `translate(${HOME.glass.x + s.wx},${HOME.glass.y + s.wy + wOff}) scale(${s.ws})`);
      R.gBody.setAttribute("transform", `rotate(${wr} ${L.tPivot.x} -2)`);
      { const lift = Math.max(0, -s.wy - wOff); R.glassShadow.setAttribute("transform", `translate(0,${(lift / s.ws).toFixed(1)}) scale(${(1 + lift / 90).toFixed(3)},1)`); R.glassShadow.style.opacity = Math.max(0.25, 1 - lift / 70).toFixed(2); }
      const top = L.glassFloor - s.wLevel * L.glassH;
      const hgt = Math.max(0, L.glassFloor - top + 12);
      [R.wLiquid, R.wLiquidDepth].forEach((e) => { e.setAttribute("y", top); e.setAttribute("height", hgt); e.setAttribute("transform", `rotate(${-wr} 0 ${top})`); });
      R.wSurface.setAttribute("cy", top); R.wSurface.setAttribute("transform", `rotate(${-wr} 0 ${top})`);
      const col = tint(s.wTint);
      R.wLiquid.setAttribute("fill", col);
      const on = s.wLevel > 0.01 && Math.abs(s.wr) < 70;
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
      if (on && Math.abs(s.wr) < 12) emit.push({ k: "wst", type: "steam", x: HOME.glass.x + s.wx + q.tRim.cx * s.ws, y: HOME.glass.y + s.wy + (q.tRim.cy - 2) * s.ws, rate: 2.4 + s.sip * 0, spread: 20, lift: 0.9, alpha: 0.3 });
    }

    // 茶荷
    const hOff = appear(R.chahe, 1);
    R.chahe.setAttribute("transform", `translate(${HOME.chahe.x + s.hx},${HOME.chahe.y + s.hy + hOff}) scale(${s.hs})`);
    R.chaheBody.setAttribute("transform", `rotate(${s.hr} ${L.chaheTip.x} ${L.chaheTip.y})`);
    R.chaheShadow.style.opacity = Math.max(0, 1 - Math.abs(s.hy) / 30);
    R.hPile.style.opacity = Math.min(1, s.hLeaves * 1.6);
    { const py = q.chPile.y + q.chPile.w * 0.36; R.hPile.setAttribute("transform", `translate(${q.chPile.x},${py}) scale(${(0.35 + 0.65 * s.hLeaves).toFixed(3)},${(0.2 + 0.8 * s.hLeaves).toFixed(3)}) translate(${-q.chPile.x},${-py})`); }
    // 茶撥
    const pa = lerp(-12, 12, s.hp) + Math.sin(s.hpw * Math.PI * 4) * 9 * s.hp;
    R.pick.setAttribute("transform", `translate(${44 - 6 * s.hp - 30 * s.hpw * s.hp},${-12 - 3 * s.hp + 4 * s.hpw * s.hp}) scale(-1,1) rotate(${pa})`);
    // 茶夾：平時收在茶道組；溫杯時取出，夾住品茗杯右沿，隨杯移動、傾側，用完放回
    R.tongs.style.display = glass || s.tr < 0.02 ? "none" : "";
    {
      const hf = Math.max(0, Math.min(2, s.tgi)), hi = Math.floor(hf), hk = hf - hi, hj = Math.min(2, hi + 1);
      const ti = Math.round(s.tgi), cx = HOME.cups[ti].x + s["u" + ti], cy = HOME.cups[ti].y + s["y" + ti], cr2 = s["r" + ti];
      const lp = rot({ x: L.cupCx + L.cupRx * 0.9, y: L.cupRim + 3 }, cupPivot(), cr2);
      const hold = { x: cx + lp.x, y: cy + lp.y };
      const near = { x: lerp(HOME.cups[hi].x, HOME.cups[hj].x, hk) + 64, y: lerp(HOME.cups[hi].y, HOME.cups[hj].y, hk) - 46 };
      const home = { x: HOME.holder.x - 4, y: HOME.holder.y - 74 };
      const k = s.tg, ready = { x: lerp(near.x, hold.x, k), y: lerp(near.y, hold.y, k) };
      const pos = { x: lerp(home.x, ready.x, s.tr), y: lerp(home.y, ready.y, s.tr) };
      const a = lerp(lerp(60, 26, s.tr), Math.min(48, 24 + 0.2 * Math.abs(cr2)), k);
      R.tongs.setAttribute("transform", `translate(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) rotate(${(-a).toFixed(1)}) scale(-1,1)`);
      // 夾杯前張開、夾住時收緊（夾臂貼杯壁），放下時再張開
      const spread = 5.5 * Math.sin(Math.PI * Math.min(1, k)) - 1.4 * Math.pow(k, 4);
      R.tongSpread = spread;
      R.tongArms.forEach((arm, i) => arm.setAttribute("transform", `rotate(${((i ? 1 : -1) * spread).toFixed(2)} ${R.tongHinge.x.toFixed(1)} ${R.tongHinge.y.toFixed(1)})`));
      R.tongsTip = k > 0.3 ? hold : pos;
    }

    // 落葉（乾茶逐粒、逐片滑落）
    const hTip = rot(L.chaheTip, L.chaheTip, s.hr);
    const from = { x: HOME.chahe.x + s.hx + hTip.x * s.hs, y: HOME.chahe.y + s.hy + hTip.y * s.hs };
    const to = glass ? { x: HOME.glass.x + q.tRim.cx, y: HOME.glass.y + q.tRim.cy } : { x: HOME.gaiwan.x + br.cx, y: HOME.gaiwan.y + br.cy };
    R.fallLeaves.forEach((lf, i) => {
      const k = Math.max(0, Math.min(1, s.fall * 2.2 - ((i * 7) % 16) * 0.075));
      const vis = s.fall > 0 && s.fall < 1 && k > 0 && k < 0.93;
      lf.style.opacity = vis ? 1 : 0;
      if (vis) {
        const jx = (((i * 53) % 11) - 5) * 1.1;
        const x = lerp(from.x + jx * 0.3, to.x - 4 + jx * 1.4, Math.min(1, k * 1.15)), y = from.y + (to.y + 2 - from.y) * k * k;
        lf.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(i * 47 + k * 160) % 360})`);
      }
    });

    // 水流
    const kDir = { x: Math.cos(rad(s.kr - 120)), y: Math.sin(rad(s.kr - 120)) };
    const kTarget = glass
      ? { x: tip.x + 4, y: HOME.glass.y + s.wy + L.glassFloor - s.wLevel * L.glassH }
      : { x: tip.x + 4, y: HOME.gaiwan.y + s.gy + gl.cy };
    const waterCol = "#e9f6fb";
    ribbon(R.sK, s.sK, tip, kTarget, kDir, 4.4, waterCol, now, 0.8);
    const lipW = { x: HOME.gaiwan.x + s.gx + lip.x, y: HOME.gaiwan.y + s.gy + lip.y };
    const ci = Math.round(s.pTarget || 0);
    const cupSurf = HOME.cups[ci].y + cr.cy + (1 - s["c" + ci]) * cr.ry * 1.05;
    const wm = washMouth();
    const gTo = s.sGTarget === "wash" ? { x: lipW.x - 6, y: wm.y }
      : s.sGTarget === "cup" ? { x: lipW.x + 4, y: cupSurf }
      : { x: lipW.x + 6, y: HOME.pitcher.y + L.pFloor - s.pLevel * L.pH };
    let wTo = null;
    if (glass) {
      // 倒溫杯水：由玻璃杯最低的杯沿流到茶盤
      const piv = L.tPivot;
      const lo = [{ x: R.tb.x0, y: q.tRim.cy }, { x: R.tb.x1, y: q.tRim.cy }].map((p) => rot(p, piv, s.wr)).sort((a, b) => b.y - a.y)[0];
      const wa = { x: HOME.glass.x + s.wx + lo.x * s.ws, y: HOME.glass.y + s.wy + lo.y * s.ws };
      wTo = { x: wa.x - 6, y: wm.y };
      ribbon(R.sG, s.sW, wa, wTo, { x: 0.5, y: 0.6 }, 4.2, tint(s.wTint), now, 0.55);
    } else ribbon(R.sG, s.sG, lipW, gTo, { x: 0.5, y: 0.6 }, 5, tint(s.gTint), now, 0.55);
    const pTipW = { x: HOME.pitcher.x + s.px + pt.x, y: HOME.pitcher.y + s.py + pt.y };
    const cupTo = { x: pTipW.x - 4, y: cupSurf };
    ribbon(R.sP, s.sP, pTipW, cupTo, { x: 0.5, y: 0.6 }, 3.8, mixColor(WATER, deep, s.pTint), now, 0.55);
    // 品茗杯傾側，水由最低的杯沿流入水洗
    const ci2 = Math.round(s.tgi), cpiv = cupPivot();
    const cLo = rot({ x: L.cupCx - L.cupRx * 0.95, y: L.cupRim }, cpiv, s["r" + ci2]);
    const cW = { x: HOME.cups[ci2].x + s["u" + ci2] + cLo.x, y: HOME.cups[ci2].y + s["y" + ci2] + cLo.y }, cTo = { x: cW.x - 2, y: wm.y };
    ribbon(R.sC, s.sC, cW, cTo, { x: 0.5, y: 0.6 }, 3.4, mixColor(WATER, deep, s.cTint), now, 0.55);
    const lands = [[s.sK, kTarget, 18, 8], glass ? [s.sW, wTo, 14, 5] : [s.sG, gTo, 16, 5], [s.sP, cupTo, 10, 2.5], [s.sC, cTo, 12, 4]];
    lands.forEach(([on, p, w, sr], i) => {
      if (on > 0.5) {
        emit.push({ k: "sp" + i, type: "splash", x: p.x, y: p.y, rate: sr * on });
        emit.push({ k: "rp" + i, type: "ripple", x: p.x, y: p.y, w, rate: 1.8 });
      }
    });

    // 水滴
    if (s.drop > 0 && s.drop < 1 && (s.dropTarget !== "pitcher" || Math.abs(s.gr) > 25)) {
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

    // 品茗：玻璃杯提起並略傾（品茗杯在上面處理）
    if (s.sip > 0 && glass) R.glass.setAttribute("transform", R.glass.getAttribute("transform") + ` translate(0,${-s.sip * 14}) rotate(${-s.sip * 16} ${q.tRim.cx} ${q.tRim.cy + 60})`);

    // 特效與鏡頭
    R.lastSteam = emit.filter((e) => e.type === "steam");
    fxUpdate(R, now, dt, quiet ? [] : emit);
    cameraStep(R, s, { tip, kTarget, lipW, gTo, pTipW, cupTo, from, to, br, glass }, dt);
  }

  /* 鏡頭：按當前動作自動推近，緩動跟隨 */
  function cameraStep(R, s, P, dt) {
    let f = { x: 400, y: 250, z: 1 };
    const mid = (a, b, k = 0.5) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
    if (s.tg > 0.3 || s.sC > 0.05) { const m = mid(R.tongsTip || HOME.holder, washMouth(), 0.5); f = { x: m.x, y: m.y - 10, z: 1.5 }; }
    else if (s.sK > 0.05 || Math.abs(s.kr) > 8) { const m = mid(P.tip, P.kTarget, 0.35); f = { x: m.x - 18, y: m.y - 24, z: 1.62 }; }
    else if (s.sG > 0.05 || Math.abs(s.gr) > 10) { const m = mid(P.lipW, P.gTo, 0.5); f = { x: m.x, y: m.y - 8, z: 1.72 }; }
    else if (s.sP > 0.05 || s.pr < -10) { const m = mid(P.pTipW, P.cupTo, 0.5); f = { x: m.x - 10, y: m.y - 6, z: 1.8 }; }
    else if (s.lid > 0.02 && s.lid < 0.98 || s.lidX !== 0) f = { x: HOME.gaiwan.x + R.q.bowlRim.cx, y: HOME.gaiwan.y + R.q.bowlRim.cy - 6, z: 1.9 };
    else if (s.hs > 1.3) f = { x: HOME.chahe.x + s.hx, y: HOME.chahe.y + s.hy - 20, z: 1.5 };
    else if (s.fall > 0 && s.fall < 1 || (s.hr > 6 && s.hx > 10)) { const m = mid(P.from, P.to, 0.5); f = { x: m.x, y: m.y - 4, z: 1.8 }; }
    else if (s.c1y > 20) f = { x: HOME.cups[1].x + s.c1x, y: HOME.cups[1].y + s.c1y - 30, z: 1.7 };
    else if (s.ws > 1.1) f = { x: HOME.glass.x + s.wx, y: HOME.glass.y + s.wy - 50, z: 1.5 };
    else if (Math.abs(s.wr) > 10 || s.wLevel > 0.05 && s.mode === "glass" && s.sK > 0) f = { x: HOME.glass.x + s.wx, y: HOME.glass.y + s.wy - 40, z: 1.6 };
    if (s.cw > 0.001) f = { x: lerp(f.x, s.cx, s.cw), y: lerp(f.y, s.cy, s.cw), z: lerp(f.z, s.cz, s.cw) };
    f.x = Math.max(400 / f.z, Math.min(800 - 400 / f.z, f.x));
    f.y = Math.max(250 / f.z, Math.min(500 - 250 / f.z, f.y));
    const C = R.cam0;
    if (!R.camSet || R.noCam) { Object.assign(C, R.noCam ? { x: 400, y: 250, z: 1 } : f); R.camSet = true; }
    else { const k = 1 - Math.exp(-dt / 0.55); C.x += (f.x - C.x) * k; C.y += (f.y - C.y) * k; C.z += (f.z - C.z) * k; }
    R.cam.setAttribute("transform", `translate(${(400 - C.z * C.x).toFixed(2)},${(250 - C.z * C.y).toFixed(2)}) scale(${C.z.toFixed(4)})`);
  }

  /* ---------- 對外介面 ---------- */
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const styleListeners = [];
  const store = { get() { try { return localStorage.getItem("tea-style"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem("tea-style", v); } catch (e) {} } };
  let GLOBAL_STYLE = store.get() === "I" ? "I" : "R";

  function createStage(svg, opts = {}) {
    let style = GLOBAL_STYLE;
    let R = null, tea = null, clip = null, clipId = null, t = 0, playing = false, last = 0, raf = 0, speed = 1, visible = true, ready = false, idleTick = 0, idleSince = 0, hand = null, idleDt = 0, frozenNow = 0, dirty = true;
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
      idleDt += dtRaw;
      const live = playing && visible;
      if (clip && !live && !dirty) {
        /* 暫停：畫面凍結，只更新水氣粒子 */
        opts.onIdle && opts.onIdle();
        if ((idleTick++ % 4) === 0) { fxUpdate(R, frozenNow, idleDt, reduce ? [] : R.lastSteam || []); idleDt = 0; }
      } else if (clip) {
        const s = clip.sample(t);
        if (dirty && !playing) { R.camSet = false; R.closedK = null; }
        render(R, s, tea, reduce ? 0 : (live || dirty ? (frozenNow = now) : frozenNow), live || dirty ? dtRaw : idleDt, reduce);
        idleDt = 0; dirty = false;
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
    function kick() { dirty = true; if (!raf && ready) raf = requestAnimationFrame((n) => { last = n; idleSince = n; frame(n); }); }
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
    let vio = null;
    if ("IntersectionObserver" in window) {
      vio = new IntersectionObserver((en) => { visible = en.some((x) => x.isIntersecting); if (visible) kick(); });
      vio.observe(svg);
    }
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);
    const onStyle = (st) => { if (st !== style) { style = st; boot(); } };
    styleListeners.push(onStyle);
    const booted = boot();
    return {
      load(newTea, id, autoplay, handInfo) {
        tea = newTea; clipId = id; clip = buildClip(id, tea);
        hand = null; paintHand(); handBox.classList.remove("on"); hudTemp.style.visibility = "";
        t = 0; playing = !!autoplay;
        if (!autoplay) t = reduce || id === "prepare" ? clip.dur : 0;
        last = performance.now(); setRun(playing);
        if (R) { R.camSet = false; R.fx.acc = {}; }
        opts.onState && opts.onState(playing);
        booted.then(kick);
        if (ready) kick();
      },
      play() { if (!clip) return; if (t >= clip.dur) t = 0; playing = true; setRun(true); last = performance.now(); opts.onState && opts.onState(true); kick(); },
      pause() { playing = false; setRun(false); opts.onState && opts.onState(false); opts.onIdle && opts.onIdle(); },
      toggle() { playing ? this.pause() : this.play(); },
      replay() { t = 0; this.play(); },
      seek(frac) { if (clip) { t = Math.max(0, Math.min(1, frac)) * clip.dur; kick(); } },
      setSpeed(v) { speed = v; },
      get playing() { return playing; },
      get duration() { return clip ? clip.dur : 0; },
      get ready() { return ready; },
      get state() { return clip ? clip.sample(t) : null; },
      destroy() {
        cancelAnimationFrame(raf); playing = false; opts.onIdle && opts.onIdle();
        if (vio) vio.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        const k = styleListeners.indexOf(onStyle); if (k >= 0) styleListeners.splice(k, 1);
        [hudTemp, hudTimer, handBox, note].forEach((n) => n.remove());
      }
    };
  }

  function setStyle(st) {
    st = st === "I" ? "I" : "R";
    if (st === GLOBAL_STYLE) return;
    GLOBAL_STYLE = st; store.set(st);
    styleListeners.forEach((fn) => fn(st));
  }

  window.TeaStage = { createStage, buildClip, setStyle, getStyle: () => GLOBAL_STYLE, _dbg: () => ({ L, HOME, R: window.__R }) };
})();
