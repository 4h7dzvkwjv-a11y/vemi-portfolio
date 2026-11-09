export const AMV2_CATEGORY_ORDER = Object.freeze([
  "Piept",
  "Spate",
  "Umeri",
  "Biceps",
  "Triceps",
  "Picioare",
  "Abdomen",
  "Cardio",
  "Acasă",
]);

export const AMV2_CATEGORY_PRESENTATION = Object.freeze({
  Piept: Object.freeze({ surface: "#fcdacd", ink: "#b45242", dot: "#d87461" }),
  Spate: Object.freeze({ surface: "#c5deeb", ink: "#32648c", dot: "#5b8fb0" }),
  Umeri: Object.freeze({ surface: "#fce8ba", ink: "#9a6d19", dot: "#d8a948" }),
  Biceps: Object.freeze({ surface: "#e1d2f5", ink: "#72519a", dot: "#9472ba" }),
  Triceps: Object.freeze({ surface: "#c3d0f2", ink: "#4866a6", dot: "#6c82bf" }),
  Picioare: Object.freeze({ surface: "#c8ebd0", ink: "#337244", dot: "#5a9a69" }),
  Abdomen: Object.freeze({ surface: "#fcdcb9", ink: "#aa6428", dot: "#dd8c45" }),
  Cardio: Object.freeze({ surface: "#f8c8c8", ink: "#aa4545", dot: "#d96767" }),
  "Acasă": Object.freeze({ surface: "#d7e4c8", ink: "#4f7137", dot: "#789a5c" }),
});

export const AMV2_CATEGORY_COLORS = Object.freeze(
  Object.fromEntries(Object.entries(AMV2_CATEGORY_PRESENTATION).map(([category, theme]) => [category, theme.dot])),
);

const fallback = Object.freeze({ surface: "#e7ece8", ink: "#466052", dot: "#6f8879" });

export function getAmv2CategoryPresentation(category) {
  return AMV2_CATEGORY_PRESENTATION[category] ?? fallback;
}
