import { google, gmail_v1 } from "googleapis";

export type DeployKind = "deploy" | "summary" | "permission" | "unknown";

export type DeployEvent = {
  id: string;
  threadId: string;
  kind: DeployKind;
  project: string;
  environment: string;
  team: string | null;
  // For permission denials, the username who tried to deploy.
  actor: string | null;
  subject: string;
  // First ~500 chars of the parsed body text, for debug display.
  snippet: string;
  date: string;
};

export class GmailAuthError extends Error {
  constructor() {
    super("gmail auth expired");
    this.name = "GmailAuthError";
  }
}

// Match any vercel.com sender (no-reply@, notifications@, …). Broad subject
// filter so we catch every failure variant Vercel sends. Exclude support-
// ticket replies that start with "RE:".
const QUERY = "from:vercel.com subject:Failed -subject:re:";

function header(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

type ParsedSubject = {
  kind: DeployKind;
  team: string | null;
  environment: string | null;
  actor: string | null;
};

function parseSubject(subject: string): ParsedSubject {
  // "Failed production deployment[s] on team 'generalmudkips-projects'"
  let m = subject.match(
    /Failed\s+(\w+)\s+deployments?\s+on\s+team\s+['"]([^'"]+)['"]/i
  );
  if (m) {
    return {
      kind: "summary",
      environment: m[1].toLowerCase(),
      team: m[2],
      actor: null,
    };
  }
  // "Failed <env> deployment[s]" — older Vercel format, no team in subject.
  // Team is in the body.
  m = subject.match(/^Failed\s+(\w+)\s+deployments?\s*$/i);
  if (m) {
    return {
      kind: "summary",
      environment: m[1].toLowerCase(),
      team: null,
      actor: null,
    };
  }
  // "Failed deployment from <user>" — git push from a non-team-member.
  m = subject.match(/Failed\s+deployment\s+from\s+(.+?)\s*$/i);
  if (m) {
    return { kind: "permission", environment: null, team: null, actor: m[1] };
  }
  return { kind: "unknown", environment: null, team: null, actor: null };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// Walk the Gmail payload tree and concatenate ALL text content (plain + html).
// We can't pick one — Vercel sends multipart/alternative where the text/plain
// is a short summary ("View deployment details") and the actual project name
// + canonical URL live only in the HTML version. Combining both means every
// parser downstream sees every signal.
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const decode = (data: string) =>
    Buffer.from(data, "base64url").toString("utf-8");

  const collect = (
    node: gmail_v1.Schema$MessagePart,
    kind: "text/plain" | "text/html",
    out: string[]
  ) => {
    if (node.mimeType === kind && node.body?.data) {
      out.push(decode(node.body.data));
    }
    for (const p of node.parts ?? []) collect(p, kind, out);
  };

  const plainParts: string[] = [];
  const htmlParts: string[] = [];
  collect(payload, "text/plain", plainParts);
  collect(payload, "text/html", htmlParts);

  const plainText = plainParts.join("\n");
  const htmlText = htmlParts.map(stripHtml).join("\n");

  let combined = [plainText, htmlText].filter(Boolean).join("\n");

  // Last resort — direct body data on the top-level payload when neither
  // text/plain nor text/html parts existed (rare: single-part messages).
  if (!combined && payload.body?.data) {
    const raw = decode(payload.body.data);
    combined = payload.mimeType === "text/html" ? stripHtml(raw) : raw;
  }

  return decodeHtmlEntities(combined);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Preserve href URLs — Vercel's emails put the canonical project URL
    // inside <a href="..."> attributes, which would otherwise be stripped
    // with the rest of the tag and the URL would be lost.
    .replace(/<a\s[^>]*?href=["']([^"']+)["'][^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ParsedBody = {
  kind: DeployKind;
  project: string;
  environment: string;
  team: string | null;
};

function parseBody(body: string, fromSubject: ParsedSubject): ParsedBody {
  // Highest-fidelity signal: the Vercel project URL embedded in the email.
  //   https://vercel.com/<team>/<project>/<deployment-id>
  // Excludes vercel.com/support, /help, /contact, etc.
  const RESERVED = new Set([
    "support",
    "help",
    "contact",
    "docs",
    "blog",
    "pricing",
    "templates",
    "new",
    "account",
    "dashboard",
    "design",
    "geist",
  ]);
  const urlRe =
    /https?:\/\/vercel\.com\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_./-]+?)(?=[\s/?#"<>]|$)/g;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRe.exec(body)) !== null) {
    const team = urlMatch[1];
    const project = urlMatch[2];
    if (RESERVED.has(team)) continue;
    const env =
      fromSubject.environment ??
      body.match(/(\w+)\s+environment/i)?.[1]?.toLowerCase() ??
      "";
    return { kind: "summary", project, environment: env, team };
  }

  // Original format: "There was an error deploying <project> to the <env> environment."
  let m = body.match(/error deploying\s+(.+?)\s+to the\s+(\w+)\s+environment\b/i);
  if (m) {
    return {
      kind: "deploy",
      project: m[1].trim(),
      environment: m[2].toLowerCase(),
      team: null,
    };
  }

  // Body-pattern fallbacks. Run these regardless of subject kind — a
  // subject that didn't match our regexes shouldn't lock the body parser
  // out of its remaining heuristics.
  const envFromBody =
    body.match(/(\w+)\s+environment/i)?.[1]?.toLowerCase() ?? "";
  const envFinal = fromSubject.environment ?? envFromBody;

  // "(<team>) for <project>"
  m = body.match(/\(([^)]+)\)\s+for\s+([A-Za-z0-9_-]+)/);
  if (m) {
    return { kind: "summary", team: m[1], project: m[2], environment: envFinal };
  }
  // "on the <team>'s projects team"
  const teamMatch = body.match(/on the\s+(.+?)\s+team/i);
  const team = teamMatch
    ? teamMatch[1].replace(/'s\s+projects?$/i, "")
    : null;
  // "for <project>"
  const projMatch = body.match(/\bfor\s+([A-Za-z0-9_-]+)/);
  if (projMatch) {
    return {
      kind: "summary",
      team,
      project: projMatch[1],
      environment: envFinal,
    };
  }
  // Multi-deploy summary
  m = body.match(/There (?:are|were)\s+(\d+)\s+deployments?\s+with/i);
  if (m) {
    return {
      kind: "summary",
      team,
      project: `(${m[1]} projects)`,
      environment: envFinal,
    };
  }

  if (fromSubject.kind === "permission") {
    return {
      kind: "permission",
      project: "(permission denied)",
      environment: "",
      team: null,
    };
  }

  return { kind: "unknown", project: "unknown", environment: "unknown", team: null };
}

function isAuthError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const obj = e as { code?: number; status?: number; response?: { status?: number } };
  const status = obj.code ?? obj.status ?? obj.response?.status;
  return status === 401 || status === 403;
}

export async function fetchDeployFailures(
  accessToken: string,
  limit: number
): Promise<DeployEvent[]> {
  const client = new google.auth.OAuth2();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  try {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const remaining = limit - ids.length;
      if (remaining <= 0) break;
      const list = await gmail.users.messages.list({
        userId: "me",
        q: QUERY,
        maxResults: Math.min(100, remaining),
        pageToken,
      });
      for (const m of list.data.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = list.data.nextPageToken ?? undefined;
    } while (pageToken);

    const capped = ids.slice(0, limit);
    const events: DeployEvent[] = [];
    // Gmail API quota: 250 units/user/second; messages.get costs 5 units →
    // 50 concurrent is the ceiling before we start eating 429s. Halves the
    // number of sequential round-trips vs. the previous chunk size of 25.
    const chunkSize = 50;
    for (let i = 0; i < capped.length; i += chunkSize) {
      const chunk = capped.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map((id) =>
          gmail.users.messages.get({
            userId: "me",
            id,
            // Full body so we can grep for the vercel.com URL — most reliable
            // way to extract team and project.
            format: "full",
          })
        )
      );
      for (const r of results) {
        if (!r.data.id) continue;
        const subject = header(r.data.payload?.headers ?? undefined, "Subject");
        const body = extractBody(r.data.payload ?? undefined);
        const ts = r.data.internalDate ? Number(r.data.internalDate) : NaN;
        if (Number.isNaN(ts)) continue;
        const sub = parseSubject(subject);
        const parsed = parseBody(body, sub);
        events.push({
          id: r.data.id,
          threadId: r.data.threadId ?? r.data.id,
          kind: parsed.kind,
          project: parsed.project,
          environment: parsed.environment || sub.environment || "unknown",
          team: sub.team ?? parsed.team,
          actor: sub.actor,
          subject,
          snippet: body.slice(0, 500),
          date: new Date(ts).toISOString(),
        });
      }
    }

    events.sort((a, b) => (a.date < b.date ? 1 : -1));
    return events;
  } catch (e) {
    if (isAuthError(e)) throw new GmailAuthError();
    throw e;
  }
}
