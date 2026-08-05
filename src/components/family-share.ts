/**
 * Sharing a program, for real.
 *
 * The audit's P6 was that the share button ended at "Share recorded with your
 * consent" — a receipt for something that never happened. What leaves the phone
 * now is exactly two things, and the receipt says so: the program's name and its
 * catalog URL. Nothing about the child, ever.
 */
export type FamilyShareOutcome = "shared" | "copied" | "cancelled" | "unavailable";

export type FamilySharePayload = { name: string; url: string };

function wasCancelled(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "AbortError";
}

export async function shareFamilyResource({
  name,
  url
}: FamilySharePayload): Promise<FamilyShareOutcome> {
  const nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator;

  if (typeof nav?.share === "function") {
    try {
      await nav.share({ title: name, text: name, url });
      return "shared";
    } catch (error) {
      // Backing out of the OS sheet is a decision, not a failure: do not then
      // copy the link behind the caregiver's back.
      if (wasCancelled(error)) return "cancelled";
    }
  }

  if (typeof nav?.clipboard?.writeText === "function") {
    try {
      await nav.clipboard.writeText(`${name} — ${url}`);
      return "copied";
    } catch {
      return "unavailable";
    }
  }

  return "unavailable";
}
