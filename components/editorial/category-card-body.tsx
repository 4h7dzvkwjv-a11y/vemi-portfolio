import type { EditorialCategory } from "@/lib/editorial/types";

export function CategoryCardBody({
  category,
  index,
  availability,
  subscriptionLabel = false,
}: {
  category: EditorialCategory;
  index: number;
  availability: string;
  subscriptionLabel?: boolean;
}) {
  return (
    <>
      <span className="lifestyle-card-number">{String(index + 1).padStart(2, "0")}</span>
      <span className={`lifestyle-card-visual ${category.visual}`} aria-hidden="true">
        {category.visual === "mobility" ? (
          <svg viewBox="0 0 64 64" focusable="false">
            <path d="M41 6 31 22c-1.8 2.8-2.3 5.6-1.5 8.4" />
            <path d="m49 12-11.5 17.2" />
            <circle cx="31" cy="34" r="7" />
            <path d="M26.5 39.5 17 59" />
            <path d="M35.5 39.5 27 59" />
            <path className="mobility-motion" d="M44.5 25.5c5.7 8.2 4.1 18.6-3.5 25" />
          </svg>
        ) : (
          <><i /><b /></>
        )}
      </span>
      <p className="section-kicker">{category.eyebrow}</p>
      <h2>{category.title}</h2>
      <p>{category.description}</p>
      <span className="lifestyle-availability">{availability}</span>
      {subscriptionLabel ? (
        <span className="lifestyle-subscription-lock" role="img" aria-label="Necesită abonament" />
      ) : null}
      <span className="lifestyle-card-cta">Descoperă categoria <span className="cta-arrow" aria-hidden="true">→</span></span>
    </>
  );
}
