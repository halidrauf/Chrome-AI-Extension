// Service Worker for background tasks
chrome.runtime.onInstalled.addListener(() => {
  console.log("Gemini Companion installed");
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  return true;
});
