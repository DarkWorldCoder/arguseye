import type { ReactNode } from "react";

export type Tone = "info" | "success" | "danger";

interface AlertProps {
  /** Short heading shown in bold. */
  title: string;
  tone?: Tone;
  count?: number;
  dismissible?: boolean;
  tags?: string[];
  action?: { label: string; href: string };
  onClose?: () => void;
  children?: ReactNode;
}

export function Alert({ title, tone = "info", count, dismissible = true, tags = [], action, onClose, children }: AlertProps) {
  return (
    <div role="alert" data-tone={tone}>
      <strong>{title}</strong>
      {count !== undefined && <span>{count}</span>}
      {tags.map((t) => <em key={t}>{t}</em>)}
      {action && <a href={action.href}>{action.label}</a>}
      {children}
      {dismissible && <button onClick={onClose}>Close</button>}
    </div>
  );
}
