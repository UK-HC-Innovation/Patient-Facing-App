export const FAMILY_DRAFT_STORAGE_PREFIX = "home-health-ai-ownership-family-draft:v1:";
export const FAMILY_DRAFT_SCHEMA_VERSION = 1;
const FAMILY_DRAFT_MAX_CHARS = 5000;

type FamilyDraftRecord = {
  version: typeof FAMILY_DRAFT_SCHEMA_VERSION;
  format: "ladder-family-draft";
  patientId: string;
  updatedAt: string;
} & (
  | { status: "active"; draft: string }
  | { status: "cleared" }
);

export function familyDraftStorageKey(patientId: string): string {
  return `${FAMILY_DRAFT_STORAGE_PREFIX}${encodeURIComponent(patientId)}`;
}

function validRecord(value: unknown, patientId: string): value is FamilyDraftRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<FamilyDraftRecord>;
  return (
    record.version === FAMILY_DRAFT_SCHEMA_VERSION &&
    record.format === "ladder-family-draft" &&
    record.patientId === patientId &&
    typeof record.updatedAt === "string" &&
    Number.isFinite(new Date(record.updatedAt).valueOf()) &&
    (record.status === "cleared" ||
      (record.status === "active" &&
        typeof record.draft === "string" &&
        record.draft.length > 0 &&
        record.draft.length <= FAMILY_DRAFT_MAX_CHARS))
  );
}

export function saveFamilyDraft(patientId: string, draft: string, now = new Date()): boolean {
  if (typeof window === "undefined" || !patientId) return false;
  const key = familyDraftStorageKey(patientId);
  try {
    const record: FamilyDraftRecord = {
      version: FAMILY_DRAFT_SCHEMA_VERSION,
      format: "ladder-family-draft",
      patientId,
      updatedAt: now.toISOString(),
      ...(draft
        ? { status: "active" as const, draft: draft.slice(0, FAMILY_DRAFT_MAX_CHARS) }
        : { status: "cleared" as const })
    };
    window.localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    // A blocked or full store must never make the textarea unusable.
    return false;
  }
}

export function loadFamilyDraft(patientId: string): string | null {
  if (typeof window === "undefined" || !patientId) return null;
  const key = familyDraftStorageKey(patientId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validRecord(parsed, patientId)) return parsed.status === "active" ? parsed.draft : "";
    window.localStorage.removeItem(key);
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage implementations that reject both reads and removals.
    }
  }
  return null;
}

export function clearFamilyDraft(patientId: string): boolean {
  if (typeof window === "undefined" || !patientId) return false;
  try {
    window.localStorage.removeItem(familyDraftStorageKey(patientId));
    return true;
  } catch {
    // Clearing mounted state still prevents the draft from being reintroduced.
    return false;
  }
}

/** A durable empty value wins over an older full-state checkpoint after a crash. */
export function tombstoneFamilyDraft(patientId: string, now = new Date()): boolean {
  return saveFamilyDraft(patientId, "", now);
}

export function clearAllFamilyDrafts(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const keys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index)
    ).filter((key): key is string => key?.startsWith(FAMILY_DRAFT_STORAGE_PREFIX) === true);
    for (const key of keys) window.localStorage.removeItem(key);
    return true;
  } catch {
    // Some privacy modes disallow enumeration. Current state is still cleared.
    return false;
  }
}
