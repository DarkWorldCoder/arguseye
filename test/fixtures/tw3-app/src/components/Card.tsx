import styles from "./Card.module.scss";

export function Card({ label }: { label: string }) {
  return (
    <div className={`${styles.card} bg-brand p-5 rounded-lg`}>
      <span className={styles.label}>{label} world</span>
    </div>
  );
}
