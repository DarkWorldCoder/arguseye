import { StatsCard } from "@/components/StatsCard";
import { Toast } from "@/components/Toast";
import { ProfileCard } from "@/components/ProfileCard";
import { CommandMenu } from "@/components/CommandMenu";

export default function Dashboard() {
  return (
    <div className="grid gap-6 p-10">
      <StatsCard label="Weekly active users" value="12,480" change="+8.2%" points={[3, 4, 3.6, 5, 4.8, 6.2, 7, 6.6, 8.1, 9]} />
      <Toast title="Deployed to production" detail="acme-web · main · 41 files changed" />
      <ProfileCard name="Maya Chen" role="Design lead" avatar="/avatars/maya.svg" followers={2481} />
      <CommandMenu query="open sett" items={[{ label: "Open settings", hint: "⌘ ," }, { label: "Open billing", hint: "G B" }, { label: "Open team", hint: "G T" }]} />
    </div>
  );
}
