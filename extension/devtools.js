// Create a DevTools panel (optional, but good for UI later)
chrome.devtools.panels.create(
  "DevPilot",
  null,
  "panel.html", 
  function(panel) {
    console.log("DevPilot Panel created");
  }
);

// We no longer need to intercept network requests here!
// It is handled natively in the background.js via chrome.webRequest.
