"use client";

/* eslint-disable @next/next/no-img-element -- exact local Figma exports preserve the approved artwork. */

import Link from "next/link";
import styles from "./vemi-homepage-mobile-v2.module.css";

type BillingPeriod = "monthly" | "quarterly";
type Subscription = "go" | "plus";

type VemiHomepageMobileProps = {
  billingPeriod: BillingPeriod;
  selectedSubscription: Subscription | null;
  onBillingPeriodChange: (period: BillingPeriod) => void;
  onOpenProgram: () => void;
  onOpenWorkoutCreator: () => void;
  onSelectSubscription: (subscription: Subscription) => void;
};

const asset = (name: string) => `/assets/home-mobile/homepage-v2/${name}`;

// Temporary destination until Chat VEMI is implemented in a dedicated task.
const CHAT_VEMI_CTA_HREF = "/abonamente";

const pillars = [
  { title: "Viață", copy: "Somn, stres și rutină", href: "/stil-de-viata", icon: "pillar-life.svg" },
  { title: "Energie", copy: "Nutriție și rețete simple", href: "/alimentatie", icon: "pillar-energy.svg" },
  { title: "Mișcare", copy: "Mai activ, mai sănătos", href: "/exercitii", icon: "pillar-motion.svg" },
] as const;

const steps = [
  { number: "01", copy: "Alegi categoria și vârsta.", icon: "step-user.svg" },
  { number: "02", copy: "Selectezi obiectivul.", icon: "step-target.svg" },
  { number: "03", copy: "Alegi nivelul, ritmul și locul.", icon: "step-sliders.svg" },
  { number: "04", copy: "Începi direct, fără cont.", icon: "step-play.svg" },
] as const;

const libraryCategories = [
  { label: "Stil de viață", href: "/stil-de-viata", icon: "library-life.svg" },
  { label: "Alimentație", href: "/alimentatie", icon: "library-food.svg" },
  { label: "Stres", href: "/stil-de-viata/stresul", icon: "library-stress.svg" },
  { label: "Calculator calorii", href: "/alimentatie/calculator-caloric", icon: "library-calculator.svg" },
  { label: "Rețete", href: "/alimentatie/retete-simple", icon: "library-recipes.svg" },
  // Devine interactiv după construirea categoriei Articole și aprobarea rutei.
  { label: "Articole", icon: "library-articles.svg" },
] as const;

const recommendationCategories = [
  { label: "Stil de viață", href: "/stil-de-viata", icon: "recommendations-life.svg", tone: "life" },
  { label: "Alimentație", href: "/alimentatie", icon: "recommendations-food.svg", tone: "food" },
  { label: "Stres", href: "/stil-de-viata/stresul", icon: "recommendations-stress.svg", tone: "stress" },
  { label: "Calculator calorii", href: "/alimentatie/calculator-caloric", icon: "recommendations-calculator.svg", tone: "calculator" },
  { label: "Rețete", href: "/alimentatie/retete-simple", icon: "recommendations-recipes.svg", tone: "recipes" },
  // Se conectează după construirea categoriei reale Intoleranțe și aprobarea rutei.
  { label: "Intoleranțe", icon: "recommendations-intolerances.svg", tone: "intolerances" },
] as const;

const chatTopics = [
  { label: "Antrenamente", icon: "chat-activity.svg" },
  { label: "Alimentație", icon: "chat-food.svg" },
  { label: "Stil de viață", icon: "chat-life.svg" },
] as const;

function DoubleChevron({ className = "" }: { className?: string }) {
  return (
    <span className={`${styles.doubleChevron} ${className}`} aria-hidden="true">
      ››
    </span>
  );
}

