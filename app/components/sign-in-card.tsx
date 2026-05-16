import { AppMark } from "./app-mark";

export function SignInCard({ signInAction }: { signInAction: () => Promise<void> }) {
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
          See how often Vercel has emailed you about a failed deploy.
        </p>
        <form action={signInAction}>
          <button type="submit" className="btn-primary w-full">
            <GoogleIcon /> Continue with Google
          </button>
        </form>
        <p className="text-[12px] text-(--text-tertiary) mt-5 leading-relaxed">
          Requests read-only access to your Gmail. We only fetch messages from{" "}
          <span className="mono text-(--text-secondary)">notifications@vercel.com</span>{" "}
          and never store them.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.05-2.32Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
