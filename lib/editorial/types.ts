export type EditorialAccess = "public" | "subscription";
export type EditorialArticleStatus = "published" | "draft" | "comingSoon";

export type EditorialVisual =
  | "moon"
  | "stress"
  | "schedule"
  | "recovery"
  | "training"
  | "mobility"
  | "nutrition-foundation"
  | "nutrition-daily"
  | "nutrition-goal"
  | "nutrition-recipes"
  | "nutrition-restrictions"
  | "nutrition-calculator";

export type ArticleSource = {
  institution: string;
  title: string;
  year: number;
  type: string;
  url: string;
};

export type EditorialCategory<CategorySlug extends string = string> = {
  slug: CategorySlug;
  title: string;
  description: string;
  eyebrow: string;
  visual: EditorialVisual;
  access: EditorialAccess;
};

export type EditorialArticle<CategorySlug extends string = string> = {
  categorySlug: CategorySlug;
  slug: string;
  title: string;
  label: string;
  summary: string;
  readingTimeMinutes: number;
  status: EditorialArticleStatus;
  legacySlugs: string[];
  takeaways: [string, string, string];
  recommendedSlugs: string[];
  sources: ArticleSource[];
};
