/* ==========================================================================
   JUA MEDIA — "Ask Jua" chat widget
   The window, the messages and the buttons. The thinking happens in
   js/chat-brain.js, which answers from everything the site publishes
   (js/chat-knowledge.js, built by tools/build-knowledge.py). No server and
   no API key are needed.

   To upgrade to live Claude answers, run the proxy in /server and set
   window.JUA_CHAT_API = "https://your-proxy/api/chat" before this script.
   The key stays on the server; the local brain becomes the fallback.

   Public hooks:  JuaChat.open()   JuaChat.ask("question")
   ========================================================================== */

(function () {
  "use strict";
  if (window.JuaChat) { return; }   // never build the widget twice

  var panel, log, input, launcher, busy = false;
  var state = {};        // the brain's memory of this conversation
  var history = [];      // only used for the live-API path

  /* ----------------------------------------------------------------------
     Load the brain and its knowledge, once
     ---------------------------------------------------------------------- */
  var ready = null;
  function loadBrain() {
    if (ready) { return ready; }
    function script(src) {
      return new Promise(function (resolve) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = resolve;        // the brain still works without the knowledge file
        document.head.appendChild(s);
      });
    }
    ready = Promise.all([
      window.JUA_KNOWLEDGE ? Promise.resolve() : script("js/chat-knowledge.js"),
      window.JuaBrain ? Promise.resolve() : script("js/chat-brain.js")
    ]);
    return ready;
  }

  function lang() {
    return document.documentElement.getAttribute("lang") === "sw" ? "sw" : "en";
  }

  /* ----------------------------------------------------------------------
     Messages
     ---------------------------------------------------------------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined) { n.textContent = text; }
    return n;
  }

  function scroll() { log.scrollTop = log.scrollHeight; }

  // plain text only: blank lines become paragraphs, never HTML
  function fill(bubble, text) {
    bubble.textContent = "";
    String(text).split(/\n{2,}/).forEach(function (para) {
      var p = document.createElement("p");
      para.split("\n").forEach(function (line, j) {
        if (j) { p.appendChild(document.createElement("br")); }
        p.appendChild(document.createTextNode(line));
      });
      bubble.appendChild(p);
    });
  }

  function addMsg(who, text) {
    var row = el("div", "chat-msg chat-" + who);
    var bubble = el("div", "chat-bubble");
    fill(bubble, text);
    row.appendChild(bubble);
    log.appendChild(row);
    scroll();
    return row;
  }

  function addLinks(links, actions) {
    if ((!links || !links.length) && (!actions || !actions.length)) { return; }
    var wrap = el("div", "chat-links");
    (actions || []).forEach(function (a) {
      var b = el("button", "chat-link chat-action", a.label);
      b.type = "button";
      b.addEventListener("click", function () {
        if (a.action === "audit" && window.JuaAudit) { close(); window.JuaAudit.run(a.url); }
      });
      wrap.appendChild(b);
    });
    (links || []).forEach(function (l) {
      var a = el("a", "chat-link", l.label);
      a.href = l.href;
      if (/^https?:/.test(l.href)) { a.target = "_blank"; a.rel = "noopener"; }
      a.addEventListener("click", function () {
        // links to this site: close the sheet so the page underneath is visible
        if (!/^(https?:|tel:|mailto:)/.test(l.href)) { close(); }
      });
      wrap.appendChild(a);
    });
    log.appendChild(wrap);
    scroll();
  }

  function addChips(items) {
    if (!items || !items.length) { return; }
    var wrap = el("div", "chat-chips");
    items.slice(0, 4).forEach(function (t) {
      var b = el("button", null, t);
      b.type = "button";
      b.addEventListener("click", function () { send(t); });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    scroll();
  }

  function clearChips() {
    Array.prototype.forEach.call(log.querySelectorAll(".chat-chips"), function (c) { c.remove(); });
  }

  function thinking() {
    var row = el("div", "chat-msg chat-bot");
    var b = el("div", "chat-bubble chat-dots");
    b.innerHTML = "<i></i><i></i><i></i>";
    row.appendChild(b);
    log.appendChild(row);
    scroll();
    return row;
  }

  function show(out) {
    addMsg("bot", out.text);
    addLinks(out.links, out.actions);
    addChips(out.chips || (window.JuaBrain && window.JuaBrain.startChips));
  }

  /* ----------------------------------------------------------------------
     Local answers, with a short "typing" pause that grows with the reply
     ---------------------------------------------------------------------- */
  function localAnswer(text, wait) {
    loadBrain().then(function () {
      state.pageLang = lang();
      var out = window.JuaBrain ? window.JuaBrain.reply(text, state)
        : { text: "Sorry, I could not load my notes. Please WhatsApp +254 719 547 736.",
            links: [{ label: "WhatsApp", href: "https://wa.me/254719547736" }] };
      var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var delay = still ? 0 : Math.min(1400, 350 + out.text.length * 3);
      setTimeout(function () {
        if (wait && wait.parentNode) { wait.remove(); }
        show(out);
        busy = false;
      }, delay);
    });
  }

  /* ----------------------------------------------------------------------
     Live path: stream the proxy's answer and type it out as it arrives
     ---------------------------------------------------------------------- */
  function streamReply(text, wait) {
    var bubble = null, answer = "";

    function ensureBubble() {
      if (bubble) { return; }
      if (wait && wait.parentNode) { wait.remove(); }
      var row = el("div", "chat-msg chat-bot");
      bubble = el("div", "chat-bubble chat-typing");
      row.appendChild(bubble);
      log.appendChild(row);
    }

    function paint() { fill(bubble, answer); scroll(); }

    function finish() {
      if (!bubble) { return localAnswer(text, wait); }
      bubble.classList.remove("chat-typing");
      history.push({ role: "assistant", content: answer });
      addChips(window.JuaBrain ? window.JuaBrain.startChips : null);
      busy = false;
    }

    fetch(window.JUA_CHAT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, lang: lang() })
    })
      .then(function (r) {
        if (!r.ok || !r.body) { throw new Error("chat endpoint " + r.status); }
        var reader = r.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";

        return (function pump() {
          return reader.read().then(function (res) {
            if (res.done) { finish(); return; }
            buffer += decoder.decode(res.value, { stream: true });
            var parts = buffer.split("\n\n");      // events end with a blank line
            buffer = parts.pop();
            parts.forEach(function (chunk) {
              var line = chunk.split("\n").find(function (l) { return l.indexOf("data:") === 0; });
              if (!line) { return; }
              var evt;
              try { evt = JSON.parse(line.slice(5).trim()); } catch (e) { return; }
              if (evt.type === "delta") { ensureBubble(); answer += evt.text; paint(); }
              else if (evt.type === "replace") { ensureBubble(); answer = evt.text; paint(); }
              else if (evt.type === "error") { throw new Error("stream error"); }
            });
            return pump();
          });
        })();
      })
      .catch(function () {
        // proxy unreachable or failed mid-stream: the local brain answers
        if (bubble && answer) { finish(); return; }
        if (bubble && bubble.parentNode) { bubble.parentNode.remove(); bubble = null; }
        localAnswer(text, wait);
      });
  }

  function send(text) {
    text = (text || "").trim().slice(0, 600);
    if (!text || busy) { return; }
    busy = true;
    input.value = "";
    clearChips();
    addMsg("you", text);
    var wait = thinking();

    if (window.JUA_CHAT_API) {
      history.push({ role: "user", content: text });
      loadBrain();                 // ready as a fallback
      streamReply(text, wait);
      return;
    }
    localAnswer(text, wait);
  }

  /* ----------------------------------------------------------------------
     Open, close, build
     ---------------------------------------------------------------------- */
  function open() {
    panel.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("chat-open");   // phones: the sheet takes the screen
    if (!log.childNodes.length) {
      loadBrain().then(function () {
        if (log.childNodes.length) { return; }
        addMsg("bot", window.JuaBrain ? window.JuaBrain.greeting(lang())
          : "Hello! Ask me about Jua Media's services, prices and timelines.");
        addChips(window.JuaBrain ? window.JuaBrain.startChips : null);
      });
    }
    setTimeout(function () { input.focus(); }, 180);
  }

  function close() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("chat-open");
  }

  function build() {
    launcher = el("button", "chat-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "juaChat");
    launcher.innerHTML =
      '<span class="chat-tri" aria-hidden="true"></span>' +
      '<span class="chat-launcher-txt">Ask Jua</span>';

    panel = el("section", "chat-panel");
    panel.id = "juaChat";
    panel.setAttribute("aria-label", "Ask Jua, the Jua Media assistant");
    panel.innerHTML =
      '<header class="chat-head">' +
        '<span class="chat-head-mark" aria-hidden="true"></span>' +
        '<span class="chat-head-txt"><b>Ask Jua</b><span><i class="chat-live" aria-hidden="true"></i>AI assistant · replies instantly</span></span>' +
        '<button class="chat-close" type="button" aria-label="Close chat">&times;</button>' +
      '</header>' +
      '<div class="chat-log" role="log" aria-live="polite"></div>' +
      '<form class="chat-form">' +
        '<label for="juaChatInput" class="chat-sr">Your question</label>' +
        '<input id="juaChatInput" type="text" autocomplete="off" maxlength="600" placeholder="Ask anything — English or Kiswahili">' +
        '<button class="chat-send" type="submit" aria-label="Send"></button>' +
      '</form>' +
      '<p class="chat-foot">Need a person? <a href="https://wa.me/254719547736" target="_blank" rel="noopener">WhatsApp a strategist</a>.</p>';

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    log = panel.querySelector(".chat-log");
    input = panel.querySelector("#juaChatInput");

    launcher.addEventListener("click", function () {
      panel.classList.contains("open") ? close() : open();
    });
    panel.querySelector(".chat-close").addEventListener("click", close);
    panel.querySelector(".chat-form").addEventListener("submit", function (e) {
      e.preventDefault();
      send(input.value);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("open")) { close(); }
    });

    window.JuaChat = {
      open: open,
      ask: function (q) { open(); setTimeout(function () { send(q); }, 250); }
    };
    if (window.JUA_CHAT_PENDING) {
      var q = window.JUA_CHAT_PENDING;
      window.JUA_CHAT_PENDING = null;
      window.JuaChat.ask(q);
    }
    loadBrain();   // warm up while the visitor reads
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else { build(); }
})();
