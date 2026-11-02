/* ==========================================================================
   JUA MEDIA — "Analyse" / "Get my free plan" URL boxes
   Takes over the hero capture form and the sticky audit bar.

   With the proxy in /server running, it runs real checks on the address and
   shows measured results. Without it, it validates the address, logs the
   request and hands the visitor straight to WhatsApp or e-mail with the
   details filled in. It never invents a score.
   ========================================================================== */

(function () {
  "use strict";

  var WHATSAPP = "254719547736";
  var EMAIL = "juamedia037@gmail.com";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function endpoint() {
    if (window.JUA_AUDIT_API) { return window.JUA_AUDIT_API; }
    if (window.JUA_CHAT_API) { return window.JUA_CHAT_API.replace(/\/chat\b/, "/audit"); }
    return null;
  }

  /* ---------------------------------------------------------------- url */
  function tidy(raw) {
    var v = String(raw || "").trim().replace(/^@+/, "");
    if (!v) { return null; }

    // a social handle is a valid thing to send us, just not a URL to fetch
    if (/^[a-z0-9._]+$/i.test(v) && v.indexOf(".") === -1) {
      return { handle: v };
    }
    if (!/^https?:\/\//i.test(v)) { v = "https://" + v; }

    var u;
    try { u = new URL(v); } catch (e) { return null; }
    if (!u.hostname || u.hostname.indexOf(".") === -1) { return null; }
    return { url: u.href, host: u.hostname.replace(/^www\./, "") };
  }

  function ref() {
    return "JM-" + new Date().getFullYear() + "-" +
      String(Math.floor(Math.random() * 9000) + 1000);
  }

  function remember(entry) {
    try {
      var all = JSON.parse(localStorage.getItem("juamedia.audits") || "[]");
      all.push(entry);
      localStorage.setItem("juamedia.audits", JSON.stringify(all.slice(-25)));
    } catch (e) { /* private mode */ }
  }

  /* -------------------------------------------------------------- modal */
  var modal, body;

  function build() {
    modal = document.createElement("div");
    modal.className = "audit-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Website check");
    modal.innerHTML =
      '<div class="audit-sheet">' +
        '<header class="audit-head">' +
          '<span class="audit-mark" aria-hidden="true"></span>' +
          '<span class="audit-head-txt"><b>Website check</b><span class="audit-target"></span></span>' +
          '<button class="audit-x" type="button" aria-label="Close">&times;</button>' +
        '</header>' +
        '<div class="audit-body"></div>' +
      '</div>';
    document.body.appendChild(modal);
    body = $(".audit-body", modal);

    $(".audit-x", modal).addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal) { close(); } });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("open")) { close(); }
    });
  }

  function open(target) {
    if (!modal) { build(); }
    $(".audit-target", modal).textContent = target || "";
    modal.classList.add("open");
    document.body.classList.add("audit-modal-open");
  }

  function close() {
    modal.classList.remove("open");
    document.body.classList.remove("audit-modal-open");
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function spinner(msg) {
    body.innerHTML =
      '<div class="audit-wait"><span class="audit-spin" aria-hidden="true"></span>' +
      '<p>' + esc(msg) + '</p></div>';
  }

  function handoff(what, reference) {
    var msg = "Hello Jua Media, please run a free audit for " + what +
              " (reference " + reference + ").";
    return '<div class="audit-next">' +
      '<a class="btn" href="https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(msg) + '">Send on WhatsApp</a>' +
      '<a class="btn btn-ghost" href="mailto:' + EMAIL + '?subject=' +
        encodeURIComponent("Free audit request " + reference) +
        '&body=' + encodeURIComponent(msg) + '">E-mail it instead</a>' +
      '</div>' +
      '<p class="audit-ref">Reference <b>' + esc(reference) + '</b> &middot; a strategist replies within one working day.</p>';
  }

  var WILL_CHECK = [
    "Whether Google can crawl and index every page",
    "Load speed on a Kenyan mobile connection",
    "Titles, descriptions and headings on your key pages",
    "Whether AI assistants can read and quote your site",
    "Your Google Business Profile and map listings",
    "What your competitors rank for that you do not"
  ];

  function showRequested(label, reference) {
    body.innerHTML =
      '<p class="audit-lead">Request logged for <b>' + esc(label) + '</b>. ' +
      'Here is what we go through in a free audit:</p>' +
      '<ul class="audit-will">' +
        WILL_CHECK.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") +
      '</ul>' +
      handoff(label, reference);
  }

  function showReport(data) {
    var s = data.summary;
    var rows = data.checks.map(function (c) {
      return '<li class="audit-row audit-' + c.status + '">' +
        '<span class="audit-dot" aria-hidden="true"></span>' +
        '<span class="audit-row-txt"><b>' + esc(c.label) + '</b>' +
        '<span>' + esc(c.detail) + '</span></span></li>';
    }).join("");

    body.innerHTML =
      '<div class="audit-score">' +
        '<div><b>' + s.passed + '</b><span>Passing</span></div>' +
        '<div><b>' + s.warnings + '</b><span>Worth fixing</span></div>' +
        '<div><b>' + s.failures + '</b><span>Costing you</span></div>' +
      '</div>' +
      '<ul class="audit-list">' + rows + '</ul>' +
      '<p class="audit-note">These are live checks on the page we fetched. ' +
      'A full audit also covers rankings, competitors, ad accounts and your Google Business Profile.</p>' +
      handoff(data.url, ref());
  }

  function showUnreachable(label, reason, reference) {
    body.innerHTML =
      '<p class="audit-lead"><b>' + esc(reason) + '</b> That often means the site is down, ' +
      'blocking automated visitors, or the address has a typo &mdash; all worth knowing.</p>' +
      handoff(label, reference);
  }

  /* --------------------------------------------------------------- run */
  function run(raw) {
    var parsed = tidy(raw);
    var reference = ref();

    if (!parsed) {
      open("");
      body.innerHTML =
        '<p class="audit-lead">That does not look like a website address or a social handle. ' +
        'Try something like <b>yourbusiness.co.ke</b> or <b>@yourbusiness</b>.</p>';
      return;
    }

    if (parsed.handle) {
      var at = "@" + parsed.handle;
      remember({ ref: reference, handle: at, at: new Date().toISOString() });
      open(at);
      showRequested(at, reference);
      return;
    }

    remember({ ref: reference, url: parsed.url, at: new Date().toISOString() });
    open(parsed.host);

    var api = endpoint();
    if (!api) {
      showRequested(parsed.host, reference);
      return;
    }

    spinner("Checking " + parsed.host + "...");

    fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: parsed.url })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.checks) { showReport(data); }
        else if (data && data.unreachable) { showUnreachable(parsed.host, data.error, reference); }
        else { showRequested(parsed.host, reference); }
      })
      .catch(function () { showRequested(parsed.host, reference); });
  }

  /* ------------------------------------------------------------- wire */
  function wire() {
    // the hero "Get my free plan" box and the sticky bar's "Analyse" box
    $$("form.capture, .audit-bar form").forEach(function (form) {
      form.setAttribute("data-validate", "");          // keep inline validation
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();                  // takes over from the generic handler
        var input = form.querySelector("input[type=text], input[type=url], input[name=website]");
        if (!input) { return; }
        var value = input.value.trim();
        if (!value) { input.focus(); return; }
        run(value);
        input.value = "";
      }, true);                                        // capture phase, so we go first
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else { wire(); }

  window.JuaAudit = { run: run };
})();
