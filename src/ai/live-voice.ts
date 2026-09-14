import { connectLiveSession } from "./live-session";
import {
  buildLiveFacts,
  createDelegationAnswerer,
  describeCurrent,
  lookupSpokenFood,
  withLiveVoicePolicy,
  type CurrentFood
} from "./live-delegation";
import type { VoiceGateDecision } from "./voice-gate";
import type { LiveSessionContext, LiveSessionEvent, LiveSessionHandle } from "./types";

/** What a door can say about itself. Read at call time, so a session always sees the current food. */
export type LiveVoiceOverrides = {
  buildContext?: (context: LiveSessionContext) => string;
  beforePatientResponse?: (text: string) => Promise<void>;
  currentFoodName?: () => string | null;
  buildOpeningLine?: () => string | null;
};

/**
 * Starts GPT-Live for a food door. It lives here, in the chunk a mic tap loads, because the voice
 * hook ships on the first load of both doors and /food/demo has under a kilobyte of budget.
 */
export function startLiveVoice(args: {
  instructions: string;
  language: "en" | "es";
  patientId: string;
  passcode?: string;
  nonce: string;
  getContext: () => LiveSessionContext;
  overrides: () => LiveVoiceOverrides;
  gateTranscript: (transcript: string) => VoiceGateDecision;
  onEvent: (event: LiveSessionEvent) => void;
}): Promise<LiveSessionHandle> {
  const foodName = (): string | null => {
    const named = args.overrides().currentFoodName?.();
    if (named) return named;
    const food = args.getContext().identifiedFood;
    const label = food ? [food.brand, food.name].filter(Boolean).join(" ") : "";
    return label.length > 0 ? label : null;
  };
  const currentFood = (): CurrentFood => ({ name: foodName(), compass: args.getContext().compass ?? null });

  return connectLiveSession({
    instructions: withLiveVoicePolicy(args.instructions),
    language: args.language,
    patientId: args.patientId,
    passcode: args.passcode,
    nonce: args.nonce,
    buildFacts: () => {
      const context = args.getContext();
      const override = args.overrides().buildContext;
      return override ? override(context) : buildLiveFacts(context, foodName());
    },
    buildOpeningLine: () => {
      const scripted = args.overrides().buildOpeningLine?.();
      if (scripted) return scripted;
      const food = currentFood();
      return food.compass ? describeCurrent(food, args.language).text : null;
    },
    answerDelegation: createDelegationAnswerer({
      language: args.language,
      currentFood,
      prepare: (text) => args.overrides().beforePatientResponse?.(text) ?? Promise.resolve(),
      lookup: (query) => lookupSpokenFood(query, args.passcode)
    }),
    gateTranscript: args.gateTranscript,
    onEvent: args.onEvent
  });
}
