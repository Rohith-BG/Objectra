import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  validateCreateUserRequestBody,
  validateUpdatePasswordRequestBody,
  validateUserIdRequestQueryParam,
} from "../../src/users/user.middlewares.js";
import { ValidationError } from "../../src/utils/errors/validation.error.js";

const res = {} as Response;

function mockRequest(request: Partial<Request>): Request {
  return request as Request;
}

describe("user validation middlewares", () => {
  describe("validateCreateUserRequestBody", () => {
    it("normalizes req.body and calls next", async () => {
      const req = mockRequest({
        body: {
          name: "  alice  ",
          password: "  Password1!  ",
          role: "READ_ONLY",
          allowedFolders: [" Folder@123 "],
        },
      });
      const next = vi.fn();

      await validateCreateUserRequestBody(req, res, next as NextFunction);

      expect(req.body).toStrictEqual({
        name: "alice",
        password: "Password1!",
        role: "READ_ONLY",
        allowedFolders: ["Folder@123"],
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("passes validation errors to next", async () => {
      const req = mockRequest({ body: { name: "al" } });
      const next = vi.fn();

      await validateCreateUserRequestBody(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe("validateUserIdRequestQueryParam", () => {
    it("calls next for a valid query id", async () => {
      const req = mockRequest({ query: { id: "User@123" } });
      const next = vi.fn();

      await validateUserIdRequestQueryParam(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith();
    });

    it("passes validation errors to next", async () => {
      const req = mockRequest({ query: { id: "" } });
      const next = vi.fn();

      await validateUserIdRequestQueryParam(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe("validateUpdatePasswordRequestBody", () => {
    it("normalizes req.body and calls next", async () => {
      const req = mockRequest({
        body: {
          id: " User@123 ",
          password: " NewPass1! ",
        },
      });
      const next = vi.fn();

      await validateUpdatePasswordRequestBody(req, res, next as NextFunction);

      expect(req.body).toStrictEqual({
        id: "User@123",
        password: "NewPass1!",
      });
      expect(next).toHaveBeenCalledWith();
    });

    it("passes validation errors to next", async () => {
      const req = mockRequest({ body: { id: "User@123", password: "short" } });
      const next = vi.fn();

      await validateUpdatePasswordRequestBody(req, res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
});
