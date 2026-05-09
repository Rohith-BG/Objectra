import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/utils/errors/app.error.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "../../../src/utils/errors/http.errors.js";

describe("HTTP error classes", () => {
  const errorCases: Array<{
    ErrorClass: new (msg: string) => AppError;
    expectedName: string;
    expectedStatus: number;
  }> = [
    { ErrorClass: BadRequestError, expectedName: "BadRequestError", expectedStatus: 400 },
    { ErrorClass: ValidationError, expectedName: "ValidationError", expectedStatus: 400 },
    { ErrorClass: UnauthorizedError, expectedName: "UnauthorizedError", expectedStatus: 401 },
    { ErrorClass: ForbiddenError, expectedName: "ForbiddenError", expectedStatus: 403 },
    { ErrorClass: NotFoundError, expectedName: "NotFoundError", expectedStatus: 404 },
    { ErrorClass: ConflictError, expectedName: "ConflictError", expectedStatus: 409 },
  ];

  it.each(errorCases)(
    "$expectedName has status $expectedStatus and correct name",
    ({ ErrorClass, expectedName, expectedStatus }) => {
      const error = new ErrorClass("test message");

      expect(error.statusCode).toBe(expectedStatus);
      expect(error.name).toBe(expectedName);
      expect(error.message).toBe("test message");
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    },
  );

  describe("TooManyRequestsError", () => {
    it("has status 429 and correct name", () => {
      const error = new TooManyRequestsError("Rate limited", 30);

      expect(error.statusCode).toBe(429);
      expect(error.name).toBe("TooManyRequestsError");
      expect(error.message).toBe("Rate limited");
    });

    it("stores the retryAfter value", () => {
      const error = new TooManyRequestsError("Too many requests", 60);

      expect(error.retryAfter).toBe(60);
    });

    it("is an instance of AppError and Error", () => {
      const error = new TooManyRequestsError("Slow down", 10);

      expect(error).toBeInstanceOf(TooManyRequestsError);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });

    it("stores retryAfter directly on the instance", () => {
      const error = new TooManyRequestsError("Hold on", 45);

      expect(error).toHaveProperty("retryAfter", 45);
    });
  });

  describe("distinguishes BadRequestError from ValidationError", () => {
    it("BadRequestError is not an instance of ValidationError", () => {
      const badRequest = new BadRequestError("bad");
      const validation = new ValidationError("invalid");

      expect(badRequest).not.toBeInstanceOf(ValidationError);
      expect(validation).not.toBeInstanceOf(BadRequestError);
    });
  });
});
