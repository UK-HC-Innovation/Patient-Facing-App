import { describe, expect, it } from "vitest";
import { defaultDemoState } from "@/domain/fixtures";
import type { AppState } from "@/domain/types";
import type {
  AppStateRepository,
  RepositoryClearResult,
  RepositoryCommitResult
} from "@/state/app-state-repository";
import { PersistenceCoordinator } from "@/state/persistence-coordinator";

function named(name: string): AppState {
  return {
    ...defaultDemoState,
    patient: { ...defaultDemoState.patient, preferredName: name }
  };
}

function deferredRepository() {
  const operations: string[] = [];
  const commitResolvers: Array<(result: RepositoryCommitResult) => void> = [];
  const clearResolvers: Array<(result: RepositoryClearResult) => void> = [];
  let active = 0;
  let maxActive = 0;
  const repository: AppStateRepository = {
    consistency: "transactional_cas",
    load: async () => ({
      state: defaultDemoState,
      status: "empty",
      writable: true,
      revision: 0
    }),
    commit: (state, revision) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      operations.push(`commit:${state.patient.preferredName}:${revision}`);
      return new Promise((resolve) =>
        commitResolvers.push((result) => {
          active -= 1;
          resolve(result);
        })
      );
    },
    clear: () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      operations.push("clear");
      return new Promise((resolve) =>
        clearResolvers.push((result) => {
          active -= 1;
          resolve(result);
        })
      );
    }
  };
  return { repository, operations, commitResolvers, clearResolvers, maxActive: () => maxActive };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("PersistenceCoordinator", () => {
  it("serializes mutations and coalesces pending snapshots to the newest state", async () => {
    const fake = deferredRepository();
    const coordinator = new PersistenceCoordinator(fake.repository);
    await coordinator.initialize();

    coordinator.enqueueSnapshot(named("A"));
    coordinator.enqueueSnapshot(named("B"));
    coordinator.enqueueSnapshot(named("C"));
    expect(fake.operations).toEqual(["commit:A:0"]);
    fake.commitResolvers.shift()!({ status: "committed", revision: 1 });
    await settle();
    expect(fake.operations).toEqual(["commit:A:0", "commit:C:1"]);
    expect(fake.maxActive()).toBe(1);
    fake.commitResolvers.shift()!({ status: "committed", revision: 2 });
    await coordinator.whenIdle();
  });

  it("orders an active commit, delete barrier, and post-delete snapshot", async () => {
    const fake = deferredRepository();
    const coordinator = new PersistenceCoordinator(fake.repository);
    await coordinator.initialize();

    coordinator.enqueueSnapshot(named("A"));
    coordinator.enqueueSnapshot(named("discarded-B"));
    const deleted = coordinator.enqueueDelete();
    coordinator.enqueueSnapshot(named("D"));
    fake.commitResolvers.shift()!({ status: "committed", revision: 1 });
    await settle();
    expect(fake.operations).toEqual(["commit:A:0", "clear"]);
    fake.clearResolvers.shift()!({ status: "cleared", revision: 2 });
    await expect(deleted).resolves.toEqual({ status: "cleared", revision: 2 });
    await settle();
    expect(fake.operations).toEqual(["commit:A:0", "clear", "commit:D:2"]);
    fake.commitResolvers.shift()!({ status: "committed", revision: 3 });
    await coordinator.whenIdle();
  });

  it("ignores an old-epoch failure and lets deletion re-enable the new epoch", async () => {
    const fake = deferredRepository();
    const coordinator = new PersistenceCoordinator(fake.repository);
    await coordinator.initialize();
    coordinator.enqueueSnapshot(named("old"));
    const deleted = coordinator.enqueueDelete();
    coordinator.enqueueSnapshot(named("new"));

    fake.commitResolvers.shift()!({ status: "unavailable", revision: 0 });
    await settle();
    fake.clearResolvers.shift()!({ status: "cleared", revision: 1 });
    await deleted;
    await settle();
    expect(fake.operations.at(-1)).toBe("commit:new:1");
    fake.commitResolvers.shift()!({ status: "committed", revision: 2 });
    await coordinator.whenIdle();
  });

  it("stops after a current conflict but still permits an explicit clear", async () => {
    const fake = deferredRepository();
    const coordinator = new PersistenceCoordinator(fake.repository);
    await coordinator.initialize();
    coordinator.enqueueSnapshot(named("conflict"));
    fake.commitResolvers.shift()!({ status: "conflict", revision: 9 });
    await settle();
    expect(coordinator.enqueueSnapshot(named("blocked"))).toBe(false);

    const deleted = coordinator.enqueueDelete();
    await settle();
    expect(fake.operations.at(-1)).toBe("clear");
    fake.clearResolvers.shift()!({ status: "cleared", revision: 10 });
    await deleted;
  });

  it("prevents new work after disposal", async () => {
    const fake = deferredRepository();
    const coordinator = new PersistenceCoordinator(fake.repository);
    await coordinator.initialize();
    coordinator.dispose();

    expect(coordinator.enqueueSnapshot(named("never"))).toBe(false);
    await expect(coordinator.enqueueDelete()).resolves.toEqual({
      status: "unavailable",
      revision: 0
    });
    expect(fake.operations).toEqual([]);
  });
});
