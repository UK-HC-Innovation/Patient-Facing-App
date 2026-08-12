import React from "react";
import { renderToString } from "react-dom/server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultDemoState, deletedDemoState, demoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import type {
  AppStateRepository,
  RepositoryClearResult,
  RepositoryCommitResult,
  RepositoryLoad
} from "@/state/app-state-repository";
import { HealthStateProvider, useHealthState } from "./store";

Object.assign(globalThis, { React });

function PatientName() {
  const { state } = useHealthState();
  return <span>{state.patient.preferredName}</span>;
}

function DeleteButton() {
  const { deleteStoredData } = useHealthState();
  return <button onClick={() => void deleteStoredData()}>Delete</button>;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function immediateRepository(load: RepositoryLoad): AppStateRepository & {
  commit: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
} {
  let revision = load.revision;
  const loadMock = vi.fn().mockResolvedValue(load);
  const commit = vi.fn(async (_state: AppState, expected: number) => {
    if (expected !== revision) return { status: "conflict", revision } as const;
    revision += 1;
    return { status: "committed", revision } as const;
  });
  const clear = vi.fn(async () => {
    revision += 1;
    return { status: "cleared", revision } as const;
  });
  return { consistency: "transactional_cas", load: loadMock, commit, clear };
}

describe("HealthStateProvider hydration", () => {
  it("uses deterministic demo state for SSR without touching the repository", () => {
    const repository = immediateRepository({
      state: demoState,
      status: "loaded",
      writable: true,
      revision: 0
    });
    const html = renderToString(
      <HealthStateProvider repository={repository}>
        <PatientName />
      </HealthStateProvider>
    );

    expect(html).toContain("Brent");
    expect(html).not.toContain("Jordan");
    expect(repository.load).not.toHaveBeenCalled();
  });

  it("does not overwrite data from a future schema version", async () => {
    const repository = immediateRepository({
      state: demoState,
      status: "future_version",
      writable: false,
      revision: 0
    });
    render(
      <HealthStateProvider repository={repository}>
        <PatientName />
      </HealthStateProvider>
    );

    await waitFor(() => expect(repository.load).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Jordan")).toBeVisible());
    expect(repository.commit).not.toHaveBeenCalled();
  });

  it("waits for asynchronous hydration before committing a snapshot", async () => {
    const pendingLoad = deferred<RepositoryLoad>();
    const repository = immediateRepository({
      state: defaultDemoState,
      status: "empty",
      writable: true,
      revision: 0
    });
    repository.load.mockReturnValueOnce(pendingLoad.promise);
    render(
      <HealthStateProvider repository={repository}>
        <PatientName />
      </HealthStateProvider>
    );
    expect(repository.commit).not.toHaveBeenCalled();

    pendingLoad.resolve({
      state: demoState,
      status: "loaded",
      writable: true,
      revision: 0
    });
    await waitFor(() => expect(screen.getByText("Jordan")).toBeVisible());
    await waitFor(() => expect(repository.commit).toHaveBeenCalledTimes(1));
  });

  it("invalidates a late hydrated snapshot when deletion is requested first", async () => {
    const pendingLoad = deferred<RepositoryLoad>();
    const clear = deferred<RepositoryClearResult>();
    const repository: AppStateRepository = {
      consistency: "transactional_cas",
      load: () => pendingLoad.promise,
      commit: async () => ({ status: "committed", revision: 2 }),
      clear: () => clear.promise
    };
    render(
      <HealthStateProvider repository={repository}>
        <PatientName />
        <DeleteButton />
      </HealthStateProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(deletedDemoState.patient.preferredName)).toBeVisible();

    pendingLoad.resolve({
      state: demoState,
      status: "loaded",
      writable: true,
      revision: 0
    });
    await waitFor(() => expect(screen.queryByText("Jordan")).not.toBeInTheDocument());
    clear.resolve({ status: "cleared", revision: 1 });
  });

  it("orders an active checkpoint before clear and the scrubbed checkpoint", async () => {
    const commitResolvers: Array<(result: RepositoryCommitResult) => void> = [];
    const clearResolvers: Array<(result: RepositoryClearResult) => void> = [];
    const operations: string[] = [];
    const repository: AppStateRepository = {
      consistency: "transactional_cas",
      load: async () => ({
        state: demoState,
        status: "loaded",
        writable: true,
        revision: 0
      }),
      commit: (state, revision) => {
        operations.push(`commit:${state.patient.preferredName}:${revision}`);
        return new Promise((resolve) => commitResolvers.push(resolve));
      },
      clear: () => {
        operations.push("clear");
        return new Promise((resolve) => clearResolvers.push(resolve));
      }
    };
    render(
      <HealthStateProvider repository={repository}>
        <PatientName />
        <DeleteButton />
      </HealthStateProvider>
    );
    await waitFor(() => expect(operations[0]).toBe("commit:Jordan:0"));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    commitResolvers.shift()!({ status: "committed", revision: 1 });
    await waitFor(() => expect(operations[1]).toBe("clear"));
    clearResolvers.shift()!({ status: "cleared", revision: 2 });
    await waitFor(() =>
      expect(operations[2]).toBe(`commit:${deletedDemoState.patient.preferredName}:2`)
    );
    commitResolvers.shift()!({ status: "committed", revision: 3 });
  });
});
