import type { TerminalErrorStatus } from "../../types/stepFunction.types.js";

export interface StepFunctionExecutionErrorPayload {
  executionArn : string;
  status       : TerminalErrorStatus
  code         : string;
  cause        : string;
  durationMs   : number;
  attempts     : number;
}

export  class StepFunctionExecutionError extends Error {

  public readonly executionArn    : string;
  public readonly executionStatus : TerminalErrorStatus;
  public readonly code            : string;
  public readonly cause           : string;
  public readonly durationMs      : number;
  public readonly attempts        : number;

  constructor(payload: StepFunctionExecutionErrorPayload) {
    super(payload.cause || payload.code || "Step Function execution did not succeed");

    this.name            = "StepFunctionExecutionError";
    this.executionArn    = payload.executionArn;
    this.executionStatus = payload.status;
    this.code            = payload.code;
    this.cause           = payload.cause;
    this.durationMs      = payload.durationMs;
    this.attempts        = payload.attempts;

    
    Object.setPrototypeOf(this, new.target.prototype);
  }
}