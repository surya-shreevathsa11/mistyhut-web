/**
 * Site motion: Lenis smooth scroll + GSAP / ScrollTrigger.
 * (Static HTML — Framer Motion is not used; micro-interactions are CSS + GSAP.)
 */
(function () {
  "use strict";

  var heroEls = ".hero__subtitle, .hero__title, .hero__content .divider, .hero__desc, .hero__cta";
  var revealTriggers = [];
  var scrubTriggers = [];
  var scrubEntries = [];
  var lenisInstance = null;
  window.getLenis = function () { return lenisInstance; };

  function initLenis() {
    if (typeof Lenis === "undefined") return null;
    try {
      var lenis = new Lenis({
        duration: 0.8,
        smoothWheel: true,
        smoothTouch: true,
        touchMultiplier: 2,
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
        ".room-card, .review-card, .terms-card, .gallery-reel__slide";
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

  function escapeHtmlText(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  /** Editorial title reveal (prathibhimba-web style) — overflow hidden + inner rise */
  function prepareHeroTitle(titleEl) {
    if (!titleEl || titleEl.querySelector(".hero-title__inner")) return null;
    var t = titleEl.textContent.trim();
    titleEl.innerHTML =
      '<span class="hero-title__track"><span class="hero-title__inner">' +
      escapeHtmlText(t) +
      "</span></span>";
    return titleEl.querySelector(".hero-title__inner");
  }

  /** Word-by-word description reveal */
  function prepareHeroDesc(descEl) {
    if (!descEl || descEl.querySelector(".hero-desc__word")) return [];
    var text = descEl.textContent.trim();
    var words = text.split(/\s+/).filter(Boolean);
    descEl.innerHTML = words
      .map(function (w) {
        return (
          '<span class="hero-desc__word-wrap"><span class="hero-desc__word">' +
          escapeHtmlText(w) +
          "</span></span>"
        );
      })
      .join(" ");
    return gsap.utils.toArray(descEl.querySelectorAll(".hero-desc__word"));
  }

  function runWithGSAP() {
    var main = document.querySelector("main");
    var heroSlidesEl = document.querySelector(".hero__slides");
    var prefersReducedMotion =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (main) gsap.set(main, { opacity: 0, y: 20 });

    var tl = gsap.timeline({
      defaults: { ease: "cubic-bezier(0.22, 1, 0.36, 1)" },
    });

    /* Reduced motion: instant readable hero, same flow as prathibhimba-web without motion */
    if (prefersReducedMotion) {
      gsap.set(heroEls, { opacity: 1, y: 0, filter: "none" });
      if (heroSlidesEl) gsap.set(heroSlidesEl, { clipPath: "inset(0% 0 0 0)" });
      if (main) gsap.set(main, { opacity: 1, y: 0 });
      tl.add(function () {
        var hero = document.querySelector(".hero.hero--entry");
        if (hero) hero.classList.add("hero--entry-done");
        lenisInstance = initLenis();
        enableScrollAnimations();
        if (window.initHeroCinematic) window.initHeroCinematic();
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      });
      return;
    }

    var subtitle = document.querySelector(".hero__subtitle");
    var titleEl = document.querySelector(".hero__title");
    var divider = document.querySelector(".hero__content .divider");
    var descEl = document.querySelector(".hero__desc");
    var cta = document.querySelector(".hero__cta");

    var titleInner = prepareHeroTitle(titleEl);
    var descWords = prepareHeroDesc(descEl);

    /* Parent opacity must be 1 while children animate (hero--entry CSS hides section) */
    if (titleEl) gsap.set(titleEl, { opacity: 1 });
    if (descEl && descWords.length) gsap.set(descEl, { opacity: 1 });

    gsap.set([subtitle, divider, cta].filter(Boolean), {
      opacity: 0,
      y: 40,
      filter: "blur(8px)",
    });

    if (titleInner) {
      gsap.set(titleInner, { yPercent: 110, force3D: true });
    }

    if (descWords.length) {
      gsap.set(descWords, { yPercent: 85, opacity: 0, force3D: true });
    } else if (descEl) {
      gsap.set(descEl, { opacity: 0, y: 36, filter: "blur(8px)" });
    }

    /* Masked hero slides */
    if (heroSlidesEl) {
      gsap.set(heroSlidesEl, { clipPath: "inset(100% 0 0 0)" });
    }

    if (heroSlidesEl) {
      tl.to(heroSlidesEl, {
        clipPath: "inset(0% 0 0 0)",
        duration: 1.2,
        ease: "power4.out",
        force3D: true,
      });
    }

    var textStart = heroSlidesEl ? "-=0.6" : 0;

    if (titleInner) {
      tl.to(
        titleInner,
        {
          yPercent: 0,
          duration: 1.05,
          ease: "power4.out",
          force3D: true,
        },
        textStart
      );
    }

    if (subtitle) {
      tl.to(
        subtitle,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.75,
          ease: "power3.out",
        },
        heroSlidesEl ? "-=0.55" : 0
      );
    }

    if (divider) {
      tl.to(
        divider,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.65,
          ease: "power3.out",
        },
        "-=0.35"
      );
    }

    if (descWords.length) {
      tl.to(
        descWords,
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.038,
          ease: "power3.out",
        },
        "-=0.35"
      );
    } else if (descEl) {
      tl.to(
        descEl,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.75,
          ease: "power3.out",
        },
        "-=0.3"
      );
    }

    if (cta) {
      tl.to(
        cta,
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.75,
          ease: "power3.out",
        },
        "-=0.25"
      );
    }

    if (main) {
      tl.to(
        main,
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          force3D: true,
          clearProps: "transform",
        },
        "-=0.35"
      );
    }

    tl.add(function () {
      var hero = document.querySelector(".hero.hero--entry");
      if (hero) hero.classList.add("hero--entry-done");
      if (titleInner) gsap.set(titleInner, { clearProps: "transform" });
      if (descWords.length) gsap.set(descWords, { clearProps: "opacity" });
      lenisInstance = initLenis();
      enableScrollAnimations();
      if (window.initHeroCinematic) window.initHeroCinematic();
      if (typeof ScrollTrigger !== "undefined") {
        ScrollTrigger.refresh();
      }
    });
  }

  function runWithoutGSAP() {
    var hero = document.querySelector(".hero.hero--entry");
    if (hero) hero.classList.add("hero--entry-done");
    lenisInstance = initLenis();
  }

  function init() {
    var hasGSAP = typeof gsap !== "undefined";

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function onReady() {
        document.removeEventListener("DOMContentLoaded", onReady);
        if (hasGSAP) runWithGSAP();
        else runWithoutGSAP();
      });
    } else {
      if (hasGSAP) runWithGSAP();
      else runWithoutGSAP();
    }
  }
  init();
})();
