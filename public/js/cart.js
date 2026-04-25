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
          return { ok: res.ok, unauthorized: res.status === 401 };
        });
      })
      .catch(function () {
        serverCart = [];
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
    if (totalEl) totalEl.textContent = "₹" + total;
    updateNavCartCount(serverCart.length);
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
    var container = $("#checkoutPrepaid");
    var P = window.MistyPrepaid;
    var name = $("#checkoutName") ? $("#checkoutName").value.trim() : "";
    var email = $("#checkoutEmail") ? $("#checkoutEmail").value.trim() : "";
    var phone = $("#checkoutPhone") ? $("#checkoutPhone").value.trim() : "";
    var detailsFilled = !!(name && email && phone);
    if (!P || !detailsFilled) {
      if (container) {
        container.innerHTML = "";
        container.hidden = true;
      }
      if (hint) {
        hint.textContent = detailsFilled
          ? ""
          : "Fill full name, email and phone to choose advance payment option.";
      }
      return Promise.resolve();
    }
    if (!A || !serverCart.length) {
      if (container) {
        container.innerHTML = "";
        container.hidden = true;
      }
      if (hint) hint.textContent = "No rooms selected yet.";
      return Promise.resolve();
    }
    if (hint) hint.textContent = "Loading payment options…";
    var first = serverCart[0];
    return A.quoteRoom({
      roomId: first.roomId,
      checkIn: formatDate(first.checkIn),
      checkOut: formatDate(first.checkOut),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (hint) hint.textContent = "";
        if (!result.ok || !P) {
          if (hint) {
            hint.textContent =
              "Could not refresh payment options. Please try again.";
          }
          if (container) {
            container.innerHTML = "";
            container.hidden = true;
          }
          return;
        }
        var norm = P.normalizeFromQuote(result.data);
        P.render(container, norm, {
          name: "misty-prepaid-checkout",
          legend: "Payment option",
        });
        try {
          var sid = sessionStorage.getItem("misty_checkout_prepaidOptionId");
          if (sid && container) {
            container.querySelectorAll('input[type="radio"]').forEach(function (radio) {
              if (radio.value === sid) radio.checked = true;
            });
          }
        } catch (_) {}
      })
      .catch(function () {
        if (hint) {
          hint.textContent = "Could not load payment options. Please try again.";
        }
        if (container) {
          container.innerHTML = "";
          container.hidden = true;
        }
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
    var errEl = $("#signInError");
    var stepEmail = $("#signInStepEmail");
    var stepPin = $("#signInStepPin");
    var sendBtn = $("#signInSendPin");
    var verifyBtn = $("#signInVerifyPin");
    var backBtn = $("#signInBackEmail");
    if (!sendBtn || !stepEmail || !stepPin || !A) return;

    function showEmailStep() {
      if (errEl) errEl.textContent = "";
      stepEmail.style.display = "";
      stepPin.style.display = "none";
    }

    function showPinStep() {
      if (errEl) errEl.textContent = "";
      stepEmail.style.display = "none";
      stepPin.style.display = "";
      var pinInput = $("#signInPin");
      if (pinInput) pinInput.focus();
    }

    sendBtn.addEventListener("click", function () {
      if (errEl) errEl.textContent = "";
      var name = ($("#signInName") && $("#signInName").value.trim()) || "";
      var email = ($("#signInEmail") && $("#signInEmail").value.trim()) || "";
      if (!email) {
        if (errEl) errEl.textContent = "Please enter your email.";
        return;
      }
      sendBtn.disabled = true;
      A.requestPin({
        propertySlug: A.propertySlug,
        email: email,
        name: name || email.split("@")[0],
      })
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
            if (errEl)
              errEl.textContent =
                (result.data && result.data.message) || "Could not send code.";
            return;
          }
          showPinStep();
        })
        .catch(function () {
          if (errEl) errEl.textContent = "Network error. Try again.";
        })
        .finally(function () {
          sendBtn.disabled = false;
        });
    });

    if (verifyBtn) {
      verifyBtn.addEventListener("click", function () {
        if (errEl) errEl.textContent = "";
        var name = ($("#signInName") && $("#signInName").value.trim()) || "";
        var email = ($("#signInEmail") && $("#signInEmail").value.trim()) || "";
        var pin = ($("#signInPin") && $("#signInPin").value.trim()) || "";
        if (!pin) {
          if (errEl) errEl.textContent = "Enter the code from your email.";
          return;
        }
        verifyBtn.disabled = true;
        A.verifyPin({
          propertySlug: A.propertySlug,
          email: email,
          name: name || undefined,
          pin: pin,
        })
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
            if (
              !result.ok ||
              !result.data ||
              !result.data.success ||
              !result.data.token
            ) {
              if (errEl)
                errEl.textContent =
                  (result.data && result.data.message) || "Invalid code.";
              return;
            }
            A.setSession(result.data.token, result.data.guest);
            currentUser = result.data.guest;
            updateAuthUI();
            closeModal("#signInModal");
            showEmailStep();
            fetchCart().then(function () {
              renderCartList();
              loadCheckoutPrepaidOptions();
            });
          })
          .catch(function () {
            if (errEl) errEl.textContent = "Network error. Try again.";
          })
          .finally(function () {
            verifyBtn.disabled = false;
          });
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", showEmailStep);
    }
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
        var prep = window.MistyPrepaid
          ? window.MistyPrepaid.getSelected(
              $("#checkoutPrepaid"),
              "misty-prepaid-checkout",
            )
          : null;
        if (!prep || !prep.prepaidOptionId) {
          errEl.textContent = "Please choose a payment option.";
          loadCheckoutPrepaidOptions();
          return;
        }
        openTermsModal();
      });
      ["#checkoutName", "#checkoutEmail", "#checkoutPhone"].forEach(function (sel) {
        var field = $(sel);
        if (!field) return;
        field.addEventListener("input", function () {
          loadCheckoutPrepaidOptions();
        });
        field.addEventListener("change", function () {
          loadCheckoutPrepaidOptions();
        });
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

        var orderBody = {
          name: name,
          email: email,
          phone: phone,
        };
        var P = window.MistyPrepaid;
        var prep = P
          ? P.getSelected($("#checkoutPrepaid"), "misty-prepaid-checkout")
          : null;
        if (prep && prep.prepaidOptionId) {
          orderBody.prepaidOptionId = prep.prepaidOptionId;
          if (
            prep.prepaidPercent != null &&
            !Number.isNaN(prep.prepaidPercent)
          ) {
            orderBody.prepaidPercent = prep.prepaidPercent;
          }
        } else {
          try {
            var sid = sessionStorage.getItem("misty_checkout_prepaidOptionId");
            if (sid) orderBody.prepaidOptionId = sid;
            var sp = sessionStorage.getItem("misty_checkout_prepaidPercent");
            if (sp) orderBody.prepaidPercent = Number(sp);
          } catch (_) {}
        }

        A.guestPaymentOrder(orderBody)
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, data: data };
            });
          })
          .then(function (result) {
            if (
              result.status === 201 &&
              result.data &&
              result.data.data &&
              result.data.data.razorpayOrderId &&
              result.data.data.key
            ) {
              closeTermsModal();

              if (!window.Razorpay) {
                alert(
                  "Razorpay checkout script not loaded. Please refresh the page and try again."
                );
                termsProceedBtn.disabled = false;
                return;
              }

              var bookingData = result.data.data;
              var payRupee =
                bookingData.expectedPrepaidAmount != null
                  ? Number(bookingData.expectedPrepaidAmount)
                  : Number(bookingData.totalAmount);
              if (isNaN(payRupee) || payRupee <= 0) payRupee = Number(bookingData.totalAmount) || 0;

              var options = {
                key: bookingData.key,
                amount: Math.round(payRupee * 100), // paise
                currency: "INR",
                order_id: bookingData.razorpayOrderId,
                name: "Misty Hut",
                description: "Room Booking",
                prefill: {
                  name: name,
                  email: email,
                  contact: phone,
                },

                // ✅ Called by Razorpay on successful payment
                handler: function (response) {
                  A.guestPaymentVerify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  })
                    .then(function (res) {
                      return res.json();
                    })
                    .then(function (data) {
                      if (data.success) {
                        // Clear cart then redirect to success page
                        window.location.href = "/?payment=success";
                      } else {
                        alert(
                          "Payment verification failed. Please contact support with your payment ID: " +
                            response.razorpay_payment_id
                        );
                        termsProceedBtn.disabled = false;
                      }
                    })
                    .catch(function () {
                      alert(
                        "Could not verify payment. Please contact support with your payment ID: " +
                          response.razorpay_payment_id
                      );
                      termsProceedBtn.disabled = false;
                    });
                },

                modal: {
                  // User closed modal without paying — re-enable button
                  ondismiss: function () {
                    termsProceedBtn.disabled = false;
                  },
                },
              };

              var rzp = new window.Razorpay(options);

              // Handle payment failure inside the modal (e.g. wrong card)
              rzp.on("payment.failed", function (response) {
                console.error("Payment failed:", response.error);
                alert(
                  "Payment failed: " +
                    (response.error.description || "Please try again.")
                );
                termsProceedBtn.disabled = false;
              });

              rzp.open();
            } else {
              alert(
                result.data.message ||
                  "Could not create payment order. Please try again."
              );
              termsProceedBtn.disabled = false;
            }
          })
          .catch(function () {
            alert("Something went wrong. Please try again.");
            termsProceedBtn.disabled = false;
          });
      });
    }

    $$("[data-close-terms]").forEach(function (el) {
      el.addEventListener("click", closeTermsModal);
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
