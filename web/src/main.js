import "./style.css";
import {
  PRINTER_HEIGHT,
  PRINTER_WIDTH,
  canvasTo2bpp,
  makePrintJob,
  pingPrinter,
  sendPrintJob,
  waitForPrinterIdle,
} from "./gb-printer.js";
import { PrinterTransport } from "./transport.js";

const APP_VERSION = "1.3.3";
// Diagnostic print logging is retained for future troubleshooting.
// Set this flag to true to restore the on-screen protocol log.
const PRINT_LOG_ENABLED = false;
const useRussian = /^(ru|uk|be)(-|$)/i.test(navigator.language || "");
const tr = (ru, en) => useRussian ? ru : en;
document.documentElement.lang = useRussian ? "ru" : "en";
const PNG_FRAME_IDS = new Set([0, 18, 20]);
const framePath = (id) => `./frames/frame-${id}.${PNG_FRAME_IDS.has(Number(id)) ? "png" : "svg"}`;

document.querySelector("#app").innerHTML = `
  <main class="shell">
    <header>
      <button id="aboutOpen" class="brand-button" type="button" aria-label="${tr("О приложении", "About")}"><img class="brand-logo" src="./pixel-duck.png" alt="Pixel Duck"></button>
      <div><p class="eyebrow">ANDROID BOY</p><h1>Camera</h1></div>
      <button id="connect" class="connection"><span></span><b>${tr("Статус", "Status")}</b></button>
    </header>

    <nav class="mode-tabs">
      <button id="cameraTab" class="active" type="button">${tr("Камера", "Camera")}</button>
      <button id="collageTab" type="button">${tr("Коллаж", "Collage")} <span id="collageCount">0</span></button>
    </nav>
    <div id="cameraView">
    <section class="camera-card">
      <div class="viewfinder">
        <video id="video" playsinline muted></video>
        <canvas id="preview" width="${PRINTER_WIDTH}" height="${PRINTER_HEIGHT}"></canvas>
        <div class="scanline"></div>
        <p id="cameraHint">${tr("Разрешите доступ к камере", "Allow camera access")}</p>
        <div class="corners" aria-hidden="true"></div>
      </div>
      <div id="frameCarousel" class="frame-carousel" aria-label="${tr("Выбор рамки", "Frame selection")}">
        <button class="frame-thumb no-frame active" type="button" data-frame="" aria-label="${tr("Без рамки", "No frame")}"><i></i></button>
        ${Array.from({ length: 21 }, (_, id) => id).map((id) =>
          `<button class="frame-thumb" type="button" data-frame="${id}" aria-label="${tr("Рамка", "Frame")}"><img src="${framePath(id)}" alt=""></button>`
        ).join("")}
      </div>
      <div id="filterCarousel" class="filter-carousel" aria-label="${tr("Выбор светофильтра", "Color filter selection")}">
        ${[
          ["bw", "#000000,#555555,#aaaaaa,#ffffff", tr("Чёрно-белый", "Black and white")],
          ["dmg", "#0f380f,#306230,#8bac0f,#9bbc0f", "Game Boy"],
          ["pocket", "#1f2520,#58605a,#aab1a8,#edf1e8", "Game Boy Pocket"],
          ["sepia", "#3b2415,#765239,#b59b73,#f1e3c6", tr("Сепия", "Sepia")],
          ["negative", "#ffffff,#aaaaaa,#555555,#000000", tr("Негатив", "Negative")],
          ["ocean", "#0b1b3a,#244b74,#77a6b6,#d9f0e8", tr("Синий", "Ocean")],
          ["amber", "#351500,#7a3b00,#d78600,#ffe4a3", tr("Янтарный", "Amber")],
          ["violet", "#24112f,#663b73,#b47faf,#f4dbea", tr("Фиолетовый", "Violet")],
          ["mint", "#102820,#2d6654,#74ad8e,#d8f3d2", tr("Мятный", "Mint")],
        ].map(([id, colors, label], index) =>
          `<button class="filter-thumb${index === 0 ? " active" : ""}" type="button" data-filter="${id}" data-colors="${colors}" aria-label="${label}" title="${label}" style="--filter-colors:${colors.split(",").join(", ")}"></button>`
        ).join("")}
      </div>
      <div class="adjustments">
        <div class="effect-control"><span>${tr("Эффект", "Effect")}</span><div id="ditherMode" class="effect-buttons" role="radiogroup">${[
          ["none", tr("Без эффекта", "No effect")],
          ["bayer", "Bayer 4×4"],
          ["floyd", "Floyd–Steinberg"],
          ["atkinson", "Atkinson"],
        ].map(([mode, label], index) => `<button type="button" class="effect-button effect-${mode}${index === 1 ? " active" : ""}" data-mode="${mode}" role="radio" aria-checked="${index === 1}" aria-label="${label}" title="${label}"><i></i></button>`).join("")}</div></div>
        <label class="adjustment"><span>${tr("Контраст", "Contrast")}</span><input id="contrast" type="range" min="70" max="180" value="115"><output id="contrastValue">115</output><button id="resetContrast" class="reset-control" type="button" aria-label="${tr("Сбросить контраст", "Reset contrast")}" title="${tr("Сбросить", "Reset")}">↺</button></label>
        <label class="adjustment"><span>${tr("Яркость", "Brightness")}</span><input id="density" type="range" min="0" max="127" value="96"><output id="densityValue">96</output><button id="resetDensity" class="reset-control" type="button" aria-label="${tr("Сбросить яркость", "Reset brightness")}" title="${tr("Сбросить", "Reset")}">↺</button></label>
        <label class="adjustment"><span>${tr("Масштаб", "Zoom")}</span><input id="zoom" type="range" min="100" max="300" value="100"><output id="zoomValue">100</output><button id="resetZoom" class="reset-control" type="button" aria-label="${tr("Сбросить масштаб", "Reset zoom")}" title="${tr("Сбросить", "Reset")}">↺</button></label>
        <span id="cropHint" class="crop-hint" hidden>${tr("Перетаскивайте фото для выбора области печати", "Drag the photo to select the print area")}</span>
      </div>
      <div class="actions">
        <button id="switchCamera" class="secondary camera-switch" type="button" disabled aria-label="${tr("Сменить камеру", "Switch camera")}">↻ ${tr("Камера", "Camera")}</button>
        <button id="shutter" class="shutter" disabled aria-label="${tr("Сделать снимок", "Take a photo")}"><span></span></button>
        <label class="secondary file-button">${tr("Галерея", "Gallery")}<input id="file" type="file" accept="image/*"></label>
      </div>
    </section>

    <section class="print-card">
      <div><p class="eyebrow">${tr("ГОТОВО К ПЕЧАТИ", "READY TO PRINT")}</p><h2 id="photoTitle">${tr("Сначала сделайте снимок", "Take a photo first")}</h2></div>
      <div class="print-actions">
        <button id="print" class="print-button" disabled><span>${tr("Распечатать", "Print")}</span></button>
        <button id="save" class="save-button" disabled>${tr("Сохранить в галерею", "Save to gallery")}</button>
        <button id="share" class="share-button" type="button" disabled aria-label="${tr("Поделиться", "Share")}" title="${tr("Поделиться", "Share")}"><span class="share-icon" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></span></button>
        <button id="addToCollage" class="save-button collage-commit" hidden>${tr("Добавить в коллаж", "Add to collage")}</button>
      </div>
      <div id="progress" class="progress" hidden><i></i></div>
      <p id="status" role="status">${tr("Для телефона нужен Chrome и USB OTG-кабель.", "Chrome and a USB OTG cable are required on a phone.")}</p>
    </section>
    </div>

    <section id="collageView" class="collage-view" hidden>
      <div class="collage-heading"><div><p class="eyebrow">${tr("ДЛИННАЯ ПЕЧАТЬ", "LONG PRINT")}</p><h2>${tr("Коллаж", "Collage")}</h2></div><small>${tr("до 4 объектов", "up to 4 items")}</small></div>
      <div id="collageList" class="collage-list"></div>
      <div id="collageSlot" class="collage-slot">
        <button id="addCollagePhoto" type="button">${tr("Фото", "Photo")}</button>
        <button id="addCollageText" type="button">${tr("Текст", "Text")}</button>
      </div>
      <div class="collage-actions">
        <button id="printCollage" class="print-button collage-print" disabled>${tr("Распечатать", "Print")}</button>
        <button id="saveCollage" class="save-button" disabled>${tr("Скачать", "Download")}</button>
        <button id="shareCollage" class="share-button" type="button" disabled aria-label="${tr("Поделиться", "Share")}" title="${tr("Поделиться", "Share")}"><span class="share-icon" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></span></button>
      </div>
      <p id="collageStatus" class="collage-status">${tr("Добавьте фотографию или текст.", "Add a photo or text.")}</p>
    </section>

    <div id="textEditor" class="editor-overlay" hidden>
      <form class="editor-card">
        <h2>${tr("Текст для коллажа", "Collage text")}</h2>
        <canvas id="textPreview" class="text-preview" width="160" height="64"></canvas>
        <textarea id="collageText" maxlength="120" rows="4" placeholder="${tr("Введите надпись", "Enter text")}"></textarea>
        <label>${tr("Шрифт", "Font")}
          <select id="collageFont">
            <option value="Press Start 2P">${tr("Пиксельный", "Pixel")}</option>
            <option value="PT Serif">${tr("Классический", "Classic")}</option>
            <option value="PT Sans">${tr("Простой", "Simple")}</option>
            <option value="Caveat">${tr("Рукописный", "Handwritten")}</option>
            <option value="Brusbylyajka">Brusbylyajka</option>
            <option value="Pretendo">Pretendo</option>
          </select>
        </label>
        <label class="font-size-control">${tr("Размер", "Size")}
          <input id="collageFontSize" type="range" min="8" max="28" value="14">
          <output id="collageFontSizeValue">14</output>
        </label>
        <div><button id="cancelText" type="button">${tr("Отмена", "Cancel")}</button><button id="saveText" type="button">${tr("Добавить", "Add")}</button></div>
      </form>
    </div>
    <div id="deleteConfirm" class="editor-overlay" hidden>
      <div class="editor-card confirm-card">
        <h2>${tr("Точно удалить?", "Delete this item?")}</h2>
        <div><button id="cancelDelete" type="button">${tr("Отмена", "Cancel")}</button><button id="confirmDelete" class="danger" type="button">${tr("Удалить", "Delete")}</button></div>
      </div>
    </div>
    <div id="aboutDialog" class="editor-overlay" hidden>
      <div class="editor-card about-card">
        <h2>Android Boy Camera</h2>
        <p>${tr("разработан", "developed by")} <a href="https://github.com/DuckWader" target="_blank" rel="noopener noreferrer">Duck Wader</a> ${tr("совместно с", "together with")} OpenAI Codex (GPT‑5).</p>
        <p>${tr("Версия ПО", "Software version")}: ${APP_VERSION}</p>
        <p>2026${tr("г.", "")}</p>
        <div><button id="aboutClose" type="button">${tr("Закрыть", "Close")}</button></div>
      </div>
    </div>
    <div id="statusDialog" class="editor-overlay" hidden>
      <div class="editor-card status-card">
        <h2>${tr("Состояние подключения", "Connection status")}</h2>
        <p><span>Arduino</span><b id="statusArduinoValue">${tr("Не подключена", "Not connected")}</b></p>
        <p><span>Game Boy Printer</span><b id="statusPrinterValue">${tr("Нет связи", "No connection")}</b></p>
        <div><button id="statusRefresh" type="button">${tr("Обновить", "Refresh")}</button><button id="statusClose" type="button">${tr("Закрыть", "Close")}</button></div>
      </div>
    </div>
    <footer>Pixel Duck Production special for <a href="https://t.me/retro_museum" target="_blank" rel="noopener noreferrer">Retro Museum</a></footer>
  </main>`;

