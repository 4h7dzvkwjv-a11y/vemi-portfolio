import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/editorial/article-card";
import {
  getNutritionCategory,
  getNutritionCategoryArticles,
  nutritionCategorySlugs,
} from "@/content/alimentatie/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";

type CategoryPageProps = { params: Promise<{ categorySlug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return nutritionCategorySlugs
    .filter((categorySlug) => categorySlug !== "calculator-caloric")
    .map((categorySlug) => ({ categorySlug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getNutritionCategory(categorySlug);
  if (!category) notFound();

  const metadata = createEditorialMetadata({
    title: category.title,
    description: category.description,
    path: `/alimentatie/${category.slug}`,
  });

  return metadata;
}

export default async function NutritionCategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const category = getNutritionCategory(categorySlug);
  if (!category) notFound();

  const articles = getNutritionCategoryArticles(category.slug);
  const countLabel = articles.length === 1 ? "1 articol" : `${articles.length} articole`;

  return (
    <main className="lifestyle-category-page">
      <section className="lifestyle-category-hero">
        <nav className="editorial-breadcrumb" aria-label="Fir de navigare">
          <ol>
            <li><Link href="/">Acasă</Link></li>
            <li><Link href="/alimentatie">Alimentație</Link></li>
            <li aria-current="page">{category.title}</li>
          </ol>
        </nav>
        <div className={`lifestyle-category-symbol ${category.visual}`} aria-hidden="true"><i /><b /></div>
        <p className="section-kicker">{category.eyebrow}</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
        <span>{countLabel}</span>
      </section>

      {articles.length ? (
        <section className="editorial-article-grid" aria-label={`Articole despre ${category.title.toLowerCase()}`}>
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} basePath="/alimentatie" />
          ))}
        </section>
      ) : (
        <section className="editorial-coming-soon" aria-labelledby="nutrition-coming-soon-title">
          <p className="section-kicker">În pregătire</p>
          <h2 id="nutrition-coming-soon-title">Articolele acestei categorii sunt în lucru.</h2>
          <p>Vom publica aici doar materiale complete, verificate și pregătite pentru a fi utile în practică.</p>
          <Link href="/alimentatie">Vezi toate subiectele</Link>
        </section>
      )}
    </main>
  );
}
