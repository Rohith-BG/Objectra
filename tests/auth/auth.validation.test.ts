import { describe, expect, it } from "vitest";
import { BadRequestError } from "../../src/utils/errors/http.errors.js";
import { validateLoginUserBody, validateRefreshTokenCookie } from "../../src/auth/auth.validation.js";

describe("auth validation", () => {
  describe("validateLoginUserBody", () => {
    it("returns a normalized login body for valid input", () => {
      const result = validateLoginUserBody({
        name: "  alice  ",
        password: "  Password1!  ",
      });

      expect(result).toStrictEqual({
        name: "alice",
        password: "Password1!",
      });
    });

    it("throws BadRequestError when name is missing", () => {
      expect(() =>
        validateLoginUserBody({ password: "Password1!" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when name is too short", () => {
      expect(() =>
        validateLoginUserBody({ name: "al", password: "Password1!" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when password is missing", () => {
      expect(() =>
        validateLoginUserBody({ name: "alice" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when password does not meet complexity", () => {
      expect(() =>
        validateLoginUserBody({ name: "alice", password: "password" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when body is undefined", () => {
      expect(() => validateLoginUserBody(undefined)).toThrow(BadRequestError);
    });
  });

  describe("validateRefreshTokenCookie", () => {
    it("returns a normalized cookie for a valid refresh token", () => {
      const result = validateRefreshTokenCookie({
        refreshToken: "User@123.some-encoded-data",
      });

      expect(result).toStrictEqual({
        refreshToken: "User@123.some-encoded-data",
      });
    });

    it("throws BadRequestError when refreshToken is missing", () => {
      expect(() => validateRefreshTokenCookie({})).toThrow(BadRequestError);
    });

    it("throws BadRequestError when refreshToken is empty", () => {
      expect(() =>
        validateRefreshTokenCookie({ refreshToken: "" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when refreshToken has no dot", () => {
      expect(() =>
        validateRefreshTokenCookie({ refreshToken: "no-dot-here" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when dot is at position 0", () => {
      expect(() =>
        validateRefreshTokenCookie({ refreshToken: ".some-data" }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when nothing after the dot", () => {
      expect(() =>
        validateRefreshTokenCookie({ refreshToken: "User@123." }),
      ).toThrow(BadRequestError);
    });

    it("throws BadRequestError when cookies is undefined", () => {
      expect(() => validateRefreshTokenCookie(undefined)).toThrow(BadRequestError);
    });
  });
});
