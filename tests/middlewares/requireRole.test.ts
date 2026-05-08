import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type {} from "../../src/types/express.type.js";
import { requireRole } from "../../src/middlewares/requireRole.js";
import { ForbiddenError } from "../../src/utils/errors/http.errors.js";

function mockRequest(role?: string): Request {
  return {
    user: role
      ? {
          id: "User@123",
          role,
          allowedFolders: ["Folder@123"],
        }
      : undefined,
  } as Request;
}

const res = {} as Response;

describe("requireRole middleware", () => {
  it("allows requests when the user's role is included", () => {
    const middleware = requireRole("ADMIN", "READ_WRITE");
    const next = vi.fn();

    middleware(mockRequest("READ_WRITE"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects unauthenticated requests", () => {
    const middleware = requireRole("ADMIN");
    const next = vi.fn();

    middleware(mockRequest(), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "User not authenticated",
    });
  });

  it("rejects users whose role is not in the allowed list", () => {
    const middleware = requireRole("ADMIN", "READ_WRITE");
    const next = vi.fn();

    middleware(mockRequest("READ_ONLY"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "Access denied. This action requires one of the following roles: ADMIN, READ_WRITE",
    });
  });
});
