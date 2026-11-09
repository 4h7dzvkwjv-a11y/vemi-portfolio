import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/editorial/article-card";
import { ArticleSources } from "@/components/editorial/article-sources";
import {
  getLifestyleArticle,
  getLifestyleCategory,
  getPublishedArticles,
  isSubscriptionCategory,
} from "@/content/stil-de-viata/catalog";
import { getArticleContent } from "@/content/stil-de-viata/content-registry";
import { getRecommendedArticles } from "@/lib/editorial/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";
import { hasActiveSubscription } from "@/utils/subscriptions/server";

type ArticlePageProps = { params: Promise<{ categorySlug: string; articleSlug: string }> };

export const dynamicParams = false;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return getPublishedArticles().map((article) => ({
    categorySlug: article.categorySlug,
    articleSlug: article.slug,
  }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { categorySlug, articleSlug } = await params;
  const article = getLifestyleArticle(categorySlug, articleSlug);
  if (!article || article.status !== "published") notFound();
  if (isSubscriptionCategory(categorySlug) && !(await hasActiveSubscription())) notFound();

  return createEditorialMetadata({
    title: article.title,
    description: article.summary,
    path: `/stil-de-viata/${article.categorySlug}/${article.slug}`,
    type: "article",
  });
}

export default async function LifestyleArticlePage({ params }: ArticlePageProps) {
  const { categorySlug, articleSlug } = await params;
  const article = getLifestyleArticle(categorySlug, articleSlug);
  const category = getLifestyleCategory(categorySlug);
  const articleContent = getArticleContent(categorySlug, articleSlug);

  if (!article || article.status !== "published" || !category || !articleContent) notFound();
  if (isSubscriptionCategory(categorySlug) && !(await hasActiveSubscription())) notFound();

  const publishedInCategory = getPublishedArticles(category.slug);
  const currentIndex = publishedInCategory.findIndex((item) => item.slug === article.slug);
  const previousArticle = currentIndex > 0 ? publishedInCategory[currentIndex - 1] : null;
  const nextArticle = currentIndex < publishedInCategory.length - 1 ? publishedInCategory[currentIndex + 1] : null;
  const recommended = getRecommendedArticles(getPublishedArticles(), article);

  return (
    <main className="lifestyle-article-page">
      <article>
        <header className="editorial-article-header">
          <nav className="editorial-breadcrumb" aria-label="Fir de navigare">
            <ol>
              <li><Link href="/">Acasă</Link></li>
              <li><Link href="/stil-de-viata">Stil de viață</Link></li>
              <li><Link href={`/stil-de-viata/${category.slug}`}>{category.title}</Link></li>
              <li aria-current="page">Articol</li>
            </ol>
          </nav>
          <div className="editorial-article-meta">
            <span>{article.label}</span>
            <span>aproximativ {article.readingTimeMinutes} minute</span>
          </div>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
        </header>

        {article.takeaways ? (
          <aside className="editorial-takeaways" aria-labelledby="takeaways-title">
            <p className="section-kicker" id="takeaways-title">Pe scurt</p>
            <ul>{article.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>
          </aside>
        ) : null}

        <div className="editorial-prose">
          {articleContent}
        </div>

        {article.sources?.length ? <ArticleSources sources={article.sources} /> : null}
      </article>

      {recommended.length ? (
        <section className="editorial-related" aria-labelledby="related-title">
          <header>
            <p className="section-kicker">Continuă lectura</p>
            <h2 id="related-title">Articole recomandate</h2>
          </header>
          <div>{recommended.map((item) => (
            <ArticleCard key={`${item.categorySlug}/${item.slug}`} article={item} basePath="/stil-de-viata" compact />
          ))}</div>
        </section>
      ) : null}

      {(previousArticle || nextArticle) ? (
        <nav className="editorial-article-navigation" aria-label="Navigare între articole">
          {previousArticle ? <Link href={`/stil-de-viata/${previousArticle.categorySlug}/${previousArticle.slug}`}>← {previousArticle.title}</Link> : <span />}
          {nextArticle ? <Link href={`/stil-de-viata/${nextArticle.categorySlug}/${nextArticle.slug}`}>{nextArticle.title} <span className="cta-arrow" aria-hidden="true">→</span></Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
