import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    if (force === true) {
      this.values.add(name);
      return true;
    }

    if (force === false) {
      this.values.delete(name);
      return false;
    }

    if (this.values.has(name)) {
      this.values.delete(name);
      return false;
    }

    this.values.add(name);
    return true;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument, id = "") {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.id = id;
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.disabled = false;
    this.value = "";
    this.checked = false;
    this.onclick = null;
    this.textContent = "";
    this.innerText = "";
    this.className = "";
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  addEventListener(type, handler) {
    const current = this.listeners.get(type) || [];
    current.push(handler);
    this.listeners.set(type, current);
  }

  dispatchEvent(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach((handler) => handler({ target: this, ...event }));
  }

  click() {
    this.onclick?.({ target: this });
    this.dispatchEvent("click");
  }

  focus() {}
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.documentElement = {
      attributes: {},
      setAttribute: (name, value) => {
        this.documentElement.attributes[name] = value;
      },
    };
  }

  register(id, tagName = "div") {
    const element = new FakeElement(tagName, this, id);
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  querySelectorAll() {
    return [];
  }
}

function createChromeMock() {
  const storage = {};
  const tabMessages = [];

  return {
    tabMessages,
    api: {
      storage: {
        local: {
          get(keys, callback) {
            if (Array.isArray(keys)) {
              callback(Object.fromEntries(keys.map((key) => [key, storage[key]])));
              return;
            }

            callback({ ...storage });
          },
          set(values, callback) {
            Object.assign(storage, values);
            callback?.();
          },
        },
      },
      tabs: {
        query(options, callback) {
          callback([{ id: 1, url: "https://example.com/job" }]);
        },
        sendMessage(tabId, message, callback) {
          tabMessages.push(message.action);
          if (message.action === "getSelection") {
            callback?.({ text: "Senior Engineer\nRemote\nReact TypeScript\n4+ years" });
            return;
          }

          callback?.({ ok: true });
        },
        create() {},
      },
    },
  };
}

function installBaseDom() {
  const document = new FakeDocument();
  const ids = [
    "themeToggle",
    "analyzerTab",
    "briefTab",
    "libraryTab",
    "analyzerSection",
    "briefSection",
    "librarySection",
    "outputBox",
    "summaryBox",
    "startSelection",
    "stopSelection",
    "resetSelection",
    "summarize",
    "saveSummary",
    "getAdvice",
    "showOutput",
    "clearText",
    "toast",
  ];

  ids.forEach((id) => document.register(id, id === "outputBox" ? "textarea" : "div"));
  document.getElementById("themeToggle").checked = false;
  document.getElementById("toast").classList.add("hidden");

  global.document = document;
  global.window = {
    loadLibrary() {},
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
  };

  return document;
}

const testFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(testFilePath), "..", "..");
const analyzerModule = pathToFileURL(path.join(repoRoot, "extension/sidepanel/modules/analyzer.js")).href;
const tabsModule = pathToFileURL(path.join(repoRoot, "extension/sidepanel/modules/tabs.js")).href;
const themeModule = pathToFileURL(path.join(repoRoot, "extension/sidepanel/modules/theme.js")).href;
const feedbackModule = pathToFileURL(path.join(repoRoot, "extension/sidepanel/modules/feedback.js")).href;

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function waitFor(assertion, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (attempt === attempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

function getNodeText(element) {
  if (!element) {
    return "";
  }

  const ownText = element.textContent || "";
  const childText = (element.children || []).map((child) => getNodeText(child)).join(" ");
  return `${ownText} ${childText}`.trim();
}

await runCase("theme toggle loads and stores theme", async () => {
  const document = installBaseDom();
  const chromeMock = createChromeMock();
  global.chrome = chromeMock.api;

  const { initTheme } = await import(`${themeModule}?theme=${Date.now()}`);
  initTheme();

  assert.equal(document.documentElement.attributes["data-theme"], "light");

  const toggle = document.getElementById("themeToggle");
  toggle.checked = true;
  toggle.dispatchEvent("change");

  assert.equal(document.documentElement.attributes["data-theme"], "dark");
});

await runCase("tabs switch analyzer and library panels", async () => {
  const document = installBaseDom();
  global.chrome = createChromeMock().api;

  const { initTabs } = await import(`${tabsModule}?tabs=${Date.now()}`);
  initTabs();

  document.getElementById("libraryTab").click();
  assert.equal(document.getElementById("analyzerSection").style.display, "none");
  assert.equal(document.getElementById("librarySection").style.display, "flex");

  document.getElementById("briefTab").click();
  assert.equal(document.getElementById("briefSection").style.display, "flex");
  assert.equal(document.getElementById("librarySection").style.display, "none");

  document.getElementById("analyzerTab").click();
  assert.equal(document.getElementById("analyzerSection").style.display, "flex");
});

await runCase("analyzer buttons drive the main flow", async () => {
  const document = installBaseDom();
  const chromeMock = createChromeMock();
  global.chrome = chromeMock.api;
  global.fetch = async (url, init) => {
    const payload = JSON.parse(init.body);

    if (String(url).endsWith("/summarize")) {
      assert.match(payload.jobText, /Senior Engineer/);
      return {
        ok: true,
        async json() {
          return {
            result: {
              title: "Senior Engineer",
              company: "Acme",
              summary: "Builds product features.",
              skills: ["React", "TypeScript"],
              tech_stack: ["React", "TypeScript"],
              experience_required: "4+ years",
              location: "Remote",
              job_type: "Full-time",
              remote: true,
              salary_range: null,
            },
          };
        },
      };
    }

    if (String(url).endsWith("/job-advice")) {
      return {
        ok: true,
        async json() {
          return {
            advice: {
              company_insight: "Fast-moving team.",
              key_strengths_to_highlight: ["React", "TypeScript"],
              important_topics_to_prepare: ["Architecture"],
              likely_interview_focus: ["Execution"],
              recommended_preparation_steps: ["Prepare stories"],
              resume_focus: ["Impact"],
              questions_to_ask_interviewer: ["How is success measured?"],
            },
          };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const { initFeedback } = await import(`${feedbackModule}?feedback=${Date.now()}`);
  initFeedback();

  const { initTabs } = await import(`${tabsModule}?tabs-flow=${Date.now()}`);
  initTabs();

  const { initAnalyzer } = await import(`${analyzerModule}?analyzer=${Date.now()}`);
  initAnalyzer();

  assert.equal(document.getElementById("startSelection").disabled, false);
  assert.equal(document.getElementById("stopSelection").disabled, true);

  document.getElementById("startSelection").click();
  document.getElementById("stopSelection").click();
  document.getElementById("showOutput").click();

  assert.match(document.getElementById("outputBox").value, /Senior Engineer/);
  assert.deepEqual(chromeMock.tabMessages.slice(0, 3), ["startSelection", "stopSelection", "getSelection"]);

  document.getElementById("summarize").click();
  await waitFor(() =>
    assert.match(getNodeText(document.getElementById("summaryBox")), /Senior Engineer/)
  );
  assert.equal(document.getElementById("saveSummary").disabled, false);
  assert.equal(document.getElementById("briefSection").style.display, "flex");

  document.getElementById("saveSummary").click();
  document.getElementById("getAdvice").click();
  await waitFor(() =>
    assert.match(getNodeText(document.getElementById("summaryBox")), /Questions to Ask/)
  );

  document.getElementById("clearText").click();
  assert.equal(document.getElementById("outputBox").value, "");
  assert.equal(document.getElementById("summaryBox").textContent, "No summary generated yet.");
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
