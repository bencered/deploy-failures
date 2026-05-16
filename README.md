# vercel-fail-stats

A small Next.js app that signs into your Gmail, finds every Vercel "error deploying" email, and shows you a chart of how often Vercel has broken your day.

Styled to mimic the Vercel dashboard (Geist tokens, hairline borders, monospace IDs).

## One-time setup: Google OAuth credentials

The app uses Google OAuth + the Gmail API. You need your own OAuth client because Gmail scopes are sensitive.

1. Go to <https://console.cloud.google.com> and create (or pick) a project.
2. **APIs & Services → Library** → enable the **Gmail API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - Add yourself as a **Test user** (otherwise Google will block sign-in until the app is verified).
   - Add the scope `.../auth/gmail.readonly` under **Scopes**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
5. Copy the client ID and secret into `.env.local`.

## Run locally

```bash
cp .env.example .env.local
# fill in AUTH_SECRET (openssl rand -base64 32), AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
npm run dev
```

Open <http://localhost:3000>, sign in with the Google account whose inbox you want to scan.

## How it works

- `auth.ts` — NextAuth v5 with the Google provider, requesting `gmail.readonly`. The OAuth access token is stuffed into the JWT and exposed on `session.accessToken`.
- `app/api/stats/route.ts` — Gmail API search for `from:notifications@vercel.com subject:"error deploying"`, then a metadata fetch per message to get the date + subject. Subjects are parsed for the project name and environment.
- `app/components/dashboard.tsx` — Client component that fetches `/api/stats` and renders a Recharts bar chart + recent-failures list.

Tokens last an hour and are not refreshed automatically. Sign out and back in if you see 401s.

## Deploy

Works on Vercel. Add the env vars in the project settings and add a production redirect URI in the Google OAuth credentials (`https://<your-domain>/api/auth/callback/google`).

Also note Google will keep your OAuth app in "testing" mode until you submit for verification. For personal use this is fine — just add yourself as a test user and don't worry about it.
