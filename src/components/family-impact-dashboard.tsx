import { Activity, CalendarCheck2, HeartHandshake, ShieldCheck } from "lucide-react";
import Link from "next/link";
import React, { type ReactNode } from "react";
import type { FamilyImpactSnapshot, ImpactRate } from "@/domain/family-impact";

type MetricCardProps = {
  eyebrow: string;
  value: string;
  denominator: string;
  note: string;
  icon: ReactNode;
  testId: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function metricValue(rate: ImpactRate): string {
  return rate.percent === null ? "Not enough data" : `${rate.percent}%`;
}

function MetricCard({ eyebrow, value, denominator, note, icon, testId }: MetricCardProps) {
  return (
    <article data-testid={testId} className="rounded-control border border-care/15 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-care">{eyebrow}</p>
        <span className="rounded-full bg-calm p-2 text-care" aria-hidden="true">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{denominator}</p>
      <p className="mt-2 text-sm leading-6 text-ink/70">{note}</p>
    </article>
  );
}

function EngagementBar({ snapshot }: { snapshot: FamilyImpactSnapshot }) {
  const { engagement } = snapshot;
  if (engagement.percent === null) {
    return (
      <p className="mt-4 rounded-control border border-dashed border-ink/20 bg-paper p-4 text-sm text-ink/70">
        No eligible synthetic family records are available for this window.
      </p>
    );
  }
  return (
    <div className="mt-4" role="img" aria-label={`${engagement.percent}% engaged; demo target ${engagement.targetPercent}%`}>
      <div className="relative h-5 overflow-hidden rounded-full border border-care/20 bg-calm">
        <div className="h-full bg-care" style={{ width: `${engagement.percent}%` }} />
        <span
          className="absolute inset-y-0 w-0.5 bg-ink"
          style={{ left: `${engagement.targetPercent}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-xs font-semibold text-ink/70">
        <span>{engagement.percent}% observed</span>
        <span>{engagement.targetPercent}% demo target</span>
      </div>
    </div>
  );
}

function VisitOutcomeBar({ snapshot }: { snapshot: FamilyImpactSnapshot }) {
  const { visits } = snapshot;
  if (visits.followThrough.denominator === 0) {
    return (
      <p className="mt-4 rounded-control border border-dashed border-ink/20 bg-paper p-4 text-sm text-ink/70">
        No completed or missed visit outcomes are available yet. Booked, confirmed, offered, and replaced
        appointments are not treated as outcomes.
      </p>
    );
  }
  const completedPercent = visits.followThrough.percent ?? 0;
  const missedPercent = visits.noShow.percent ?? 0;
  return (
    <div
      className="mt-4"
      role="img"
      aria-label={`${visits.completed} completed and ${visits.missed} missed out of ${visits.followThrough.denominator} self-reported visit outcomes`}
    >
      <div className="flex h-8 overflow-hidden rounded-control border border-care/20 bg-paper">
        <div className="bg-care" style={{ width: `${completedPercent}%` }} />
        <div className="border-l-2 border-white bg-note" style={{ width: `${missedPercent}%` }} />
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="font-semibold text-ink">
          <span className="mr-2 inline-block h-3 w-3 rounded-sm bg-care" aria-hidden="true" />
          Completed: {visits.completed} ({completedPercent}%)
        </p>
        <p className="font-semibold text-ink">
          <span className="mr-2 inline-block h-3 w-3 rounded-sm border border-ink/20 bg-note" aria-hidden="true" />
          Missed: {visits.missed} ({missedPercent}%)
        </p>
      </div>
    </div>
  );
}

function PulseDistribution({ snapshot }: { snapshot: FamilyImpactSnapshot }) {
  const { experience } = snapshot;
  if (experience.denominator === 0) {
    return (
      <p className="mt-4 rounded-control border border-dashed border-ink/20 bg-paper p-4 text-sm text-ink/70">
        No scored experience pulses are available. Skipped check-ins do not enter this denominator.
      </p>
    );
  }
  const scores = [1, 2, 3, 4, 5] as const;
  const maxCount = Math.max(...scores.map((score) => experience.distribution[score]));
  return (
    <div className="mt-4 space-y-3" role="img" aria-label={`Distribution of ${experience.denominator} scored patient-experience pulses`}>
      {scores.map((score) => {
        const count = experience.distribution[score];
        const width = maxCount === 0 ? 0 : Math.round((count / maxCount) * 100);
        return (
          <div key={score} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="font-semibold text-ink">Score {score}</span>
            <span className="h-4 overflow-hidden rounded-full bg-calm">
              <span className="block h-full bg-care" style={{ width: `${width}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums text-ink">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FamilyImpactDashboard({ snapshot }: { snapshot: FamilyImpactSnapshot }) {
  const engagementDenominator =
    snapshot.engagement.denominator === 0
      ? "0 eligible synthetic families"
      : `${snapshot.engagement.numerator} of ${snapshot.engagement.denominator} eligible synthetic families`;
  const visitDenominator =
    snapshot.visits.followThrough.denominator === 0
      ? "0 self-reported visit outcomes"
      : `${snapshot.visits.completed} completed of ${snapshot.visits.followThrough.denominator} outcomes`;
  const experienceDenominator =
    snapshot.experience.denominator === 0
      ? "0 scored pulses"
      : `${snapshot.experience.numerator} of ${snapshot.experience.denominator} scored pulses`;
  const engagementNote =
    snapshot.engagement.denominator === 0
      ? `No rate until an eligible family exists. Target: at least ${snapshot.engagement.targetPercent}%.`
      : `${snapshot.engagement.touches} dated journey touches in the window. Target: at least ${snapshot.engagement.targetPercent}%.`;
  const visitNote =
    snapshot.visits.noShow.denominator === 0
      ? `No rate until a visit is self-reported completed or missed. No-show reference: at or below ${snapshot.visits.noShowReferencePercent}%.`
      : `${snapshot.visits.missed} of ${snapshot.visits.noShow.denominator} outcomes were missed (${metricValue(snapshot.visits.noShow)} no-show); reference is at or below ${snapshot.visits.noShowReferencePercent}%.`;
  const experienceNote =
    snapshot.experience.denominator === 0
      ? "No rate until a family scores the optional pulse. Skips stay excluded."
      : `Scores of 4–5 count as positive. ${snapshot.experience.respondingFamilies} synthetic families contributed; skips are excluded.`;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="rounded-control bg-care px-5 py-6 text-white sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/75">UKHCI Ladder</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Clinic impact dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
                A point-in-time view of engagement, evaluation-visit follow-through, and the family support pulse.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-2 text-sm font-semibold">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Demo only · synthetic · on-device
            </span>
          </div>
          <p className="mt-5 border-t border-white/20 pt-4 text-sm leading-6 text-white/80">
            Frozen snapshot as of {formatDate(snapshot.asOf)}. No real family data, clinic feed, EHR, scheduler,
            account, upload, or live refresh is connected.
          </p>
        </header>

        <section aria-labelledby="impact-summary-title" className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="impact-summary-title" className="text-xl font-bold">Impact summary</h2>
              <p className="mt-1 text-sm text-ink/65">
                Every headline keeps its numerator and denominator on the card.
              </p>
            </div>
            <p className="text-sm font-semibold text-ink/65">
              Engagement window: {formatDate(snapshot.windowStart)}–{formatDate(snapshot.asOf)}
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <MetricCard
              eyebrow="30-day engagement"
              value={metricValue(snapshot.engagement)}
              denominator={engagementDenominator}
              note={engagementNote}
              icon={<Activity className="h-5 w-5" />}
              testId="impact-engagement-card"
            />
            <MetricCard
              eyebrow="Visit follow-through"
              value={metricValue(snapshot.visits.followThrough)}
              denominator={visitDenominator}
              note={visitNote}
              icon={<CalendarCheck2 className="h-5 w-5" />}
              testId="impact-visits-card"
            />
            <MetricCard
              eyebrow="Patient-experience pulse"
              value={metricValue(snapshot.experience)}
              denominator={experienceDenominator}
              note={experienceNote}
              icon={<HeartHandshake className="h-5 w-5" />}
              testId="impact-experience-card"
            />
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="engagement-detail-title" className="rounded-control border border-ink/10 bg-white p-5">
            <h2 id="engagement-detail-title" className="text-lg font-bold">30-day engagement</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Families with at least one dated Ladder touch ÷ eligible synthetic families enrolled by the snapshot date.
            </p>
            <EngagementBar snapshot={snapshot} />
          </section>

          <section aria-labelledby="visit-detail-title" className="rounded-control border border-ink/10 bg-white p-5">
            <h2 id="visit-detail-title" className="text-lg font-bold">Evaluation-visit outcomes</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              Completed or missed self-reports only. Pending: {snapshot.visits.pending}. Replaced and excluded: {snapshot.visits.excludedReplaced}.
            </p>
            <VisitOutcomeBar snapshot={snapshot} />
          </section>

          <section aria-labelledby="pulse-detail-title" className="rounded-control border border-ink/10 bg-white p-5 lg:col-span-2">
            <h2 id="pulse-detail-title" className="text-lg font-bold">Patient-experience pulse distribution</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              “How supported do you feel this month?” Scores 4–5 are the agreed positive measure; every scored response counts, including repeat months.
            </p>
            <PulseDistribution snapshot={snapshot} />
          </section>
        </div>

        <section data-testid="impact-source-note" aria-labelledby="impact-source-title" className="mt-6 rounded-control border border-note bg-note/20 p-5">
          <h2 id="impact-source-title" className="font-bold">What this demo can—and cannot—say</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            These rates prove the metric definitions and clinic-facing layout against {snapshot.cohort.included} invented cohort rows. They do not establish real-world impact, causality, a baseline comparison, or statistical confidence. The dashboard is computed in this app from the same typed family journey records that drive Ladder; it sends nothing anywhere.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Excluded from the cohort denominator: {snapshot.cohort.excludedNotEnrolled} not enrolled by the as-of date and {snapshot.cohort.excludedMissingProfile} without a profile. Real multi-family reporting remains blocked on consent, a secure tenant-isolated backend, clinic operations ownership, and an approved evaluation protocol.
          </p>
        </section>

        <nav aria-label="Dashboard links" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
          <Link className="min-h-11 content-center text-care underline underline-offset-4" href="/demo">
            Stakeholder demos
          </Link>
          <Link className="min-h-11 content-center text-care underline underline-offset-4" href="/ladder">
            Open family Ladder
          </Link>
          <Link className="min-h-11 content-center text-care underline underline-offset-4" href="/menu">
            All app features
          </Link>
        </nav>
      </div>
    </main>
  );
}
