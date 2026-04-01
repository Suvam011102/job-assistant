import { getSavedJobs, setSavedJobs } from "./storage.js";

export function initLibrary() {
  window.loadLibrary = loadLibrary;
}

function createIconButton(className, datasetKey, datasetValue, pathMarkup) {
  const button = document.createElement("button");
  button.className = `icon-btn ${className}`;
  button.dataset[datasetKey] = datasetValue;
  button.type = "button";
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      ${pathMarkup}
    </svg>
  `;
  return button;
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function formatSavedDate(value) {
  if (!value) {
    return "Saved date unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Saved date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function createSkillBadges(skills = []) {
  const container = document.createElement("div");
  container.className = "skills-container";

  skills.forEach((skill) => {
    const badge = document.createElement("span");
    badge.className = "skill-badge";
    badge.textContent = skill;
    container.appendChild(badge);
  });

  return container;
}

function createLibraryCard(job) {
  const card = document.createElement("div");
  card.className = "library-card";
  card.dataset.id = String(job.id);

  const header = document.createElement("div");
  header.className = "card-header";

  const info = document.createElement("div");
  info.appendChild(createTextElement("h3", "", job.title || "Untitled role"));
  info.appendChild(
    createTextElement(
      "p",
      "meta",
      `${job.company || "Unknown company"} • ${job.location || "Unknown location"}`
    )
  );
  info.appendChild(
    createTextElement(
      "p",
      "meta-small",
      `${job.job_type || "Unknown type"} • ${job.experience_required || "Experience not listed"}`
    )
  );
  info.appendChild(
    createTextElement("p", "meta-saved", `Saved ${formatSavedDate(job.createdAt)}`)
  );

  const actions = document.createElement("div");
  actions.className = "card-actions";

  actions.appendChild(
    createIconButton(
      "toggle-btn",
      "expanded",
      "false",
      '<path fill="currentColor" d="M7 10l5 5 5-5z"/>'
    )
  );

  actions.appendChild(
    createIconButton(
      "link-btn",
      "url",
      job.job_url || "",
      '<path fill="currentColor" d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 0 0 0 6h3v2h-3a5 5 0 0 1-5-5z"/><path fill="currentColor" d="M12.1 7h3a5 5 0 0 1 0 10h-3v-2h3a3 3 0 1 0 0-6h-3z"/>'
    )
  );

  actions.appendChild(
    createIconButton(
      "delete-btn",
      "id",
      String(job.id),
      '<path fill="currentColor" d="M6 7h12v2H6zm2 3h8l-1 9H9l-1-9z"/>'
    )
  );

  header.appendChild(info);
  header.appendChild(actions);
  card.appendChild(header);
  card.appendChild(createSkillBadges(job.skills));

  const details = document.createElement("div");
  details.className = "library-details";
  details.hidden = true;

  details.appendChild(
    createTextElement("p", "library-summary", job.summary || "No summary available.")
  );

  const detailGrid = document.createElement("div");
  detailGrid.className = "library-detail-grid";
  detailGrid.appendChild(
    createTextElement("p", "library-detail-item", `Remote: ${job.remote ? "Yes" : "No"}`)
  );
  detailGrid.appendChild(
    createTextElement(
      "p",
      "library-detail-item",
      `Salary: ${job.salary_range || "Not listed"}`
    )
  );
  detailGrid.appendChild(
    createTextElement(
      "p",
      "library-detail-item",
      `Tech Stack: ${job.tech_stack?.join(", ") || "Not listed"}`
    )
  );
  detailGrid.appendChild(
    createTextElement(
      "p",
      "library-detail-item",
      `Job URL: ${job.job_url || "Not available"}`
    )
  );

  details.appendChild(detailGrid);
  card.appendChild(details);

  return card;
}

function attachLibraryEventHandlers(saved) {
  document.querySelectorAll(".toggle-btn").forEach((button) => {
    button.onclick = () => {
      const card = button.closest(".library-card");
      const details = card?.querySelector(".library-details");
      if (!details) {
        return;
      }

      const nextExpanded = button.dataset.expanded !== "true";
      button.dataset.expanded = String(nextExpanded);
      details.hidden = !nextExpanded;
      button.classList.toggle("is-open", nextExpanded);
    };
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.onclick = () => {
      const id = Number(button.dataset.id);
      const updated = saved.filter((job) => job.id !== id);
      setSavedJobs(updated, loadLibrary);
    };
  });

  document.querySelectorAll(".link-btn").forEach((button) => {
    button.onclick = () => {
      const url = button.dataset.url;
      if (url) {
        chrome.tabs.create({ url });
      }
    };
  });
}

function enableSorting(libraryList, saved) {
  if (typeof Sortable === "undefined") {
    return;
  }

  if (libraryList._sortableInstance) {
    libraryList._sortableInstance.destroy();
  }

  libraryList._sortableInstance = new Sortable(libraryList, {
    animation: 150,
    ghostClass: "drag-ghost",
    onEnd: () => {
      const reordered = [];

      libraryList.querySelectorAll(".library-card").forEach((card) => {
        const id = Number(card.dataset.id);
        const job = saved.find((item) => item.id === id);
        if (job) {
          reordered.push(job);
        }
      });

      setSavedJobs(reordered);
    },
  });
}

function loadLibrary() {
  const libraryList = document.getElementById("libraryList");
  const jobCount = document.getElementById("jobCount");

  getSavedJobs((saved) => {
    libraryList.replaceChildren();
    jobCount.textContent = String(saved.length);

    if (saved.length === 0) {
      libraryList.appendChild(createTextElement("p", "", "No saved jobs"));
      return;
    }

    saved.forEach((job) => {
      libraryList.appendChild(createLibraryCard(job));
    });

    enableSorting(libraryList, saved);
    attachLibraryEventHandlers(saved);
  });
}
