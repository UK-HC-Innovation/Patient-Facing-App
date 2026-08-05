import type { FamilyResource } from "./family-resources";

/**
 * What a card's face is for. The audit's #1 finding was that "who do I call
 * first" — the whole reason a caregiver opens this at 11pm — was buried under
 * two folds as un-tappable text. So the face action is derived from the
 * catalog's own referral mode, and the phone number, when the catalog has one,
 * is the button's label.
 *
 * Nothing here invents a number: every digit comes out of `resource.contact`
 * verbatim, and a `call` resource whose contact carries no dialable number
 * degrades to its official page rather than to a dead button.
 */
export type FamilyFaceAction =
  | { kind: "call"; number: string; tel: string; alsoNumber?: string; alsoTel?: string }
  | { kind: "link"; href: string; number?: string; tel?: string }
  | { kind: "provider" }
  | { kind: "school"; href: string }
  | { kind: "navigator" };

// Full US numbers as the catalog writes them, in the order they appear.
const FULL_NUMBER = /\b\d{3}-\d{3}-\d{4}\b/g;
// Three-digit service codes are only dialable when the catalog says to dial
// them. Anchoring on the verb is what keeps "text your ZIP code to 898211" —
// an SMS short code, not a phone line — out of a tel: link.
const DIALED_SHORT_CODE = /\b(?:dial|marca)\s+(\d{3})\b/i;

/** Every dialable number in a catalog contact line, in the order it reads. */
export function familyResourcePhones(contact: string): string[] {
  const numbers = contact.match(FULL_NUMBER) ?? [];
  const shortCode = DIALED_SHORT_CODE.exec(contact);
  return shortCode ? [shortCode[1], ...numbers] : [...numbers];
}

/** `tel:` target for a catalog number: digits only, so dialers do not guess. */
export function familyResourceTel(number: string): string {
  return `tel:${number.replace(/\D/g, "")}`;
}

export function familyResourceFaceAction(resource: FamilyResource): FamilyFaceAction {
  const [first, second] = familyResourcePhones(resource.contact);

  switch (resource.referralMode) {
    case "call":
      // A call program with no number in the catalog would otherwise render a
      // button that dials nothing.
      return first === undefined
        ? { kind: "link", href: resource.sourceUrl }
        : {
            kind: "call",
            number: first,
            tel: familyResourceTel(first),
            ...(second === undefined
              ? {}
              : { alsoNumber: second, alsoTel: familyResourceTel(second) })
          };
    case "self_serve":
      // Start online leads; the phone line, if the catalog lists one, sits under it.
      return first === undefined
        ? { kind: "link", href: resource.sourceUrl }
        : { kind: "link", href: resource.sourceUrl, number: first, tel: familyResourceTel(first) };
    case "provider_referral":
      return { kind: "provider" };
    case "school_contact":
      return { kind: "school", href: resource.sourceUrl };
    case "navigator_referral":
      return { kind: "navigator" };
  }
}
