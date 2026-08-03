import { childAgeMonths } from "./family-screenings";
import type { DevNeedDomain, FamilyProfile } from "./types";

/**
 * A small *content* catalog under the org catalog's verification discipline:
 * every entry names its source, carries the date it was fetched, and its steps
 * are adapted from that page's own guidance. No model authorship, no invented
 * facts, no undated advice.
 */
export interface FamilyGuide {
  id: string;
  domains: DevNeedDomain[];
  /** Age band in MONTHS (the org catalog uses years; guides are finer-grained). */
  ages?: { min?: number; max?: number };
  title: string;
  plainSummary: string;
  /** 3–4 short imperative lines, faithfully adapted from the cited page. */
  steps: string[];
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  humanVerify?: boolean;
}

/** At most two guides in the resources strip — a nudge, never a reading list. */
export const GUIDE_STRIP_LIMIT = 2;

// Every URL below was fetched on this date (GET, redirects followed, browser
// user agent) and returned 200; the steps were written from the fetched pages.
const VERIFIED_AT = "2026-07-25";

// Verified exclusion 2026-07-25: do not seed
// https://www.chfs.ky.gov/agencies/dph/dmch/ecdb/Pages/firststeps.aspx — it 404s.
// The live CHFS page for the same program is keis.aspx, already the catalog's
// First Steps source, and it is what `firststeps_family_guide` cites instead.
export const FAMILY_GUIDE_CATALOG: FamilyGuide[] = [
  {
    id: "cdc_milestones_help",
    domains: ["diagnosis_education", "parent_support"],
    ages: { min: 0, max: 60 },
    title: "How to help your child learn and grow",
    plainSummary:
      "CDC's free \"Learn the Signs. Act Early.\" materials help you follow your child's development from birth to 5 and act early when something worries you.",
    steps: [
      "Track your child's development from birth to 5 years, and act early if you have a concern.",
      "Use the free family resources to learn about milestones, screening, and what to do next.",
      "Download the Milestone Tracker app to follow milestones from 2 months through 5 years.",
      "Ask your state's Act Early Ambassador for local help spotting delays early."
    ],
    sourceName: "CDC, Learn the Signs. Act Early.",
    sourceUrl: "https://www.cdc.gov/act-early/",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "cdc_milestone_tracker",
    domains: ["diagnosis_education"],
    ages: { min: 2, max: 60 },
    title: "Track milestones with the CDC checklists",
    plainSummary:
      "CDC's milestone checklists list what most children do by each age, from 2 months through 5 years.",
    steps: [
      "Open the checklist for your child's age — 2 months through 5 years.",
      "Mark the things your child already does in play, learning, speaking, acting, and moving.",
      "Print the checklist, fill it in online, or use the Milestone Tracker app to keep it with you.",
      "Bring it to visits as a shared record — the checklists are not a screening test."
    ],
    sourceName: "CDC's Developmental Milestones",
    sourceUrl: "https://www.cdc.gov/act-early/milestones/index.html",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "medline_speech_home",
    domains: ["therapies"],
    ages: { min: 12, max: 72 },
    title: "Everyday talk: watching speech at home",
    plainSummary:
      "Children vary in how speech develops; milestones and a hearing check help tell a delay apart from ordinary variation.",
    steps: [
      "Keep a short list of the words your child uses — most children have one or two, like \"hi\" or \"mama,\" by their first birthday.",
      "Notice whether your child understands what others say, not only what they say back.",
      "Ask about a hearing check — hearing loss is one cause of a speech delay.",
      "Tell your child's health care provider what you noticed, in your own words."
    ],
    sourceName: "MedlinePlus, Speech and Language Problems in Children",
    sourceUrl: "https://medlineplus.gov/speechandlanguageproblemsinchildren.html",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "medline_behavior",
    domains: ["parent_support"],
    ages: { min: 24, max: 144 },
    title: "When behavior is the hard part",
    plainSummary:
      "All children misbehave sometimes; a hostile, aggressive, or disruptive pattern lasting more than six months is worth asking about.",
    steps: [
      "Note how long the hard behavior has lasted — a pattern past six months is different from a hard month.",
      "Write down what changed at home: a new sibling, a move, a separation, a death in the family.",
      "Ask for help rather than waiting, because poor choices can turn into habits.",
      "Ask about classes or family therapy for parents, and talk or behavior therapy for your child."
    ],
    sourceName: "MedlinePlus, Child Behavior Disorders",
    sourceUrl: "https://medlineplus.gov/childbehaviordisorders.html",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "firststeps_family_guide",
    domains: ["early_intervention"],
    ages: { min: 0, max: 36 },
    title: "What First Steps visits look like",
    plainSummary:
      "Kentucky's early intervention system serves children from birth to age 3 where they spend their day, with the parent in the visit.",
    steps: [
      "Expect visits where your child already spends time — home, childcare, the playground — not a clinic room.",
      "Plan to take part: visits actively involve the parent instead of treating the child alone.",
      "Help name the goals — families set the outcomes on the Individualized Family Service Plan.",
      "Ask about cost: most families pay nothing, and any family share follows a published sliding scale."
    ],
    sourceName: "Kentucky CHFS, Kentucky Early Intervention System (First Steps)",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dph/dmch/ecdb/Pages/keis.aspx",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "kyspin_resources",
    domains: ["parent_support", "school_iep"],
    ages: { min: 0, max: 252 },
    title: "KY-SPIN: a parent line that answers",
    plainSummary:
      "KY-SPIN is Kentucky's statewide parent network, linking families of children with disabilities to resources and training.",
    steps: [
      "Call the toll-free parent line at 800-525-7746 when you do not know who to ask.",
      "Browse the Learning Center topics for parents and families, behavior, and military families.",
      "Sign up for a free webinar — IEP basics and life-after-high-school sessions run through the year.",
      "Remember KY-SPIN is not a legal services agency and cannot give legal advice."
    ],
    sourceName: "KY-SPIN, Inc.",
    sourceUrl: "https://www.kyspin.com/",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "cdc_autism_signs",
    domains: ["diagnosis_education"],
    ages: { min: 12, max: 96 },
    title: "Understanding the signs you're seeing",
    plainSummary:
      "CDC lists example signs of autism across social communication and repeated behavior, with the age most children reach each one.",
    steps: [
      "Watch the social signs by age: responding to their name by 9 months, gestures by 12 months, pointing to show you something by 18 months.",
      "Watch the repeated patterns too: lining toys up, repeating phrases, hand flapping, big upset at small changes.",
      "Remember a child may have all, some, or none of these — the list is examples, not a test.",
      "Contact your child's doctor about any concern with your child's development."
    ],
    sourceName: "CDC, Signs and Symptoms of Autism Spectrum Disorder",
    sourceUrl: "https://www.cdc.gov/autism/signs-symptoms/index.html",
    verifiedAt: VERIFIED_AT
  },
  {
    id: "medline_sleep_kids",
    domains: ["parent_support"],
    ages: { min: 12, max: 144 },
    title: "Sleep, meltdowns, and hard evenings",
    plainSummary:
      "Hours by age, a steady bedtime, and a cool dark room are the checked basics behind better sleep.",
    steps: [
      "Aim for the hours listed for your child's age: 11–14 a day at 1–2 years, 10–13 at 3–5 years, 9–12 at 6–12 years.",
      "Go to bed and wake up at the same time every day.",
      "Wind down first — a bath, a book, or calm music.",
      "Keep the bedroom cool, dark, and quiet, and take TVs, computers, and phones out of it."
    ],
    sourceName: "MedlinePlus, Healthy Sleep",
    sourceUrl: "https://medlineplus.gov/healthysleep.html",
    verifiedAt: VERIFIED_AT
  }
];

