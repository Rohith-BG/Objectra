import { describe, expect, it } from "vitest";
import {
  StepFunctionExecutionError,
  type StepFunctionExecutionErrorPayload,
} from "../../../src/utils/errors/stepFunctionExecution.error.js";

function makePayload(overrides: Partial<StepFunctionExecutionErrorPayload> = {}): StepFunctionExecutionErrorPayload {
  return {
    executionArn: "arn:aws:states:us-east-1:123:execution:test",
    status: "FAILED",
    code: "TaskFailed",
    cause: "Lambda returned error",
    durationMs: 1500,
    attempts: 2,
    ...overrides,
  };
}

describe("StepFunctionExecutionError", () => {
  it("assigns all payload properties to the error instance", () => {
    const payload = makePayload();
    const error = new StepFunctionExecutionError(payload);

    expect(error.executionArn).toBe(payload.executionArn);
    expect(error.executionStatus).toBe("FAILED");
    expect(error.code).toBe("TaskFailed");
    expect(error.cause).toBe("Lambda returned error");
    expect(error.durationMs).toBe(1500);
    expect(error.attempts).toBe(2);
  });

  it("sets the error name to StepFunctionExecutionError", () => {
    const error = new StepFunctionExecutionError(makePayload());

    expect(error.name).toBe("StepFunctionExecutionError");
  });

  it("uses cause as the error message when available", () => {
    const error = new StepFunctionExecutionError(makePayload({ cause: "S3 delete failed" }));

    expect(error.message).toBe("S3 delete failed");
  });

  it("falls back to code when cause is empty", () => {
    const error = new StepFunctionExecutionError(makePayload({ cause: "", code: "POLLING_EXHAUSTED" }));

    expect(error.message).toBe("POLLING_EXHAUSTED");
  });

  it("falls back to default message when both cause and code are empty", () => {
    const error = new StepFunctionExecutionError(makePayload({ cause: "", code: "" }));

    expect(error.message).toBe("Step Function execution did not succeed");
  });

  it("is an instance of Error", () => {
    const error = new StepFunctionExecutionError(makePayload());

    expect(error).toBeInstanceOf(StepFunctionExecutionError);
    expect(error).toBeInstanceOf(Error);
  });

  it("does not have a statusCode property", () => {
    const error = new StepFunctionExecutionError(makePayload());

    expect("statusCode" in error).toBe(false);
  });

  it("preserves the prototype chain via Object.setPrototypeOf", () => {
    const error = new StepFunctionExecutionError(makePayload());

    expect(Object.getPrototypeOf(error)).toBe(StepFunctionExecutionError.prototype);
  });
});
