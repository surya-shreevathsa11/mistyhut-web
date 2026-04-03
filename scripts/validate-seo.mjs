import { renderIndexHtml } from "../config/seo-index-pages.js";

const paths = ["/", "/about", "/rooms", "/gallery", "/contact"];
for (const p of paths) {
  const html = renderIndexHtml(p);
  if (html.includes("%%SEO_HEAD%%")) {
    console.error("FAIL: placeholder left for", p);
    process.exit(1);
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1].trim(),
  );
  if (p === "/") {
    if (scripts.length !== 5) {
      console.error("FAIL: expected 5 JSON-LD on home, got", scripts.length);
      process.exit(1);
    }
    scripts.forEach((s, i) => {
      try {
        JSON.parse(s);
      } catch (e) {
        console.error("FAIL JSON-LD block", i + 1, e.message);
        process.exit(1);
      }
    });
  } else {
    if (scripts.length !== 0) {
      console.error("FAIL: JSON-LD on non-home", p, scripts.length);
      process.exit(1);
    }
  }
  const titles = (html.match(/<title>/g) || []).length;
  if (titles !== 1) {
    console.error("FAIL: title count", p, titles);
    process.exit(1);
  }
}
console.log("OK: SEO render + JSON-LD for all index routes");
