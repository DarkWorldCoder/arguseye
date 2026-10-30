import { WeatherCard } from "@/components/WeatherCard";
import { NowPlaying } from "@/components/NowPlaying";
import { RevenueChart } from "@/components/RevenueChart";
import { BoardingPass } from "@/components/BoardingPass";
import { ChatThread } from "@/components/ChatThread";

export default function Showcase() {
  return (
    <div className="grid gap-8 p-10 sm:grid-cols-2">
      <WeatherCard city="Kathmandu" temp={24} condition="Mostly sunny" high={26} low={14} />
      <NowPlaying title="Midnight City" artist="Orbit Club" album="Neon Hours" elapsed="1:42" duration="3:58" progress={43} />
      <RevenueChart label="Monthly revenue" value="$48,210" delta="18.4%" />
      <BoardingPass passenger="Maya Chen" from="KTM" fromCity="Kathmandu" to="SFO" toCity="San Francisco" flight="AX 204" gate="B12" seat="14A" boarding="09:35" />
      <ChatThread name="Sam Rivera" status="Online" />
    </div>
  );
}
