/* ==========================================================================
   JUA MEDIA — main.js
   Vanilla JS, no dependencies, no build step. Every module no-ops when its
   markup is absent, so one file serves every page.
   ========================================================================== */

(function () {
  "use strict";

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  /* ----------------------------------------------------------------------
     1. Active nav state
     ---------------------------------------------------------------------- */
  function markActiveNav() {
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    $$(".nav a").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
      if (!href || href.charAt(0) === "#") { return; }
      if (href === here) {
        a.classList.add("on");
        a.setAttribute("aria-current", "page");
      }
    });
  }

  /* ----------------------------------------------------------------------
     2. Mobile navigation
     ---------------------------------------------------------------------- */
  function initMobileNav() {
    var burger = $(".burger");
    // On the two-row header the burger opens row two, which holds the nav.
    var nav = $("#headerMain") || $(".nav");
    if (!burger || !nav) { return; }

    function close() {
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }

    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Close after tapping a link, or on Escape, or when resized to desktop.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { close(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 920) { close(); }
    });
  }

  /* ----------------------------------------------------------------------
     2b. Services dropdown
         Desktop opens on hover via CSS; the caret handles click, touch and
         keyboard, and is the only way in on mobile.
     ---------------------------------------------------------------------- */
  function initSubMenus() {
    var toggles = $$(".sub-toggle");
    if (!toggles.length) { return; }

    function panelOf(btn) {
      return btn.parentNode.querySelector(".mega, .sub-menu");
    }

    function closeAll(except) {
      toggles.forEach(function (t) {
        if (t === except) { return; }
        t.setAttribute("aria-expanded", "false");
        var m = panelOf(t);
        if (m) { m.classList.remove("open"); }
      });
    }

    toggles.forEach(function (btn) {
      var menu = panelOf(btn);
      if (!menu) { return; }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var open = btn.getAttribute("aria-expanded") === "true";
        closeAll(btn);
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        menu.classList.toggle("open", !open);
      });

      // Tapping a link inside closes the menu.
      menu.addEventListener("click", function (e) {
        if (e.target.closest("a")) {
          btn.setAttribute("aria-expanded", "false");
          menu.classList.remove("open");
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".has-sub")) { closeAll(null); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeAll(null); }
    });
  }

  
  /* ----------------------------------------------------------------------
     3. Sticky header shadow + back-to-top visibility
     ---------------------------------------------------------------------- */
  function initScrollChrome() {
    var header = $(".site-header");
    var top = $("#toTop");

    function update() {
      var y = window.pageYOffset;
      if (header) { header.classList.toggle("stuck", y > 8); }
      if (top) { top.classList.toggle("show", y > 500); }
    }

    update();
    window.addEventListener("scroll", update, { passive: true });

    if (top) {
      top.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ----------------------------------------------------------------------
     4. Reveal on scroll
     ---------------------------------------------------------------------- */
  function initReveal() {
    var items = $$(".rv");
    if (!items.length) { return; }

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ----------------------------------------------------------------------
     5. Animated counters
     ---------------------------------------------------------------------- */
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) { return; }

    function run(el) {
      var to = parseFloat(el.getAttribute("data-count")) || 0;
      var pre = el.getAttribute("data-prefix") || "";
      var suf = el.getAttribute("data-suffix") || "";
      var dec = (to % 1 !== 0) ? 1 : 0;
      var start = performance.now();
      var dur = 1400;

      function frame(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);          // ease-out cubic
        el.textContent = pre + (to * eased).toFixed(dec) + suf;
        if (p < 1) { requestAnimationFrame(frame); }
        else { el.textContent = pre + to.toFixed(dec) + suf; }
      }
      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      nums.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });

    nums.forEach(function (el) { io.observe(el); });
  }

  
  /* ----------------------------------------------------------------------
     7. Accordion
     ---------------------------------------------------------------------- */
  function initAccordions() {
    $$(".acc-q").forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      if (!panel) { return; }

      btn.addEventListener("click", function () {
        var isOpen = btn.getAttribute("aria-expanded") === "true";
        var group = btn.closest(".acc");

        if (group && !isOpen) {
          $$(".acc-q", group).forEach(function (other) {
            if (other === btn) { return; }
            other.setAttribute("aria-expanded", "false");
            var p = document.getElementById(other.getAttribute("aria-controls"));
            if (p) { p.classList.remove("open"); }
          });
        }

        btn.setAttribute("aria-expanded", isOpen ? "false" : "true");
        panel.classList.toggle("open", !isOpen);
      });
    });
  }

  /* ----------------------------------------------------------------------
     8. Portfolio filter
     ---------------------------------------------------------------------- */
  function initFilters() {
    var bar = $(".pills") || $(".filters");
    if (!bar) { return; }

    var items = $$(".work, .post");
    var buttons = $$("button[data-filter]", bar);
    var count = $("#workCount");
    var empty = $("#noResults");
    var active = "all";

    function apply() {
      buttons.forEach(function (b) {
        var on = b.getAttribute("data-filter") === active;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      var shown = 0;
      items.forEach(function (item) {
        var match = active === "all" ||
          (item.getAttribute("data-cat") || "").split(/\s+/).indexOf(active) !== -1;
        item.classList.toggle("hide", !match);
        // "load more" paginates with an inline display, which would otherwise
        // keep a matching item hidden
        if (match) { item.style.display = ""; shown++; }
      });

      if (count) { count.textContent = shown; }
      if (empty) { empty.classList.toggle("show", shown === 0); }

      // let the pager know, so it can step aside while a filter is on
      document.dispatchEvent(new CustomEvent("jm:filter", { detail: { active: active } }));
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        active = btn.getAttribute("data-filter");
        apply();
      });
    });

    var clear = $("#clearFilters");
    if (clear) {
      clear.addEventListener("click", function (e) {
        e.preventDefault();
        active = "all";
        apply();
      });
    }

    // header menu links arrive as blog.html#cat=seo
    function fromHash() {
      var m = /^#cat=([a-z]+)$/.exec(location.hash);
      if (!m) { return; }
      if (!buttons.some(function (b) { return b.getAttribute("data-filter") === m[1]; })) { return; }
      active = m[1];
      apply();
      if (items.length) { items[0].parentNode.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }

    fromHash();
    window.addEventListener("hashchange", fromHash);
  }

  /* ----------------------------------------------------------------------
     9. Form validation + demo submit
     ---------------------------------------------------------------------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  function wrapOf(el) { return el.closest(".field") || el.parentNode; }

  function fail(el, msg) {
    var w = wrapOf(el);
    w.classList.add("bad");
    var e = $(".err", w);
    if (e) { e.textContent = msg; }
    el.setAttribute("aria-invalid", "true");
  }

  function pass(el) {
    wrapOf(el).classList.remove("bad");
    el.removeAttribute("aria-invalid");
  }

  function checkField(el) {
    var v = (el.value || "").trim();

    if (el.type === "checkbox") {
      if (el.required && !el.checked) { fail(el, "Please tick this box to continue."); return false; }
      pass(el); return true;
    }
    if (el.required && !v) {
      fail(el, "This field is required."); return false;
    }
    if (v && el.type === "email" && !EMAIL.test(v)) {
      fail(el, "Enter a valid e-mail, e.g. name@company.co.ke"); return false;
    }
    if (v && el.type === "tel" && v.replace(/\D/g, "").length < 9) {
      fail(el, "Enter a full phone number, e.g. +254 7XX XXX XXX"); return false;
    }
    if (el.tagName === "TEXTAREA" && el.required && v.length < 12) {
      fail(el, "Please add a little more detail (at least 12 characters)."); return false;
    }
    pass(el); return true;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initForms() {
    $$("form[data-validate]").forEach(function (form) {
      var msg = $(".form-msg", form);
      var fields = $$("input, select, textarea", form).filter(function (el) {
        return el.type !== "hidden" && el.type !== "submit";
      });

      fields.forEach(function (el) {
        el.addEventListener("blur", function () {
          if (el.required || (el.value || "").trim()) { checkField(el); }
        });
        el.addEventListener("input", function () {
          if (wrapOf(el).classList.contains("bad")) { checkField(el); }
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var bad = fields.filter(function (el) { return !checkField(el); });

        if (bad.length) {
          if (msg) {
            msg.className = "form-msg bad show";
            msg.innerHTML = "<strong>Please check the form.</strong> " + bad.length +
              (bad.length === 1 ? " field needs" : " fields need") + " your attention.";
          }
          bad[0].focus();
          return;
        }

        // Static site: no back end. Issue a reference and keep a local copy
        // so nothing the visitor typed is lost on submit.
        var nameEl = form.querySelector("[name=name]");
        var name = nameEl ? nameEl.value.trim() : "";
        var ref = "JM-" + new Date().getFullYear() + "-" +
          String(Math.floor(Math.random() * 9000) + 1000);

        try {
          var store = JSON.parse(localStorage.getItem("juamedia.enquiries") || "[]");
          var row = { ref: ref, at: new Date().toISOString(), page: location.pathname };
          fields.forEach(function (el) {
            if (el.name) { row[el.name] = el.type === "checkbox" ? el.checked : el.value; }
          });
          store.push(row);
          localStorage.setItem("juamedia.enquiries", JSON.stringify(store.slice(-30)));
        } catch (err) { /* private browsing — ignore */ }

        if (msg) {
          msg.className = "form-msg show";
          msg.innerHTML = "<strong>Asante" + (name ? ", " + escapeHtml(name) : "") +
            "!</strong> Your enquiry is logged as <strong>" + ref + "</strong>. " +
            "A Jua Media strategist will reply within one working day. " +
            "<em>Demo site &mdash; connect this form to your mail handler to send it for real.</em>";
        }

        form.reset();
        fields.forEach(pass);
        if (msg) { msg.scrollIntoView({ behavior: "smooth", block: "center" }); }
      });
    });
  }

  /* ----------------------------------------------------------------------
     10. Year stamp
     ---------------------------------------------------------------------- */
  function initYear() {
    $$(".js-year").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  onReady(function () {
    markActiveNav();
    initMobileNav();
    initSubMenus();
    initScrollChrome();
    initReveal();
    initCounters();
    initAccordions();
    initFilters();
    initForms();
    initYear();
  });
})();

