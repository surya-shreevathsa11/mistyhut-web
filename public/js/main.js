(function () {
  const POST_LOGIN_REDIRECT_KEY = "summer-green-post-login";
  const A = window.MistyApi;
  if (!A) {
    console.warn("MistyApi missing — load /js/api-config.js before main.js");
  }
  const P = window.MistyPrepaid;

  function clearBookRoomPrepaid() {}

  let currentUser = null;
  /** Room limit: set from backend after validating rooms response. Only these room IDs are allowed for cart/booking. */
  let validRoomIdsFromBackend = [];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // --- Nav scroll + contrast by section (cream vs dark green) ---
  var navEl = $("#nav");
  if (navEl) {
    window.addEventListener("scroll", () => {
      navEl.classList.toggle("scrolled", window.scrollY > 60);
    });

    var sections = $$("section[data-nav-theme], footer[data-nav-theme]");
    var heroEl = $(".hero");
    function updateNavTheme() {
      if (!navEl.classList.contains("scrolled")) {
        navEl.classList.remove("nav--over-dark", "nav--over-light");
        return;
      }
      var viewportMid = window.scrollY + window.innerHeight * 0.4;
      var current = null;
      var currentTop = -1;
      if (heroEl && window.scrollY < heroEl.offsetHeight * 0.8) {
        navEl.classList.remove("nav--over-light");
        navEl.classList.add("nav--over-dark");
        return;
      }
      sections.forEach(function (sec) {
        var top = sec.offsetTop;
        var bottom = top + sec.offsetHeight;
        if (viewportMid >= top && viewportMid <= bottom && top > currentTop) {
          current = sec;
          currentTop = top;
        }
      });
      navEl.classList.remove("nav--over-dark", "nav--over-light");
      if (current && current.getAttribute("data-nav-theme") === "light") {
        navEl.classList.add("nav--over-light");
      } else {
        navEl.classList.add("nav--over-dark");
      }
    }
    window.addEventListener("scroll", updateNavTheme, { passive: true });
    window.addEventListener("resize", updateNavTheme);
    updateNavTheme();
  }

  // --- Mobile nav toggle ---
  var navToggle = $("#navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", () => {
      var links = $("#navLinks");
      if (links) links.classList.toggle("open");
    });
  }

  // --- Smooth scroll for nav links (Rooms and other # anchors scroll to section; page stays scrollable) ---
  function scrollToSection(selector, offset) {
    var el = typeof selector === "string" ? $(selector) : selector;
    if (!el) return;
    var lenis = typeof window.getLenis === "function" ? window.getLenis() : null;
    if (lenis && typeof lenis.scrollTo === "function") {
      lenis.scrollTo(el, { offset: offset != null ? offset : -80, duration: 1.2 });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  $$(
    ".nav__links a, .hero .btn, .footer__links a, .section__actions a, .about-impact__cta, .about-story__link",
  ).forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href === "#rooms") {
        e.preventDefault();
        scrollToSection("#rooms", -80);
        var navLinks = $("#navLinks");
        if (navLinks) navLinks.classList.remove("open");
        return;
      }
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const target = $(href);
        if (target) scrollToSection(target, -80);
        $("#navLinks").classList.remove("open");
      }
    });
  });

  // --- Add to cart: open book popup; backend validates session and returns message if not signed in ---
  function onAddToCartClick(id, name, price) {
    openBookRoomModal(Number(id), name, Number(price));
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add-cart]");
    if (!btn) return;
    var modal = $("#roomsModal");
    if (modal && modal.classList.contains("active")) {
      e.preventDefault();
      onAddToCartClick(
        btn.dataset.addCart,
        btn.dataset.name,
        btn.dataset.price,
      );
      return;
    }
    var grid = $("#roomsGrid");
    if (grid && grid.contains(btn)) {
      e.preventDefault();
      onAddToCartClick(
        btn.dataset.addCart,
        btn.dataset.name,
        btn.dataset.price,
      );
    }
  });

  function checkDatesAvailability() {
    if (!A) return;
    var checkIn = $("#bookRoomCheckIn") && $("#bookRoomCheckIn").value;
    var checkOut = $("#bookRoomCheckOut") && $("#bookRoomCheckOut").value;
    var availEl = $("#bookRoomAvailability");
    if (!availEl || !pendingBookRoom || !checkIn || !checkOut) {
      if (availEl) availEl.textContent = "";
      return;
    }
    var roomId = "R" + pendingBookRoom.id;
    availEl.textContent = "Checking availability…";
    availEl.classList.remove(
      "form__availability--ok",
      "form__availability--error",
    );
    A.quoteRoom({
      roomId: roomId,
      checkIn: checkIn,
      checkOut: checkOut,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          availEl.textContent = "Rooms are available.";
          availEl.classList.add("form__availability--ok");
          availEl.classList.remove("form__availability--error");
        } else {
          clearBookRoomPrepaid();
          availEl.textContent =
            result.data && result.data.message
              ? result.data.message
              : "Dates not available.";
          availEl.classList.add("form__availability--error");
          availEl.classList.remove("form__availability--ok");
        }
      })
      .catch(function () {
        clearBookRoomPrepaid();
        availEl.textContent = "";
        availEl.classList.remove(
          "form__availability--ok",
          "form__availability--error",
        );
      });
  }

  var bookRoomCheckIn = $("#bookRoomCheckIn");
  if (bookRoomCheckIn) {
    bookRoomCheckIn.addEventListener("change", function () {
      var co = $("#bookRoomCheckOut");
      if (co && bookRoomCheckIn.value) co.min = bookRoomCheckIn.value;
      checkDatesAvailability();
    });
  }
  var bookRoomCheckOut = $("#bookRoomCheckOut");
  if (bookRoomCheckOut) {
    bookRoomCheckOut.addEventListener("change", checkDatesAvailability);
  }

  var bookRoomForm = $("#bookRoomForm");
  if (bookRoomForm) {
    bookRoomForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (!A) return;
      if (!pendingBookRoom) return;
      var errEl = $("#bookRoomError");
      var submitBtn = $("#bookRoomSubmitBtn");
      var roomId = "R" + pendingBookRoom.id;
      if (validRoomIdsFromBackend.length > 0 && validRoomIdsFromBackend.indexOf(roomId) === -1) {
        errEl.textContent = "This room is not available for booking.";
        return;
      }
      var checkIn = $("#bookRoomCheckIn").value;
      var checkOut = $("#bookRoomCheckOut").value;
      var adults = parseInt($("#bookRoomAdults").value, 10) || 1;
      var children = parseInt($("#bookRoomChildren").value, 10) || 0;
      errEl.textContent = "";
      if (submitBtn) submitBtn.disabled = true;
      try {
        var availRes = await A.quoteRoom({
          roomId: roomId,
          checkIn: checkIn,
          checkOut: checkOut,
        });
        var availData = await availRes.json().catch(function () {
          return {};
        });
        if (!availRes.ok) {
          errEl.textContent =
            availData.message || "Selected dates are not available.";
          return;
        }
        var cartRes = await A.guestCartAdd({
          roomId: roomId,
          checkIn: checkIn,
          checkOut: checkOut,
          adults: adults,
          children: children,
        });
        if (cartRes.status === 401) {
          errEl.textContent = "Please sign in to add rooms to your cart.";
          openModal("#signInModal");
          return;
        }
        if (!cartRes.ok) {
          var cartData = await cartRes.json().catch(function () {
            return {};
          });
          errEl.textContent = cartData.message || "Could not add to cart.";
          return;
        }
        closeAllModals();
        var infoEl = $("#roomAddedInfo");
        var roomAddedModal = $("#roomAddedModal");
        if (infoEl)
          infoEl.textContent =
            pendingBookRoom.name + " — ₹" + pendingBookRoom.price + " / night";
        if (roomAddedModal) openModal("#roomAddedModal");
        pendingBookRoom = null;
        fetchCartCount();
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // --- Modal logic ---
  function openModal(id) {
    closeAllModals();
    $(id).classList.add("active");
  }

  function closeAllModals() {
    $$(".modal").forEach((m) => m.classList.remove("active"));
    $$(".form__error").forEach((e) => (e.textContent = ""));
    $$(".form__success").forEach((e) => (e.textContent = ""));
    $$(".form__availability").forEach((e) => {
      e.textContent = "";
      e.classList.remove("form__availability--ok", "form__availability--error");
    });
    clearBookRoomPrepaid();
  }

  $$(".modal__overlay, .modal__close, [data-close]").forEach((el) => {
    el.addEventListener("click", closeAllModals);
  });

  // --- Auth UI: Sign In (when logged out) / Profile dropdown (when logged in) ---
  const DEFAULT_AVATAR_URL = "/img/default-avatar.svg";
  function updateAuthUI() {
    const authBtn = $("#authBtn");
    const navProfile = $("#navProfile");
    const navProfileAvatar = $("#navProfileAvatar");
    const navProfileDropdown = $("#navProfileDropdown");
    if (!authBtn || !navProfile) return;
    if (currentUser) {
      authBtn.style.display = "none";
      navProfile.style.display = "block";
      navProfile.setAttribute("aria-hidden", "false");
      if (navProfileAvatar) {
        var imageUrl = (currentUser.avatar || currentUser.picture || "").trim();
        navProfileAvatar.src = imageUrl ? imageUrl : DEFAULT_AVATAR_URL;
        navProfileAvatar.alt = currentUser.name
          ? String(currentUser.name)
          : "Profile";
      }
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
    } else {
      authBtn.style.display = "";
      navProfile.style.display = "none";
      navProfile.setAttribute("aria-hidden", "true");
      if (navProfileAvatar) navProfileAvatar.src = DEFAULT_AVATAR_URL;
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
    }
  }

  $("#authBtn").addEventListener("click", () => {
    openModal("#signInModal");
  });

  updateAuthUI();

  // --- Profile dropdown ---
  const navProfileTrigger = $("#navProfileTrigger");
  const navProfileDropdown = $("#navProfileDropdown");
  if (navProfileTrigger && navProfileDropdown) {
    navProfileTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = navProfileDropdown.classList.toggle("is-open");
      navProfileTrigger.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false",
      );
    });
    navProfileDropdown.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
      navProfileDropdown.classList.remove("is-open");
      if (navProfileTrigger)
        navProfileTrigger.setAttribute("aria-expanded", "false");
    });
  }

  const navProfileLogout = $("#navProfileLogout");
  if (navProfileLogout) {
    navProfileLogout.addEventListener("click", () => {
      A.clearSession();
      currentUser = null;
      updateAuthUI();
      fetchCartCount();
    });
  }
  const navProfileBookings = $("#navProfileBookings");
  if (navProfileBookings) {
    navProfileBookings.addEventListener("click", (e) => {
      e.preventDefault();
      if (navProfileDropdown) navProfileDropdown.classList.remove("is-open");
      const navLinks = $("#navLinks");
      if (navLinks) navLinks.classList.remove("open");

      var listEl = $("#myBookingsList");
      var emptyEl = $("#myBookingsError");
      var emptyMsgEl = $("#myBookingsEmpty");
      if (listEl) listEl.innerHTML = "";
      if (emptyEl) { emptyEl.style.display = "none"; emptyEl.textContent = ""; }
      if (emptyMsgEl) emptyMsgEl.style.display = "none";

      A.guestBookingsList()
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            if (emptyEl) {
              emptyEl.textContent = result.data && result.data.message ? result.data.message : "Please sign in to view bookings.";
              emptyEl.style.display = "block";
            }
            openModal("#myBookingsModal");
            return;
          }
          var bookings = result.data && result.data.data ? result.data.data : [];
          if (bookings.length === 0) {
            if (emptyMsgEl) emptyMsgEl.style.display = "block";
          } else if (listEl) {
            listEl.innerHTML = bookings.map(function (b) {
              var rooms = b.rooms || [];
              var roomsSummary = rooms.map(function (r) { return r.roomName || r.roomId || "—"; }).join(", ");
              var checkIn = rooms[0] && rooms[0].checkIn ? new Date(rooms[0].checkIn).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
              var checkOut = rooms[0] && rooms[0].checkOut ? new Date(rooms[0].checkOut).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
              var status = (b.status || "pending").toLowerCase();
              var guestName = (b.guest && b.guest.name) ? b.guest.name : "—";
              return (
                "<div class=\"my-bookings__item\">" +
                "<span class=\"my-bookings__guest\">" + (guestName.replace(/</g, "&lt;").replace(/>/g, "&gt;")) + "</span>" +
                "<span class=\"my-bookings__rooms\">" + (roomsSummary.replace(/</g, "&lt;").replace(/>/g, "&gt;")) + "</span>" +
                "<span class=\"my-bookings__dates\">" + checkIn + " – " + checkOut + "</span>" +
                "<span class=\"my-bookings__total\">₹" + (b.totalAmount != null ? Number(b.totalAmount).toLocaleString("en-IN") : "0") + "</span>" +
                "<span class=\"my-bookings__status my-bookings__status--" + status + "\">" + status + "</span>" +
                "</div>"
              );
            }).join("");
          }
          openModal("#myBookingsModal");
        })
        .catch(function () {
          if (emptyEl) {
            emptyEl.textContent = "Could not load bookings.";
            emptyEl.style.display = "block";
          }
          openModal("#myBookingsModal");
        });
    });
  }

  // --- Magic PIN sign-in (central API) ---
  function wireSignInModal() {
    const errEl = $("#signInError");
    const stepEmail = $("#signInStepEmail");
    const stepPin = $("#signInStepPin");
    const sendBtn = $("#signInSendPin");
    const verifyBtn = $("#signInVerifyPin");
    const backBtn = $("#signInBackEmail");
    if (!sendBtn || !stepEmail || !stepPin) return;

    function showEmailStep() {
      if (errEl) errEl.textContent = "";
      stepEmail.style.display = "";
      stepPin.style.display = "none";
    }
    function showPinStep() {
      if (errEl) errEl.textContent = "";
      stepEmail.style.display = "none";
      stepPin.style.display = "";
      const pinInput = $("#signInPin");
      if (pinInput) pinInput.focus();
    }

    sendBtn.addEventListener("click", async function () {
      if (errEl) errEl.textContent = "";
      const name = ($("#signInName") && $("#signInName").value.trim()) || "";
      const email = ($("#signInEmail") && $("#signInEmail").value.trim()) || "";
      if (!email) {
        if (errEl) errEl.textContent = "Please enter your email.";
        return;
      }
      sendBtn.disabled = true;
      try {
        const res = await A.requestPin({
          propertySlug: A.propertySlug,
          email: email,
          name: name || email.split("@")[0],
        });
        const data = await res.json().catch(function () {
          return {};
        });
        if (!res.ok) {
          if (errEl) errEl.textContent = data.message || "Could not send code.";
          return;
        }
        showPinStep();
      } catch {
        if (errEl) errEl.textContent = "Network error. Try again.";
      } finally {
        sendBtn.disabled = false;
      }
    });

    if (verifyBtn) {
      verifyBtn.addEventListener("click", async function () {
        if (errEl) errEl.textContent = "";
        const name = ($("#signInName") && $("#signInName").value.trim()) || "";
        const email = ($("#signInEmail") && $("#signInEmail").value.trim()) || "";
        const pin = ($("#signInPin") && $("#signInPin").value.trim()) || "";
        if (!pin) {
          if (errEl) errEl.textContent = "Enter the code from your email.";
          return;
        }
        verifyBtn.disabled = true;
        try {
          const res = await A.verifyPin({
            propertySlug: A.propertySlug,
            email: email,
            name: name || undefined,
            pin: pin,
          });
          const data = await res.json().catch(function () {
            return {};
          });
          if (!res.ok || !data.success || !data.token) {
            if (errEl) errEl.textContent = data.message || "Invalid code.";
            return;
          }
          A.setSession(data.token, data.guest);
          currentUser = data.guest;
          updateAuthUI();
          closeAllModals();
          showEmailStep();
          const pinInput = $("#signInPin");
          if (pinInput) pinInput.value = "";
          fetchCartCount();
          try {
            if (sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) === "cart") {
              sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
              window.location.href = "cart.html";
            }
          } catch (_) {}
        } catch {
          if (errEl) errEl.textContent = "Network error. Try again.";
        } finally {
          verifyBtn.disabled = false;
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", showEmailStep);
    }

    $("#signInModal").addEventListener("click", function (e) {
      if (e.target.closest("[data-close]") || e.target.classList.contains("modal__overlay")) {
        showEmailStep();
      }
    });
  }

  wireSignInModal();

  // --- Auth: guest JWT in localStorage (central API) ---
  async function checkAuth(cb) {
    try {
      const tok = A.getToken();
      const u = A.getStoredUser();
      if (tok && u) {
        currentUser = u;
        updateAuthUI();
        fetchCartCount();
        if (cb) cb(u);
        return;
      }
      currentUser = null;
      updateAuthUI();
      const countEl = $("#navCartCount");
      if (countEl) {
        countEl.textContent = "0";
        countEl.setAttribute("data-count", "0");
      }
      if (cb) cb(null);
    } catch {
      if (cb) cb(null);
    }
  }

  async function fetchCartCount() {
    try {
      if (!A.getToken()) {
        const countEl = $("#navCartCount");
        if (countEl) {
          countEl.textContent = "0";
          countEl.setAttribute("data-count", "0");
        }
        return;
      }
      const res = await A.guestCartGet();
      if (!res.ok) return;
      const data = await res.json();
      const lines = Array.isArray(data.roomInfo)
        ? data.roomInfo
        : Array.isArray(data.message)
          ? data.message
          : [];
      const count = lines.length;
      const countEl = $("#navCartCount");
      if (countEl) {
        countEl.textContent = count;
        countEl.setAttribute("data-count", count);
      }
    } catch (_) {}
  }

  let pendingBookRoom = null;

  function openBookRoomModal(roomId, roomName, roomPrice) {
    pendingBookRoom = { id: roomId, name: roomName, price: roomPrice };
    const nameEl = $("#bookRoomName");
    if (nameEl) nameEl.textContent = roomName;
    const errEl = $("#bookRoomError");
    if (errEl) errEl.textContent = "";
    const today = new Date().toISOString().slice(0, 10);
    const checkIn = $("#bookRoomCheckIn");
    const checkOut = $("#bookRoomCheckOut");
    if (checkIn) {
      checkIn.value = "";
      checkIn.min = today;
    }
    if (checkOut) {
      checkOut.value = "";
      checkOut.min = today;
    }
    const adults = $("#bookRoomAdults");
    const children = $("#bookRoomChildren");
    if (adults) adults.value = 1;
    if (children) children.value = 0;
    clearBookRoomPrepaid();
    openModal("#bookRoomModal");
  }

  function updateRoomCartButtons() {
    $$("[data-add-cart]").forEach((btn) => {
      if (btn) btn.textContent = "Add to cart";
    });
  }

  function updateCartUI() {
    fetchCartCount();
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatRoomDescription(description) {
    var raw = String(description || "");
    var m = raw.match(/\bIdeal(?:ly)?\b/i);
    if (!m || m.index == null) return escapeHtml(raw);
    var splitAt = m.index;
    var before = raw.slice(0, splitAt).trimEnd();
    var after = raw.slice(splitAt).trimStart();
    if (!before) return escapeHtml(raw);
    return escapeHtml(before) + "<br><br>" + escapeHtml(after);
  }

  function renderSiteGallery(siteGalleryImages) {
    var track = $("#galleryMarqueeTrack");
    if (!track || !Array.isArray(siteGalleryImages) || !siteGalleryImages.length) return;

    var cleaned = siteGalleryImages
      .map(function (img) {
        if (!img) return null;
        if (typeof img === "string") {
          return { url: img, alt: "Misty Hut gallery image" };
        }
        if (typeof img === "object") {
          var url = img.url || img.src || img.imageUrl || "";
          if (!url) return null;
          return {
            url: url,
            alt: img.alt || img.title || "Misty Hut gallery image",
            title: img.title || "",
            label: img.label || "",
          };
        }
        return null;
      })
      .filter(Boolean);

    if (!cleaned.length) return;

    function buildGroup(tabIndex, ariaHidden) {
      var attrs = ariaHidden ? ' aria-hidden="true"' : "";
      return (
        '<div class="gallery-marquee__group"' +
        attrs +
        ">" +
        cleaned
          .map(function (img, idx) {
            var title = img.title || "Misty Hut";
            var label = img.label || "View " + (idx + 1);
            return (
              '<article class="gallery-reel__slide gallery-marquee__slide" tabindex="' +
              tabIndex +
              '" role="group">' +
              '<div class="gallery-reel__img-wrap gallery-marquee__img-wrap">' +
              '<img src="' +
              escapeHtml(img.url) +
              '" alt="' +
              escapeHtml(img.alt) +
              '" loading="lazy" decoding="async" width="1200" height="675" />' +
              '<div class="gallery-marquee__top-cap">' +
              '<span class="gallery-marquee__card-title">' +
              escapeHtml(title) +
              "</span>" +
              '<span class="gallery-marquee__card-label">' +
              escapeHtml(label) +
              "</span>" +
              "</div>" +
              "</div>" +
              "</article>"
            );
          })
          .join("") +
        "</div>"
      );
    }

    track.innerHTML = buildGroup("0", false) + buildGroup("-1", true);
  }

  // --- Render rooms ---
  async function renderRooms() {
    if (!A) return;
    try {
      const res = await A.publicRooms();
      const data = await res.json();
      if (!data.success || !Array.isArray(data.rooms)) return;
      if (data.siteGallery && Array.isArray(data.siteGallery.images)) {
        renderSiteGallery(data.siteGallery.images);
      }
      validRoomIdsFromBackend = data.rooms.map(function (r) {
        return r.roomId || (r.id != null ? "R" + r.id : "");
      }).filter(Boolean);
      const grid = $("#roomsGrid");
      grid.innerHTML = data.rooms
        .map(
          (room, idx) => {
            const imgSrc =
              room.images && room.images.banner
                ? room.images.banner
                : "/img/summary%20green.jpeg";
            const galleryOnly = [];
            if (room.images && room.images.gallery && room.images.gallery.length)
              galleryOnly.push(...room.images.gallery);
            const roomImagesJson = galleryOnly.length ? JSON.stringify(galleryOnly) : "";
            return `
        <div class="room-card" data-reveal="slide-down" data-reveal-delay="${Math.min(idx * 100, 400)}"${roomImagesJson ? ' data-room-images="' + roomImagesJson.replace(/"/g, "&quot;") + '" data-room-name="' + (room.name || "").replace(/"/g, "&quot;") + '"' : ""}>
          <div class="room-card__media">
            <img loading="lazy" alt="${escapeHtml(room.name)} cover" src="${imgSrc}">
            <span class="room-card__view-pill" aria-hidden="true">
              <svg class="room-card__view-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 12C3.8 7.9 7.5 5.5 12 5.5C16.5 5.5 20.2 7.9 22.5 12C20.2 16.1 16.5 18.5 12 18.5C7.5 18.5 3.8 16.1 1.5 12Z" fill="currentColor"/>
                <circle cx="12" cy="12" r="3.2" fill="#004643"/>
                <circle cx="12" cy="12" r="1.4" fill="#F0EDE5"/>
              </svg>
            </span>
          </div>
          <span class="room-card__number">0${room.id}</span>
          <h3 class="room-card__name">${escapeHtml(room.name)}</h3>
          <p class="room-card__desc">${formatRoomDescription(room.description)}</p>
          <p class="room-card__price"><span>₹${room.price}</span> / night</p>
          <div class="room-card__actions">
            <button type="button" class="btn btn--outline btn--sm" data-add-cart="${room.id}" data-name="${escapeHtml(room.name)}" data-price="${room.price}">Add to cart</button>
          </div>
        </div>
      `;
          },
        )
        .join("");
      if (window.refreshScrollReveals) window.refreshScrollReveals();
      if (window.initRoomCardHover) window.initRoomCardHover();
      updateCartUI();
      updateRoomCartButtons();
    } catch {
      /* silent */
    }
  }

  // --- Room card premium hover (GSAP) ---
  function initRoomCardHover() {
    return;
  }

  window.initRoomCardHover = initRoomCardHover;

  // --- Gallery filter ---
  $$(".gallery__filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".gallery__filter").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      $$(".gallery__item").forEach((item) => {
        if (filter === "all" || item.dataset.category === filter) {
          item.classList.remove("hidden");
        } else {
          item.classList.add("hidden");
        }
      });
    });
  });

  // --- Gallery image click: full-screen popup ---
  var galleryGrid = $("#galleryGrid");
  if (galleryGrid) {
    galleryGrid.addEventListener("click", function (e) {
      var item = e.target.closest(".gallery__item");
      if (!item || item.classList.contains("hidden")) return;
      var img = item.querySelector(".gallery__img");
      if (!img) return;
      e.preventDefault();
      var lbImg = $("#galleryLightboxImg");
      var lb = $("#galleryLightbox");
      if (lbImg && lb) {
        lbImg.src = img.src || img.currentSrc;
        lbImg.alt = img.alt || "";
        openModal("#galleryLightbox");
      }
    });
  }

  // --- Room card click: open room gallery (banner + gallery images from admin) ---
  var roomGalleryUrls = [];
  var roomGalleryIndex = 0;
  var roomGalleryImg = $("#roomGalleryImg");
  var roomGalleryCounter = $("#roomGalleryCounter");
  var roomGalleryPrev = $("#roomGalleryPrev");
  var roomGalleryNext = $("#roomGalleryNext");

  function toJpegUrl(url) {
    if (!url || typeof url !== "string") return url;
    if (url.indexOf("cloudinary.com") !== -1 && url.indexOf("/upload/") !== -1) {
      return url.replace("/upload/", "/upload/f_jpg/");
    }
    return url;
  }

  function updateRoomGalleryImage() {
    if (!roomGalleryImg || !roomGalleryUrls.length) return;
    var idx = roomGalleryIndex;
    if (idx < 0) idx = 0;
    if (idx >= roomGalleryUrls.length) idx = roomGalleryUrls.length - 1;
    roomGalleryIndex = idx;
    roomGalleryImg.src = toJpegUrl(roomGalleryUrls[roomGalleryIndex]);
    roomGalleryImg.alt = "Room image " + (roomGalleryIndex + 1);
    if (roomGalleryCounter) {
      roomGalleryCounter.textContent = (roomGalleryIndex + 1) + " / " + roomGalleryUrls.length;
    }
    if (roomGalleryPrev) roomGalleryPrev.style.visibility = roomGalleryUrls.length > 1 ? "visible" : "hidden";
    if (roomGalleryNext) roomGalleryNext.style.visibility = roomGalleryUrls.length > 1 ? "visible" : "hidden";
  }

  function openRoomGallery(urls, roomName) {
    if (!urls || !urls.length || !roomGalleryImg) return;
    roomGalleryUrls = urls;
    roomGalleryIndex = 0;
    updateRoomGalleryImage();
    openModal("#roomGalleryModal");
  }

  var roomsGridEl = $("#roomsGrid");
  if (roomsGridEl) {
    roomsGridEl.addEventListener("click", function (e) {
      var card = e.target.closest(".room-card");
      if (!card) return;
      if (e.target.closest("[data-add-cart]") || e.target.closest(".room-card__actions")) return;
      var raw = card.getAttribute("data-room-images");
      if (!raw) return;
      var urls = [];
      try {
        urls = JSON.parse(raw);
      } catch (err) {}
      if (!urls.length) return;
      e.preventDefault();
      var name = card.getAttribute("data-room-name") || "";
      openRoomGallery(urls, name);
    });
  }

  if (roomGalleryPrev) {
    roomGalleryPrev.addEventListener("click", function (e) {
      e.preventDefault();
      if (roomGalleryUrls.length <= 1) return;
      roomGalleryIndex = (roomGalleryIndex - 1 + roomGalleryUrls.length) % roomGalleryUrls.length;
      updateRoomGalleryImage();
    });
  }
  if (roomGalleryNext) {
    roomGalleryNext.addEventListener("click", function (e) {
      e.preventDefault();
      if (roomGalleryUrls.length <= 1) return;
      roomGalleryIndex = (roomGalleryIndex + 1) % roomGalleryUrls.length;
      updateRoomGalleryImage();
    });
  }

  // --- Directions button (maps) ---
  function setupDirections() {
    const btn = $("#getDirectionsBtn");
    if (!btn) return;
    const mapsUrl = "https://maps.app.goo.gl/B6k7UDQxbQUnC6up6";
    btn.href = mapsUrl;
    btn.target = "_blank";
  }

  // --- Hero background sequence (8 images, fade-only, 2s loop) ---
  function setupHeroSlider() {
    const slides = Array.from(document.querySelectorAll(".hero__slide"));
    if (slides.length < 2) return;

    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const imageUrls = slides.map((slide) => slide.dataset.image || "").filter(Boolean);
    if (imageUrls.length !== slides.length) return;

    const preload = imageUrls.map(function (url) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = url;
      });
    });

    Promise.allSettled(preload).then(function () {
      slides.forEach(function (slide, i) {
        slide.style.backgroundImage = 'url("' + imageUrls[i] + '")';
      });

      let idx = Math.max(
        0,
        slides.findIndex((s) => s.classList.contains("is-active")),
      );
      if (idx < 0) idx = 0;

      function show(nextIdx) {
        slides[idx].classList.remove("is-active");
        slides[nextIdx].classList.add("is-active");
        idx = nextIdx;
      }

      if (prefersReducedMotion) return;

      let timer = setInterval(function () {
        const next = (idx + 1) % slides.length;
        show(next);
      }, 3500);

      document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
          clearInterval(timer);
        } else {
          clearInterval(timer);
          timer = setInterval(function () {
            const next = (idx + 1) % slides.length;
            show(next);
          }, 3500);
        }
      });
    });
  }

  // --- Blob cursor (site-wide) — single blob, small, transparent ---
  function setupBlobCursor() {
    const container = $("#blobCursor");
    const blob = container
      ? container.querySelector(".blob-cursor__blob")
      : null;
    if (!container || !blob) return;

    const isCoarse =
      window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;

    document.documentElement.classList.add("custom-cursor-active");
    document.body.classList.add("custom-cursor-active");

    let x = 0,
      y = 0;
    let visible = false;
    let hovering = false;
    let down = false;
    let activeHoverEl = null;

    function scale() {
      return down ? 0.9 : hovering ? 1.24 : 1;
    }

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

    window.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        setVisible(true);
        paintBlob();
      },
      { passive: true },
    );

    window.addEventListener("mouseleave", () => setVisible(false));
    window.addEventListener("mousedown", () => {
      down = true;
      updateClasses();
    });
    window.addEventListener("mouseup", () => {
      down = false;
      updateClasses();
    });

    var textSelector =
      "h1, h2, h3, h4, h5, h6, p, .hero__title, .hero__subtitle, .hero__desc, .about-impact__headline, .section__title, .section__subtitle";
    var hoverSelector =
      'a, button, .btn, input, textarea, [role="button"], .room-card, .gallery__item, .gallery-card';
    var headerSelector = ".nav, .footer";
    function isOverHeader(el) {
      return el && el.closest && el.closest(headerSelector);
    }
    document.addEventListener("mouseover", (e) => {
      const target =
        e.target && e.target.closest && e.target.closest(hoverSelector);
      const textEl =
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

    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) {
        hovering = false;
        container.classList.remove("is-hover-text");
        container.classList.remove("is-over-header");
        if (activeHoverEl) activeHoverEl.classList.remove("cursor-target");
        activeHoverEl = null;
        updateClasses();
        return;
      }
      const stillHover =
        e.relatedTarget.closest && e.relatedTarget.closest(hoverSelector);
      const stillText =
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

  // --- Init ---
  setupDirections();
  setupHeroSlider();
  setupBlobCursor();
  checkAuth(function (user) {
    if (user) {
      try {
        if (sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) === "cart") {
          sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
          window.location.href = "cart.html";
        }
      } catch (_) {}
    }
  });
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("signin") === "1") {
      openModal("#signInModal");
      history.replaceState({}, "", window.location.pathname);
    }
  } catch (_) {}
  renderRooms();
})();

