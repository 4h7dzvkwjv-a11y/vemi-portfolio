"use client";

/* eslint-disable @next/next/no-img-element -- local SVG exports preserve the approved Figma artwork. */

import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import styles from "./vemi-homepage-chapter-one-v2.module.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-chapter-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-chapter-serif",
  display: "swap",
});

const asset = (name: string) => `/assets/home-mobile/chapter-one-v2/${name}.svg`;

const directions = [
  {
    title: "Viață",
    copy: "Obiceiuri mici pentru echilibru zilnic.",
    href: "/stil-de-viata",
    icon: "leaf",
    featured: false,
  },
  {
    title: "Energie",
    copy: "Nutriție și somn pentru mai multă energie.",
    href: "/alimentatie",
    icon: "zap",
    featured: true,
  },
  {
    title: "Mișcare",
    copy: "Antrenamente eficiente, pentru orice nivel.",
    href: "/exercitii",
    icon: "activity",
    featured: false,
  },
] as const;

type VemiHomepageChapterOneV2Props = {
  onOpenWorkoutCreator: () => void;
};

export function VemiHomepageChapterOneV2({ onOpenWorkoutCreator }: VemiHomepageChapterOneV2Props) {
  return (
    <section
      className={`${styles.chapter} ${instrumentSans.variable} ${instrumentSerif.variable}`}
      data-figma-node="217:2"
      data-homepage-chapter="one-v2"
      aria-labelledby="chapter-one-v2-title"
    >
      <div className={styles.hero}>
        <img className={styles.heroGlow} src={asset("hero-glow-accent")} alt="" aria-hidden="true" />
        <h1 id="chapter-one-v2-title">
          Un program clar.<br />Mai ușor de urmat.
        </h1>
        <p>
          Planuri de antrenament gratuite, organizate pe patru săptămâni și alese pentru categoria ta. Fără
          PDF-uri. Fără cont obligatoriu.
        </p>
        <Link className={styles.primaryCta} href="/planuri-gratuite">
          <span>Alege programul gratuit</span>
          <span className={styles.primaryCtaIcon} aria-hidden="true">
            <img src={asset("arrow-lime")} alt="" />
          </span>
        </Link>
      </div>

      <nav className={styles.directions} aria-label="Direcțiile VEMI">
        {directions.map((direction) => (
          <Link
            className={`${styles.directionCard} ${direction.featured ? styles.directionCardFeatured : ""}`}
            href={direction.href}
            key={direction.title}
          >
            <span className={`${styles.directionIcon} ${direction.featured ? styles.directionIconFeatured : ""}`}>
              <img src={asset(direction.icon)} alt="" />
            </span>
            <strong>{direction.title}</strong>
            <span className={styles.directionCopy}>{direction.copy}</span>
            <span className={styles.directionArrow} aria-hidden="true">
              <img src={asset("arrow-dark")} alt="" />
            </span>
          </Link>
        ))}
      </nav>

      <div className={styles.workoutWrap}>
        <article className={styles.workoutCard} data-chapter-one-v2-workout>
          <img className={styles.workoutGlow} src={asset("workout-glow-accent")} alt="" aria-hidden="true" />
          <span className={styles.badge}>Instrument gratuit</span>
          <h2>Antrenamentul meu</h2>
          <p>Alege exercițiile, scrie seriile și repetările, apoi păstrează totul într-un singur loc.</p>
          <div className={styles.rule} aria-hidden="true" />
          <button className={styles.workoutCta} type="button" onClick={onOpenWorkoutCreator}>
            <span>Creează un antrenament</span>
            <span className={styles.workoutCtaIcon} aria-hidden="true">
              <img src={asset("arrow-lime-soft")} alt="" />
            </span>
          </button>
        </article>
      </div>
    </section>
  );
}
