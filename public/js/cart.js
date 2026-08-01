(function () {
  "use strict";
  var POST_LOGIN_REDIRECT_KEY = "summer-green-post-login";
  var A = window.MistyApi;
  if (!A) {
    console.warn("MistyApi missing — load /js/api-config.js before cart.js");
  }

  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var $$ = function (sel) {
    return document.querySelectorAll(sel);
  };

  var serverCart = [];
  var serverCartPricing = null;
  var currentUser = null;
  var DEFAULT_AVATAR_URL = "/img/default-avatar.svg";

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  }

  function asNumber(value) {
    var n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  function computeFallbackPricing(roomList) {
    var totalPrice = roomList.reduce(function (sum, room) {
      return sum + (Number(room.price) || 0);
    }, 0);
    return {
      totalPrice: totalPrice,
      lowerPayableTotal: null,
      upperPayableTotal: null,
      lowerPercent: null,
      upperPercent: null,
      prepaidOptions: [],
      roomInfo: roomList,
    };
  }

  function parseCartPricing(data, roomList) {
    var fallback = computeFallbackPricing(roomList);
    if (!data || typeof data !== "object") return fallback;
    return {
      totalPrice: asNumber(data.totalPrice) != null ? Number(data.totalPrice) : fallback.totalPrice,
      lowerPayableTotal: asNumber(data.lowerPayableTotal),
      upperPayableTotal: asNumber(data.upperPayableTotal),
      lowerPercent: asNumber(data.lowerPercent),
      upperPercent: asNumber(data.upperPercent),
      prepaidOptions: Array.isArray(data.prepaidOptions) ? data.prepaidOptions : [],
      roomInfo: roomList,
    };
  }

  function getRoomIds() {
    return serverCart
      .map(function (room) {
        return room && room.roomId ? String(room.roomId) : "";
      })
      .filter(Boolean);
  }

  function createBookingRequest(body) {
    return A.guestBookingRequest(body).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data };
      });
    });
  }

  /**
   * Checkout step shows **both** cart (with Remove) and booking details.
   * Only hiding the cart was why Remove disappeared after "Proceed to checkout".
   */
  function showStep(stepId) {
    $$(".cart-step").forEach(function (el) {
      el.classList.add("cart-step--hidden");
    });
    if (stepId === "stepCheckout") {
      var cartSec = document.getElementById("stepCart");
      var checkoutSec = document.getElementById("stepCheckout");
      if (cartSec) cartSec.classList.remove("cart-step--hidden");
      if (checkoutSec) checkoutSec.classList.remove("cart-step--hidden");
      return;
    }
    var step = document.getElementById(stepId);
    if (step) step.classList.remove("cart-step--hidden");
  }

  function checkAuth(cb) {
    if (!A) {
      if (cb) cb(null);
      return;
    }
    var tok = A.getToken();
    var u = A.getStoredUser();
    currentUser = tok && u ? u : null;
    if (cb) cb(currentUser);
  }

  function updateAuthUI() {
    var authBtn = $("#authBtn");
    var navProfile = $("#navProfile");
    var navProfileAvatar = $("#navProfileAvatar");
    var navProfileDropdown = $("#navProfileDropdown");
    if (!authBtn || !navProfile) return;
    if (currentUser) {
      authBtn.style.display = "none";
      navProfile.style.display = "block";
      navProfile.setAttribute("aria-hidden", "false");
      if (navProfileAvatar) {
        var imageUrl = (currentUser.avatar || currentUser.picture || "").trim();
        navProfileAvatar.referrerPolicy = "no-referrer";
        navProfileAvatar.onerror = function () {
          navProfileAvatar.onerror = null;
          navProfileAvatar.src = DEFAULT_AVATAR_URL;
        };
        navProfileAvatar.src = imageUrl ? imageUrl : DEFAULT_AVATAR_URL;
        navProfileAvatar.alt = currentUser.name ? String(currentUser.name) : "Profile";
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

  function openModal(id) {
    var el = $(id);
    if (el) el.classList.add("active");
  }

  function closeModal(id) {
    var el = $(id);
    if (el) el.classList.remove("active");
  }

  function updateNavCartCount(count) {
    var el = $("#navCartCount");
    if (el) {
      el.textContent = count;
      el.setAttribute("data-count", count);
    }
  }

  function fetchCart() {
    if (!A || !A.getToken()) {
      serverCart = [];
      serverCartPricing = computeFallbackPricing([]);
      return Promise.resolve({ unauthorized: true });
    }
    return A.guestCartGet()
      .then(function (res) {
        if (res.status === 401) return { unauthorized: true };
        return res.json().then(function (data) {
          var lines = Array.isArray(data.roomInfo)
            ? data.roomInfo
            : Array.isArray(data.message)
              ? data.message
              : [];
          serverCart = lines;
          serverCartPricing = parseCartPricing(data, lines);
          return { ok: res.ok, unauthorized: res.status === 401 };
        });
      })
      .catch(function () {
        serverCart = [];
        serverCartPricing = computeFallbackPricing([]);
        return { ok: false };
      });
  }

  function renderCartList() {
    var listEl = $("#cartList");
    var emptyEl = $("#cartEmpty");
    var footerEl = $("#cartFooter");
    var totalEl = $("#cartTotal");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (serverCart.length === 0) {
      if (emptyEl) emptyEl.style.display = "block";
      if (footerEl) footerEl.style.display = "none";
      updateNavCartCount(0);
      return;
    }
    if (emptyEl) emptyEl.style.display = "none";
    if (footerEl) footerEl.style.display = "block";
    var total = 0;
    serverCart.forEach(function (room) {
      var price = room.price || 0;
      total += price;
      var checkIn = formatDate(room.checkIn);
      var checkOut = formatDate(room.checkOut);
      var adults =
        room.adults != null
          ? room.adults
          : room.children && room.children.adults != null
            ? room.children.adults
            : 1;
      var children =
        room.children != null && typeof room.children === "number"
          ? room.children
          : room.children && room.children.children != null
            ? room.children.children
            : 0;
      var roomName = room.roomName || room.roomId || "Room";
      var breakdownHtml = "";
      if (room.priceBreakdown && Array.isArray(room.priceBreakdown) && room.priceBreakdown.length > 0) {
        breakdownHtml =
          '<div class="cart__item-breakdown">' +
          room.priceBreakdown
            .map(function (row) {
              var d = row.date != null ? formatDate(row.date) : "";
              var p = row.price != null ? row.price : 0;
              var r = row.reason ? escapeHtml(row.reason) : "";
              return (
                '<div class="cart__item-breakdown__row">' +
                (d ? escapeHtml(d) + " — " : "") +
                "₹" +   
                p +
                (r ? " (" + r + ")" : "") +
                "</div>"
              );
            })
            .join("") +
          "</div>";
      }
      var item = document.createElement("div");
      item.className = "cart__item";
      item.innerHTML =
        '<div class="cart__item-info">' +
        '<div class="cart__item-name">' +
        escapeHtml(roomName) +
        "</div>" +
        '<div class="cart__item-meta">' +
        checkIn +
        " – " +
        checkOut +
        (adults || children
          ? " · " +
            adults +
            " adult(s)" +
            (children ? ", " + children + " kid(s)" : "")
          : "") +
        "</div>" +
        '<div class="cart__item-price">' +
        '₹' +
        price +
        " total</div>" +
        breakdownHtml +
        "</div>" +
        '<button type="button" class="cart__item-remove cursor-target" data-remove data-room-id="' +
        escapeHtml(room.roomId) +
        '" data-check-in="' +
        escapeHtml(checkIn) +
        '" data-check-out="' +
        escapeHtml(checkOut) +
        '">Remove</button>';
      listEl.appendChild(item);
    });
    listEl.querySelectorAll("[data-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var roomId = btn.getAttribute("data-room-id");
        var checkIn = btn.getAttribute("data-check-in");
        var checkOut = btn.getAttribute("data-check-out");
        removeFromCart(roomId, checkIn, checkOut);
      });
    });
    if (totalEl) {
      var resolvedTotal =
        serverCartPricing && serverCartPricing.totalPrice != null
          ? Number(serverCartPricing.totalPrice)
          : total;
      totalEl.textContent = "₹" + resolvedTotal.toLocaleString("en-IN");
    }
    updateNavCartCount(serverCart.length);
  }

  function renderCheckoutPricingSummary() {
    var summaryEl = $("#checkoutPricingSummary");
    if (!summaryEl) return;
    if (!serverCart.length) {
      summaryEl.hidden = true;
      summaryEl.innerHTML = "";
      return;
    }
    var pricing = serverCartPricing || computeFallbackPricing(serverCart);
    var total = pricing.totalPrice != null ? Number(pricing.totalPrice) : 0;
    var lower = pricing.lowerPayableTotal;
    var upper = pricing.upperPayableTotal;
    var lowerPctText =
      pricing.lowerPercent != null ? " (" + Number(pricing.lowerPercent) + "%)" : "";
    var upperPctText =
      pricing.upperPercent != null ? " (" + Number(pricing.upperPercent) + "%)" : "";
    summaryEl.hidden = false;
    summaryEl.innerHTML =
      '<div class="checkout-pricing-summary__row"><span>Selected rooms</span><strong>' +
      serverCart.length +
      "</strong></div>" +
      '<div class="checkout-pricing-summary__row"><span>Total booking amount</span><strong>₹' +
      total.toLocaleString("en-IN") +
      "</strong></div>" +
      (lower != null
        ? '<div class="checkout-pricing-summary__row"><span>Non-refundable payable' +
          lowerPctText +
          '</span><strong>₹' +
          Number(lower).toLocaleString("en-IN") +
          "</strong></div>"
        : "") +
      (upper != null
        ? '<div class="checkout-pricing-summary__row"><span>Refundable payable' +
          upperPctText +
          '</span><strong>₹' +
          Number(upper).toLocaleString("en-IN") +
          "</strong></div>"
        : "");
  }

  function removeFromCart(roomId, checkIn, checkOut) {
    if (!A) return;
    A.guestCartRemove({
      roomId: roomId,
      checkIn: checkIn,
      checkOut: checkOut,
    })
      .then(function (res) {
        return res.json();
      })
      .then(function () {
        return fetchCart().then(function () {
          renderCartList();
        });
      })
      .catch(function () {
        fetchCart().then(renderCartList);
      });
  }

  function loadCheckoutPrepaidOptions() {
    var hint = $("#checkoutPrepaidHint");
    var summaryEl = $("#checkoutPricingSummary");
    var container = $("#checkoutPrepaid");
    /* Prepaid is chosen at pay-after-approval — hide options at request checkout. */
    if (container) {
      container.innerHTML = "";
      container.hidden = true;
    }
    if (!A || !serverCart.length) {
      if (summaryEl) {
        summaryEl.hidden = true;
        summaryEl.innerHTML = "";
      }
      if (hint) hint.textContent = "No rooms selected yet.";
      return Promise.resolve();
    }
    if (hint) hint.textContent = "Loading booking summary…";
    return fetchCart()
      .then(function (result) {
        renderCartList();
        renderCheckoutPricingSummary();
        if (hint) {
          hint.textContent =
            "Review your total below, then submit a request. You'll pay only after the property approves.";
        }
        if (!result || !result.ok) {
          if (hint) {
            hint.textContent =
              "Could not refresh pricing. You can still submit a request.";
          }
        }
      })
      .catch(function () {
        if (hint) {
          hint.textContent =
            "Could not refresh pricing. You can still submit a request.";
        }
      });
  }

  function showRequestSuccess(message) {
    serverCart = [];
    serverCartPricing = null;
    renderCartList();
    updateNavCartCount(0);
    showStep("stepRequestSuccess");
    var textEl = $("#requestSuccessText");
    if (textEl && message) textEl.textContent = message;
    var errEl = $("#requestSuccessError");
    if (errEl) {
      errEl.style.display = "none";
      errEl.textContent = "";
    }
  }

  var bookingsPollTimer = null;

  function stopBookingsPoll() {
    if (bookingsPollTimer) {
      clearInterval(bookingsPollTimer);
      bookingsPollTimer = null;
    }
  }

  function startBookingsPoll() {
    stopBookingsPoll();
    bookingsPollTimer = setInterval(function () {
      var modal = $("#myBookingsModal");
      if (modal && modal.classList.contains("active")) {
        loadMyBookings({ silent: true });
      } else {
        stopBookingsPoll();
      }
    }, 30000);
  }

  function openMyBookingsModal() {
    openModal("#myBookingsModal");
    loadMyBookings();
    startBookingsPoll();
  }

  function closeMyBookingsModal() {
    closeModal("#myBookingsModal");
    stopBookingsPoll();
  }

  function loadMyBookings(opts) {
    opts = opts || {};
    var listEl = $("#myBookingsList");
    var emptyEl = $("#myBookingsError");
    var emptyMsgEl = $("#myBookingsEmpty");
    var Flow = window.MistyBookingFlow;
    if (!opts.silent) {
      if (listEl) listEl.innerHTML = "";
      if (emptyEl) {
        emptyEl.style.display = "none";
        emptyEl.textContent = "";
      }
      if (emptyMsgEl) emptyMsgEl.style.display = "none";
    }
    if (!A) {
      if (emptyEl) {
        emptyEl.textContent = "Booking API not configured.";
        emptyEl.style.display = "block";
      }
      return Promise.resolve();
    }
    return A.guestBookingsList()
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { ok: res.ok, data: data };
          });
      })
      .then(function (result) {
        if (!result.ok) {
          if (emptyEl) {
            emptyEl.textContent =
              (result.data && result.data.message) ||
              "Please sign in to view bookings.";
            emptyEl.style.display = "block";
          }
          if (listEl) listEl.innerHTML = "";
          return;
        }
        var bookings = Flow
          ? Flow.extractBookingsList(result.data)
          : (result.data && result.data.data) || [];
        if (!bookings.length) {
          if (emptyMsgEl) emptyMsgEl.style.display = "block";
          if (listEl) listEl.innerHTML = "";
          return;
        }
        if (emptyMsgEl) emptyMsgEl.style.display = "none";
        if (listEl && Flow) {
          listEl.innerHTML = bookings.map(Flow.renderBookingCardHtml).join("");
        }
      })
      .catch(function () {
        if (emptyEl) {
          emptyEl.textContent = "Could not load bookings.";
          emptyEl.style.display = "block";
        }
      });
  }

  function handlePayBookingClick(bookingId, btn) {
    var Flow = window.MistyBookingFlow;
    if (!Flow || !bookingId) return;
    if (btn) btn.disabled = true;
    var prefill = {
      name:
        ($("#checkoutName") && $("#checkoutName").value.trim()) ||
        (currentUser && currentUser.name) ||
        "",
      email:
        ($("#checkoutEmail") && $("#checkoutEmail").value.trim()) ||
        (currentUser && currentUser.email) ||
        "",
      phone: ($("#checkoutPhone") && $("#checkoutPhone").value.trim()) || "",
    };
    Flow.payForApprovedBooking({
      bookingId: bookingId,
      prefill: prefill,
      onSuccess: function () {
        alert("Payment successful. Your booking is confirmed.");
        loadMyBookings();
        if (btn) btn.disabled = false;
      },
      onError: function (err) {
        alert((err && err.message) || "Payment failed. Please try again.");
        if (btn) btn.disabled = false;
      },
      onDismiss: function () {
        if (btn) btn.disabled = false;
      },
    }).catch(function (err) {
      if (err && err.message === "Payment dismissed") return;
      alert((err && err.message) || "Could not start payment.");
      if (btn) btn.disabled = false;
    });
  }

  function onProceedToCheckout() {
    showStep("stepCheckout");
    loadCheckoutPrepaidOptions();
  }

  function openTermsModal() {
    var modal = $("#termsModal");
    if (modal) modal.classList.add("active");
    document.body.classList.add("modal-open");
    var cb = $("#termsAccept");
    var btn = $("#termsProceedBtn");
    if (cb) cb.checked = false;
    if (btn) btn.disabled = true;
  }

  function closeTermsModal() {
    var modal = $("#termsModal");
    if (modal) modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  }

  function showSignInRequired() {
    var listEl = $("#cartList");
    var emptyEl = $("#cartEmpty");
    var footerEl = $("#cartFooter");
    if (listEl) listEl.innerHTML = "";
    if (footerEl) footerEl.style.display = "none";
    if (emptyEl) {
      emptyEl.style.display = "block";
      emptyEl.innerHTML =
        "Please sign in to view your cart and proceed with booking.<br>" +
        '<button type="button" class="btn btn--primary cart__sign-in-btn cursor-target" id="cartSignInBtn" style="margin-top: 0.75rem;">Sign In</button>';
      var btn = document.getElementById("cartSignInBtn");
      if (btn) {
        btn.addEventListener("click", function () {
          try {
            sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, "cart");
          } catch (_) {}
          window.location.href = "index.html?signin=1";
        });
      }
    }
    updateNavCartCount(0);
  }

  function wireSignInModal() {
    if (!window.MistyGoogleSignIn || !A) return;
    window.MistyGoogleSignIn.wireSignInModal({
      onSuccess: function (guest) {
        currentUser = guest;
        updateAuthUI();
        closeModal("#signInModal");
        fetchCart().then(function () {
          renderCartList();
          loadCheckoutPrepaidOptions();
        });
      },
    });
  }

  function init() {
    var navToggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (navToggle && navLinks) {
      navToggle.addEventListener("click", function () {
        navLinks.classList.toggle("open");
      });
    }
    wireSignInModal();
    var authBtn = $("#authBtn");
    if (authBtn) {
      authBtn.addEventListener("click", function () {
        openModal("#signInModal");
      });
    }
    var navProfileTrigger = $("#navProfileTrigger");
    var navProfileDropdown = $("#navProfileDropdown");
    if (navProfileTrigger && navProfileDropdown) {
      navProfileTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = navProfileDropdown.classList.toggle("is-open");
        navProfileTrigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      navProfileDropdown.addEventListener("click", function (e) {
        e.stopPropagation();
      });
      document.addEventListener("click", function () {
        navProfileDropdown.classList.remove("is-open");
        navProfileTrigger.setAttribute("aria-expanded", "false");
      });
    }
    var navProfileLogout = $("#navProfileLogout");
    if (navProfileLogout) {
      navProfileLogout.addEventListener("click", function () {
        if (A) A.clearSession();
        currentUser = null;
        updateAuthUI();
        showSignInRequired();
      });
    }
    $("#cartList").innerHTML = "";
    checkAuth(function () {
      updateAuthUI();
      fetchCart().then(function (result) {
        if (result.unauthorized) {
          serverCart = [];
          showSignInRequired();
          return;
        }
        renderCartList();
        try {
          if (sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY) === "cart") {
            sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
            if (serverCart.length > 0) {
              showStep("stepCheckout");
              loadCheckoutPrepaidOptions();
            }
          }
        } catch (_) {}
      });
    });

    var checkoutForm = $("#checkoutForm");
    if (checkoutForm) {
      checkoutForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = $("#checkoutName").value.trim();
        var email = $("#checkoutEmail").value.trim();
        var phone = $("#checkoutPhone").value.trim();
        var errEl = $("#checkoutError");
        errEl.textContent = "";
        if (!name || !email || !phone) {
          errEl.textContent = "Please fill in name, email and phone.";
          return;
        }
        if (!serverCart.length) {
          errEl.textContent = "Your cart is empty. Add rooms before requesting.";
          return;
        }
        openTermsModal();
      });
    }

    var termsAccept = $("#termsAccept");
    var termsProceedBtn = $("#termsProceedBtn");
    if (termsAccept && termsProceedBtn) {
      termsAccept.addEventListener("change", function () {
        termsProceedBtn.disabled = !termsAccept.checked;
      });
    }

    if (termsProceedBtn) {
      termsProceedBtn.addEventListener("click", function () {
        if (!termsAccept || !termsAccept.checked) return;

        var name = $("#checkoutName").value.trim();
        var email = $("#checkoutEmail").value.trim();
        var phone = $("#checkoutPhone").value.trim();

        termsProceedBtn.disabled = true;

        var checkoutErr = $("#checkoutError");
        if (!A) {
          if (checkoutErr)
            checkoutErr.textContent = "Booking API not configured.";
          termsProceedBtn.disabled = false;
          return;
        }
        if (!name || !email || !phone) {
          if (checkoutErr)
            checkoutErr.textContent = "Please fill in name, email and phone.";
          termsProceedBtn.disabled = false;
          closeTermsModal();
          return;
        }

        createBookingRequest({ name: name, email: email, phone: phone })
          .then(function (result) {
            var ok =
              result.status === 200 ||
              result.status === 201 ||
              (result.data && result.data.success);
            if (ok) {
              closeTermsModal();
              try {
                sessionStorage.removeItem("misty_checkout_prepaidOptionId");
                sessionStorage.removeItem("misty_checkout_prepaidPercent");
              } catch (_) {}
              var msg =
                (result.data && result.data.message) ||
                "Your booking request has been sent. We’ll email you when the property confirms.";
              showRequestSuccess(msg);
              termsProceedBtn.disabled = false;
              return;
            }
            alert(
              (result.data && result.data.message) ||
                "Could not submit booking request. Please try again.",
            );
            termsProceedBtn.disabled = false;
          })
          .catch(function () {
            alert("Something went wrong. Please try again.");
            termsProceedBtn.disabled = false;
          });
      });
    }

    var requestSuccessBookingsBtn = $("#requestSuccessBookingsBtn");
    if (requestSuccessBookingsBtn) {
      requestSuccessBookingsBtn.addEventListener("click", function () {
        openMyBookingsModal();
      });
    }

    var navProfileBookings = $("#navProfileBookings");
    if (navProfileBookings) {
      navProfileBookings.addEventListener("click", function (e) {
        e.preventDefault();
        var dropdown = $("#navProfileDropdown");
        if (dropdown) dropdown.classList.remove("is-open");
        openMyBookingsModal();
      });
    }

    var myBookingsList = $("#myBookingsList");
    if (myBookingsList) {
      myBookingsList.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-pay-booking]");
        if (!btn) return;
        handlePayBookingClick(btn.getAttribute("data-pay-booking"), btn);
      });
    }

    $$("[data-close-terms]").forEach(function (el) {
      el.addEventListener("click", closeTermsModal);
    });
    $$("[data-close-bookings]").forEach(function (el) {
      el.addEventListener("click", closeMyBookingsModal);
    });
    $$("[data-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal("#signInModal");
      });
    });
    var signInModal = $("#signInModal");
    if (signInModal) {
      signInModal.addEventListener("click", function (e) {
        if (e.target.classList.contains("modal__overlay")) {
          closeModal("#signInModal");
        }
      });
    }
    var myBookingsModal = $("#myBookingsModal");
    if (myBookingsModal) {
      myBookingsModal.addEventListener("click", function (e) {
        if (e.target.classList.contains("modal__overlay")) {
          closeMyBookingsModal();
        }
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      var modal = $("#myBookingsModal");
      if (modal && modal.classList.contains("active")) {
        loadMyBookings({ silent: true });
      }
    });
    window.addEventListener("focus", function () {
      var modal = $("#myBookingsModal");
      if (modal && modal.classList.contains("active")) {
        loadMyBookings({ silent: true });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
