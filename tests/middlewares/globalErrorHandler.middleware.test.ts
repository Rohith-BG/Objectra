import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { globalErrorHandler } from "../../src/middlewares/globalErrorHandler.middleware.js";
import { BadRequestError } from "../../src/utils/errors/badrequest.error.js";

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  locals: { log?: CanonicalLogContext };
};

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "GET",
    path: "/test",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function createMockResponse(withLog = true): MockResponse {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    locals: withLog ? { log: createLogContext() } : {},
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

describe("globalErrorHandler middleware", () => {
  it("returns the operational error status/message and stores error context", () => {
    const err = new BadRequestError("Invalid request");
    const req = {} as Request;
    const res = createMockResponse();

    globalErrorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.locals.log?.error).toMatchObject({
      name: "BadRequestError",
      message: "Invalid request",
      isOperational: true,
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
    });
  });

  it("returns 500 and hides the message for non-operational errors", () => {
    const err = new Error("database exploded");
    const req = {} as Request;
    const res = createMockResponse();

    globalErrorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.locals.log?.error).toMatchObject({
      name: "Error",
      message: "database exploded",
      isOperational: false,
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Internal server error",
    });
  });

  it("does not overwrite an existing canonical log error", () => {
    const err = new Error("new failure");
    const req = {} as Request;
    const res = createMockResponse();
    res.locals.log!.error = {
      name: "ExistingError",
      message: "first failure",
      isOperational: true,
    };

    globalErrorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.locals.log?.error).toStrictEqual({
      name: "ExistingError",
      message: "first failure",
      isOperational: true,
    });
  });

  it("still returns a response when no canonical log context is present", () => {
    const err = new BadRequestError("Invalid request");
    const req = {} as Request;
    const res = createMockResponse(false);

    globalErrorHandler(err, req, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
    });
  });
});
