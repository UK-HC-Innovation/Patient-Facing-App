export type SdohNeedType =
  | "transportation"
  | "food"
  | "housing"
  | "utilities"
  | "health"
  | "mental_health"
  | "financial"
  | "legal"
  | "general";

export type SdohReferralMode = "navigator_referral" | "directory_search" | "call_211";

export interface KentuckySdohResource {
  id: string;
  name: string;
  needTypes: SdohNeedType[];
  counties: string[];
  summary: string;
  contact: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  referralMode: SdohReferralMode;
}

export interface KentuckySdohResourceSearch {
  county: string;
  needType: SdohNeedType;
  limit?: number;
}

export const sdohNeedOptions: readonly { id: SdohNeedType; label: string }[] = [
  { id: "transportation", label: "Transportation" },
  { id: "food", label: "Food" },
  { id: "housing", label: "Housing" },
  { id: "utilities", label: "Utilities" },
  { id: "health", label: "Health" },
  { id: "mental_health", label: "Mental health" },
  { id: "financial", label: "Finances" },
  { id: "legal", label: "Legal" },
  { id: "general", label: "General" }
];

const allNeeds = sdohNeedOptions.map((option) => option.id);

// Manual source review: the two-page Perry guide was rendered and inspected;
// the other four current primary sources were checked for their routing facts.
const SOURCE_RECHECKED_AT = "2026-08-12";

export const KENTUCKY_SDOH_RESOURCE_CATALOG: readonly KentuckySdohResource[] = [
  {
    id: "lklp_transportation_region_13",
    name: "LKLP Community Action Council transportation",
    needTypes: ["transportation", "health"],
    counties: ["Breathitt", "Clay", "Harlan", "Jackson", "Knott", "Lee", "Leslie", "Letcher", "Owsley", "Perry", "Wolfe"],
    summary:
      "Human services and non-emergency medical transportation broker listed for Region 13, including Perry County.",
    contact: "Call 1-800-245-2826",
    sourceName: "Kentucky Transportation Cabinet Human Services Transportation",
    sourceUrl: "https://transportation.ky.gov/TransportationDelivery/Pages/Human-Services-Transportation.aspx",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "navigator_referral"
  },
  {
    id: "kpta_perry_transportation_directory",
    name: "Perry County transportation directory",
    needTypes: ["transportation"],
    counties: ["Perry"],
    summary: "County transit directory listing Perry County transportation providers and community partners.",
    contact: "Ask navigator to confirm the best transportation provider for the trip",
    sourceName: "Kentucky Public Transit Association county directory",
    sourceUrl: "https://www.kypublictransit.org/transit-by-county",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "navigator_referral"
  },
  {
    id: "perry_county_resource_guide_food",
    name: "Perry County food resources",
    needTypes: ["food"],
    counties: ["Perry"],
    summary:
      "Local resource guide listing Hazard and Perry County food assistance options, pantry locations, and schedule notes.",
    contact: "Ask navigator to confirm pantry hours before travel",
    sourceName: "Perry County Resource Guide",
    sourceUrl:
      "https://kirpky.com/wp-content/uploads/2024/09/Perry-County-Resource-Guide_Aug2024_FINAL-Public-version.pdf",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "navigator_referral"
  },
  {
    id: "perry_county_resource_guide_housing",
    name: "Perry County housing resources",
    needTypes: ["housing", "utilities"],
    counties: ["Perry"],
    summary: "Local resource guide listing housing assistance and related support organizations in Perry County.",
    contact: "Ask navigator to confirm eligibility and intake steps",
    sourceName: "Perry County Resource Guide",
    sourceUrl:
      "https://kirpky.com/wp-content/uploads/2024/09/Perry-County-Resource-Guide_Aug2024_FINAL-Public-version.pdf",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "navigator_referral"
  },
  {
    id: "kynect_resources_statewide",
    name: "kynect resources",
    needTypes: allNeeds,
    counties: ["statewide"],
    summary:
      "Kentucky managed directory for housing, food, transportation, health, finances, education, mental health and addiction, legal help, and other supports.",
    contact: "Browse kynect resources or ask a navigator to create the right referral path",
    sourceName: "Cabinet for Health and Family Services kynect resources",
    sourceUrl: "https://www.chfs.ky.gov/agencies/ohda/Pages/kynectresources.aspx",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "directory_search"
  },
  {
    id: "kentucky_211_statewide",
    name: "Kentucky 211",
    needTypes: allNeeds,
    counties: ["statewide"],
    summary: "24/7 United Way community-service navigation for bills, food, housing, mental health help, and related supports.",
    contact: "Dial 211 or text your ZIP code to 898211",
    sourceName: "Kentucky 211",
    sourceUrl: "https://kentucky211.org/",
    verifiedAt: SOURCE_RECHECKED_AT,
    referralMode: "call_211"
  }
];

const normalizeCounty = (county: string): string => county.trim().replace(/\s+County$/i, "");

const matchesCounty = (resource: KentuckySdohResource, county: string): boolean =>
  resource.counties.includes(county) || resource.counties.includes("statewide");

const countyRank = (resource: KentuckySdohResource, county: string): number =>
  resource.counties.includes(county) ? 0 : 1;

export function findKentuckyResources({ county, needType, limit = 4 }: KentuckySdohResourceSearch): KentuckySdohResource[] {
  const normalizedCounty = normalizeCounty(county);

  return KENTUCKY_SDOH_RESOURCE_CATALOG.filter(
    (resource) => resource.needTypes.includes(needType) && matchesCounty(resource, normalizedCounty)
  )
    .slice()
    .sort((left, right) => countyRank(left, normalizedCounty) - countyRank(right, normalizedCounty))
    .slice(0, limit);
}

export function getKentuckyResourceById(id: string): KentuckySdohResource | undefined {
  return KENTUCKY_SDOH_RESOURCE_CATALOG.find((resource) => resource.id === id);
}

export function sdohNeedLabel(needType: SdohNeedType): string {
  return sdohNeedOptions.find((option) => option.id === needType)?.label ?? needType;
}
