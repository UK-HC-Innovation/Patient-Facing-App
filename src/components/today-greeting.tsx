"use client";

import { Activity, AlertTriangle, ArrowRight, LockKeyhole, MessageCircle, NotebookPen, Pill, Stethoscope, Upload, type LucideIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import clsx from "clsx";
import { tHome } from "@/i18n/home-strings";
import type { Language } from "@/i18n/strings";
import type { TaskItem } from "@/domain/types";

export type ChipTone = "urgent" | "active" | "suggested";

// The chip's loudness mirrors the app's own epistemics: a reading that needs a
// same-day care-team touch (needs_review) is never dressed up as a friendly
// suggestion. The one carve-out is the first-reading nudge, which is
// needs_review for data-provenance reasons but is not time-sensitive.
export function chipTone(task: TaskItem): ChipTone {
  if (task.status === "needs_review") {
    return task.id === "task-bp-first" ? "active" : "urgent";
  }
  return task.status === "confirmed" ? "active" : "suggested";
}

const kindIcon: Record<TaskItem["kind"], LucideIcon> = {
  reading: Activity,
  medicine: Pill,
  visit: Stethoscope,
  checkin: NotebookPen,
  intake: Upload,
  privacy: LockKeyhole
};

function toneLabel(tone: ChipTone, language: Language): string {
  return tHome(language, tone === "urgent" ? "toneUrgent" : tone === "active" ? "toneActive" : "toneSuggested");
}

function greetingForHour(hour: number, language: Language): string {
  if (hour < 12) {
    return tHome(language, "greetingMorning");
  }
  if (hour < 18) {
    return tHome(language, "greetingAfternoon");
  }
  return tHome(language, "greetingEvening");
}

function statusSummary(tasks: TaskItem[], language: Language): string {
  const urgent = tasks.filter((task) => chipTone(task) === "urgent").length;
  if (urgent > 0) {
    return urgent === 1 ? tHome(language, "statusNeedsAttentionOne") : tHome(language, "statusNeedsAttentionMany", { count: urgent });
  }
  const active = tasks.filter((task) => chipTone(task) === "active").length;
  if (active > 0) {
    return active === 1 ? tHome(language, "statusToDoOne") : tHome(language, "statusToDoMany", { count: active });
  }
  return tHome(language, "statusClear");
}

function TaskChip({ task, language }: { task: TaskItem; language: Language }) {
  const tone = chipTone(task);
  const Icon = tone === "urgent" ? AlertTriangle : kindIcon[task.kind];
  // A chip that lands on the Coach carries its task id so the chat reconstructs
  // the exact prefilled, safety-screened turn — the same path a tapped
  // notification uses. Chips that land on a feature screen navigate plainly.
  const href = task.href === "/chat" ? `/chat?taskId=${task.id}` : task.href;
  return (
    <Link
      href={href}
      className={clsx(
        "flex min-h-14 items-start gap-3 rounded-control border p-4 transition-colors",
        tone === "urgent" && "border-pulse bg-pulse/5 hover:bg-pulse/10",
        tone === "active" && "border-care bg-white hover:bg-calm",
        tone === "suggested" && "border-ink/10 bg-white hover:border-care"
      )}
    >
      <Icon
        aria-hidden="true"
        className={clsx("mt-0.5 h-5 w-5 flex-none", tone === "urgent" ? "text-pulse" : tone === "active" ? "text-care" : "text-ink/40")}
      />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className={clsx("font-semibold", tone === "urgent" && "text-pulse")}>{task.title}</span>
          {tone === "urgent" ? (
            <span className="rounded-full border border-pulse px-2 py-0.5 text-[11px] font-medium text-pulse">{tHome(language, "chipUrgentBadge")}</span>
          ) : null}
        </span>
        <span className="mt-1 block text-sm leading-6 text-ink/75">{task.body}</span>
        <span className={clsx("mt-2 block text-xs font-medium", tone === "urgent" ? "text-pulse" : "text-ink/60")}>{toneLabel(tone, language)}</span>
      </span>
      <ArrowRight aria-hidden="true" className={clsx("mt-1 h-5 w-5 flex-none", tone === "urgent" ? "text-pulse" : "text-care")} />
    </Link>
  );
}

export function TodayGreeting({ patientName, tasks, language = "en", now }: { patientName: string; tasks: TaskItem[]; language?: Language; now?: Date }) {
  // Resolve the time-of-day greeting on the client only. Rendering it during SSR
  // compares the server clock (UTC on Vercel) against the patient's local clock
  // at hydration and mismatches across hour boundaries. Tests pass `now`
  // explicitly to keep the greeting deterministic.
  const [resolvedNow, setResolvedNow] = React.useState<Date | null>(now ?? null);
  React.useEffect(() => {
    if (!now) {
      setResolvedNow(new Date());
    }
  }, [now]);
  // A fresh phone has no name on it, and "Good afternoon, ." is worse than
  // "Good afternoon." (critique N1; nobody is Brent any more).
  const name = patientName.trim();
  const opener = resolvedNow
    ? greetingForHour(resolvedNow.getHours(), language)
    : tHome(language, "greetingHello");
  const greeting = name.length > 0 ? `${opener}, ${name}` : opener;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-care">{greeting}</p>
        <h2 className="mt-1 text-2xl font-semibold">{statusSummary(tasks, language)}</h2>
      </div>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-calm text-care" aria-hidden="true">
          <MessageCircle className="h-4 w-4" />
        </span>
        <p className="rounded-control rounded-tl-none bg-calm px-3 py-2 text-sm leading-6 text-ink">{tHome(language, "assistantBubble")}</p>
      </div>
      <div className="grid gap-3">
        {tasks.map((task) => (
          <TaskChip key={task.id} task={task} language={language} />
        ))}
      </div>
    </section>
  );
}
