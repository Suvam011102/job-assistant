export function initTabs() {
  const analyzerTab = document.getElementById("analyzerTab");
  const libraryTab = document.getElementById("libraryTab");
  const analyzerSection = document.getElementById("analyzerSection");
  const librarySection = document.getElementById("librarySection");

  function showAnalyzer() {
    analyzerTab.classList.add("active");
    libraryTab.classList.remove("active");
    analyzerSection.style.display = "flex";
    librarySection.style.display = "none";
  }

  function showLibrary() {
    libraryTab.classList.add("active");
    analyzerTab.classList.remove("active");
    analyzerSection.style.display = "none";
    librarySection.style.display = "flex";
    window.loadLibrary(); // call global function from library.js
  }

  analyzerTab.addEventListener("click", showAnalyzer);
  libraryTab.addEventListener("click", showLibrary);

  showAnalyzer();
}