function ActionArrow({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${styles.actionArrow} ${compact ? styles.actionArrowCompact : ""}`} aria-hidden="true">
      <img src={asset(compact ? "action-arrow.svg" : "hero-arrow.svg")} alt="" />
    </span>
  );
}

export function VemiHomepageMobile({ onOpenWorkoutCreator }: VemiHomepageMobileProps) {
  return (
    <div
      className={`vemi-home-mobile vemi-home-mobile-chapter-one-v2 ${styles.page}`}
      id="vemi-home-mobile"
      data-figma-node="318:6"
      data-homepage-chapter="one-v2"
    >
      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="vemi-v2-hero-title" data-figma-node="318:9">
        <div className={styles.heroCopy}>
          <h1 id="vemi-v2-hero-title">Un program clar.<br />Mai ușor de urmat.</h1>
          <p>Planuri de antrenament gratuite, organizate pe patru săptămâni și alese pentru categoria ta. Fără PDF-uri. Fără cont obligatoriu.</p>
        </div>
        <Link className={styles.primaryCta} href="/planuri-gratuite">
          <span>Alege programul gratuit</span>
          <ActionArrow />
        </Link>
      </section>

      <nav className={`${styles.section} ${styles.pillars}`} aria-label="Direcțiile VEMI" data-figma-node="318:18">
        {pillars.map((pillar) => (
          <Link className={styles.pillarCard} href={pillar.href} key={pillar.title}>
            <span className={styles.pillarIcon} aria-hidden="true"><img src={asset(pillar.icon)} alt="" /></span>
            <span className={styles.pillarCopy}><strong>{pillar.title}</strong><span>{pillar.copy}</span></span>
            <DoubleChevron />
          </Link>
        ))}
      </nav>

      <section className={`${styles.section} ${styles.workoutSection}`} aria-labelledby="vemi-v2-workout-title" data-figma-node="318:46">
        <article className={styles.workoutCard}>
          <img className={styles.workoutIllustration} src={asset("workout-dumbbell.png")} alt="" aria-hidden="true" decoding="async" />
          <div className={styles.workoutUpper}>
            <span className={styles.darkBadge}>Instrument gratuit</span>
            <div className={styles.workoutCopy}>
              <h2 id="vemi-v2-workout-title">Antrenamentul meu</h2>
              <p>Alege exercițiile, scrie seriile și repetările, apoi păstrează totul într-un singur loc.</p>
            </div>
          </div>
          <span className={styles.darkRule} aria-hidden="true" />
          <button className={styles.workoutCta} type="button" onClick={onOpenWorkoutCreator}>
            <span>Creează un antrenament</span>
            <DoubleChevron className={styles.workoutChevron} />
          </button>
        </article>
      </section>

      <section className={`${styles.section} ${styles.choicesSection}`} aria-labelledby="vemi-v2-choices-title" data-figma-node="318:60">
        <article className={styles.choicesCard}>
          <img className={styles.checklistIllustration} src={asset("four-choices-checklist.png")} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <header className={styles.choicesHeader}>
            <span className={styles.lightBadge}>Simplu de la început</span>
            <h2 id="vemi-v2-choices-title">Patru alegeri.<br />Programul tău.</h2>
          </header>
          <ol className={styles.stepsList}>
            {steps.map((step) => (
              <li className={styles.step} key={step.number}>
                <span className={styles.stepNumber}>{step.number}</span>
                <span className={styles.stepIcon} aria-hidden="true"><img src={asset(step.icon)} alt="" /></span>
                <span>{step.copy}</span>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className={`${styles.section} ${styles.librarySection}`} aria-labelledby="vemi-v2-library-title" data-figma-node="318:99">
        <header className={styles.sectionHeader}>
          <h2 id="vemi-v2-library-title">Biblioteca VEMI</h2>
          <p>Recomandări clare, ușor de parcurs.</p>
        </header>
        <article className={styles.splitCard}>
          <div className={`${styles.splitIllustration} ${styles.libraryIllustration}`} aria-hidden="true">
            <img src={asset("library-books-stack-v2.png")} alt="" loading="lazy" decoding="async" />
          </div>
          <div className={styles.splitContent}>
            <span className={styles.recommendationBadge}><img src={asset("library-sparkles.svg")} alt="" aria-hidden="true" />Recomandări</span>
            <h3>Biblioteca<br />VEMI</h3>
            <p>Informații utile, explicate simplu și ușor de aplicat.</p>
            <DoubleChevron className={styles.splitChevron} />
          </div>
        </article>
        <div className={styles.sproutDivider} aria-hidden="true"><img src={asset("library-sprout.svg")} alt="" /></div>
        <nav className={styles.libraryCategories} aria-label="Categorii Biblioteca VEMI">
          {libraryCategories.map((category) => {
            if ("href" in category) {
              return (
                <Link href={category.href} className={styles.libraryCategory} key={category.label}>
                  <span className={styles.categoryIcon} aria-hidden="true"><img src={asset(category.icon)} alt="" /></span>
                  <span>{category.label}</span>
                </Link>
              );
            }

            return (
              <div className={styles.libraryCategory} data-planned-library-tile="articles" key={category.label}>
                <span className={styles.categoryIcon} aria-hidden="true"><img src={asset(category.icon)} alt="" /></span>
                <span>{category.label}</span>
              </div>
            );
          })}
        </nav>
      </section>

      <div className={styles.sectionDivider} aria-hidden="true" />

      <section className={`${styles.section} ${styles.exerciseSection}`} aria-labelledby="vemi-v2-exercise-title" data-figma-node="318:146">
        <article className={styles.exerciseCard}>
          <img className={`${styles.exerciseWave} ${styles.exerciseWaveOne}`} src={asset("exercise-wave-1.svg")} alt="" aria-hidden="true" />
          <img className={`${styles.exerciseWave} ${styles.exerciseWaveTwo}`} src={asset("exercise-wave-2.svg")} alt="" aria-hidden="true" />
          <img className={`${styles.exerciseWave} ${styles.exerciseWaveThree}`} src={asset("exercise-wave-3.svg")} alt="" aria-hidden="true" />
          <img className={styles.exerciseIllustration} src={asset("exercise-guide-approved.jpg")} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <span className={styles.lightBadge}>Exerciții</span>
          <h2 id="vemi-v2-exercise-title">Învață mișcarea.<br />Execută sigur.</h2>
          <p>Demonstrații clare, repere simple și cele mai frecvente greșeli pentru fiecare exercițiu.</p>
          <Link className={`${styles.primaryCta} ${styles.exerciseCta}`} href="/exercitii">
            <span>Descoperă exercițiile</span>
            <ActionArrow compact />
          </Link>
        </article>
      </section>

      <div className={styles.sectionDivider} aria-hidden="true" />

      <section className={`${styles.section} ${styles.recommendationsSection}`} aria-labelledby="vemi-v2-recommendations-title" data-figma-node="318:165">
        <header className={styles.sectionHeader}>
          <h2 id="vemi-v2-recommendations-title">Recomandări</h2>
          <p>Recomandări clare, ușor de parcurs.</p>
        </header>
        <article className={`${styles.splitCard} ${styles.recommendationsCard}`}>
          <div className={`${styles.splitIllustration} ${styles.recommendationsIllustration}`} aria-hidden="true">
            <img src={asset("recommendations-guide.png")} alt="" loading="lazy" decoding="async" />
          </div>
          <div className={styles.splitContent}>
            <span className={styles.recommendationBadge}><img src={asset("recommendations-sparkles.svg")} alt="" aria-hidden="true" />Recomandări</span>
            <h3>Ghiduri<br />practice</h3>
            <p>Informații utile, explicate simplu și ușor de aplicat.</p>
            <DoubleChevron className={styles.splitChevron} />
          </div>
        </article>
        <div className={styles.sproutDivider} aria-hidden="true"><img src={asset("recommendations-sprout.svg")} alt="" /></div>
        <nav className={styles.recommendationPills} aria-label="Categorii recomandări">
          {recommendationCategories.map((category) => {
            const toneClass = styles[`tone${category.tone[0].toUpperCase()}${category.tone.slice(1)}`];

            if ("href" in category) {
              return (
                <Link href={category.href} className={`${styles.recommendationPill} ${toneClass}`} key={category.label}>
                  <img src={asset(category.icon)} alt="" aria-hidden="true" />
                  <span>{category.label}</span>
                </Link>
              );
            }

            return (
              <div className={`${styles.recommendationPill} ${toneClass}`} data-planned-recommendation-pill="intolerances" key={category.label}>
                <img src={asset(category.icon)} alt="" aria-hidden="true" />
                <span>{category.label}</span>
              </div>
            );
          })}
        </nav>
      </section>

      <section className={`${styles.section} ${styles.chatSection}`} aria-labelledby="vemi-v2-chat-title" data-figma-node="318:209">
        <article className={styles.chatCard}>
          <header className={styles.chatHeader}>
            <span className={styles.chatBadge}>Vemi Plus</span>
            <h2 id="vemi-v2-chat-title">Chat VEMI</h2>
            <p>Pune întrebări, primește ghidare clară și conversații personalizate despre antrenamente, alimentație și stil de viață.</p>
          </header>
          <div className={styles.chatContent}>
            <div className={styles.chatTopics} aria-label="Subiecte Chat VEMI">
              {chatTopics.map((topic) => (
                <div className={styles.chatTopic} key={topic.label}>
                  <span aria-hidden="true"><img src={asset(topic.icon)} alt="" /></span>
                  <strong>{topic.label}</strong>
                </div>
              ))}
            </div>
            <div className={styles.chatPreview} aria-hidden="true">
              <div className={styles.chatPreviewHeader}>
                <span className={styles.chatAvatar}>V</span>
                <span><strong>VEMI</strong><small><i />Online</small></span>
              </div>
              <div className={`${styles.chatBubble} ${styles.chatBubbleUser}`}>Ce vrei să știi astăzi?</div>
              <div className={styles.chatBubble}>Cum îmi structurez antrenamentele pentru mai multă forță?</div>
              <div className={styles.chatBubble}>Hai să vedem împreună un plan potrivit pentru tine și obiectivele tale.</div>
              <img className={styles.typingIndicator} src={asset("chat-typing.svg")} alt="" />
            </div>
          </div>
          <div className={styles.chatIcon} aria-hidden="true"><img src={asset("chat-message.svg")} alt="" /></div>
          <span className={styles.darkRule} aria-hidden="true" />
          <Link className={`${styles.primaryCta} ${styles.chatCta}`} href={CHAT_VEMI_CTA_HREF}>
            <span>Deschide Chat VEMI</span>
            <ActionArrow />
          </Link>
          <div className={styles.chatAvailability}><img src={asset("chat-lock.svg")} alt="" aria-hidden="true" /><span>Disponibil în VEMI Plus</span></div>
        </article>
      </section>
    </div>
  );
}
