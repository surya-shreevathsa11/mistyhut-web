/**
 * Central API (api.md).
 * Uses DEFAULT_BASE only merge it
 */
(function (global) {
  "use strict";

  var DEFAULT_BASE =
    (typeof global.__MISTY_API_BASE__ === "string" &&
    global.__MISTY_API_BASE__.trim()
      ? global.__MISTY_API_BASE__.trim()
      : "https://api.varalabs.in");
  var GOOGLE_CLIENT_ID =
    typeof global.__MISTY_GOOGLE_CLIENT_ID__ === "string" &&
    global.__MISTY_GOOGLE_CLIENT_ID__.trim()
      ? global.__MISTY_GOOGLE_CLIENT_ID__.trim()
      : "";
  var PROPERTY_SLUG = "misty-hut";
  var TOKEN_KEY = "misty_guest_jwt";
  var USER_KEY = "misty_guest_user";

  function base() {
    return DEFAULT_BASE;
  }

  function getGoogleClientId() {
    return GOOGLE_CLIENT_ID;
  }

  /** Pull guest JWT from Vara guest-auth success payloads. */
  function extractGuestAuthToken(payload) {
    if (!payload || typeof payload !== "object") return null;
    var nested =
      payload.data && typeof payload.data === "object" ? payload.data : null;
    if (typeof payload.token === "string" && payload.token) return payload.token;
    if (typeof payload.accessToken === "string" && payload.accessToken)
      return payload.accessToken;
    if (nested && typeof nested.token === "string" && nested.token)
      return nested.token;
    if (nested && typeof nested.accessToken === "string" && nested.accessToken)
      return nested.accessToken;
    return null;
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

  /** Guest auth — Google Identity Services credential → Vara JWT */
  function googleSignIn(credential) {
    return fetchNoAuth("/api/guest-auth/google", {
      method: "POST",
      body: JSON.stringify({
        propertySlug: PROPERTY_SLUG,
        credential: credential,
      }),
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

  /**
   * Submit cart as a booking request (no Razorpay).
   * Body: { name, email, phone }
   */
  function guestBookingRequest(body) {
    return apiFetch("/api/guest/bookings/requests", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Create Razorpay order for an approved booking.
   * Body: { bookingId, prepaidOptionId?, prepaidPercent? }
   * Do not send name/email/phone or rely on cart.
   */
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

  /** Public quote if logged out, guest quote if Bearer token present. */
  function quoteRoom(body) {
    return getToken() ? guestQuote(body) : publicQuote(body);
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
    getGoogleClientId: getGoogleClientId,
    extractGuestAuthToken: extractGuestAuthToken,
    googleSignIn: googleSignIn,
    guestQuote: guestQuote,
    guestRooms: guestRooms,
    guestCartGet: guestCartGet,
    guestCartAdd: guestCartAdd,
    guestCartRemove: guestCartRemove,
    guestBookingsList: guestBookingsList,
    guestBookingRequest: guestBookingRequest,
    guestPaymentOrder: guestPaymentOrder,
    guestPaymentVerify: guestPaymentVerify,
    quoteRoom: quoteRoom,
  };
})(typeof window !== "undefined" ? window : globalThis);
