"use client";

import { useEffect, useState } from "react";
import { PrivacyPanel } from "@/components/privacy-panel";
import { AppShell } from "@/components/app-shell";
import { useHealthState } from "@/state/store";
import { recordAuditEvent } from "@/domain/audit";
import { aiDataModeForVoiceTransport, type AiDataMode } from "@/domain/privacy-disclosure";
import { buildDataExport, downloadDataExportFile } from "@/state/data-export";

export default function PrivacyPage() {
  const { state, dispatch, deleteStoredData } = useHealthState();
  const [aiDataMode, setAiDataMode] = useState<AiDataMode>("checking");
  const [deleteStatus, setDeleteStatus] = useState<
    "idle" | "pending" | "complete" | "partial" | "unavailable"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();
    const passcode = new URLSearchParams(window.location.search).get("k") ?? undefined;

    void fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId: state.patient.id, passcode, probe: true }),
      signal: controller.signal
    })
      .then((response) => response.json())
      .then((result: unknown) => {
        if (typeof result === "object" && result !== null && "mode" in result) {
          const candidate = result as { mode?: "live" | "mock" | "error" | "blocked"; reason?: string };
          setAiDataMode(aiDataModeForVoiceTransport(candidate));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAiDataMode("cloud_text");
        }
      });

    return () => controller.abort();
  }, [state.patient.id]);

  function handleExport() {
    const exportEvent = recordAuditEvent(state.patient.id, "exported", "Data exported");
    dispatch({ type: "addAuditEvent", event: exportEvent });
    const nextStateForExport = {
      ...state,
      auditEvents: [...state.auditEvents, exportEvent]
    };
    downloadDataExportFile(
      buildDataExport(nextStateForExport),
      `home-health-data-${state.patient.id}.json`
    );
  }

  async function handleDelete(): Promise<void> {
    setDeleteStatus("pending");
    const result = await deleteStoredData();
    setDeleteStatus(
      result.status === "cleared"
        ? "complete"
        : result.status === "partial"
          ? "partial"
          : "unavailable"
    );
  }

  return (
    <AppShell title="Privacy">
      <PrivacyPanel
        state={state}
        aiDataMode={aiDataMode}
        onExport={handleExport}
        onReset={() => void handleDelete()}
        onRestoreDefaultDemo={() => dispatch({ type: "resetDemo" })}
        onUpdateAccessibility={(preferences) => dispatch({ type: "updateAccessibilityPreferences", preferences })}
        onUpdateLanguage={(language) => dispatch({ type: "setLanguage", language })}
      />
      {deleteStatus !== "idle" ? (
        <p
          className="mt-4 text-sm"
          role={deleteStatus === "partial" || deleteStatus === "unavailable" ? "alert" : "status"}
        >
          {deleteStatus === "pending"
            ? "Deleting stored demo data…"
            : deleteStatus === "complete"
              ? "Stored demo data was deleted from this browser."
              : deleteStatus === "partial"
                ? "The main record was deleted, but this browser blocked part of the cleanup. Check browser site-data settings before sharing this device."
                : "This browser did not allow Ladder to clear its stored record. Use browser site-data settings before sharing this device."}
        </p>
      ) : null}
    </AppShell>
  );
}
