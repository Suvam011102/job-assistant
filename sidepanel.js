const outputBox = document.getElementById("outputBox");
const status = document.getElementById("status");
const summaryBox = document.getElementById("summaryBox");

/* -------- Utility -------- */

async function sendMessage(action) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action }, resolve);
  });
}

/* -------- Selection Controls -------- */

document.getElementById("startSelection").addEventListener("click", async () => {
  await sendMessage("startSelection");
  status.innerText = "Selecting...";
});

document.getElementById("stopSelection").addEventListener("click", async () => {
  await sendMessage("stopSelection");
  status.innerText = "Stopped";
});

document.getElementById("resetSelection").addEventListener("click", async () => {
  await sendMessage("clearSelection");
  outputBox.value = "";
  summaryBox.innerText = "No summary generated yet.";
  status.innerText = "Reset";
});

/* -------- Show Selected Text -------- */

document.getElementById("showOutput").addEventListener("click", async () => {
  const response = await sendMessage("getSelection");

  if (!response?.text) {
    outputBox.value = "No content selected.";
    return;
  }

  outputBox.value = response.text;
});

/* -------- Clear Text Only -------- */

document.getElementById("clearText").addEventListener("click", () => {
  outputBox.value = "";
  status.innerText = "Text Cleared";
});

/* -------- Summarize via Backend -------- */

document.getElementById("summarize").addEventListener("click", async () => {
  if (!outputBox.value.trim()) {
    status.innerText = "No content to summarize";
    return;
  }

  status.innerText = "Summarizing...";

  try {
    const response = await fetch("http://localhost:5000/summarize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jobText: outputBox.value
      })
    });

    const data = await response.json();

    if (!data.result) {
      summaryBox.innerText = "Failed to generate summary.";
      status.innerText = "Error";
      return;
    }

    const result = data.result;

    summaryBox.innerText =
`Title: ${result.title}

Company: ${result.company}

Location: ${result.location}

Experience: ${result.experience_required}

Job Type: ${result.job_type}

Skills: ${result.skills?.join(", ")}

Tech Stack: ${result.tech_stack?.join(", ")}

Summary:
${result.summary}`;

    status.innerText = "Summary Ready";

  } catch (error) {
    console.error(error);
    summaryBox.innerText = "Backend connection failed.";
    status.innerText = "Error";
  }
});