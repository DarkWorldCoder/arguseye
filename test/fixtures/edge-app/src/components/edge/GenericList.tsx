type Props<T> = { items: T[]; render: (item: T) => React.ReactNode; empty?: string };
export function GenericList<T>({ items, render, empty = "Nothing yet" }: Props<T>) { return items.length ? <ul>{items.map((i, n) => <li key={n}>{render(i)}</li>)}</ul> : <p>{empty}</p>; }
