import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { RateLimiterMiddleware } from "../../src/middlewares/rateLimiter.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { TooManyRequestsError } from "../../src/utils/errors/http.errors.js";

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  locals: { log: CanonicalLogContext };
  setHeader: ReturnType<typeof vi.fn>;
};

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "GET",
    path: "/limited",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function createMockResponse(): MockResponse {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    locals: {
      log: createLogContext(),
    },
    setHeader: vi.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

function mockRequest(ip?: string): Request {
  return {
    ip,
  } as Request;
}

function createTokenBucketMock() {
  return {
    isAllowed: vi.fn(),
    getMaxTokens: vi.fn().mockReturnValue(60),
  };
}

describe("RateLimiterMiddleware", () => {
  it("sets rate-limit headers and calls next when the request is allowed", async () => {
    const tokenBucket = createTokenBucketMock();
    tokenBucket.isAllowed.mockResolvedValue({
      remaining: 59,
      resetAt: 1234567890,
    });
    const middleware = new RateLimiterMiddleware(tokenBucket as any).handle();
    const req = mockRequest("127.0.0.1");
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next as NextFunction);

    expect(tokenBucket.isAllowed).toHaveBeenCalledWith("ratelimit:global:127.0.0.1");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 60);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 59);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 1234567890);
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("uses unknown when req.ip is missing", async () => {
    const tokenBucket = createTokenBucketMock();
    tokenBucket.isAllowed.mockResolvedValue({
      remaining: 58,
      resetAt: 22334455,
    });
    const middleware = new RateLimiterMiddleware(tokenBucket as any).handle();
    const req = mockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next as NextFunction);

    expect(tokenBucket.isAllowed).toHaveBeenCalledWith("ratelimit:global:unknown");
  });

  it("returns 429 with retry headers for TooManyRequestsError", async () => {
    const tokenBucket = createTokenBucketMock();
    tokenBucket.isAllowed.mockRejectedValue(
      new TooManyRequestsError("Too many requests", 30),
    );
    const middleware = new RateLimiterMiddleware(tokenBucket as any).handle();
    const req = mockRequest("127.0.0.1");
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 60);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 30);
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", 30);
    expect(res.locals.log.error).toMatchObject({
      name: "TooManyRequestsError",
      message: "Too many requests",
      isOperational: true,
    });
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      message: "Too many requests",
      retryAfter: 30,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("fails open on unexpected errors and records the redis failure in operations", async () => {
    const tokenBucket = createTokenBucketMock();
    tokenBucket.isAllowed.mockRejectedValue(new Error("redis unavailable"));
    const middleware = new RateLimiterMiddleware(tokenBucket as any).handle();
    const req = mockRequest("127.0.0.1");
    const res = createMockResponse();
    const next = vi.fn();

    await middleware(req, res, next as NextFunction);

    expect(res.locals.log.operations).toContainEqual({
      name: "rateLimiter",
      result: "failure",
      detail: "redis_error_fail_open",
    });
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });
});
