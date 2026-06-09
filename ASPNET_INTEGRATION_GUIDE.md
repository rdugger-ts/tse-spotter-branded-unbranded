# Embedding ThoughtSpot Spotter in an ASP.NET Core Razor Pages App

This guide translates the React/Vite reference implementation into an ASP.NET Core
Razor Pages application. The auth flow and embed config are identical — only the
server-side language (C# instead of TypeScript) and the frontend SDK usage
(vanilla JS instead of React components) change.

---

## How It Works

```
Browser                    ASP.NET Core App              ThoughtSpot
  │                              │                             │
  │  GET /spotter                │                             │
  │ ────────────────────────────>│                             │
  │  HTML + inline JS            │                             │
  │ <────────────────────────────│                             │
  │                              │                             │
  │  SDK calls getAuthToken()    │                             │
  │  GET /api/token ────────────>│                             │
  │                              │  POST /api/rest/2.0/auth/   │
  │                              │       token/custom ─────────>
  │                              │  { token } <────────────────│
  │  { token } <─────────────────│                             │
  │                              │                             │
  │  SDK uses bearer token to    │                             │
  │  load Spotter iframe ────────────────────────────────────>│
```

**Key security rule:** the `secret_key` lives only in the ASP.NET server.  
The browser never sees it — it only ever receives a short-lived bearer token.

---

## Prerequisites

- .NET 8 or later
- An existing ASP.NET Core Razor Pages project (or `dotnet new razor -n MyApp`)
- ThoughtSpot trusted auth enabled — get the `secret_key` from  
  **Develop → Customizations → Security Settings** in your ThoughtSpot instance

---

## 1 — Configuration

### appsettings.json

Add a `ThoughtSpot` section. Put non-secret values here:

```json
{
  "ThoughtSpot": {
    "Host": "https://your-instance.thoughtspot.cloud",
    "WorksheetId": "your-model-or-worksheet-guid"
  }
}
```

### Secrets (never commit these)

Store sensitive values with the .NET Secret Manager during development:

```bash
dotnet user-secrets set "ThoughtSpot:Username"      "your-username"
dotnet user-secrets set "ThoughtSpot:OrgIdentifier" "your-org-name-or-id"
dotnet user-secrets set "ThoughtSpot:SecretKey"     "your-secret-key"
```

In production, set these as environment variables or use Azure Key Vault:

```
ThoughtSpot__Username      = your-username
ThoughtSpot__OrgIdentifier = your-org-name-or-id
ThoughtSpot__SecretKey     = your-secret-key
```

> **Note:** ASP.NET Core maps `ThoughtSpot__SecretKey` (double underscore) to
> `ThoughtSpot:SecretKey` in IConfiguration automatically.

---

## 2 — Token Endpoint

Add a minimal API endpoint in `Program.cs` that calls ThoughtSpot's
`/api/rest/2.0/auth/token/custom` and returns the token to the browser.

```csharp
// Program.cs
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorPages();
builder.Services.AddHttpClient(); // register IHttpClientFactory

var app = builder.Build();

app.UseStaticFiles();
app.MapRazorPages();

// ------------------------------------------------------------------
// GET /api/token
// Called by the Visual Embed SDK's getAuthToken callback.
// Exchanges the server-side secret_key for a short-lived bearer token
// and returns it to the browser as { "token": "..." }.
// The secret_key is never exposed to the client.
// ------------------------------------------------------------------
app.MapGet("/api/token", async (IConfiguration config, IHttpClientFactory httpFactory) =>
{
    var host          = config["ThoughtSpot:Host"]!;
    var username      = config["ThoughtSpot:Username"]!;
    var orgIdentifier = config["ThoughtSpot:OrgIdentifier"]!;
    var secretKey     = config["ThoughtSpot:SecretKey"]!;

    var payload = new
    {
        username,
        secret_key     = secretKey,
        org_identifier = orgIdentifier,
        persist_option = "NONE",   // no ABAC/RLS variables needed for a basic embed
    };

    var http = httpFactory.CreateClient();
    var response = await http.PostAsJsonAsync(
        $"{host}/api/rest/2.0/auth/token/custom", payload);

    if (!response.IsSuccessStatusCode)
    {
        var error = await response.Content.ReadAsStringAsync();
        return Results.Problem(error, statusCode: (int)response.StatusCode);
    }

    // ThoughtSpot returns { "token": "...", "creation_time_in_millis": ..., ... }
    // We surface only the token string to the browser.
    var json  = await response.Content.ReadFromJsonAsync<JsonElement>();
    var token = json.GetProperty("token").GetString();
    return Results.Ok(new { token });
});

app.Run();
```

---

## 3 — PageModel

Create a PageModel that passes the non-secret config values to the Razor view.
The secret values never leave the server.

```csharp
// Pages/Spotter.cshtml.cs
using Microsoft.AspNetCore.Mvc.RazorPages;

public class SpotterModel : PageModel
{
    private readonly IConfiguration _config;

    // These are safe to embed in the HTML — not secrets.
    public string ThoughtSpotHost { get; private set; } = string.Empty;
    public string WorksheetId     { get; private set; } = string.Empty;

    public SpotterModel(IConfiguration config) => _config = config;

    public void OnGet()
    {
        ThoughtSpotHost = _config["ThoughtSpot:Host"]         ?? string.Empty;
        WorksheetId     = _config["ThoughtSpot:WorksheetId"]  ?? string.Empty;
    }
}
```

---

## 4 — Razor Page: Basic Spotter Embed

```html
<!-- Pages/Spotter.cshtml -->
@page
@model SpotterModel

<!-- Container that the SDK renders the Spotter iframe into -->
<div id="ts-embed" style="width: 100%; height: 720px;"></div>

@section Scripts {
<script type="module">
/*
 * The Visual Embed SDK is loaded from the jsDelivr CDN as an ES module.
 * No npm or build step is required — this works in any modern browser.
 *
 * Pinning to a specific version (e.g. @1.39.0) is recommended for production
 * so a ThoughtSpot SDK release never silently breaks your embed.
 */
import {
    init,
    AuthType,
    SpotterEmbed,
    EmbedEvent,
} from 'https://cdn.jsdelivr.net/npm/@@thoughtspot/visual-embed-sdk/dist/tsembed.es.js';

// These values were rendered server-side by the PageModel — they are not secrets.
const TS_HOST     = '@Model.ThoughtSpotHost';
const WORKSHEET_ID = '@Model.WorksheetId';

// ------------------------------------------------------------------
// getAuthToken — called by the SDK whenever it needs a fresh token.
// Hits our own /api/token endpoint (never ThoughtSpot directly from
// the browser), which keeps the secret_key server-side.
// ------------------------------------------------------------------
async function getAuthToken() {
    const response = await fetch('/api/token');
    if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
    const data = await response.json();
    return data.token;
}

// ------------------------------------------------------------------
// init() — must be called once before rendering any embed component.
//
// AuthType.TrustedAuthTokenCookieless:
//   Uses a bearer token for every request instead of a session cookie.
//   Required when ThoughtSpot and your app are on different domains,
//   or when the browser blocks third-party cookies.
//
// autoLogin: true — SDK automatically refreshes the token before it
//   expires so the user never sees a signed-out embed.
// ------------------------------------------------------------------
init({
    thoughtSpotHost: TS_HOST,
    authType:        AuthType.TrustedAuthTokenCookieless,
    getAuthToken,
    autoLogin:       true,
});

// ------------------------------------------------------------------
// SpotterEmbed — renders ThoughtSpot's conversational AI inside the
// #ts-embed container.
//
// worksheetId            → the Model/Worksheet GUID to query against
// updatedSpotterChatPrompt → opt-in to the updated chat input UI
// ------------------------------------------------------------------
const embed = new SpotterEmbed('#ts-embed', {
    worksheetId:              WORKSHEET_ID,
    updatedSpotterChatPrompt: true,
});

// Lifecycle event listeners — useful for loading states and error handling
embed.on(EmbedEvent.Init,  ()  => console.log('Spotter SDK initialised'));
embed.on(EmbedEvent.Load,  ()  => console.log('Spotter iframe loaded'));
embed.on(EmbedEvent.Error, (e) => console.error('SpotterEmbed error:', e));

// Kick off the render — this injects the iframe into #ts-embed
embed.render();
</script>
}
```

---

## 5 — Razor Page: Adding the Branded Toggle

This extends the basic page with the same toggle from the reference app.
The branded config applies `customizations` (icon sprite + string overrides)
and `spotterChatConfig` (response card branding) on top of the basic embed.

```html
<!-- Pages/Spotter.cshtml (extended version) -->
@page
@model SpotterModel

<div style="display:flex; flex-direction:column; height:100%;">

    <!-- Toggle bar -->
    <div id="mode-bar" style="display:flex; align-items:center; gap:12px;
                               padding:10px 16px; background:#f8f8f8;
                               border-bottom:1px solid #e2e2e2;">
        <span id="mode-label"
              style="font-weight:600; font-size:14px; color:#333;">
            Basic Spotter
        </span>
        <button id="toggle-btn"
                style="padding:6px 16px; font-size:13px; font-weight:500;
                       cursor:pointer; border-radius:6px;
                       border:1px solid #1e6bf7; background:#1e6bf7; color:#fff;">
            Branded Spotter
        </button>
    </div>

    <div id="ts-embed" style="width:100%; height:720px;"></div>
</div>

@section Scripts {
<script type="module">
import {
    init,
    AuthType,
    SpotterEmbed,
    EmbedEvent,
} from 'https://cdn.jsdelivr.net/npm/@@thoughtspot/visual-embed-sdk/dist/tsembed.es.js';

const TS_HOST      = '@Model.ThoughtSpotHost';
const WORKSHEET_ID = '@Model.WorksheetId';

async function getAuthToken() {
    const response = await fetch('/api/token');
    if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
    const { token } = await response.json();
    return token;
}

init({
    thoughtSpotHost: TS_HOST,
    authType:        AuthType.TrustedAuthTokenCookieless,
    getAuthToken,
    autoLogin:       true,
});

// ------------------------------------------------------------------
// BRANDED_CUSTOMIZATIONS
// CustomisationsInterface has three sections:
//   iconSpriteUrl → replaces the default ThoughtSpot SVG icon set
//   content.strings   → global string replacements across the embed UI
//   content.stringIDs → targeted overrides using TS internal i18n keys
// ------------------------------------------------------------------
const BRANDED_CUSTOMIZATIONS = {
    iconSpriteUrl: 'https://cdn.jsdelivr.net/gh/datasketch45/public_assets/custom_icons.svg',
    content: {
        strings: {
            'Spotter':     'Wells',
            'ThoughtSpot': 'WF Analytics',
            'Let\'s make sense of your data together': 'Ask me anything about your data',
        },
        stringIDs: {
            // Landing-page hero greeting shown before the first message
            'spotter.newChatPrompt.landingPage.title': 'Hi, I’m Agent WF, your data analyst!',
        },
    },
};

// ------------------------------------------------------------------
// BRANDED_CHAT_CONFIG  (SpotterChatViewConfig)
//   hideToolResponseCardBranding  → hides TS logo in AI response cards
//   toolResponseCardBrandingLabel → replaces "ThoughtSpot" in card headers
//   spotterFileUploadEnabled      → shows file-upload button in chat input
// ------------------------------------------------------------------
const BRANDED_CHAT_CONFIG = {
    hideToolResponseCardBranding:  true,
    toolResponseCardBrandingLabel: 'WF Agent',
    spotterFileUploadEnabled:      true,
};

// ------------------------------------------------------------------
// renderEmbed(branded)
// Destroys any existing embed instance and creates a fresh one with
// the appropriate config. Re-rendering is necessary because the SDK
// does not support swapping customizations on a live iframe.
// ------------------------------------------------------------------
let currentEmbed = null;

function renderEmbed(branded) {
    // Clean up the previous iframe before creating a new one
    if (currentEmbed) {
        currentEmbed.destroy();
        currentEmbed = null;
    }

    currentEmbed = new SpotterEmbed('#ts-embed', {
        worksheetId:              WORKSHEET_ID,
        updatedSpotterChatPrompt: true,

        // Apply branding config objects only in branded mode;
        // passing undefined reverts to ThoughtSpot defaults.
        customizations:   branded ? BRANDED_CUSTOMIZATIONS : undefined,
        spotterChatConfig: branded ? BRANDED_CHAT_CONFIG   : undefined,
    });

    currentEmbed.on(EmbedEvent.Init,  ()  => console.log('Spotter initialised'));
    currentEmbed.on(EmbedEvent.Load,  ()  => console.log('Spotter loaded'));
    currentEmbed.on(EmbedEvent.Error, (e) => console.error('SpotterEmbed error:', e));

    currentEmbed.render();
}

// ------------------------------------------------------------------
// Toggle button wires the mode switch.
// Button label always shows the *destination*, not the current state.
// ------------------------------------------------------------------
let branded = false;
const label  = document.getElementById('mode-label');
const button = document.getElementById('toggle-btn');

button.addEventListener('click', () => {
    branded = !branded;
    label.textContent  = branded ? 'Branded Spotter' : 'Basic Spotter';
    button.textContent = branded ? 'Basic Spotter'   : 'Branded Spotter';
    renderEmbed(branded);
});

// Initial render — basic mode
renderEmbed(false);
</script>
}
```

> **Why re-render on toggle?**  
> The SDK renders Spotter inside an iframe. Customizations are baked into the
> iframe URL at render time, so there is no API to hot-swap them. Calling
> `destroy()` then `render()` is the correct pattern — it takes roughly the
> same time as a normal page load.

---

## 6 — Mapping to the React Reference App

| React / Node concept | ASP.NET Core equivalent |
|---|---|
| `server.ts` Express endpoint | `app.MapGet("/api/token", ...)` in `Program.cs` |
| `.env` file | `appsettings.json` + `dotnet user-secrets` |
| `import.meta.env.VITE_*` | `@Model.PropertyName` rendered by PageModel |
| `@thoughtspot/visual-embed-sdk` npm package | CDN ES module import |
| `<SpotterEmbed>` React component | `new SpotterEmbed('#id', config).render()` |
| Vite proxy (`/api → localhost:3001`) | Not needed — API lives in the same ASP.NET app |

---

## 7 — Quick-Start Checklist

- [ ] Trusted auth enabled in ThoughtSpot (**Develop → Security Settings**)
- [ ] `secret_key` stored in User Secrets / environment variable (not appsettings.json)
- [ ] `ThoughtSpot:Host` and `ThoughtSpot:WorksheetId` set in appsettings.json
- [ ] `/api/token` endpoint reachable from the browser (same origin — no CORS needed)
- [ ] Razor Page URL added to ThoughtSpot's **CORS allowed origins** list
- [ ] Browser console shows `Spotter initialised` and `Spotter loaded` on first load
