import Link from "next/link";
import { AppMark } from "./app-mark";

export function SignInCard({
  signInAction,
  error,
}: {
  signInAction: () => Promise<void>;
  error?: string;
}) {
  return (
    <div className="w-full px-6 py-12">
      <div className="mx-auto max-w-[440px] card p-8 text-center">
        <div className="mx-auto h-10 w-10 rounded-full border border-(--border) flex items-center justify-center mb-5">
          <AppMark className="h-[14px] w-[14px] text-(--text-primary)" />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight mb-1">
          Deploy Failures
        </h1>
        <p className="text-[14px] text-(--text-secondary) mb-6">
          See how often your deploys have broken.
        </p>
        {error ? (
          <div className="mb-4 text-[12px] text-(--error) bg-(--gray-100) border border-(--border) rounded-md py-2 px-3">
            {errorMessage(error)}
          </div>
        ) : null}
        <form action={signInAction}>
          <button type="submit" className="btn-primary w-full">
            <VercelTriangleIcon /> Continue with Vercel
          </button>
        </form>
        <p className="text-[12px] text-(--text-tertiary) mt-5 leading-relaxed">
          Installs as a Vercel integration with read-only access to your
          deployments. No data is stored on our servers.
        </p>
        <div className="mt-5 pt-4 border-t border-(--border) flex justify-center gap-4 text-[12px] text-(--text-tertiary)">
          <Link href="/docs" className="hover:text-(--text-primary)">
            Docs
          </Link>
          <Link href="/privacy" className="hover:text-(--text-primary)">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-(--text-primary)">
            Terms
          </Link>
        </div>
      </div>
    </div>
  );
}

function VercelTriangleIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 76 65" aria-hidden fill="currentColor">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  );
}

// Maps the opaque ?auth_error=… code from the OAuth callback to a string the
// user can read. Codes intentionally don't leak server internals.
function errorMessage(code: string): string {
  switch (code) {
    case "state":
      return "Sign-in attempt expired or invalid. Please try again.";
    case "missing_code":
    case "missing_configuration":
    case "exchange":
      return "Vercel sign-in didn't complete. Please try again.";
    case "server":
      return "Server isn't configured for Vercel sign-in.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}