/* ==========================================================================
   Growth-site extras: rotating announcement, mega tabs, load more, audit bar
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  /* 1. Announcement bar: cycle the platform people want to be found on */
  function rotator() {
    var el = document.getElementById("rotator");
    if (!el) { return; }

    var items = [
      ["TikTok", '<path d="M9 12a4 4 0 1 0 4 4V4c1 2 3 3.5 5 3.6"/>'],
      ["Instagram", '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>'],
      ["Google", '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>'],
      ["YouTube", '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor"/>'],
      ["ChatGPT", '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/>'],
      ["Facebook", '<path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H8v3h2v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1z"/>']
    ];
    var i = 0;

    setInterval(function () {
      el.classList.add("fade");
      setTimeout(function () {
        i = (i + 1) % items.length;
        el.innerHTML =
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          items[i][1] + '</svg><b>' + items[i][0] + '</b>';
        el.classList.remove("fade");
      }, 260);
    }, 2600);
  }

  /* 2. Mega menu: tabbed service categories */
  function megaTabs() {
    $$(".mega").forEach(function (mega) {
      var tabs = $$(".mega-tab", mega);
      var panels = $$(".mega-panel", mega);
      if (!tabs.length) { return; }

      function show(name) {
        tabs.forEach(function (t) { t.classList.toggle("on", t.getAttribute("data-panel") === name); });
        panels.forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-panel") === name); });
      }

      tabs.forEach(function (t) {
        var name = t.getAttribute("data-panel");
        t.addEventListener("mouseenter", function () { show(name); });
        t.addEventListener("click", function (e) { e.preventDefault(); show(name); });
        t.addEventListener("focus", function () { show(name); });
      });
    });
  }

  /* 3. Mobile: the invisible overlay button opens each mega panel */
  function megaToggles() {
    $$(".has-mega .sub-toggle").forEach(function (btn) {
      var mega = btn.parentNode.querySelector(".mega");
      if (!mega) { return; }
      btn.addEventListener("click", function (e) {
        if (window.innerWidth > 900) { return; }   // desktop opens on hover
        e.preventDefault();
        var open = mega.classList.contains("open");
        $$(".mega").forEach(function (m) { m.classList.remove("open"); });
        mega.classList.toggle("open", !open);
        btn.setAttribute("aria-expanded", open ? "false" : "true");
      });
    });
  }

  /* 4. Load more posts, three at a time */
  function loadMore() {
    var btn = document.getElementById("loadMore");
    if (!btn) { return; }

    var step = 3;
    var posts = $$(".post");
    var shown = 6;

    function paint() {
      posts.forEach(function (p, i) { p.style.display = i < shown ? "" : "none"; });
      if (shown >= posts.length) { btn.parentNode.style.display = "none"; }
    }

    if (posts.length > shown) { paint(); } else { btn.parentNode.style.display = "none"; }

    btn.addEventListener("click", function () {
      shown += step;
      paint();
    });

    // While a category filter is on, show every match and hide the pager.
    // Back on "all", return to the paginated view.
    document.addEventListener("jm:filter", function (e) {
      var all = !e.detail || e.detail.active === "all";
      if (all) {
        shown = 6;
        posts.forEach(function (p) { p.style.display = ""; });
        btn.parentNode.style.display = posts.length > shown ? "" : "none";
        paint();
      } else {
        posts.forEach(function (p) { p.style.display = ""; });
        btn.parentNode.style.display = "none";
      }
    });
  }

  /* 5. Sticky audit bar: show after a scroll, remember dismissal */
  function auditBar() {
    var bar = document.getElementById("auditBar");
    if (!bar) { return; }

    var closed = false;
    try { closed = sessionStorage.getItem("jm.audit") === "closed"; } catch (e) {}
    if (closed) { bar.parentNode.removeChild(bar); return; }

    var lift = function () {
      // measure rather than assume: the bar wraps to two lines on narrow screens
      var h = bar.offsetHeight || 0;
      document.documentElement.style.setProperty("--audit-h", h + "px");
    };

    var atFooter = false;

    var onScroll = function () {
      var up = window.pageYOffset > 600 && !atFooter;
      bar.classList.toggle("show", up);
      // the chat launcher sits bottom-right too, so tell it to lift
      document.body.classList.toggle("audit-up", up);
      if (up) { lift(); }
    };

    var footer = document.querySelector(".site-footer");
    if (footer && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        atFooter = entries[0].isIntersecting;
        onScroll();
      }, { rootMargin: "0px 0px 60px 0px" }).observe(footer);
    }

    window.addEventListener("resize", function () {
      if (document.body.classList.contains("audit-up")) { lift(); }
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var close = document.getElementById("auditClose");
    if (close) {
      close.addEventListener("click", function () {
        bar.classList.remove("show");
        document.body.classList.remove("audit-up");
        try { sessionStorage.setItem("jm.audit", "closed"); } catch (e) {}
      });
    }
  }


  /* 6. Hero headline: cycle the platform the visitor cares about */
  function heroWord() {
    var el = document.getElementById("heroWord");
    if (!el) { return; }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }

    var words = ["TikTok", "Instagram", "Google", "YouTube", "ChatGPT", "WhatsApp"];
    var i = 0;

    setInterval(function () {
      el.classList.add("out");
      setTimeout(function () {
        i = (i + 1) % words.length;
        el.textContent = words[i];
        el.classList.remove("out");
      }, 230);
    }, 2200);
  }

  ready(function () {
    rotator();
    heroWord();
    megaTabs();
    megaToggles();
    loadMore();
    auditBar();
  });
})();

