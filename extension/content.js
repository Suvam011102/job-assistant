// content.js

let selectionMode = false;
let selectedElements = new Set();
let originalStyles = new Map();

// Highlight style
function applyHighlight(el) {
  originalStyles.set(el, el.style.outline);
  el.style.outline = "2px solid #3b82f6";
}

function removeHighlight(el) {
  if (originalStyles.has(el)) {
    el.style.outline = originalStyles.get(el);
  } else {
    el.style.outline = "";
  }
}

function handleClick(e) {
  if (!selectionMode) return;

  e.preventDefault();
  e.stopPropagation();

  const el = e.target;

  if (selectedElements.has(el)) {
    selectedElements.delete(el);
    removeHighlight(el);
  } else {
    selectedElements.add(el);
    applyHighlight(el);
  }
}

function startSelection() {
  if (selectionMode) return;
  selectionMode = true;
  document.addEventListener("click", handleClick, true);
}

function stopSelection() {
  selectionMode = false;
  document.removeEventListener("click", handleClick, true);
}

function clearSelection() {
  selectedElements.forEach(el => removeHighlight(el));
  selectedElements.clear();
}

function getSelectedText() {
  let text = "";

  selectedElements.forEach(el => {
    const cleaned = el.innerText?.trim();
    if (cleaned) {
      text += cleaned + "\n\n";
    }
  });

  return text.trim();
}

// Listen for messages from sidepanel
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

  return true; // required for async sendResponse safety
});
