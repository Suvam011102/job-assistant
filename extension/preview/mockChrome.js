const STORAGE_KEY = "job-assistant-preview-storage";

function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStorage(storage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
}

const previewState = {
  storage: loadStorage(),
  blocks: [
    {
      id: "title",
      label: "Role",
      text: "Senior Frontend Engineer",
    },
    {
      id: "company",
      label: "Company",
      text: "Acme Labs",
    },
    {
      id: "meta",
      label: "Location",
      text: "Remote - India | Full-time",
    },
    {
      id: "summary",
      label: "Overview",
      text:
        "We are hiring a frontend engineer with React, TypeScript, CSS, API integration, and testing experience.",
    },
    {
      id: "requirements",
      label: "Requirements",
      text:
        "4+ years experience, strong JavaScript and UI architecture, and familiarity with design systems and performance optimization.",
    },
  ],
  selectedBlockIds: ["title", "company", "meta", "summary", "requirements"],
  selectedText:
    "Senior Frontend Engineer\nAcme Labs\nRemote - India\n\nWe are hiring a frontend engineer with React, TypeScript, CSS, API integration, and testing experience.\n\nRequirements:\n- 4+ years experience\n- Strong JavaScript and UI architecture\n- Familiarity with design systems and performance optimization",
  activeTabUrl: "https://www.example.com/jobs/frontend-engineer",
  selectionMode: false,
};

function updateSelectedTextFromBlocks() {
  const selectedBlocks = previewState.blocks.filter((block) =>
    previewState.selectedBlockIds.includes(block.id)
  );
  previewState.selectedText = selectedBlocks.map((block) => block.text).join("\n\n");
}

updateSelectedTextFromBlocks();

function notifyPreviewState() {
  window.dispatchEvent(
    new CustomEvent("job-assistant-preview-state", {
      detail: { ...previewState },
    })
  );
}

window.__JOB_ASSISTANT_PREVIEW_STATE__ = previewState;

window.chrome = {
  storage: {
    local: {
      get(keys, callback) {
        const storage = previewState.storage;

        if (Array.isArray(keys)) {
          const result = Object.fromEntries(keys.map((key) => [key, storage[key]]));
          callback(result);
          return;
        }

        if (typeof keys === "string") {
          callback({ [keys]: storage[keys] });
          return;
        }

        callback({ ...storage });
      },
      set(values, callback) {
        previewState.storage = {
          ...previewState.storage,
          ...values,
        };
        saveStorage(previewState.storage);
        callback?.();
        notifyPreviewState();
      },
    },
  },
  tabs: {
    query(queryInfo, callback) {
      callback([
        {
          id: 1,
          active: true,
          currentWindow: true,
          url: previewState.activeTabUrl,
        },
      ]);
    },
    sendMessage(tabId, message, callback) {
      switch (message.action) {
        case "startSelection":
          previewState.selectionMode = true;
          notifyPreviewState();
          callback?.({ ok: true });
          break;
        case "stopSelection":
          previewState.selectionMode = false;
          notifyPreviewState();
          callback?.({ ok: true });
          break;
        case "clearSelection":
          previewState.selectionMode = false;
          previewState.selectedBlockIds = [];
          previewState.selectedText = "";
          notifyPreviewState();
          callback?.({ ok: true });
          break;
        case "getSelection":
          callback?.({ text: previewState.selectedText });
          break;
        default:
          callback?.({ ok: true });
          break;
      }
    },
    create({ url }) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  },
  runtime: {
    onInstalled: {
      addListener() {},
    },
  },
  sidePanel: {
    setPanelBehavior() {},
    open() {},
  },
  action: {
    onClicked: {
      addListener() {},
    },
  },
};

notifyPreviewState();
