import { useCallback, useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { HealthAction } from "@/state/store";
import {
  clearFamilyDraft,
  loadFamilyDraft,
  saveFamilyDraft,
  tombstoneFamilyDraft
} from "@/state/family-draft-storage";

const FAMILY_DRAFT_RECOVERY_DELAY_MS = 250;
const FAMILY_DRAFT_CHECKPOINT_DELAY_MS = 2000;

export type FamilyDraftPersistence = {
  schedule(draft: string): void;
  flush(): void;
  cancel(): void;
};

/**
 * Writes the high-frequency recovery copy to its own small versioned record.
 * The full AppState receives a slower checkpoint, so typing does not serialize
 * the entire application every 250 ms. Page exit flushes both layers.
 */
export function useFamilyDraftPersistence(
  patientId: string,
  persistedDraft: string,
  dispatch: Dispatch<HealthAction>,
  recoveryDelayMs = FAMILY_DRAFT_RECOVERY_DELAY_MS,
  checkpointDelayMs = FAMILY_DRAFT_CHECKPOINT_DELAY_MS
): FamilyDraftPersistence {
  const persistedDraftRef = useRef(persistedDraft);
  const pendingDraftRef = useRef<string | null>(null);
  const recoveryTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const checkpointTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const recoveredPatientRef = useRef<string | null>(null);

  const clearTimers = useCallback((): void => {
    if (recoveryTimerRef.current !== null) {
      globalThis.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    if (checkpointTimerRef.current !== null) {
      globalThis.clearTimeout(checkpointTimerRef.current);
      checkpointTimerRef.current = null;
    }
  }, []);

  const flush = useCallback((): void => {
    clearTimers();
    const pending = pendingDraftRef.current;
    if (pending === null || pending === persistedDraftRef.current) return;
    saveFamilyDraft(patientId, pending);
    dispatch({ type: "setFamilyInterviewDraft", draft: pending });
  }, [clearTimers, dispatch, patientId]);

  const cancel = useCallback((): void => {
    clearTimers();
    pendingDraftRef.current = null;
    tombstoneFamilyDraft(patientId);
  }, [clearTimers, patientId]);

  const schedule = useCallback(
    (draft: string): void => {
      pendingDraftRef.current = draft;
      clearTimers();
      if (draft === persistedDraftRef.current) {
        pendingDraftRef.current = null;
        clearFamilyDraft(patientId);
        return;
      }
      recoveryTimerRef.current = globalThis.setTimeout(() => {
        recoveryTimerRef.current = null;
        const pending = pendingDraftRef.current;
        if (pending !== null) saveFamilyDraft(patientId, pending);
      }, recoveryDelayMs);
      checkpointTimerRef.current = globalThis.setTimeout(flush, checkpointDelayMs);
    },
    [checkpointDelayMs, clearTimers, flush, patientId, recoveryDelayMs]
  );

  useEffect(() => {
    if (recoveredPatientRef.current === patientId) return;
    recoveredPatientRef.current = patientId;
    const recovered = loadFamilyDraft(patientId);
    if (recovered !== null && recovered !== persistedDraftRef.current) {
      dispatch({ type: "setFamilyInterviewDraft", draft: recovered });
    } else if (recovered === persistedDraftRef.current) {
      clearFamilyDraft(patientId);
    }
  }, [dispatch, patientId]);

  useEffect(() => {
    persistedDraftRef.current = persistedDraft;
    if (pendingDraftRef.current === persistedDraft) {
      clearTimers();
      pendingDraftRef.current = null;
      clearFamilyDraft(patientId);
    }
  }, [clearTimers, patientId, persistedDraft]);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { schedule, flush, cancel };
}