// Year-only profiles read as a January birthday — the same conservative
// assumption the First Steps clock makes, so an age band never silently
// swallows a guide because the month is missing.
function guideAgeMonths(profile: FamilyProfile, now: Date): number | null {
  if (Number.isNaN(now.valueOf())) return null;
  return (
    childAgeMonths(profile, now) ?? (now.getUTCFullYear() - profile.birthYear) * 12 + now.getUTCMonth()
  );
}

function matchesGuideAge(guide: FamilyGuide, ageMonths: number): boolean {
  if (guide.ages?.min !== undefined && ageMonths < guide.ages.min) return false;
  if (guide.ages?.max !== undefined && ageMonths > guide.ages.max) return false;
  return true;
}

/**
 * Deterministic match: domains are considered in their supplied priority order,
 * then guides retain catalog order within each domain. Duplicate multi-domain
 * guides appear once and the strip stays capped at {@link GUIDE_STRIP_LIMIT}.
 * No model or personalization beyond what the profile already says.
 */
export function matchFamilyGuides(
  profile: FamilyProfile,
  domains: DevNeedDomain | readonly DevNeedDomain[],
  now: Date = new Date()
): FamilyGuide[] {
  const ageMonths = guideAgeMonths(profile, now);
  if (ageMonths === null) return [];
  const orderedDomains = typeof domains === "string" ? [domains] : domains;
  const matched: FamilyGuide[] = [];
  const seen = new Set<string>();

  for (const domain of orderedDomains) {
    for (const guide of FAMILY_GUIDE_CATALOG) {
      if (
        seen.has(guide.id) ||
        !guide.domains.includes(domain) ||
        !matchesGuideAge(guide, ageMonths)
      ) {
        continue;
      }
      seen.add(guide.id);
      matched.push(guide);
      if (matched.length === GUIDE_STRIP_LIMIT) return matched;
    }
  }
  return matched;
}
