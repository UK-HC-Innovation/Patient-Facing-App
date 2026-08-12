import type { DevNeedDomain, FamilyProfile } from "./types";
import { KENTUCKY_SDOH_RESOURCE_CATALOG, type SdohReferralMode } from "./sdoh-resources";

export interface FamilyResource {
  id: string;
  name: string;
  domains: DevNeedDomain[];
  counties: string[];
  ages?: { min?: number; max?: number };
  summary: string;
  contact: string;
  actNow?: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  humanVerify?: boolean;
  referralMode: "self_serve" | "call" | "provider_referral" | "school_contact" | "navigator_referral";
}

type PoeDistrict = {
  name: string;
  slug: string;
  counties: string[];
  contact: string;
};

/**
 * The 2026-08-05 mechanical pass (`scripts/verify-catalog.mjs`, report in
 * docs/ops/catalog-verification/). This date is only on entries whose source
 * page came back 200 **and** still carried a signal from the entry itself — a
 * phone number it prints, or a distinctive phrase from its name. A page that
 * merely answered, or that renders in JavaScript, or that is a PDF, kept its old
 * date and went on the owner checklist instead (FR-6).
 */
const RECHECKED_AT = "2026-08-05";
// Primary-source checks completed during the 2026-08-11 catalog audit. This is
// intentionally applied per entry below; reachability alone never earns it.
const SOURCE_RECHECKED_AT = "2026-08-11";
// Manual primary-source review completed during the 2026-08-12 refresh. This
// is applied only after each card's substantive claims were checked or fixed.
const CATALOG_REFRESHED_AT = "2026-08-12";
const POE_SOURCE_URL = "https://www.chfs.ky.gov/agencies/dph/dmch/ecdb/fs/POElistingforWebsite.pdf";

const POE_DISTRICTS: PoeDistrict[] = [
  {
    name: "Barren River",
    slug: "barren_river",
    counties: ["Allen", "Barren", "Butler", "Edmonson", "Hart", "Logan", "Metcalfe", "Monroe", "Simpson", "Warren"],
    contact: "Call 270-901-5749 or 800-643-6233"
  },
  {
    name: "Big Sandy",
    slug: "big_sandy",
    counties: ["Floyd", "Johnson", "Magoffin", "Martin", "Pike"],
    contact: "Call 606-886-4417 or 800-230-6011"
  },
  {
    name: "Bluegrass",
    slug: "bluegrass",
    counties: [
      "Anderson",
      "Bourbon",
      "Boyle",
      "Clark",
      "Estill",
      "Fayette",
      "Franklin",
      "Garrard",
      "Harrison",
      "Jessamine",
      "Lincoln",
      "Madison",
      "Mercer",
      "Nicholas",
      "Powell",
      "Scott",
      "Woodford"
    ],
    contact: "Call 859-271-9448 or 800-454-2764"
  },
  {
    name: "Buffalo Trace",
    slug: "buffalo_trace",
    counties: ["Bracken", "Fleming", "Lewis", "Mason", "Robertson"],
    contact: "Call 606-564-3919 or 800-335-4249"
  },
  {
    name: "Cumberland Valley",
    slug: "cumberland_valley",
    counties: ["Bell", "Clay", "Harlan", "Jackson", "Knox", "Laurel", "Rockcastle", "Whitley"],
    contact: "Call 606-523-0229 or 800-509-9559"
  },
  {
    name: "FIVCO",
    slug: "fivco",
    counties: ["Boyd", "Carter", "Elliott", "Greenup", "Lawrence"],
    contact: "Call 606-929-9155 or 800-650-1329"
  },
  {
    name: "Gateway",
    slug: "gateway",
    counties: ["Bath", "Menifee", "Montgomery", "Morgan", "Rowan"],
    contact: "Call 606-674-3204 or 800-942-4358"
  },
  {
    name: "Green River",
    slug: "green_river",
    counties: ["Daviess", "Hancock", "Henderson", "McLean", "Ohio", "Union", "Webster"],
    contact: "Call 270-852-2905 or 888-686-1414"
  },
  {
    name: "Kentuckiana (KIPDA)",
    slug: "kentuckiana",
    counties: ["Bullitt", "Henry", "Jefferson", "Oldham", "Shelby", "Spencer", "Trimble"],
    contact: "Call 502-429-1249 or 800-442-0087"
  },
  {
    name: "Kentucky River",
    slug: "kentucky_river",
    counties: ["Breathitt", "Knott", "Lee", "Leslie", "Letcher", "Owsley", "Perry", "Wolfe"],
    contact: "Call 606-439-1325 or 800-328-1767"
  },
  {
    name: "Lake Cumberland",
    slug: "lake_cumberland",
    counties: ["Adair", "Casey", "Clinton", "Cumberland", "Green", "McCreary", "Pulaski", "Russell", "Taylor", "Wayne"],
    contact: "Call 606-678-2821 or 800-378-2821"
  },
  {
    name: "Lincoln Trail",
    slug: "lincoln_trail",
    counties: ["Breckinridge", "Grayson", "Hardin", "Larue", "Marion", "Meade", "Nelson", "Washington"],
    contact: "Call 270-737-5921 or 800-454-2764"
  },
  {
    name: "Northern Kentucky",
    slug: "northern_kentucky",
    counties: ["Boone", "Campbell", "Carroll", "Gallatin", "Grant", "Kenton", "Owen", "Pendleton"],
    contact: "Call 859-655-1195 or 888-300-8866"
  },
  {
    name: "Pennyrile",
    slug: "pennyrile",
    counties: ["Caldwell", "Christian", "Crittenden", "Hopkins", "Lyon", "Muhlenberg", "Todd", "Trigg"],
    contact: "Call 270-886-5186 or 877-473-7766"
  },
  {
    name: "Purchase",
    slug: "purchase",
    counties: ["Ballard", "Calloway", "Carlisle", "Fulton", "Graves", "Hickman", "Livingston", "Marshall", "McCracken"],
    contact: "Call 270-442-6223 or 800-648-6599"
  }
];

