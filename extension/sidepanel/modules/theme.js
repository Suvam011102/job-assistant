export function initTheme() {
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeToggle.checked = theme === "dark";
  }

  function detectSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  chrome.storage.local.get(["theme"], (result) => {
    applyTheme(result.theme || detectSystemTheme());
  });

  themeToggle.addEventListener("change", () => {
    const newTheme = themeToggle.checked ? "dark" : "light";
    applyTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
  });
}