/**
 * Writing a file to the family's own device, and nowhere else.
 *
 * Every export Ladder offers — the visit packet as text, the check-in and visit
 * `.ics` files — is a Blob and an anchor click. No endpoint, no upload, no
 * network of ours touches any of it (FR-8). Returns whether the browser
 * actually took the file, so the caller can show an honest receipt rather than
 * a silent no-op.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  type = "text/plain;charset=utf-8"
): boolean {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }

  try {
    const href = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    return true;
  } catch {
    return false;
  }
}