export const KY_COUNTIES: readonly string[] = POE_DISTRICTS.flatMap((district) => district.counties).sort((left, right) =>
  left.localeCompare(right)
);

export const FIRST_STEPS_POE_BY_COUNTY: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    POE_DISTRICTS.flatMap((district) => district.counties.map((county) => [county, district.name] as const))
  )
);

const FIRST_STEPS_POE_RESOURCES: FamilyResource[] = POE_DISTRICTS.map((district) => ({
  id: `first_steps_${district.slug}`,
  name: `First Steps — ${district.name} Point of Entry`,
  domains: ["early_intervention"],
  counties: district.counties,
  ages: { min: 0, max: 2.99 },
  summary: `The official local point of entry for First Steps referrals in the ${district.name} district. The POE receives referrals, coordinates evaluation and eligibility, and starts the initial IFSP process.`,
  contact: district.contact,
  actNow: "First Steps does not accept a new referral within 45 days of a child's third birthday; contact the POE as early as possible.",
  sourceName: "Kentucky Early Intervention System POE listing (12/25)",
  sourceUrl: POE_SOURCE_URL,
  verifiedAt: CATALOG_REFRESHED_AT,
  referralMode: "call"
}));

const ALL_DOMAINS: DevNeedDomain[] = [
  "early_intervention",
  "therapies",
  "school_iep",
  "waivers_financial",
  "respite",
  "parent_support",
  "sibling_support",
  "transportation",
  "future_planning",
  "diagnosis_education",
  "recreation"
];

const toFamilyReferralMode = (referralMode: SdohReferralMode): FamilyResource["referralMode"] => {
  if (referralMode === "navigator_referral") return referralMode;
  throw new Error(`Unsupported family referral mode: ${referralMode}`);
};

const LOCAL_SDOH_TRANSPORTATION_RESOURCES: FamilyResource[] = KENTUCKY_SDOH_RESOURCE_CATALOG.filter(
  (resource) => resource.needTypes.includes("transportation") && !resource.counties.includes("statewide")
).map(({ id, name, counties, summary, contact, sourceName, sourceUrl, verifiedAt, referralMode }) => ({
  id,
  name,
  domains: ["transportation"],
  counties,
  summary,
  contact,
  sourceName,
  sourceUrl,
  verifiedAt,
  referralMode: toFamilyReferralMode(referralMode)
}));

