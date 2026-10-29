import { PricingCard } from "@/components/PricingCard";

export default function PricingPage() {
  return (
    <div className="flex flex-wrap justify-center gap-6">
      <PricingCard plan="Starter" price={0} features={["3 projects", "Community support"]} />
      <PricingCard
        plan="Pro"
        price={19}
        features={["Unlimited projects", "Priority support", "Custom domains"]}
        highlighted
      />
    </div>
  );
}
