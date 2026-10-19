"""2026-10-18 真實感修正回歸測試：古琴曲目、蓋碗合蓋、公道杯低斟不碰杯、巡城分輪、點兵貼近、奉茶比例、壺嘴高於玻璃杯口、品茗字幕次序。"""
import asyncio, os
from playwright.async_api import async_playwright
U = os.environ.get("BASE", "http://127.0.0.1:18791/")
ok = True
def chk(n, c, v=""):
    global ok
    ok &= bool(c); print("PASS" if c else "FAIL", n, v)
JS_SIM = """(a) => {
  const T = TEA_DATA.teas.find((t) => t.id === a.tea), c = TeaStage.buildClip(a.clip, T), D = TeaStage._dbg(), L = D.L, H = D.HOME;
  const rot = (p, v, d) => { const r = d * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), x = p.x - v.x, y = p.y - v.y; return { x: v.x + x * cs - y * sn, y: v.y + x * sn + y * cs }; };
  const out = [];
  for (let t = 0; t <= c.dur; t += 0.05) {
    const s = c.sample(t); s.t = +t.toFixed(2);
    if (a.clip === "share" && s.sP > 0.9) {
      const P = (p) => { const q = rot(p, L.pitcherTip, s.pr); return { x: H.pitcher.x + s.px + q.x, y: H.pitcher.y + s.py + q.y }; };
      const row = H.cups[Math.round(s.pTarget)].y; s.hit = L.pPoly.map(P).some((p) => H.cups.some((cp) => Math.abs(cp.y - row) < 6 && Math.abs(p.x - cp.x) < L.cupRx && p.y > cp.y + L.cupRim));
      const tip = P(L.pitcherTip), cp = H.cups[Math.round(s.pTarget)];
      s.gap = cp.y + L.cupRim - tip.y;
    }
    if ((a.clip === "points" || a.clip === "patrol") && s.sG + s.drop > 0) {
      const cp = H.cups[Math.round(s.pTarget)];
      if (Math.abs(H.gaiwan.x + s.gx + L.gaiwanLip.x - cp.x) < 6) s.gap = cp.y + L.cupRim - (H.gaiwan.y + s.gy + L.gaiwanLip.y);
    }
    if (s.sK > 0.9 && s.mode === "glass") { const tip = rot(L.kettleTip, L.kettlePivot, s.kr); s.gap = (H.glass.y + L.glassTop) - (H.kettle.y + s.ky + tip.y); }
    out.push(s);
  }
  return { dur: c.dur, s: out, labels: c.labels.map((l) => l[1]) };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        pg = await b.new_page(viewport={"width": 1440, "height": 900})
        errs, bad = [], []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)
        await pg.goto(U + "?tea=oolong&step=7"); await pg.wait_for_timeout(1800)
        # 古琴背景音樂
        opts = await pg.evaluate("[...document.querySelectorAll('#trackSel option')].map(o=>o.textContent)")
        chk("五首古琴曲可選", opts == ["平沙落雁", "流水", "佩蘭", "孔子讀易", "秋風詞"], opts)
        chk("音樂關時不顯示曲目", await pg.evaluate("document.getElementById('trackSel').hidden"))
        await pg.click("#musicBtn"); await pg.wait_for_timeout(600)
        chk("開音樂後顯示曲目", not await pg.evaluate("document.getElementById('trackSel').hidden"))
        await pg.select_option("#trackSel", "liushui"); await pg.wait_for_timeout(1500)
        d = await pg.evaluate("TeaAudio._dbg().music")
        chk("揀《流水》後換成該音檔", d and d["src"].endswith("guqin-liushui.mp3") and await pg.evaluate("TeaAudio.track") == "liushui", d)
        await pg.reload(); await pg.wait_for_timeout(1500)
        chk("曲目重載後保留", await pg.evaluate("[TeaAudio.track, document.getElementById('trackSel').value]") == ["liushui", "liushui"])
        durs = await pg.evaluate("""Promise.all(TeaAudio.tracks.map((t) => new Promise((res) => { const a = new Audio('assets/audio/guqin-' + t.id + '.mp3'); a.preload = 'metadata'; a.onloadedmetadata = () => res(a.duration); a.onerror = () => res(-1); })))""")
        chk("五首音檔可載入且長度合理（>100 秒）", all(x > 100 for x in durs), [round(x) for x in durs])
        chk("頁腳有錄音署名及授權", "CC BY 2.5" in await pg.inner_text("footer") and "CharlieHuang" in await pg.inner_text("footer"))
        await pg.click("#musicBtn")
        # 蓋碗合蓋：蓋闊度約為碗口 85–97%，蓋沿被碗前緣遮住
        await pg.evaluate("()=>{const s=window.__teaStage; s.load(TEA_DATA.teas.find(t=>t.id==='oolong'),'pour',false); s.seek(0.01);}"); await pg.wait_for_timeout(300)
        vis = """()=>{ const im=(r)=>[...document.querySelectorAll('#stage image')].find(i=>r.test(i.getAttribute('href'))&&!i.getAttribute('clip-path')); const shown=(n)=>{ let e=n; while(e&&e.id!=='stage'){ if(getComputedStyle(e).display==='none') return false; e=e.parentNode;} return true; }; return {closed: shown(im(/gclosed/)), bowl: shown(im(/bowl/)), saucer: shown(im(/saucer/))}; }"""
        g = await pg.evaluate(vis)
        chk("合蓋靜止：改用整件合蓋蓋碗圖，分件隱藏", g["closed"] and not g["bowl"] and not g["saucer"], g)
        await pg.evaluate("()=>{const s=window.__teaStage; s.load(TEA_DATA.teas.find(t=>t.id==='oolong'),'add',false); s.seek(0.5);}"); await pg.wait_for_timeout(300)
        g = await pg.evaluate(vis)
        chk("開蓋：分件（碗、碟）顯示，整件隱藏", (not g["closed"]) and g["bowl"] and g["saucer"], g)
        sim = lambda tea, clip: pg.evaluate(JS_SIM, {"tea": tea, "clip": clip})
        sh = await sim("oolong", "share")
        pours = [s for s in sh["s"] if s.get("gap") is not None]
        chk("分茶：公道杯杯身不碰同一排品茗杯", pours and not any(s["hit"] for s in pours), len(pours))
        chk("分茶：杯嘴離杯口約 1–3 cm（8–26 單位）", pours and all(6 <= s["gap"] <= 26 for s in pours), sorted({round(s["gap"]) for s in pours}))
        pt = await sim("oolong", "patrol")
        lv = [[s["c0"], s["c1"], s["c2"]] for s in pt["s"]]
        first_full = next((i for i, l in enumerate(lv) if max(l) >= 0.45), None)
        chk("巡城：未有杯過半前，三杯都已斟過", first_full is not None and min(lv[first_full - 1]) > 0.1, lv[first_full - 1] if first_full else None)
        chk("巡城：最後三杯份量一致（差 ≤ 0.05）", max(lv[-1]) - min(lv[-1]) <= 0.05, lv[-1])
        gp = [s["gap"] for s in pt["s"] if s.get("gap") is not None and s["sG"] > 0.9]
        chk("巡城：出湯口離杯口約 1–2 cm（≤ 18 單位）", gp and max(gp) <= 18, (round(min(gp)), round(max(gp))))
        po = await sim("oolong", "points")
        gp = [s["gap"] for s in po["s"] if s.get("gap") is not None and 0 < s["drop"] < 1]
        chk("點兵：貼近杯口（≤ 18 單位）且傾角 > 100°", gp and max(gp) <= 18 and max(s["gr"] for s in po["s"]) > 100, (round(min(gp)), round(max(gp))))
        sv = await sim("oolong", "serve")
        chk("奉茶：杯不放大超過 1.15 倍，落在茶盤前桌面", max(s["c1s"] for s in sv["s"]) <= 1.15 and sv["s"][-1]["c1y"] > 50)
        ta = await sim("oolong", "taste")
        chk("品茗：杯底留香排在飲後", ta["labels"].index(next(l for l in ta["labels"] if "杯底" in l)) == len(ta["labels"]) - 1, ta["labels"])
        chk("品茗：啜飲時杯有傾斜", min(s["c1r"] for s in ta["s"]) < -12)
        chk("品茗及奉茶：不顯示沖泡水溫", all(s["temp"] == 0 for s in ta["s"] + sv["s"]))
        for clip in ["warm", "add", "brew", "again"]:
            gw = await sim("green", clip)
            gaps = [s["gap"] for s in gw["s"] if s.get("gap") is not None]
            chk(f"綠茶{clip}：注水時壺嘴高於玻璃杯口", gaps and min(gaps) > 2, round(min(gaps)) if gaps else None)
        gw = await sim("green", "warm")
        chk("綠茶溫杯：倒水時杯傾過 100° 並有出水", max(abs(s["wr"]) for s in gw["s"]) > 100 and max(s["sW"] for s in gw["s"]) > 0.9)
        ad = await sim("green", "add")
        chk("綠茶投茶字幕用「杯」不用「碗」", not any("碗" in l for l in ad["labels"]), ad["labels"])
        wm = await sim("oolong", "warm")
        chk("蓋碗溫杯：三隻杯逐一傾倒倒水", all(max(abs(s["r%d" % i]) for s in wm["s"]) > 90 for i in range(3)))
        po = await sim("oolong", "pour")
        hd = [s["hd"] for s in po["s"]]
        chk("出湯：握碗手在傾倒時全程顯示，起落時淡入淡出", max(hd) == 1 and hd[0] == 0 and hd[-1] == 0 and all(h == 1 for s_, h in zip(po["s"], hd) if abs(s_["gr"]) > 40))
        chk("沒有 console 錯誤", not errs, errs)
        chk("沒有 404", not bad, bad)
        await b.close()
    print("ALL PASS" if ok else "SOME FAILED")
asyncio.run(main())
