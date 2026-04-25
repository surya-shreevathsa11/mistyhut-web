/**
 * Production SEO renderer for Misty Hut Stays.
 *
 * Per-route <head> meta injection for index.html sub-routes
 * (/, /about, /rooms, /gallery, /contact) plus 5 JSON-LD rich-result
 * schemas emitted only on the homepage.
 *
 * Override DOMAIN at runtime with PUBLIC_SITE_ORIGIN if the deploy host changes.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLACEHOLDER = "%%SEO_HEAD%%";
const SEO_START_MARKER = "<!-- SEO_HEAD_START -->";
const SEO_END_MARKER = "<!-- SEO_HEAD_END -->";

const BUSINESS_NAME = "Misty Hut Stays";
const BUSINESS_DESCRIPTION =
  "Tucked away in a coffee estate near Madikeri, Misty Hut offers a stay shaped by stillness, fresh air, and quiet surroundings. As the day slows, a gentle mist settles across the landscape, giving each evening a calm and unspoken charm. Designed for those who prefer simplicity over crowds, it is a comfortable and grounded homestay in Coorg for couples, families, and small groups.";
const ADDRESS = {
  street: "Heggeri Hoskeri Road, Hulithala",
  locality: "Madikeri",
  region: "Karnataka",
  postalCode: "571252",
  country: "India",
};
const SERVICE_REGION = "Kodagu";
const PHONE = "+918971425151";
const LATITUDE = 12.3670316;
const LONGITUDE = 75.7923271;

function getOrigin() {
  const raw = process.env.PUBLIC_SITE_ORIGIN || "https://mistyhutstays.com";
  return raw.replace(/\/+$/, "");
}

function getPrimaryImage() {
  if (process.env.PUBLIC_PRIMARY_IMAGE_URL) {
    return String(process.env.PUBLIC_PRIMARY_IMAGE_URL).replace(/\/+$/, "");
  }
  return `${getOrigin()}/img/mistyhut_img1.jpeg`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function canonicalUrl(origin, pathname) {
  if (pathname === "/") return `${origin}/`;
  return `${origin}${pathname}`;
}

const PAGE_META = {
  "/": {
    title: "Misty Hut Stays | Coorg homestay near Madikeri",
    description:
      "Misty Hut Stays is a peaceful coffee estate homestay near Madikeri in Coorg, with quiet surroundings, fresh air, and comfortable rooms for couples and families.",
    includeJsonLd: true,
  },
  "/about": {
    title: "About Misty Hut Stays | Madikeri Homestay in Coorg",
    description:
      "Learn about Misty Hut Stays, a quiet coffee estate homestay in Hulithala near Madikeri, Coorg, designed for travellers who prefer stillness over crowds.",
    includeJsonLd: false,
  },
  "/rooms": {
    title: "Rooms at Misty Hut Stays | Coorg Homestay near Madikeri",
    description:
      "Comfortable, thoughtfully designed rooms at Misty Hut Stays, a coffee estate homestay near Madikeri in Coorg, ideal for couples, families and small groups.",
    includeJsonLd: false,
  },
  "/gallery": {
    title: "Gallery | Misty Hut Stays Coorg Homestay near Madikeri",
    description:
      "Photos of Misty Hut Stays, Hulithala, Madikeri, Coorg: the coffee estate, misty views, room interiors, shared areas, and calm green outdoor spaces for guests.",
    includeJsonLd: false,
  },
  "/contact": {
    title: "Contact Misty Hut Stays | Coorg Homestay near Madikeri",
    description:
      "Reach Misty Hut Stays for bookings, directions and queries. Coffee estate homestay in Hulithala near Madikeri, Coorg, set in quiet, mist filled surroundings.",
    includeJsonLd: false,
  },
};

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
    `<meta property="og:image:alt" content="${escapeHtml(BUSINESS_NAME)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(BUSINESS_NAME)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${i}" />`,
  ].join("\n    ");
}

function jsonLdScript(obj) {
  return `<script type="application/ld+json">\n${JSON.stringify(obj)}\n</script>`;
}

function buildHomeSchemas(origin, imageUrl) {
  const lodging = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: BUSINESS_NAME,
    description: BUSINESS_DESCRIPTION,
    address: {
      "@type": "PostalAddress",
      streetAddress: ADDRESS.street,
      addressLocality: ADDRESS.locality,
      addressRegion: ADDRESS.region,
      postalCode: ADDRESS.postalCode,
      addressCountry: ADDRESS.country,
    },
    areaServed: {
      "@type": "Place",
      name: SERVICE_REGION,
    },
    url: `${origin}/`,
    image: imageUrl,
    telephone: PHONE,
    priceRange: "₹₹",
    geo: {
      "@type": "GeoCoordinates",
      latitude: LATITUDE,
      longitude: LONGITUDE,
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Where is ${BUSINESS_NAME} located?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${BUSINESS_NAME} is located in ${ADDRESS.locality}, ${SERVICE_REGION}, ${ADDRESS.region}, ${ADDRESS.country}.`,
        },
      },
      {
        "@type": "Question",
        name: `What type of stay is ${BUSINESS_NAME}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${BUSINESS_NAME} offers a comfortable stay experience with scenic surroundings and essential amenities.`,
        },
      },
      {
        "@type": "Question",
        name: `How can I book ${BUSINESS_NAME}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `You can book directly through the official website or contact the property using the provided phone number.`,
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
    name: BUSINESS_NAME,
    url: `${origin}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const imageObject = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    contentUrl: imageUrl,
    name: `${BUSINESS_NAME} Image`,
    description: `Main image representing ${BUSINESS_NAME}`,
  };

  return [
    jsonLdScript(lodging),
    jsonLdScript(faq),
    jsonLdScript(breadcrumb),
    jsonLdScript(website),
    jsonLdScript(imageObject),
  ].join("\n    ");
}

function getTemplate() {
  const indexPath = path.join(__dirname, "..", "public", "index.html");
  return fs.readFileSync(indexPath, "utf8");
}

export function renderIndexHtml(pathname) {
  const meta = PAGE_META[pathname];
  if (!meta) return null;

  const origin = getOrigin();
  const imageUrl = getPrimaryImage();
  const canonical = canonicalUrl(origin, pathname);

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
    parts.push(buildHomeSchemas(origin, imageUrl));
  }

  const seoHead = parts.filter(Boolean).join("\n    ");

  const template = getTemplate();
  if (!template.includes(PLACEHOLDER)) {
    if (template.includes(SEO_START_MARKER) && template.includes(SEO_END_MARKER)) {
      return template.replace(
        new RegExp(`${SEO_START_MARKER}[\\s\\S]*?${SEO_END_MARKER}`),
        `${SEO_START_MARKER}\n    ${seoHead}\n    ${SEO_END_MARKER}`,
      );
    }
    return template;
  }
  return template.replace(PLACEHOLDER, seoHead);
}

export const SEO_ROUTES = Object.keys(PAGE_META);
