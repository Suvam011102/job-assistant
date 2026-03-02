// background.js

// Enable side panel behavior safely
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
});

// Optional: also ensure panel opens when extension icon clicked
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel && tab?.windowId !== undefined) {
    chrome.sidePanel.open({
      windowId: tab.windowId
    });
  }
});