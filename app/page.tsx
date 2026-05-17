import { Suspense } from "react";
import { auth } from "@/auth";
import { signInWithVercel, signOutAction } from "./actions";
import { TopBar } from "./components/top-bar";
import { SignInCard } from "./components/sign-in-card";
import { DashboardSkeleton } from "./components/dashboard";
import { DashboardData } from "./components/dashboard-data";

type SearchParams = Promise<{ auth_error?: string }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const { auth_error } = await searchParams;

  // Strip access tokens before passing to the client.
  const user = session
    ? {
        username: session.installations[0]?.username ?? null,
        installations: session.installations.map((i) => ({
          configurationId: i.configurationId,
          teamId: i.teamId,
          teamSlug: i.teamSlug,
          username: i.username,
        })),
      }
    : null;

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        user={user}
        signInAction={signInWithVercel}
        signOutAction={signOutAction}
      />
      <main
        className={`flex-1 w-full ${
          session ? "" : "flex items-center justify-center"
        }`}
      >
        {session ? (
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardData />
          </Suspense>
        ) : (
          <SignInCard signInAction={signInWithVercel} error={auth_error} />
        )}
      </main>
    </div>
  );
}
