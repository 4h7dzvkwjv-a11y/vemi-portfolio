import Link from "next/link";
import type { EditorialCategory } from "@/lib/editorial/types";
import { CategoryCardBody } from "./category-card-body";

export function CategoryCard({
  category,
  index,
  basePath,
  availability,
}: {
  category: EditorialCategory;
  index: number;
  basePath: string;
  availability: string;
}) {
  return (
    <Link className={`lifestyle-category-card ${category.visual}`} href={`${basePath}/${category.slug}`}>
      <CategoryCardBody category={category} index={index} availability={availability} />
    </Link>
  );
}
