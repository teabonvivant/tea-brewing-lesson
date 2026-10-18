# 茶席・中國茶藝泡茶流程教學

純靜態網頁（HTML／CSS／原生 JavaScript，無建置步驟），可直接放進任何網站。

## 內容
- **泡茶流程示範**：11 步（備具迎客 → 續泡收具）。左邊是茶室場景（漢服茶藝師，每步換動作圖），右邊是手法特寫動畫（真實茶具單品圖＋光影、水流、水氣、鏡頭推近）＋要點＋常見錯誤；沖泡／出湯／續泡步有泡茶計時器（按茶類及第幾泡計秒）。
- **八種茶**：綠茶、白茶、黃茶、烏龍茶、紅茶、普洱生茶、普洱熟茶、茉莉花茶。選茶後流程、水溫、投茶量、時間自動切換；綠茶、黃茶用玻璃杯流程（8 步）。
- **茶類百科**：泡法、茶性與保健、適合人群、歷史講解。
- **常用技巧**：蓋碗三指法、懸壺高沖、鳳凰三點頭、高沖低斟、關公巡城、韓信點兵、聞香三法、叩指禮（各有特寫動畫）。
- **水溫與用水**、**認識茶具**（實物單品圖，跟隨寫實／繪本切換）、**8 題小測驗**。
- **報名區** `#learn`：WhatsApp 唐老師（6380 2761）及課程頁 organict.net/teaclass；頂欄「報名」掣及測驗完成頁都連到這裏。內嵌模式（`?embed=1`）自動隱藏，由主網站提供報名入口。

## 手法特寫（v2）
- **茶具**：銅壺、紅泥爐、青花蓋碗（碗／碟／蓋分開，蓋碗倒茶時碗身傾斜、碟留原位）、玻璃公道杯、品茗杯、玻璃杯、青瓷茶荷、茶罐、茶巾，另有 8 款茶各自的乾茶堆及葉底。全部是 Codex 生成的單品圖，去背後做成圖層動畫。
- **兩套風格**（特寫右上角「寫實／繪本」切換，記在瀏覽器 `localStorage: tea-style`）：寫實＝產品攝影質感；繪本＝水彩繪本質感，與左邊茶室場景一致。
- **手勢定格**：出湯步及「蓋碗三指法」顯示三指法實拍手勢，奉茶步顯示雙手奉杯，「叩指禮」顯示叩指手勢（`assets/img/hands/<grip|serve|knock>-<R|I>.webp`，Codex 生成，逐張放大檢查手指數目及握點）。
- **水溫／計時標示**是疊在特寫上的 HTML（`.cu-temp`、`.cu-timer`），鏡頭推近時不會被裁走；計時出現時同時標「示範已加快」。
- **關公巡城、韓信點兵**按潮汕做法由蓋甌直接巡斟、點滴入杯（不用公道杯）。
- **動畫**：茶湯跟茶類變色、液面隨傾斜保持水平、水流帶狀＋水花＋漣漪、茶水熱氣、炭火閃動、玻璃杯內茶葉翻動、鏡頭按動作自動推近（`prefers-reduced-motion` 時關閉）。
- **音效與背景音樂**（兩個獨立開關，預設關，記在 `localStorage: tea-audio`）：音效由 Web Audio 即時合成（倒水聲隨水位升高、瓷器／玻璃／木／銅碰聲、茶葉沙沙聲、計時鈴聲、品茗啜聲），不載入音檔；背景音樂為 5 首古琴古曲 `assets/audio/guqin-*.mp3`（CharlieHuang 演奏，Wikimedia Commons，CC BY 2.5，頁腳已署名），由 `_work/audio/guqin.py` 去直流／降噪、加合成廳堂殘響、統一響度 −20 LUFS；開音樂後可選曲目，播完自動接下一首，按下開關才載入當前一首。

