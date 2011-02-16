chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
  console.log("omnibox: " + text);
});