import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodConversation } from "./food-conversation";
import type { AiMessage } from "@/domain/types";

function message(overrides: Partial<AiMessage> & Pick<AiMessage, "id" | "role" | "content">): AiMessage {
  return {
    mode: "food",
    createdAt: "2026-09-06T12:00:00.000Z",
    safety: "allowed",
    sources: [],
    ...overrides
  };
}

describe("FoodConversation", () => {
  // The critique found every answer rendering white on white: the panel sits inside the
  // dark voice bar and the bubbles inherited its ink.
  it("gives both bubbles an explicit ink color", () => {
    render(
      <FoodConversation
        messages={[
          message({ id: "a", role: "assistant", content: "Cheerios scores 77." }),
          message({ id: "u", role: "patient", content: "honey nut cheerios" })
        ]}
        partialAssistantText=""
      />
    );

    const assistant = screen.getByText("Cheerios scores 77.").closest("article");
    const patient = screen.getByText("honey nut cheerios").closest("article");

    expect(assistant?.className).toContain("text-ink");
    expect(assistant?.className).toContain("bg-white");
    expect(patient?.className).toContain("text-ink");
    expect(patient?.className).toContain("bg-calm");
  });

  it("keeps the streaming partial dimmed but readable", () => {
    render(<FoodConversation messages={[]} partialAssistantText="Let's pause on dosing" />);

    const partial = screen.getByText("Let's pause on dosing").closest("article");
    expect(partial?.className).toContain("text-ink/70");
  });

  it("renders the line break a truncated turn carries", () => {
    render(
      <FoodConversation
        messages={[
          message({
            id: "a",
            role: "assistant",
            content: "I can't confirm 45 grams of carbs for …\nI lost the connection. Ask again."
          })
        ]}
        partialAssistantText=""
      />
    );

    const bubble = screen.getByText(/I lost the connection/).closest("article");
    expect(bubble?.className).toContain("whitespace-pre-line");
  });
});
