import { describe, expect, it } from "vitest";
import {
  PDC_DIABETES_POLICY,
  buildRefillGapInsight,
  calculateDiabetesPdc,
  classifyDiabetesMedication
} from "./pdc-adherence";

describe("PDC diabetes adherence policy", () => {
  it("pins the D4 policy to the claims PDC-DR measurement contract", () => {
    expect(PDC_DIABETES_POLICY).toEqual(
      expect.objectContaining({
        measureId: "pdc_diabetes",
        sourceObservationType: "pharmacy_fill_claim",
        derivedObservationType: "med_pdc_daily",
        thresholdPercent: 80,
        measurementPeriod: "measurement_year",
        treatmentPeriod: "ipsd_to_measurement_year_end",
        sameDrugOverlapStrategy: "carry_forward",
        insulinHandling: "required_exclusion"
      })
    );
    expect(PDC_DIABETES_POLICY.medicationClasses.map((entry) => entry.id)).toEqual([
      "biguanide",
      "sulfonylurea",
      "thiazolidinedione",
      "dpp4_inhibitor",
      "gip_glp1_receptor_agonist",
      "meglitinide",
      "sglt2_inhibitor"
    ]);
  });

  it("classifies included diabetes medication ingredients and insulin exclusions", () => {
    expect(classifyDiabetesMedication("metformin")).toEqual(
      expect.objectContaining({
        status: "included",
        targetDrugs: ["metformin"],
        medicationClassIds: ["biguanide"]
      })
    );
    expect(classifyDiabetesMedication("semaglutide")).toEqual(
      expect.objectContaining({
        status: "included",
        targetDrugs: ["semaglutide"],
        medicationClassIds: ["gip_glp1_receptor_agonist"]
      })
    );
    expect(classifyDiabetesMedication("insulin glargine")).toEqual(
      expect.objectContaining({ status: "excluded", reason: "insulin_exclusion" })
    );
    expect(classifyDiabetesMedication("mysteryglucose")).toEqual(
      expect.objectContaining({ status: "needs_review", reason: "unknown_diabetes_medication" })
    );
  });

  it("carries forward same-drug overlap instead of double-counting covered days", () => {
    const result = calculateDiabetesPdc({
      patientId: "patient_d4",
      measurementYear: 2026,
      claims: [
        { id: "claim_1", medicationName: "metformin", dateOfService: "2026-01-01", daysSupply: 30 },
        { id: "claim_2", medicationName: "metformin", dateOfService: "2026-01-20", daysSupply: 30 }
      ]
    });

    expect(result.eligible).toBe(true);
    expect(result.meetsThreshold).toBe(false);
    expect(result.coveredDays).toBe(60);
    expect(result.treatmentPeriodDays).toBe(365);
    expect(result.adjustedCoverage).toEqual([
      expect.objectContaining({ claimId: "claim_1", startDate: "2026-01-01", endExclusive: "2026-01-31" }),
      expect.objectContaining({ claimId: "claim_2", startDate: "2026-01-31", endExclusive: "2026-03-02" })
    ]);
  });

  it("uses the IPSD-to-year-end denominator and passes at the 80 percent threshold", () => {
    const result = calculateDiabetesPdc({
      patientId: "patient_d4",
      measurementYear: 2026,
      claims: [
        { id: "claim_1", medicationName: "metformin", dateOfService: "2026-01-01", daysSupply: 150 },
        { id: "claim_2", medicationName: "metformin", dateOfService: "2026-05-31", daysSupply: 150 }
      ]
    });

    expect(result.eligible).toBe(true);
    expect(result.coveredDays).toBe(300);
    expect(result.treatmentPeriodDays).toBe(365);
    expect(result.pdcPercent).toBe(82.19);
    expect(result.meetsThreshold).toBe(true);
  });

  it("ignores claims outside the measurement year before choosing the IPSD", () => {
    const result = calculateDiabetesPdc({
      patientId: "patient_d4",
      measurementYear: 2026,
      claims: [
        { id: "prior_year", medicationName: "metformin", dateOfService: "2025-01-01", daysSupply: 365 },
        { id: "claim_1", medicationName: "metformin", dateOfService: "2026-10-01", daysSupply: 45 },
        { id: "claim_2", medicationName: "metformin", dateOfService: "2026-11-15", daysSupply: 45 },
        { id: "next_year", medicationName: "mysteryglucose", dateOfService: "2027-01-01", daysSupply: 90 }
      ]
    });

    expect(result.ipsd).toBe("2026-10-01");
    expect(result.treatmentPeriodDays).toBe(92);
    expect(result.coveredDays).toBe(90);
    expect(result.pdcPercent).toBe(97.83);
    expect(result.meetsThreshold).toBe(true);
    expect(result.includedClaimIds).toEqual(["claim_1", "claim_2"]);
    expect(result.reviewClaims).toEqual([]);
  });

  it("fails below threshold and emits a refill-gap insight from claims only", () => {
    const result = calculateDiabetesPdc({
      patientId: "patient_d4",
      measurementYear: 2026,
      claims: [
        { id: "claim_1", medicationName: "sitagliptin", dateOfService: "2026-01-01", daysSupply: 125 },
        { id: "claim_2", medicationName: "sitagliptin", dateOfService: "2026-05-06", daysSupply: 125 }
      ]
    });
    const insight = buildRefillGapInsight(result);

    expect(result.eligible).toBe(true);
    expect(result.coveredDays).toBe(250);
    expect(result.pdcPercent).toBe(68.49);
    expect(result.meetsThreshold).toBe(false);
    expect(insight).toEqual(
      expect.objectContaining({
        eventType: "insight.med.refill_gap",
        sourceObservationType: "pharmacy_fill_claim",
        clinicalAction: "navigator_refill_barrier_review"
      })
    );
  });

  it("does not count unknown medication or insulin claims as covered diabetes days", () => {
    const result = calculateDiabetesPdc({
      patientId: "patient_d4",
      measurementYear: 2026,
      claims: [
        { id: "claim_1", medicationName: "mysteryglucose", dateOfService: "2026-01-01", daysSupply: 90 },
        { id: "claim_2", medicationName: "insulin glargine", dateOfService: "2026-02-01", daysSupply: 90 }
      ]
    });

    expect(result.eligible).toBe(false);
    expect(result.coveredDays).toBe(0);
    expect(result.reviewClaims.map((claim) => claim.claimId)).toEqual(["claim_1"]);
    expect(result.exclusionClaims.map((claim) => claim.claimId)).toEqual(["claim_2"]);
  });
});
