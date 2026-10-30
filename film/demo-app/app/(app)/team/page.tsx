import { ProfileCard } from "@/components/ProfileCard";

export default function Team() {
  return (
    <div className="flex flex-wrap gap-6 p-10">
      <ProfileCard name="Oluwaseun Adebayo-Richardson" role="Staff engineer, design systems" avatar="/avatars/oluwaseun.svg" followers={18204} />
      <ProfileCard name="Li Wei" role="iOS" avatar="/avatars/li.svg" followers={312} />
    </div>
  );
}
