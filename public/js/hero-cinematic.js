/**
 * Cinematic hero: light scroll-linked motion only (no pin/scrub) for smooth UX.
 * Pin and scrub were removed to prevent lag and freeze with Lenis smooth scroll.
 * Call initHeroCinematic() after Lenis is ready (e.g. from animations.js timeline callback).
 */
window.initHeroCinematic = function () {
  "use strict";

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  var prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var hero = document.querySelector(".hero");
  var heroContent = document.querySelector(".hero__content");
  var heroSlides = document.querySelector(".hero__slides");
  var heroVideo = document.querySelector(".hero__video");

  if (!hero) return;

  var scrubDuration = 0.6;

  /* Subtle scroll-linked scale on media layers (works with CSS ken-burns on slides) */
  [heroSlides, heroVideo].forEach(function (layer) {
    if (!layer) return;
    gsap.fromTo(
      layer,
      { scale: 1, transformOrigin: "center center", force3D: true },
      {
        scale: 1.05,
        ease: "none",
        force3D: true,
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "bottom top",
          scrub: scrubDuration,
        },
      }
    );
  });

  if (heroContent) {
    gsap.to(heroContent, {
      y: "-4%",
      ease: "none",
      force3D: true,
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "bottom top",
        scrub: scrubDuration,
      },
    });
  }
};
