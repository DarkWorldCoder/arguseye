import { useQuery } from "@tanstack/react-query";
export default function QueryUser() {
  const q = useQuery({ queryKey: ["user"], queryFn: async () => ({ name: "Query user" }) });
  return <p>{q.isPending ? "Query loading" : q.data?.name}</p>;
}
