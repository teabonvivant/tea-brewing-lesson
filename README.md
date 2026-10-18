# 茶席・中國茶藝泡茶流程教學

純靜態網頁（HTML／CSS／原生 JavaScript，無建置步驟），可直接放進任何網站。

## 內容
- **泡茶流程示範**：11 步（備具迎客 → 續泡收具）。左邊是茶室場景（漢服茶藝師，每步換動作圖），右邊是手法特寫動畫（真實茶具單品圖＋光影、水流、水氣、鏡頭推近）＋要點＋常見錯誤；沖泡／出湯／續泡步有泡茶計時器（按茶類及第幾泡計秒）。
- **八種茶**：綠茶、白茶、黃茶、烏龍茶、紅茶、普洱生茶、普洱熟茶、茉莉花茶。選茶後流程、水溫、投茶量、時間自動切換；綠茶、黃茶用玻璃杯流程（8 步）。
- **茶類百科**：泡法、茶性與保健、適合人群、歷史講解。
- **常用技巧**：蓋碗三指法、懸壺高沖、鳳凰三點頭、高沖低斟、關公巡城、韓信點兵、聞香三法、叩指禮（各有特寫動畫）。
- **水溫與用水**、**認識茶具**、**8 題小測驗**。

## 手法特寫（v2）
- **茶具**：銅壺、紅泥爐、青花蓋碗（碗／碟／蓋分開，蓋碗倒茶時碗身傾斜、碟留原位）、玻璃公道杯、品茗杯、玻璃杯、青瓷茶荷、茶罐、茶巾，另有 8 款茶各自的乾茶堆及葉底。全部是 Codex 生成的單品圖，去背後做成圖層動畫。
- **兩套風格**（特寫右上角「寫實／繪本」切換，記在瀏覽器 `localStorage: tea-style`）：寫實＝產品攝影質感；繪本＝水彩繪本質感，與左邊茶室場景一致。
- **動畫**：茶湯跟茶類變色、液面隨傾斜保持水平、水流帶狀＋水花＋漣漪、茶水熱氣、炭火閃動、玻璃杯內茶葉翻動、鏡頭按動作自動推近（`prefers-reduced-motion` 時關閉）。
- **音效與背景音樂**（兩個獨立開關，預設關，記在 `localStorage: tea-audio`）：音效由 Web Audio 即時合成（倒水聲隨水位升高、瓷器／玻璃／木／銅碰聲、茶葉沙沙聲、計時鈴聲、品茗啜聲），不載入音檔；背景音樂 `assets/audio/tea-music.mp3`（約 71 秒循環，自製合成，無版權問題），按下開關才載入。

## 檔案
- `index.html`：頁面骨架
- `assets/js/data.js`：**所有教學內容**（改文字、參數只改這裏）
- `assets/js/stage.js`：特寫動畫（每步關鍵幀＋圖層繪製＋特效＋鏡頭）
- `assets/js/kit.js`：茶具單品圖的尺寸、錨點（口沿橢圓、壺嘴、液面範圍等，以圖片寬高比例記）及兩套風格的版面；換圖或調位置只改這裏
- `assets/js/audio.js`：音效與背景音樂
- `assets/img/kit/R|I/`：單品圖（WebP 透明底）及背景；每套約 0.55–0.6 MB，只載入當前風格
- `assets/js/app.js`：介面邏輯
- `assets/css/app.css`：外觀（顏色變數在 `:root`）
- `assets/img/scene/`：茶室場景 9 張（`<動作>-960.webp`／`-1536.webp`）
- `assets/fonts/tea-serif.woff2`：標題用思源宋體子集。**改了標題、茶名、步驟名或技巧名後**要重跑：`python3 _work/tools/build_font.py "$PWD"`（`_work/` 不入 git，需本機）。

## 網址參數
- `?tea=green|white|yellow|oolong|black|shengpu|shoupu|jasmine` 預選茶
- `&step=3` 直接開第幾步
- `&embed=1` 內嵌模式（隱藏頂欄）

## 放進網站
**方法一（建議）**：把整個資料夾（不含 `_work/`）複製到網站，例如 Astro 的 `public/tea-lesson/`，網址 `/tea-lesson/`。
同時刪除 `index.html` 內 `<meta name="robots" content="noindex">`（預覽期間防止被搜尋器收錄）。

**方法二**：iframe 內嵌（高度自動）：
```html
<iframe id="tea-lesson" src="https://teabonvivant.github.io/tea-brewing-lesson/?embed=1" title="中國茶藝泡茶流程教學" loading="lazy" style="width:100%;border:0;min-height:900px"></iframe>
<script>
addEventListener("message", (e) => {
  if (e.data && e.data.type === "tea-lesson-height") document.getElementById("tea-lesson").style.height = e.data.height + "px";
});
</script>
```

## 測試
`_work/tools/e2e.py`（Playwright）：切茶、逐步、計時、自動連播、百科分頁、技巧、測驗、內嵌模式。

## 重做單品圖（本機，`_work/` 不入 git）
1. `_work/gen2/gen.py <圖表>:<R|I>` 以 Codex 生成圖表（porcelain、parts、glass、kettle、chahe、dry、wet、bg）；玻璃圖用純黑底。
2. `_work/kit/cut.py R I` 去背景（rembg isnet）；玻璃以亮度轉透明度。`_work/kit/build_assets.py` 轉 WebP 並寫入 `assets/img/kit/`。
3. 在 `kit.js` 校正錨點；`_work/tools/clipshot.py`、`review.py`、`e2e_kit.py` 截圖檢查及逐幀測試（8 茶 × 14 動畫 × 8 幀無 NaN）。
