import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDemoState, deletedDemoState, demoState } from "@/domain/fixtures";
import { createLocalStorageAppStateRepository } from "@/state/local-storage-app-state-repository";
import { loadStoredStateResult, saveStoredState } from "@/state/storage";

describe("localStorage AppState repository", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("preserves load posture and performs mutations before promises settle", async () => {
    const calls: string[] = [];
    const repository = createLocalStorageAppStateRepository({
      load: () => ({ state: demoState, status: "migrated", writable: true }),
      save: () => {
        calls.push("save");
        return true;
      },
      clear: () => {
        calls.push("clear");
        return { status: "cleared", failedScopes: [] };
      }
    });

    await expect(repository.load()).resolves.toMatchObject({
      state: demoState,
      status: "migrated",
      writable: true,
      revision: 0
    });
    const commit = repository.commit(defaultDemoState, 0);
    expect(calls).toEqual(["save"]);
    await expect(commit).resolves.toEqual({ status: "committed", revision: 1 });
    const clear = repository.clear();
    expect(calls).toEqual(["save", "clear"]);
    await expect(clear).resolves.toEqual({ status: "cleared", revision: 2 });
    expect(repository.consistency).toBe("single_context");
  });

  it("rejects stale revisions before touching storage", async () => {
    const save = vi.fn().mockReturnValue(true);
    const repository = createLocalStorageAppStateRepository({
      load: () => ({ state: defaultDemoState, status: "empty", writable: true }),
      save,
      clear: () => ({ status: "cleared", failedScopes: [] })
    });
    await repository.load();
    await expect(repository.commit(demoState, 1)).resolves.toEqual({
      status: "conflict",
      revision: 0
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("does not hydrate a snapshot when the deletion fence changes during load", async () => {
    let deletionFence = 4;
    const save = vi.fn().mockReturnValue(true);
    const readDeletionFence = vi.fn(() => ({
      status: "ok" as const,
      value: deletionFence
    }));
    const repository = createLocalStorageAppStateRepository({
      load: () => {
        const stale = { state: demoState, status: "loaded" as const, writable: true };
        deletionFence += 1;
        return stale;
      },
      save,
      clear: () => ({ status: "cleared", failedScopes: [], deletionFence }),
      readDeletionFence
    });

    await expect(repository.load()).resolves.toEqual({
      state: deletedDemoState,
      status: "unavailable",
      writable: false,
      revision: 0
    });
    await expect(repository.commit(demoState, 0)).resolves.toEqual({
      status: "unavailable",
      revision: 0
    });
    expect(readDeletionFence).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps future formats read-only until an explicit deletion barrier", async () => {
    const save = vi.fn().mockReturnValue(true);
    const repository = createLocalStorageAppStateRepository({
      load: () => ({
        state: defaultDemoState,
        status: "future_version",
        writable: false
      }),
      save,
      clear: () => ({ status: "partial", failedScopes: ["session_voice_consent"] })
    });
    await repository.load();
    await expect(repository.commit(demoState, 0)).resolves.toEqual({
      status: "unavailable",
      revision: 0
    });
    expect(save).not.toHaveBeenCalled();
    await expect(repository.clear()).resolves.toEqual({
      status: "partial",
      revision: 1,
      failedScopes: ["session_voice_consent"]
    });
    await expect(repository.commit(defaultDemoState, 1)).resolves.toEqual({
      status: "committed",
      revision: 2
    });
  });

  it("rejects a stale tab after another tab clears stored data", async () => {
    expect(saveStoredState(demoState)).toBe(true);
    const clearingTab = createLocalStorageAppStateRepository();
    const staleTab = createLocalStorageAppStateRepository();

    await expect(clearingTab.load()).resolves.toMatchObject({ writable: true });
    await expect(staleTab.load()).resolves.toMatchObject({ writable: true });
    await expect(clearingTab.clear()).resolves.toMatchObject({ status: "cleared" });

    await expect(staleTab.commit(demoState, 0)).resolves.toEqual({
      status: "conflict",
      revision: 0
    });
    expect(loadStoredStateResult().status).toBe("empty");
  });

  it("lets the clearing tab write a scrubbed checkpoint in the new generation", async () => {
    expect(saveStoredState(demoState)).toBe(true);
    const repository = createLocalStorageAppStateRepository();
    await repository.load();

    await expect(repository.clear()).resolves.toMatchObject({ status: "cleared", revision: 1 });
    await expect(repository.commit(defaultDemoState, 1)).resolves.toEqual({
      status: "committed",
      revision: 2
    });
    expect(loadStoredStateResult().state.patient.id).toBe(defaultDemoState.patient.id);
  });
});
