/**
 * Custom blob cursor disabled — use the native system pointer.
 * Kept as a no-op so any leftover script tags do not break the page.
 */
(function () {
  "use strict";
  var el = document.getElementById("blobCursor");
  if (el && el.parentNode) el.parentNode.removeChild(el);
  document.documentElement.classList.remove("custom-cursor-active");
  if (document.body) document.body.classList.remove("custom-cursor-active");
})();
