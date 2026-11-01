import "server-only";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";

const getPlan = unstable_cache(async () => "Pro");

export default async function AccountPage() {
  const store = await cookies();
  const plan = await getPlan();
  return <p>Plan {plan}, theme {store.get("theme")?.value ?? "default"}</p>;
}
