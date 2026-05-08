import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type {} from "../../src/types/express.type.js";
import { authorizeUser } from "../../src/middlewares/authorizeUser.js";
import { ForbiddenError } from "../../src/utils/errors/forbidden.error.js";

function mockRequest(method: string, role?: string): Request {
  return {
    method,
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

describe("authorizeUser middleware", () => {
  it("allows READ_ONLY users to perform GET requests", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("GET", "READ_ONLY"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows WRITE_ONLY users to perform POST requests", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("POST", "WRITE_ONLY"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("allows READ_WRITE users to perform GET and POST requests", () => {
    const getNext = vi.fn();
    const postNext = vi.fn();

    authorizeUser(mockRequest("GET", "READ_WRITE"), res, getNext as NextFunction);
    authorizeUser(mockRequest("POST", "READ_WRITE"), res, postNext as NextFunction);

    expect(getNext).toHaveBeenCalledWith();
    expect(postNext).toHaveBeenCalledWith();
  });

  it("allows ADMIN users to perform mutating requests", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("DELETE", "ADMIN"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects unauthenticated requests", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("GET"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "User not authenticated",
    });
  });

  it("rejects invalid user roles", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("GET", "UNKNOWN_ROLE"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "Invalid user role",
    });
  });

  it("rejects disallowed methods for the user role", () => {
    const next = vi.fn();

    authorizeUser(mockRequest("PATCH", "READ_ONLY"), res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(next.mock.calls[0][0]).toMatchObject({
      message: "Role READ_ONLY is not allowed to perform PATCH operations",
    });
  });
});
