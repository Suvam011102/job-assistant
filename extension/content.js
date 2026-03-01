let selectionMode = false;
let selectedElements = [];

/* -------- Hover Effect -------- */

function hoverEffect(e) {
  if (!selectionMode) return;
  e.target.classList.add("job-hover");
}

function removeHover(e) {
  if (!selectionMode) return;
  e.target.classList.remove("job-hover");
}

/* -------- Toggle Selection -------- */

function toggleSelect(e) {
  if (!selectionMode) return;

  e.preventDefault();
  e.stopPropagation();

  const el = e.target;

  if (selectedElements.includes(el)) {
    el.classList.remove("job-selected");
    selectedElements = selectedElements.filter(item => item !== el);
  } else {
    el.classList.add("job-selected");
    selectedElements.push(el);
  }
}

/* -------- Start Selection -------- */

function startSelection() {
  selectionMode = true;

  document.addEventListener("mouseover", hoverEffect, true);
  document.addEventListener("mouseout", removeHover, true);
  document.addEventListener("click", toggleSelect, true);
}

/* -------- Stop Selection -------- */

function stopSelection() {
  selectionMode = false;

  document.removeEventListener("mouseover", hoverEffect, true);
  document.removeEventListener("mouseout", removeHover, true);
  document.removeEventListener("click", toggleSelect, true);
}

/* -------- Clear Selection -------- */

function clearSelection() {
  selectedElements.forEach(el => {
    el.classList.remove("job-selected");
  });
  selectedElements = [];
}

/* -------- Inject Selection Styles -------- */

const style = document.createElement("style");
style.innerHTML = `
  .job-hover {
    outline: 2px dashed #60a5fa !important;
    cursor: crosshair !important;
  }

  .job-selected {
    outline: 3px solid #22c55e !important;
    box-shadow: 0 0 8px rgba(34,197,94,0.6) !important;
  }
`;
document.head.appendChild(style);

/* -------- Listen for Messages -------- */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (request.action === "startSelection") {
    startSelection();
    sendResponse({ ok: true });
  }

  if (request.action === "stopSelection") {
    stopSelection();
    sendResponse({ ok: true });
  }

  if (request.action === "clearSelection") {
    clearSelection();
    stopSelection();
    sendResponse({ ok: true });
  }

  if (request.action === "getSelection") {
    const text = selectedElements
      .map(el => el.innerText)
      .join("\n\n")
      .trim();

    sendResponse({ text });
  }

});