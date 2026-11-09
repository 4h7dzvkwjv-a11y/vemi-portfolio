import styles from "./amv2.module.css";

export function Amv2Hero() {
  return (
    <section className={styles.compactHero} aria-labelledby="amv2-hero-title">
      <h1 id="amv2-hero-title">Antrenamentul meu</h1>
      <p>Creează și adaptează antrenamentele tale, apoi păstrează simplu ce ai făcut în fiecare zi.</p>
      <i aria-hidden="true" />
      <b aria-hidden="true" />
    </section>
  );
}
