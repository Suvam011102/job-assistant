import { initFeedback } from "./modules/feedback.js";
import { initTheme } from "./modules/theme.js";
import { initTabs } from "./modules/tabs.js";
import { initAnalyzer } from "./modules/analyzer.js";
import { initLibrary } from "./modules/library.js";

export function initSidepanelApp() {
  initFeedback();
  initTheme();
  initTabs();
  initAnalyzer();
  initLibrary();
}
