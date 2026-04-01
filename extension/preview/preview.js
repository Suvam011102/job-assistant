import { initSidepanelApp } from "../sidepanel/app.js";

const previewState = window.__JOB_ASSISTANT_PREVIEW_STATE__;
const originalFetch = window.fetch.bind(window);
let knownPreviewVersion = null;

function updateSelectedTextFromBlocks() {
  const selectedBlocks = previewState.blocks.filter((block) =>
    previewState.selectedBlockIds.includes(block.id)
  );
  previewState.selectedText = selectedBlocks.map((block) => block.text).join("\n\n");
}

function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function summarizeText(jobText) {
  const lines = jobText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const skillPool = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "CSS",
    "Testing",
    "Redis",
    "API Integration",
    "Design Systems",
  ];

  const matchedSkills = skillPool.filter((skill) =>
    jobText.toLowerCase().includes(skill.toLowerCase())
  );

  return {
    title: lines[0] || "Sample Role",
    company: lines[1] || "Preview Company",
    summary: `Preview summary generated from ${Math.min(lines.length, 6)} detected content lines.`,
    skills: matchedSkills.length ? matchedSkills : ["Communication", "Problem Solving"],
    tech_stack: matchedSkills.filter((skill) =>
      ["JavaScript", "TypeScript", "React", "Node.js", "Redis", "CSS"].includes(skill)
    ),
    experience_required: /\b\d+\+?\s+years?\b/i.exec(jobText)?.[0] || "Not specified",
    location: /remote/i.test(jobText) ? "Remote" : "Hybrid",
    job_type: /contract/i.test(jobText) ? "Contract" : "Full-time",
    remote: /remote/i.test(jobText),
    salary_range: null,
  };
}

function buildAdvice(summary) {
  return {
    company_insight: `${summary.company} appears to be hiring for a role with strong emphasis on delivery and collaboration.`,
    key_strengths_to_highlight: summary.skills.slice(0, 4),
    important_topics_to_prepare: ["System design", "Frontend architecture", "Behavioral examples"],
    likely_interview_focus: ["Past project impact", "Technical depth", "Communication"],
    recommended_preparation_steps: [
      "Prepare 2-3 relevant project stories",
      "Review the core stack listed in the job",
      "Practice discussing tradeoffs and collaboration",
    ],
    resume_focus: ["Impact metrics", "Relevant stack experience", "Ownership"],
    questions_to_ask_interviewer: [
      "What does success look like in the first 90 days?",
      "How is the team structured?",
      "What are the biggest technical challenges right now?",
    ],
  };
}

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const mockBackendEnabled = document.getElementById("mockBackend")?.checked ?? true;

  if (mockBackendEnabled && url.startsWith("http://localhost:5000/")) {
    const payload = init?.body ? JSON.parse(init.body) : {};

    if (url.endsWith("/summarize")) {
      if (!payload.jobText?.trim()) {
        return createJsonResponse({ error: "No job text provided" }, 400);
      }

      return createJsonResponse({ result: summarizeText(payload.jobText) });
    }

    if (url.endsWith("/job-advice")) {
      if (!payload.jobText?.trim()) {
        return createJsonResponse({ error: "Job text required" }, 400);
      }

      const summary = payload.jobSummary || summarizeText(payload.jobText);
      return createJsonResponse({ advice: buildAdvice(summary) });
    }
  }

  return originalFetch(input, init);
};

function syncPreviewInputs() {
  const selectedTextInput = document.getElementById("selectedTextInput");
  const jobUrlInput = document.getElementById("jobUrlInput");
  const selectionStatus = document.getElementById("selectionStatus");

  selectedTextInput.value = previewState.selectedText;
  jobUrlInput.value = previewState.activeTabUrl;
  selectionStatus.textContent = previewState.selectionMode
    ? "Selection mode: active"
    : "Selection mode: idle";

  document.querySelectorAll(".preview-job-block").forEach((element) => {
    const isSelected = previewState.selectedBlockIds.includes(element.dataset.blockId);
    element.classList.toggle("is-selected", isSelected);
    element.classList.toggle("is-selecting", previewState.selectionMode);
  });
}

function renderMockJobPage() {
  const mockJobPage = document.getElementById("mockJobPage");
  mockJobPage.replaceChildren();

  previewState.blocks.forEach((block) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "preview-job-block";
    card.dataset.blockId = block.id;

    const label = document.createElement("span");
    label.className = "preview-job-block-label";
    label.textContent = block.label;

    const body = document.createElement("p");
    body.textContent = block.text;

    card.appendChild(label);
    card.appendChild(body);

    card.addEventListener("click", () => {
      if (!previewState.selectionMode) {
        return;
      }

      if (previewState.selectedBlockIds.includes(block.id)) {
        previewState.selectedBlockIds = previewState.selectedBlockIds.filter((id) => id !== block.id);
      } else {
        previewState.selectedBlockIds = [...previewState.selectedBlockIds, block.id];
      }

      updateSelectedTextFromBlocks();
      window.dispatchEvent(new CustomEvent("job-assistant-preview-state"));
    });

    mockJobPage.appendChild(card);
  });
}

async function pollForChanges() {
  try {
    const response = await originalFetch("/__preview_version", { cache: "no-store" });
    const data = await response.json();

    if (knownPreviewVersion === null) {
      knownPreviewVersion = data.version;
      return;
    }

    if (data.version !== knownPreviewVersion) {
      window.location.reload();
    }
  } catch (error) {
    console.warn("Preview auto-refresh check failed:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSidepanelApp();

  const selectedTextInput = document.getElementById("selectedTextInput");
  const jobUrlInput = document.getElementById("jobUrlInput");
  const resetFixturesBtn = document.getElementById("resetFixtures");

  selectedTextInput.addEventListener("input", (event) => {
    previewState.selectedText = event.target.value;
    previewState.selectedBlockIds = [];
  });

  jobUrlInput.addEventListener("input", (event) => {
    previewState.activeTabUrl = event.target.value;
  });

  resetFixturesBtn.addEventListener("click", () => {
    previewState.selectedBlockIds = previewState.blocks.map((block) => block.id);
    updateSelectedTextFromBlocks();
    previewState.activeTabUrl = "https://www.example.com/jobs/frontend-engineer";
    window.dispatchEvent(new CustomEvent("job-assistant-preview-state"));
  });

  window.addEventListener("job-assistant-preview-state", syncPreviewInputs);
  renderMockJobPage();
  syncPreviewInputs();
  pollForChanges();
  window.setInterval(pollForChanges, 1000);
});
