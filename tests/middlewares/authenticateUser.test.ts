import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {} from "../../src/types/express.type.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { authenticateUser } from "../../src/middlewares/authenticateUser.js";
import { UnauthorizedError } from "../../src/utils/errors/unauthorized.error.js";

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}));

vi.mock("../../src/utils/jwt/jwt.utils.js", () => ({
  verifyToken: verifyTokenMock,
}));

type MockResponse = Response & {
  locals: { log?: CanonicalLogContext };
};

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "GET",
    path: "/secure",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function createMockResponse(withLog = true): MockResponse {
  return {
    locals: withLog ? { log: createLogContext() } : {},
  } as MockResponse;
}

function mockRequest(request: Partial<Request>): Request {
  return request as Request;
}

describe("authenticateUser middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("attaches the verified user payload and updates auth context on a valid bearer token", () => {
    const payload = {
      id: "User@123",
      role: "READ_ONLY",
      allowedFolders: ["Folder@123"],
    };
    verifyTokenMock.mockReturnValue(payload);
    const req = mockRequest({
      headers: {
        authorization: "Bearer valid-token",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(verifyTokenMock).toHaveBeenCalledWith("valid-token");
    expect(req.user).toStrictEqual(payload);
    expect(res.locals.log).toMatchObject({
      userId: "User@123",
      userRole: "READ_ONLY",
      authStatus: "authenticated",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("passes UnauthorizedError when the authorization header is missing", () => {
    const req = mockRequest({ headers: {} });
    const res = createMockResponse();
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(res.locals.log?.authStatus).toBe("unauthenticated");
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "Authorization header is missing",
    });
  });

  it("passes UnauthorizedError for invalid bearer token format", () => {
    const req = mockRequest({
      headers: {
        authorization: "Basic abc123",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(verifyTokenMock).not.toHaveBeenCalled();
    expect(res.locals.log?.authStatus).toBe("token_invalid");
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("marks token_expired when verification throws an expired-token error", () => {
    const error = new Error("jwt expired");
    verifyTokenMock.mockImplementation(() => {
      throw error;
    });
    const req = mockRequest({
      headers: {
        authorization: "Bearer expired-token",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(res.locals.log?.authStatus).toBe("token_expired");
    expect(next).toHaveBeenCalledWith(error);
  });

  it("marks token_invalid when verification throws a non-expiry error", () => {
    const error = new Error("invalid signature");
    verifyTokenMock.mockImplementation(() => {
      throw error;
    });
    const req = mockRequest({
      headers: {
        authorization: "Bearer invalid-token",
      },
    });
    const res = createMockResponse();
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(res.locals.log?.authStatus).toBe("token_invalid");
    expect(next).toHaveBeenCalledWith(error);
  });

  it("still authenticates correctly when no canonical log context is present", () => {
    const payload = {
      id: "User@456",
      role: "ADMIN",
      allowedFolders: ["Folder@999"],
    };
    verifyTokenMock.mockReturnValue(payload);
    const req = mockRequest({
      headers: {
        authorization: "Bearer valid-token",
      },
    });
    const res = createMockResponse(false);
    const next = vi.fn();

    authenticateUser(req, res, next as NextFunction);

    expect(req.user).toStrictEqual(payload);
    expect(next).toHaveBeenCalledWith();
  });
});
