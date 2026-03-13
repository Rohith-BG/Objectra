import type { ExecutionStatus } from "../../types/stepFunction.types.js";


export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));


const VALID_EXECUTION_STATUSES: ReadonlySet<ExecutionStatus> =
  new Set<ExecutionStatus>([
    "RUNNING",
    "SUCCEEDED",
    "FAILED",
    "TIMED_OUT",
    "ABORTED",
    "PENDING_REDRIVE",
  ]);


export function toExecutionStatus(raw: string | undefined): ExecutionStatus {
  if (raw && VALID_EXECUTION_STATUSES.has(raw as ExecutionStatus)) {
    return raw as ExecutionStatus;
  }
  throw new Error(
    `[stepFunctionHelpers] Unrecognised execution status received from AWS: "${raw}"`
  );
}


export function computeDuration(
  startDate  : Date | undefined,
  stopDate   : Date | undefined,
  fallbackMs : number
): number {
  return startDate && stopDate
    ? stopDate.getTime() - startDate.getTime()
    : fallbackMs;
}