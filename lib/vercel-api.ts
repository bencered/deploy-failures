// Fetches failed deployments from the Vercel REST API.
//
// Replaces the old Gmail-based approach: instead of parsing notification
// emails, we ask Vercel directly for deployments with state=ERROR. Source of
// truth, no email parsing, no Google OAuth.

const API_BASE = "https://api.vercel.com";

// Same shape the dashboard consumed under the Gmail-driven version, so the
// UI code is mostly transport-agnostic. Permission/unknown event kinds are
// gone — every deployment is a structured object.
export type DeployEvent = {
  id: string;
  project: string;
  team: string | null;
  environment: string;
  date: string;
  // Extra metadata available now that we're hitting the API directly. The
  // dashboard ignores these today, but they're cheap to include and may
  // power future features.
  url: string | null;
  branch: string | null;
  commitSha: string | null;
};

export class VercelAuthError extends Error {
  constructor() {
    super("vercel access token expired or revoked");
    this.name = "VercelAuthError";
  }
}

type ApiDeployment = {
  uid: string;
  name: string;
  url?: string | null;
  created: number;
  state?: string;
  readyState?: string;
  target?: string | null;
  meta?: {
    githubCommitSha?: string;
    githubCommitRef?: string;
    gitlabCommitSha?: string;
    gitlabCommitRef?: string;
    bitbucketCommitSha?: string;
    bitbucketCommitRef?: string;
  };
};

type DeploymentsResponse = {
  deployments?: ApiDeployment[];
  pagination?: { next?: number | null };
};

type TeamInfo = { slug?: string | null; name?: string | null };

function isAuthStatus(status: number) {
  return status === 401 || status === 403;
}

async function vercelGet<T>(
  path: string,
  accessToken: string,
  teamId: string | null
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Always hit the network — these requests run inside server actions and
    // are already coalesced by our React cache wrapper around auth().
    cache: "no-store",
  });
  if (isAuthStatus(res.status)) throw new VercelAuthError();
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`vercel api ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function fetchTeamSlug(
  accessToken: string,
  teamId: string | null
): Promise<string | null> {
  if (!teamId) return null;
  try {
    const team = await vercelGet<TeamInfo>(`/v2/teams/${teamId}`, accessToken, null);
    return team.slug ?? team.name ?? null;
  } catch (e) {
    // The team slug is cosmetic (top-bar display). Even if the user has not
    // granted `team` scope or the call 401s for some other reason, that's
    // not a fatal auth error — only the deployments fetch determines that.
    console.warn("fetchTeamSlug failed (non-fatal)", e);
    return null;
  }
}

function pickCommit(meta: ApiDeployment["meta"]): {
  sha: string | null;
  ref: string | null;
} {
  if (!meta) return { sha: null, ref: null };
  const sha =
    meta.githubCommitSha ?? meta.gitlabCommitSha ?? meta.bitbucketCommitSha ?? null;
  const ref =
    meta.githubCommitRef ?? meta.gitlabCommitRef ?? meta.bitbucketCommitRef ?? null;
  return { sha, ref };
}

export type FetchDeployFailuresOptions = {
  accessToken: string;
  teamId: string | null;
  /**
   * Optional cached team slug from install time. When provided we skip the
   * /v2/teams lookup entirely — useful because the `team` scope may be
   * "None" for users who didn't grant it, and we don't want a slug lookup
   * to count as an auth failure.
   */
  teamSlug?: string | null;
  /** Cap on number of failures to return. */
  limit: number;
};

export async function fetchDeployFailures({
  accessToken,
  teamId,
  teamSlug: cachedSlug,
  limit,
}: FetchDeployFailuresOptions): Promise<DeployEvent[]> {
  const teamSlug =
    cachedSlug !== undefined
      ? cachedSlug
      : await fetchTeamSlug(accessToken, teamId);

  const events: DeployEvent[] = [];
  let until: number | undefined = undefined;
  // Hard ceiling on page fetches in case Vercel's pagination loops on us.
  const maxPages = 200;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams();
    params.set("state", "ERROR");
    params.set(
      "limit",
      String(Math.max(1, Math.min(100, limit - events.length)))
    );
    if (until !== undefined) params.set("until", String(until));

    const data = await vercelGet<DeploymentsResponse>(
      `/v6/deployments?${params.toString()}`,
      accessToken,
      teamId
    );

    const deployments = data.deployments ?? [];
    if (deployments.length === 0) break;

    for (const d of deployments) {
      if (events.length >= limit) break;
      const { sha, ref } = pickCommit(d.meta);
      events.push({
        id: d.uid,
        project: d.name,
        team: teamSlug,
        environment: (d.target || "production").toLowerCase(),
        date: new Date(d.created).toISOString(),
        url: d.url ? `https://${d.url}` : null,
        branch: ref,
        commitSha: sha,
      });
    }

    if (events.length >= limit) break;
    const next = data.pagination?.next;
    if (next == null) break;
    until = next;
  }

  // Vercel already returns deployments in desc order, but if we ever batch
  // across teams we'd lose that — sort defensively. Cheap.
  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  return events;
}
