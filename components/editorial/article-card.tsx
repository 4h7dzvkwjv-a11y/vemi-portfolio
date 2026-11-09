import Link from "next/link";
import type { EditorialArticle } from "@/lib/editorial/types";

export function ArticleCard({
  article,
  basePath,
  compact = false,
}: {
  article: EditorialArticle;
  basePath: string;
  compact?: boolean;
}) {
  return (
    <Link
      className={`editorial-article-card${compact ? " compact" : ""}`}
      href={`${basePath}/${article.categorySlug}/${article.slug}`}
    >
      <div className="editorial-article-card-top">
        <span>{article.label}</span>
        <small>~ {article.readingTimeMinutes} min</small>
      </div>
      <h2>{article.title}</h2>
      <p>{article.summary}</p>
      {!compact ? (
        <span className="editorial-article-cta">Citește articolul <span className="cta-arrow" aria-hidden="true">→</span></span>
      ) : null}
    </Link>
  );
}
