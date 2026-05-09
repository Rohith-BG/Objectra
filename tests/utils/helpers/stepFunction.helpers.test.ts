import { describe, expect, it, vi } from "vitest";
import { computeDuration, sleep, toExecutionStatus } from "../../../src/utils/helpers/stepFunction.helpers.js";

describe("stepFunction helpers", () => {
  describe("sleep", () => {
    it("resolves after the specified delay", async () => {
      vi.useFakeTimers();

      const promise = sleep(1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe("toExecutionStatus", () => {
    it.each([
      "RUNNING",
      "SUCCEEDED",
      "FAILED",
      "TIMED_OUT",
      "ABORTED",
      "PENDING_REDRIVE",
    ])("returns '%s' for valid status string", (status) => {
      expect(toExecutionStatus(status)).toBe(status);
    });

    it("throws an error for an unrecognised status string", () => {
      expect(() => toExecutionStatus("UNKNOWN")).toThrow(
        '[stepFunctionHelpers] Unrecognised execution status received from AWS: "UNKNOWN"',
      );
    });

    it("throws an error when the status is undefined", () => {
      expect(() => toExecutionStatus(undefined)).toThrow(
        '[stepFunctionHelpers] Unrecognised execution status received from AWS: "undefined"',
      );
    });

    it("throws an error for an empty string", () => {
      expect(() => toExecutionStatus("")).toThrow(
        '[stepFunctionHelpers] Unrecognised execution status received from AWS: ""',
      );
    });
  });

  describe("computeDuration", () => {
    it("returns the difference in milliseconds when both dates are provided", () => {
      const start = new Date("2026-05-02T00:00:00.000Z");
      const stop = new Date("2026-05-02T00:00:01.500Z");

      expect(computeDuration(start, stop, 9999)).toBe(1500);
    });

    it("returns the fallback when startDate is undefined", () => {
      const stop = new Date("2026-05-02T00:00:01.500Z");

      expect(computeDuration(undefined, stop, 500)).toBe(500);
    });

    it("returns the fallback when stopDate is undefined", () => {
      const start = new Date("2026-05-02T00:00:00.000Z");

      expect(computeDuration(start, undefined, 300)).toBe(300);
    });

    it("returns the fallback when both dates are undefined", () => {
      expect(computeDuration(undefined, undefined, 1000)).toBe(1000);
    });

    it("returns 0 when start and stop are the same instant", () => {
      const date = new Date("2026-05-02T00:00:00.000Z");

      expect(computeDuration(date, date, 999)).toBe(0);
    });
  });
});
