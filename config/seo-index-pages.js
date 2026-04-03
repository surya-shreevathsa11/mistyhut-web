/**
 * Server-side SEO for index.html routes (/, /about, /rooms, /gallery, /contact).
 * Set PUBLIC_SITE_ORIGIN in production (e.g. https://example.com) — no trailing slash.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLACEHOLDER = "%%SEO_HEAD%%";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getOrigin() {
  const raw = process.env.PUBLIC_SITE_ORIGIN || "https://www.mistyhutstays.com";
  return raw.replace(/\/+$/, "");
}

function getPrimaryImage() {
  return (
    process.env.PUBLIC_PRIMARY_IMAGE_URL ||
    "https://www.mistyhutstays.com/images/hero.jpg"
  );
}

function getPhone() {
  return process.env.PUBLIC_BUSINESS_PHONE || "+918971425151";
}

function canonicalUrl(origin, pathname) {
  if (pathname === "/") return `${origin}/`;
  return `${origin}${pathname}`;
}

function buildSocialMeta({ title, description, canonical, imageUrl }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const c = escapeHtml(canonical);
  const i = escapeHtml(imageUrl);
  return [
    `<link rel="canonical" href="${c}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${c}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${i}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join("\n    ");
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj)}\n</script>`;
}

function buildHomeSchemas(origin, imageUrl, phone) {
  const lodging = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: "Misty Hut",
    description:
      "Peaceful homestay in Coorg near Madikeri located in Hulithala inside a coffee estate",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Hulithala near Madikeri, Kodagu",
      addressLocality: "Hulithala",
      addressRegion: "Karnataka",
      postalCode: "571201",
      addressCountry: "India",
    },
    areaServed: {
      "@type": "Place",
      name: "Kodagu",
    },
    url: `${origin}/`,
    image: imageUrl,
    telephone: phone,
    priceRange: "₹2000",
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Wifi",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Parking",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Meals on request",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Pet friendly",
        value: true,
      },
    ],
    geo: {
      "@type": "GeoCoordinates",
      latitude: 12.4244,
      longitude: 75.7382,
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Where is Misty Hut located?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Misty Hut is located in Hulithala near Madikeri in Kodagu, Karnataka, India.",
        },
      },
      {
        "@type": "Question",
        name: "What type of stay is Misty Hut?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Misty Hut is a homestay in Coorg set inside a coffee estate offering a peaceful and comfortable stay experience.",
        },
      },
      {
        "@type": "Question",
        name: "How can I book Misty Hut?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can book Misty Hut directly through the website using online payment.",
        },
      },
    ],
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${origin}/`,
      },
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Misty Hut",
    url: `${origin}/`,
  };

  const imageObject = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: imageUrl,
    name: "Misty Hut Homestay",
    description: "Coffee estate homestay in Coorg near Madikeri",
  };

  return [
    jsonLdScript(lodging),
    jsonLdScript(faq),
    jsonLdScript(breadcrumb),
    jsonLdScript(website),
    jsonLdScript(imageObject),
  ].join("\n    ");
}

const PAGE_META = {
  "/": {
    title: "Misty Hut Homestay in Coorg near Madikeri Coffee Estate Stay",
    description:
      "Stay at Misty Hut, a peaceful homestay in Coorg near Madikeri set inside a coffee estate with misty evenings, wifi, and meals on request.",
    includeJsonLd: true,
  },
  "/about": {
    title: "About Misty Hut Homestay in Coorg near Madikeri",
    description:
      "Learn about Misty Hut, a quiet homestay in Coorg near Madikeri surrounded by coffee estates and peaceful natural surroundings.",
    includeJsonLd: false,
  },
  "/rooms": {
    title: "Rooms at Misty Hut Homestay in Coorg near Madikeri",
    description:
      "Comfortable rooms at Misty Hut homestay in Coorg near Madikeri, ideal for couples, families, and groups in a coffee estate setting.",
    includeJsonLd: false,
  },
  "/gallery": {
    title: "Misty Hut Homestay Gallery Coorg near Madikeri",
    description:
      "View photos of Misty Hut homestay in Coorg near Madikeri, located inside a coffee estate with calm and scenic surroundings.",
    includeJsonLd: false,
  },
  "/contact": {
    title: "Contact Misty Hut Homestay in Coorg near Madikeri",
    description:
      "Get in touch with Misty Hut homestay in Coorg near Madikeri for bookings and directions to the property in Hulithala.",
    includeJsonLd: false,
  },
};

function getTemplate() {
  const indexPath = path.join(__dirname, "..", "public", "index.html");
  return fs.readFileSync(indexPath, "utf8");
}

export function renderIndexHtml(pathname) {
  const p = pathname === "/" ? "/" : pathname;
  const meta = PAGE_META[p];
  if (!meta) {
    return null;
  }

  const origin = getOrigin();
  const imageUrl = getPrimaryImage();
  const phone = getPhone();
  const canonical = canonicalUrl(origin, p);

  const parts = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="index, follow" />`,
    buildSocialMeta({
      title: meta.title,
      description: meta.description,
      canonical,
      imageUrl,
    }),
  ];

  if (meta.includeJsonLd) {
    parts.push(buildHomeSchemas(origin, imageUrl, phone));
  }

  const seoHead = parts.filter(Boolean).join("\n    ");

  const template = getTemplate();
  if (!template.includes(PLACEHOLDER)) {
    throw new Error("index.html missing %%SEO_HEAD%% placeholder");
  }
  return template.replace(PLACEHOLDER, seoHead);
}
