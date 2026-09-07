import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { TodayGreeting, chipTone } from "./today-greeting";
import type { TaskItem } from "@/domain/types";

const clinical: TaskItem = {
  id: "task-bp-clinical",
  title: "Seek urgent help now",
  body: "Your reading and note need same-day review.",
  href: "/chat",
  priority: 1,
  kind: "reading",
  status: "needs_review"
};

const visit: TaskItem = {
  id: "task-visit-brief",
  title: "Prepare for your next visit",
  body: "Medication review.",
  href: "/visits",
  priority: 3,
  kind: "visit",
  status: "confirmed"
};

const checkin: TaskItem = {
  id: "task-checkin",
  title: "Take a quick mood check-in",
  body: "Short and private.",
  href: "/checkin",
  priority: 2,
  kind: "checkin",
  status: "inferred"
};

const morning = new Date("2026-07-06T09:00:00");

describe("chipTone", () => {
  it("keeps a clinical escalation loud", () => {
    expect(chipTone(clinical)).toBe("urgent");
  });

  it("does not alarm on the first-reading nudge", () => {
    expect(chipTone({ ...clinical, id: "task-bp-first", title: "Check blood pressure", href: "/numbers" })).toBe("active");
  });

  it("treats confirmed as active and inferred as suggested", () => {
    expect(chipTone(visit)).toBe("active");
    expect(chipTone(checkin)).toBe("suggested");
  });
});

describe("TodayGreeting", () => {
  it("renders tappable chips that link to each task destination", () => {
    render(<TodayGreeting patientName="Jordan" tasks={[clinical, visit, checkin]} now={morning} />);

    expect(screen.getByRole("link", { name: /prepare for your next visit/i })).toHaveAttribute("href", "/visits");
    expect(screen.getByRole("link", { name: /mood check-in/i })).toHaveAttribute("href", "/checkin");
  });

  it("deep-links a Coach-bound chip with its task id so the chat reconstructs the prefilled turn", () => {
    render(<TodayGreeting patientName="Jordan" tasks={[clinical, visit, checkin]} now={morning} />);

    expect(screen.getByRole("link", { name: /seek urgent help now/i })).toHaveAttribute("href", "/chat?taskId=task-bp-clinical");
  });

  it("marks only the clinical escalation as urgent, never as a friendly suggestion", () => {
    render(<TodayGreeting patientName="Jordan" tasks={[clinical, visit, checkin]} now={morning} />);

    expect(screen.getAllByText("urgent")).toHaveLength(1);
    expect(screen.getByText("Reach your care team today")).toBeInTheDocument();
    expect(screen.getByText("1 thing needs your attention")).toBeInTheDocument();
  });

  it("greets by time of day and preferred name, and reassures when nothing is urgent", () => {
    render(<TodayGreeting patientName="Jordan" tasks={[checkin]} now={morning} />);

    expect(screen.getByText(/good morning, jordan/i)).toBeInTheDocument();
    expect(screen.getByText("Nothing urgent right now")).toBeInTheDocument();
  });

  it("renders the home surfaces in Spanish for a Spanish patient", () => {
    render(<TodayGreeting patientName="Jordan" tasks={[clinical, visit, checkin]} language="es" now={morning} />);

    expect(screen.getByText(/buenos días, jordan/i)).toBeInTheDocument();
    expect(screen.getByText("1 cosa necesita tu atención")).toBeInTheDocument();
    expect(screen.getByText("Comunícate con tu equipo de salud hoy")).toBeInTheDocument();
    expect(screen.getAllByText("urgente")).toHaveLength(1);
  });

  // A fresh phone has no name on it (critique N1, spec 29 P2).
  it("drops the comma when there is no name yet", () => {
    render(<TodayGreeting patientName="" tasks={[checkin]} now={morning} />);

    expect(screen.getByText("Good morning")).toBeInTheDocument();
    expect(screen.queryByText(/good morning,/i)).not.toBeInTheDocument();
  });
});