const $ = (selector) => document.querySelector(selector);
$("#statusRefresh").insertAdjacentHTML(
  "beforebegin",
  `<button id="statusTest" type="button">${tr("Тест", "Test")}</button>`,
);
if (PRINT_LOG_ENABLED) {
  $("main").insertAdjacentHTML("beforeend", `
    <section class="print-log-panel">
      <div><b>${tr("Лог печати", "Print log")}</b><button id="clearPrintLog" type="button">${tr("Очистить", "Clear")}</button></div>
      <pre id="printLog">${tr("Журнал готов.", "Log ready.")}</pre>
    </section>
  `);
}
const video = $("#video");
const canvas = $("#preview");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const printCanvas = document.createElement("canvas");
printCanvas.width = PRINTER_WIDTH;
printCanvas.height = PRINTER_HEIGHT;
const printCtx = printCanvas.getContext("2d", { willReadFrequently: true });
const transport = new PrinterTransport();
let stream = null;
let frameHandle = null;
let cameraStarting = false;
let resumeLiveCamera = false;
let cameraResumeTimer = null;
let hasPhoto = false;
let sourceImage = null;
let sourceMode = "camera";
let facingMode = "environment";
let cropCenterX = .5;
let cropCenterY = .5;
let dragging = false;
let dragX = 0;
let dragY = 0;
const frameImages = new Map();
let selectedFrame = "";
let selectedFilter = ["#000000", "#555555", "#aaaaaa", "#ffffff"];
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];
let collageItems = [];
let collagePhotoPending = false;
let collageEditIndex = -1;
let pendingDeleteIndex = -1;
let selectedDitherMode = "bayer";
let printingActive = false;
let printerRecoveryActive = false;
let lastPrinterRecovery = 0;
let collagePrintComplete = false;

