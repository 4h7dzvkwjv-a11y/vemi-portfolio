export type Amv2CategoryPresentation = Readonly<{
  surface: string;
  ink: string;
  dot: string;
}>;

export const AMV2_CATEGORY_ORDER: readonly string[];
export const AMV2_CATEGORY_PRESENTATION: Readonly<Record<string, Amv2CategoryPresentation>>;
export const AMV2_CATEGORY_COLORS: Readonly<Record<string, string>>;
export function getAmv2CategoryPresentation(category: string): Amv2CategoryPresentation;
