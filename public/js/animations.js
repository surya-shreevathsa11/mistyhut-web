/**
 * Site motion: native browser scroll + light GSAP / ScrollTrigger reveals.
 * Lenis smooth-scroll was removed — it caused scroll lag across the site.
 */
(function () {
  "use strict";

  var heroEls =
    ".about-impact__label, .about-impact__headline, .about-impact__subhead, .about-impact__cta-wrap";
  var revealTriggers = [];
  var lenisInstance = null;
  window.getLenis = function () {
    return lenisInstance;
  };

  function enableScrollAnimations() {
    var prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var st =
      typeof ScrollTrigger !== "undefined"
        ? ScrollTrigger
        : typeof gsap !== "undefined" && gsap.ScrollTrigger;

    if (typeof gsap === "undefined" || !st) return;
    gsap.registerPlugin(st);

    revealTriggers.forEach(function (t) {
      if (t && t.kill) t.kill();
    });
    revealTriggers.length = 0;

    var hero = document.querySelector(".hero");
    var sections = gsap.utils.toArray(".section").filter(function (section) {
      return !hero || !hero.contains(section);
    });

    sections.forEach(function (section) {
      var els = gsap.utils.toArray("[data-reveal]", section);
      if (els.length === 0) return;
      if (section.dataset.revealed === "1") {
        gsap.set(els, { opacity: 1, y: 0, clearProps: "transform" });
        return;
      }

      var cardSelector =
        ".room-card, .review-card:not(.review-card--marquee-clone):not(.review-card--showcase), .terms-panel";
      var cards = gsap.utils.toArray(cardSelector, section);

      var trigger = st.create({
        trigger: section,
        start: "top 88%",
        once: true,
        onEnter: function () {
          if (section.dataset.revealed === "1") return;
          section.dataset.revealed = "1";

          gsap.fromTo(
            els,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: prefersReducedMotion ? 0.25 : 0.45,
              stagger: prefersReducedMotion ? 0 : 0.06,
              ease: "power2.out",
              overwrite: "auto",
              clearProps: "transform",
            },
          );

          if (cards.length > 0) {
            gsap.fromTo(
              cards,
              { opacity: 0, y: 16 },
              {
                opacity: 1,
                y: 0,
                duration: prefersReducedMotion ? 0.25 : 0.4,
                stagger: prefersReducedMotion ? 0 : 0.05,
                delay: 0.08,
                ease: "power2.out",
                overwrite: "auto",
                clearProps: "transform",
              },
            );
          }
        },
      });
      revealTriggers.push(trigger);
    });

    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }

  window.refreshScrollReveals = function () {
    if (typeof gsap === "undefined") return;
    enableScrollAnimations();
  };

  function finishHeroEntry() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    enableScrollAnimations();
    if (window.initHeroCinematic) window.initHeroCinematic();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }

  function runWithGSAP() {
    var main = document.querySelector("main");
    var heroSlidesEl = document.querySelector(".hero__slides");
    var prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      if (main) gsap.set(main, { opacity: 1, y: 0 });
      gsap.set(heroEls, { opacity: 1, y: 0, filter: "none" });
      if (heroSlidesEl) gsap.set(heroSlidesEl, { clipPath: "inset(0% 0 0 0)" });
      finishHeroEntry();
      return;
    }

    if (main) gsap.set(main, { opacity: 0, y: 12 });

    gsap.set(heroEls, {
      opacity: 0,
      y: -20,
      force3D: true,
    });

    if (heroSlidesEl) {
      gsap.set(heroSlidesEl, { clipPath: "inset(100% 0 0 0)" });
    }

    var tl = gsap.timeline({
      defaults: { ease: "power2.out" },
      onComplete: finishHeroEntry,
    });

    if (heroSlidesEl) {
      tl.to(heroSlidesEl, {
        clipPath: "inset(0% 0 0 0)",
        duration: 0.7,
        ease: "power2.out",
      });
    }

    tl.to(
      heroEls,
      {
        opacity: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: "power2.out",
        clearProps: "transform",
      },
      heroSlidesEl ? "-=0.45" : 0,
    );

    if (main) {
      tl.to(
        main,
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          clearProps: "transform",
        },
        "-=0.35",
      );
    }
  }

  function runWithoutGSAP() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    enableScrollAnimations();
    if (window.initHeroCinematic) window.initHeroCinematic();
  }

  function forceHeroReadable() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");

    var main = document.querySelector("main");
    if (main && typeof gsap !== "undefined") {
      gsap.set(main, { opacity: 1, y: 0, clearProps: "opacity,transform" });
    } else if (main) {
      main.style.opacity = "1";
      main.style.transform = "";
    }

    var impactEls = Array.prototype.slice.call(
      document.querySelectorAll(
        ".about-impact__label, .about-impact__headline, .about-impact__subhead, .about-impact__cta-wrap",
      ),
    );

    if (typeof gsap !== "undefined") {
      if (impactEls.length) gsap.set(impactEls, { opacity: 1, y: 0, filter: "none" });
    } else {
      impactEls.forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "";
        el.style.filter = "none";
      });
    }
  }

  function init() {
    var hasGSAP = typeof gsap !== "undefined";

    function runEntry() {
      if (hasGSAP) {
        try {
          runWithGSAP();
        } catch (e) {
          forceHeroReadable();
          finishHeroEntry();
        }
      } else {
        runWithoutGSAP();
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function onReady() {
        document.removeEventListener("DOMContentLoaded", onReady);
        runEntry();
      });
    } else {
      runEntry();
    }

    window.setTimeout(function () {
      var h = document.querySelector(".hero.hero--entry");
      if (h && !h.classList.contains("hero--entry-done")) {
        forceHeroReadable();
        finishHeroEntry();
      }
    }, 4000);
  }
  init();
})();
