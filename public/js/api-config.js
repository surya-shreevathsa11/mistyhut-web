/**
 * Central API (api.md) — set origin before other scripts, e.g. in HTML:
 *   <script>window.__MISTY_API_BASE__ = "http://localhost:3000";</script>
 */
(function (global) {
  "use strict";

  var DEFAULT_BASE = "http://localhost:3000";
  var PROPERTY_SLUG = "misty-hut";
  var TOKEN_KEY = "misty_guest_jwt";
  var USER_KEY = "misty_guest_user";

  function base() {
    var b = global.__MISTY_API_BASE__;
    if (b && typeof b === "string") return b.replace(/\/+$/, "");
    return DEFAULT_BASE;
  }

  function url(path) {
    var p = path.charAt(0) === "/" ? path : "/" + path;
    return base() + p;
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function setSession(token, userObj) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
      if (userObj) localStorage.setItem(USER_KEY, JSON.stringify(userObj));
      else localStorage.removeItem(USER_KEY);
    } catch (_) {}
  }

  function getStoredUser() {
    try {
      var s = localStorage.getItem(USER_KEY);
      return s ? JSON.parse(s) : null;
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    setSession(null, null);
  }

  function fetchNoAuth(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    if (
      options.body &&
      typeof options.body === "string" &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(url(path), {
      credentials: "omit",
      mode: "cors",
      ...options,
      headers: headers,
    });
  }

  /**
   * Fetch against central API. Adds Authorization when token exists.
   * Guest routes use Bearer only (no cookies).
   */
  function apiFetch(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    var tok = getToken();
    if (tok && !headers.Authorization) {
      headers.Authorization = "Bearer " + tok;
    }
    if (
      options.body &&
      typeof options.body === "string" &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }
    return fetch(url(path), {
      credentials: "omit",
      mode: "cors",
      ...options,
      headers: headers,
    });
  }

  /** Public — no auth */
  function publicRooms() {
    return fetchNoAuth(
      "/api/public/properties/" + encodeURIComponent(PROPERTY_SLUG) + "/rooms",
      { method: "GET" },
    );
  }

  function publicQuote(body) {
    return fetchNoAuth(
      "/api/public/properties/" + encodeURIComponent(PROPERTY_SLUG) + "/quote",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  /** Guest auth */
  function requestPin(body) {
    return fetchNoAuth("/api/guest-auth/request-pin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function verifyPin(body) {
    return fetchNoAuth("/api/guest-auth/verify-pin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /** Guest — Bearer */
  function guestQuote(body) {
    return apiFetch("/api/guest/bookings/quote", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function guestRooms() {
    return apiFetch("/api/guest/bookings/rooms", { method: "GET" });
  }

  function guestCartGet() {
    return apiFetch("/api/guest/bookings/cart", { method: "GET" });
  }

  function guestCartAdd(body) {
    return apiFetch("/api/guest/bookings/cart/items", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function guestCartRemove(body) {
    return apiFetch("/api/guest/bookings/cart/items", {
      method: "DELETE",
      body: JSON.stringify(body),
    });
  }

  function guestBookingsList() {
    return apiFetch("/api/guest/bookings", { method: "GET" });
  }

  function guestPaymentOrder(body) {
    return apiFetch("/api/guest/payments/order", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function guestPaymentVerify(body) {
    return apiFetch("/api/guest/payments/verify", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  global.MistyApi = {
    base: base,
    url: url,
    propertySlug: PROPERTY_SLUG,
    getToken: getToken,
    setSession: setSession,
    getStoredUser: getStoredUser,
    clearSession: clearSession,
    apiFetch: apiFetch,
    publicRooms: publicRooms,
    publicQuote: publicQuote,
    requestPin: requestPin,
    verifyPin: verifyPin,
    guestQuote: guestQuote,
    guestRooms: guestRooms,
    guestCartGet: guestCartGet,
    guestCartAdd: guestCartAdd,
    guestCartRemove: guestCartRemove,
    guestBookingsList: guestBookingsList,
    guestPaymentOrder: guestPaymentOrder,
    guestPaymentVerify: guestPaymentVerify,
  };
})(typeof window !== "undefined" ? window : globalThis);
