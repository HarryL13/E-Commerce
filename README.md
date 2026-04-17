# E-Commerce Studio

A unified AI-powered toolkit for e-commerce sellers, combining a **SKU Generator** and an **Image Studio** in one app.

All AI calls are proxied through **Cloudflare Pages Functions**, so no API keys are ever shipped to the browser. Access is gated by a shared password.

---

## Modules

### SKU Generator (Powered by Claude)
Generate complete Shopify product listings from a product image:
- AI-generated title, handle, HTML description, SEO title & description, tags, vendor, category, type
- Single product generation with a rich live editor
- Bulk generation (up to 6 images at once) — all auto-saved to history
- Variant manager (add/edit size, color, pricing per variant)
- Export to Shopify-compatible CSV
- Local storage history with edit, delete, and export-all support

**Model:** `claude-sonnet-4-6` (Anthropic)

### Image Studio (Powered by Gemini)
AI-powered product image generation and transformation:
- **Background** — swap product backgrounds to white studio, grey studio, or dark/transparent. Supports single and batch (up to 10 images)
- **Multi-View** — generate top-down, side profile, and close-up shots from one reference image. Supports single and batch
- **Scene** — place products into lifestyle/UGC/interaction scenes. Smart auto-analysis mode generates 5 themed variations automatically. Supports single and batch

**Model:** `gemini-2.5-flash-image` / `gemini-3-pro-image-preview` (Google)

---

## Architecture

```
Browser
  │
  │  fetch /api/* (with x-app-password header)
  ▼
Cloudflare Pages Functions (functions/api/*.ts)
  │
  │  server-side only — holds all API keys & proxy URLs
  ▼
Anthropic (or LiteLLM proxy) / Google Gemini
```

The front-end bundle contains **zero** secrets — no API keys, no passwords, no proxy URLs.

---

## Prerequisites

- Node.js 18+
- An **Anthropic API key** (or access to an Anthropic-compatible LiteLLM proxy)
- A **Gemini API key** — get one at [aistudio.google.com](https://aistudio.google.com)
- A **Cloudflare account** for deployment (free) — [cloudflare.com](https://cloudflare.com)

---

## Local development

### Option 1: Front-end only (fast, no server functions)

```bash
cd "E-commerce app/merged-app"
npm install
npm run dev
```

Runs Vite on `http://localhost:3000`. The API endpoints won't work because there's no function runtime, but it's fine for UI-only work.

### Option 2: Full stack (front-end + API functions)

```bash
# 1. Install dependencies
npm install

# 2. Configure local secrets
cp .env.example .dev.vars
# Edit .dev.vars and fill in your keys

# 3. Build the front-end once
npm run build

# 4. Run the Cloudflare Pages dev server
npx wrangler pages dev dist --port 3000 --compatibility-date=2025-04-01
```

Now `http://localhost:3000` serves the built front-end **and** the `/api/*` functions locally, with real secrets from `.dev.vars`.

To re-build after front-end changes: `npm run build` in another terminal.

---

## Environment variables

These are server-side only. They live in `.dev.vars` for local development and in Cloudflare Pages project settings for production.

| Name | Required | Purpose |
|---|---|---|
| `APP_PASSWORD` | ✅ | Password users must enter to access the site |
| `GEMINI_API_KEY` | ✅ | Google Gemini key |
| `ANTHROPIC_API_KEY` | ⚠️ one-of | Anthropic key. Required if using official API. |
| `ANTHROPIC_BASE_URL` | optional | Set to a custom URL (e.g. `http://1.2.3.4:4000`) to route Claude calls through a LiteLLM-style proxy instead of `api.anthropic.com`. |
| `ANTHROPIC_AUTH_TOKEN` | ⚠️ | Required when `ANTHROPIC_BASE_URL` is set. Sent as `Authorization: Bearer ...` to the proxy. |

See `.env.example` for a full template with comments.

---

## Deployment

### Cloudflare Pages

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** and select your repo.
3. Build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `merged-app` (if repo has a parent folder)
4. In **Settings** → **Environment variables** → **Production**, add every variable from the table above.
5. Redeploy. Your site will be live at `https://[project-name].pages.dev`.

Cloudflare Pages Functions live in `functions/api/` and are deployed automatically alongside the front-end. There is no separate server step.

---

## Project structure

```
functions/                   # Cloudflare Pages Functions (server-side)
└── api/
    ├── _utils/auth.ts       # Shared password-check + JSON helpers
    ├── auth.ts              # POST /api/auth — verify password
    ├── anthropic.ts         # POST /api/anthropic — Claude proxy
    ├── gemini-analyze.ts    # POST /api/gemini-analyze — Gemini vision
    └── gemini-generate.ts   # POST /api/gemini-generate — Gemini image gen

src/                         # Front-end
├── App.tsx                  # Top-level module switcher
├── SkuApp.tsx               # SKU Generator module
├── ImageStudioApp.tsx       # Image Studio module
├── main.tsx                 # React entry, wraps <App/> with <PasswordGate/>
├── components/
│   ├── PasswordGate.tsx     # Password prompt overlay
│   └── ... (UI components)
├── services/
│   ├── authClient.ts        # localStorage + apiFetch wrapper for /api/*
│   ├── gemini.ts            # Client for /api/anthropic (SKU)
│   └── geminiService.ts     # Client for /api/gemini-* (Studio)
└── utils/
    ├── csvExport.ts
    └── imageUtils.ts
```

---

## Usage

### Generating a Product Listing
1. Enter the password.
2. Switch to the **SKU Generator** tab.
3. Upload 1–6 product images, set a price, describe the series/template context.
4. Click **Generate Listing** (or **Bulk Generate** for all images).
5. Edit everything in the editor, then **Export CSV** or **Save Draft**.

### Generating Product Images
1. Switch to the **Image Studio** tab.
2. Select **Background**, **Multi-View**, or **Scene**.
3. Upload a reference image, pick a mode, and generate.

---

## Tech stack

| Layer | Technology |
|---|---|
| Front-end | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS 4 |
| Animation | Motion |
| Server | Cloudflare Pages Functions (Workers runtime) |
| AI — Text | Claude (via Anthropic API or LiteLLM proxy) |
| AI — Images | Google Gemini (REST API) |
| CSV Export | PapaParse |
| Icons | Lucide React |

---

## Scripts

```bash
npm run dev      # Vite dev server (UI only, no /api)
npm run build    # Production build into dist/
npm run preview  # Preview production build
npm run lint     # TypeScript type check
npm run clean    # Delete dist/

# Full-stack local dev (after npm run build):
npx wrangler pages dev dist --port 3000 --compatibility-date=2025-04-01
```
