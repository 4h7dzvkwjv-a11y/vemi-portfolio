"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { EditorialCategory } from "@/lib/editorial/types";
import { CategoryCardBody } from "./category-card-body";

export function SubscriptionCategoryCard({
  category,
  index,
  hasAccess,
  availability,
  basePath,
}: {
  category: EditorialCategory;
  index: number;
  hasAccess: boolean;
  availability: string;
  basePath: string;
}) {
  const [open, setOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const accessCardId = useId();
  const accessTitleId = `${accessCardId}-title`;

  useEffect(() => {
    if (open) {
      backRef.current?.focus({ preventScroll: true });
    } else if (hasInteracted) {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [hasInteracted, open]);

  if (hasAccess) {
    return (
      <Link className={`lifestyle-category-card ${category.visual}`} href={`${basePath}/${category.slug}`}>
        <CategoryCardBody category={category} index={index} availability={availability} />
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`lifestyle-category-card lifestyle-category-card-locked ${category.visual}${
          hasInteracted ? " lifestyle-card-content-swap" : ""
        }`}
        onClick={() => {
          setHasInteracted(true);
          setOpen(true);
        }}
        aria-expanded="false"
        aria-controls={accessCardId}
      >
        <CategoryCardBody category={category} index={index} availability={availability} subscriptionLabel />
      </button>
    );
  }

  return (
    <section
      id={accessCardId}
      className="lifestyle-category-card lifestyle-access-card lifestyle-card-content-swap"
      aria-labelledby={accessTitleId}
      aria-live="polite"
    >
      <button ref={backRef} className="lifestyle-access-back" type="button" onClick={() => setOpen(false)}>
        <span aria-hidden="true">←</span> Înapoi
      </button>
      <div className="lifestyle-access-content">
        <p className="section-kicker">Inclus în toate abonamentele</p>
        <h2 id={accessTitleId}>Continuă cu un abonament</h2>
        <p>Restul conținutului din această categorie este disponibil cu orice abonament VEMI.</p>
        <Link className="lifestyle-access-primary" href="/abonamente">Vezi abonamentele</Link>
      </div>
    </section>
  );
}
