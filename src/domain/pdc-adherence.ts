export type DiabetesMedicationClassId =
  | "biguanide"
  | "sulfonylurea"
  | "thiazolidinedione"
  | "dpp4_inhibitor"
  | "gip_glp1_receptor_agonist"
  | "meglitinide"
  | "sglt2_inhibitor";

export interface DiabetesMedicationClass {
  id: DiabetesMedicationClassId;
  label: string;
  pqaTable: "BG" | "SFU" | "TZD" | "DPP4" | "GIP/GLP1" | "MEG" | "SGLT2";
  targetDrugs: string[];
}

export interface PdcDiabetesPolicy {
  measureId: "pdc_diabetes";
  sourceObservationType: "pharmacy_fill_claim";
  derivedObservationType: "med_pdc_daily";
  thresholdPercent: 80;
  measurementPeriod: "measurement_year";
  treatmentPeriod: "ipsd_to_measurement_year_end";
  sameDrugOverlapStrategy: "carry_forward";
  insulinHandling: "required_exclusion";
  minimumClaimsOnDifferentDates: 2;
  minimumTreatmentPeriodDays: 91;
  medicationClasses: DiabetesMedicationClass[];
}

export interface PharmacyFillClaim {
  id: string;
  medicationName: string;
  dateOfService: string;
  daysSupply: number;
}

export interface CalculateDiabetesPdcInput {
  patientId: string;
  measurementYear: number;
  claims: PharmacyFillClaim[];
  disenrollmentDate?: string;
  deathDate?: string;
}

export type DiabetesMedicationClassification =
  | {
      status: "included";
      normalizedName: string;
      targetDrugs: string[];
      medicationClassIds: DiabetesMedicationClassId[];
    }
  | {
      status: "excluded";
      normalizedName: string;
      reason: "insulin_exclusion";
    }
  | {
      status: "needs_review";
      normalizedName: string;
      reason: "unknown_diabetes_medication";
    };

export interface PdcClaimFlag {
  claimId: string;
  medicationName: string;
  reason: "insulin_exclusion" | "unknown_diabetes_medication";
}

export interface AdjustedCoverageInterval {
  claimId: string;
  targetDrug: string;
  startDate: string;
  endExclusive: string;
}

export interface DiabetesPdcResult {
  patientId: string;
  measureId: "pdc_diabetes";
  measurementYear: number;
  eligible: boolean;
  meetsThreshold: boolean;
  coveredDays: number;
  treatmentPeriodDays: number;
  pdcPercent: number;
  thresholdPercent: 80;
  ipsd?: string;
  treatmentPeriodEndExclusive?: string;
  includedClaimIds: string[];
  reviewClaims: PdcClaimFlag[];
  exclusionClaims: PdcClaimFlag[];
  adjustedCoverage: AdjustedCoverageInterval[];
  sourceObservationType: "pharmacy_fill_claim";
  derivedObservationType: "med_pdc_daily";
}

