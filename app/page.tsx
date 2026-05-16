import { Suspense } from "react";
import { auth } from "@/auth";
import { signInWithGoogle, signOutAction, revokeAccessAction } from "./actions";
import { TopBar } from "./components/top-bar";
import { SignInCard } from "./components/sign-in-card";
import { DashboardSkeleton } from "./components/dashboard";
import { DashboardData } from "./components/dashboard-data";

export default async function Page() {
  const session = await auth();

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        user={
          session?.user
            ? {
                name: session.user.name ?? null,
                image: session.user.image ?? null,
                email: session.user.email ?? null,
              }
            : null
        }
        signOutAction={signOutAction}
        revokeAccessAction={revokeAccessAction}
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
          <SignInCard signInAction={signInWithGoogle} />
        )}
      </main>
    </div>
  );
}