const STATEWIDE_AND_LOCAL_RESOURCES: FamilyResource[] = [
  {
    id: "ky_spin",
    name: "KY-SPIN Parent Center",
    domains: ["parent_support", "sibling_support", "school_iep", "future_planning", "diagnosis_education"],
    counties: ["statewide"],
    ages: { min: 0, max: 26.99 },
    summary: "Kentucky's Parent Training and Information Center offers free information, workshops, and one-on-one help for families of children and young adults with disabilities. It is not legal representation.",
    contact: "Call 800-525-7746 or email spininc@kyspin.com",
    sourceName: "Kentucky Special Parent Involvement Network",
    sourceUrl: "https://www.kyspin.com/about/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "ocshcn",
    name: "Office for Children with Special Health Care Needs",
    domains: ["parent_support", "therapies", "waivers_financial", "diagnosis_education"],
    counties: ["statewide"],
    ages: { min: 0, max: 20.99 },
    summary: "OCSHCN connects Kentucky families to regional specialty clinics, care coordination, Family-to-Family peer support, and information about health coverage. Autism diagnostic clinics are currently listed in Morehead and Somerset.",
    contact: "Call 800-232-1160 and ask for the office serving your county",
    sourceName: "Kentucky Cabinet for Health and Family Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/ocshcn/Pages/default.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "first_steps_statewide",
    name: "Kentucky First Steps",
    domains: ["early_intervention", "therapies"],
    counties: ["statewide"],
    ages: { min: 0, max: 2.99 },
    summary: "Kentucky's statewide early-intervention system supports eligible children from birth until the third birthday. A parent or anyone else can make a referral.",
    contact: "Call 877-417-8377 (1-877-41-STEPS)",
    actNow: "The referral-to-IFSP process has a 45-day timeline, and new referrals are not accepted within 45 days of the third birthday.",
    sourceName: "Kentucky Early Intervention System",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dph/dmch/ecdb/Pages/keis.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "help_me_grow_ky",
    name: "Help Me Grow Kentucky",
    domains: ["early_intervention", "diagnosis_education"],
    counties: ["statewide"],
    ages: { min: 0, max: 5.5 },
    summary: "Free, confidential English and Spanish ASQ-3 and ASQ:SE-2 developmental screening, activities, and guidance on next steps for families with children from birth to age 5½.",
    contact: "Call 877-616-7388 or use the screening links on the CHFS page",
    sourceName: "Kentucky Cabinet for Health and Family Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dcbs/dcc/Pages/hmg.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kde_age_three_transition",
    name: "First Steps transition to preschool special education",
    domains: ["early_intervention", "school_iep"],
    counties: ["statewide"],
    ages: { min: 2.25, max: 2.99 },
    summary: "Kentucky's First Steps regulation requires the service coordinator to plan the move from an active IFSP to preschool, school, or other appropriate services with the family, IFSP team, and local school district.",
    contact: "Ask the First Steps service coordinator to schedule the transition conference with the local school district",
    actNow: "The service coordinator must hold the transition conference at least 90 days and, by agreement, no more than nine months before the third birthday.",
    sourceName: "Kentucky Administrative Regulations — 902 KAR 30:110",
    sourceUrl: "https://apps.legislature.ky.gov/law/kar/titles/902/030/110/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "school_contact"
  },
  {
    id: "kde_dispute_resolution",
    name: "KDE special-education dispute resolution",
    domains: ["school_iep"],
    counties: ["statewide"],
    ages: { min: 3, max: 21.99 },
    summary: "Kentucky's official path for resolving IDEA disagreements: work with the district, then consider free mediation, a formal written complaint, or a due-process hearing.",
    contact: "Start with the district Director of Special Education; KDE OSEEL lists forms and next steps",
    actNow: "IDEA written complaints generally use a one-year filing window; Kentucky due-process requests generally use a three-year window.",
    sourceName: "Kentucky Department of Education",
    sourceUrl: "https://www.education.ky.gov/specialed/excep/Pages/Dispute_Resolution_Process.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kde_parent_toolbox",
    name: "KDE Parent and Family Toolbox",
    domains: ["school_iep", "diagnosis_education"],
    counties: ["statewide"],
    ages: { min: 3, max: 21.99 },
    summary: "Official Kentucky parent guides, including Preparing for the ARC and IEP fact sheets in English and Spanish. ARC is Kentucky's name for the IEP team meeting.",
    contact: "Open the toolbox and choose the ARC or IEP guide needed for the next school meeting",
    sourceName: "Kentucky Department of Education",
    sourceUrl: "https://www.education.ky.gov/specialed/excep/Pages/FamParTool.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kentucky_protection_advocacy",
    name: "Kentucky Protection & Advocacy",
    domains: ["school_iep", "future_planning"],
    counties: ["statewide"],
    summary: "Kentucky's federally mandated disability-rights organization provides information, referral, technical assistance, education, and legal advocacy. It cannot assist with child custody or obtaining SSI, SSDI, or VA benefits; intake does not guarantee representation.",
    contact: "Call 800-372-2988 or use the online intake form",
    sourceName: "Kentucky Protection & Advocacy",
    sourceUrl: "https://kypa.net/what-we-do/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "michelle_p_waiver",
    name: "Michelle P. Waiver",
    domains: ["waivers_financial", "respite", "therapies"],
    counties: ["statewide"],
    summary: "A Kentucky Medicaid waiver for people with intellectual or developmental disabilities who meet program and level-of-care requirements. The state decides eligibility.",
    contact: "Apply through kynect or call the waiver operating agency at 502-564-7700",
    actNow: "The state says the waiting list is date ordered: placement is determined by the date it receives a completed application. Families who want the state to assess an application should apply now rather than wait for a later milestone.",
    sourceName: "Kentucky Department for Medicaid Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dms/dca/pages/mpw.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "scl_waiver",
    name: "Supports for Community Living Waiver",
    domains: ["waivers_financial", "respite", "future_planning"],
    counties: ["statewide"],
    summary: "Kentucky's IDD waiver that can include residential and other community-living supports. The state determines eligibility and category of need.",
    contact: "Call the Department for Behavioral Health, Developmental and Intellectual Disabilities at 502-564-7700",
    actNow: "Ask the state operating agency about the current category-of-need process and waiting-list status before relying on dated third-party estimates.",
    sourceName: "Kentucky Department for Medicaid Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dms/dca/Pages/scl-waiver.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "hcb_waiver",
    name: "Home and Community Based Waiver",
    domains: ["waivers_financial", "respite"],
    counties: ["statewide"],
    summary: "Kentucky's HCB waiver is for people age 65 or older and/or people with a physical disability who meet Medicaid and level-of-care requirements; it is distinct from the IDD waivers.",
    contact: "Apply through kynect or call the Department for Aging and Independent Living at 877-315-0589",
    sourceName: "Kentucky Department for Medicaid Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dms/dca/pages/hcb-waiver.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "child_waiver",
    name: "CHILD Waiver",
    domains: ["waivers_financial", "respite", "therapies"],
    counties: ["statewide"],
    ages: { min: 0, max: 20.99 },
    summary: "The Community Health for Improved Lives and Development waiver serves children and youth under 21 with high-intensity behavioral-health or developmental needs who meet Medicaid financial and specified level-of-care criteria after other Medicaid and non-Medicaid services and supports have been exhausted.",
    contact: "Apply through kynect or in person at an ADRC or community mental health center; questions: 844-784-5614",
    actNow: "CHFS publishes an application path through kynect, an ADRC, or a community mental health center. Ask the waiver help desk about case-specific eligibility and status.",
    sourceName: "Kentucky Department for Medicaid Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dms/dca/Pages/child.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "stable_kentucky",
    name: "STABLE Kentucky ABLE accounts",
    domains: ["future_planning", "waivers_financial"],
    counties: ["statewide"],
    summary: "A tax-advantaged ABLE savings program for eligible Kentucky residents whose disability began before age 46. STABLE says up to $100,000 in the account does not count toward SSI's $2,000 asset limit; above that amount SSI is suspended until the balance returns below the limit.",
    contact: "Review eligibility and open an account through STABLE Kentucky",
    actNow: "The federal age-of-onset limit expanded from before age 26 to before age 46 on January 1, 2026.",
    sourceName: "STABLE Kentucky",
    sourceUrl: "https://stablekentucky.com/how-it-works/eligibility",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "ssi_children",
    name: "Supplemental Security Income for children",
    domains: ["waivers_financial", "future_planning"],
    counties: ["statewide"],
    ages: { min: 0, max: 17 },
    summary: "SSA may pay SSI to a child under 18 who meets its disability, income, and resource rules. SSA, not this directory, makes the eligibility decision.",
    contact: "Review the child SSI information and call Social Security at 800-772-1213 to apply or ask questions",
    actNow: "At age 18, SSA uses the adult disability rules; parental deeming stops in the month after the 18th birthday. A child who could not receive SSI because of deeming may be able to qualify then.",
    sourceName: "Social Security Administration",
    sourceUrl: "https://www.ssa.gov/ssi/text-child-ussi.htm",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "call"
  },
  {
    id: "my_choice_kentucky",
    name: "My Choice Kentucky",
    domains: ["future_planning"],
    counties: ["statewide"],
    summary: "Kentucky training, education, and technical support for people and families who want to learn about or use supported decision-making, including less-restrictive alternatives to guardianship and rights-restoration resources.",
    contact: "Use the My Choice Kentucky resources to learn about supported decision-making or request training and technical support",
    sourceName: "University of Kentucky Human Development Institute",
    sourceUrl: "https://hdi.uky.edu/project/my-choice-kentucky/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "hdi_resource_guide",
    name: "Kentucky Disability Resource Guide",
    domains: ["diagnosis_education"],
    counties: ["statewide"],
    summary: "The University of Kentucky Human Development Institute's searchable statewide directory for disability programs and organizations. Use it as a find-more path and confirm details with each provider.",
    contact: "Search by topic, location, or organization name",
    sourceName: "University of Kentucky Human Development Institute",
    sourceUrl: "https://resources.hdiuky.org/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kentucky_autism_training_center",
    name: "Kentucky Autism Training Center",
    domains: ["diagnosis_education", "parent_support"],
    counties: ["statewide"],
    summary: "A statewide University of Louisville program offering autism resource information and evidence-based training for families, educators, and service systems. It does not offer training to individual families, ongoing case management, or direct IEP support.",
    contact: "Use the current KATC site for training and statewide resource information",
    sourceName: "Kentucky Autism Training Center",
    sourceUrl: "https://education.louisville.edu/research/centers-institutes/kentucky-autism-training-center/katc-resources",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "uk_developmental_pediatrics",
    name: "Golisano Children's at UK Developmental Pediatrics",
    domains: ["diagnosis_education"],
    counties: ["statewide"],
    ages: { min: 1.5, max: 12.99 },
    summary: "A primary-care-provider-referral clinic for diagnostic consultation: autism 18 months–12 years; global developmental delay 18 months–5 years; intellectual disability 6–12 years; ADHD 4–12 years. It does not accept learning-disability or specific-learning-disorder referrals or provide developmental therapies.",
    contact: "Ask the child's primary care provider to review the published criteria and submit the required referral records",
    sourceName: "UK HealthCare",
    sourceUrl: "https://ukhealthcare.uky.edu/golisano-childrens-uk/services/developmental-pediatrics/refer-patient",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "provider_referral"
  },
  {
    id: "ky_lend",
    name: "Kentucky LEND",
    domains: ["parent_support", "diagnosis_education"],
    counties: ["statewide"],
    summary: "An interdisciplinary leadership training program open to eligible graduate or postgraduate trainees, family members of people with intellectual or developmental disabilities, and self-advocates. It is a leadership and learning opportunity, not a clinical service.",
    contact: "Review trainee eligibility and the current application cycle",
    sourceName: "University of Kentucky Human Development Institute",
    sourceUrl: "https://hdi.uky.edu/lend/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kynect_resources",
    name: "kynect resources",
    domains: ALL_DOMAINS,
    counties: ["statewide"],
    summary: "Kentucky's community-resource search for local support. Use a specific keyword and location, then confirm the listing directly.",
    contact: "Search kynect resources for terms such as “developmental disability” plus the county",
    sourceName: "Kentucky Cabinet for Health and Family Services",
    sourceUrl: "https://www.chfs.ky.gov/agencies/ohda/Pages/kynectresources.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "kentucky_211",
    name: "Kentucky 211",
    domains: ALL_DOMAINS,
    counties: ["statewide"],
    summary: "Statewide, 24/7 navigation to community services, including disability, independent-living, transportation, food, housing, and financial resources.",
    contact: "Dial 211 or text your ZIP code to 898211",
    sourceName: "Kentucky 211",
    sourceUrl: "https://kentucky211.org/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "autism_society_bluegrass",
    name: "Autism Society of the Bluegrass",
    domains: ["parent_support", "diagnosis_education", "recreation"],
    counties: ["Fayette", "Scott", "Woodford", "Bourbon", "Clark", "Jessamine", "Madison"],
    summary: "A Central Kentucky autism support and resource group with a listserv, meetings, education, and member scholarships. Meeting details can change, so confirm through the listserv.",
    contact: "Join the ASBG listserv or use the website contact information to confirm the next meeting",
    sourceName: "Autism Society of the Bluegrass",
    sourceUrl: "https://asbg.org/",
    verifiedAt: RECHECKED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "central_kentucky_riding_for_hope",
    name: "Central Kentucky Riding for Hope",
    domains: ["recreation", "therapies"],
    counties: ["Fayette", "Scott"],
    ages: { min: 5 },
    summary: "Equine-assisted activities at the Kentucky Horse Park for people with physical, cognitive, emotional, or social needs. Therapeutic riding is currently $40 per 30-minute lesson with an automatic scholarship built into the rate.",
    contact: "Contact the Client Relations Director through the services page",
    sourceName: "Central Kentucky Riding for Hope",
    sourceUrl: "https://ckrh.org/services/",
    verifiedAt: SOURCE_RECHECKED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "lexington_therapeutic_recreation",
    name: "Lexington Therapeutic Recreation",
    domains: ["recreation"],
    counties: ["Fayette"],
    summary: "Lexington Parks & Recreation programs for people with disabilities, including camps, sports, fitness, social events, and trips. Registration is seasonal and first-come.",
    contact: "Call 859-288-2928 and ask whether a program accepts non-Fayette residents",
    sourceName: "Lexington-Fayette Urban County Government",
    sourceUrl: "https://www.lexingtonky.gov/playing/therapeutic-recreation",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "dsack",
    name: "Down Syndrome Association of Central Kentucky",
    domains: ["parent_support", "diagnosis_education"],
    counties: ["Fayette", "Scott", "Woodford", "Bourbon", "Clark", "Jessamine", "Madison"],
    summary: "Support, education, social events, and lifespan programs for people with Down syndrome and their families across Central and Eastern Kentucky. Many programs are free; the K–8 education co-op is tuition-based.",
    contact: "Call 859-494-7809 or use the DSACK program calendar",
    sourceName: "Down Syndrome Association of Central Kentucky",
    sourceUrl: "https://dsack.org/",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "self_serve"
  },
  {
    id: "scott_county_exceptional_child_services",
    name: "Scott County Schools Exceptional Child Services",
    domains: ["school_iep"],
    counties: ["Scott"],
    ages: { min: 3, max: 21.99 },
    summary: "Scott County Schools' Special Education page lists the district director, assistant director, and administrative assistant for special-education questions.",
    contact: "Call Director Harper Rowlett at 502-570-3063 or Assistant Director Veronica Weitlauf at 502-570-3015",
    sourceName: "Scott County Schools",
    sourceUrl: "https://www.scott.kyschools.us/departments/student-learning/exceptional-child-services/special-education",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "school_contact"
  },
  {
    id: "scott_county_frysc",
    name: "Scott County Family Resource and Youth Services Centers",
    domains: ["parent_support"],
    counties: ["Scott"],
    summary: "School-based Family Resource and Youth Services Centers connect students and families to services that remove nonacademic barriers to learning; offerings vary by local population, resources, and location.",
    contact: "Call the child's school and ask for its Family Resource or Youth Services Center coordinator",
    sourceName: "Kentucky Family Resource and Youth Services Centers",
    sourceUrl: "https://www.chfs.ky.gov/agencies/dfrcvs/dfrysc/Pages/default.aspx",
    verifiedAt: RECHECKED_AT,
    humanVerify: true,
    referralMode: "school_contact"
  },
  {
    id: "chadd_kentucky_connections",
    name: "CHADD Kentucky Connections",
    domains: ["parent_support", "diagnosis_education"],
    counties: ["statewide"],
    summary: "Kentucky's CHADD affiliate provides a statewide online peer and education connection for people affected by ADHD. Confirm the current monthly Zoom meeting before attending.",
    contact: "Use the CHADD chapter page to request the next online meeting details",
    sourceName: "Children and Adults with Attention-Deficit/Hyperactivity Disorder",
    sourceUrl: "https://www.chadd.net/chapter/859",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "self_serve"
  },
  {
    id: "feat_louisville",
    name: "FEAT of Louisville",
    domains: ["parent_support", "recreation", "therapies"],
    counties: ["Jefferson", "Bullitt", "Oldham", "Shelby", "Spencer"],
    ages: { min: 2, max: 21.99 },
    summary: "Louisville-area autism family support and recreation programs, including age-banded preschool, camp, and swim-safety opportunities. Program availability changes by season.",
    contact: "Use the FEAT program pages to confirm the current session and registration window",
    sourceName: "Families for Effective Autism Treatment of Louisville",
    sourceUrl: "https://featoflouisville.org/parents/programs-new/",
    verifiedAt: RECHECKED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "down_syndrome_louisville",
    name: "Down Syndrome of Louisville",
    domains: ["parent_support", "therapies", "future_planning"],
    counties: ["Jefferson", "Bullitt", "Oldham", "Shelby", "Spencer"],
    summary: "Louisville-area Down syndrome support with age-banded education, therapy, employment, and family programs across the lifespan.",
    contact: "Call 502-495-5088 or select the age-appropriate program on the website",
    sourceName: "Down Syndrome of Louisville",
    sourceUrl: "https://dsoflou.org/",
    verifiedAt: RECHECKED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "lda_kentucky",
    name: "Learning Disabilities Association of Kentucky",
    domains: ["parent_support", "school_iep"],
    counties: ["statewide"],
    summary: "Statewide information, support, and advocacy for Kentuckians affected by learning disabilities.",
    contact: "Call 502-473-1256 or use the website contact form to confirm current services",
    sourceName: "Learning Disabilities Association of Kentucky",
    sourceUrl: "https://www.ldaofky.org/",
    verifiedAt: CATALOG_REFRESHED_AT,
    referralMode: "call"
  },
  {
    id: "sibling_support_project",
    name: "Sibling Support Project directory",
    domains: ["sibling_support", "parent_support"],
    counties: ["statewide"],
    summary: "A national Sibshop directory and sibling-support resource. No current Kentucky Sibshop was independently confirmed, so use the directory as a lead and verify any nearby listing before travel.",
    contact: "Search the directory, then ask KY-SPIN or a navigator to help confirm a current option",
    sourceName: "Sibling Support Project",
    sourceUrl: "https://siblingsupport.org/sibshops/find-a-sibshop-near-you/",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "navigator_referral"
  },
  // Procedural guidance, following the kde_dispute_resolution / kde_age_three_transition
  // precedent: the entry IS the process, not an organization with an intake line. Named
  // with a proper-noun anchor (IDEA / KDE / FBA) so the follow-up lint's catalog-name
  // alternation cannot swallow ordinary caregiver phrasing. Every one carries
  // humanVerify until the sources are checked by hand.
  {
    id: "idea_school_discipline",
    name: "IDEA school discipline protections",
    domains: ["school_iep"],
    counties: ["statewide"],
    ages: { min: 3, max: 21.99 },
    summary:
      "IDEA treats a removal of more than 10 consecutive school days as a change of placement. A series of removals totaling more than 10 school days is a change of placement only if it forms a pattern under 34 CFR 300.536. Within 10 school days of a decision to make a disciplinary change of placement, the LEA, parent, and relevant IEP-team members must conduct a manifestation determination. A not-yet-eligible child may assert IDEA discipline protections only when the LEA had the knowledge specified in 34 CFR 300.534.",
    contact:
      "Ask the district in writing whether the removals constitute a change of placement and, if so, when the manifestation determination will be held; keep a dated copy",
    actNow:
      "Track the date and length of every removal. A total over 10 school days does not by itself require a manifestation determination; the pattern and change-of-placement rules matter.",
    sourceName: "IDEA regulations, U.S. Department of Education (34 CFR 300.530-300.536)",
    sourceUrl: "https://sites.ed.gov/idea/regs/b/e/300.530",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "self_serve"
  },
  {
    id: "kde_evaluation_request",
    name: "KDE special education evaluation request",
    domains: ["school_iep"],
    counties: ["statewide"],
    ages: { min: 3, max: 21.99 },
    summary:
      "A parent may request an initial special-education evaluation. Kentucky's referral system must accept referrals from district and nondistrict sources and consider whether an evaluation is warranted. If the district proceeds, it must obtain written parental consent; Kentucky's 60-school-day evaluation timeline runs from receipt of that consent, not from the request.",
    contact:
      "Send the request to the district's special-education office and ask for a written response; if the district agrees to evaluate, ask for the Consent to Evaluate form",
    actNow:
      "Keep a dated copy of the request, but do not describe that date as starting the evaluation clock. The 60-school-day clock starts when the district receives written parental consent.",
    sourceName: "Kentucky Department of Education evaluation and eligibility guidance",
    sourceUrl: "https://www.education.ky.gov/specialed/excep/GuidanceResources/Pages/evalelig.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "school_contact"
  },
  {
    id: "fba_bip_request",
    name: "FBA and behavior intervention plan request",
    domains: ["school_iep", "therapies"],
    counties: ["statewide"],
    ages: { min: 3, max: 21.99 },
    summary:
      "An FBA identifies the function or purpose of behavior and the factors that contribute to when it occurs. The ARC/IEP team may use its findings to select positive behavioral interventions, develop or revise a behavior intervention plan, and revise the IEP. IDEA requires an IEP team to consider positive behavioral interventions and supports when behavior impedes the child's learning or that of others.",
    contact: "Ask the ARC team in writing to consider an FBA and a function-based BIP; ask whether parental consent is required for the proposed assessment",
    sourceName: "Kentucky Department of Education, Office of Special Education and Early Learning",
    sourceUrl: "https://www.education.ky.gov/specialed/excep/GuidanceResources/Pages/BehaviorResources.aspx",
    verifiedAt: CATALOG_REFRESHED_AT,
    humanVerify: true,
    referralMode: "school_contact"
  }
];

