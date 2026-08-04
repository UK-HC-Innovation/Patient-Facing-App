import { act } from "@testing-library/react";

/**
 * Opens every folded reference section on screen, so a test that is about a
 * section's *contents* does not have to be about its disclosure too. The fold
 * behavior itself — what is closed by default, what the summary row says, and
 * which anchors open it — is covered in `family-fold-section.test.tsx`.
 *
 * Goes through the same custom event the anchor handler uses, so React state and
 * the DOM agree afterwards and a later re-render cannot close the section again.
 */
export function openAllFamilyFolds(): void {
  act(() => {
    for (const node of document.querySelectorAll<HTMLElement>("[data-family-fold]")) {
      node.dispatchEvent(new CustomEvent("family-fold-open"));
    }
  });
}
