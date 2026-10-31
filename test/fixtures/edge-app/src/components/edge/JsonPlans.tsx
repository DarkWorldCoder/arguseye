import data from "./plans.json";
export default function JsonPlans() { return <ul>{data.plans.map((p) => <li key={p}>{p}</li>)}</ul>; }