// Verified exclusion 2026-07-17: do not seed The Arc of Kentucky. The national chapter finder lists no Kentucky
// state chapter, while stale Kentucky directories still surface the inactive organization and frozen site.
// Verified exclusion 2026-07-17: do not seed IDA Kentucky. Its official site says it is no longer available even
// though the national International Dyslexia Association directory still links to it.
// Verified exclusion 2026-07-17: do not seed helpmegrowky.com. Its TLS certificate is expired; use the CHFS page.
// Verified exclusion 2026-07-17: do not seed the CHFS FamilyGuidetoServices PDF. The legacy PDF returns 404.
// Verified exclusion 2026-07-17: do not seed legacy KATC louisville.edu, archived Michelle P. provider,
// dpa.ky.gov P&A, or chfs.ky.gov/agencies/ccshcn OCSHCN URLs; the current primary URLs above replace them.

export const FAMILY_RESOURCE_CATALOG: FamilyResource[] = [
  ...STATEWIDE_AND_LOCAL_RESOURCES.slice(0, 3),
  ...FIRST_STEPS_POE_RESOURCES,
  ...STATEWIDE_AND_LOCAL_RESOURCES.slice(3),
  ...LOCAL_SDOH_TRANSPORTATION_RESOURCES
];

export interface FamilyResourceSearch {
  county: string;
  domain: DevNeedDomain;
  childAgeYears: number;
  limit?: number;
}

