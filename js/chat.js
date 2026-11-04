/* ==========================================================================
   JUA MEDIA — "Ask Jua" assistant
   Answers questions about the services from a local knowledge base, so it
   works on a plain static site with no API key and no server.

   To upgrade it to live Claude answers, run the proxy in /server and set
   window.JUA_CHAT_API = "http://localhost:8787/api/chat" before this script.
   The key stays on the server; it is never shipped to the browser.
   ========================================================================== */

(function () {
  "use strict";
  if (window.JuaChat) { return; }   // never build the widget twice

  /* ----------------------------------------------------------------------
     Knowledge base. Each entry: keywords to match, plus an answer.
     ---------------------------------------------------------------------- */
  var KB = [
    {
      id: "services",
      k: ["services", "what do you do", "offer", "help with", "huduma", "mnafanya nini"],
      a: "We run ten services from our Nairobi office: social media management, Google Ads, SEO, AI search (GEO), content marketing, websites and conversion, branding and creative, data and reporting, digital PR, and print, radio and activations. Most clients start with one or two, not all ten.",
      sw: "Tunatoa huduma kumi kutoka ofisi yetu Nairobi: usimamizi wa mitandao ya kijamii, Matangazo ya Google, SEO, utafutaji wa AI, masoko ya maudhui, tovuti na mauzo, chapa na ubunifu, takwimu na ripoti, PR ya kidijitali, na magazeti, redio na matukio.",
      chips: ["How much does it cost?", "Tell me about SEO", "How do you work?"]
    },
    {
      id: "social",
      k: ["social", "tiktok", "instagram", "facebook", "whatsapp", "posting", "posts", "content calendar", "mitandao", "kijamii"],
      a: "We run your TikTok, Instagram, Facebook, LinkedIn and WhatsApp Business as a sales channel, not a noticeboard. That covers a monthly content calendar you approve in advance, graphics and short video, comments and DMs answered during working hours, and paid campaigns aimed at enquiries rather than likes. Captions can be English, Kiswahili or Sheng.",
      sw: "Tunaendesha TikTok, Instagram, Facebook, LinkedIn na WhatsApp Business yako kama njia ya mauzo. Hii inajumuisha kalenda ya maudhui unayoidhinisha mapema, michoro na video fupi, majibu ya maoni na ujumbe, na kampeni za kulipia zinazolenga maulizo.",
      chips: ["What does it cost?", "Do you write in Kiswahili?", "See your results"]
    },
    {
      id: "google",
      k: ["google ads", "adwords", "ppc", "paid search", "shopping", "performance max", "matangazo ya google"],
      a: "We plan, build and manage Google Search, Shopping, Display, YouTube and Performance Max campaigns. Before anything goes live we set up call tracking, form tracking and conversion tracking, so you see what each enquiry actually cost. We also optimise your Google Business Profile so you appear on Maps.",
      sw: "Tunapanga na kuendesha kampeni za Google Search, Shopping, Display, YouTube na Performance Max. Kabla ya kuanza tunaweka ufuatiliaji wa simu na fomu ili uone gharama halisi ya kila ulizo.",
      chips: ["What budget do I need?", "How soon will I see results?", "Tell me about SEO"]
    },
    {
      id: "seo",
      k: ["seo", "rank", "ranking", "page one", "search engine", "organic", "keywords", "google maps", "local seo"],
      a: "SEO is the asset you keep after the ads stop. We run a full technical audit and fix what is broken, research the keywords that carry buying intent in the Kenyan market, improve your on-page structure and schema, and build local signals like Google Business Profile, citations and reviews. Expect movement from month two and meaningful rankings by month four to six.",
      sw: "SEO ni mali unayobaki nayo matangazo yakiisha. Tunafanya ukaguzi kamili wa kiufundi, utafiti wa maneno yenye nia ya kununua, na kujenga ishara za eneo. Tarajia mabadiliko kuanzia mwezi wa pili.",
      chips: ["How long does SEO take?", "What is AI search?", "What does it cost?"]
    },
    {
      id: "ai",
      k: ["ai search", "chatgpt", "gemini", "geo", "aeo", "ai overview", "perplexity", "llm", "generative"],
      a: "Your customers increasingly ask ChatGPT, Gemini or Google's AI Overviews before they ask anyone else. AI search optimisation makes sure those answers name your business with the right facts. We track how AI tools describe you, structure your content so it can be quoted, add schema for your products and services, manage crawler access, and send a monthly AI visibility report.",
      sw: "Wateja wako huuliza ChatGPT, Gemini au AI Overviews kabla ya kumuuliza mtu yeyote. Tunahakikisha majibu hayo yanataja biashara yako kwa taarifa sahihi, na tunatuma ripoti ya kila mwezi.",
      chips: ["Tell me about SEO", "What does it cost?", "Book a free audit"]
    },
    {
      id: "web",
      k: ["website", "web design", "site", "online shop", "ecommerce", "e-commerce", "m-pesa", "mpesa", "landing page", "cro", "conversion", "tovuti"],
      a: "We build fast, mobile-first websites, landing pages and online shops with M-Pesa, card and pay-on-delivery checkout. Everything is tuned for one job: turning visitors into enquiries. Hosting, domain and business e-mail are set up in your name, and we train your staff so they can update it without calling us. A business website usually takes three to four weeks.",
      sw: "Tunajenga tovuti za haraka za simu kwanza, kurasa za kutua na maduka ya mtandaoni yenye malipo ya M-Pesa, kadi na lipa unapopokea. Hosting na domeni husajiliwa kwa jina lako. Tovuti ya biashara huchukua wiki tatu hadi nne.",
      chips: ["What does a website cost?", "Do you do M-Pesa checkout?", "How long does it take?"]
    },
    {
      id: "content",
      k: ["content", "blog", "articles", "copywriting", "writing", "email", "sms", "newsletter", "maudhui"],
      a: "We write the articles, guides and landing pages that pull buyers in month after month, starting with bottom-of-funnel pages that reach people ready to buy. That includes a content calendar tied to your funnel, copy in English, Kiswahili or Sheng, refreshing and interlinking older posts, and email or SMS campaigns that bring past customers back.",
      sw: "Tunaandika makala, miongozo na kurasa zinazovuta wanunuzi mwezi baada ya mwezi. Tunaandika kwa Kiingereza, Kiswahili au Sheng.",
      chips: ["Do you write in Kiswahili?", "Tell me about SEO", "What does it cost?"]
    },
    {
      id: "brand",
      k: ["brand", "branding", "logo", "identity", "photography", "video", "shoot", "packaging", "print design", "chapa"],
      a: "Branding and creative covers your logo, colours, fonts and a written brand guide, plus the material to advertise with: product photography, short-form video and reels, company profiles and decks, packaging and print, and signage or vehicle branding. A brand identity project usually runs two to three weeks.",
      sw: "Chapa na ubunifu inajumuisha nembo, rangi, fonti na mwongozo wa chapa, pamoja na picha za bidhaa, video fupi, wasifu wa kampuni, vifungashio na mabango.",
      chips: ["Do you do photography?", "What does it cost?", "See your work"]
    },
    {
      id: "data",
      k: ["data", "report", "reporting", "analytics", "dashboard", "tracking", "attribution", "measure", "roi", "takwimu", "ripoti"],
      a: "Every client gets conversion tracking, call tracking and lead attribution set up before campaigns go live, a live dashboard, and one plain-English report each month showing spend, enquiries, cost per enquiry and what we are changing next. If a campaign cannot be measured, we tell you before you pay for it.",
      sw: "Kila mteja hupata ufuatiliaji wa mauzo na simu, dashibodi ya moja kwa moja, na ripoti moja rahisi kila mwezi inayoonyesha matumizi, maulizo na gharama kwa kila ulizo.",
      chips: ["What is in the monthly report?", "How do you work?", "Book a free audit"]
    },
    {
      id: "pr",
      k: ["pr", "public relations", "press", "media coverage", "backlink", "links", "authority", "reviews"],
      a: "Digital PR earns the mentions that Google and AI engines treat as trust signals: Kenyan press placement, industry directories and citations, partner and supplier mentions, founder thought leadership, a reviews strategy, and cleaning up toxic backlinks pointing at your site.",
      chips: ["Tell me about SEO", "What is AI search?", "Book a free audit"]
    },
    {
      id: "offline",
      k: ["radio", "print", "billboard", "activation", "roadshow", "offline", "flyers", "signage", "exhibition"],
      a: "Not every customer is online all day. We plan and buy radio on national and vernacular stations, billboards and vehicle branding, market activations and roadshows, exhibition stands, and flyers or point-of-sale material. Every offline channel gets a unique phone number or short link so it stays measurable.",
      chips: ["What does it cost?", "Which industries do you serve?", "Talk to a human"]
    },
    {
      id: "pricing",
      k: ["price", "pricing", "cost", "how much", "fee", "quote", "budget", "charge", "expensive", "cheap", "bei", "gharama", "kiasi gani"],
      a: "We quote per client rather than publishing a price list, because a shop opening a second branch and a sacco with twenty thousand members need very different work. Your quote is shaped by three things: your goal, your capability (if you already have a designer or in-house marketer you pay us for less), and your vision. You get one fixed monthly figure agreed in writing before anything starts, and ad budget is always separate from our fee — it is paid from your own account so you can audit every shilling.",
      sw: "Tunapanga bei kwa kila mteja badala ya kuchapisha orodha, kwa sababu kila biashara ina lengo, uwezo na maono tofauti. Unapata bei moja isiyobadilika kwa mwezi, na bajeti ya matangazo ni tofauti na ada yetu.",
      chips: ["What is free?", "How long am I tied in?", "Get a quote"]
    },
    {
      id: "included",
      k: ["included", "free", "extra", "hidden", "what do i get"],
      a: "Always included at no extra charge: the initial audit and proposal, tracking and analytics setup, your monthly report and review call, everything registered in your name (domain, hosting, ad accounts), and a clean handover with no exit fees if you ever leave.",
      chips: ["What does it cost?", "How do you work?", "Book a free audit"]
    },
    {
      id: "contract",
      k: ["contract", "tied", "commitment", "notice", "cancel", "lock in", "minimum", "how long am i"],
      a: "Three months to start, because nothing meaningful can be judged in less than that. After the initial term it is month to month on thirty days' notice. There are no exit fees, and website or branding projects are fixed-scope and fixed-price rather than ongoing.",
      chips: ["What does it cost?", "How soon will I see results?", "Talk to a human"]
    },
    {
      id: "results",
      k: ["how long", "how soon", "results", "timeline", "when will", "fast", "matokeo", "muda gani"],
      a: "Paid campaigns bring enquiries in the first week, though month one is partly learning. SEO starts moving from month two and becomes meaningful by month four to six. Websites take three to four weeks to build. Anyone promising page one in two weeks is selling you something else.",
      sw: "Kampeni za kulipia huleta maulizo wiki ya kwanza. SEO huanza kusonga mwezi wa pili na huwa na maana mwezi wa nne hadi sita. Tovuti huchukua wiki tatu hadi nne.",
      chips: ["Tell me about SEO", "See your results", "Book a free audit"]
    },
    {
      id: "process",
      k: ["how do you work", "process", "steps", "onboarding", "start", "begin", "method", "jinsi"],
      a: "Four stages. One, we listen and audit: an hour with you, then a free written review of your site, pages and competitors. Two, we plan and quote: one page covering channels, message, targets and your price, with nothing spent before you approve. Three, we build and launch, with tracking working before anything goes live. Four, we run and report, with a monthly report and review call. Most clients are live in about three weeks.",
      sw: "Hatua nne: tunasikiliza na kukagua, tunapanga na kutoa bei, tunajenga na kuzindua, kisha tunaendesha na kuripoti. Wateja wengi huanza ndani ya wiki tatu.",
      chips: ["Book a free audit", "What does it cost?", "Who will I work with?"]
    },
    {
      id: "library",
      k: ["stats", "statistics", "numbers", "data", "research", "guide", "guides", "playbook",
          "free guide", "resources", "takwimu", "miongozo"],
      a: "Two things, both free and both open on the site. Marketing numbers (blog.html#numbers) has 36 figures across social media, search and AI, ad spend, websites, WhatsApp and online shops. Guides and playbooks (blog.html#guides) has nine step-by-step documents — the same checklists we hand a new client in their first week. No form and no download; ask and we send whichever one you want.",
      sw: "Vitu viwili, vyote bure na viko wazi kwenye tovuti. Takwimu za masoko zina takwimu 36 kuhusu mitandao, utafutaji na AI, matumizi ya matangazo, tovuti, WhatsApp na maduka ya mtandaoni. Miongozo ina nyaraka tisa za hatua kwa hatua. Hakuna fomu wala upakuaji.",
      chips: ["Open the marketing numbers", "Which guide should I read?", "Get a free audit"]
    },
    {
      id: "audit",
      k: ["audit", "review", "free plan", "proposal", "growth plan", "check my site", "ukaguzi"],
      a: "The audit is free and comes with no obligation. Send us your website or your social handles and you get back a written review of what is working, what is leaking money, and the three things to fix first — usually within one working day. You can request it from the contact page, or by WhatsApp on +254 719 547 736.",
      sw: "Ukaguzi ni bure na hauna masharti. Tutumie tovuti au akaunti zako za mitandao nasi tutakutumia mapitio ndani ya siku moja ya kazi.",
      chips: ["Get a free audit", "What does it cost?", "Where are you based?"]
    },
    {
      id: "contact",
      k: ["contact", "call", "phone", "email", "whatsapp", "reach", "talk to", "human", "person", "wasiliana", "simu"],
      a: "Call or WhatsApp +254 719 547 736, or email juamedia037@gmail.com. You can also walk into the office: 3rd Floor, Nyandarua House, Nairobi CBD, Monday to Friday 8:00–18:00 EAT. Every enquiry gets a reply from a strategist within one working day.",
      sw: "Piga au tuma WhatsApp +254 719 547 736, au barua pepe juamedia037@gmail.com. Ofisi: Ghorofa ya 3, Nyandarua House, Nairobi CBD.",
      chips: ["Book a free audit", "Where are you based?", "What are your hours?"]
    },
    {
      id: "location",
      k: ["where", "based", "located", "office", "nairobi", "mombasa", "kisumu", "nakuru", "eldoret", "uganda", "tanzania", "east africa", "wapi"],
      a: "We are based on the 3rd Floor of Nyandarua House, Nairobi CBD, and we meet Nairobi clients in person. We also work with clients in Mombasa, Kisumu, Nakuru and Eldoret, and across East Africa including Kampala and Dar es Salaam, over video call and WhatsApp — and we travel for launches and shoots.",
      sw: "Tuko Ghorofa ya 3, Nyandarua House, Nairobi CBD. Tunafanya kazi pia Mombasa, Kisumu, Nakuru, Eldoret, Kampala na Dar es Salaam.",
      chips: ["Talk to a human", "Which industries do you serve?", "Book a free audit"]
    },
    {
      id: "industries",
      k: ["industry", "industries", "sector", "retail", "hospitality", "clinic", "school", "sacco", "agribusiness", "real estate", "automotive", "manufacturing"],
      a: "We work across retail and hardware, hospitality and tourism, health and clinics, schools and colleges, saccos and microfinance, agribusiness, real estate, automotive, manufacturing and professional services. Most of our clients have between three and sixty staff.",
      chips: ["See your results", "Do you work with small businesses?", "Book a free audit"]
    },
    {
      id: "small",
      k: ["small business", "startup", "sme", "too small", "just starting", "biashara ndogo"],
      a: "Yes — most of our clients are SMEs with three to sixty staff. Because we quote per client, a small business pays for a small scope rather than a package built for someone bigger. Plenty of clients start with a single channel, or with a one-off project like a website, and add more only once the numbers justify it.",
      sw: "Ndiyo. Wateja wetu wengi ni biashara ndogo na za kati zenye wafanyakazi watatu hadi sitini. Kwa kuwa tunapanga bei kwa kila mteja, biashara ndogo hulipia kazi ndogo.",
      chips: ["What does it cost?", "Book a free audit", "How do you work?"]
    },
    {
      id: "team",
      k: ["team", "who", "staff", "about you", "experience", "years", "timu", "nani"],
      a: "Jua Media was founded in Nairobi in 2014 and is now fourteen specialists. You work with the same two or three people throughout — no account-handler relay. Alfred Kimani leads strategy, Naomi Wanjala heads social media, Dennis Otieno runs Google Ads and analytics, Faith Mwikali builds the websites, Brian Chebet leads SEO, and Lucy Achieng looks after client service.",
      sw: "Jua Media ilianzishwa Nairobi mwaka 2014 na sasa ni wataalamu kumi na wanne. Unafanya kazi na watu wale wale mwanzo hadi mwisho.",
      chips: ["How do you work?", "See your results", "Talk to a human"]
    },
    {
      id: "proof",
      k: ["results", "case study", "proof", "portfolio", "examples", "clients", "worked with", "matokeo"],
      a: "A few recent ones: Sokoni Hardware went from 41 to 169 enquiries a month on the same budget, with cost per enquiry down 54%. Mara Breeze Camp lifted direct bookings 68%. Rafiki Motors reached 4.1x return on ad spend over nine months. All nine case studies are on the Results page, with figures published from client accounts with permission.",
      sw: "Mifano ya hivi karibuni: Sokoni Hardware ilipanda kutoka maulizo 41 hadi 169 kwa mwezi; Mara Breeze Camp iliongeza nafasi za moja kwa moja kwa 68%; Rafiki Motors ilipata faida mara 4.1.",
      chips: ["What does it cost?", "Book a free audit", "How do you work?"]
    },
    {
      id: "language",
      k: ["kiswahili", "swahili", "sheng", "language", "english", "lugha"],
      a: "Yes — we write in English, Kiswahili and Sheng, depending on your audience and the platform. For many consumer brands the Kiswahili posts are the best performers. This website itself can be read in either English or Kiswahili using the language picker in the header.",
      sw: "Ndiyo. Tunaandika kwa Kiingereza, Kiswahili na Sheng kulingana na hadhira yako. Kwa chapa nyingi, machapisho ya Kiswahili ndiyo hufanya vizuri zaidi.",
      chips: ["Tell me about social media", "Book a free audit", "What does it cost?"]
    }
  ];

  var GREET = {
    en: "Hello. I can answer questions about what Jua Media does — our services, how we price, how long things take, or how to get started. What would you like to know?",
    sw: "Habari. Ninaweza kujibu maswali kuhusu Jua Media — huduma zetu, jinsi tunavyopanga bei, muda unaochukuliwa, au jinsi ya kuanza. Ungependa kujua nini?"
  };

  var FALLBACK = {
    en: "I am not certain about that one. I can cover our ten services, pricing, timelines, process, locations and how to get started. For anything else, a strategist will answer within one working day — call +254 719 547 736, WhatsApp +254 719 547 736, or use the contact page.",
    sw: "Sina uhakika kuhusu hilo. Ninaweza kueleza huduma zetu kumi, bei, muda, mchakato na maeneo. Kwa mengine, mkakati atajibu ndani ya siku moja ya kazi — piga +254 719 547 736."
  };

  var START_CHIPS = ["What services do you offer?", "How much does it cost?", "How soon will I see results?", "Book a free audit"];

  /* ----------------------------------------------------------------------
     Matching: score each entry against the question
     ---------------------------------------------------------------------- */
  function lang() {
    return document.documentElement.getAttribute("lang") === "sw" ? "sw" : "en";
  }

  function normalise(s) {
    return (" " + s + " ").toLowerCase().replace(/[^a-z0-9À-ɏ\s]/g, " ").replace(/\s+/g, " ");
  }

  function match(question) {
    var q = normalise(question);
    if (/^\s*(hi|hello|hey|habari|hujambo|sasa|niaje)\s*$/.test(q)) { return { greeting: true }; }

    var best = null, bestScore = 0;
    KB.forEach(function (entry) {
      var score = 0;
      entry.k.forEach(function (kw) {
        if (q.indexOf(" " + kw.toLowerCase()) !== -1 || q.indexOf(kw.toLowerCase() + " ") !== -1) {
          // longer keyword phrases are stronger evidence
          score += kw.indexOf(" ") !== -1 ? kw.length * 2 : kw.length;
        }
      });
      if (score > bestScore) { bestScore = score; best = entry; }
    });

    return bestScore >= 3 ? best : null;
  }

  function answerFor(entry) {
    if (!entry) { return { text: FALLBACK[lang()], chips: START_CHIPS }; }
    if (entry.greeting) { return { text: GREET[lang()], chips: START_CHIPS }; }
    var text = (lang() === "sw" && entry.sw) ? entry.sw : entry.a;
    return { text: text, chips: entry.chips || START_CHIPS };
  }

  /* ----------------------------------------------------------------------
     Widget
     ---------------------------------------------------------------------- */
  var panel, log, input, launcher, busy = false;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (html !== undefined) { n.innerHTML = html; }
    return n;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function addMsg(who, text) {
    var row = el("div", "chat-msg chat-" + who);
    row.appendChild(el("div", "chat-bubble", escapeHtml(text)));
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function addChips(items) {
    if (!items || !items.length) { return; }
    var wrap = el("div", "chat-chips");
    items.forEach(function (t) {
      var b = el("button", null, escapeHtml(t));
      b.type = "button";
      b.addEventListener("click", function () { send(t); });
      wrap.appendChild(b);
    });
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function thinking() {
    var row = el("div", "chat-msg chat-bot");
    row.appendChild(el("div", "chat-bubble chat-dots", "<i></i><i></i><i></i>"));
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  /* history kept only for the live-API path */
  var history = [];

  /* ----------------------------------------------------------------------
     Live path: read the server's event stream and type the answer out
     as it arrives, the way an assistant writes rather than pastes.
     ---------------------------------------------------------------------- */
  function localAnswer(text, wait) {
    if (wait && wait.parentNode) { wait.remove(); }
    var a = answerFor(match(text));
    addMsg("bot", a.text);
    addChips(a.chips);
    busy = false;
  }

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

    function paint() {
      bubble.textContent = answer;
      log.scrollTop = log.scrollHeight;
    }

    function finish() {
      if (!bubble) { return localAnswer(text, wait); }
      bubble.classList.remove("chat-typing");
      history.push({ role: "assistant", content: answer });
      addChips(START_CHIPS);
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

            // events are separated by a blank line
            var parts = buffer.split("\n\n");
            buffer = parts.pop();

            parts.forEach(function (chunk) {
              var line = chunk.split("\n").find(function (l) {
                return l.indexOf("data:") === 0;
              });
              if (!line) { return; }

              var evt;
              try { evt = JSON.parse(line.slice(5).trim()); } catch (e) { return; }

              if (evt.type === "delta") {
                ensureBubble();
                answer += evt.text;
                paint();
              } else if (evt.type === "replace") {
                ensureBubble();
                answer = evt.text;
                paint();
              } else if (evt.type === "error") {
                throw new Error("stream error");
              }
            });

            return pump();
          });
        })();
      })
      .catch(function () {
        // server unreachable or mid-stream failure: fall back to local answers
        if (bubble && answer) { finish(); return; }
        if (bubble && bubble.parentNode) { bubble.parentNode.remove(); bubble = null; }
        localAnswer(text, wait);
      });
  }

  function send(text) {
    text = (text || "").trim();
    if (!text || busy) { return; }
    busy = true;
    input.value = "";
    addMsg("you", text);

    var wait = thinking();

    // Live Claude answers when a proxy endpoint is configured, else local KB.
    if (window.JUA_CHAT_API) {
      history.push({ role: "user", content: text });
      streamReply(text, wait);
      return;
    }

    var a = answerFor(match(text));
    setTimeout(function () {
      wait.remove();
      addMsg("bot", a.text);
      addChips(a.chips);
      busy = false;
    }, 320);
  }

  function open() {
    panel.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    if (!log.childNodes.length) {
      addMsg("bot", GREET[lang()]);
      addChips(START_CHIPS);
    }
    setTimeout(function () { input.focus(); }, 180);
  }

  function close() {
    panel.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
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
    panel.setAttribute("aria-label", "Ask Jua Media about our services");
    panel.innerHTML =
      '<header class="chat-head">' +
        '<span class="chat-head-mark" aria-hidden="true"></span>' +
        '<span class="chat-head-txt"><b>Ask Jua</b><span>Questions about our services</span></span>' +
        '<button class="chat-close" type="button" aria-label="Close chat">&times;</button>' +
      '</header>' +
      '<div class="chat-log" role="log" aria-live="polite"></div>' +
      '<form class="chat-form">' +
        '<label for="juaChatInput" class="chat-sr">Your question</label>' +
        '<input id="juaChatInput" type="text" autocomplete="off" placeholder="Ask about our services...">' +
        '<button class="chat-send" type="submit" aria-label="Send"></button>' +
      '</form>' +
      '<p class="chat-foot">Answers cover our services. For a quote, <a href="about.html#contact">talk to a strategist</a>.</p>';

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

    // Public hook: the "Ask Jua" boxes on the pages call JuaChat.ask(question).
    window.JuaChat = {
      open: open,
      ask: function (q) { open(); setTimeout(function () { send(q); }, 200); }
    };
    if (window.JUA_CHAT_PENDING) {
      var q = window.JUA_CHAT_PENDING;
      window.JUA_CHAT_PENDING = null;
      window.JuaChat.ask(q);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else { build(); }
})();
