import type { MetadataRoute } from "next";
import {
  getPublishedNutritionArticles,
  nutritionCategories,
} from "@/content/alimentatie/catalog";
import { getPublishedArticles, lifestyleCategories } from "@/content/stil-de-viata/catalog";
import { getConfiguredSiteUrl } from "@/lib/editorial/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getConfiguredSiteUrl();
  if (!baseUrl) return [];

  const publicCategories = lifestyleCategories.filter((category) => category.access === "public");
  const publicCategorySlugs = new Set(publicCategories.map((category) => category.slug));
  const paths = [
    "/",
    "/planuri-gratuite",
    "/antrenamentul-meu",
    "/exercitii",
    "/abonamente",
    "/contul-meu",
    "/stil-de-viata",
    ...publicCategories.map((category) => `/stil-de-viata/${category.slug}`),
    ...getPublishedArticles()
      .filter((article) => publicCategorySlugs.has(article.categorySlug))
      .map((article) => `/stil-de-viata/${article.categorySlug}/${article.slug}`),
    "/alimentatie",
    ...nutritionCategories.map((category) => `/alimentatie/${category.slug}`),
    ...getPublishedNutritionArticles().map(
      (article) => `/alimentatie/${article.categorySlug}/${article.slug}`,
    ),
  ];

  return paths.map((path) => ({
    url: new URL(path, baseUrl).toString(),
    changeFrequency: path.startsWith("/stil-de-viata") || path.startsWith("/alimentatie") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path === "/stil-de-viata" || path === "/alimentatie" ? 0.8 : 0.7,
  }));
}
