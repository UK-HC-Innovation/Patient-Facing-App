"use client";

import { useEffect, useState } from "react";
import { FamilyExperience } from "@/components/family-experience";
import { useHealthState } from "@/state/store";

// Ladder brings its own shell: a header that carries the language control on
// every surface, and four labelled tabs instead of the app-wide two-link bar
// (which is also the thing that clips at 200% zoom). The way back to the rest
// of the app is a quiet link at the foot of the shell.
export default function FamilyPage() {
  const { state, dispatch } = useHealthState();
  const [passcode, setPasscode] = useState<string | undefined>();

  useEffect(() => {
    const queryPasscode = new URLSearchParams(window.location.search).get("k");
    setPasscode(queryPasscode ?? undefined);
  }, []);

  return <FamilyExperience state={state} dispatch={dispatch} passcode={passcode} />;
}
