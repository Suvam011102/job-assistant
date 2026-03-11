import { initTheme } from "./modules/theme.js";
import { initTabs } from "./modules/tabs.js";
import { initAnalyzer } from "./modules/analyzer.js";
import { initLibrary } from "./modules/library.js";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initAnalyzer();
  initLibrary();
});
