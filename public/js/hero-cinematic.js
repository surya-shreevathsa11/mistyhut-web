/**
 * Hero cinematic motion disabled for scroll performance.
 * Scrubbed scale/parallax on the hero caused jank with continuous scroll.
 * Kept as a no-op so existing callers remain safe.
 */
window.initHeroCinematic = function () {
  "use strict";
};
