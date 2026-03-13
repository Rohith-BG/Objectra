
export type ExecutionStatus =
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "ABORTED"
  | "PENDING_REDRIVE";

export type TerminalErrorStatus =
  | "FAILED"
  | "TIMED_OUT"
  | "ABORTED"
  | "POLLING_EXHAUSTED";

export const TERMINAL_ERROR_STATUSES: ReadonlySet<TerminalErrorStatus> =
  new Set<TerminalErrorStatus>(["FAILED", "TIMED_OUT", "ABORTED"]);

export interface DeleteStepFunctionInput {
  objectId    : string;
  S3ObjectKey : string;
}


export interface StoredObject {
  id  : string;
  key : string;
  [key: string]: unknown;
}


export interface DeleteObjectResult {
  success      : true;
  executionArn : string;
  output       : Record<string, unknown> | null;
  durationMs   : number;
  attempts     : number;
}


export interface PollConfig {
  readonly maxAttempts       : number;
  readonly initialDelayMs    : number;
  readonly maxDelayMs        : number;
  readonly backoffMultiplier : number;
}

/**
 * Tuned for a ~4s Step Function execution.
 *
 * Attempt timeline:
 *   t = 0.0s  → StartExecution  (execution begins)
 *   t = 2.0s  → Attempt 1       → likely RUNNING
 *   t = 3.5s  → Attempt 2       → RUNNING or SUCCEEDED
 *   t = 5.0s  → Attempt 3       → SUCCEEDED ✅
 *   t = 7.5s  → Attempt 4+      → safety net, never reached on healthy runs
 */
export const POLL_CONFIG: PollConfig = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 2_000,
  backoffMultiplier: 1.5,
} as const;