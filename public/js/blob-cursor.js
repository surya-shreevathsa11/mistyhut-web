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

    var textSelector =
      "h1, h2, h3, h4, h5, h6, p, .hero__title, .hero__subtitle, .hero__desc, .section__title, .section__subtitle, .cart-page__title, .cart-step__heading";
    var hoverSelector =
      'a, button, .btn, input, textarea, [role="button"], .room-card, .gallery__item, .gallery-card, .cart__item-remove, .terms__accept, .modal__close';

    window.addEventListener(
      "mousemove",
      function (e) {
        x = e.clientX;
        y = e.clientY;
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

    var headerSelector = ".nav, .footer";

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
