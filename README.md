# ThoughtSpot Spotter Embed Demo

A React + TypeScript + Vite demo that embeds [ThoughtSpot Spotter](https://developers.thoughtspot.com/docs/react-app-embed#_embed_spotter_for_conversation_analytics) — the conversational AI analytics experience — into a web page using **cookieless trusted authentication**.

The app demonstrates two embed modes toggled with a single button:

| Mode | What it shows |
|---|---|
| **Basic Spotter** | Vanilla ThoughtSpot Spotter — no customization |
| **Branded Spotter** | Fully re-branded embed styled via custom CSS theme, custom icons, renamed strings, custom AI persona, and branded response cards |

---

## Architecture

```
Browser (Vite / React)          Express Token Server (server.ts)        ThoughtSpot
        │                                    │                               │
        │  GET /api/token  ─────────────────>│                               │
        │                                    │  POST /api/rest/2.0/          │
        │                                    │       auth/token/custom ──────>
        │                                    │  { token } <──────────────────│
        │  { token } <───────────────────────│                               │
        │                                    │                               │
        │  SDK uses bearer token to load Spotter iframe ────────────────────>│
```

**Why a separate token server?**  
ThoughtSpot trusted auth requires a `secret_key` to mint bearer tokens. That key must never reach the browser. The Express server acts as a secure middleman — the browser only ever receives a short-lived token (default: 5 minutes).

---

## Project Structure

```
├── server.ts                    # Express token server — calls ThoughtSpot REST API
├── src/
│   ├── App.tsx                  # SDK init (cookieless auth) + root layout
│   └── components/
│       └── SpotterPage.tsx      # SpotterEmbed + Basic/Branded toggle + all brand config
├── vite.config.ts               # Vite config — proxies /api/* to Express server
├── .env.example                 # Template for required environment variables
└── ASPNET_INTEGRATION_GUIDE.md  # Porting guide for ASP.NET Core / Razor Pages
```

---

## Prerequisites

- **Node.js** 18 or later
- A ThoughtSpot instance with **Trusted Authentication** enabled  
  *(Develop → Customizations → Security Settings → Trusted Auth)*
- The `secret_key` generated from that settings page
- A Model or Worksheet GUID to load in Spotter

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Where it's used | Description |
|---|---|---|
| `VITE_TS_HOST` | Frontend (browser) | ThoughtSpot instance URL, e.g. `https://your-instance.thoughtspot.cloud` |
| `VITE_TS_WORKSHEET_ID` | Frontend (browser) | Model or Worksheet GUID for Spotter to query |
| `TS_HOST` | Server only | Same ThoughtSpot URL — used by Express to call the REST API |
| `TS_USERNAME` | Server only | ThoughtSpot username to authenticate as |
| `TS_ORG_IDENTIFIER` | Server only | Org name or numeric ID (for multi-tenant clusters) |
| `TS_SECRET_KEY` | Server only | Trusted auth secret key — **never commit this** |
| `PORT` | Server only | Express server port (default: `3001`) |

> `VITE_*` variables are embedded in the browser bundle by Vite at build time.  
> Non-prefixed variables are only available in the Node.js process and are never sent to the browser.

### 3. Run

```bash
npm run dev
```

This starts both servers concurrently:

- **Vite dev server** → [http://localhost:5173](http://localhost:5173)
- **Express token server** → [http://localhost:3001](http://localhost:3001)

Vite proxies all `/api/*` requests to the Express server, so the browser sees a single origin.

---

## How Authentication Works

This app uses `AuthType.TrustedAuthTokenCookieless` from the Visual Embed SDK.

1. The SDK calls `getAuthToken()` before rendering the Spotter iframe.
2. `getAuthToken()` fetches `/api/token` from the Express server.
3. The Express server calls `POST /api/rest/2.0/auth/token/custom` on ThoughtSpot using the `secret_key`.
4. ThoughtSpot returns a short-lived bearer token.
5. The SDK attaches that token as a `Bearer` header on every subsequent request to ThoughtSpot — no session cookie is created.
6. With `autoLogin: true`, the SDK automatically requests a new token before the current one expires, so the user never sees a signed-out embed.

---

## Branded Mode

Clicking **Branded Spotter** applies three layers of customization simultaneously. The toggle bar itself also re-themes to teal (`#004851`) so the entire UI — chrome and embed — matches the brand.

### 1. CSS Variables

| Variable | Value | Effect |
|---|---|---|
| `--ts-var-root-background` | `#F4FAFB` | Page/root background (pale teal tint) |
| `--ts-var-spotter-prompt-background` | `#EAF3F4` | Chat bubble backgrounds |
| `--ts-var-spotter-input-background` | `#FFFFFF` | Chat input box |
| `--ts-var-root-color` | `#1A1A1A` | Global text color |
| `--ts-var-button--primary-background` | `#004851` | Primary CTA buttons |
| `--ts-var-button--primary-color` | `#FFFFFF` | Primary button text |
| `--ts-var-button--secondary-background` | `#EAF3F4` | Secondary buttons |
| `--ts-var-button--secondary-color` | `#004851` | Secondary button text |
| `--ts-var-button--secondary--hover-background` | `#C5DEDE` | Secondary button hover |
| `--ts-var-viz-background` | `#FFFFFF` | Chart/viz card backgrounds |
| `--ts-var-viz-border-radius` | `8px` | Rounded chart cards |
| `--ts-var-viz-title-color` | `#004851` | Chart title color |
| `--ts-var-viz-description-color` | `#4A6B70` | Chart description text |
| `--ts-var-nav-background` | `#004851` | iframe nav/header bar |
| `--ts-var-nav-color` | `#FFFFFF` | iframe nav text |

### 2. Content overrides — strings and icons

```ts
customizations: {
  iconSpriteUrl: '...',          // Replaces the default ThoughtSpot SVG icon set
  content: {
    strings: {
      'Spotter':     'Abby',                   // Rename the AI persona
      'ThoughtSpot': 'Abby Analytics',   // Replace product name throughout
      "Let's make sense of your data together": 'Ask me anything about your data',
    },
    stringIDs: {
      // Targeted override for the landing page hero greeting
      'spotter.newChatPrompt.landingPage.title': "Hi, I'm Agent Abby, your data analyst!",
    },
  },
}
```

### 3. `spotterChatConfig` — response card branding

```ts
{
  hideToolResponseCardBranding:  true,       // Remove TS logo from AI response cards
  toolResponseCardBrandingLabel: 'Abby Agent', // Replace card header label
  spotterFileUploadEnabled:      true,       // Enable file upload in chat input
}
```

Clicking **Basic Spotter** passes `undefined` for all customizations, reverting to vanilla ThoughtSpot defaults.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both servers (Vite + Express) concurrently |
| `npm run dev:client` | Start only the Vite frontend |
| `npm run dev:server` | Start only the Express token server |
| `npm run build` | Type-check and build the frontend for production |
| `npm run preview` | Preview the production build locally |

---
