import type { ArticleSource } from "@/lib/editorial/types";

export function ArticleSources({ sources }: { sources: ArticleSource[] }) {
  return (
    <details className="editorial-sources">
      <summary>
        <span>Surse</span>
        <i aria-hidden="true" />
      </summary>
      <ol>
        {sources.map((source) => (
          <li key={source.url}>
            <div>
              <strong>{source.institution}</strong>
              <span>{source.year} · {source.type}</span>
            </div>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title} <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
