import type { AppState } from "@/domain/types";
import type {
  AppStateRepository,
  RepositoryClearResult,
  RepositoryLoad
} from "@/state/app-state-repository";

type SnapshotCommand = { type: "snapshot"; state: AppState; epoch: number };
type DeleteCommand = {
  type: "delete";
  epoch: number;
  waiters: Array<(result: RepositoryClearResult) => void>;
};
type Command = SnapshotCommand | DeleteCommand;

export class PersistenceCoordinator {
  private readonly repository: AppStateRepository;
  private queue: Command[] = [];
  private active = false;
  private activeCommand: Command | null = null;
  private initialized = false;
  private initializePromise: Promise<RepositoryLoad> | null = null;
  private automaticWritable = false;
  private revision = 0;
  private epoch = 0;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];

  constructor(repository: AppStateRepository) {
    this.repository = repository;
  }

  initialize(): Promise<RepositoryLoad> {
    if (this.initializePromise !== null) return this.initializePromise;
    this.initializePromise = this.repository.load().then((result) => {
      this.revision = result.revision;
      this.automaticWritable = result.writable;
      this.initialized = true;
      this.pump();
      this.resolveIdleIfNeeded();
      return result;
    });
    return this.initializePromise;
  }

  enqueueSnapshot(state: AppState): boolean {
    if (this.disposed) return false;
    const hasDeleteBarrier =
      this.queue.some((command) => command.type === "delete") ||
      this.activeCommand?.type === "delete";
    if (this.initialized && !this.automaticWritable && !hasDeleteBarrier) return false;

    const command: SnapshotCommand = { type: "snapshot", state, epoch: this.epoch };
    const last = this.queue.at(-1);
    if (last?.type === "snapshot" && last.epoch === command.epoch) {
      this.queue[this.queue.length - 1] = command;
    } else {
      this.queue.push(command);
    }
    this.pump();
    return true;
  }

  enqueueDelete(): Promise<RepositoryClearResult> {
    if (this.disposed) {
      return Promise.resolve({ status: "unavailable", revision: this.revision });
    }
    this.epoch += 1;
    // A deletion is a non-replaceable barrier. Any snapshot that has not
    // started belongs to the old record and must never be written afterward.
    this.queue = this.queue.filter((command) => command.type === "delete");
    return new Promise((resolve) => {
      const pendingDelete = this.queue.find(
        (command): command is DeleteCommand => command.type === "delete"
      );
      if (pendingDelete) {
        pendingDelete.epoch = this.epoch;
        pendingDelete.waiters.push(resolve);
      } else {
        this.queue.push({ type: "delete", epoch: this.epoch, waiters: [resolve] });
      }
      this.pump();
    });
  }

  whenIdle(): Promise<void> {
    if (this.initialized && !this.active && this.queue.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  dispose(): void {
    this.disposed = true;
    const unavailable = { status: "unavailable", revision: this.revision } as const;
    for (const command of this.queue) {
      if (command.type === "delete") {
        for (const resolve of command.waiters) resolve(unavailable);
      }
    }
    this.queue = [];
    if (!this.active) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  private pump(): void {
    if (!this.initialized || this.active || this.disposed) return;
    const command = this.queue.shift();
    if (!command) {
      this.resolveIdleIfNeeded();
      return;
    }
    this.active = true;
    this.activeCommand = command;
    if (command.type === "snapshot") {
      if (command.epoch !== this.epoch) {
        this.finishCommand();
        return;
      }
      void this.repository.commit(command.state, this.revision).then((result) => {
        // A delete requested while this commit was active owns the next epoch.
        // Its barrier will obtain the backing store's real revision, so this old
        // result cannot disable or advance the new writer.
        if (command.epoch === this.epoch) {
          if (result.status === "committed") this.revision = result.revision;
          else this.automaticWritable = false;
        }
      }).catch(() => {
        if (command.epoch === this.epoch) this.automaticWritable = false;
      }).finally(() => this.finishCommand());
      return;
    }

    void this.repository.clear().then((result) => {
      if (result.status !== "unavailable") {
        this.revision = result.revision;
        this.automaticWritable = true;
      } else if (command.epoch === this.epoch) {
        this.automaticWritable = false;
      }
      for (const resolve of command.waiters) resolve(result);
    }).catch(() => {
      const unavailable = { status: "unavailable", revision: this.revision } as const;
      if (command.epoch === this.epoch) this.automaticWritable = false;
      for (const resolve of command.waiters) resolve(unavailable);
    }).finally(() => this.finishCommand());
  }

  private finishCommand(): void {
    this.active = false;
    this.activeCommand = null;
    this.pump();
  }

  private resolveIdleIfNeeded(): void {
    if (!this.initialized || this.active || this.queue.length > 0) return;
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) resolve();
  }
}
