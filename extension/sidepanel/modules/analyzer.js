import { sendMessageToActiveTab } from "./messaging.js";
import { getSavedJobs, setSavedJobs } from "./storage.js";
import { showToast } from "./feedback.js";

const BACKEND_URL = "http://localhost:5000";
const DEFAULT_SUMMARY_TEXT = "No summary generated yet.";

export function initAnalyzer() {
  const outputBox = document.getElementById("outputBox");
  const summaryBox = document.getElementById("summaryBox");

  const startBtn = document.getElementById("startSelection");
  const stopBtn = document.getElementById("stopSelection");
  const resetBtn = document.getElementById("resetSelection");
  const summarizeBtn = document.getElementById("summarize");
  const saveBtn = document.getElementById("saveSummary");
  const adviceBtn = document.getElementById("getAdvice");
  const showOutputBtn = document.getElementById("showOutput");
  const clearTextBtn = document.getElementById("clearText");
  const briefTab = document.getElementById("briefTab");
  const actionButtons = [
    startBtn,
    stopBtn,
    resetBtn,
    summarizeBtn,
    saveBtn,
    adviceBtn,
    showOutputBtn,
    clearTextBtn,
  ].filter(Boolean);

  let lastStructuredResult = null;
  let lastAdviceResult = null;
  let isBusy = false;

  function setSummary(text) {
    summaryBox.textContent = text;
  }

  function appendSummary(text) {
    const baseText = summaryBox.textContent === DEFAULT_SUMMARY_TEXT ? "" : summaryBox.textContent;
    summaryBox.textContent = `${baseText}${baseText ? "\n\n" : ""}${text}`;
  }

  function openBriefTab() {
    briefTab?.click();
  }

  function createDetailPill(label, value) {
    const pill = document.createElement("div");
    pill.className = "brief-pill";

    const labelEl = document.createElement("span");
    labelEl.className = "brief-pill-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.className = "brief-pill-value";
    valueEl.textContent = value || "N/A";

    pill.appendChild(labelEl);
    pill.appendChild(valueEl);
    return pill;
  }

  function createTagList(title, values = [], emptyText = "N/A") {
    const section = document.createElement("section");
    section.className = "brief-block";

    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "brief-tag-list";

    if (!values.length) {
      const empty = document.createElement("span");
      empty.className = "brief-empty";
      empty.textContent = emptyText;
      list.appendChild(empty);
    } else {
      values.forEach((value) => {
        const tag = document.createElement("span");
        tag.className = "brief-tag";
        tag.textContent = value;
        list.appendChild(tag);
      });
    }

    section.appendChild(list);
    return section;
  }

  function createListBlock(title, values = [], emptyText = "N/A") {
    const section = document.createElement("section");
    section.className = "brief-block";

    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);

    if (!values.length) {
      const empty = document.createElement("p");
      empty.className = "brief-empty";
      empty.textContent = emptyText;
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "brief-list";

    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      list.appendChild(item);
    });

    section.appendChild(list);
    return section;
  }

  function renderBrief(result, advice = null) {
    summaryBox.textContent = "";
    summaryBox.replaceChildren();
    summaryBox.classList.add("brief-layout");

    if (!result) {
      setSummary(DEFAULT_SUMMARY_TEXT);
      return;
    }

    const hero = document.createElement("section");
    hero.className = "brief-hero";

    const titleGroup = document.createElement("div");

    const title = document.createElement("h3");
    title.className = "brief-title";
    title.textContent = result.title || "Untitled role";

    const company = document.createElement("p");
    company.className = "brief-company";
    company.textContent = result.company || "Unknown company";

    const synopsis = document.createElement("p");
    synopsis.className = "brief-summary";
    synopsis.textContent = result.summary || "No summary generated yet.";

    titleGroup.appendChild(title);
    titleGroup.appendChild(company);
    titleGroup.appendChild(synopsis);
    hero.appendChild(titleGroup);

    const metaGrid = document.createElement("div");
    metaGrid.className = "brief-meta-grid";
    metaGrid.appendChild(createDetailPill("Location", result.location || "N/A"));
    metaGrid.appendChild(createDetailPill("Type", result.job_type || "N/A"));
    metaGrid.appendChild(createDetailPill("Remote", result.remote ? "Yes" : "No"));
    metaGrid.appendChild(
      createDetailPill("Experience", result.experience_required || "Not specified")
    );
    metaGrid.appendChild(
      createDetailPill("Salary", result.salary_range || "Not listed")
    );
    hero.appendChild(metaGrid);

    summaryBox.appendChild(hero);

    const contentGrid = document.createElement("div");
    contentGrid.className = "brief-content-grid";
    contentGrid.appendChild(
      createTagList("Skills", result.skills || [], "No skills extracted")
    );
    contentGrid.appendChild(
      createTagList("Tech Stack", result.tech_stack || [], "No stack extracted")
    );
    summaryBox.appendChild(contentGrid);

    if (advice) {
      const adviceGrid = document.createElement("div");
      adviceGrid.className = "brief-advice-grid";

      const insight = document.createElement("section");
      insight.className = "brief-block brief-insight";
      const insightTitle = document.createElement("h3");
      insightTitle.textContent = "Company Insight";
      const insightText = document.createElement("p");
      insightText.textContent = advice.company_insight || "No company insight available.";
      insight.appendChild(insightTitle);
      insight.appendChild(insightText);
      adviceGrid.appendChild(insight);

      adviceGrid.appendChild(
        createListBlock(
          "Strengths to Highlight",
          advice.key_strengths_to_highlight || [],
          "No strengths suggested"
        )
      );
      adviceGrid.appendChild(
        createListBlock(
          "Topics to Prepare",
          advice.important_topics_to_prepare || [],
          "No preparation topics suggested"
        )
      );
      adviceGrid.appendChild(
        createListBlock(
          "Interview Focus",
          advice.likely_interview_focus || [],
          "No interview focus suggested"
        )
      );
      adviceGrid.appendChild(
        createListBlock(
          "Preparation Steps",
          advice.recommended_preparation_steps || [],
          "No preparation steps suggested"
        )
      );
      adviceGrid.appendChild(
        createListBlock("Resume Focus", advice.resume_focus || [], "No resume focus suggested")
      );
      adviceGrid.appendChild(
        createListBlock(
          "Questions to Ask",
          advice.questions_to_ask_interviewer || [],
          "No questions suggested"
        )
      );

      summaryBox.appendChild(adviceGrid);
    }
  }

  function setState(state) {
    if (state === "IDLE") {
      startBtn.disabled = false;
      startBtn.innerText = "Start Selection";
      stopBtn.disabled = true;
      resetBtn.disabled = true;
      summarizeBtn.disabled = true;
      saveBtn.disabled = true;
      if (adviceBtn) {
        adviceBtn.disabled = true;
      }
    }

    if (state === "SELECTING") {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      resetBtn.disabled = false;
      summarizeBtn.disabled = true;
      saveBtn.disabled = true;
      if (adviceBtn) {
        adviceBtn.disabled = true;
      }
    }

    if (state === "PAUSED") {
      startBtn.disabled = false;
      startBtn.innerText = "Resume Selection";
      stopBtn.disabled = true;
      resetBtn.disabled = false;
      summarizeBtn.disabled = false;
      saveBtn.disabled = true;
      if (adviceBtn) {
        adviceBtn.disabled = true;
      }
    }

    if (state === "SUMMARIZED") {
      startBtn.disabled = false;
      startBtn.innerText = "Resume Selection";
      stopBtn.disabled = true;
      resetBtn.disabled = false;
      summarizeBtn.disabled = true;
      saveBtn.disabled = false;
      if (adviceBtn) {
        adviceBtn.disabled = false;
      }
    }

    actionButtons.forEach((button) => {
      if (button.dataset.wasDisabled === "true") {
        button.disabled = true;
        delete button.dataset.wasDisabled;
      }
    });
  }

  function setBusyState(nextBusy, label = "") {
    isBusy = nextBusy;

    actionButtons.forEach((button) => {
      if (nextBusy) {
        button.dataset.wasDisabled = String(button.disabled);
        button.disabled = true;
      }
    });

    if (nextBusy) {
      setSummary(label || "Working...");
      return;
    }

    actionButtons.forEach((button) => {
      if (button.dataset.wasDisabled === "false") {
        button.disabled = false;
      }
      delete button.dataset.wasDisabled;
    });
  }

  async function postJSON(path, payload) {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }

  function resetAnalyzer() {
    sendMessageToActiveTab({ action: "clearSelection" });
    outputBox.value = "";
    lastStructuredResult = null;
    lastAdviceResult = null;
    setSummary(DEFAULT_SUMMARY_TEXT);
    summaryBox.classList.remove("brief-layout");
    setState("IDLE");
    showToast("Selection reset.", "info");
  }

  setSummary(DEFAULT_SUMMARY_TEXT);
  setState("IDLE");

  startBtn.onclick = () => {
    sendMessageToActiveTab({ action: "startSelection" });
    setState("SELECTING");
    showToast("Selection mode enabled.", "info");
  };

  stopBtn.onclick = () => {
    sendMessageToActiveTab({ action: "stopSelection" });
    setState("PAUSED");
    showToast("Selection paused. You can summarize now.", "info");
  };

  resetBtn.onclick = () => {
    resetAnalyzer();
  };

  showOutputBtn.onclick = () => {
    if (isBusy) {
      return;
    }

    sendMessageToActiveTab({ action: "getSelection" }, (response) => {
      const text = response?.text?.trim();
      outputBox.value = text || "";
      outputBox.focus();

      if (text) {
        setState("PAUSED");
        showToast("Loaded selected content.", "success");
      } else {
        showToast("No selected content found yet.", "error");
      }
    });
  };

  clearTextBtn.onclick = () => {
    outputBox.value = "";
    lastStructuredResult = null;
    lastAdviceResult = null;
    setSummary(DEFAULT_SUMMARY_TEXT);
    summaryBox.classList.remove("brief-layout");
    setState("IDLE");
    showToast("Cleared current analysis text.", "info");
  };

  summarizeBtn.onclick = () => {
    if (isBusy) {
      return;
    }

    const runSummary = async (text) => {
      if (!text) {
        setSummary("Select some job content before summarizing.");
        showToast("Select some job content before summarizing.", "error");
        return;
      }

      outputBox.value = text;
      setBusyState(true, "Generating summary...");

      try {
        const data = await postJSON("/summarize", { jobText: text });
        const result = data.result || {};

        lastStructuredResult = result;
        lastAdviceResult = null;

        renderBrief(result);

        setState("SUMMARIZED");
        openBriefTab();
        showToast("Summary generated.", "success");
      } catch (error) {
        console.error("Summarize failed", error);
        setSummary(`Could not generate summary.\n${error.message}`);
        showToast("Could not generate summary.", "error");
      } finally {
        setBusyState(false);
        setState(lastStructuredResult ? "SUMMARIZED" : "PAUSED");
      }
    };

    const currentText = outputBox.value.trim();
    if (currentText) {
      runSummary(currentText);
      return;
    }

    sendMessageToActiveTab({ action: "getSelection" }, async (response) => {
      const text = response?.text?.trim();
      await runSummary(text);
    });
  };

  if (adviceBtn) {
    adviceBtn.onclick = async () => {
      if (isBusy) {
        return;
      }

      const text = outputBox.value.trim();

      if (!text || !lastStructuredResult) {
        setSummary("Generate a summary first before requesting job advice.");
        showToast("Generate a summary first.", "error");
        return;
      }

      try {
        setBusyState(true, `${summaryBox.textContent}\n\nGenerating interview advice...`);

        const data = await postJSON("/job-advice", {
          jobText: text,
          jobSummary: lastStructuredResult,
        });
        const advice = data.advice || {};
        lastAdviceResult = advice;
        renderBrief(lastStructuredResult, advice);
        openBriefTab();
        showToast("Advice generated.", "success");
      } catch (error) {
        console.error("Advice generation failed", error);
        appendSummary(`Advice generation failed.\n${error.message}`);
        showToast("Advice generation failed.", "error");
      } finally {
        setBusyState(false);
        setState(lastStructuredResult ? "SUMMARIZED" : "PAUSED");
      }
    };
  }

  saveBtn.onclick = () => {
    if (!lastStructuredResult) {
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0]?.url || "";

      getSavedJobs((saved) => {
        const alreadyExists = saved.some((job) => job.job_url === currentUrl);

        if (alreadyExists) {
          showToast("This job is already saved.", "info");
          return;
        }

        saved.push({
          id: Date.now(),
          ...lastStructuredResult,
          job_url: currentUrl,
          createdAt: new Date().toISOString(),
        });

        setSavedJobs(saved, () => {
          window.loadLibrary();
          showToast("Saved to library.", "success");
        });
      });
    });
  };
}
