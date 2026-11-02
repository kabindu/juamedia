# Ask Jua — live Claude answers (optional)

The website already has a working assistant. `js/chat.js` answers questions about
the services from a built-in knowledge base, with no server, no API key and no cost.

Run this proxy only when you want the assistant to **be Claude** — able to handle
any phrasing, follow a conversation, and answer questions nobody scripted.

## Why a server is needed

An API key cannot live in client-side JavaScript. Anything the browser downloads
can be read by anyone who opens developer tools, and a stolen key is billed to you.
This small process holds the key; the browser only ever talks to this process.

## Setup

```bash
cd server
npm install

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# macOS / Linux
export ANTHROPIC_API_KEY="sk-ant-..."

npm start
```

You should see:

```
Ask Jua proxy listening on http://localhost:8787/api/chat
```

Then add one line to each page, immediately **before** `js/chat.js`:

```html
<script>window.JUA_CHAT_API = "http://localhost:8787/api/chat";</script>
<script src="js/chat.js"></script>
```

That is the only change the website needs. If the proxy is not running, the widget
silently falls back to its built-in answers, so the site never shows a broken chat.

## What it does

- Model: `claude-opus-5-5`.
- Streams the reply, so it types out in the bubble instead of appearing all at once.
- Carries a written brief about Jua Media — every service, the pricing approach,
  timelines, process and contact details — as the system prompt.
- The brief is **prompt-cached**: it is identical on every request, so after the
  first call you pay roughly a tenth for that portion.
- `effort: "low"` keeps a website FAQ fast and inexpensive. Raise it in
  `chat-server.js` if answers feel thin.
- Conversation history is capped at the last 12 messages and each message at
  2000 characters, so a long chat cannot run up an unbounded bill.
- Aborts the Claude request if the visitor closes the tab mid-answer.

## Guardrails in the brief

The system prompt tells Claude to answer only about Jua Media and marketing in the
East African context, never to invent prices, figures or guarantees, to say so when
it does not know, and to reply in the language the visitor writes in (English or
Kiswahili). Edit `SYSTEM` in `chat-server.js` to change any of that.

## Before going live

1. Set `ALLOWED_ORIGIN` to your real domain instead of `*`:
   ```bash
   export ALLOWED_ORIGIN="https://juamedia.co.ke"
   ```
2. Host this behind HTTPS on your own domain and point `JUA_CHAT_API` at it.
3. Add rate limiting per IP — a public chat endpoint is a public spend endpoint.
4. Keep an eye on usage in the Anthropic Console for the first week.
