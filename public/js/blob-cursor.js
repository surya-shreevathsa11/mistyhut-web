/**
 * Blob cursor — desktop only. Position follows the pointer 1:1 (no smoothing lag).
 * Scale/feedback still uses hover/down state; updates on mousemove and when state changes.
 */
(function () {
  "use strict";

  function setupBlobCursor() {
    var container = document.getElementById("blobCursor");
    var blob = container ? container.querySelector(".blob-cursor__blob") : null;
    if (!container || !blob) return;

    var isCoarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    document.documentElement.classList.add("custom-cursor-active");
    document.body.classList.add("custom-cursor-active");

    var x = 0;
    var y = 0;
    var visible = false;
    var hovering = false;
    var down = false;
    var activeHoverEl = null;

    function scale() {
      return down ? 0.9 : hovering ? 1.24 : 1;
    }

    /** Direct pixel positioning — same frame as mousemove, feels like the system cursor */
    function paintBlob() {
      if (!visible) return;
      blob.style.transform =
        "translate3d(" +
        x +
        "px," +
        y +
        "px,0) translate(-50%,-50%) scale(" +
        scale() +
        ")";
    }

    function setVisible(v) {
      visible = v;
      container.classList.toggle("is-visible", v);
      if (v) paintBlob();
    }

    function updateClasses() {
      container.classList.toggle("is-hover", hovering);
      container.classList.toggle("is-down", down);
      paintBlob();
    }

    function parseColor(color) {
      if (!color) return null;
      var c = String(color).trim();
      if (c[0] === "#") {
        var hex = c.slice(1);
        if (hex.length === 3) {
          hex = hex.split("").map(function (ch) { return ch + ch; }).join("");
        }
        if (hex.length === 6) {
          return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16),
            a: 1
          };
        }
      }
      var nums = c.match(/[\d.]+/g);
      if (!nums || nums.length < 3) return null;
      return {
        r: Number(nums[0]),
        g: Number(nums[1]),
        b: Number(nums[2]),
        a: nums.length > 3 ? Number(nums[3]) : 1
      };
    }

    function channelToLinear(v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }

    function getLuminance(rgb) {
      return (
        0.2126 * channelToLinear(rgb.r) +
        0.7152 * channelToLinear(rgb.g) +
        0.0722 * channelToLinear(rgb.b)
      );
    }

    function resolveBackgroundColor(el) {
      var cur = el;
      while (cur && cur !== document.documentElement) {
        var bg = parseColor(window.getComputedStyle(cur).backgroundColor);
        if (bg && bg.a > 0.02) return bg;
        cur = cur.parentElement;
      }
      return { r: 241, g: 225, b: 148, a: 1 };
    }

    function applyContrastPalette(luminance) {
      var onLight = luminance > 0.55;
      container.style.setProperty(
        "--cursor-ring-color",
        onLight ? "rgba(91, 14, 20, 0.95)" : "rgba(241, 225, 148, 0.95)"
      );
      container.style.setProperty(
        "--cursor-ring-color-hover",
        onLight ? "rgba(91, 14, 20, 1)" : "rgba(241, 225, 148, 1)"
      );
      container.style.setProperty(
        "--cursor-ring-color-text",
        onLight ? "rgba(91, 14, 20, 0.8)" : "rgba(241, 225, 148, 0.8)"
      );
      container.style.setProperty("--cursor-dot-fill", onLight ? "#5B0E14" : "#F1E194");
      container.style.setProperty(
        "--cursor-dot-halo",
        onLight
          ? "0 0 0 2px rgba(255, 255, 255, 0.95), 0 1px 5px rgba(0, 0, 0, 0.25)"
          : "0 0 0 2px rgba(0, 0, 0, 0.35), 0 1px 5px rgba(0, 0, 0, 0.45)"
      );
    }

    function updateContrastState(targetEl, textEl) {
      var ref = null;
      if (textEl) {
        ref = parseColor(window.getComputedStyle(textEl).color);
      }
      if (!ref) {
        ref = resolveBackgroundColor(targetEl || document.body);
      }
      applyContrastPalette(getLuminance(ref));
    }

    var textSelector =
      "h1, h2, h3, h4, h5, h6, p, .hero__title, .hero__subtitle, .hero__desc, .section__title, .section__subtitle, .cart-page__title, .cart-step__heading";
    var hoverSelector =
      'a, button, .btn, input, textarea, [role="button"], .room-card, .gallery__item, .gallery-card, .cart__item-remove, .terms__accept, .modal__close';

    window.addEventListener(
      "mousemove",
      function (e) {
        x = e.clientX;
        y = e.clientY;
        var atPoint = document.elementFromPoint(x, y);
        var textAtPoint =
          atPoint && atPoint.closest && atPoint.closest(textSelector);
        updateContrastState(atPoint, textAtPoint);
        container.classList.toggle("is-over-header", isOverHeader(atPoint));
        setVisible(true);
        paintBlob();
      },
      { passive: true }
    );

    window.addEventListener("mouseleave", function () {
      setVisible(false);
    });

    window.addEventListener("mousedown", function () {
      down = true;
      updateClasses();
    });

    window.addEventListener("mouseup", function () {
      down = false;
      updateClasses();
    });

    var headerSelector = ".nav, .admin__header, .footer";

    function isOverHeader(el) {
      return el && el.closest && el.closest(headerSelector);
    }

    document.addEventListener("mouseover", function (e) {
      var target =
        e.target && e.target.closest && e.target.closest(hoverSelector);
      var textEl =
        e.target && e.target.closest && e.target.closest(textSelector);
      hovering = Boolean(target);
      container.classList.toggle("is-hover-text", Boolean(textEl));
      container.classList.toggle("is-over-header", isOverHeader(e.target));
      updateContrastState(e.target, textEl);
      if (activeHoverEl && activeHoverEl !== target) {
        activeHoverEl.classList.remove("cursor-target");
      }
      activeHoverEl = target || null;
      if (activeHoverEl) {
        activeHoverEl.classList.add("cursor-target");
      }
      updateClasses();
    });

    document.addEventListener("mouseout", function (e) {
      if (!e.relatedTarget) {
        hovering = false;
        container.classList.remove("is-hover-text");
        container.classList.remove("is-over-header");
        if (activeHoverEl) activeHoverEl.classList.remove("cursor-target");
        activeHoverEl = null;
        updateClasses();
        return;
      }
      var stillHover =
        e.relatedTarget.closest && e.relatedTarget.closest(hoverSelector);
      var stillText =
        e.relatedTarget.closest && e.relatedTarget.closest(textSelector);
      hovering = Boolean(stillHover);
      container.classList.toggle("is-hover-text", Boolean(stillText));
      container.classList.toggle("is-over-header", isOverHeader(e.relatedTarget));
      updateContrastState(e.relatedTarget, stillText);
      if (!hovering && activeHoverEl) {
        activeHoverEl.classList.remove("cursor-target");
        activeHoverEl = null;
      }
      updateClasses();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBlobCursor);
  } else {
    setupBlobCursor();
  }
})();
