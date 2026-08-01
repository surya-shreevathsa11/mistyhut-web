/**
 * Shared helpers for booking request statuses + pay-on-approval (Razorpay).
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function normalizeStatus(booking) {
    return String((booking && booking.status) || "").toLowerCase().trim();
  }

  function getBookingId(booking) {
    if (!booking || typeof booking !== "object") return "";
    if (booking.bookingId != null) return String(booking.bookingId);
    if (booking.id != null) return String(booking.id);
    if (booking._id != null) return String(booking._id);
    return "";
  }

  function parseExpiresAt(booking) {
    var raw = booking && (booking.expiresAt || booking.paymentExpiresAt);
    if (!raw) return null;
    var d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  function isExpired(booking) {
    var d = parseExpiresAt(booking);
    if (!d) return false;
    return d.getTime() <= Date.now();
  }

  function isPayable(booking) {
    return normalizeStatus(booking) === "approved" && !isExpired(booking);
  }

  function statusLabel(status) {
    switch (String(status || "").toLowerCase()) {
      case "requested":
        return "Pending confirmation";
      case "approved":
        return "Approved — pay now";
      case "confirmed":
        return "Confirmed";
      case "rejected":
        return "Declined";
      case "cancelled":
        return "Cancelled";
      case "pending":
        return "Pending";
      default:
        return status || "Unknown";
    }
  }

  function statusMessage(booking) {
    var status = normalizeStatus(booking);
    var expires = parseExpiresAt(booking);
    if (status === "requested") {
      return "Request pending — waiting for property confirmation.";
    }
    if (status === "approved") {
      if (isExpired(booking)) {
        return "Payment window expired. Please submit a new booking request.";
      }
      if (expires) {
        return (
          "Approved — complete payment by " +
          expires.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }) +
          "."
        );
      }
      return "Approved — complete payment to confirm your stay.";
    }
    if (status === "rejected") {
      var reason =
        (booking && (booking.rejectionReason || booking.rejectReason)) || "";
      return reason
        ? "Request declined: " + String(reason)
        : "Request declined by the property.";
    }
    if (status === "confirmed") {
      return "Booking confirmed.";
    }
    if (status === "cancelled") {
      return "This booking was cancelled.";
    }
    return "";
  }

  function extractBookingsList(payload) {
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload.data)) return payload.data;
    if (payload.data && Array.isArray(payload.data.bookings))
      return payload.data.bookings;
    if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
    if (Array.isArray(payload.bookings)) return payload.bookings;
    return [];
  }

  function orderErrorMessage(status, data) {
    var msg =
      data && typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "";
    if (status === 410) {
      return (
        msg ||
        "Payment window expired. Please submit a new booking request from your cart."
      );
    }
    if (status === 400) {
      return (
        msg ||
        "This booking is not ready for payment yet. Wait for property confirmation."
      );
    }
    return msg || "Could not start payment. Please try again.";
  }

  /**
   * Pay for an approved booking: POST /payments/order { bookingId, ... } → Razorpay → verify.
   */
  function payForApprovedBooking(options) {
    options = options || {};
    var A = global.MistyApi;
    if (!A) {
      return Promise.reject(new Error("MistyApi missing"));
    }
    var bookingId = options.bookingId ? String(options.bookingId) : "";
    if (!bookingId) {
      return Promise.reject(new Error("bookingId is required"));
    }
    if (!global.Razorpay) {
      return Promise.reject(
        new Error(
          "Razorpay checkout script not loaded. Please refresh the page and try again.",
        ),
      );
    }

    var body = { bookingId: bookingId };
    if (options.prepaidOptionId) {
      body.prepaidOptionId = options.prepaidOptionId;
      body.selectedPrepaidId = options.prepaidOptionId;
    }
    if (
      options.prepaidPercent != null &&
      !Number.isNaN(Number(options.prepaidPercent))
    ) {
      body.prepaidPercent = Number(options.prepaidPercent);
    }

    return A.guestPaymentOrder(body)
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { status: res.status, data: data };
          });
      })
      .then(function (result) {
        var payload = result.data || {};
        var bookingData =
          payload.data && typeof payload.data === "object"
            ? payload.data
            : payload;

        if (
          !(result.status === 200 || result.status === 201) ||
          !bookingData ||
          !bookingData.razorpayOrderId ||
          !bookingData.key
        ) {
          var err = new Error(orderErrorMessage(result.status, payload));
          err.status = result.status;
          err.data = payload;
          throw err;
        }

        var payRupee =
          bookingData.expectedPrepaidAmount != null
            ? Number(bookingData.expectedPrepaidAmount)
            : Number(bookingData.totalAmount);
        if (isNaN(payRupee) || payRupee <= 0) {
          payRupee = Number(bookingData.totalAmount) || 0;
        }

        var prefill = options.prefill || {};

        return new Promise(function (resolve, reject) {
          var rzp = new global.Razorpay({
            key: bookingData.key,
            amount: Math.round(payRupee * 100),
            currency: "INR",
            order_id: bookingData.razorpayOrderId,
            name: "Misty Hut",
            description: "Room Booking",
            prefill: {
              name: prefill.name || "",
              email: prefill.email || "",
              contact: prefill.phone || prefill.contact || "",
            },
            handler: function (response) {
              A.guestPaymentVerify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              })
                .then(function (res) {
                  return res.json().catch(function () {
                    return {};
                  });
                })
                .then(function (data) {
                  if (data && data.success) {
                    if (typeof options.onSuccess === "function") {
                      options.onSuccess(data, response);
                    }
                    resolve(data);
                  } else {
                    var verifyErr = new Error(
                      "Payment verification failed. Please contact support with your payment ID: " +
                        response.razorpay_payment_id,
                    );
                    if (typeof options.onError === "function") {
                      options.onError(verifyErr);
                    }
                    reject(verifyErr);
                  }
                })
                .catch(function (e) {
                  var netErr = new Error(
                    "Could not verify payment. Please contact support with your payment ID: " +
                      response.razorpay_payment_id,
                  );
                  if (typeof options.onError === "function") {
                    options.onError(netErr);
                  }
                  reject(e || netErr);
                });
            },
            modal: {
              ondismiss: function () {
                if (typeof options.onDismiss === "function") options.onDismiss();
                reject(new Error("Payment dismissed"));
              },
            },
          });

          rzp.on("payment.failed", function (response) {
            var failErr = new Error(
              "Payment failed: " +
                ((response &&
                  response.error &&
                  response.error.description) ||
                  "Please try again."),
            );
            if (typeof options.onError === "function") {
              options.onError(failErr);
            }
            reject(failErr);
          });

          rzp.open();
        });
      });
  }

  function renderBookingCardHtml(booking) {
    var rooms = (booking && booking.rooms) || [];
    var roomsSummary = rooms
      .map(function (r) {
        return r.roomName || r.roomId || "—";
      })
      .join(", ");
    var checkIn =
      rooms[0] && rooms[0].checkIn
        ? new Date(rooms[0].checkIn).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    var checkOut =
      rooms[0] && rooms[0].checkOut
        ? new Date(rooms[0].checkOut).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    var status = normalizeStatus(booking);
    var guestName =
      booking && booking.guest && booking.guest.name
        ? booking.guest.name
        : "—";
    var bookingId = getBookingId(booking);
    var msg = statusMessage(booking);
    var payable = isPayable(booking);
    var payBtn = payable
      ? '<button type="button" class="btn btn--primary btn--sm my-bookings__pay" data-pay-booking="' +
        escapeHtml(bookingId) +
        '">Pay now</button>'
      : "";

    return (
      '<div class="my-bookings__item my-bookings__item--' +
      escapeHtml(status) +
      '" data-booking-id="' +
      escapeHtml(bookingId) +
      '" data-booking-status="' +
      escapeHtml(status) +
      '">' +
      '<span class="my-bookings__guest">' +
      escapeHtml(guestName) +
      "</span>" +
      '<span class="my-bookings__rooms">' +
      escapeHtml(roomsSummary) +
      "</span>" +
      '<span class="my-bookings__dates">' +
      escapeHtml(checkIn) +
      " – " +
      escapeHtml(checkOut) +
      "</span>" +
      '<span class="my-bookings__total">₹' +
      (booking.totalAmount != null
        ? Number(booking.totalAmount).toLocaleString("en-IN")
        : "0") +
      "</span>" +
      '<span class="my-bookings__status my-bookings__status--' +
      escapeHtml(status) +
      '">' +
      escapeHtml(statusLabel(status)) +
      "</span>" +
      (msg
        ? '<p class="my-bookings__msg">' + escapeHtml(msg) + "</p>"
        : "") +
      (payBtn ? '<div class="my-bookings__actions">' + payBtn + "</div>" : "") +
      "</div>"
    );
  }

  global.MistyBookingFlow = {
    escapeHtml: escapeHtml,
    normalizeStatus: normalizeStatus,
    getBookingId: getBookingId,
    parseExpiresAt: parseExpiresAt,
    isExpired: isExpired,
    isPayable: isPayable,
    statusLabel: statusLabel,
    statusMessage: statusMessage,
    extractBookingsList: extractBookingsList,
    orderErrorMessage: orderErrorMessage,
    payForApprovedBooking: payForApprovedBooking,
    renderBookingCardHtml: renderBookingCardHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
