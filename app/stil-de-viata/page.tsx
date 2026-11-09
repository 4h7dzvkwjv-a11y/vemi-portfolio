import type { Metadata } from "next";
import { CategoryCard } from "@/components/editorial/category-card";
import { SubscriptionCategoryCard } from "@/components/editorial/subscription-category-card";
import { getCategoryAvailability, lifestyleCategories } from "@/content/stil-de-viata/catalog";
import { createEditorialMetadata } from "@/lib/editorial/seo";
import { hasActiveSubscription } from "@/utils/subscriptions/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = createEditorialMetadata({
  title: "Stil de viață",
  description: "Articole VEMI despre somn, stres, program zilnic, recuperare și mișcare, explicate clar și aplicabil.",
  path: "/stil-de-viata",
});

export default async function LifestylePage() {
  const hasSubscription = await hasActiveSubscription();

  return (
    <main className="lifestyle-page">
      <section className="lifestyle-hero">
        <div>
          <p className="section-kicker">Stil de viață</p>
          <h1>Informații clare.<br />Ușor de aplicat.</h1>
        </div>
        <p>Somn, stres, program zilnic, recuperare și mișcare, explicate simplu și practic.</p>
      </section>
      <section className="lifestyle-category-grid" aria-labelledby="lifestyle-categories-title">
        <span className="lifestyle-botanical" aria-hidden="true">
          <svg viewBox="0 0 220 390" aria-hidden="true" focusable="false">
            <path d="M61 380C92 332 116 288 127 244C139 194 135 147 153 105C165 76 180 50 193 25" />
            <path d="M124 257C91 257 64 238 50 208C85 205 114 222 124 257Z" />
            <path d="M133 220C142 184 169 162 202 158C197 193 172 216 133 220Z" />
            <path d="M136 174C104 170 82 149 74 120C107 123 130 142 136 174Z" />
            <path d="M151 117C158 84 181 63 211 58C208 89 186 112 151 117Z" />
            <path d="M175 66C155 47 150 24 157 3C181 17 188 40 175 66Z" />
          </svg>
        </span>
        <header className="lifestyle-grid-heading">
          <p className="section-kicker">Șase subiecte</p>
          <h2 id="lifestyle-categories-title">Alege subiectul potrivit pentru tine.</h2>
        </header>
        {lifestyleCategories.map((category, index) => category.access === "subscription" ? (
          <SubscriptionCategoryCard
            key={category.slug}
            category={category}
            index={index}
            hasAccess={hasSubscription}
            availability={getCategoryAvailability(category.slug)}
            basePath="/stil-de-viata"
          />
        ) : (
          <CategoryCard
            key={category.slug}
            category={category}
            index={index}
            basePath="/stil-de-viata"
            availability={getCategoryAvailability(category.slug)}
          />
        ))}
      </section>
    </main>
  );
}
