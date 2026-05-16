import "next-auth";
import "next-auth/jwt";

type AuthError = "RefreshTokenMissing" | "RefreshFailed";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    error?: AuthError;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: AuthError;
  }
}
