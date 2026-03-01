import { sendMessageToActiveTab } from "./messaging.js";
import { getSavedJobs, setSavedJobs } from "./storage.js";

export function initAnalyzer() {
  const outputBox = document.getElementById("outputBox");
  const status = document.getElementById("status");
  const summaryBox = document.getElementById("summaryBox");

  const startBtn = document.getElementById("startSelection");
  const stopBtn = document.getElementById("stopSelection");
  const resetBtn = document.getElementById("resetSelection");
  const summarizeBtn = document.getElementById("summarize");
  const saveBtn = document.getElementById("saveSummary");

  let lastStructuredResult = null;

  /* ================= START / STOP ================= */

  startBtn.onclick = () => {
    sendMessageToActiveTab({ action: "startSelection" });
    status.innerText = "Selection mode on";
  };

  stopBtn.onclick = () => {
    sendMessageToActiveTab({ action: "stopSelection" });
    status.innerText = "Selection mode off";
  };

  resetBtn.onclick = () => {
    sendMessageToActiveTab({ action: "clearSelection" });
    outputBox.value = "";
    summaryBox.innerText = "";
    lastStructuredResult = null;
    status.innerText = "Reset complete";
  };

  /* ================= SUMMARIZE ================= */

  summarizeBtn.onclick = () => {
    status.innerText = "Fetching selection...";

    sendMessageToActiveTab({ action: "getSelection" }, async (response) => {
      const text = response?.text?.trim();

      if (!text) {
        status.innerText = "No selected content";
        return;
      }

      outputBox.value = text;
      status.innerText = "Summarizing...";

      try {
        const res = await fetch("http://localhost:5000/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobText: text })
        });

        const data = await res.json();
        const result = data.result || {};

        lastStructuredResult = result;

        summaryBox.innerText =
          `Title: ${result.title}\n` +
          `Company: ${result.company}\n` +
          `Location: ${result.location}\n` +
          `Type: ${result.job_type}\n\n` +
          `Skills: ${result.skills?.join(", ")}\n` +
          `Experience: ${result.experience_required}`;

        status.innerText = "Summarized successfully";
      } catch (err) {
        status.innerText = "Summarize failed";
      }
    });
  };

  /* ================= SAVE WITH DUPLICATE CHECK ================= */

  saveBtn.onclick = () => {
    if (!lastStructuredResult) {
      status.innerText = "Nothing to save";
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      getSavedJobs((saved) => {

        // 🔥 DUPLICATE CHECK (by job_url)
        const alreadyExists = saved.some(
          job => job.job_url === currentUrl
        );

        if (alreadyExists) {
          status.innerText = "Job already saved";
          return;
        }

        saved.push({
          id: Date.now(),
          ...lastStructuredResult,
          job_url: currentUrl,
          createdAt: new Date().toISOString()
        });

        setSavedJobs(saved, () => {
          status.innerText = "Saved successfully";
          window.loadLibrary();
        });
      });
    });
  };
}