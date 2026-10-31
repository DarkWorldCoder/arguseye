import { InvoiceCard } from "@/components/InvoiceCard";

export default function Billing() {
  return (
    <div className="flex flex-wrap gap-6 p-10">
      <InvoiceCard customer="Northwind Traders" amount={12480} due="Nov 14" status="overdue" />
      <InvoiceCard customer="Kathmandu Coffee Co." amount={860.5} due="Nov 28" status="paid" />
    </div>
  );
}
