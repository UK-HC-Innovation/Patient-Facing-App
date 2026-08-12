export const APP_STATE_STORAGE_FORMAT = "home-health-ai-ownership-state";
export const APP_STATE_SCHEMA_VERSION = 1;
export const APP_STATE_STORAGE_META_KEY = "__storage";

export type AppStateStorageMetadataV1 = {
  format: typeof APP_STATE_STORAGE_FORMAT;
  schemaVersion: typeof APP_STATE_SCHEMA_VERSION;
  savedAt: string;
};

export type DecodedAppStateRecord =
  | { status: "legacy"; state: unknown }
  | { status: "current"; state: unknown; savedAt: string }
  | { status: "future_version"; schemaVersion: number }
  | { status: "invalid_envelope"; reason: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function encodeAppStateRecord(
  state: Record<string, unknown>,
  now = new Date()
): Record<string, unknown> & { __storage: AppStateStorageMetadataV1 } {
  return {
    ...state,
    [APP_STATE_STORAGE_META_KEY]: {
      format: APP_STATE_STORAGE_FORMAT,
      schemaVersion: APP_STATE_SCHEMA_VERSION,
      savedAt: now.toISOString()
    }
  };
}

export function decodeAppStateRecord(value: unknown): DecodedAppStateRecord {
  if (!isObject(value) || !(APP_STATE_STORAGE_META_KEY in value)) {
    return { status: "legacy", state: value };
  }

  const metadata = value[APP_STATE_STORAGE_META_KEY];
  if (!isObject(metadata)) {
    return { status: "invalid_envelope", reason: "storage metadata is not an object" };
  }
  if (metadata.format !== APP_STATE_STORAGE_FORMAT) {
    return { status: "invalid_envelope", reason: "storage format is not recognized" };
  }
  if (typeof metadata.schemaVersion !== "number" || !Number.isInteger(metadata.schemaVersion)) {
    return { status: "invalid_envelope", reason: "storage schema version is invalid" };
  }
  if (metadata.schemaVersion !== APP_STATE_SCHEMA_VERSION) {
    return { status: "future_version", schemaVersion: metadata.schemaVersion };
  }
  if (
    typeof metadata.savedAt !== "string" ||
    !Number.isFinite(new Date(metadata.savedAt).valueOf())
  ) {
    return { status: "invalid_envelope", reason: "storage timestamp is invalid" };
  }

  const state = { ...value };
  delete state[APP_STATE_STORAGE_META_KEY];
  return { status: "current", state, savedAt: metadata.savedAt };
}
