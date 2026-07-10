/**
 * Light page helpers — no heavy scroll transforms.
 */
(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  /* Button micro-interactions */
  document.querySelectorAll(".btn").forEach(function (btn) {
    btn.classList.add("btn-premium-hover");
  });

  /* Pause about video when off-screen to keep scroll smooth */
  var aboutVideo = document.querySelector(".about-story__video");
  if (aboutVideo && "IntersectionObserver" in window) {
    var videoObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var playPromise = aboutVideo.play();
            if (playPromise && typeof playPromise.catch === "function") {
              playPromise.catch(function () {});
            }
          } else {
            aboutVideo.pause();
          }
        });
      },
      { root: null, rootMargin: "80px 0px", threshold: 0.15 },
    );
    videoObserver.observe(aboutVideo);
  }
})();
