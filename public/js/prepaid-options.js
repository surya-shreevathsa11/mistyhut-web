/**
 * Dual prepaid options UI (central API: prepaidOptions[], primaryPrepaidOptionId).
 * Depends on nothing except DOM.
 */
(function (global) {
  "use strict";

  function toNumberOrNull(value) {
    var n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  function pickFirstTruthy() {
    for (var i = 0; i < arguments.length; i += 1) {
      if (arguments[i]) return arguments[i];
    }
    return null;
  }

  function normalizeOption(raw, fallbackId) {
    if (!raw || typeof raw !== "object") return null;
    var id = pickFirstTruthy(
      raw.id,
      raw.prepaidOptionId,
      raw.prepaid_option_id,
      fallbackId,
    );
    if (!id) return null;
    return {
      id: String(id),
      label: raw.label || raw.name || raw.title || "Payment Plan",
      percent: toNumberOrNull(
        raw.percent != null ? raw.percent : raw.prepaidPercent,
      ),
      prepaidAmount: toNumberOrNull(
        raw.prepaidAmount != null ? raw.prepaidAmount : raw.amount,
      ),
      refundAvailable: Boolean(
        raw.refundAvailable || raw.refund_available || raw.refundEligible,
      ),
      isPrimary: Boolean(raw.isPrimary),
    };
  }

  function normalizeFromCart(data) {
    if (!data || typeof data !== "object") {
      return { options: [], primaryId: null, legacy: true };
    }

    var topLevelOptions = Array.isArray(data.prepaidOptions)
      ? data.prepaidOptions
      : null;
    if (topLevelOptions && topLevelOptions.length) {
      var mapped = topLevelOptions
        .map(function (opt, idx) {
          return normalizeOption(opt, String(idx));
        })
        .filter(Boolean);
      if (mapped.length) {
        var primaryOption = mapped.find(function (opt) {
          return opt.isPrimary;
        });
        return {
          options: mapped,
          primaryId: primaryOption
            ? primaryOption.id
            : data.primaryPrepaidOptionId || mapped[0].id,
          legacy: false,
        };
      }
    }

    var lower = toNumberOrNull(data.lowerPayableTotal);
    var upper = toNumberOrNull(data.upperPayableTotal);
    if (lower != null || upper != null) {
      var lowerPct = toNumberOrNull(data.lowerPercent);
      var upperPct = toNumberOrNull(data.upperPercent);
      var options = [];
      if (lower != null) {
        options.push({
          id: "standard",
          label: "Standard",
          percent: lowerPct,
          prepaidAmount: lower,
          refundAvailable: false,
          isPrimary: false,
        });
      }
      if (upper != null) {
        options.push({
          id: "primary",
          label: "Primary",
          percent: upperPct,
          prepaidAmount: upper,
          refundAvailable: true,
          isPrimary: true,
        });
      }
      if (options.length) {
        return {
          options: options,
          primaryId: options[options.length - 1].id,
          legacy: false,
        };
      }
    }

    var fromRooms = Array.isArray(data.roomInfo) ? data.roomInfo : [];
    if (fromRooms.length) {
      var byId = {};
      fromRooms.forEach(function (room) {
        var roomOptions = Array.isArray(room.prepaidOptions) ? room.prepaidOptions : [];
        roomOptions.forEach(function (opt, idx) {
          var normalized = normalizeOption(opt, String(idx));
          if (!normalized) return;
          if (!byId[normalized.id]) {
            byId[normalized.id] = {
              id: normalized.id,
              label: normalized.label,
              percent: normalized.percent,
              prepaidAmount: 0,
              refundAvailable: normalized.refundAvailable,
              isPrimary: normalized.isPrimary,
            };
          }
          if (normalized.prepaidAmount != null) {
            byId[normalized.id].prepaidAmount += normalized.prepaidAmount;
          }
          if (byId[normalized.id].percent == null && normalized.percent != null) {
            byId[normalized.id].percent = normalized.percent;
          }
          if (normalized.isPrimary) byId[normalized.id].isPrimary = true;
          if (normalized.refundAvailable) byId[normalized.id].refundAvailable = true;
        });
      });
      var merged = Object.keys(byId).map(function (k) {
        return byId[k];
      });
      if (merged.length) {
        var prim = merged.find(function (opt) {
          return opt.isPrimary;
        });
        return {
          options: merged,
          primaryId: prim ? prim.id : merged[0].id,
          legacy: false,
        };
      }
    }

    return normalizeFromQuote(data);
  }

  function normalizeFromQuote(data) {
    if (!data || typeof data !== "object") {
      return { options: [], primaryId: null, legacy: true };
    }
    var raw =
      data.prepaidOptions ||
      data.prepaid_options ||
      (Array.isArray(data.prepaidOption) ? data.prepaidOption : null);
    var primary =
      data.primaryPrepaidOptionId ||
      data.primary_prepaid_option_id ||
      null;

    if (Array.isArray(raw) && raw.length > 0) {
      var options = raw
        .map(function (o, i) {
          return normalizeOption(o, String(i));
        })
        .filter(Boolean);
      var primaryResolved =
        primary != null
          ? String(primary)
          : options[0]
            ? options[0].id
            : null;
      return {
        options: options,
        primaryId: primaryResolved,
        legacy: false,
      };
    }

    // Legacy single-line prepay
    var legPct =
      data.bookingPrepaidPercent != null
        ? Number(data.bookingPrepaidPercent)
        : null;
    var legAmt =
      data.prepaidAmount != null ? Number(data.prepaidAmount) : null;
    if (legPct != null && !Number.isNaN(legPct)) {
      return {
        options: [
          {
            id: "primary",
            label: "Prepayment",
            percent: legPct,
            prepaidAmount: legAmt != null && !Number.isNaN(legAmt) ? legAmt : null,
            refundAvailable: false,
          },
        ],
        primaryId: "primary",
        legacy: true,
      };
    }

    return { options: [], primaryId: null, legacy: true };
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function buildPlanPresentation(opt, ctx) {
    var pct = opt && opt.percent != null && !Number.isNaN(opt.percent)
      ? Number(opt.percent)
      : null;
    var hasDistinctPercents = ctx.minPercent != null && ctx.maxPercent != null && ctx.minPercent !== ctx.maxPercent;
    var isMinPlan = hasDistinctPercents && pct != null && pct === ctx.minPercent;
    var isMaxPlan = hasDistinctPercents && pct != null && pct === ctx.maxPercent;

    // Global policy:
    // - Lower percent plan: Saver Plan + Non-refundable
    // - Higher percent plan: Flexi Plan + Free cancellation (15 days)
    // If percent ordering is not available, fallback to backend refund flag.
    var isFlexi = isMaxPlan || (!hasDistinctPercents && Boolean(opt.refundAvailable));
    var isSaver = isMinPlan || (!hasDistinctPercents && !Boolean(opt.refundAvailable));

    var title = opt.label || "Payment Plan";
    if (isSaver && !isFlexi) title = "Saver Plan";
    if (isFlexi) title = "Flexi Plan";

    var policyText = isFlexi
      ? "Free cancellation up to 15 days before check-in"
      : "Non-refundable";

    return {
      title: title,
      policyText: policyText,
    };
  }

  function render(container, normalized, opts) {
    opts = opts || {};
    var name = opts.name || "misty-prepaid";
    var legendText = opts.legend || "Payment option";

    if (!container) return;

    container.innerHTML = "";
    container.hidden = true;
    container.classList.add("prepaid-options-wrap");

    var list = normalized && normalized.options ? normalized.options : [];
    if (!list.length) {
      return;
    }

    var primaryId =
      normalized.primaryId ||
      (list[0] ? list[0].id : null);
    var numericPercents = list
      .map(function (opt) {
        return opt && opt.percent != null && !Number.isNaN(opt.percent)
          ? Number(opt.percent)
          : null;
      })
      .filter(function (v) {
        return v != null;
      });
    var minPercent = numericPercents.length ? Math.min.apply(null, numericPercents) : null;
    var maxPercent = numericPercents.length ? Math.max.apply(null, numericPercents) : null;

    var fieldset = document.createElement("fieldset");
    fieldset.className = "prepaid-options";
    var leg = document.createElement("legend");
    leg.className = "prepaid-options__legend";
    leg.textContent = legendText;
    fieldset.appendChild(leg);

    list.forEach(function (opt) {
      var id = opt.id;
      var inputId = name + "-" + id.replace(/[^a-zA-Z0-9_-]/g, "_");
      var label = document.createElement("label");
      label.className = "prepaid-options__card";
      label.htmlFor = inputId;

      var input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.id = inputId;
      input.value = id;
      input.checked = primaryId != null && String(id) === String(primaryId);
      if (opt.percent != null && !Number.isNaN(opt.percent)) {
        input.setAttribute("data-prepaid-percent", String(opt.percent));
      }

      var title = document.createElement("span");
      title.className = "prepaid-options__title";
      var plan = buildPlanPresentation(opt, {
        minPercent: minPercent,
        maxPercent: maxPercent,
      });
      title.textContent = plan.title;

      var meta = document.createElement("span");
      meta.className = "prepaid-options__meta";
      var parts = [];
      if (opt.percent != null && !Number.isNaN(opt.percent)) {
        parts.push(opt.percent + "% prepaid");
      }
      if (opt.prepaidAmount != null && !Number.isNaN(opt.prepaidAmount)) {
        parts.push("₹" + opt.prepaidAmount.toLocaleString("en-IN"));
      }
      parts.push(plan.policyText);
      meta.textContent = parts.join(" · ");

      var amount = document.createElement("span");
      amount.className = "prepaid-options__amount";
      amount.textContent =
        opt.prepaidAmount != null && !Number.isNaN(opt.prepaidAmount)
          ? "Pay now: ₹" + Number(opt.prepaidAmount).toLocaleString("en-IN")
          : "";

      label.appendChild(input);
      label.appendChild(title);
      label.appendChild(meta);
      if (amount.textContent) {
        label.appendChild(amount);
      }
      fieldset.appendChild(label);
    });

    container.appendChild(fieldset);
    fieldset.addEventListener("change", function (event) {
      var target = event.target;
      if (!target || target.type !== "radio") return;
      try {
        sessionStorage.setItem("misty_checkout_prepaidOptionId", target.value);
        var p = target.getAttribute("data-prepaid-percent");
        if (p != null && p !== "") {
          sessionStorage.setItem("misty_checkout_prepaidPercent", String(p));
        }
      } catch (_) {}
    });
    try {
      var preselected = fieldset.querySelector('input[type="radio"]:checked');
      if (preselected) {
        sessionStorage.setItem("misty_checkout_prepaidOptionId", preselected.value);
        var pp = preselected.getAttribute("data-prepaid-percent");
        if (pp != null && pp !== "") {
          sessionStorage.setItem("misty_checkout_prepaidPercent", String(pp));
        }
      }
    } catch (_) {}
    container.hidden = false;
  }

  function getSelected(container, name) {
    if (!container) return null;
    var sel = container.querySelector(
      'input[type="radio"][name="' + name + '"]:checked',
    );
    if (!sel) return null;
    var pct = sel.getAttribute("data-prepaid-percent");
    return {
      prepaidOptionId: sel.value,
      prepaidPercent:
        pct != null && pct !== "" ? Number(pct) : undefined,
    };
  }

  global.MistyPrepaid = {
    normalizeFromCart: normalizeFromCart,
    normalizeFromQuote: normalizeFromQuote,
    render: render,
    getSelected: getSelected,
  };
})(typeof window !== "undefined" ? window : globalThis);
