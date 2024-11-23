// Content script that runs on web pages
console.log('Gemini Companion content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return true;
}); 