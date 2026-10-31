import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
const data = [{ m: "Jan", v: 12 }, { m: "Feb", v: 30 }, { m: "Mar", v: 22 }];
export default function SalesChart() {
  return <div style={{ width: "100%", height: 240 }}><ResponsiveContainer><BarChart data={data}><XAxis dataKey="m" /><Bar dataKey="v" fill="#0e7490" isAnimationActive /></BarChart></ResponsiveContainer></div>;
}
