"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { FamilyExperience } from "@/components/family-experience";
import { tFamily } from "@/i18n/family-strings";
import { useHealthState } from "@/state/store";

export default function FamilyPage() {
  const { state, dispatch } = useHealthState();
  const [passcode, setPasscode] = useState<string | undefined>();

  useEffect(() => {
    const queryPasscode = new URLSearchParams(window.location.search).get("k");
    setPasscode(queryPasscode ?? undefined);
  }, []);

  return (
    <AppShell title={tFamily(state.patient.language, "pageTitle")}>
      <FamilyExperience state={state} dispatch={dispatch} passcode={passcode} />
    </AppShell>
  );
}
