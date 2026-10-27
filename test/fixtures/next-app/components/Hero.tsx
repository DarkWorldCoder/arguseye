import styles from "./Hero.module.css";

export function Hero({ title, cta }: { title: string; cta: string }) {
  return (
    <section className="bg-blue-600 p-8 text-white" style={{ borderRadius: "var(--radius-card)" }}>
      <h1 className={styles.title}>{title}</h1>
      <a href="/start" className="mt-4 inline-block bg-brand px-[13px] py-2 hover:underline">{cta}</a>
    </section>
  );
}
