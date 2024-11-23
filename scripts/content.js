chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    sendResponse({
      content: document.body.innerText.substring(0, 10000) // Limit content length
    });
  }
  return true;
});