## 檔案
- `index.html`：頁面骨架
- `assets/js/data.js`：**所有教學內容**（改文字、參數只改這裏）
- `assets/js/stage.js`：特寫動畫（每步關鍵幀＋圖層繪製＋特效＋鏡頭）
- `assets/js/kit.js`：茶具單品圖的尺寸、錨點（口沿橢圓、壺嘴、液面範圍等，以圖片寬高比例記）及兩套風格的版面；換圖或調位置只改這裏
- `assets/js/audio.js`：音效與背景音樂
- `assets/img/kit/R|I/`：單品圖（WebP 透明底）及背景；每套約 0.55–0.6 MB，只載入當前風格
- `assets/js/app.js`：介面邏輯
- `assets/css/app.css`：外觀（顏色變數在 `:root`）
- `assets/img/scene/`：茶室場景 9 張（`<動作>-960.webp`／`-1536.webp`），另有玻璃杯流程 4 張（`kettle-g`、`scoop-g`、`offer-g`、`sip-g`，綠茶、黃茶自動使用）；生成腳本 `_work/gen3/mk3.py`
- `assets/fonts/tea-serif.woff2`：標題用思源宋體子集。**改了標題、茶名、步驟名或技巧名後**要重跑：`python3 _work/tools/build_font.py "$PWD"`（`_work/` 不入 git，需本機）。

## 網址參數
- `?tea=green|white|yellow|oolong|black|shengpu|shoupu|jasmine` 預選茶
- `&step=3` 直接開第幾步
- `&embed=1` 內嵌模式（隱藏頂欄）

## 放進網站
**方法一（建議）**：把整個資料夾（不含 `_work/`）複製到網站，例如 Astro 的 `public/tea-lesson/`，網址 `/tea-lesson/`。
同時刪除 `index.html` 內 `<meta name="robots" content="noindex">`（預覽期間防止被搜尋器收錄），並把 `canonical`、`og:url`、`og:image` 的絕對網址改成正式網址。

**方法二**：iframe 內嵌（高度自動）：
```html
<iframe id="tea-lesson" src="https://teabonvivant.github.io/tea-brewing-lesson/?embed=1" title="中國茶藝泡茶流程教學" loading="lazy" style="width:100%;border:0;min-height:900px"></iframe>
<script>
addEventListener("message", (e) => {
  if (e.origin !== "https://teabonvivant.github.io") return;
  if (e.data && e.data.type === "tea-lesson-height" && Number.isFinite(e.data.height)) document.getElementById("tea-lesson").style.height = e.data.height + "px";
});
</script>
```

## 測試
`_work/tools/e2e.py`（Playwright）：切茶、逐步、計時、自動連播、百科分頁、技巧、測驗、內嵌模式。
`_work/tools/e2e_fix.py`：2026-10-18 缺點修正回歸測試（計時器下一泡、取消自動連播、手勢定格、水溫標示不被裁、頁籤方向鍵、內容更正、報名連結、玻璃杯場景、手機排列）。

## 重做單品圖（本機，`_work/` 不入 git）
1. `_work/gen2/gen.py <圖表>:<R|I>` 以 Codex 生成圖表（porcelain、parts、glass、kettle、chahe、dry、wet、bg）；玻璃圖用純黑底。
2. `_work/kit/cut.py R I` 去背景（rembg isnet）；玻璃以亮度轉透明度。`_work/kit/build_assets.py` 轉 WebP 並寫入 `assets/img/kit/`。
3. 在 `kit.js` 校正錨點；`_work/tools/clipshot.py`、`review.py`、`e2e_kit.py` 截圖檢查及逐幀測試（8 茶 × 14 動畫 × 8 幀無 NaN）。

## 2026-10-18 真實感修正（第三輪）

- 蓋碗合蓋：碗蓋縮至碗口約 91%，碗身前緣另疊一層（`R.gFront`）遮住蓋沿，蓋坐入碗口；出湯時蓋退後留縫（`lidGap`）。
- 品茗杯改品字形（後左、前中、後右）；公道杯低斟按同一排杯計算最低不相碰高度（`pitchClear`），斟茶時按目標杯排次調整前後層。
- 關公巡城改為連續三輪添斟、出湯口離杯口約 1–2 cm；韓信點兵貼近杯口、傾角 112°；`pTarget` 改為逐杯跳換（字串），不再在杯之間插值。
- 奉茶不再把杯放大，落在茶盤前的桌面；品茗時杯會傾斜；字幕「杯底留香」移到飲後；奉茶／品茗不顯示沖泡水溫。
- 玻璃杯注水時壺嘴在杯口上方；倒溫杯水提杯傾 112° 並有出水；蓋碗溫杯後三杯逐一傾倒。
- 投茶：乾茶逐粒滑落（以乾茶實拍圖作紋理），茶荷低至器口上方。
- 評審記錄 `_team_runs/real-20261018/`（Codex 顧問意見）；回歸測試 `_work/tools/e2e_real.py`。


