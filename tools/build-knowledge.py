#!/usr/bin/env python3
"""
Build the Ask Jua knowledge file from the site's own pages.

Everything the assistant can quote comes from content already published on
the site: FAQ answers, article key points, marketing numbers, case studies
and guides. Re-run this whenever page content changes:

    python3 tools/build-knowledge.py

Writes:
    js/chat-knowledge.js   loaded by the chat widget in the browser
    server/knowledge.json  read by the optional Claude proxy
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def text(fragment):
    """HTML fragment -> plain text."""
    fragment = re.sub(r"<(script|style|svg)\b.*?</\1>", " ", fragment, flags=re.S)
    fragment = re.sub(r"<br\s*/?>", " ", fragment)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    out = re.sub(r"\s+", " ", html.unescape(fragment)).strip()
    return re.sub(r"\s+([,.;:!?])", r"\1", out)


def read(name):
    return (ROOT / name).read_text(encoding="utf-8")


def entries(page):
    """Yield (id, html) for each in-page view (.entry) on a page."""
    h = read(page)
    starts = [m.start() for m in re.finditer(r'<div class="entry" id="', h)]
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else h.index("<footer", s)
        yield re.search(r'id="([^"]+)"', h[s:s + 80]).group(1), h[s:e]


def faqs_in(fragment, page, anchor, topic):
    out = []
    for m in re.finditer(r'<button class="acc-q"[^>]*>(.*?)<span class="sign"></span>\s*</button>\s*'
                         r'<div class="acc-a"[^>]*>(.*?)</div>', fragment, re.S):
        q, a = text(m.group(1)), text(m.group(2))
        if q and a and q.lower() not in ("what sits under this service", "what this includes"):
            out.append({"q": q, "a": a, "topic": topic, "url": f"{page}#{anchor}" if anchor else page})
    return out


knowledge = {"services": [], "faqs": [], "articles": [], "stats": [], "cases": [], "guides": []}

# --- services: FAQs per service ------------------------------------------------
for eid, frag in entries("services.html"):
    title = text(re.search(r"<h1>(.*?)</h1>", frag, re.S).group(1))
    knowledge["faqs"] += faqs_in(frag, "services.html", eid, title)
    facts = dict((text(k), text(v)) for k, v in
                 re.findall(r'<div><b>(.*?)</b><span>(.*?)</span></div>', frag))
    inc = frag[frag.index('<div class="inc">'):]
    inc = inc[:inc.index("</section>")]
    steps = frag[frag.index('<div class="steps">'):]
    steps = steps[:steps.index("</section>")]
    knowledge["services"].append({
        "id": eid.replace("service-", ""),
        "title": title,
        "lede": text(re.search(r'<p class="lede">(.*?)</p>', frag, re.S).group(1)),
        "facts": facts,
        "includes": [{"t": text(t), "d": text(d)} for t, d in re.findall(r"<h3>(.*?)</h3>\s*<p>(.*?)</p>", inc, re.S)],
        "steps": [{"t": text(t), "d": text(d)} for t, d in re.findall(r"<h3>(.*?)</h3>\s*<p>(.*?)</p>", steps, re.S)],
        "url": f"services.html#{eid}",
    })

# pricing and about FAQs live in the listings
svc = read("services.html")
pricing = svc[svc.index('id="pricing"'):svc.index('<div class="entry"')]
knowledge["faqs"] += faqs_in(pricing, "services.html", "pricing", "Pricing")
about = read("about.html")
knowledge["faqs"] += faqs_in(about, "about.html", "faq", "About Jua Media")

# --- insights: articles, guides, numbers ----------------------------------------
for eid, frag in entries("blog.html"):
    if eid == "guides":
        knowledge["faqs"] += faqs_in(frag, "blog.html", "guides", "Guides")
        for m in re.finditer(r'<div class="card guide[^"]*">(.*?)</div>\s*(?=<div class="card guide|</div>)', frag, re.S):
            g = m.group(1)
            knowledge["guides"].append({
                "title": text(re.search(r"<h3>(.*?)</h3>", g, re.S).group(1)),
                "tag": text(re.search(r'<span class="tag">(.*?)</span>', g, re.S).group(1)),
                "who": text(re.search(r'<p class="who">(.*?)</p>', g, re.S).group(1)),
                "points": [text(x) for x in re.findall(r"<li>(.*?)</li>", g, re.S)],
                "url": "blog.html#guides",
            })
        continue
    if eid == "numbers":
        for block in re.finditer(r'<div class="stat-block" id="([^"]+)">\s*<h2>(.*?)</h2>(.*?)(?=<div class="stat-block"|$)', frag, re.S):
            for card in re.finditer(r'<article class="stat-card[^"]*">(.*?)</article>', block.group(3), re.S):
                c = card.group(1)
                knowledge["stats"].append({
                    "topic": text(block.group(2)),
                    "title": text(re.search(r"<h3>(.*?)</h3>", c, re.S).group(1)),
                    "detail": text(re.search(r"<p>(.*?)</p>", c, re.S).group(1)),
                    "url": f"blog.html#{block.group(1)}",
                })
        continue
    head = re.search(r"<h1>(.*?)</h1>", frag, re.S)
    if not head:
        continue
    take = re.search(r'<div class="takeaway">(.*?)</div>', frag, re.S)
    knowledge["articles"].append({
        "title": text(head.group(1)),
        "category": text(re.search(r'<span class="cat-pill">(.*?)</span>', frag, re.S).group(1)),
        "lede": text(re.search(r'<p class="lede">(.*?)</p>', frag, re.S).group(1)),
        "points": [text(x) for x in re.findall(r"<li>(.*?)</li>", take.group(1), re.S)] if take else [],
        "sections": [text(x) for x in re.findall(r'<h2 id="[^"]+">(.*?)</h2>', frag, re.S)],
        "url": f"blog.html#{eid}",
    })

# --- results: case studies ------------------------------------------------------
for eid, frag in entries("portfolio.html"):
    def grab(pat):
        m = re.search(pat, frag, re.S)
        return text(m.group(1)) if m else ""
    nums = re.findall(r'<span class="n">(.*?)</span><span class="k">(.*?)</span>', frag)
    details = dict((text(k).lower(), text(v)) for k, v in re.findall(r"<li><b>(.*?)</b><span>(.*?)</span></li>", frag))
    knowledge["cases"].append({
        "client": details.get("client", ""),
        "sector": details.get("sector", ""),
        "where": details.get("where", ""),
        "services": details.get("services", ""),
        "timeframe": details.get("timeframe", ""),
        "headline": grab(r"<h1>(.*?)</h1>"),
        "lede": grab(r'<p class="lede">(.*?)</p>'),
        "result": f"{text(nums[0][0])} {text(nums[0][1])}" if nums else "",
        "situation": grab(r'<h2 id="[^"]*situation">.*?</h2>\s*<p>(.*?)</p>'),
        "outcome": grab(r'<h2 id="[^"]*what-happened">.*?</h2>.*?</figure>\s*<p>(.*?)</p>'),
        "quote": grab(r"<blockquote>(.*?)</blockquote>"),
        "url": f"portfolio.html#{eid}",
    })

counts = {k: len(v) for k, v in knowledge.items()}
assert all(counts.values()), counts

js = ("/* Generated by tools/build-knowledge.py from the site's own pages. Do not edit by hand. */\n"
      "window.JUA_KNOWLEDGE = " + json.dumps(knowledge, ensure_ascii=False, indent=1) + ";\n")
(ROOT / "js" / "chat-knowledge.js").write_text(js, encoding="utf-8")
(ROOT / "server" / "knowledge.json").write_text(json.dumps(knowledge, ensure_ascii=False, indent=1), encoding="utf-8")
print("knowledge:", counts)
