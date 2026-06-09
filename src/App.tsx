// init and AuthType are the two SDK primitives needed for bootstrapping.
// init() must be called once — before any embed component mounts — and
// configures the SDK globally for every embed on the page.
import { init, AuthType } from '@thoughtspot/visual-embed-sdk';
import SpotterPage from './components/SpotterPage';

// The ThoughtSpot instance URL, e.g. https://your-instance.thoughtspot.cloud
// Set VITE_TS_HOST in your .env file. The VITE_ prefix makes it available
// in the browser bundle; without it Vite strips the value at build time.
const TS_HOST = import.meta.env.VITE_TS_HOST;

// ---------------------------------------------------------------------------
// getAuthToken — the SDK calls this whenever it needs a fresh bearer token.
//
// We proxy through our own Express server (/api/token → server.ts) instead
// of calling ThoughtSpot directly so the trusted auth secret_key never
// reaches the browser. The server returns { token: "..." }.
//
// The function must return a Promise<string> — the SDK awaits it before
// making any request to ThoughtSpot and re-calls it automatically when
// autoLogin: true detects the token is near expiry.
// ---------------------------------------------------------------------------
async function getAuthToken(): Promise<string> {
  const response = await fetch('/api/token');
  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }
  const data = (await response.json()) as { token: string };
  return data.token;
}

// ---------------------------------------------------------------------------
// init() — global SDK bootstrap. Called at module load time (outside React)
// so it runs exactly once, before any component tree mounts.
//
// thoughtSpotHost              → the TS instance this app embeds from
// authType TrustedAuthTokenCookieless
//   → uses the bearer token from getAuthToken() for every SDK request
//     instead of a session cookie. Required when the embedding app and
//     ThoughtSpot are on different domains, or when third-party cookies
//     are blocked by the browser.
// getAuthToken                 → callback the SDK invokes to fetch a token
// autoLogin: true              → SDK silently refreshes the token before it
//     expires (default validity is 5 min) so the user never sees a
//     logged-out embed mid-session.
// ---------------------------------------------------------------------------
init({
  thoughtSpotHost: TS_HOST,
  authType: AuthType.TrustedAuthTokenCookieless,
  getAuthToken,
  autoLogin: true,
});

// App is a thin shell — full-viewport container that hosts SpotterPage.
// All embed logic and the Basic/Branded toggle live in SpotterPage.
export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <SpotterPage />
    </div>
  );
}
