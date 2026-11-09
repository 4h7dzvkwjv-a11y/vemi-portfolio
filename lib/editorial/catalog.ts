import type { EditorialArticle } from "./types";

export function getRecommendedArticles<Article extends EditorialArticle>(
  articles: Article[],
  currentArticle: Article,
) {
  const articlesByScopedKey = new Map(
    articles.map((article) => [`${article.categorySlug}/${article.slug}`, article]),
  );

  return currentArticle.recommendedSlugs.flatMap((slug) => {
    const article = articlesByScopedKey.get(`${currentArticle.categorySlug}/${slug}`);
    return article?.status === "published" ? [article] : [];
  });
}
