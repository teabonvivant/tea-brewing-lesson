# 茶席・中國茶藝泡茶流程教學

純靜態網頁（HTML／CSS／原生 JavaScript，無建置步驟），可直接放進任何網站。

## 內容
- **泡茶流程示範**：11 步（備具迎客 → 續泡收具）。左邊是茶室場景（漢服茶藝師，每步換動作圖），右邊是 SVG 手法特寫動畫＋要點＋常見錯誤；沖泡／出湯／續泡步有泡茶計時器（按茶類及第幾泡計秒）。
- **八種茶**：綠茶、白茶、黃茶、烏龍茶、紅茶、普洱生茶、普洱熟茶、茉莉花茶。選茶後流程、水溫、投茶量、時間自動切換；綠茶、黃茶用玻璃杯流程（8 步）。
- **茶類百科**：泡法、茶性與保健、適合人群、歷史講解。
- **常用技巧**：蓋碗三指法、懸壺高沖、鳳凰三點頭、高沖低斟、關公巡城、韓信點兵、聞香三法、叩指禮（各有特寫動畫）。
- **水溫與用水**、**認識茶具**、**8 題小測驗**。

## 檔案
- `index.html`：頁面骨架
- `assets/js/data.js`：**所有教學內容**（改文字、參數只改這裏）
- `assets/js/stage.js`：特寫動畫（茶具繪畫＋每步關鍵幀）
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
