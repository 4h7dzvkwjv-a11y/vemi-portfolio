import type { Metadata } from "next";

export const SITE_NAME = "VEMI — Viață, Energie, Mișcare";

export function getConfiguredSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return null;

  try {
    return new URL(value.endsWith("/") ? value : `${value}/`);
  } catch {
    return null;
  }
}

export function getAbsoluteUrl(path: string) {
  const baseUrl = getConfiguredSiteUrl();
  return baseUrl ? new URL(path, baseUrl).toString() : null;
}

export function createEditorialMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const canonical = getAbsoluteUrl(path);

  return {
    title: `${title} | VEMI`,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type,
      locale: "ro_RO",
      siteName: SITE_NAME,
      title,
      description,
      url: canonical ?? undefined,
    },
  };
}