/* ==========================================================================
   Deferred payload
   The dictionary (50 KB) and the assistant (28 KB) are not needed to paint the
   page, so they load once the browser is idle. A visitor who already chose
   Kiswahili gets the dictionary straight away, to avoid a flash of English.
   ========================================================================== */
(function () {
  "use strict";

  var loaded = {};
  function load(src) {
    if (loaded[src]) { return; }
    loaded[src] = true;
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    document.body.appendChild(s);
  }

  function whenIdle(fn) {
    if ("requestIdleCallback" in window) { requestIdleCallback(fn, { timeout: 2500 }); }
    else { setTimeout(fn, 1200); }
  }

  var sw = false;
  try { sw = localStorage.getItem("juamedia.lang") === "sw"; } catch (e) {}

  if (sw) { load("js/i18n.js"); }                       // no flash of English
  whenIdle(function () {
    load("js/i18n.js");
    load("js/chat.js");
  });

  // if someone reaches for either before idle fires, bring it forward
  document.addEventListener("pointerdown", function (e) {
    if (e.target.closest("#langPicker")) { load("js/i18n.js"); }
  }, { passive: true, once: false });
})();

/* ==========================================================================
   Scroll progress + hero info strip
   ========================================================================== */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn); }
    else { fn(); }
  }

  /* A hairline at the very top that fills left to right as the page is read.
     Driven by transform, not width, so scrolling never triggers layout. */
  function progressBar() {
    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.appendChild(document.createElement("span"));
    document.body.appendChild(bar);

    var fill = bar.firstChild;
    var queued = false;

    function paint() {
      var runway = document.documentElement.scrollHeight - window.innerHeight;
      var done = runway > 0 ? window.pageYOffset / runway : 0;
      fill.style.transform = "scaleX(" + Math.min(1, Math.max(0, done)) + ")";
      queued = false;
    }

    window.addEventListener("scroll", function () {
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    }, { passive: true });
    window.addEventListener("resize", paint, { passive: true });
    paint();
  }

  /* One short fact at a time, so the hero says a little more without
     adding another block of text to read. */
  function heroTicker() {
    var el = document.getElementById("heroTicker");
    if (!el) { return; }

    var lines = [
      "We reply to every enquiry within one working day.",
      "Every enquiry is tracked to the campaign that made it.",
      "Your domain, website and ad accounts stay in your name.",
      "Working across Nairobi, Mombasa, Kisumu and Kampala.",
      "The audit is free, and there is nothing to sign."
    ];
    var i = 0;

    /* written by JS, so the TreeWalker in i18n.js can never see it */
    function paint() {
      var lang = "en";
      try { lang = localStorage.getItem("juamedia.lang") || "en"; } catch (e) {}
      var sw = lang === "sw" && window.JuaLang ? window.JuaLang.lookup(lines[i]) : null;
      el.textContent = sw || lines[i];
    }

    document.addEventListener("jm:lang", paint);

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { return; }

    setInterval(function () {
      el.classList.add("out");
      setTimeout(function () {
        i = (i + 1) % lines.length;
        paint();
        el.classList.remove("out");
      }, 280);
    }, 4200);
  }

  ready(function () {
    progressBar();
    heroTicker();
  });
})();

