/* =========================================================
   THEME — shared across all pages
   Load this in <head> BEFORE the body renders
========================================================= */
(function () {
  var root = document.documentElement;

  // 1. Apply saved theme immediately (prevents flicker)
  var saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") {
    root.className = saved;
  }

  // 2. Update the icon once the DOM is ready
  function updateIcon() {
    var icon = document.getElementById("themeIcon");
    if (!icon) return;
    var current = root.className;
    if (current === "dark") icon.textContent = "☀";
    else if (current === "light") icon.textContent = "☾";
    else icon.textContent = "◐";
  }

  // 3. Wire up the button once the DOM is ready
  function init() {
    updateIcon();

    var btn = document.getElementById("themeButton");
    if (!btn) return;

    // Remove any old listeners by cloning (safe reset)
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);

    fresh.addEventListener("click", function () {
      var current = root.className;
      var next = current === "dark" ? "light" : "dark";
      root.className = next;
      localStorage.setItem("theme", next);
      updateIcon();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();