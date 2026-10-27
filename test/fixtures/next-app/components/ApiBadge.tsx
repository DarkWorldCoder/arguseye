export function ApiBadge() {
  return <code data-secret={String(process.env.SECRET_TOKEN)}>{process.env.NEXT_PUBLIC_API_BASE}</code>;
}
