import { describe, expect, it } from "vitest";
import {
  familyResourceFaceAction,
  familyResourcePhones,
  familyResourceTel
} from "./family-resource-contact";
import { FAMILY_RESOURCE_CATALOG, getFamilyResourceById } from "./family-resources";

describe("familyResourcePhones", () => {
  it("reads the numbers a catalog line actually lists, in order", () => {
    expect(familyResourcePhones("Call 606-886-4417 or 800-230-6011")).toEqual([
      "606-886-4417",
      "800-230-6011"
    ]);
  });

  it("takes a dialed service code but not an SMS short code", () => {
    // "898211" is where you text a ZIP, not a line anyone can ring.
    expect(familyResourcePhones("Dial 211 or text your ZIP code to 898211")).toEqual(["211"]);
  });

  it("ignores a vanity spelling that carries no extra digits", () => {
    expect(familyResourcePhones("Call 877-417-8377 (1-877-41-STEPS)")).toEqual(["877-417-8377"]);
  });

  it("finds a number buried mid-sentence", () => {
    expect(
      familyResourcePhones(
        "Apply through kynect or call the waiver help desk at 844-784-5614"
      )
    ).toEqual(["844-784-5614"]);
  });

  it("returns nothing when the catalog names no number", () => {
    expect(familyResourcePhones("Search by topic, location, or organization name")).toEqual([]);
  });
});

describe("familyResourceTel", () => {
  it("strips punctuation so a dialer never has to guess", () => {
    expect(familyResourceTel("606-886-4417")).toBe("tel:6068864417");
    expect(familyResourceTel("211")).toBe("tel:211");
  });
});

describe("familyResourceFaceAction", () => {
  it("puts the number on the face of a call program", () => {
    const poe = getFamilyResourceById("first_steps_big_sandy")!;
    expect(familyResourceFaceAction(poe)).toEqual({
      kind: "call",
      number: "606-886-4417",
      tel: "tel:6068864417",
      alsoNumber: "800-230-6011",
      alsoTel: "tel:8002306011"
    });
  });

  it("leads a self-serve program with its own page and keeps the phone second", () => {
    const waiver = getFamilyResourceById("michelle_p_waiver")!;
    const action = familyResourceFaceAction(waiver);
    expect(action.kind).toBe("link");
    expect(action).toMatchObject({ number: "844-784-5614", tel: "tel:8447845614" });
  });

  it("degrades a call program with no listed number to its official page", () => {
    const action = familyResourceFaceAction({
      ...getFamilyResourceById("first_steps_big_sandy")!,
      contact: "Contact the Client Relations Manager through the services page",
      sourceUrl: "https://example.org/"
    });
    expect(action).toEqual({ kind: "link", href: "https://example.org/" });
  });

  it("names the human who makes the connection instead of faking a call", () => {
    const school = FAMILY_RESOURCE_CATALOG.find(({ referralMode }) => referralMode === "school_contact")!;
    expect(familyResourceFaceAction(school)).toEqual({ kind: "school", href: school.sourceUrl });

    const provider = FAMILY_RESOURCE_CATALOG.find(
      ({ referralMode }) => referralMode === "provider_referral"
    )!;
    expect(familyResourceFaceAction(provider)).toEqual({ kind: "provider" });

    const navigator = FAMILY_RESOURCE_CATALOG.find(
      ({ referralMode }) => referralMode === "navigator_referral"
    )!;
    expect(familyResourceFaceAction(navigator)).toEqual({ kind: "navigator" });
  });

  it("gives every catalog entry a face action, and every dialed number real digits", () => {
    for (const resource of FAMILY_RESOURCE_CATALOG) {
      const action = familyResourceFaceAction(resource);
      expect(action.kind).toBeTruthy();
      if (action.kind === "call") {
        expect(action.tel).toMatch(/^tel:\d{3,10}$/);
        // The number on the button has to be the number in the catalog.
        expect(resource.contact).toContain(action.number);
      }
    }
  });
});
