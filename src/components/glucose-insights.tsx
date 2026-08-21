import React from "react";
import Link from "next/link";
import type { GlucoseFoodInsight, GlucoseScoreInsight } from "@/domain/glucose-correlation";
import type { TimeInRange } from "@/domain/glucose-range";

type GlucoseInsightsProps = {
  timeInRange: TimeInRange | null;
  foodInsight: GlucoseFoodInsight | null;
  scoreInsight: GlucoseScoreInsight | null;
};

// Two derived, text-only cards for the blood-sugar page. Each is null-guarded by
// its own computed value, so nothing renders when the logs are too sparse.
export function GlucoseInsights({ timeInRange, foodInsight, scoreInsight }: GlucoseInsightsProps) {
  if (!timeInRange && !foodInsight && !scoreInsight) {
    return null;
  }

  return (
    <>
      {timeInRange ? (
        <section className="rounded-control border border-ink/10 bg-white p-4">
          <h2 className="text-lg font-semibold">Time in range</h2>
          <p className="mt-2 text-3xl font-semibold">{timeInRange.percentInRange}%</p>
          <p className="mt-1 text-sm leading-6 text-ink/75">
            {timeInRange.inRange} of your last {timeInRange.total} blood-sugar readings were in the{" "}
            {timeInRange.low}–{timeInRange.high} range. This is general education, not a diagnosis.
          </p>
        </section>
      ) : null}
      {foodInsight || scoreInsight ? (
        <section className="rounded-control border border-care/30 bg-calm p-4">
          <h2 className="text-lg font-semibold">A pattern in your logs</h2>
          {foodInsight ? <p className="mt-2 text-sm leading-6">{foodInsight.message}</p> : null}
          {scoreInsight ? <p className="mt-2 text-sm leading-6">{scoreInsight.message}</p> : null}
          <Link className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-care" href="/food">
            Check a meal
          </Link>
        </section>
      ) : null}
    </>
  );
}
