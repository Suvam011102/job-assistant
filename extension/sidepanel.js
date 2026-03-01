const outputBox = document.getElementById("outputBox");
const status = document.getElementById("status");
const summaryBox = document.getElementById("summaryBox");
const libraryList = document.getElementById("libraryList");

/* ================= THEME SYSTEM ================= */

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "🌙" : "☀️";
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

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const newTheme = current === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  chrome.storage.local.set({ theme: newTheme });
});

/* ================= TABS ================= */

const analyzerTab = document.getElementById("analyzerTab");
const libraryTab = document.getElementById("libraryTab");
const analyzerSection = document.getElementById("analyzerSection");
const librarySection = document.getElementById("librarySection");

analyzerTab.onclick = () => {
  analyzerTab.classList.add("active");
  libraryTab.classList.remove("active");
  analyzerSection.classList.remove("hidden");
  librarySection.classList.add("hidden");
};

libraryTab.onclick = () => {
  libraryTab.classList.add("active");
  analyzerTab.classList.remove("active");
  analyzerSection.classList.add("hidden");
  librarySection.classList.remove("hidden");
  loadLibrary();
};

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
      // 🔥 Switch to Library tab automatically
      analyzerTab.classList.remove("active");
      libraryTab.classList.add("active");

      analyzerSection.classList.add("hidden");
      librarySection.classList.remove("hidden");

      loadLibrary();
    });
  });
});

/* ================= LOAD LIBRARY ================= */

function loadLibrary() {
  chrome.storage.local.get(["savedJobs"], (result) => {
    const saved = result.savedJobs || [];
    libraryList.innerHTML = "";

    if (saved.length === 0) {
      libraryList.innerHTML = "<p class='empty'>No saved jobs yet.</p>";
      return;
    }

    saved.forEach(job => {
      const div = document.createElement("div");
      div.className = "library-item";

      const titleMatch = job.content.match(/Title:\s*(.*)/);
      const companyMatch = job.content.match(/Company:\s*(.*)/);
      const locationMatch = job.content.match(/Location:\s*(.*)/);

      const title = titleMatch ? titleMatch[1] : "Saved Job";
      const company = companyMatch ? companyMatch[1] : "";
      const location = locationMatch ? locationMatch[1] : "";

      div.innerHTML = `
        <div class="library-header">
          <div>
            <h3>${title}</h3>
            <p class="meta">${company} ${location ? "• " + location : ""}</p>
          </div>
          <button class="delete-btn" data-id="${job.id}">Delete</button>
        </div>

        <div class="library-body hidden">
          <pre>${job.content}</pre>
        </div>
      `;

      div.querySelector(".library-header").addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) return;
        div.querySelector(".library-body").classList.toggle("hidden");
      });

      libraryList.appendChild(div);
    });

    attachDeleteEvents();
  });
}

/* ================= DELETE ================= */

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

/* ================= AUTO RESIZE TEXTAREA ================= */

outputBox.addEventListener("input", () => {
  outputBox.style.height = "auto";
  outputBox.style.height = outputBox.scrollHeight + "px";
});

/* ================= ANALYZER BUTTONS ================= */

const startBtn = document.getElementById("startSelection");
const stopBtn = document.getElementById("stopSelection");
const resetBtn = document.getElementById("resetSelection");
const showBtn = document.getElementById("showOutput");
const summarizeBtn = document.getElementById("summarize");
const clearBtn = document.getElementById("clearText");

let selectionActive = false;
let hasStarted = false; // true once startSelection clicked

function updateButtonStates() {
  // start is disabled only while actively selecting
  startBtn.disabled = selectionActive;
  stopBtn.disabled = !selectionActive;

  // other controls enabled after start has been pressed once
  const active = hasStarted;
  resetBtn.disabled = !active;
  showBtn.disabled = !active;
  summarizeBtn.disabled = !active;
  clearBtn.disabled = !active;
}

// initialize buttons
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

    if (!res.ok) throw new Error("Server error");

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
    summaryBox.innerText = "Error generating summary.";
  }
});

clearBtn.addEventListener("click", () => {
  outputBox.value = "";
  summaryBox.innerText = "No summary generated yet.";
  status.innerText = "Cleared";
});