export interface RefillGapInsight {
  eventType: "insight.med.refill_gap";
  patientId: string;
  measureId: "pdc_diabetes";
  pdcPercent: number;
  thresholdPercent: 80;
  sourceObservationType: "pharmacy_fill_claim";
  derivedObservationType: "med_pdc_daily";
  clinicalAction: "navigator_refill_barrier_review";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PDC_DIABETES_POLICY: PdcDiabetesPolicy = {
  measureId: "pdc_diabetes",
  sourceObservationType: "pharmacy_fill_claim",
  derivedObservationType: "med_pdc_daily",
  thresholdPercent: 80,
  measurementPeriod: "measurement_year",
  treatmentPeriod: "ipsd_to_measurement_year_end",
  sameDrugOverlapStrategy: "carry_forward",
  insulinHandling: "required_exclusion",
  minimumClaimsOnDifferentDates: 2,
  minimumTreatmentPeriodDays: 91,
  medicationClasses: [
    {
      id: "biguanide",
      label: "Biguanide medications and combinations",
      pqaTable: "BG",
      targetDrugs: ["metformin"]
    },
    {
      id: "sulfonylurea",
      label: "Sulfonylurea medications and combinations",
      pqaTable: "SFU",
      targetDrugs: ["chlorpropamide", "glimepiride", "glipizide", "glyburide", "tolazamide", "tolbutamide"]
    },
    {
      id: "thiazolidinedione",
      label: "Thiazolidinediones",
      pqaTable: "TZD",
      targetDrugs: ["pioglitazone", "rosiglitazone"]
    },
    {
      id: "dpp4_inhibitor",
      label: "DPP-4 inhibitors",
      pqaTable: "DPP4",
      targetDrugs: ["alogliptin", "linagliptin", "saxagliptin", "sitagliptin"]
    },
    {
      id: "gip_glp1_receptor_agonist",
      label: "GIP/GLP-1 receptor agonists",
      pqaTable: "GIP/GLP1",
      targetDrugs: [
        "albiglutide",
        "dulaglutide",
        "exenatide",
        "liraglutide",
        "lixisenatide",
        "semaglutide",
        "tirzepatide"
      ]
    },
    {
      id: "meglitinide",
      label: "Meglitinides and combinations",
      pqaTable: "MEG",
      targetDrugs: ["nateglinide", "repaglinide"]
    },
    {
      id: "sglt2_inhibitor",
      label: "Sodium glucose co-transporter 2 inhibitors and combinations",
      pqaTable: "SGLT2",
      targetDrugs: ["bexagliflozin", "canagliflozin", "dapagliflozin", "empagliflozin", "ertugliflozin"]
    }
  ]
};

function normalizeMedicationName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function containsIngredient(normalizedName: string, ingredient: string): boolean {
  const normalizedIngredient = normalizeMedicationName(ingredient).replace(/\s+/g, " ");
  return new RegExp(`(^|\\s)${normalizedIngredient}(\\s|$)`).test(normalizedName);
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return formatDate(new Date(parseDate(date).getTime() + days * DAY_MS));
}

function daysBetween(startInclusive: string, endExclusive: string): number {
  return Math.max(0, Math.round((parseDate(endExclusive).getTime() - parseDate(startInclusive).getTime()) / DAY_MS));
}

function minDate(dates: string[]): string {
  return dates.sort()[0] ?? "";
}

function minDefinedDate(dates: Array<string | undefined>): string | undefined {
  return dates.filter((date): date is string => typeof date === "string" && date.length > 0).sort()[0];
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function mergeCoverageDays(intervals: AdjustedCoverageInterval[], periodStart: string, periodEnd: string): number {
  const clipped = intervals
    .map((interval) => ({
      startDate: interval.startDate < periodStart ? periodStart : interval.startDate,
      endExclusive: interval.endExclusive > periodEnd ? periodEnd : interval.endExclusive
    }))
    .filter((interval) => interval.startDate < interval.endExclusive)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  let coveredDays = 0;
  let activeEnd = "";

  for (const interval of clipped) {
    const startDate = activeEnd && interval.startDate < activeEnd ? activeEnd : interval.startDate;
    if (startDate < interval.endExclusive) {
      coveredDays += daysBetween(startDate, interval.endExclusive);
      activeEnd = interval.endExclusive > activeEnd ? interval.endExclusive : activeEnd;
    }
  }

  return coveredDays;
}

export function classifyDiabetesMedication(medicationName: string): DiabetesMedicationClassification {
  const normalizedName = normalizeMedicationName(medicationName);
  if (/(^|\s)insulin(\s|$)/.test(normalizedName)) {
    return { status: "excluded", normalizedName, reason: "insulin_exclusion" };
  }

  const targetDrugs = new Set<string>();
  const medicationClassIds = new Set<DiabetesMedicationClassId>();
  for (const medicationClass of PDC_DIABETES_POLICY.medicationClasses) {
    for (const targetDrug of medicationClass.targetDrugs) {
      if (containsIngredient(normalizedName, targetDrug)) {
        targetDrugs.add(targetDrug);
        medicationClassIds.add(medicationClass.id);
      }
    }
  }

  if (targetDrugs.size === 0) {
    return { status: "needs_review", normalizedName, reason: "unknown_diabetes_medication" };
  }

  return {
    status: "included",
    normalizedName,
    targetDrugs: [...targetDrugs].sort(),
    medicationClassIds: [...medicationClassIds]
  };
}

export function calculateDiabetesPdc(input: CalculateDiabetesPdcInput): DiabetesPdcResult {
  const measurementPeriodStart = `${input.measurementYear}-01-01`;
  const measurementPeriodEndExclusive = `${input.measurementYear + 1}-01-01`;
  const sortedClaims = input.claims
    .filter(
      ({ dateOfService }) =>
        dateOfService >= measurementPeriodStart && dateOfService < measurementPeriodEndExclusive
    )
    .sort((left, right) =>
      left.dateOfService === right.dateOfService
        ? left.id.localeCompare(right.id)
        : left.dateOfService.localeCompare(right.dateOfService)
    );
  const reviewClaims: PdcClaimFlag[] = [];
  const exclusionClaims: PdcClaimFlag[] = [];
  const includedClaims = sortedClaims.flatMap((claim) => {
    const classification = classifyDiabetesMedication(claim.medicationName);
    if (classification.status === "needs_review") {
      reviewClaims.push({
        claimId: claim.id,
        medicationName: claim.medicationName,
        reason: classification.reason
      });
      return [];
    }
    if (classification.status === "excluded") {
      exclusionClaims.push({
        claimId: claim.id,
        medicationName: claim.medicationName,
        reason: classification.reason
      });
      return [];
    }
    return [{ claim, classification }];
  });

  const ipsd = minDate(includedClaims.map(({ claim }) => claim.dateOfService));
  const treatmentPeriodEndExclusive = minDefinedDate([
    input.disenrollmentDate ? addDays(input.disenrollmentDate, 1) : undefined,
    input.deathDate ? addDays(input.deathDate, 1) : undefined,
    measurementPeriodEndExclusive
  ]);
  const treatmentPeriodDays =
    ipsd && treatmentPeriodEndExclusive ? daysBetween(ipsd, treatmentPeriodEndExclusive) : 0;
  const lastEndByTargetDrug = new Map<string, string>();
  const adjustedCoverage: AdjustedCoverageInterval[] = [];

  for (const { claim, classification } of includedClaims) {
    for (const targetDrug of classification.targetDrugs) {
      const previousEnd = lastEndByTargetDrug.get(targetDrug);
      const startDate = previousEnd && claim.dateOfService < previousEnd ? previousEnd : claim.dateOfService;
      const endExclusive = addDays(startDate, claim.daysSupply);
      lastEndByTargetDrug.set(targetDrug, endExclusive);
      adjustedCoverage.push({
        claimId: claim.id,
        targetDrug,
        startDate,
        endExclusive
      });
    }
  }

  const coveredDays =
    ipsd && treatmentPeriodEndExclusive ? mergeCoverageDays(adjustedCoverage, ipsd, treatmentPeriodEndExclusive) : 0;
  const pdcPercent = treatmentPeriodDays > 0 ? roundPercent((coveredDays / treatmentPeriodDays) * 100) : 0;
  const differentFillDates = new Set(includedClaims.map(({ claim }) => claim.dateOfService));
  const eligible =
    exclusionClaims.length === 0 &&
    differentFillDates.size >= PDC_DIABETES_POLICY.minimumClaimsOnDifferentDates &&
    treatmentPeriodDays >= PDC_DIABETES_POLICY.minimumTreatmentPeriodDays;
  const meetsThreshold = eligible && pdcPercent >= PDC_DIABETES_POLICY.thresholdPercent;

  return {
    patientId: input.patientId,
    measureId: PDC_DIABETES_POLICY.measureId,
    measurementYear: input.measurementYear,
    eligible,
    meetsThreshold,
    coveredDays,
    treatmentPeriodDays,
    pdcPercent,
    thresholdPercent: PDC_DIABETES_POLICY.thresholdPercent,
    ipsd: ipsd || undefined,
    treatmentPeriodEndExclusive,
    includedClaimIds: includedClaims.map(({ claim }) => claim.id),
    reviewClaims,
    exclusionClaims,
    adjustedCoverage,
    sourceObservationType: PDC_DIABETES_POLICY.sourceObservationType,
    derivedObservationType: PDC_DIABETES_POLICY.derivedObservationType
  };
}

export function buildRefillGapInsight(result: DiabetesPdcResult): RefillGapInsight | null {
  if (!result.eligible || result.meetsThreshold) {
    return null;
  }

  return {
    eventType: "insight.med.refill_gap",
    patientId: result.patientId,
    measureId: result.measureId,
    pdcPercent: result.pdcPercent,
    thresholdPercent: result.thresholdPercent,
    sourceObservationType: result.sourceObservationType,
    derivedObservationType: result.derivedObservationType,
    clinicalAction: "navigator_refill_barrier_review"
  };
}
