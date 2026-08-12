import type { AppState } from "@/domain/types";
import { deletedDemoState } from "@/domain/fixtures";
import type {
  AppStateRepository,
  RepositoryClearResult,
  RepositoryCommitResult,
  RepositoryLoad
} from "@/state/app-state-repository";
import {
  clearStoredStateResult,
  loadStoredStateResult,
  readStoredDeletionFence,
  saveStoredState,
  type StoredDeletionFenceRead,
  type StoredStateClearResult,
  type StoredStateLoad
} from "@/state/storage";

export type LocalStorageRepositoryDependencies = {
  load: () => StoredStateLoad;
  save: (state: AppState, expectedDeletionFence?: number) => boolean;
  clear: () => StoredStateClearResult;
  readDeletionFence?: () => StoredDeletionFenceRead;
};

const DEFAULT_DEPENDENCIES: LocalStorageRepositoryDependencies = {
  load: loadStoredStateResult,
  save: saveStoredState,
  clear: clearStoredStateResult,
  readDeletionFence: readStoredDeletionFence
};

export function createLocalStorageAppStateRepository(
  dependencies: LocalStorageRepositoryDependencies = DEFAULT_DEPENDENCIES
): AppStateRepository {
  let revision = 0;
  let writable = false;
  let deletionFence: number | null = null;
  const readDeletionFence = dependencies.readDeletionFence ??
    (() => ({ status: "ok", value: 0 }) as const);

  return {
    consistency: "single_context",
    load(): Promise<RepositoryLoad> {
      // The read and any migration/recovery writes finish synchronously before
      // the promise is returned, preserving the previous initialization order.
      const fenceBeforeLoad = readDeletionFence();
      const result = dependencies.load();
      const fenceAfterLoad = readDeletionFence();
      if (
        fenceBeforeLoad.status === "unavailable" ||
        fenceAfterLoad.status === "unavailable" ||
        fenceBeforeLoad.value !== fenceAfterLoad.value
      ) {
        // A clear may have happened after the state read but before the fence
        // capture. Never hydrate or authorize writes from that stale snapshot.
        deletionFence = fenceAfterLoad.status === "ok" ? fenceAfterLoad.value : null;
        writable = false;
        return Promise.resolve({
          state: deletedDemoState,
          status: "unavailable",
          writable: false,
          revision
        });
      }
      deletionFence = fenceAfterLoad.value;
      writable = result.writable && deletionFence !== null;
      return Promise.resolve({
        ...result,
        writable,
        revision
      });
    },
    commit(state: AppState, expectedRevision: number): Promise<RepositoryCommitResult> {
      if (expectedRevision !== revision) {
        return Promise.resolve({ status: "conflict", revision });
      }
      if (!writable || deletionFence === null) {
        return Promise.resolve({ status: "unavailable", revision });
      }
      const currentFence = readDeletionFence();
      if (currentFence.status === "unavailable") {
        writable = false;
        return Promise.resolve({ status: "unavailable", revision });
      }
      if (currentFence.value !== deletionFence) {
        // Another browsing context established a delete barrier after this
        // repository loaded. The caller must reload; writing would resurrect
        // the pre-deletion snapshot.
        writable = false;
        return Promise.resolve({ status: "conflict", revision });
      }
      if (!dependencies.save(state, deletionFence)) {
        const fenceAfterFailedSave = readDeletionFence();
        if (
          fenceAfterFailedSave.status === "ok" &&
          fenceAfterFailedSave.value !== deletionFence
        ) {
          writable = false;
          return Promise.resolve({ status: "conflict", revision });
        }
        return Promise.resolve({ status: "unavailable", revision });
      }
      revision += 1;
      return Promise.resolve({ status: "committed", revision });
    },
    clear(): Promise<RepositoryClearResult> {
      const result = dependencies.clear();
      if (result.status === "unavailable") {
        return Promise.resolve({ status: "unavailable", revision });
      }
      revision += 1;
      const fence = result.deletionFence === undefined
        ? readDeletionFence()
        : { status: "ok" as const, value: result.deletionFence };
      const fenceFailed = result.status === "partial" &&
        result.failedScopes.includes("deletion_fence");
      deletionFence = fence.status === "ok" ? fence.value : null;
      writable = deletionFence !== null && !fenceFailed;
      return Promise.resolve(
        result.status === "partial"
          ? { status: "partial", revision, failedScopes: result.failedScopes }
          : { status: "cleared", revision }
      );
    }
  };
}
