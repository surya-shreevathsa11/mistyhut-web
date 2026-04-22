/**
 * Site motion: Lenis smooth scroll + GSAP / ScrollTrigger.
 * (Static HTML — Framer Motion is not used; micro-interactions are CSS + GSAP.)
 */
(function () {
  "use strict";

  var heroEls =
    ".about-impact__label, .about-impact__headline, .about-impact__subhead, .about-impact__cta-wrap";
  var revealTriggers = [];
  var scrubTriggers = [];
  var scrubEntries = [];
  var lenisInstance = null;
  window.getLenis = function () { return lenisInstance; };

  function initLenis() {
    if (typeof Lenis === "undefined") return null;
    try {
      var mq = typeof window.matchMedia === "function" ? window.matchMedia.bind(window) : null;
      /* Native-style scroll on phones/tablets: avoid Lenis touch smoothing (feels too fast/floaty). */
      var nativeTouchLike =
        (mq && mq("(max-width: 1024px)").matches) || (mq && mq("(pointer: coarse)").matches);
      var lenis = new Lenis({
        duration: nativeTouchLike ? 0.65 : 0.8,
        smoothWheel: !nativeTouchLike,
        smoothTouch: false,
        touchMultiplier: 1,
        infinite: false,
      });
      document.documentElement.classList.add("lenis", "lenis-smooth");

      if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(function (time) {
          lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
        ScrollTrigger.scrollerProxy(document.body, {
          scrollTop: function (value) {
            if (arguments.length && lenis.scrollTo) {
              lenis.scrollTo(value, { immediate: true });
            }
            return lenis.scroll !== undefined ? (typeof lenis.scroll === "number" ? lenis.scroll : lenis.scroll.top) : window.scrollY;
          },
          getBoundingClientRect: function () {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
          },
        });
      } else {
        function raf(time) {
          lenis.raf(time);
          requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
      }
      return lenis;
    } catch (e) {
      return null;
    }
  }

  function enableScrollAnimations() {
    var prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var st = typeof ScrollTrigger !== "undefined" ? ScrollTrigger : (typeof gsap !== "undefined" && gsap.ScrollTrigger);

    if (typeof gsap === "undefined" || !st) return;
    gsap.registerPlugin(st);

    scrubEntries.forEach(function (e) {
      if (e.container && e.handleEnter && e.handleLeave) {
        e.container.removeEventListener("mouseenter", e.handleEnter);
        e.container.removeEventListener("mouseleave", e.handleLeave);
      }
    });
    scrubEntries.length = 0;
    scrubTriggers.forEach(function (t) {
      if (t && t.kill) t.kill();
    });
    scrubTriggers.length = 0;
    revealTriggers.forEach(function (t) {
      t.kill();
    });
    revealTriggers.length = 0;

    /* Hero: pin + cinematic timeline is in hero-cinematic.js (no duplicate parallax here) */

    /* Section reveals with stagger */
    var hero = document.querySelector(".hero");
    var sections = gsap.utils.toArray(".section").filter(function (section) {
      return !hero || !hero.contains(section);
    });
    sections.forEach(function (section) {
      var els = gsap.utils.toArray("[data-reveal]", section);
      if (els.length === 0) return;
      if (section.dataset.revealed === "1") {
        gsap.set(els, { opacity: 1, y: 0, scaleX: 1, clearProps: "transform" });
        return;
      }

      /* Card-level stagger for grids (matches prathibhimba-web) */
      var cardSelector =
        ".room-card, .review-card:not(.review-card--marquee-clone):not(.review-card--showcase), .terms-panel, .gallery-marquee__track > .gallery-marquee__group:first-child .gallery-reel__slide";
      var cards = gsap.utils.toArray(cardSelector, section);

      var trigger = st.create({
        trigger: section,
        start: "top 85%",
        once: true,
        onEnter: function () {
          if (section.dataset.revealed === "1") return;
          section.dataset.revealed = "1";

          requestAnimationFrame(function () {
            gsap.fromTo(els,
              { opacity: 0, y: 16, force3D: true },
              {
                opacity: 1,
                y: 0,
                duration: prefersReducedMotion ? 0.3 : 0.6,
                stagger: prefersReducedMotion ? 0 : 0.1,
                ease: "cubic-bezier(0.22, 1, 0.36, 1)",
                force3D: true,
                overwrite: "auto",
                clearProps: "transform",
              }
            );

            if (cards.length > 0) {
              gsap.fromTo(cards,
                { opacity: 0, y: 24, scale: 0.97, force3D: true },
                {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  duration: prefersReducedMotion ? 0.3 : 0.55,
                  stagger: prefersReducedMotion ? 0 : 0.08,
                  delay: 0.15,
                  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
                  force3D: true,
                  overwrite: "auto",
                  clearProps: "transform",
                }
              );
            }
          });
        },
      });
      revealTriggers.push(trigger);
    });

    ScrollTrigger.refresh();
  }

  window.refreshScrollReveals = function () {
    if (typeof gsap === "undefined") return;
    enableScrollAnimations();
  };

  function finishHeroEntry() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    lenisInstance = initLenis();
    enableScrollAnimations();
    if (window.initHeroCinematic) window.initHeroCinematic();
    if (typeof ScrollTrigger !== "undefined") {
      ScrollTrigger.refresh();
    }
  }

  /**
   * Hero: smooth reveal from above (y + opacity), staggered; background clip optional.
   * Modest y offset avoids clipping under .hero { overflow: hidden }.
   */
  function runWithGSAP() {
    var main = document.querySelector("main");
    var heroSlidesEl = document.querySelector(".hero__slides");
    var prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      if (main) gsap.set(main, { opacity: 1, y: 0 });
      gsap.set(heroEls, { opacity: 1, y: 0, filter: "none" });
      if (heroSlidesEl) gsap.set(heroSlidesEl, { clipPath: "inset(0% 0 0 0)" });
      finishHeroEntry();
      return;
    }

    if (main) gsap.set(main, { opacity: 0, y: 18 });

    gsap.set(heroEls, {
      opacity: 0,
      y: -32,
      filter: "blur(4px)",
      force3D: true,
    });

    if (heroSlidesEl) {
      gsap.set(heroSlidesEl, { clipPath: "inset(100% 0 0 0)" });
    }

    var tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: function () {
        gsap.set(heroEls, { clearProps: "filter" });
        finishHeroEntry();
      },
    });

    if (heroSlidesEl) {
      tl.to(heroSlidesEl, {
        clipPath: "inset(0% 0 0 0)",
        duration: 0.85,
        ease: "power3.out",
        force3D: true,
      });
    }

    tl.to(
      heroEls,
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.92,
        stagger: 0.1,
        ease: "power3.out",
        force3D: true,
        clearProps: "transform",
      },
      heroSlidesEl ? "-=0.55" : 0
    );

    if (main) {
      tl.to(
        main,
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          clearProps: "transform",
        },
        "-=0.45"
      );
    }
  }

  function runWithoutGSAP() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    lenisInstance = initLenis();
    enableScrollAnimations();
    if (window.initHeroCinematic) window.initHeroCinematic();
    if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
  }

  /**
   * If the entry timeline throws or never completes, hero copy must not stay
   * at CSS opacity:0 or clipped under .hero-title__track (overflow hidden).
   */
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

    var subtitle = document.querySelector(".hero__subtitle");
    var titleEl = document.querySelector(".hero__title");
    var divider = document.querySelector(".hero__content .divider");
    var descEl = document.querySelector(".hero__desc");
    var cta = document.querySelector(".hero__cta");
    var els = [subtitle, titleEl, divider, descEl, cta].filter(Boolean);
    var impactEls = Array.prototype.slice.call(
      document.querySelectorAll(
        ".about-impact__label, .about-impact__headline, .about-impact__subhead, .about-impact__cta-wrap"
      )
    );

    if (typeof gsap !== "undefined") {
      gsap.set(els, { opacity: 1, y: 0, filter: "none" });
      if (impactEls.length) gsap.set(impactEls, { opacity: 1, y: 0, filter: "none" });
      var titleInner = document.querySelector(".hero-title__inner");
      if (titleInner) {
        gsap.set(titleInner, { yPercent: 0, clearProps: "transform" });
      }
      var descWords = document.querySelectorAll(".hero-desc__word");
      if (descWords.length) {
        gsap.set(descWords, { opacity: 1, yPercent: 0, clearProps: "transform,opacity" });
      }
    } else {
      els.forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "";
        el.style.filter = "none";
      });
      impactEls.forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "";
        el.style.filter = "none";
      });
      document.querySelectorAll(".hero-title__inner").forEach(function (el) {
        el.style.transform = "";
      });
      document.querySelectorAll(".hero-desc__word").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "";
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

    /* If intro never completes, restore readable hero (no stuck opacity:0) */
    window.setTimeout(function () {
      var h = document.querySelector(".hero.hero--entry");
      if (h && !h.classList.contains("hero--entry-done")) {
        forceHeroReadable();
        if (!lenisInstance) finishHeroEntry();
      }
    }, 5000);
  }
  init();
})();
