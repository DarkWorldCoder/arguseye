import { BoardingPass } from "@/components/BoardingPass";

export default function Trips() {
  return (
    <div className="grid gap-6 p-10 sm:grid-cols-2">
      <BoardingPass passenger="Arjun Shrestha" from="KTM" fromCity="Kathmandu" to="DEL" toCity="New Delhi" flight="AX 112" gate="A3" seat="2C" boarding="07:05" />
      <BoardingPass passenger="Maximiliana Featherstonehaugh" from="SFO" fromCity="San Francisco" to="NRT" toCity="Tokyo Narita" flight="AX 880" gate="G98" seat="41K" boarding="10:50" />
    </div>
  );
}
