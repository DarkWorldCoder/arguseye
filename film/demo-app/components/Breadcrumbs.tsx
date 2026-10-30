type BreadcrumbsProps = {
  items: string[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm font-medium text-white/80">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          {i > 0 && <span className="text-white/40">/</span>}
          <span className={i === items.length - 1 ? "text-white" : undefined}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