## 2026-10-18 擺位對齊場景圖（第四輪）

- 特寫擺位改為與左邊人物場景一致：三杯一字排在蓋碗前方（茶盤內）、公道杯在杯排右後方（嘴朝左，單品圖已鏡像，傾角為負）、壺爐＋茶罐＋茶荷在左、茶巾在右、新增茶筒（`holder.webp`）。擺位表在 `stage.js` 開頭 `HOME`。
- 背景重做：深色木茶盤、兩端可見（`assets/img/kit/R|I/bg.webp`，Codex 生成；舊版備份在 `_work/kit/orig/`，生成腳本 `_work/gen4/run.py`、`run2.py`，去背 `_work/gen4/cut4.py`）。
- 蓋碗在備具、賞茶、分茶、奉茶、品茗時合蓋；注水、投茶、潤茶、續水開頭先開蓋。巡城／點兵時蓋碗疊在杯排之前。奉茶落在客人右前方。
- 測試：`_work/tools/e2e_layout.py`（擺位幾何與公道杯對準杯口）。

## 2026-10-18 茶席重排（第五輪，Oliver 按實物茶席圖指示）

- 擺位規則：茶盤居中且加大（約佔舞台寬 65%，`HOME.trayRect`）；蓋碗與公道杯分列茶盤中線兩側；**品茗杯排在茶盤外、盤與客人之間的桌面**；水洗在右上；茶巾在右前；茶筒在右；壺爐、茶罐、茶荷（附茶撥）、茶夾在左前；左前一瓶插花（梅枝）。人物場景 13 張全部按此重生（Codex，以 `_work/gen5/master2.png` 為參考，腳本 `_work/gen5/run.py`、`scenes.py`）。
- 新單品圖：水洗 `wash`、茶夾 `tongs`、茶撥 `pick`、插花瓶 `vase`（寫實／繪本，`_work/gen5/sheet5_*.png` → `cut5.py`；錨點在 `kit.js`，`kit.js` 的 `WS` 可按風格覆寫寬度）。背景換成大茶盤（`bg2_R/I`，繪本版以仿射變換對齊寫實版茶盤）。
- 動畫：溫杯用茶夾夾起品茗杯（`tg`／`tgi`）、倒入水洗（`sC`、`aimCupToWash`）；潤茶湯倒入水洗（`sGTarget:"wash"`）；玻璃杯溫杯水倒入水洗（`aimGlassToWash`）；投茶時茶撥抬起撥茶（`hp`／`hpw`）。預設鏡頭改為全景（z=1），水溫標示移到右下。
- 內容：備具、溫杯、投茶、潤茶文字更新；茶具卡新增茶撥、茶夾、水洗、茶席插花；技巧新增「茶夾溫杯」。
- 測試：`_work/tools/e2e_layout.py` 重寫（杯在盤外、對稱、水洗接水對準、茶夾、茶撥等 22 項 × 兩風格）。舊場景圖備份 `_work/scene_old/`、舊背景 `_work/gen5/old_bg_*.webp`。

## 2026-10-18 公道杯移到身前＋音效重做（第六輪）

- 擺位：公道杯放在茶盤後半、人物身前（近茶盤中線，`HOME.pitcher`），蓋碗在其左側稍前（`HOME.gaiwan`），兩者相距約 8 cm；蓋碗倒入公道杯時碗口離杯口約 2–3 cm（`gaiwanPour` 的 20px 懸空）。人物場景 13 張按此重生（`_work/gen5/run6.py`→`master3.png`、`scenes.py`、`install6.py`）。
- 品茗杯加深色小杯托（特寫 SVG，對齊人物場景）。
- 茶湯色：8 款茶色改為更通透的琥珀／翠金／石榴紅；液面明暗漸層加入暖色。
- 音效：全部重寫為柔和版——水聲改為大量細小水泡（音高上滑的正弦）疊成，水位愈高音高愈高；瓷／玻璃碰聲只留少量泛音、去掉噪音敲擊；移除木敲、沸騰嘶聲、隨機氣泡；總線加 4.8 kHz 低通＋廳堂殘響，總音量下調（約 −30 dBFS 級，低於背景音樂）。
- 測試：`e2e_layout.py` 公道杯規則改為「近中線、比蓋碗更近人、蓋碗在其左 40–150px」。
