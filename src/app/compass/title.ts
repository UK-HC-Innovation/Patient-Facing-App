// Kept out of layout.tsx: the client page needs this string too, and importing it from the
// layout would drag a module that exports `metadata` into the client graph, which Next
// rejects. One constant, so renaming the preview stays a one-line change.
export const COMPASS_PAGE_TITLE = "Food Lens functional prototype";
