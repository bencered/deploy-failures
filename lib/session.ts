import crypto from "node:crypto";

// One Vercel integration install — personal account, or a specific team.
// Users can install the app on multiple scopes; we keep all their tokens
// in the session and merge deployments across them on read.
export type Installation = {
  accessToken: string;
  teamId: string | null;
  // Cached at install time so we don't need the `team` API scope on every
  // dashboard render. May be null when scope wasn't granted or this is a
  // personal install.
  teamSlug: string | null;
  userId: string;
  username: string | null;
  configurationId: string;
};

export type Session = {
  installations: Installation[];
  // Unix-seconds expiry. We check this on every decode so a stolen cookie
  // can't outlive its issuing window.
  exp: number;
};

export const SESSION_COOKIE = "deploy-failures-session";
export const OAUTH_STATE_COOKIE = "deploy-failures-oauth-state";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest();
}

// Cookie format: base64url(iv).base64url(ciphertext).base64url(authTag)
// AES-256-GCM is authenticated — tampering invalidates the tag, decryption
// throws. Encrypting (vs just signing) means the access tokens aren't
// visible to anything that captures the cookie (logs, proxies).
export function encodeSession(s: Session): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(s), "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function decodeSession(value: string | undefined): Session | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], "base64url");
    const ct = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ct),
      decipher.final(),
    ]).toString("utf-8");
    const obj = JSON.parse(plaintext) as Partial<Session>;
    if (typeof obj.exp !== "number") return null;
    if (obj.exp < Math.floor(Date.now() / 1000)) return null;
    if (!Array.isArray(obj.installations)) return null;
    // Validate each installation shape. Reject the whole session if any
    // entry is malformed — partial trust is worse than no trust.
    for (const inst of obj.installations) {
      if (
        !inst ||
        typeof inst.accessToken !== "string" ||
        typeof inst.userId !== "string" ||
        typeof inst.configurationId !== "string"
      ) {
        return null;
      }
    }
    return obj as Session;
  } catch {
    return null;
  }
}
