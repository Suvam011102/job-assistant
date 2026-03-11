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
  const adviceBtn = document.getElementById("getAdvice");

  let lastStructuredResult = null;

  let selecting = false;

  /* ================= UI STATE ================= */

  function setState(state) {

    if (state === "IDLE") {

      startBtn.disabled = false;
      startBtn.innerText = "Start Selection";

      stopBtn.disabled = true;
      resetBtn.disabled = true;
      summarizeBtn.disabled = true;
      saveBtn.disabled = true;
      if (adviceBtn) adviceBtn.disabled = true;

    }

    if (state === "SELECTING") {

      startBtn.disabled = true;

      stopBtn.disabled = false;
      resetBtn.disabled = false;

      summarizeBtn.disabled = true;
      saveBtn.disabled = true;
      if (adviceBtn) adviceBtn.disabled = true;

    }

    if (state === "PAUSED") {

      startBtn.disabled = false;
      startBtn.innerText = "Resume Selection";

      stopBtn.disabled = true;
      resetBtn.disabled = false;

      summarizeBtn.disabled = false;
      saveBtn.disabled = true;
      if (adviceBtn) adviceBtn.disabled = true;

    }

    if (state === "SUMMARIZED") {

      startBtn.disabled = false;
      startBtn.innerText = "Resume Selection";

      stopBtn.disabled = true;
      resetBtn.disabled = false;

      summarizeBtn.disabled = true;
      saveBtn.disabled = false;
      if (adviceBtn) adviceBtn.disabled = false;

    }
  }

  setState("IDLE");

  /* ================= START ================= */

  startBtn.onclick = () => {

    selecting = true;

    sendMessageToActiveTab({ action: "startSelection" });

    setState("SELECTING");

  };

  /* ================= STOP ================= */

  stopBtn.onclick = () => {

    selecting = false;

    sendMessageToActiveTab({ action: "stopSelection" });

    setState("PAUSED");

  };

  /* ================= RESET ================= */

  resetBtn.onclick = () => {

    selecting = false;

    sendMessageToActiveTab({ action: "clearSelection" });

    outputBox.value = "";
    summaryBox.innerText = "";

    lastStructuredResult = null;

    setState("IDLE");

  };

  /* ================= SUMMARIZE ================= */

  summarizeBtn.onclick = () => {

    sendMessageToActiveTab({ action: "getSelection" }, async (response) => {

      const text = response?.text?.trim();

      if (!text) return;

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

        setState("SUMMARIZED");

      } catch (err) {

        console.error("Summarize failed", err);

      }

    });

  };

  /* ================= JOB ADVICE ================= */

  if (adviceBtn) {

    adviceBtn.onclick = async () => {

      const text = outputBox.value;

      if (!text || !lastStructuredResult) return;

      try {

        const res = await fetch("http://localhost:5000/job-advice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobText: text,
            jobSummary: lastStructuredResult
          })
        });

        const data = await res.json();
        const advice = data.advice || {};

        summaryBox.innerText +=

          "\n\n--- AI JOB ADVICE ---\n\n" +

          "Strengths to Highlight:\n" +
          (advice.key_strengths_to_highlight?.join(", ") || "N/A") +

          "\n\nTopics to Prepare:\n" +
          (advice.important_topics_to_prepare?.join(", ") || "N/A") +

          "\n\nInterview Focus:\n" +
          (advice.likely_interview_focus?.join(", ") || "N/A") +

          "\n\nPreparation Steps:\n" +
          (advice.recommended_preparation_steps?.join(", ") || "N/A");

      } catch (err) {

        console.error("Advice generation failed", err);

      }

    };

  }

  /* ================= SAVE ================= */

  saveBtn.onclick = () => {

    if (!lastStructuredResult) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

      const currentUrl = tabs[0]?.url || "";

      getSavedJobs((saved) => {

        const alreadyExists = saved.some(
          job => job.job_url === currentUrl
        );

        if (alreadyExists) return;

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
