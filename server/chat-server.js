/* ==========================================================================
   Jua Media — optional chat proxy
   --------------------------------------------------------------------------
   The website works without this file: js/chat.js answers from a local
   knowledge base. Run this only if you want live Claude answers.

   Why a server at all: an API key must never sit in client-side JavaScript.
   Anything in the browser can be read by anyone, and a leaked key is billed
   to you. This process holds the key and the browser only ever talks to it.

   Setup
     cd server
     npm install
     set ANTHROPIC_API_KEY=sk-ant-...      (Windows)   export on macOS/Linux
     npm start

   Then, on each page, before js/chat.js:
     <script>window.JUA_CHAT_API = "http://localhost:8787/api/chat";</script>

   In production put this behind your own domain over HTTPS and replace the
   CORS origin below with that domain.
   ========================================================================== */

import http from "node:http";
import Anthropic from "@anthropic-ai/sdk";
import { normaliseUrl, auditUrl } from "./audit.js";
import { readFileSync } from "node:fs";

const PORT = process.env.PORT || 8787;

// Lock this down to your real site in production.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Resolves ANTHROPIC_API_KEY (or an `ant auth login` profile) from the environment.
const client = new Anthropic();

/* What the assistant is allowed to talk about. Kept as one frozen string so
   it caches cleanly across requests. */
const SYSTEM = `You are "Ask Jua", the assistant on the website of Jua Media, a digital
marketing agency based on the 3rd Floor of Nyandarua House, Nairobi CBD, Kenya.
Founded 2014. Fourteen specialists. Serving Kenya and East Africa.

The ten services:
1. Social media management — TikTok, Instagram, Facebook, LinkedIn, X, WhatsApp Business.
   Monthly content calendar, graphics and short video, comments and DMs answered in working
   hours, paid campaigns aimed at enquiries. Captions in English, Kiswahili or Sheng.
2. Google Ads and paid media — Search, Shopping, Display, YouTube, Performance Max, plus
   call and form tracking and Google Business Profile.
3. SEO — technical audit and fixes, keyword research for the Kenyan market, on-page and
   schema, local SEO and Maps, programmatic pages, entity and brand authority.
4. AI search optimisation (GEO/AEO) — being named by ChatGPT, Gemini, Perplexity and
   Google AI Overviews; answer-ready content, schema, crawler access, monthly visibility report.
5. Content marketing — articles, guides, landing pages, email and SMS; English, Kiswahili, Sheng.
6. Websites and conversion — business sites, online shops with M-Pesa, card and pay-on-delivery
   checkout, landing pages, conversion rate optimisation, hosting and domains in the client's name.
7. Branding and creative — logo, brand guide, product photography, short-form video,
   company profiles, packaging and print, signage and vehicle branding.
8. Data and reporting — conversion and call tracking, lead attribution, live dashboard,
   one plain-English monthly report.
9. Digital PR and link building — Kenyan press, directories, partner mentions, reviews,
   toxic backlink clean-up.
10. Print, radio and activations — radio including vernacular stations, billboards and vehicle
    branding, market activations, roadshows, exhibition stands, point-of-sale.

Pricing: quoted per client, never published as a price list, because each business has a
different goal, capability and vision. One fixed monthly figure, agreed in writing before work
starts. Advertising budget is always separate from the fee and is paid from the client's own
account. No percentage-of-spend billing. Three-month minimum, then month to month on thirty
days' notice. No exit fees. Always included: the audit and proposal, tracking setup, the monthly
report and review call, everything registered in the client's name, and a clean handover.

Process: 1) listen and audit (free written review), 2) plan and quote (one page), 3) build and
launch with tracking working first, 4) run and report monthly. Most clients live in about three weeks.

Timelines: paid campaigns bring enquiries in week one; SEO moves from month two and is
meaningful by month four to six; a business website takes three to four weeks.

Free resources on the site: Marketing numbers (blog.html#numbers) - 36 figures across social
media, search and AI, ad spend, websites, WhatsApp and ecommerce. Guides and playbooks
(blog.html#guides) - nine step-by-step documents, free, no form and no download.

Contact: +254 719 547 736 (calls and WhatsApp), juamedia037@gmail.com.
Hours Monday to Friday, 8:00-18:00 EAT.

Rules:
- Answer only about Jua Media, its services, pricing approach, process and marketing in the
  East African context. If asked anything else, say politely that you only cover Jua Media and
  offer to connect them with a strategist.
- Never invent prices, figures, case-study numbers or guarantees. If you do not know, say so
  and point to the contact page or phone number.
- Keep answers to roughly three sentences unless the person asks for detail.
- Reply in the same language the person writes in. English and Kiswahili are both expected.
- Never promise specific rankings, revenue or timelines beyond those stated above.`;