if (document.fonts) {
  [
    '14px "Press Start 2P"',
    '14px "PT Serif"',
    '14px "PT Sans"',
    '14px "Caveat"',
    '14px "Brusbylyajka"',
    '14px "Pretendo"',
  ].forEach((font) => document.fonts.load(font).catch(() => {}));
}

function showMode(mode) {
  const camera = mode === "camera";
  $("#cameraView").hidden = !camera;
  $("#collageView").hidden = camera;
  $("#cameraTab").classList.toggle("active", camera);
  $("#collageTab").classList.toggle("active", !camera);
}

function textCardCanvas(text, font, fontSize = 14) {
  const result = document.createElement("canvas");
  result.width = PRINTER_WIDTH;
  result.height = 64;
  const context = result.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, result.width, result.height);
  context.fillStyle = "#000";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${fontSize}px "${font}"`;
  const words = text.trim().split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > 144 && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  const lineHeight = fontSize + 3;
  const maxLines = Math.max(1, Math.floor(54 / lineHeight));
  const visible = lines.slice(0, maxLines);
  visible.forEach((value, index) => context.fillText(value, 80, 32 + (index - (visible.length - 1) / 2) * lineHeight));
  return result;
}

function renderCollage() {
  const list = $("#collageList");
  list.innerHTML = "";
  collageItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "collage-row";
    row.innerHTML = `
      <button class="collage-item" type="button" data-action="edit" data-index="${index}" aria-label="${tr("Редактировать объект", "Edit item")}">
        <img src="${item.dataUrl}" alt="${item.type === "text" ? tr("Текст", "Text") : tr("Фотография", "Photo")}"><i class="collage-progress-overlay"></i><span>${index + 1}</span>
      </button>
      <div class="collage-controls">
        <button type="button" data-action="up" data-index="${index}" aria-label="${tr("Переместить выше", "Move up")}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="delete" data-action="delete" data-index="${index}" aria-label="${tr("Удалить", "Delete")}">×</button>
        <button type="button" data-action="down" data-index="${index}" aria-label="${tr("Переместить ниже", "Move down")}" ${index === collageItems.length - 1 ? "disabled" : ""}>↓</button>
      </div>`;
    list.append(row);
  });
  $("#collageCount").textContent = collageItems.length;
  $("#collageSlot").hidden = collageItems.length >= 4;
  $("#printCollage").disabled = collageItems.length === 0;
  $("#saveCollage").disabled = collageItems.length === 0;
  $("#shareCollage").disabled = collageItems.length === 0;
  $("#collageStatus").textContent = collageItems.length
    ? tr(`Объектов: ${collageItems.length}. Нажмите на объект для редактирования.`, `Items: ${collageItems.length}. Tap an item to edit it.`)
    : tr("Добавьте фотографию или текст.", "Add a photo or text.");
}

function resetCollageProgress() {
  document.querySelectorAll(".collage-progress-overlay").forEach((overlay) => {
    overlay.style.height = "0%";
  });
  collagePrintComplete = false;
}

function setCollageItemProgress(index, phase) {
  const overlay = document.querySelector(`.collage-item[data-index="${index}"] .collage-progress-overlay`);
  if (overlay) overlay.style.height = `${Math.max(0, Math.min(1, phase)) * 100}%`;
}

async function makeCollageCanvas() {
  const result = document.createElement("canvas");
  result.width = PRINTER_WIDTH;
  result.height = collageItems.reduce((height, item) => height + item.height, 0);
  const context = result.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, result.width, result.height);
  let y = 0;
  for (const item of collageItems) {
    const image = new Image();
    image.src = item.dataUrl;
    await image.decode();
    context.drawImage(image, 0, y, PRINTER_WIDTH, item.height);
    y += item.height;
  }
  return result;
}

async function makeCollageItemCanvas(item) {
  const result = document.createElement("canvas");
  result.width = PRINTER_WIDTH;
  result.height = item.height;
  const context = result.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, result.width, result.height);
  const image = new Image();
  image.src = item.dataUrl;
  await image.decode();
  context.drawImage(image, 0, 0, PRINTER_WIDTH, item.height);
  return result;
}

function canvasPngBlob(sourceCanvas) {
  return new Promise((resolve, reject) => {
    sourceCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(tr("Не удалось создать PNG.", "Could not create PNG.")));
    }, "image/png");
  });
}

function setStatus(text, error = false) {
  $("#status").textContent = text;
  $("#status").classList.toggle("error", error);
}

function appendPrintLog(type, command, detail) {
  if (!PRINT_LOG_ENABLED) return;
  const log = $("#printLog");
  const time = new Date().toLocaleTimeString();
  let text = detail;
  if (type === "send") text = tr(`Отправил команду ${command} (${detail})`, `Sent command ${command} (${detail})`);
  if (type === "response") text = tr(`Ответ ${command}: ${detail}`, `${command} response: ${detail}`);
  log.textContent += `\n[${time}] ${text}`;
  log.scrollTop = log.scrollHeight;
}
globalThis.__printerLog = PRINT_LOG_ENABLED ? appendPrintLog : null;

function setConnectionState(state, label) {
  const button = $("#connect");
  button.classList.toggle("arduino", state === "arduino");
  button.classList.toggle("printer", state === "printer");
  button.classList.toggle("online", state !== "disconnected");
  $("#connect b").textContent = label || tr("Статус", "Status");
}

function setPrinterDetail(state, text) {
  const element = $("#statusPrinterValue");
  element.className = state;
  element.textContent = text;
}

function setArduinoDetail(connected) {
  const element = $("#statusArduinoValue");
  element.className = connected ? "ready" : "error";
  element.textContent = connected ? tr("Подключена", "Connected") : tr("Не подключена", "Not connected");
}

function displayPrinterStatus(status) {
  if (!status) return setPrinterDetail("disconnected", tr("Нет связи", "No connection"));
  if (status.paperJam) return setPrinterDetail("error", tr("Нет бумаги / замятие", "No paper / jam"));
  if (status.lowBattery) return setPrinterDetail("warning", tr("Мало заряда", "Low battery"));
  if (status.otherError) return setPrinterDetail("error", tr("Ошибка принтера", "Printer error"));
  if (status.packetError) return setPrinterDetail("error", tr("Ошибка пакета", "Packet error"));
  if (status.checksumError) return setPrinterDetail("error", tr("Ошибка контрольной суммы", "Checksum error"));
  if (status.bufferFull) return setPrinterDetail("printing", tr("Буфер заполнен", "Buffer full"));
  if (status.busy || status.unprocessedData) return setPrinterDetail("printing", tr("Печатает", "Printing"));
  return setPrinterDetail("ready", tr("Готов", "Ready"));
}

function printerStatusProblem(status) {
  if (status.lowBattery) return tr("Низкий заряд батарей принтера.", "Printer batteries are low.");
  if (status.paperJam) return tr("В принтере нет бумаги или она зажевана.", "The printer is out of paper or paper is jammed.");
  if (status.otherError) return tr("Принтер сообщает об ошибке.", "The printer reports an error.");
  if (status.packetError) return tr("Ошибка пакета Game Boy Printer.", "Game Boy Printer packet error.");
  if (status.checksumError) return tr("Ошибка контрольной суммы.", "Checksum error.");
  if (status.busy || status.bufferFull || status.unprocessedData) return tr("Принтер занят.", "Printer is busy.");
  return "";
}

async function updatePrinterConnection({ announce = false } = {}) {
  if (transport.port && !await transport.isConnected()) {
    await transport.disconnect().catch(() => {});
  }
  if (!transport.port) {
    setConnectionState("disconnected");
    setArduinoDetail(false);
    displayPrinterStatus(null);
    return null;
  }
  try {
    setArduinoDetail(true);
    const status = await pingPrinter(transport);
    if (!status) {
      setConnectionState("arduino");
      displayPrinterStatus(null);
      if (announce) setStatus(tr("Arduino подключена, но принтер не отвечает.", "Arduino is connected, but the printer is not responding."), true);
      return null;
    }
    setConnectionState("printer");
    displayPrinterStatus(status);
    const problem = printerStatusProblem(status);
    if (announce) setStatus(problem || tr("Arduino и Game Boy Printer подключены.", "Arduino and Game Boy Printer are connected."), Boolean(problem));
    return status;
  } catch {
    setConnectionState("arduino");
    setArduinoDetail(true);
    displayPrinterStatus(null);
    if (announce) setStatus(tr("Arduino подключена, но принтер не отвечает.", "Arduino is connected, but the printer is not responding."), true);
    return null;
  }
}

async function requirePrinterReady() {
  let status = await updatePrinterConnection({ announce: false });
  if (!status && await recoverPrinterConnection()) {
    status = await updatePrinterConnection({ announce: false });
  }
  if (!status) throw new Error(tr(
    "Нет связи с Game Boy Printer. Включите принтер и дождитесь зелёного статуса.",
    "No connection to the Game Boy Printer. Turn it on and wait for the green status.",
  ));
  const problem = printerStatusProblem(status);
  if (problem) throw new Error(problem);
  return status;
}

async function recoverPrinterConnection() {
  if (printingActive || printerRecoveryActive || !transport.port) return false;
  if (Date.now() - lastPrinterRecovery < 8000) return false;
  lastPrinterRecovery = Date.now();
  printerRecoveryActive = true;
  try {
    return await transport.recoverPrinter();
  } catch {
    return false;
  } finally {
    printerRecoveryActive = false;
  }
}

function selectedFrameImage() {
  const id = selectedFrame;
  if (id === "") return null;
  if (!frameImages.has(id)) {
    const image = new Image();
    image.src = framePath(id);
    image.addEventListener("load", renderCurrent, { once: true });
    frameImages.set(id, image);
  }
  return frameImages.get(id);
}

function render(source) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;
  const wanted = PRINTER_WIDTH / PRINTER_HEIGHT;
  let sx = 0, sy = 0, cropW = sw, cropH = sh;
  if (sw / sh > wanted) { cropW = sh * wanted; sx = (sw - cropW) / 2; }
  else { cropH = sw / wanted; sy = (sh - cropH) / 2; }
  const zoom = Number($("#zoom").value) / 100;
  cropW /= zoom;
  cropH /= zoom;
  if (sourceMode === "gallery") {
    sx = Math.max(0, Math.min(sw - cropW, cropCenterX * sw - cropW / 2));
    sy = Math.max(0, Math.min(sh - cropH, cropCenterY * sh - cropH / 2));
  } else {
    sx = (sw - cropW) / 2;
    sy = (sh - cropH) / 2;
  }
  printCtx.filter = `grayscale(1) contrast(${$("#contrast").value}%)`;
  if (facingMode === "user" && sourceMode !== "gallery") {
    printCtx.save();
    printCtx.translate(PRINTER_WIDTH, 0);
    printCtx.scale(-1, 1);
    printCtx.drawImage(source, sx, sy, cropW, cropH, 0, 0, PRINTER_WIDTH, PRINTER_HEIGHT);
    printCtx.restore();
  } else {
    printCtx.drawImage(source, sx, sy, cropW, cropH, 0, 0, PRINTER_WIDTH, PRINTER_HEIGHT);
  }
  printCtx.filter = "none";
  const image = printCtx.getImageData(0, 0, PRINTER_WIDTH, PRINTER_HEIGHT);
  const densityShift = (96 - Number($("#density").value)) * 1.1;
  ditherImage(image, densityShift, selectedDitherMode);
  printCtx.putImageData(image, 0, 0);
  const frame = selectedFrameImage();
  if (frame?.complete) printCtx.drawImage(frame, 0, 0, PRINTER_WIDTH, PRINTER_HEIGHT);
  applySaveFilter();
}

function ditherImage(image, brightnessShift, mode) {
  const width = PRINTER_WIDTH;
  const height = PRINTER_HEIGHT;
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = image.data[i * 4] + brightnessShift;
  const setPixel = (index, value) => {
    const level = Math.max(0, Math.min(255, value));
    image.data[index * 4] = image.data[index * 4 + 1] = image.data[index * 4 + 2] = level;
  };

  if (mode === "none" || mode === "bayer") {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const threshold = mode === "bayer"
          ? ((BAYER_4X4[(y % 4) * 4 + (x % 4)] + .5) / 16 - .5) * 85
          : 0;
        setPixel(index, Math.round((values[index] + threshold) / 85) * 85);
      }
    }
    return;
  }

  const spread = (x, y, error, factor) => {
    if (x >= 0 && x < width && y >= 0 && y < height) values[y * width + x] += error * factor;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const oldValue = values[index];
      const newValue = Math.max(0, Math.min(255, Math.round(oldValue / 85) * 85));
      const error = oldValue - newValue;
      setPixel(index, newValue);
      if (mode === "floyd") {
        spread(x + 1, y, error, 7 / 16);
        spread(x - 1, y + 1, error, 3 / 16);
        spread(x, y + 1, error, 5 / 16);
        spread(x + 1, y + 1, error, 1 / 16);
      } else {
        spread(x + 1, y, error, 1 / 8);
        spread(x + 2, y, error, 1 / 8);
        spread(x - 1, y + 1, error, 1 / 8);
        spread(x, y + 1, error, 1 / 8);
        spread(x + 1, y + 1, error, 1 / 8);
        spread(x, y + 2, error, 1 / 8);
      }
    }
  }
}

function applySaveFilter() {
  const image = printCtx.getImageData(0, 0, PRINTER_WIDTH, PRINTER_HEIGHT);
  const colors = selectedFilter.map((color) => [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]);
  for (let i = 0; i < image.data.length; i += 4) {
    const shade = Math.max(0, Math.min(3, Math.round(image.data[i] / 85)));
    image.data[i] = colors[shade][0];
    image.data[i + 1] = colors[shade][1];
    image.data[i + 2] = colors[shade][2];
  }
  ctx.putImageData(image, 0, 0);
}

function renderCurrent() {
  if ((sourceMode === "gallery" || sourceMode === "capture") && sourceImage) render(sourceImage);
  else if (stream) render(video);
}

function liveLoop() {
  if (!stream || sourceMode !== "camera" || hasPhoto) return;
  render(video);
  frameHandle = requestAnimationFrame(liveLoop);
}

function stopCameraStream() {
  cancelAnimationFrame(frameHandle);
  frameHandle = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

function setShutterMode(cancel) {
  $("#shutter").classList.toggle("cancel", cancel);
  $("#shutter").setAttribute("aria-label", cancel
    ? tr("Убрать изображение и включить камеру", "Remove image and resume camera")
    : tr("Сделать снимок", "Take a photo"));
}

async function startCameraOnce() {
  try {
    stream?.getTracks().forEach((track) => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    });
    const activeStream = stream;
    const track = activeStream.getVideoTracks()[0];
    track?.addEventListener("ended", () => {
      if (stream === activeStream && !document.hidden && sourceMode === "camera" && !hasPhoto) {
        scheduleCameraResume();
      }
    });
    track?.addEventListener("mute", () => {
      if (stream === activeStream && !document.hidden && sourceMode === "camera" && !hasPhoto) {
        scheduleCameraResume(700);
      }
    });
    video.srcObject = stream;
    await video.play();
    $("#cameraHint").hidden = true;
    $("#shutter").disabled = false;
    $("#switchCamera").disabled = false;
    sourceMode = "camera";
    sourceImage = null;
    hasPhoto = false;
    setShutterMode(false);
    $("#zoom").disabled = false;
    $("#resetZoom").disabled = false;
    $("#cropHint").hidden = true;
    cancelAnimationFrame(frameHandle);
    liveLoop();
    setStatus(tr("Камера работает. Кадр сразу переводится в 4 оттенка серого.", "Camera is active. The image is converted to four shades of gray in real time."));
  } catch (error) {
    setStatus(tr(`Камера недоступна: ${error.message}`, `Camera unavailable: ${error.message}`), true);
  }
}

async function startCamera() {
  if (cameraStarting) return;
  cameraStarting = true;
  try {
    await startCameraOnce();
  } finally {
    cameraStarting = false;
  }
}

function scheduleCameraResume(delay = 250) {
  if (document.hidden || sourceMode !== "camera" || hasPhoto) return;
  clearTimeout(cameraResumeTimer);
  cameraResumeTimer = setTimeout(async () => {
    if (document.hidden || sourceMode !== "camera" || hasPhoto) return;
    const track = stream?.getVideoTracks?.()[0];
    const healthy = track?.readyState === "live" && !track.muted && video.readyState >= 2;
    if (healthy) {
      await video.play().catch(() => {});
      cancelAnimationFrame(frameHandle);
      liveLoop();
      resumeLiveCamera = false;
      return;
    }
    stopCameraStream();
    await startCamera();
    resumeLiveCamera = false;
  }, delay);
}

function pauseLiveCameraForBackground() {
  if (sourceMode !== "camera" || hasPhoto) return;
  resumeLiveCamera = true;
  clearTimeout(cameraResumeTimer);
  stopCameraStream();
}

function restoreLiveCameraAfterBackground() {
  if (sourceMode !== "camera" || hasPhoto) return;
  const track = stream?.getVideoTracks?.()[0];
  if (resumeLiveCamera || !track || track.readyState !== "live" || track.muted || video.paused) {
    scheduleCameraResume();
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseLiveCameraForBackground();
  else restoreLiveCameraAfterBackground();
});
window.addEventListener("pagehide", pauseLiveCameraForBackground);
window.addEventListener("pageshow", restoreLiveCameraAfterBackground);
window.__androidAppPaused = pauseLiveCameraForBackground;
window.__androidAppResumed = restoreLiveCameraAfterBackground;

$("#switchCamera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  $("#switchCamera").disabled = true;
  $("#shutter").disabled = true;
  setStatus(facingMode === "user" ? tr("Включаю фронтальную камеру…", "Starting front camera…") : tr("Включаю основную камеру…", "Starting rear camera…"));
  await startCamera();
});

$("#shutter").addEventListener("click", async () => {
  if (hasPhoto) {
    sourceImage = null;
    hasPhoto = false;
    $("#print").disabled = true;
    $("#save").disabled = true;
    $("#share").disabled = true;
    $("#addToCollage").disabled = true;
    $("#photoTitle").textContent = tr("Сначала сделайте снимок", "Take a photo first");
    $("#file").value = "";
    $(".viewfinder").classList.remove("cropping");
    setShutterMode(false);
    await startCamera();
    setStatus(tr("Камера снова работает. Нажмите круглую кнопку, чтобы зафиксировать кадр.", "Camera resumed. Tap the round button to freeze the frame."));
    return;
  }
  const frozenFrame = document.createElement("canvas");
  frozenFrame.width = video.videoWidth;
  frozenFrame.height = video.videoHeight;
  frozenFrame.getContext("2d").drawImage(video, 0, 0);
  sourceMode = "capture";
  sourceImage = frozenFrame;
  stopCameraStream();
  $("#switchCamera").disabled = true;
  $("#zoom").disabled = false;
  $("#resetZoom").disabled = false;
  $("#cropHint").hidden = true;
  $(".viewfinder").classList.remove("cropping");
  render(sourceImage);
  hasPhoto = true;
  setShutterMode(true);
  $("#print").disabled = false;
  $("#save").disabled = false;
  $("#share").disabled = false;
  $("#addToCollage").disabled = false;
  $("#photoTitle").textContent = tr("Снимок подготовлен", "Photo ready");
  setStatus(tr("Снимок зафиксирован. Можно подключить Arduino и печатать.", "Frame frozen. You can connect Arduino and print."));
});

$("#file").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const image = new Image();
  image.onload = () => {
    stopCameraStream();
    $("#shutter").disabled = false;
    $("#switchCamera").disabled = true;
    sourceMode = "gallery";
    sourceImage = image;
    cropCenterX = .5;
    cropCenterY = .5;
    $("#zoom").value = 100;
    $("#zoomValue").value = 100;
    render(image);
    hasPhoto = true;
    setShutterMode(true);
    $("#print").disabled = false;
    $("#save").disabled = false;
    $("#share").disabled = false;
    $("#addToCollage").disabled = false;
    $("#cameraHint").hidden = true;
    $("#zoom").disabled = false;
    $("#resetZoom").disabled = false;
    $("#cropHint").hidden = false;
    $(".viewfinder").classList.add("cropping");
    $("#photoTitle").textContent = file.name;
    setStatus(tr("Фото из галереи подготовлено к печати.", "Gallery photo is ready to print."));
  };
  image.src = URL.createObjectURL(file);
});

$("#contrast").addEventListener("input", () => {
  $("#contrastValue").value = $("#contrast").value;
  renderCurrent();
});
$("#ditherMode").addEventListener("click", (event) => {
  const button = event.target.closest(".effect-button");
  if (!button) return;
  selectedDitherMode = button.dataset.mode;
  document.querySelectorAll(".effect-button").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-checked", String(active));
  });
  renderCurrent();
});
$("#resetContrast").addEventListener("click", () => {
  $("#contrast").value = 115;
  $("#contrastValue").value = 115;
  renderCurrent();
});
$("#density").addEventListener("input", () => {
  $("#densityValue").value = $("#density").value;
  renderCurrent();
});
$("#resetDensity").addEventListener("click", () => {
  $("#density").value = 96;
  $("#densityValue").value = 96;
  renderCurrent();
});
$("#zoom").addEventListener("input", () => {
  $("#zoomValue").value = $("#zoom").value;
  renderCurrent();
});
$("#resetZoom").addEventListener("click", () => {
  $("#zoom").value = 100;
  $("#zoomValue").value = 100;
  cropCenterX = .5;
  cropCenterY = .5;
  renderCurrent();
});
$("#frameCarousel").addEventListener("click", (event) => {
  const button = event.target.closest(".frame-thumb");
  if (!button) return;
  selectedFrame = button.dataset.frame;
  document.querySelectorAll(".frame-thumb").forEach((item) => item.classList.toggle("active", item === button));
  button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  renderCurrent();
});
$("#filterCarousel").addEventListener("click", (event) => {
  const button = event.target.closest(".filter-thumb");
  if (!button) return;
  selectedFilter = button.dataset.colors.split(",");
  document.querySelectorAll(".filter-thumb").forEach((item) => item.classList.toggle("active", item === button));
  button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  applySaveFilter();
});

canvas.addEventListener("pointerdown", (event) => {
  if (sourceMode !== "gallery") return;
  dragging = true;
  dragX = event.clientX;
  dragY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragging || !sourceImage) return;
  const rect = canvas.getBoundingClientRect();
  const zoom = Number($("#zoom").value) / 100;
  cropCenterX -= (event.clientX - dragX) / rect.width / zoom;
  cropCenterY -= (event.clientY - dragY) / rect.height / zoom;
  cropCenterX = Math.max(0, Math.min(1, cropCenterX));
  cropCenterY = Math.max(0, Math.min(1, cropCenterY));
  dragX = event.clientX;
  dragY = event.clientY;
  render(sourceImage);
});
const endDrag = () => { dragging = false; };
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

$("#cameraTab").addEventListener("click", () => {
  collagePhotoPending = false;
  collageEditIndex = -1;
  $("#addToCollage").hidden = true;
  showMode("camera");
});
$("#collageTab").addEventListener("click", () => {
  $("#addToCollage").hidden = true;
  showMode("collage");
  renderCollage();
});
$("#addCollagePhoto").addEventListener("click", () => {
  collagePhotoPending = true;
  collageEditIndex = -1;
  $("#addToCollage").hidden = false;
  $("#addToCollage").disabled = !hasPhoto;
  showMode("camera");
  setStatus(tr("Сделайте снимок или выберите фото, настройте его и нажмите «Добавить в коллаж».", "Take or select a photo, adjust it, then tap “Add to collage”."));
});
$("#addToCollage").addEventListener("click", () => {
  if (!hasPhoto || !collagePhotoPending) return;
  const item = {
    type: "photo",
    height: PRINTER_HEIGHT,
    dataUrl: printCanvas.toDataURL("image/png"),
    source: sourceImage,
    sourceMode,
    facingMode,
    settings: {
      contrast: $("#contrast").value,
      density: $("#density").value,
      zoom: $("#zoom").value,
      cropCenterX,
      cropCenterY,
      frame: selectedFrame,
      filter: [...selectedFilter],
      dither: selectedDitherMode,
    },
  };
  if (collageEditIndex >= 0) collageItems[collageEditIndex] = item;
  else collageItems.push(item);
  collagePhotoPending = false;
  collageEditIndex = -1;
  $("#addToCollage").hidden = true;
  showMode("collage");
  renderCollage();
});
$("#addCollageText").addEventListener("click", () => {
  collageEditIndex = -1;
  $("#collageText").value = "";
  $("#collageFont").value = "Press Start 2P";
  $("#collageFontSize").value = 14;
  $("#collageFontSizeValue").value = 14;
  $("#saveText").textContent = tr("Добавить", "Add");
  $("#textEditor").hidden = false;
  updateTextPreview();
  $("#collageText").focus();
});
$("#cancelText").addEventListener("click", () => { $("#textEditor").hidden = true; });
$("#saveText").addEventListener("click", () => {
  const text = $("#collageText").value.trim();
  if (!text) return;
  const font = $("#collageFont").value;
  const fontSize = Number($("#collageFontSize").value);
  const card = textCardCanvas(text, font, fontSize);
  const item = { type: "text", text, font, fontSize, height: card.height, dataUrl: card.toDataURL("image/png") };
  if (collageEditIndex >= 0) collageItems[collageEditIndex] = item;
  else collageItems.push(item);
  collageEditIndex = -1;
  $("#textEditor").hidden = true;
  renderCollage();
});
function updateTextPreview() {
  const preview = $("#textPreview");
  const card = textCardCanvas($("#collageText").value || tr("Предпросмотр текста", "Text preview"), $("#collageFont").value, Number($("#collageFontSize").value));
  preview.getContext("2d").drawImage(card, 0, 0);
}
$("#collageText").addEventListener("input", updateTextPreview);
window.visualViewport?.addEventListener("resize", () => {
  if (!$("#textEditor").hidden && document.activeElement === $("#collageText")) {
    requestAnimationFrame(() => $("#collageText").scrollIntoView({ block: "center", behavior: "smooth" }));
  }
});
$("#collageFont").addEventListener("change", updateTextPreview);
$("#collageFontSize").addEventListener("input", () => {
  $("#collageFontSizeValue").value = $("#collageFontSize").value;
  updateTextPreview();
});
function editCollageItem(index) {
  const item = collageItems[index];
  if (!item) return;
  collageEditIndex = index;
  if (item.type === "text") {
    $("#collageText").value = item.text;
    $("#collageFont").value = item.font;
    $("#collageFontSize").value = item.fontSize || 14;
    $("#collageFontSizeValue").value = item.fontSize || 14;
    $("#saveText").textContent = tr("Сохранить", "Save");
    $("#textEditor").hidden = false;
    updateTextPreview();
    $("#collageText").focus();
    return;
  }
  const openPhoto = (image) => {
    sourceMode = item.sourceMode || "gallery";
    sourceImage = image;
    facingMode = item.facingMode || facingMode;
    hasPhoto = true;
    const settings = item.settings || {};
    cropCenterX = settings.cropCenterX ?? .5;
    cropCenterY = settings.cropCenterY ?? .5;
    $("#contrast").value = settings.contrast ?? 115;
    $("#contrastValue").value = $("#contrast").value;
    $("#density").value = settings.density ?? 96;
    $("#densityValue").value = $("#density").value;
    $("#zoom").value = settings.zoom ?? 100;
    $("#zoomValue").value = $("#zoom").value;
    selectedFrame = settings.frame ?? "";
    selectedFilter = settings.filter || ["#000000", "#555555", "#aaaaaa", "#ffffff"];
    selectedDitherMode = settings.dither || "bayer";
    document.querySelectorAll(".frame-thumb").forEach((button) => button.classList.toggle("active", button.dataset.frame === selectedFrame));
    document.querySelectorAll(".filter-thumb").forEach((button) => button.classList.toggle("active", button.dataset.colors === selectedFilter.join(",")));
    document.querySelectorAll(".effect-button").forEach((button) => {
      const active = button.dataset.mode === selectedDitherMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-checked", String(active));
    });
    $("#zoom").disabled = false;
    $("#resetZoom").disabled = false;
    $("#addToCollage").hidden = false;
    $("#addToCollage").disabled = false;
    $("#print").disabled = false;
    $("#save").disabled = false;
    $("#share").disabled = false;
    collagePhotoPending = true;
    showMode("camera");
    render(image);
    setStatus(tr("Отредактируйте фотографию и нажмите «Добавить в коллаж».", "Edit the photo and tap “Add to collage”."));
  };
  if (item.source) openPhoto(item.source);
  else {
    const image = new Image();
    image.onload = () => openPhoto(image);
    image.src = item.dataUrl;
  }
}

$("#collageList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const index = Number(button.dataset.index);
  const action = button.dataset.action;
  if (action === "edit") editCollageItem(index);
  else if (action === "up" && index > 0) {
    [collageItems[index - 1], collageItems[index]] = [collageItems[index], collageItems[index - 1]];
    renderCollage();
  } else if (action === "down" && index < collageItems.length - 1) {
    [collageItems[index + 1], collageItems[index]] = [collageItems[index], collageItems[index + 1]];
    renderCollage();
  } else if (action === "delete") {
    pendingDeleteIndex = index;
    $("#deleteConfirm").hidden = false;
  }
});

$("#cancelDelete").addEventListener("click", () => {
  pendingDeleteIndex = -1;
  $("#deleteConfirm").hidden = true;
});
$("#confirmDelete").addEventListener("click", () => {
  if (pendingDeleteIndex >= 0) collageItems.splice(pendingDeleteIndex, 1);
  pendingDeleteIndex = -1;
  $("#deleteConfirm").hidden = true;
  renderCollage();
});

$("#aboutOpen").addEventListener("click", () => { $("#aboutDialog").hidden = false; });
$("#aboutClose").addEventListener("click", () => { $("#aboutDialog").hidden = true; });
$("#statusClose").addEventListener("click", () => { $("#statusDialog").hidden = true; });

document.addEventListener("click", () => {
  if (collagePrintComplete && !printingActive) resetCollageProgress();
});

async function refreshStatusDialog() {
  setArduinoDetail(Boolean(transport.port));
  setPrinterDetail("disconnected", tr("Проверка…", "Checking…"));
  $("#statusRefresh").disabled = true;
  try {
    if (!transport.port) {
      await transport.connect();
      setConnectionState("arduino");
      setArduinoDetail(true);
    }
    await updatePrinterConnection();
  } catch (error) {
    setConnectionState("disconnected");
    setArduinoDetail(false);
    displayPrinterStatus(null);
    setPrinterDetail("error", tr("Проверка не удалась", "Check failed"));
  } finally {
    $("#statusRefresh").disabled = false;
  }
}

$("#connect").addEventListener("click", async () => {
  $("#statusDialog").hidden = false;
  await refreshStatusDialog();
});

$("#statusRefresh").addEventListener("click", refreshStatusDialog);
$("#clearPrintLog")?.addEventListener("click", () => {
  $("#printLog").textContent = tr("Журнал очищен.", "Log cleared.");
});

$("#statusTest").addEventListener("click", async () => {
  const button = $("#statusTest");
  button.disabled = true;
  try {
    await requirePrinterReady();
    const testCanvas = document.createElement("canvas");
    testCanvas.width = PRINTER_WIDTH;
    testCanvas.height = 16;
    const testContext = testCanvas.getContext("2d");
    testContext.fillStyle = "#fff";
    testContext.fillRect(0, 0, testCanvas.width, testCanvas.height);
    testContext.fillStyle = "#000";
    testContext.font = "bold 14px sans-serif";
    testContext.textAlign = "center";
    testContext.textBaseline = "middle";
    testContext.fillText("Hello world", testCanvas.width / 2, testCanvas.height / 2);
    const packets = makePrintJob(canvasTo2bpp(testCanvas), {
      density: Number($("#density").value),
      margins: 3,
    });
    await sendPrintJob(transport, packets, null, appendPrintLog);
    await waitForPrinterIdle(transport, displayPrinterStatus, 45000, appendPrintLog);
    setStatus(tr("Тестовая строка отправлена на печать.", "The test line was sent to print."));
  } catch (error) {
    setStatus(tr(`Ошибка тестовой печати: ${error.message}`, `Test print error: ${error.message}`), true);
  } finally {
    button.disabled = false;
  }
});

async function attemptAutoConnect() {
  if (transport.port) return;
  try {
    const mode = await transport.autoConnect();
    if (!mode) return;
    setConnectionState("arduino");
    setArduinoDetail(true);
    await updatePrinterConnection();
  } catch (error) {
    setConnectionState("disconnected");
    setArduinoDetail(false);
    displayPrinterStatus(null);
  }
}

navigator.serial?.addEventListener("connect", () => setTimeout(attemptAutoConnect, 500));
window.__androidUsbAttached = () => setTimeout(attemptAutoConnect, 300);
window.__androidUsbDetached = async () => {
  if (transport.port) await transport.disconnect().catch(() => {});
  setConnectionState("disconnected");
  setArduinoDetail(false);
  displayPrinterStatus(null);
};
navigator.serial?.addEventListener("disconnect", async () => {
  if (transport.port) await transport.disconnect().catch(() => {});
  setConnectionState("disconnected");
  setArduinoDetail(false);
  displayPrinterStatus(null);
});
setTimeout(attemptAutoConnect, 250);

$("#print").addEventListener("click", async () => {
  if (!hasPhoto) return;
  setStatus("");
  if (!transport.port) {
    setStatus(tr("Сначала подключите Arduino кнопкой сверху.", "Connect Arduino using the button above first."), true);
    return;
  }
  try {
    printingActive = true;
    $("#print").disabled = true;
    $("#progress").hidden = false;
    await requirePrinterReady();
    const tileBytes = canvasTo2bpp(printCanvas);
    const packets = makePrintJob(tileBytes, { density: Number($("#density").value) });
    await sendPrintJob(transport, packets, (value) => {
      $("#progress i").style.width = `${Math.round(value * 100)}%`;
      setStatus(tr(`Передача в принтер: ${Math.round(value * 100)}%`, `Sending to printer: ${Math.round(value * 100)}%`));
    });
    try {
      await waitForPrinterIdle(transport, displayPrinterStatus);
      setStatus(tr("Печать завершена.", "Printing completed."));
    } catch (error) {
      if (error.printerStatus) {
        displayPrinterStatus(error.printerStatus);
        throw error;
      }
      setConnectionState("arduino");
      displayPrinterStatus(null);
      setStatus(tr(
        "Данные отправлены. Ответ принтера недоступен, печать продолжается.",
        "Data sent. Printer response is unavailable; printing continues.",
      ));
    }
  } catch (error) {
    setStatus(tr(`Ошибка печати: ${error.message}`, `Print error: ${error.message}`), true);
  } finally {
    printingActive = false;
    $("#print").disabled = false;
    setTimeout(() => { $("#progress").hidden = true; }, 1200);
  }
});

$("#printCollage").addEventListener("click", async () => {
  if (!collageItems.length) return;
  $("#collageStatus").textContent = "";
  resetCollageProgress();
  if (!transport.port) {
    $("#collageStatus").textContent = tr("Сначала подключите Arduino кнопкой сверху.", "Connect Arduino using the button above first.");
    return;
  }
  try {
    printingActive = true;
    $("#printCollage").disabled = true;
    await requirePrinterReady();
    for (let index = 0; index < collageItems.length; index++) {
      const item = collageItems[index];
      const next = collageItems[index + 1];
      const itemCanvas = await makeCollageItemCanvas(item);
      const tileBytes = canvasTo2bpp(itemCanvas);
      const bottomFeed = index === collageItems.length - 1 ? 3 : (item.type === "photo" && next?.type === "photo" ? 2 : 0);
      const packets = makePrintJob(tileBytes, {
        density: Number($("#density").value),
        margins: bottomFeed,
      });
      await sendPrintJob(transport, packets, (value) => {
        setCollageItemProgress(index, value * .5);
        const total = (index * 2 + value) / (collageItems.length * 2);
        $("#collageStatus").textContent = tr(`Печать коллажа: ${Math.round(total * 100)}%`, `Printing collage: ${Math.round(total * 100)}%`);
      });
      setCollageItemProgress(index, .5);
      try {
        await waitForPrinterIdle(transport, displayPrinterStatus);
      } catch (error) {
        if (error.printerStatus) {
          displayPrinterStatus(error.printerStatus);
          throw error;
        }
        setConnectionState("arduino");
        displayPrinterStatus(null);
        await new Promise((resolve) => setTimeout(resolve, 16000));
      }
      setCollageItemProgress(index, 1);
    }
    $("#collageStatus").textContent = tr("Печать коллажа завершена.", "Collage printing completed.");
    collagePrintComplete = true;
  } catch (error) {
    $("#collageStatus").textContent = tr(`Ошибка печати: ${error.message}`, `Print error: ${error.message}`);
  } finally {
    printingActive = false;
    $("#printCollage").disabled = false;
  }
});

$("#save").addEventListener("click", () => {
  if (!hasPhoto) return;
  if (window.AndroidBridge) {
    const result = window.AndroidBridge.savePng(canvas.toDataURL("image/png"));
    setStatus(result === "OK" ? tr("Фото 160 × 144 с выбранным фильтром сохранено в галерею.", "The filtered 160 × 144 photo was saved to the gallery.") : result, result !== "OK");
    return;
  }
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus(tr("Не удалось создать PNG.", "Could not create PNG."), true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gb-pocket-print-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setStatus(tr("Фото 160 × 144 с выбранным фильтром сохранено на устройство.", "The filtered 160 × 144 photo was saved to the device."));
  }, "image/png");
});

$("#share").addEventListener("click", () => {
  if (!hasPhoto) return;
  if (window.AndroidBridge?.sharePng) {
    const result = window.AndroidBridge.sharePng(canvas.toDataURL("image/png"));
    if (result !== "OK") setStatus(result, true);
    return;
  }
  canvas.toBlob(async (blob) => {
    if (!blob) return setStatus(tr("Не удалось создать PNG.", "Could not create PNG."), true);
    const file = new File([blob], `android-boy-camera-${Date.now()}.png`, { type: "image/png" });
    try {
      if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
        throw new Error(tr("Обмен файлами не поддерживается этим браузером.", "File sharing is not supported by this browser."));
      }
      await navigator.share({ files: [file], title: "Android Boy Camera" });
    } catch (error) {
      if (error.name !== "AbortError") setStatus(error.message, true);
    }
  }, "image/png");
});

$("#saveCollage").addEventListener("click", async () => {
  if (!collageItems.length) return;
  $("#collageStatus").textContent = "";
  try {
    const collageCanvas = await makeCollageCanvas();
    if (window.AndroidBridge) {
      const result = window.AndroidBridge.savePng(collageCanvas.toDataURL("image/png"));
      if (result !== "OK") throw new Error(result);
      $("#collageStatus").textContent = tr("Коллаж сохранён в галерею.", "Collage saved to gallery.");
      return;
    }
    collageCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `android-boy-camera-collage-${Date.now()}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      $("#collageStatus").textContent = tr("Коллаж сохранён.", "Collage saved.");
    }, "image/png");
  } catch (error) {
    $("#collageStatus").textContent = tr(`Ошибка сохранения: ${error.message}`, `Save error: ${error.message}`);
  }
});

