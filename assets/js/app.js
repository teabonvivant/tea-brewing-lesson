(function () {
  const D = window.TEA_DATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const params = new URLSearchParams(location.search);
  if (params.get("embed") === "1") document.documentElement.classList.add("embed");

  const state = {
    tea: D.teas.find((t) => t.id === params.get("tea")) || D.teas[3],
    step: 0,
    auto: false,
    speed: 1
  };

  function setLabel(node, tx) {
    node.textContent = tx;
    node.classList.toggle("on", !!tx);
  }

  /* ---------- 流程 ---------- */
  const visibleSteps = () => D.steps.filter((s) => !(s.skipIf && s.skipIf(state.tea)));
  const pointsOf = (s) => (typeof s.points === "function" ? s.points(state.tea) : s.points);
  let autoTimer = 0;

  const stage = (window.__teaStage = TeaStage.createStage($("stage"), {
    onProgress: (p) => ($("progressBar").style.width = (p * 100).toFixed(1) + "%"),
    onFrame: (s, playing) => window.TeaAudio && TeaAudio.feed("main", s, playing),
    onIdle: () => window.TeaAudio && TeaAudio.stop("main"),
    onLabel: (tx) => setLabel($("cuLabel"), tx),
    onState: (playing) => setPlayUI(playing),
    onEnd: () => {
      if (!state.auto) return;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (!state.auto) return;
        if (state.step < visibleSteps().length - 1) goStep(state.step + 1, true);
        else { state.auto = false; $("autoBtn").checked = false; }
      }, 1400);
    }
  }));

  function setPlayUI(playing) {
    $("playText").textContent = playing ? "暫停" : "播放";
    $("playBtn").setAttribute("aria-label", playing ? "暫停" : "播放");
    $("playIcon").innerHTML = playing
      ? '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>'
      : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
  }

  const poseCache = {};
  function setPose(pose) {
    const a = $("sceneA"), b = $("sceneB");
    const on = a.classList.contains("is-on") ? a : b;
    const off = on === a ? b : a;
    const src = `assets/img/scene/${pose}-960.webp`;
    if (on.dataset.pose === pose || (on === a && !a.dataset.pose && pose === "greet")) { on.alt = POSE_ALT[pose]; return; }
    off.onerror = () => { if (off.dataset.pose === pose) { off.dataset.pose = ""; setLabel($("sceneNote"), "這一步的人物圖暫時未能載入，請看右邊的特寫動畫"); } };
    off.onload = () => {
      if (off.dataset.pose !== pose) return;
      setLabel($("sceneNote"), "");
      off.classList.add("is-on"); on.classList.remove("is-on");
      off.removeAttribute("aria-hidden"); on.setAttribute("aria-hidden", "true");
      off.alt = POSE_ALT[pose]; on.alt = "";
    };
    off.dataset.pose = pose;
    off.srcset = `assets/img/scene/${pose}-960.webp 960w, assets/img/scene/${pose}-1536.webp 1536w`;
    off.sizes = "(min-width: 1080px) 60vw, 100vw";
    off.src = src;
  }
  function preload(pose) {
    if (poseCache[pose]) return;
    const im = new Image();
    im.srcset = `assets/img/scene/${pose}-960.webp 960w, assets/img/scene/${pose}-1536.webp 1536w`;
    im.sizes = "(min-width: 1080px) 60vw, 100vw";
    im.src = `assets/img/scene/${pose}-960.webp`;
    poseCache[pose] = im;
  }

  const POSE_ALT = {
    greet: "茶藝師端坐茶席前，雙手輕放桌邊，準備開始",
    kettle: "茶藝師提起銅壺，向蓋碗注入熱水",
    present: "茶藝師雙手捧着茶荷，請客人欣賞乾茶",
    scoop: "茶藝師以茶撥把茶荷中的茶葉撥入蓋碗",
    pourHigh: "茶藝師高提銅壺，水柱懸空注入蓋碗",
    decant: "茶藝師以三指法持蓋碗，把茶湯倒入公道杯",
    share: "茶藝師持公道杯，低斟茶湯入品茗杯",
    offer: "茶藝師微微欠身，雙手奉上一杯茶",
    sip: "茶藝師雙手持杯，閉目聞香品茗",
    smell: "茶藝師雙手持蓋碗湊近鼻端，閉目聞乾茶香",
    "smell-g": "茶藝師雙手持玻璃杯湊近鼻端，閉目聞茶香",
    "pry": "茶藝師一手托住普洱茶餅，另一手以茶刀從餅邊撬取茶塊",
    "present-c": "茶藝師雙手托起普洱茶餅，請客人欣賞餅面",
    "kettle-g": "茶藝師提起銅壺，沿杯壁向玻璃杯低注熱水，杯中綠茶舒展",
    "scoop-g": "茶藝師以茶撥把茶荷中的綠茶撥入已注水三分一的玻璃杯",
    "offer-g": "茶藝師微微欠身，雙手捧上一杯玻璃杯綠茶",
    "sip-g": "茶藝師雙手持玻璃杯，閉目聞香"
  };
  const CAKE_POSE = { present: "present-c" };
  const GLASS_POSE = { greet: "greet-g", present: "present-g", kettle: "kettle-g", pourHigh: "kettle-g", scoop: "scoop-g", offer: "offer-g", sip: "sip-g", smell: "smell-g" };
  /* 手勢定格：特寫畫面角落顯示真實手勢 */
  const HANDS = {
    grip: { id: "grip", cap: "三指法：拇指、中指扣碗沿，食指按蓋鈕", alt: "右手以三指法持蓋碗，食指按蓋鈕，向公道杯出湯" },
    serve: { id: "serve", cap: "奉茶：一手托杯底，一手輕扶杯身，不碰杯口", alt: "雙手奉上一杯茶，一手托底，一手輕扶杯身" },
    knock: { id: "knock", cap: "叩指禮：食指中指併攏，輕叩桌面", alt: "客人食指與中指併攏，輕叩桌面致謝" }
  };
  const stepHand = (s, t) => (s.id === "pour" ? HANDS.grip : s.id === "serve" && t.vessel !== "glass" ? HANDS.serve : null);

  function renderSteps() {
    const list = visibleSteps();
    $("steps").innerHTML = list
      .map((s, i) => `<li><button type="button" data-i="${i}"><b>${String(i + 1).padStart(2, "0")}</b>${esc(s.name.replace(/（.*）/, ""))}</button></li>`)
      .join("");
  }

  function goStep(i, autoplay) {
    clearTimeout(autoTimer);
    const list = visibleSteps();
    state.step = Math.max(0, Math.min(list.length - 1, i));
    const s = list[state.step], t = state.tea;
    const pose = t.vessel === "glass" ? GLASS_POSE[s.pose] || s.pose : t.cake && CAKE_POSE[s.pose] || s.pose;
    setPose(pose);
    $("sceneNo").textContent = String(state.step + 1).padStart(2, "0");
    $("sceneName").textContent = s.name;
    $("stepCount").textContent = `第 ${state.step + 1} 步・共 ${list.length} 步`;
    $("stepName").textContent = s.name;
    $("stepDesc").textContent = s.desc(t);
    $("stepPoints").innerHTML = pointsOf(s).map((p) => `<li>${esc(p)}</li>`).join("");
    $("stepMistake").textContent = s.mistake;
    const hadFocus = document.activeElement;
    $("prevBtn").disabled = state.step === 0;
    $("nextBtn").disabled = state.step === list.length - 1;
    if ((hadFocus === $("prevBtn") && $("prevBtn").disabled) || (hadFocus === $("nextBtn") && $("nextBtn").disabled)) $("playBtn").focus();
    document.querySelectorAll("#steps button").forEach((b, k) => {
      b.toggleAttribute("aria-current", k === state.step);
      if (k === state.step) b.setAttribute("aria-current", "step");
      b.classList.toggle("done", k < state.step);
    });
    const cur = document.querySelector(`#steps button[data-i="${state.step}"]`);
    if (cur && cur.parentElement.parentElement.scrollWidth > cur.parentElement.parentElement.clientWidth) {
      const ol = cur.parentElement.parentElement;
      ol.scrollTo({ left: cur.parentElement.offsetLeft - ol.clientWidth / 2 + 38, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    const showTimer = ["brew", "pour", "again"].includes(s.id);
    $("timer").hidden = !showTimer;
    if (!showTimer) { clearInterval(tm.id); tm.id = 0; tm.kind = 0; }
    else {
      const kind = s.id === "again" ? 2 : 1;
      if (tm.kind !== kind || tm.tea !== t.id) { resetTimer(kind); tm.kind = kind; tm.tea = t.id; }
    }
    $("stage").setAttribute("aria-label", `${s.name}的手法特寫動畫`);
    stage.load(t, s.clip, !!autoplay, stepHand(s, t));
    const next = list[state.step + 1];
    if (next) preload(t.vessel === "glass" ? GLASS_POSE[next.pose] || next.pose : t.cake && CAKE_POSE[next.pose] || next.pose);
    if (state.step > 0 || autoplay) syncUrl();
  }

  /* ---------- 計時器 ---------- */
  let tm = { n: 1, total: 0, left: 0, id: 0, end: 0, kind: 0, tea: "" };
  function infTime(n) {
    const t = state.tea;
    return D.infTime(t, n);
  }
  function t0max() { return state.tea.steeps.n ? state.tea.steeps.n + 2 : 15; }
  function resetTimer(n) {
    clearInterval(tm.id); tm.id = 0;
    tm.n = Math.max(1, Math.min(t0max(), n));
    tm.total = tm.left = infTime(tm.n);
    $("infLabel").textContent = `第 ${tm.n} 泡`;
    $("timerNum").textContent = tm.left;
    $("timerArc").style.strokeDashoffset = 0;
    $("timerGo").textContent = "開始";
    $("timerStatus").textContent = "";
    $("timer").classList.remove("done");
    const t = state.tea;
    $("timerNote").textContent = t.vessel === "glass" ? "玻璃杯：浸泡後即可品飲，剩三分一便續水" : `${t.name}：${D.steepText(t)}`;
  }
  function tick() {
    tm.left = Math.max(0, Math.ceil((tm.end - performance.now()) / 1000));
    $("timerNum").textContent = Math.max(0, tm.left);
    $("timerArc").style.strokeDashoffset = (119.4 * (1 - tm.left / tm.total)).toFixed(1);
    if (tm.left <= 0) {
      clearInterval(tm.id); tm.id = 0;
      $("timerNum").textContent = "出湯";
      $("timer").classList.add("done");
      $("timerGo").textContent = "下一泡";
      $("timerStatus").textContent = `第 ${tm.n} 泡時間到，請出湯`;
    }
  }
  $("infMinus").onclick = () => resetTimer(tm.n - 1);
  $("infPlus").onclick = () => resetTimer(tm.n + 1);
  $("timerGo").onclick = () => {
    if ($("timer").classList.contains("done")) return resetTimer(tm.n + 1);
    if (tm.id) { tick(); clearInterval(tm.id); tm.id = 0; $("timerGo").textContent = "繼續"; return; }
    tm.end = performance.now() + tm.left * 1000;
    tm.id = setInterval(tick, 250);
    $("timerGo").textContent = "暫停";
  };

  /* ---------- 茶類選擇 ---------- */
  function renderPicker() {
    $("teaPicker").innerHTML = D.teas
      .map((t) => `<button class="chip" type="button" role="radio" aria-checked="${t.id === state.tea.id}" tabindex="${t.id === state.tea.id ? 0 : -1}" data-tea="${t.id}"><span class="dot" style="background:${t.liquor}"></span>${esc(t.name)}</button>`)
      .join("");
  }
  function renderParams() {
    const t = state.tea;
    const items = [
      ["茶具", t.vesselName.split("（")[0]],
      ["水溫", D.tempText(t)],
      ["投茶量", `${t.grams} 克 ／ ${t.ml} 毫升`],
      ["茶水比", t.ratio],
      ["首泡", t.vessel === "glass" ? "浸泡 1–2 分鐘" : `約 ${t.steeps.first} 秒`],
      ["可泡", t.infusions]
    ];
    $("params").innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
    $("params").setAttribute("aria-label", `${t.name}沖泡參數`);
  }
  function setTea(id, keepStep) {
    const prevId = visibleSteps()[state.step] && visibleSteps()[state.step].id;
    state.tea = D.teas.find((t) => t.id === id) || state.tea;
    const pickerFocus = $("teaPicker").contains(document.activeElement);
    renderPicker();
    if (pickerFocus) $("teaPicker").querySelector('[aria-checked="true"]').focus(); renderParams(); renderSteps(); renderTeaDetail();
    const list = visibleSteps();
    let idx = keepStep ? list.findIndex((s) => s.id === prevId) : 0;
    if (idx < 0) idx = 0;
    goStep(idx, false);
    syncUrl();
  }
  function syncUrl() {
    const p = new URLSearchParams(location.search);
    p.set("tea", state.tea.id);
    p.set("step", state.step + 1);
    history.replaceState(null, "", `${location.pathname}?${p}${location.hash}`);
  }

  $("teaPicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tea]");
    if (b) setTea(b.dataset.tea, true);
  });
  $("teaPicker").addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const i = D.teas.findIndex((t) => t.id === state.tea.id);
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + D.teas.length) % D.teas.length;
    setTea(D.teas[n].id, true);
    document.querySelector(`[data-tea="${D.teas[n].id}"]`).focus();
    e.preventDefault();
  });
  $("steps").addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) { goStep(+b.dataset.i, true); showCloseup(); }
  });
  $("prevBtn").onclick = () => { goStep(state.step - 1, true); showCloseup(); };
  $("nextBtn").onclick = () => { goStep(state.step + 1, true); showCloseup(); };
  /* 畫面風格、音效、背景音樂 */
  const paintStyle = () => { const st = TeaStage.getStyle(); $("styleR").setAttribute("aria-pressed", st === "R"); $("styleI").setAttribute("aria-pressed", st === "I"); };
  $("styleR").onclick = () => { TeaStage.setStyle("R"); paintStyle(); renderTools(); };
  $("styleI").onclick = () => { TeaStage.setStyle("I"); paintStyle(); renderTools(); };
  paintStyle();
  if (window.TeaAudio) {
    const paintAudio = (a) => {
      $("sfxBtn").setAttribute("aria-pressed", a.sfx); $("sfxBtn").setAttribute("aria-label", a.sfx ? "音效：開" : "音效：關");
      $("musicBtn").setAttribute("aria-pressed", a.music); $("musicBtn").setAttribute("aria-label", a.error ? a.error : a.music ? "背景音樂：開" : "背景音樂：關"); $("musicBtn").title = a.error || "";
      $("trackSel").hidden = !a.music; $("trackSel").value = a.track;
    };
    $("trackSel").innerHTML = TeaAudio.tracks.map((t) => `<option value="${t.id}">${t.name}</option>`).join("");
    $("trackSel").onchange = (e) => TeaAudio.setTrack(e.target.value);
    TeaAudio.onChange(paintAudio);
    $("sfxBtn").onclick = () => TeaAudio.setSfx(!TeaAudio.sfx);
    $("musicBtn").onclick = () => TeaAudio.setMusic(!TeaAudio.music);
  } else { $("sfxBtn").hidden = $("musicBtn").hidden = $("trackSel").hidden = true; }
  const showCloseup = () => {
    if (innerWidth > 760) return;
    const r = $("stage").getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 140) $("stage").closest(".closeup").scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  $("playBtn").onclick = () => { clearTimeout(autoTimer); stage.toggle(); if (stage.playing) showCloseup(); };
  $("replayBtn").onclick = () => { clearTimeout(autoTimer); stage.replay(); };
  $("speedBtn").onclick = () => {
    state.speed = state.speed === 1 ? 0.5 : state.speed === 0.5 ? 1.5 : 1;
    stage.setSpeed(state.speed);
    $("speedBtn").textContent = `${state.speed}×`;
    $("speedBtn").setAttribute("aria-label", `${state.speed}× 播放速度`);
  };
  $("autoBtn").onchange = (e) => {
    state.auto = e.target.checked;
    if (!state.auto) { clearTimeout(autoTimer); return; }
    if (!stage.playing) stage.replay();
  };
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.target.closest("input, textarea, select, [contenteditable], [role=radiogroup], [role=tablist]")) return;
    const r = $("demo").getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (e.key === "ArrowRight") goStep(state.step + 1, true);
    else if (e.key === "ArrowLeft") goStep(state.step - 1, true);
  });

  /* ---------- 茶類百科 ---------- */
  let detailTab = "brew";
  function renderTeaGrid() {
    $("teaGrid").innerHTML = D.teas
      .map((t) => `<button class="tea-card" type="button" data-tea="${t.id}" aria-pressed="${t.id === state.tea.id}">
        <span class="cup" aria-hidden="true"><i style="background:${t.liquor}"></i></span>
        <h3>${esc(t.name)}</h3><p>${esc(t.family)}<br>${esc(t.examples.slice(0, 3).join("・"))}</p></button>`)
      .join("");
  }
  function renderTeaDetail() {
    const t = state.tea;
    document.querySelectorAll(".tea-card").forEach((c) => c.setAttribute("aria-pressed", c.dataset.tea === t.id));
    const tabs = [["brew", "泡法"], ["nature", "茶性與保健"], ["people", "適合人群"], ["history", "歷史講解"]];
    let body = "";
    if (detailTab === "brew") {
      body = `<dl class="kv">
        <div><dt>茶具</dt><dd>${esc(t.vesselName)}</dd></div>
        <div><dt>水溫</dt><dd>${D.tempText(t)}</dd></div>
        <div><dt>投茶量</dt><dd>${t.grams} 克 ／ ${t.ml} 毫升</dd></div>
        <div><dt>茶水比</dt><dd>${esc(t.ratio)}</dd></div>
        <div><dt>出湯時間</dt><dd>${t.vessel === "glass" ? "浸泡 1–2 分鐘" : `首泡約 ${t.steeps.first} 秒`}</dd></div>
        <div><dt>可泡次數</dt><dd>${esc(t.infusions)}</dd></div></dl>
        <div class="td-grid" style="margin-top:18px">
          <div class="td-block"><h4>續泡</h4><p>${esc(D.steepText(t))}。</p></div>
          <div class="td-block"><h4>潤茶</h4><p>${t.rinse ? esc(t.rinse.note) : "不需要洗茶，直接沖泡，以免香氣流失。"}</p></div>
        </div>
        <p class="note">${esc(t.tips)}</p>`;
    } else if (detailTab === "nature") {
      body = `<div class="td-grid">
        <div class="td-block"><h4>茶性</h4><p>${esc(t.nature)}</p><h4 style="margin-top:14px">風味</h4><p>${esc(t.taste)}</p></div>
        <div class="td-block"><h4>保健與特點</h4><ul>${t.benefits.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div></div>
        <p class="note">以上屬茶文化及一般飲食知識，不能代替醫療意見。</p>`;
    } else if (detailTab === "people") {
      body = `<div class="td-grid">
        <div class="td-block"><h4>適合</h4><ul>${t.suitable.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>
        <div class="td-block"><h4>宜留意</h4><ul>${t.caution.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div></div>`;
    } else {
      body = `<p class="td-history">${esc(t.history)}</p><div class="td-block" style="margin-top:16px"><h4>代表茶</h4><p>${esc(t.examples.join("・"))}</p></div>`;
    }
    $("teaDetail").innerHTML = `<div class="td-head"><div><h3>${esc(t.name)}</h3><p>${esc(t.family)}・示範用茶：${esc(t.sample)}</p></div>
      <button class="td-btn" type="button" id="tdDemo">用這款茶示範泡法</button></div>
      <div class="td-tabs" role="tablist" aria-label="${esc(t.name)}資料">${tabs.map(([k, n]) => `<button class="td-tab" type="button" role="tab" id="tdtab-${k}" aria-controls="tdpanel" data-tab="${k}" aria-selected="${k === detailTab}" tabindex="${k === detailTab ? 0 : -1}">${n}</button>`).join("")}</div>
      <div role="tabpanel" id="tdpanel" aria-labelledby="tdtab-${detailTab}" tabindex="0">${body}</div>`;
  }
  $("teaGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tea]");
    if (!b) return;
    setTea(b.dataset.tea, true);
  });
  $("teaDetail").addEventListener("keydown", (e) => {
    if (!e.target.closest("[data-tab]") || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const keys = ["brew", "nature", "people", "history"];
    const i = keys.indexOf(detailTab);
    detailTab = keys[e.key === "Home" ? 0 : e.key === "End" ? 3 : (i + (e.key === "ArrowRight" ? 1 : 3)) % 4];
    renderTeaDetail(); document.querySelector(`[data-tab="${detailTab}"]`).focus(); e.preventDefault();
  });
  $("teaDetail").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { detailTab = tab.dataset.tab; renderTeaDetail(); document.querySelector(`[data-tab="${detailTab}"]`).focus(); return; }
    if (e.target.closest("#tdDemo")) {
      goStep(0, true);
      $("demo").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      $("playBtn").focus({ preventScroll: true });
    }
  });

  /* ---------- 技巧 ---------- */
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)");
  const stage2 = window.__teaStage2 = TeaStage.createStage($("stage2"), { onState: (playing) => { $("skillPlay").setAttribute("aria-label", playing ? "暫停技巧動畫" : "播放技巧動畫"); $("skillPlayIcon").setAttribute("d", playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5v14l11-7z"); }, onLabel: (tx) => setLabel($("cuLabel2"), tx), onFrame: (st, playing) => window.TeaAudio && TeaAudio.feed("skill", st, playing), onIdle: () => window.TeaAudio && TeaAudio.stop("skill") });
  const skillTea = (sk) => (sk.clip === "phoenix" ? D.teas[0] : D.teas.find((t) => t.id === "oolong"));
  let skillIdx = 0;
  function renderSkills() {
    $("skillList").innerHTML = D.techniques
      .map((s, i) => `<button class="skill-tab" type="button" role="tab" id="sktab-${i}" aria-controls="skillBody" data-k="${i}" aria-selected="${i === skillIdx}" tabindex="${i === skillIdx ? 0 : -1}">${esc(s.name)}</button>`)
      .join("");
  }
  function showSkill(i, play) {
    skillIdx = i;
    const s = D.techniques[i];
    document.querySelectorAll(".skill-tab").forEach((b, k) => { b.setAttribute("aria-selected", k === i); b.tabIndex = k === i ? 0 : -1; });
    $("skillBody").setAttribute("aria-labelledby", `sktab-${i}`);
    $("skillBody").innerHTML = `<h3>${esc(s.name)}</h3><p>${esc(s.what)}</p>
      <h4 class="mini-h">做法</h4><ol>${s.how.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
      <h4 class="mini-h">為甚麼</h4><p style="color:var(--ink-2);margin-bottom:12px">${esc(s.why)}</p>
      <div class="mistake"><b>常見錯誤</b><span>${esc(s.mistake)}</span></div>`;
    $("stage2").setAttribute("aria-label", `${s.name}特寫動畫`);
    stage2.load(skillTea(s), s.clip, play && !REDUCE.matches, s.id === "grip" ? HANDS.grip : s.id === "knock" ? HANDS.knock : null);
  }
  $("skillList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (b) showSkill(+b.dataset.k, true);
  });
  $("skillList").addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const n = (skillIdx + d + D.techniques.length) % D.techniques.length;
    showSkill(n, true);
    document.querySelector(`[data-k="${n}"]`).focus();
    e.preventDefault();
  });
  $("skillReplay").onclick = () => stage2.replay();
  $("skillPlay").onclick = () => stage2.toggle();
  const io = "IntersectionObserver" in window ? new IntersectionObserver((en) => {
    en.forEach((x) => { if (x.isIntersecting) { if (!REDUCE.matches) stage2.replay(); io.disconnect(); } });
  }, { threshold: 0.4 }) : null;

  /* ---------- 水溫 ---------- */
  function renderWater() {
    const min = 70, max = 100;
    const pct = (v) => ((v - min) / (max - min)) * 100;
    const rows = D.teas
      .map((t) => {
        const a = t.temp[0], b = t.temp[1];
        const left = pct(a), w = Math.max(0, pct(b) - pct(a));
        return `<div class="tc-row"><span class="tc-name">${esc(t.name)}</span>
          <span class="tc-track"><span class="tc-bar" style="left:calc(${left}% - ${w ? 0 : 6}px);width:${w ? w + "%" : "12px"};background:${t.liquorDeep}"></span></span>
          <span class="tc-val">${D.tempText(t)}</span></div>`;
      })
      .join("");
    $("tempChart").innerHTML = rows + `<div class="tc-axis"><span></span><div><span>70°C</span><span>80°C</span><span>90°C</span><span>100°C</span></div><span></span></div>`;
    $("tempChart").setAttribute("aria-label", "各茶類建議水溫：" + D.teas.map((t) => `${t.name}${D.tempText(t)}`).join("，"));
    $("waterNotes").innerHTML = D.water.map((w) => `<div class="wn"><h3>${esc(w.title)}</h3><p>${esc(w.body)}</p></div>`).join("");
  }

  /* ---------- 茶具 ---------- */
  const TOOL_IMG = { gaiwan: "tools/gaiwan", pitcher: "kit/{s}/pitcher", cup: "kit/{s}/cup", chahe: "kit/{s}/chahe", chaze: "kit/{s}/scoop", chabo: "kit/{s}/pick", tongs: "kit/{s}/tongs", wash: "kit/{s}/wash", vase: "kit/{s}/vase", kettle: "kit/{s}/kettle", glass: "kit/{s}/tumbler", towel: "kit/{s}/towel" };
  function renderTools() {
    const st = TeaStage.getStyle();
    $("toolGrid").innerHTML = D.tools
      .map((t) => `<div class="tool"><span class="tool-img" aria-hidden="true"><img src="assets/img/${TOOL_IMG[t.id].replace("{s}", st)}${t.id === "gaiwan" ? "-" + st : ""}.webp" alt="" loading="lazy" decoding="async"></span>
        <h3>${esc(t.name)}${t.alias ? `<small>${esc(t.alias)}</small>` : ""}</h3><p>${esc(t.desc)}</p></div>`)
      .join("");
  }

  /* ---------- 測驗 ---------- */
  let qi = 0, score = 0;
  function renderQuiz() {
    const box = $("quizBox");
    if (qi >= D.quiz.length) {
      const msg = score === D.quiz.length ? "全部答對，基本流程和要點已經記熟。下一步是親手練習，水溫、手勢和出湯時間要靠實際沖泡掌握。" : score >= 6 ? "基礎紮實，回看答錯的部分便更完整。" : "再看一次示範和茶類百科，很快便能掌握。";
      const cta = document.documentElement.classList.contains("embed") ? "" : `<a class="td-btn ghost" href="#learn">親手學泡茶</a>`;
      box.innerHTML = `<div class="q-score"><b>${score} / ${D.quiz.length}</b><p>${msg}</p><div class="q-acts"><button class="td-btn" type="button" id="qAgain">再做一次</button>${cta}</div></div>`;
      $("qAgain").onclick = () => { qi = 0; score = 0; renderQuiz(); $("quizBox").querySelector("button").focus(); };
      return;
    }
    const q = D.quiz[qi];
    box.innerHTML = `<div class="q-meta"><span>第 ${qi + 1} 題・共 ${D.quiz.length} 題</span><span>答對 ${score} 題</span></div>
      <div class="q-bar"><span style="width:${(qi / D.quiz.length) * 100}%"></span></div>
      <p class="q-text" id="qText" tabindex="-1">${esc(q.q)}</p>
      <div class="q-opts" role="group" aria-labelledby="qText">${q.options.map((o, i) => `<button class="q-opt" type="button" data-o="${i}">${esc(o)}</button>`).join("")}</div>
      <div id="qAfter" aria-live="polite"></div>`;
  }
  $("quizBox").addEventListener("click", (e) => {
    const b = e.target.closest("[data-o]");
    if (b) {
      const q = D.quiz[qi], pick = +b.dataset.o;
      const right = pick === q.answer;
      if (right) score++;
      $("quizBox").querySelectorAll(".q-opt").forEach((o, i) => {
        o.disabled = true;
        if (i === q.answer) o.classList.add("right");
        else if (i === pick) o.classList.add("wrong");
      });
      $("qAfter").innerHTML = `<p class="q-why"><b>${right ? "答對了。" : "未答對。"}</b>${esc(q.why)}</p>
        <button class="td-btn q-next" type="button" id="qNext">${qi === D.quiz.length - 1 ? "看成績" : "下一題"}</button>`;
      $("qNext").focus();
      return;
    }
    if (e.target.closest("#qNext")) { qi++; renderQuiz(); const f = $("qText") || $("quizBox").querySelector("button"); f && f.focus(); }
  });

  /* ---------- 內嵌高度 ---------- */
  if (window.parent !== window && "ResizeObserver" in window) {
    new ResizeObserver(() => window.parent.postMessage({ type: "tea-lesson-height", height: document.documentElement.scrollHeight }, "*")).observe(document.body);
  }

  /* ---------- 啟動 ---------- */
  renderPicker(); renderParams(); renderSteps(); renderTeaGrid(); renderTeaDetail(); renderSkills(); renderWater(); renderTools(); renderQuiz();
  const startStep = Math.max(0, (+params.get("step") || 1) - 1);
  goStep(startStep, false);
  showSkill(0, false);
  if (io) io.observe($("stage2"));
})();
