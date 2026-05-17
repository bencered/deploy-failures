import { auth } from "@/auth";
import { Dashboard } from "./dashboard";

export async function DashboardData() {
  const session = await auth();
  if (!session) return null;
  return <Dashboard />;
}
