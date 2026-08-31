const SAFE_HEADER_VALUE = /^[A-Za-z0-9._:+-]{1,240}$/u;

function safeEnvironmentValue(name: string): string | null {
  const value = process.env[name]?.trim() ?? "";
  return SAFE_HEADER_VALUE.test(value) ? value : null;
}

/**
 * Opaque release-evaluator identity. These headers are absent in ordinary builds and are
 * emitted together so a partial or caller-invented identity cannot satisfy the harness.
 */
export function packageLabelEvalHeaders(): Record<string, string> {
  const attestation = safeEnvironmentValue("PACKAGE_LABEL_EVAL_ATTESTATION");
  const sourceRevision = safeEnvironmentValue("PACKAGE_LABEL_EVAL_SOURCE_REVISION");
  const buildId = safeEnvironmentValue("PACKAGE_LABEL_EVAL_BUILD_ID");
  if (!attestation || !sourceRevision || !buildId) return {};
  return {
    "X-Ladder-Eval-Attestation": attestation,
    "X-Ladder-Eval-Source-Revision": sourceRevision,
    "X-Ladder-Eval-Build-Id": buildId
  };
}
