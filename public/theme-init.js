// Sets the theme before the first paint. Loaded as a file, not inlined, so
// that pages with a strict Content Security Policy can use it too.
// No stored choice means dark. "auto" follows the system setting.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('kyro-theme');
  } catch (e) {
    // Storage can be unavailable (private mode, blocked). Dark it is.
  }
  var choice = stored === 'light' || stored === 'auto' ? stored : 'dark';
  var theme =
    choice === 'auto'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : choice;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeChoice = choice;
})();
