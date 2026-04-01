// content.js

let selectionMode = false;
let selectedElements = new Set();
let originalStyles = new Map();

/* ================= HIGHLIGHT ================= */

function applyHighlight(el) {
  if (!originalStyles.has(el)) {
    originalStyles.set(el, el.style.outline);
  }
  el.style.outline = "2px solid #3b82f6";
}

function removeHighlight(el) {
  if (originalStyles.has(el)) {
    el.style.outline = originalStyles.get(el);
  } else {
    el.style.outline = "";
  }
}

/* ================= CLICK HANDLER ================= */

function handleClick(e) {

  if (!selectionMode) return;

  const el = e.target;

  // Ignore root elements
  if (el === document.body || el === document.documentElement) return;

  e.preventDefault();
  e.stopPropagation();

  if (selectedElements.has(el)) {

    selectedElements.delete(el);
    removeHighlight(el);

  } else {

    selectedElements.add(el);
    applyHighlight(el);

  }
}

/* ================= START SELECTION ================= */

function startSelection() {

  if (selectionMode) return;

  selectionMode = true;

  document.body.style.cursor = "crosshair";

  document.addEventListener(
    "click",
    handleClick,
    true
  );

}

/* ================= STOP SELECTION ================= */

function stopSelection() {

  if (!selectionMode) return;

  selectionMode = false;

  document.body.style.cursor = "default";

  document.removeEventListener(
    "click",
    handleClick,
    true
  );

}

/* ================= CLEAR SELECTION ================= */

function clearSelection() {

  selectedElements.forEach((el) => {
    removeHighlight(el);
  });

  selectedElements.clear();
  originalStyles.clear();

}

/* ================= GET SELECTED TEXT ================= */

function getSelectedText() {

  let text = "";

  selectedElements.forEach((el) => {

    const cleaned = el.innerText?.trim();

    if (cleaned) {
      text += cleaned + "\n\n";
    }

  });

  const clickedSelection = text.trim();
  if (clickedSelection) {
    return clickedSelection;
  }

  // Fallback to native browser text selection so standard highlight-drag works too.
  const nativeSelection = window.getSelection?.().toString().trim();
  return nativeSelection || "";

}

/* ================= MESSAGE LISTENER ================= */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  switch (message.action) {

    case "startSelection":
      startSelection();
      break;

    case "stopSelection":
      stopSelection();
      break;

    case "clearSelection":
      clearSelection();
      break;

    case "getSelection":
      sendResponse({ text: getSelectedText() });
      break;

    default:
      break;
  }

  return true;

});
