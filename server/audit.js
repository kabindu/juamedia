/* ==========================================================================
   Real site checks for the "Analyse" box.
   Every result here is measured from the page itself — nothing is invented.
   ========================================================================== */

const TIMEOUT_MS = 12000;
const MAX_BYTES = 2 * 1024 * 1024;

/* Refuse anything that is not a public website. A server that fetches whatever
   it is given can be pointed at your own internal network, so this is not
   optional. Checked numerically — a prefix regex silently misses 192.168.x.x. */
function isPrivateHost(host) {
  const h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h === "::1") { return true; }
  if (/\.(local|internal|localdomain|home|lan)$/.test(h)) { return true; }
  if (/^(fc|fd|fe80)/.test(h) && h.includes(":")) { return true; }   // IPv6 private

  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip) {
    const a = Number(ip[1]), b = Number(ip[2]);
    if ([a, b, Number(ip[3]), Number(ip[4])].some((n) => n > 255)) { return true; }
    if (a === 0 || a === 10 || a === 127) { return true; }            // this host, private, loopback
    if (a === 192 && b === 168) { return true; }                      // private
    if (a === 172 && b >= 16 && b <= 31) { return true; }             // private
    if (a === 169 && b === 254) { return true; }                      // link-local / cloud metadata
    if (a >= 224) { return true; }                                    // multicast and reserved
  }
  return false;
}

export function normaliseUrl(raw) {
  let value = String(raw || "").trim();
  if (!value) { return null; }
  if (!/^https?:\/\//i.test(value)) { value = "https://" + value; }

  let url;
  try { url = new URL(value); } catch { return null; }

  if (url.protocol !== "http:" && url.protocol !== "https:") { return null; }
  if (isPrivateHost(url.hostname)) { return null; }
  if (!url.hostname.includes(".")) { return null; }

  return url;
}

function check(label, status, detail) {
  return { label, status, detail };
}

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "JuaMediaAudit/1.0" }
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function auditUrl(url) {
  const started = Date.now();

  const res = await fetch(url.href, {
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "User-Agent": "JuaMediaAudit/1.0 (+https://juamedia.co.ke)" }
  });

  const ttfb = Date.now() - started;

  // a public address can redirect to a private one
  if (isPrivateHost(new URL(res.url).hostname)) {
    throw new Error("Redirected to a non-public address");
  }

  // read with a hard ceiling so one huge page cannot exhaust memory
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "", bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) { break; }
    bytes += value.length;
    if (bytes > MAX_BYTES) { reader.cancel(); break; }
    html += decoder.decode(value, { stream: true });
  }

  const head = html.slice(0, 200000);
  const pick = (re) => { const m = head.match(re); return m ? m[1].trim() : ""; };

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
            || pick(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const h1s = (head.match(/<h1[\s>]/gi) || []).length;
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(head);
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(head);
  const ogTitle = /<meta[^>]+property=["']og:(title|image)["']/i.test(head);
  const jsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(head);
  const imgs = head.match(/<img[^>]*>/gi) || [];
  const noAlt = imgs.filter((t) => !/\salt\s*=/i.test(t)).length;

  const origin = url.origin;
  const [robots, sitemap] = await Promise.all([
    headOk(origin + "/robots.txt"),
    headOk(origin + "/sitemap.xml")
  ]);

  const kb = Math.round(bytes / 1024);
  const checks = [];

  checks.push(res.ok
    ? check("Page loads", "pass", `HTTP ${res.status}${res.redirected ? " after a redirect" : ""}`)
    : check("Page loads", "fail", `HTTP ${res.status} — search engines may not index this`));

  checks.push(res.url.startsWith("https://")
    ? check("Secure (HTTPS)", "pass", "Served over HTTPS")
    : check("Secure (HTTPS)", "fail", "No HTTPS — browsers warn visitors and Google demotes the site"));

  checks.push(ttfb < 800
    ? check("Server response", "pass", `First byte in ${ttfb} ms`)
    : ttfb < 2000
      ? check("Server response", "warn", `First byte in ${ttfb} ms — slow on Kenyan mobile data`)
      : check("Server response", "fail", `First byte in ${ttfb} ms — visitors leave before this finishes`));

  checks.push(kb < 150
    ? check("Page weight", "pass", `${kb} KB of HTML`)
    : kb < 400
      ? check("Page weight", "warn", `${kb} KB of HTML — heavy for a 3G connection`)
      : check("Page weight", "fail", `${kb} KB of HTML — very heavy on mobile data`));

  checks.push(!title
    ? check("Page title", "fail", "No <title> — Google has nothing to show in results")
    : title.length < 15 || title.length > 65
      ? check("Page title", "warn", `${title.length} characters: "${title.slice(0, 70)}"`)
      : check("Page title", "pass", `"${title.slice(0, 70)}"`));

  checks.push(!desc
    ? check("Meta description", "fail", "Missing — Google writes its own snippet for you")
    : desc.length < 70 || desc.length > 165
      ? check("Meta description", "warn", `${desc.length} characters — aim for 70 to 160`)
      : check("Meta description", "pass", `${desc.length} characters`));

  checks.push(h1s === 1
    ? check("Main heading", "pass", "Exactly one H1")
    : h1s === 0
      ? check("Main heading", "fail", "No H1 — the page does not state its own topic")
      : check("Main heading", "warn", `${h1s} H1 headings — use one`));

  checks.push(viewport
    ? check("Mobile ready", "pass", "Viewport tag present")
    : check("Mobile ready", "fail", "No viewport tag — the page will not scale on phones"));

  checks.push(jsonLd
    ? check("Structured data", "pass", "JSON-LD schema found")
    : check("Structured data", "warn", "No schema — this is what AI search and rich results read"));

  checks.push(ogTitle
    ? check("Social sharing", "pass", "Open Graph tags found")
    : check("Social sharing", "warn", "No Open Graph tags — links look bare on WhatsApp and Facebook"));

  checks.push(canonical
    ? check("Canonical tag", "pass", "Present")
    : check("Canonical tag", "warn", "Missing — duplicate URLs can split your ranking"));

  checks.push(noAlt === 0
    ? check("Image alt text", "pass", imgs.length ? `All ${imgs.length} images have alt text` : "No images on this page")
    : check("Image alt text", "warn", `${noAlt} of ${imgs.length} images missing alt text`));

  checks.push(robots
    ? check("robots.txt", "pass", "Found")
    : check("robots.txt", "warn", "Not found — crawlers get no guidance"));

  checks.push(sitemap
    ? check("sitemap.xml", "pass", "Found")
    : check("sitemap.xml", "warn", "Not found — Google has to discover pages on its own"));

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  return {
    url: res.url,
    checkedAt: new Date().toISOString(),
    summary: { passed: checks.length - fails - warns, warnings: warns, failures: fails, total: checks.length },
    checks
  };
}
