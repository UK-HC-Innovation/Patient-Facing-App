import type { AppState } from "@/domain/types";
import type { StoredStateLoad } from "@/state/storage";

export type RepositoryLoad = StoredStateLoad & { revision: number };

export type RepositoryCommitResult =
  | { status: "committed"; revision: number }
  | { status: "conflict"; revision: number }
  | { status: "unavailable"; revision: number };

export type RepositoryClearResult =
  | { status: "cleared"; revision: number }
  | { status: "partial"; revision: number; failedScopes: string[] }
  | { status: "unavailable"; revision: number };

/**
 * Persistence boundary for AppState snapshots.
 *
 * `single_context` implementations fence operations within one mounted
 * provider only. `transactional_cas` is reserved for adapters whose compare and
 * write happen atomically in the backing store (for example one IndexedDB
 * readwrite transaction). A localStorage get/compare/set sequence must never
 * claim that stronger consistency.
 */
export interface AppStateRepository {
  readonly consistency: "single_context" | "transactional_cas";
  load(): Promise<RepositoryLoad>;
  commit(state: AppState, expectedRevision: number): Promise<RepositoryCommitResult>;
  clear(): Promise<RepositoryClearResult>;
}
