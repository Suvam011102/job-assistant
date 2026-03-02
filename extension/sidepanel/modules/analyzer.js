import { sendMessageToActiveTab } from "./messaging.js";
import { getSavedJobs, setSavedJobs } from "./storage.js";

export function initAnalyzer() {
  const outputBox = document.getElementById("outputBox");
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
  };

  stopBtn.onclick = () => {
    sendMessageToActiveTab({ action: "stopSelection" });
  };

  resetBtn.onclick = () => {
    sendMessageToActiveTab({ action: "clearSelection" });
    outputBox.value = "";
    summaryBox.innerText = "";
    lastStructuredResult = null;
  };

  /* ================= SUMMARIZE ================= */

  summarizeBtn.onclick = () => {
    sendMessageToActiveTab({ action: "getSelection" }, async (response) => {
      const text = response?.text?.trim();

      if (!text) {
        return;
      }

      outputBox.value = text;

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

      } catch (err) {
        console.error("Summarize failed", err);
      }
    });
  };

  /* ================= SAVE WITH DUPLICATE CHECK ================= */

  saveBtn.onclick = () => {
    if (!lastStructuredResult) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      getSavedJobs((saved) => {

        const alreadyExists = saved.some(
          job => job.job_url === currentUrl
        );

        if (alreadyExists) {
          return;
        }

        saved.push({
          id: Date.now(),
          ...lastStructuredResult,
          job_url: currentUrl,
          createdAt: new Date().toISOString()
        });

        setSavedJobs(saved, () => {
          window.loadLibrary();
        });
      });
    });
  };
}