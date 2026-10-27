export function PriceTag({ amount, format }: { amount: number; format: (amount: number) => string }) {
  return <output>{format(amount)}</output>;
}