/* ==========================================================================
   Article table of contents: mark the section being read
   ========================================================================== */
(function () {
  "use strict";
  function tocSpy() {
    var toc = document.querySelector(".toc");
    if (!toc || !("IntersectionObserver" in window)) { return; }

    var links = {};
    var heads = [];
    Array.prototype.forEach.call(toc.querySelectorAll("a[href^='#']"), function (a) {
      var id = a.getAttribute("href").slice(1);
      var h = document.getElementById(id);
      if (!h) { return; }
      links[id] = a;
      heads.push(h);
    });
    if (!heads.length) { return; }

    var seen = {};
    function mark() {
      var current = null;
      for (var i = 0; i < heads.length; i++) {
        /* the last heading whose top has passed the reading line */
        if (heads[i].getBoundingClientRect().top < 160) { current = heads[i].id; }
      }
      if (!current) { current = heads[0].id; }
      Object.keys(links).forEach(function (id) {
        links[id].classList.toggle("on", id === current);
      });
    }

    /* the observer only wakes the painter; the maths above decides */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      mark();
    }, { rootMargin: "-150px 0px -60% 0px" });
    heads.forEach(function (h) { io.observe(h); });

    var queued = false;
    window.addEventListener("scroll", function () {
      if (queued) { return; }
      queued = true;
      requestAnimationFrame(function () { mark(); queued = false; });
    }, { passive: true });

    mark();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tocSpy);
  } else {
    tocSpy();
  }
})();
