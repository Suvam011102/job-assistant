let selecting = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === "startSelection") {

    selecting = true;
    document.body.style.cursor = "crosshair";

  }

  if (msg.action === "stopSelection") {

    selecting = false;
    document.body.style.cursor = "default";

  }

  if (msg.action === "clearSelection") {

    window.getSelection().removeAllRanges();

  }

  if (msg.action === "getSelection") {

    const text = window.getSelection().toString();
    sendResponse({ text });

  }

  return true;

});
