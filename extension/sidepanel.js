const outputBox = document.getElementById("outputBox");
const status = document.getElementById("status");
const summaryBox = document.getElementById("summaryBox");
const libraryList = document.getElementById("libraryList");

/* ================= THEME SYSTEM ================= */

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.checked = theme === "dark";
}

function detectSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

chrome.storage.local.get(["theme"], (result) => {
  const savedTheme = result.theme;
  const themeToUse = savedTheme || detectSystemTheme();
  applyTheme(themeToUse);
});

themeToggle.addEventListener("change", () => {
  const newTheme = themeToggle.checked ? "dark" : "light";
  applyTheme(newTheme);
  chrome.storage.local.set({ theme: newTheme });
});

/* ================= TABS ================= */

const analyzerTab = document.getElementById("analyzerTab");
const libraryTab = document.getElementById("libraryTab");
const analyzerSection = document.getElementById("analyzerSection");
const librarySection = document.getElementById("librarySection");

function showAnalyzer() {
  analyzerTab.classList.add("active");
  libraryTab.classList.remove("active");
  analyzerSection.style.display = "flex";
  librarySection.style.display = "none";
}

function showLibrary() {
  libraryTab.classList.add("active");
  analyzerTab.classList.remove("active");
  analyzerSection.style.display = "none";
  librarySection.style.display = "flex";
  loadLibrary();
}

analyzerTab.addEventListener("click", showAnalyzer);
libraryTab.addEventListener("click", showLibrary);

showAnalyzer();

/* ================= ANALYZER BUTTONS ================= */

const startBtn = document.getElementById("startSelection");
const stopBtn = document.getElementById("stopSelection");
const resetBtn = document.getElementById("resetSelection");
const showBtn = document.getElementById("showOutput");
const summarizeBtn = document.getElementById("summarize");
const clearBtn = document.getElementById("clearText");

let selectionActive = false;
let hasStarted = false;

function updateButtonStates() {
  startBtn.disabled = selectionActive;
  stopBtn.disabled = !selectionActive;

  const active = hasStarted;
  resetBtn.disabled = !active;
  showBtn.disabled = !active;
  summarizeBtn.disabled = !active;
  clearBtn.disabled = !active;
}

updateButtonStates();

function sendMessageToActiveTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message, callback);
    }
  });
}

startBtn.addEventListener("click", () => {
  sendMessageToActiveTab({ action: "startSelection" });
  status.innerText = "Selection mode on";
  selectionActive = true;
  hasStarted = true;
  updateButtonStates();
});

stopBtn.addEventListener("click", () => {
  sendMessageToActiveTab({ action: "stopSelection" });
  status.innerText = "Selection mode off";
  selectionActive = false;
  updateButtonStates();
});

resetBtn.addEventListener("click", () => {
  sendMessageToActiveTab({ action: "clearSelection" });
  status.innerText = "Selection cleared";
  outputBox.value = "";
  summaryBox.innerText = "No summary generated yet.";
  selectionActive = false;
  updateButtonStates();
});

showBtn.addEventListener("click", () => {
  sendMessageToActiveTab({ action: "getSelection" }, (response) => {
    outputBox.value = response?.text || "";
    outputBox.dispatchEvent(new Event("input"));
    status.innerText = "Text copied";
  });
});

summarizeBtn.addEventListener("click", async () => {
  const text = outputBox.value.trim();
  if (!text) {
    status.innerText = "Nothing to summarize";
    return;
  }

  status.innerText = "Summarizing...";

  try {
    const res = await fetch("http://localhost:5000/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobText: text })
    });

    const data = await res.json();
    const result = data.result || {};

    summaryBox.innerText =
      `Title: ${result.title || ""}\n` +
      `Company: ${result.company || ""}\n` +
      `Location: ${result.location || ""}\n` +
      `Type: ${result.job_type || ""}\n\n` +
      `Summary:\n${result.summary || ""}\n\n` +
      `Skills: ${result.skills?.join(", ") || ""}\n` +
      `Tech Stack: ${result.tech_stack?.join(", ") || ""}\n` +
      `Experience Required: ${result.experience_required || ""}`;

    status.innerText = "Summarized ✓";

  } catch (err) {
    console.error(err);
    status.innerText = "Summarize failed";
  }
});

clearBtn.addEventListener("click", () => {
  outputBox.value = "";
  summaryBox.innerText = "No summary generated yet.";
  status.innerText = "Cleared";
});

/* ================= SAVE SUMMARY ================= */

document.getElementById("saveSummary").addEventListener("click", () => {
  if (!summaryBox.innerText || summaryBox.innerText.includes("No summary")) {
    status.innerText = "Nothing to save";
    return;
  }

  chrome.storage.local.get(["savedJobs"], (result) => {
    const saved = result.savedJobs || [];

    saved.push({
      id: Date.now(),
      content: summaryBox.innerText
    });

    chrome.storage.local.set({ savedJobs: saved }, () => {
      status.innerText = "Saved ✓";
      showLibrary();
    });
  });
});

/* ================= LOAD LIBRARY ================= */

function loadLibrary() {
  chrome.storage.local.get(["savedJobs"], (result) => {
    const saved = result.savedJobs || [];
    libraryList.innerHTML = "";
    document.getElementById("jobCount").innerText = saved.length;

    if (saved.length === 0) {
      libraryList.innerHTML = `
        <div class="empty">
          <p>No saved jobs</p>
        </div>
      `;
      return;
    }

    saved.forEach(job => {
      const div = document.createElement("div");
      div.className = "library-card";

      const titleMatch = job.content.match(/Title:\s*(.*)/);
      const companyMatch = job.content.match(/Company:\s*(.*)/);

      const title = titleMatch ? titleMatch[1] : "Saved Job";
      const company = companyMatch ? companyMatch[1] : "";

      const preview = job.content.substring(0, 180) + "...";

      div.innerHTML = `
        <div class="card-header">
          <div>
            <h3>${title}</h3>
            <p class="meta">${company}</p>
          </div>
          <button class="delete-btn" data-id="${job.id}">Delete</button>
        </div>

        <div class="card-preview">
          ${preview}
        </div>

        <div class="card-full hidden">
          <pre>${job.content}</pre>
        </div>
      `;

      div.querySelector(".card-preview").addEventListener("click", () => {
        div.querySelector(".card-full").classList.toggle("hidden");
      });

      libraryList.appendChild(div);
    });

    attachDeleteEvents();
  });
}

function attachDeleteEvents() {
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);

      chrome.storage.local.get(["savedJobs"], (result) => {
        let saved = result.savedJobs || [];
        saved = saved.filter(job => job.id !== id);
        chrome.storage.local.set({ savedJobs: saved }, loadLibrary);
      });
    });
  });
}
