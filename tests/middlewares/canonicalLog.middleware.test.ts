import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalLogMiddleware } from "../../src/middlewares/canonicalLog.middleware.js";

const {
  emitCanonicalLogMock,
  randomUUIDMock,
} = vi.hoisted(() => ({
  emitCanonicalLogMock: vi.fn(),
  randomUUIDMock: vi.fn(),
}));

vi.mock("../../src/configs/logger.js", () => ({
  emitCanonicalLog: emitCanonicalLogMock,
}));

vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomUUID: randomUUIDMock,
  };
});

type MockResponse = Response & {
  locals: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  statusCode: number;
};

let hrtimeSpy: ReturnType<typeof vi.spyOn>;

function createMockResponse(): { res: MockResponse; finishHandlerRef: { current?: () => void } } {
  const finishHandlerRef: { current?: () => void } = {};
  const res = {
    locals: {},
    on: vi.fn((event: string, handler: () => void) => {
      if (event === "finish") {
        finishHandlerRef.current = handler;
      }
      return res;
    }),
    setHeader: vi.fn(),
    get: vi.fn().mockReturnValue("123"),
    statusCode: 201,
  } as unknown as MockResponse;

  return { res, finishHandlerRef };
}

function mockRequest(request: Partial<Request>): Request {
  return request as Request;
}

describe("canonicalLogMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDMock.mockReturnValue("generated-request-id");
    hrtimeSpy = vi
      .spyOn(process.hrtime, "bigint")
      .mockReturnValueOnce(1_000_000n)
      .mockReturnValueOnce(6_000_000n);
  });

  afterEach(() => {
    hrtimeSpy.mockRestore();
  });

  it("creates log context from request data, sets request id header, and logs on finish", () => {
    const req = mockRequest({
      method: "POST",
      originalUrl: "/folders",
      ip: "127.0.0.1",
      headers: {
        "x-request-id": "external-request-id",
        "user-agent": "vitest-agent",
      },
      socket: { remoteAddress: "10.0.0.1" } as Request["socket"],
    });
    const { res, finishHandlerRef } = createMockResponse();
    const next = vi.fn();

    canonicalLogMiddleware(req, res, next as NextFunction);

    expect(res.locals["log"]).toMatchObject({
      requestId: "external-request-id",
      method: "POST",
      path: "/folders",
      ip: "127.0.0.1",
      userAgent: "vitest-agent",
      operations: [],
    });
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "external-request-id");
    expect(next).toHaveBeenCalledWith();

    finishHandlerRef.current?.();

    expect(emitCanonicalLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "external-request-id",
        statusCode: 201,
        contentLength: "123",
        durationMs: 5,
      }),
    );
  });

  it("falls back to generated request id, socket address, and unknown user agent", () => {
    const req = mockRequest({
      method: "GET",
      originalUrl: "/health",
      headers: {},
      socket: { remoteAddress: "10.0.0.2" } as Request["socket"],
    });
    const { res } = createMockResponse();
    const next = vi.fn();

    canonicalLogMiddleware(req, res, next as NextFunction);

    expect(randomUUIDMock).toHaveBeenCalled();
    expect(res.locals["log"]).toMatchObject({
      requestId: "generated-request-id",
      ip: "10.0.0.2",
      userAgent: "unknown",
    });
  });
});
