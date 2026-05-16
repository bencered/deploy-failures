import { auth } from "@/auth";
import { signInWithGoogle } from "../actions";
import { Dashboard, DashboardChrome } from "./dashboard";

export async function DashboardData() {
  const session = await auth();
  if (!session?.accessToken) return null;

  if (session.error) {
    return <DashboardChrome banner={<AuthExpiredBanner />} />;
  }

  return <Dashboard />;
}

function AuthExpiredBanner() {
  return (
    <form action={signInWithGoogle} className="card p-4 flex items-center justify-between gap-4">
      <div className="text-[13px]">
        <span className="text-(--warning)">Your Google session expired.</span>{" "}
        <span className="text-(--text-secondary)">Sign in again to refresh access.</span>
      </div>
      <button type="submit" className="btn-secondary btn-sm">
        Re-authenticate
      </button>
    </form>
  );
}
