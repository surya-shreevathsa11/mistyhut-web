/**
 * Lightweight scroll helpers only.
 * Heavy section transforms + JS parallax were removed to keep native scroll smooth.
 */
(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  /* Statistics counter (0 → target when in view) — cheap, once-only */
  var COUNTER_DURATION = 1000;
  var statNums = document.querySelectorAll(".stat__num");
  if (!statNums.length) return;

  function parseStatValue(text) {
    if (!text || !text.trim()) return { value: 0, suffix: "", isK: false };
    var t = String(text).trim();
    var isK = /k\+?/i.test(t);
    var numStr = t.replace(/[^\d.]/g, "");
    var suffix = t.replace(/[\d.]/g, "").trim() || "";
    var value = parseFloat(numStr);
    if (isNaN(value)) return { value: 0, suffix: t, isK: false };
    return {
      value: isK ? value * 1000 : value,
      displayValue: value,
      displaySuffix: suffix || (isK ? "k+" : ""),
      isK: isK,
    };
  }

  function formatStat(displayVal, suffix, isK) {
    if (isK && displayVal >= 1) {
      var s = displayVal.toFixed(1);
      return (s === "1.0" ? "1" : s.replace(/\.0$/, "")) + "k+";
    }
    if (suffix === "%") return Math.round(displayVal) + "%";
    if (suffix === "+") return Math.round(displayVal) + "+";
    return Math.round(displayVal) + (suffix || "");
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el, parsed, duration) {
    var startTime = null;
    var endVal = parsed.displayValue;
    var suffix = parsed.displaySuffix;
    var isK = parsed.isK;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeOutCubic(progress);
      el.textContent = formatStat(eased * endVal, suffix, isK);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.dataset.counterDone) return;
        el.dataset.counterDone = "1";
        var parsed = parseStatValue(el.textContent);
        el.textContent = "0" + (parsed.displaySuffix || "");
        animateCounter(el, parsed, COUNTER_DURATION);
      });
    },
    { root: null, rootMargin: "0px", threshold: 0.3 },
  );
  statNums.forEach(function (el) {
    counterObserver.observe(el);
  });
})();
