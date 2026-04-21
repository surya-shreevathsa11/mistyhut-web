/**
 * Gallery marquee: lightbox on slide click (first row only; duplicate row is visual-only)
 */
(function () {
  "use strict";

  var track = document.getElementById("galleryMarqueeTrack");
  if (!track) return;

  var lightbox = document.getElementById("galleryLightbox");
  var lightboxImg = document.getElementById("galleryLightboxImg");

  if (lightbox && lightboxImg) {
    function openFromSlide(slide) {
      if (!slide) return;
      var img = slide.querySelector(".gallery-reel__img-wrap img");
      if (!img || !img.src) return;
      var src = img.src.replace(/w=\d+/, "w=2400").replace(/h=\d+/, "h=1350");
      lightboxImg.src = src;
      lightboxImg.alt = img.alt || "";
      lightbox.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    track.addEventListener("click", function (e) {
      var slide = e.target.closest(
        ".gallery-marquee__group:first-child .gallery-reel__slide"
      );
      if (!slide) return;
      openFromSlide(slide);
    });

    track.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var slide = e.target.closest(
        ".gallery-marquee__group:first-child .gallery-reel__slide"
      );
      if (!slide) return;
      e.preventDefault();
      openFromSlide(slide);
    });

    function closeLightbox() {
      lightbox.classList.remove("active");
      document.body.style.overflow = "";
      lightboxImg.src = "";
    }

    var closeEls = lightbox.querySelectorAll("[data-close]");
    for (var i = 0; i < closeEls.length; i++) {
      closeEls[i].addEventListener("click", closeLightbox);
    }

    var overlay = lightbox.querySelector(".modal__overlay");
    if (overlay) overlay.addEventListener("click", closeLightbox);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lightbox.classList.contains("active")) {
        closeLightbox();
      }
    });
  }
})();
