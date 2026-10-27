import styles from "./Hero.module.css";
import badge from "./badge.svg";

export function Hero({ title, cta }: { title: string; cta: string }) {
  return (
    <section className="bg-blue-600 p-8 text-white" style={{ borderRadius: "var(--radius-card)" }}>
      <h1 className={styles.title}>{title}</h1>
      <img id="badge" src={badge.src} width={badge.width} height={badge.height} alt="" />
      <img id="logo" src="/dot.svg" alt="" />
      <a href="/start" className="mt-4 inline-block bg-brand px-[13px] py-2 hover:underline">{cta}</a>
    </section>
  );
}
