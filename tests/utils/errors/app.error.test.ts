import { describe, expect, it } from "vitest";
import { AppError } from "../../../src/utils/errors/app.error.js";

describe("AppError", () => {
  it("sets the status code from the constructor argument", () => {
    const error = new AppError(400, "Bad request");

    expect(error.statusCode).toBe(400);
  });

  it("sets the message from the constructor argument", () => {
    const error = new AppError(500, "Something went wrong");

    expect(error.message).toBe("Something went wrong");
  });

  it("derives this.name from the constructor name automatically", () => {
    const error = new AppError(404, "Not found");

    expect(error.name).toBe("AppError");
  });

  it("is an instance of both AppError and Error", () => {
    const error = new AppError(403, "Forbidden");

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it("captures a stack trace that does not include the AppError constructor frame", () => {
    const error = new AppError(500, "Internal");

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("AppError");
    expect(error.stack).toContain("Internal");
  });

  it("exposes statusCode as an own property for global error handler detection", () => {
    const error = new AppError(422, "Unprocessable");

    expect("statusCode" in error).toBe(true);
  });

  it("stores the statusCode directly on the instance", () => {
    const error = new AppError(400, "Bad");

    expect(error).toHaveProperty("statusCode", 400);
  });
});