/* Everything the site publishes — service facts, FAQ answers, articles, case
   studies, marketing numbers and guides — generated by tools/build-knowledge.py
   from the pages themselves. Sent as a second cached system block so the model
   quotes real figures instead of guessing. */
let KNOWLEDGE = "";
try {
  const k = JSON.parse(readFileSync(new URL("./knowledge.json", import.meta.url), "utf8"));
  KNOWLEDGE = "Reference material from the Jua Media website. Quote it; do not go beyond it.\n\n" +
    JSON.stringify(k);
} catch {
  console.warn("server/knowledge.json not found: run python3 tools/build-knowledge.py");
}

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

/* Server-sent events, so the answer appears word by word in the browser
   instead of arriving in one lump after a long pause. */
function openStream(res) {
  res.writeHead(200, {
    ...CORS,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
}

function sendEvent(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { return sendJson(res, 204, {}); }

  /* ---- real site checks for the Analyse box ---- */
  if (req.method === "POST" && req.url.startsWith("/api/audit")) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) { req.destroy(); }
    });
    req.on("end", async () => {
      let site;
      try { site = JSON.parse(body).url; } catch { return sendJson(res, 400, { error: "Invalid JSON" }); }

      const url = normaliseUrl(site);
      if (!url) {
        return sendJson(res, 400, { error: "That does not look like a public website address." });
      }

      try {
        const report = await auditUrl(url);
        return sendJson(res, 200, report);
      } catch (error) {
        const reason = error?.name === "TimeoutError"
          ? "The site took too long to respond."
          : "We could not reach that address.";
        return sendJson(res, 200, { unreachable: true, url: url.href, error: reason });
      }
    });
    return;
  }

  if (req.method !== "POST" || !req.url.startsWith("/api/chat")) {
    return sendJson(res, 404, { error: "Not found" });
  }

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 64 * 1024) { req.destroy(); }   // basic flood guard
  });

  req.on("end", async () => {
    let incoming;
    try {
      incoming = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON" });
    }

    // Keep only the shape we expect, and cap the history we forward.
    const messages = (Array.isArray(incoming.messages) ? incoming.messages : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return sendJson(res, 400, { error: "Expected a trailing user message" });
    }

    try {
      const stream = client.messages.stream({
        model: "claude-opus-5-5",
        // Deliberately short answers for a chat bubble, so a small cap is right here.
        max_tokens: 1000,
        // Low effort keeps a website FAQ fast and cheap; raise it if answers feel thin.
        output_config: { effort: "low" },
        // The brief is long and identical every time, so cache it.
        system: [
          { type: "text", text: SYSTEM },
          ...(KNOWLEDGE ? [{ type: "text", text: KNOWLEDGE }] : []),
        ].map((block, i, all) => (i === all.length - 1 ? { ...block, cache_control: { type: "ephemeral" } } : block)),
        messages
      });

      openStream(res);

      // Push each piece of text to the browser as Claude writes it.
      stream.on("text", (delta) => sendEvent(res, { type: "delta", text: delta }));

      // If the visitor closes the tab mid-answer, stop paying for the rest.
      req.on("close", () => stream.abort());

      const final = await stream.finalMessage();

      if (final.stop_reason === "refusal") {
        sendEvent(res, {
          type: "replace",
          text: "I cannot help with that one. For anything about our services, call +254 719 547 736."
        });
      }

      sendEvent(res, { type: "done" });
      return res.end();
    } catch (error) {
      // Once the stream is open the status line is already sent, so errors
      // have to travel as an event rather than an HTTP status.
      if (res.headersSent) {
        sendEvent(res, { type: "error" });
        return res.end();
      }
      // Most specific first, so retryable and non-retryable stay distinguishable.
      if (error instanceof Anthropic.AuthenticationError) {
        console.error("Auth failed — check ANTHROPIC_API_KEY");
        return sendJson(res, 500, { error: "Assistant unavailable" });
      }
      if (error instanceof Anthropic.RateLimitError) {
        return sendJson(res, 429, { error: "Busy right now, please try again shortly" });
      }
      if (error instanceof Anthropic.APIError) {
        console.error(`Claude API error ${error.status}:`, error.message);
        return sendJson(res, 502, { error: "Assistant unavailable" });
      }
      console.error("Unexpected error:", error);
      return sendJson(res, 500, { error: "Assistant unavailable" });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Ask Jua proxy listening on http://localhost:${PORT}/api/chat`);
  console.log("The website falls back to its built-in answers if this is not running.");
});
