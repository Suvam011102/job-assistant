import { getSavedJobs, setSavedJobs } from "./storage.js";

export function initLibrary() {
  window.loadLibrary = loadLibrary;
}

function loadLibrary() {
  const libraryList = document.getElementById("libraryList");
  const jobCount = document.getElementById("jobCount");

  getSavedJobs((saved) => {
    libraryList.innerHTML = "";
    jobCount.textContent = saved.length;

    if (saved.length === 0) {
      libraryList.innerHTML = "<p>No saved jobs</p>";
      return;
    }

    // 🔹 Render Cards
    saved.forEach(job => {
      const div = document.createElement("div");
      div.className = "library-card";
      div.dataset.id = job.id; // Needed for drag persistence

      const skills = job.skills?.map(s =>
        `<span class="skill-badge">${s}</span>`
      ).join(" ") || "";

      div.innerHTML = `
        <div class="card-header">
          <div>
            <h3>${job.title}</h3>
            <p class="meta">${job.company} • ${job.location}</p>
            <p class="meta-small">${job.job_type} • ${job.experience_required}</p>
          </div>

          <div class="card-actions">
            <button class="icon-btn link-btn" data-url="${job.job_url}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 0 0 0 6h3v2h-3a5 5 0 0 1-5-5z"/>
              </svg>
            </button>

            <button class="icon-btn delete-btn" data-id="${job.id}">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="currentColor" d="M6 7h12v2H6zm2 3h8l-1 9H9l-1-9z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="skills-container">${skills}</div>
      `;

      libraryList.appendChild(div);
    });

    // 🔥 Enable Drag & Reorder (Requires SortableJS CDN in HTML)
    if (typeof Sortable !== "undefined") {
      new Sortable(libraryList, {
        animation: 150,
        ghostClass: "drag-ghost",
        onEnd: () => {
          const reordered = [];

          document.querySelectorAll(".library-card").forEach(card => {
            const id = Number(card.dataset.id);
            const job = saved.find(j => j.id === id);
            if (job) reordered.push(job);
          });

          setSavedJobs(reordered);
        }
      });
    }

    // 🔹 Delete
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.onclick = () => {
        const id = Number(btn.dataset.id);
        const updated = saved.filter(j => j.id !== id);
        setSavedJobs(updated, loadLibrary);
      };
    });

    // 🔹 Open Job Link
    document.querySelectorAll(".link-btn").forEach(btn => {
      btn.onclick = () => {
        const url = btn.dataset.url;
        if (url) chrome.tabs.create({ url });
      };
    });
  });
}