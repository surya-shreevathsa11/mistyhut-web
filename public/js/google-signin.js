/**
 * Google Identity Services (GIS) for Misty Hut guest sign-in.
 * Mirrors bb-estate-stay useGuestAuth / loadGoogleIdentityServices pattern.
 * Exchanges credential via MistyApi.googleSignIn → POST /api/guest-auth/google.
 */
(function (global) {
  "use strict";

  var SCRIPT_SRC = "https://accounts.google.com/gsi/client";
  var loadPromise = null;

  function finishLoad(resolve, reject) {
    if (global.google && global.google.accounts && global.google.accounts.id) {
      resolve(global.google);
      return;
    }
    reject(new Error("Google Identity Services failed to initialize."));
  }

  function loadGIS() {
    if (global.google && global.google.accounts && global.google.accounts.id) {
      return Promise.resolve(global.google);
    }
    if (loadPromise) return loadPromise;

    var existing = document.querySelector('script[src="' + SCRIPT_SRC + '"]');
    if (existing) {
      loadPromise = new Promise(function (resolve, reject) {
        var onLoad = function () {
          existing.dataset.loaded = "true";
          finishLoad(resolve, reject);
        };
        if (existing.dataset.loaded === "true") {
          finishLoad(resolve, reject);
          return;
        }
        existing.addEventListener("load", onLoad, { once: true });
        existing.addEventListener(
          "error",
          function () {
            loadPromise = null;
            reject(new Error("Failed to load Google Identity Services."));
          },
          { once: true },
        );
      });
      return loadPromise;
    }

    loadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        script.dataset.loaded = "true";
        finishLoad(resolve, reject);
      };
      script.onerror = function () {
        loadPromise = null;
        reject(new Error("Failed to load Google Identity Services."));
      };
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  function decodeJwtPayload(jwt) {
    try {
      var part = String(jwt || "").split(".")[1];
      if (!part) return null;
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64.length % 4;
      if (pad) b64 += "====".slice(0, 4 - pad);
      return JSON.parse(atob(b64));
    } catch (_) {
      return null;
    }
  }

  /**
   * @param {{ onSuccess?: function(guest: object, token: string): void }} opts
   */
  function wireSignInModal(opts) {
    opts = opts || {};
    var A = global.MistyApi;
    var modal = document.getElementById("signInModal");
    var btnWrap = document.getElementById("signInGoogleBtn");
    var errEl = document.getElementById("signInError");
    var statusEl = document.getElementById("signInGoogleStatus");
    if (!modal || !btnWrap || !A) return;

    var busy = false;

    function setError(msg) {
      if (errEl) errEl.textContent = msg || "";
    }

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function onCredential(response) {
      if (!response || !response.credential) {
        setError("Google did not return a valid credential.");
        return;
      }
      if (busy) return;
      busy = true;
      setError("");
      setStatus("Signing in with Google…");
      btnWrap.setAttribute("aria-busy", "true");

      A.googleSignIn(response.credential)
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
          var token = A.extractGuestAuthToken(result.data);
          if (!result.ok || !token) {
            setError(
              (result.data && result.data.message) ||
                "Google sign-in failed. Please try again.",
            );
            return;
          }
          var guest =
            (result.data && result.data.guest) ||
            (result.data && result.data.data && result.data.data.guest) ||
            {};
          var claims = decodeJwtPayload(response.credential);
          if (claims) {
            if (!guest.name && claims.name) guest.name = claims.name;
            if (!guest.email && claims.email) guest.email = claims.email;
            var picture = (claims.picture || "").trim();
            if (picture) {
              guest.avatar = picture;
              guest.picture = picture;
            }
          }
          A.setSession(token, guest);
          setStatus("");
          if (typeof opts.onSuccess === "function") {
            opts.onSuccess(guest, token);
          }
        })
        .catch(function () {
          setError("Network error. Please check your connection.");
        })
        .finally(function () {
          busy = false;
          btnWrap.setAttribute("aria-busy", "false");
          setStatus("");
        });
    }

    function renderGoogleButton() {
      var clientId = A.getGoogleClientId();
      if (!clientId) {
        setError(
          "Google sign-in is not configured. Set __MISTY_GOOGLE_CLIENT_ID__.",
        );
        btnWrap.innerHTML = "";
        return;
      }
      setError("");
      loadGIS()
        .then(function (google) {
          btnWrap.innerHTML = "";
          google.accounts.id.initialize({
            client_id: clientId,
            callback: onCredential,
          });
          requestAnimationFrame(function () {
            if (!document.getElementById("signInGoogleBtn")) return;
            var w = btnWrap.offsetWidth;
            google.accounts.id.renderButton(btnWrap, {
              type: "standard",
              theme: "outline",
              size: "large",
              text: "signin_with",
              shape: "rectangular",
              width: Math.min(400, Math.max(w || 320, 280)),
            });
          });
        })
        .catch(function () {
          setError(
            "Could not load Google Sign-In. Check your connection and try again.",
          );
        });
    }

    function clearGoogleButton() {
      btnWrap.innerHTML = "";
      setStatus("");
      if (
        global.google &&
        global.google.accounts &&
        global.google.accounts.id
      ) {
        try {
          global.google.accounts.id.cancel();
        } catch (_) {}
      }
    }

    var observer = new MutationObserver(function () {
      if (modal.classList.contains("active")) {
        renderGoogleButton();
      } else {
        clearGoogleButton();
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ["class"] });

    if (modal.classList.contains("active")) {
      renderGoogleButton();
    }
  }

  global.MistyGoogleSignIn = {
    loadGIS: loadGIS,
    wireSignInModal: wireSignInModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
