# deploy-failures

Small Next.js app that signs in via Vercel OAuth, pulls every failed
deployment from the Vercel REST API, and graphs how often they've broken
your day. Styled after the Vercel dashboard (Geist tokens, hairline
borders, mono IDs).

---

## One-time setup: create a Vercel integration

1. Go to <https://vercel.com/dashboard/integrations/console> and click
   **Create**.
2. Fill out the form. Required fields include a name, logo (any PNG ≥ 256px),
   a privacy policy URL, and a contact email — Vercel is more lenient about
   real-world quality than Google but every field needs *something*.
3. Set the **Redirect URL** to `http://localhost:3000/api/auth/vercel/callback`
   for local dev. Add your production URL later: `https://<domain>/api/auth/vercel/callback`.
   Make sure to update this in your integration settings before deploying.
4. Under **API Scopes** select **Read** for `deployment`, `project`, `team`,
   and `user`. Nothing else.
5. Save. The integration gets a **Community** badge — that means it's
   installable from its URL (`https://vercel.com/integrations/<slug>`) but
   not listed on the public Marketplace. No review needed.
6. Open the integration's settings, copy the **URL Slug**, **Client ID**, and
   **Client Secret** into `.env.local`.

---

Unlike Google's Gmail API, Vercel doesn't require a security assessment or
verification process to allow internet users to install the integration.
Anyone with the install URL can use it immediately.

---

## Run locally

You can use `npm` or `yarn` if preferred.

```bash
cp .env.example .env.local
# fill in AUTH_SECRET, VERCEL_INTEGRATION_SLUG, VERCEL_CLIENT_ID, VERCEL_CLIENT_SECRET
npm install
npm run dev
```

Open <http://localhost:3000>, click **Continue with Vercel**, install the
integration on your personal account or a team.

---

## How it works

- `auth.ts` — reads an HMAC-signed session cookie via `next/headers`. No
  NextAuth, no third-party auth libraries. This keeps dependencies light
  and the auth flow transparent.
- `app/api/auth/vercel/start/route.ts` — generates a CSRF `state`, sets it
  in a cookie, redirects to Vercel's integration install URL.
- `app/api/auth/vercel/callback/route.ts` — validates state, exchanges the
  code for an access token via `POST /v2/oauth/access_token`, sets the
  signed session cookie.
- `lib/vercel-api.ts` — paginates `GET /v6/deployments?state=ERROR` to
  build the list the dashboard renders.
- `app/components/dashboard.tsx` — client component. Hydrates from
  `localStorage`, fetches fresh data via server action, renders the
  charts, legend, and Worst Days table.

---

## Deploy

Standard Vercel deploy. Add the four env vars in project settings, then add
and update the production redirect URI in your integration settings:

```
https://<your-domain>/api/auth/vercel/callback
```

---

Feel free to raise issues or PRs if you find bugs or have feature ideas. Thank you!