const normalizeCounty = (county: string): string => county.trim().replace(/\s+County$/i, "");

const matchesAge = (resource: FamilyResource, age: number): boolean => {
  if (resource.ages?.min !== undefined && age < resource.ages.min) return false;
  if (resource.ages?.max !== undefined && age > resource.ages.max) return false;
  return true;
};

export function findFamilyResources({
  county,
  domain,
  childAgeYears: age,
  limit = 4
}: FamilyResourceSearch): FamilyResource[] {
  const normalizedCounty = normalizeCounty(county);
  const safeLimit = Math.max(0, Math.floor(limit));

  return FAMILY_RESOURCE_CATALOG.filter(
    (resource) =>
      resource.domains.includes(domain) &&
      matchesAge(resource, age) &&
      (resource.counties.includes(normalizedCounty) || resource.counties.includes("statewide"))
  )
    .map((resource, catalogIndex) => ({
      resource,
      catalogIndex,
      countyRank: resource.counties.includes(normalizedCounty) ? 0 : 1
    }))
    .sort((left, right) => left.countyRank - right.countyRank || left.catalogIndex - right.catalogIndex)
    .slice(0, safeLimit)
    .map(({ resource }) => resource);
}

export function getFamilyResourceById(id: string): FamilyResource | undefined {
  return FAMILY_RESOURCE_CATALOG.find((resource) => resource.id === id);
}

/** The statewide entry plus every generated POE district share this prefix. */
export function isFirstStepsResource(resourceId: string): boolean {
  return resourceId.startsWith("first_steps");
}

const FAMILY_DOMAIN_LABELS: Record<DevNeedDomain, string> = {
  early_intervention: "Early intervention",
  therapies: "Therapies",
  school_iep: "School and IEP support",
  waivers_financial: "Waivers and financial support",
  respite: "Respite",
  parent_support: "Parent support",
  sibling_support: "Sibling support",
  transportation: "Transportation",
  future_planning: "Future planning",
  diagnosis_education: "Diagnosis education",
  recreation: "Recreation"
};

export function familyDomainLabel(domain: DevNeedDomain): string {
  return FAMILY_DOMAIN_LABELS[domain];
}

export function childAgeYears(profile: FamilyProfile, now = new Date()): number {
  const ageAtYearStart = now.getUTCFullYear() - profile.birthYear;
  if (profile.birthMonth === undefined) return ageAtYearStart;

  const ageInMonths = ageAtYearStart * 12 + (now.getUTCMonth() + 1 - profile.birthMonth);
  return ageInMonths / 12;
}
