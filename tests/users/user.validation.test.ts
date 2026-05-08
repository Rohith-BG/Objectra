import { describe, expect, it } from "vitest";
import {
  validateCreateUserBody,
  validateUpdatePasswordBody,
  validateUserIdQueryParam,
} from "../../src/users/user.validation.js";
import { BadRequestError, ValidationError } from "../../src/utils/errors/http.errors.js";

describe("user validation", () => {
  describe("validateCreateUserBody", () => {
    it("returns a normalized create-user body", () => {
      expect(
        validateCreateUserBody({
          name: "  alice  ",
          password: "  Password1!  ",
          role: "READ_ONLY",
          allowedFolders: [" Folder@123 "],
        }),
      ).toStrictEqual({
        name: "alice",
        password: "Password1!",
        role: "READ_ONLY",
        allowedFolders: ["Folder@123"],
      });
    });

    it("throws BadRequestError when the body is missing", () => {
      expect(() => validateCreateUserBody(undefined)).toThrow(BadRequestError);
      expect(() => validateCreateUserBody(undefined)).toThrow(
        "Requesst Body is missing or not in a valid format",
      );
    });

    it("throws ValidationError for invalid username, password, role, or allowed folders", () => {
      expect(() =>
        validateCreateUserBody({
          name: "al",
          password: "Password1!",
          role: "READ_ONLY",
          allowedFolders: ["Folder@123"],
        }),
      ).toThrow(ValidationError);

      expect(() =>
        validateCreateUserBody({
          name: "alice",
          password: "password",
          role: "READ_ONLY",
          allowedFolders: ["Folder@123"],
        }),
      ).toThrow(ValidationError);

      expect(() =>
        validateCreateUserBody({
          name: "alice",
          password: "Password1!",
          role: "UNKNOWN",
          allowedFolders: ["Folder@123"],
        }),
      ).toThrow(ValidationError);

      expect(() =>
        validateCreateUserBody({
          name: "alice",
          password: "Password1!",
          role: "READ_ONLY",
          allowedFolders: [],
        }),
      ).toThrow(ValidationError);
    });
  });

  describe("validateUserIdQueryParam", () => {
    it("returns a normalized id query object", () => {
      expect(validateUserIdQueryParam({ id: "  User@123  " })).toStrictEqual({
        id: "User@123",
      });
    });

    it("throws ValidationError when id is missing or empty", () => {
      expect(() => validateUserIdQueryParam({})).toThrow(ValidationError);
      expect(() => validateUserIdQueryParam({ id: "   " })).toThrow(ValidationError);
    });
  });

  describe("validateUpdatePasswordBody", () => {
    it("returns a normalized update-password body", () => {
      expect(
        validateUpdatePasswordBody({
          id: "  User@123  ",
          password: "  NewPass1!  ",
        }),
      ).toStrictEqual({
        id: "User@123",
        password: "NewPass1!",
      });
    });

    it("throws ValidationError when id or password is invalid", () => {
      expect(() => validateUpdatePasswordBody({ id: "", password: "NewPass1!" })).toThrow(
        ValidationError,
      );
      expect(() => validateUpdatePasswordBody({ id: "User@123", password: "short" })).toThrow(
        ValidationError,
      );
      expect(() => validateUpdatePasswordBody({ id: "User@123" })).toThrow(ValidationError);
    });
  });
});
