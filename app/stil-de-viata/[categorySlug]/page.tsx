import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/editorial/article-card";
import {
  getCategoryArticles,
  getLifestyleCategory,
  isSubscriptionCategory,
  lifestyleCategorySlugs,
} from "@/content/stil-de-viata/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";
import { hasActiveSubscription } from "@/utils/subscriptions/server";

type CategoryPageProps = { params: Promise<{ categorySlug: string }> };

export const dynamicParams = false;
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return lifestyleCategorySlugs.map((categorySlug) => ({ categorySlug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getLifestyleCategory(categorySlug);
  if (!category) notFound();
  if (isSubscriptionCategory(categorySlug) && !(await hasActiveSubscription())) notFound();

  return createEditorialMetadata({
    title: category.title,
    description: category.description,
    path: `/stil-de-viata/${category.slug}`,
  });
}

export default async function LifestyleCategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const category = getLifestyleCategory(categorySlug);
  if (!category) notFound();
  if (isSubscriptionCategory(categorySlug) && !(await hasActiveSubscription())) notFound();

  const articles = getCategoryArticles(category.slug);

  return (
    <main className="lifestyle-category-page">
      <section className="lifestyle-category-hero">
        <nav className="editorial-breadcrumb" aria-label="Fir de navigare">
          <ol>
            <li><Link href="/">Acasă</Link></li>
            <li><Link href="/stil-de-viata">Stil de viață</Link></li>
            <li aria-current="page">{category.title}</li>
          </ol>
        </nav>
        <div className={`lifestyle-category-symbol ${category.visual}`} aria-hidden="true"><i /><b /></div>
        <p className="section-kicker">{category.eyebrow}</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
        <span>{articles.length} articole</span>
      </section>
      <section className="editorial-article-grid" aria-label={`Articole despre ${category.title.toLowerCase()}`}>
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} basePath="/stil-de-viata" />
        ))}
      </section>
    </main>
  );
}
