import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const TS_HOST = process.env.TS_HOST;
const TS_USERNAME = process.env.TS_USERNAME;
const TS_ORG_IDENTIFIER = process.env.TS_ORG_IDENTIFIER;
const TS_SECRET_KEY = process.env.TS_SECRET_KEY;

if (!TS_HOST || !TS_USERNAME || !TS_ORG_IDENTIFIER || !TS_SECRET_KEY) {
  console.error('Missing required env vars: TS_HOST, TS_USERNAME, TS_ORG_IDENTIFIER, TS_SECRET_KEY');
  process.exit(1);
}

app.get('/api/token', async (_req, res) => {
  try {
    const response = await fetch(`${TS_HOST}/api/rest/2.0/auth/token/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: TS_USERNAME,
        secret_key: TS_SECRET_KEY,
        org_identifier: TS_ORG_IDENTIFIER,
        persist_option: 'NONE',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('ThoughtSpot token error:', response.status, text);
      res.status(response.status).json({ error: text });
      return;
    }

    const data = await response.json() as { token: string };
    res.json({ token: data.token });
  } catch (err) {
    console.error('Token fetch failed:', err);
    res.status(500).json({ error: 'Failed to fetch auth token' });
  }
});

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`Token server listening on http://localhost:${PORT}`);
});
