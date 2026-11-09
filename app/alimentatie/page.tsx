import type { Metadata } from "next";
import { CategoryCard } from "@/components/editorial/category-card";
import {
  getNutritionCategoryAvailability,
  nutritionCategories,
} from "@/content/alimentatie/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";

export const metadata: Metadata = createEditorialMetadata({
  title: "Alimentație",
  description: "Articole VEMI despre calorii, nutrienți, mese, obiective și alegeri alimentare, explicate clar și practic.",
  path: "/alimentatie",
});

export default function NutritionPage() {
  return (
    <main className="lifestyle-page">
      <section className="lifestyle-hero">
        <div>
          <p className="section-kicker">Alimentație</p>
          <h1>Informații clare.<br />Alegeri mai simple.</h1>
        </div>
        <p>Calorii, nutrienți, mese și obiective, explicate fără reguli rigide sau promisiuni rapide.</p>
      </section>
      <section className="lifestyle-category-grid" aria-labelledby="nutrition-categories-title">
        <header className="lifestyle-grid-heading">
          <p className="section-kicker">Șase subiecte</p>
          <h2 id="nutrition-categories-title">Alege subiectul potrivit pentru tine.</h2>
        </header>
        {nutritionCategories.map((category, index) => (
          <CategoryCard
            key={category.slug}
            category={category}
            index={index}
            basePath="/alimentatie"
            availability={getNutritionCategoryAvailability(category.slug)}
          />
        ))}
      </section>
    </main>
  );
}
