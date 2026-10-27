/** Task 1 Variance Bakery lesson, whether or not the `tool` column came through. */
export function isVarianceBakeryLesson(lesson: { id?: string | null; title?: string | null; tool?: string | null }): boolean {
  return (
    lesson.tool === "variance-bakery" ||
    lesson.id === "ch10-l12" ||
    /variance bakery/i.test(lesson.title || "")
  );
}
