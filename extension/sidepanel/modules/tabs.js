export function initTabs() {
  const analyzerTab = document.getElementById("analyzerTab");
  const briefTab = document.getElementById("briefTab");
  const libraryTab = document.getElementById("libraryTab");
  const analyzerSection = document.getElementById("analyzerSection");
  const briefSection = document.getElementById("briefSection");
  const librarySection = document.getElementById("librarySection");

  function activateTab(activeTab, activeSection) {
    [
      [analyzerTab, analyzerSection],
      [briefTab, briefSection],
      [libraryTab, librarySection],
    ].forEach(([tab, section]) => {
      const isActive = tab === activeTab;
      tab.classList.toggle("active", isActive);
      section.style.display = isActive ? "flex" : "none";
    });
  }

  function showAnalyzer() {
    activateTab(analyzerTab, analyzerSection);
   }

  function showBrief() {
    activateTab(briefTab, briefSection);
  }

  function showLibrary() {
    activateTab(libraryTab, librarySection);
    if (typeof window.loadLibrary === "function") {
      window.loadLibrary();
    }
  }

  analyzerTab.addEventListener("click", showAnalyzer);
  briefTab.addEventListener("click", showBrief);
  libraryTab.addEventListener("click", showLibrary);

  showAnalyzer();
}
