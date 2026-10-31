import { FixedSizeList } from "react-window";
export default function VirtualRows({ count = 1000 }: { count?: number }) {
  return <FixedSizeList height={200} width={300} itemCount={count} itemSize={32}>{({ index, style }) => <div style={style}>Row {index}</div>}</FixedSizeList>;
}
