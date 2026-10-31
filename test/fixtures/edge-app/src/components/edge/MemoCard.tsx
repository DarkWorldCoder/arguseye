import { memo } from "react";
export const MemoCard = memo(function MemoCard({ title }: { title: string }) { return <section className="memo">Memo card: {title}</section>; });
export default MemoCard;
