import type { ReactNode } from "react";

/** Requires the tenant the real application loads on the server. */
export function TenantShell({ tenant, children }: { tenant: { logo_key: string }; children: ReactNode }) {
  return <section aria-label={`Tenant ${tenant.logo_key}`}>{children}</section>;
}