$("#shareCollage").addEventListener("click", async () => {
  if (!collageItems.length) return;
  $("#collageStatus").textContent = "";
  try {
    const collageCanvas = await makeCollageCanvas();
    if (window.AndroidBridge?.sharePng) {
      const result = window.AndroidBridge.sharePng(collageCanvas.toDataURL("image/png"));
      if (result !== "OK") throw new Error(result);
      return;
    }
    const blob = await canvasPngBlob(collageCanvas);
    const file = new File([blob], `android-boy-camera-collage-${Date.now()}.png`, { type: "image/png" });
    if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
      throw new Error(tr("Обмен файлами не поддерживается этим браузером.", "File sharing is not supported by this browser."));
    }
    await navigator.share({ files: [file], title: "Android Boy Camera Collage" });
  } catch (error) {
    if (error.name !== "AbortError") {
      $("#collageStatus").textContent = tr(`Ошибка отправки: ${error.message}`, `Share error: ${error.message}`);
    }
  }
});

if (!window.isSecureContext) setStatus(tr("Камера и USB требуют HTTPS или localhost.", "Camera and USB require HTTPS or localhost."), true);
else if (!transport.supported) setStatus(tr("Откройте страницу в Chrome: браузер не поддерживает USB/Serial.", "Open the page in Chrome: this browser does not support USB/Serial."), true);

startCamera();
