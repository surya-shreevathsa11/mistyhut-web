/**
 * Dual prepaid options UI (central API: prepaidOptions[], primaryPrepaidOptionId).
 * Depends on nothing except DOM.
 */
(function (global) {
  "use strict";

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
      var options = raw.map(function (o, i) {
        var id =
          o.id ||
          o.prepaidOptionId ||
          o.prepaid_option_id ||
          String(i);
        return {
          id: String(id),
          label: o.label || o.name || o.title || "Option",
          percent:
            o.percent != null
              ? Number(o.percent)
              : o.prepaidPercent != null
                ? Number(o.prepaidPercent)
                : null,
          prepaidAmount:
            o.prepaidAmount != null
              ? Number(o.prepaidAmount)
              : o.amount != null
                ? Number(o.amount)
                : null,
          refundAvailable: Boolean(
            o.refundAvailable ||
              o.refund_available ||
              o.refundEligible,
          ),
        };
      });
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

      label.appendChild(input);
      label.appendChild(title);
      label.appendChild(meta);
      fieldset.appendChild(label);
    });

    container.appendChild(fieldset);
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
    normalizeFromQuote: normalizeFromQuote,
    render: render,
    getSelected: getSelected,
  };
})(typeof window !== "undefined" ? window : globalThis);
