import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { UnauthorizedError } from "../../src/utils/errors/http.errors.js";

const {
  getAcessAndRefreshTokenMock,
  refreshAcessTokenMock,
  revokeRefreshTokenMock,
  revokeAllUserSessionsMock,
  validateLoginUserBodyMock,
  validateRefreshTokenCookieMock,
  extractUserIdMock,
} = vi.hoisted(() => ({
  getAcessAndRefreshTokenMock: vi.fn(),
  refreshAcessTokenMock: vi.fn(),
  revokeRefreshTokenMock: vi.fn(),
  revokeAllUserSessionsMock: vi.fn(),
  validateLoginUserBodyMock: vi.fn(),
  validateRefreshTokenCookieMock: vi.fn(),
  extractUserIdMock: vi.fn(),
}));

vi.mock("../../src/auth/auth.service.js", () => ({
  getAcessAndRefreshToken: getAcessAndRefreshTokenMock,
  refreshAcessToken: refreshAcessTokenMock,
  revokeRefreshToken: revokeRefreshTokenMock,
  revokeAllUserSessions: revokeAllUserSessionsMock,
}));

vi.mock("../../src/auth/auth.validation.js", () => ({
  validateLoginUserBody: validateLoginUserBodyMock,
  validateRefreshTokenCookie: validateRefreshTokenCookieMock,
}));

vi.mock("../../src/utils/jwt/jwt.utils.js", () => ({
  extractUserIdFromToken: extractUserIdMock,
}));

import {
  loginUser,
  refreshAcessToken as refreshController,
  logout,
  logoutAllSessions,
} from "../../src/auth/auth.controller.js";

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
  clearCookie: ReturnType<typeof vi.fn>;
  locals: { log: CanonicalLogContext };
};

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "POST",
    path: "/auth",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function createMockResponse(): MockResponse {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    locals: { log: createLogContext() },
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

describe("auth controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loginUser", () => {
    it("validates body, sets refresh cookie, and responds with access token", async () => {
      validateLoginUserBodyMock.mockReturnValue({ name: "alice", password: "Password1!" });
      getAcessAndRefreshTokenMock.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const req = { body: { name: "alice", password: "Password1!" } };
      const res = createMockResponse();
      const next = vi.fn();

      await loginUser(req as any, res, next as NextFunction);

      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/auth",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Login SuccessFul",
        token: "access-token",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("passes errors to next", async () => {
      const error = new Error("validation failed");
      validateLoginUserBodyMock.mockImplementation(() => { throw error; });

      const req = { body: {} };
      const res = createMockResponse();
      const next = vi.fn();

      await loginUser(req as any, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("refreshAcessToken", () => {
    it("rotates refresh cookie and responds with new access token", async () => {
      validateRefreshTokenCookieMock.mockReturnValue({ refreshToken: "old-token" });
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
      refreshAcessTokenMock.mockResolvedValue({
        accessToken: "new-access-token",
        newRefreshToken: "new-refresh-token",
        expiresAt: futureExpiry,
      });

      const req = { cookies: { refreshToken: "old-token" } };
      const res = createMockResponse();
      const next = vi.fn();

      await refreshController(req as any, res, next as NextFunction);

      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "new-refresh-token", expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/auth",
        maxAge: expect.any(Number),
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("new-access-token");
      expect(next).not.toHaveBeenCalled();
    });

    it("clears cookie and passes UnauthorizedError to next", async () => {
      validateRefreshTokenCookieMock.mockReturnValue({ refreshToken: "bad-token" });
      const error = new UnauthorizedError("Session expired");
      refreshAcessTokenMock.mockRejectedValue(error);

      const req = { cookies: { refreshToken: "bad-token" } };
      const res = createMockResponse();
      const next = vi.fn();

      await refreshController(req as any, res, next as NextFunction);

      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/auth",
      }));
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("logout", () => {
    it("revokes the token, clears cookie, and responds with success", async () => {
      validateRefreshTokenCookieMock.mockReturnValue({ refreshToken: "token" });
      revokeRefreshTokenMock.mockResolvedValue({ status: "SUCCESS" });

      const req = { cookies: { refreshToken: "token" } };
      const res = createMockResponse();
      const next = vi.fn();

      await logout(req as any, res, next as NextFunction);

      expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", expect.objectContaining({
        httpOnly: true,
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "Logged out successfully" });
    });

    it("responds with already logged out message", async () => {
      validateRefreshTokenCookieMock.mockReturnValue({ refreshToken: "token" });
      revokeRefreshTokenMock.mockResolvedValue({ status: "ALREADY_LOGGED_OUT" });

      const req = { cookies: { refreshToken: "token" } };
      const res = createMockResponse();
      const next = vi.fn();

      await logout(req as any, res, next as NextFunction);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: "User already logged out" });
    });

    it("passes errors to next", async () => {
      const error = new Error("revoke failed");
      validateRefreshTokenCookieMock.mockImplementation(() => { throw error; });

      const req = { cookies: {} };
      const res = createMockResponse();
      const next = vi.fn();

      await logout(req as any, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("logoutAllSessions", () => {
    it("extracts userId, revokes all sessions, and responds with success", async () => {
      validateRefreshTokenCookieMock.mockReturnValue({ refreshToken: "User@123.token" });
      extractUserIdMock.mockReturnValue("User@123");
      revokeAllUserSessionsMock.mockResolvedValue(undefined);

      const req = { cookies: { refreshToken: "User@123.token" } };
      const res = createMockResponse();
      const next = vi.fn();

      await logoutAllSessions(req as any, res, next as NextFunction);

      expect(revokeAllUserSessionsMock).toHaveBeenCalledWith("User@123", expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "All sessions are logged out successfully",
      });
    });

    it("passes errors to next", async () => {
      const error = new Error("revoke all failed");
      validateRefreshTokenCookieMock.mockImplementation(() => { throw error; });

      const req = { cookies: {} };
      const res = createMockResponse();
      const next = vi.fn();

      await logoutAllSessions(req as any, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
