export function sendMessageToActiveTab(message, callback) {

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {

    if (!tabs || !tabs[0]) return;

    chrome.tabs.sendMessage(
      tabs[0].id,
      message,
      callback
    );

  });

}
