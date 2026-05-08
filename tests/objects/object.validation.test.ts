import { describe, expect, it } from "vitest";
import {
  validateObjectId,
  validateObjectName,
} from "../../src/objects/object.validation.js";
import { BadRequestError } from "../../src/utils/errors/badrequest.error.js";
import { ValidationError } from "../../src/utils/errors/validation.error.js";

describe("object validation", () => {
  describe("validateObjectName", () => {
    it("returns a trimmed object name", () => {
      expect(validateObjectName("  invoice.png  ")).toBe("invoice.png");
    });

    it("throws BadRequestError when the object name is missing", () => {
      expect(() => validateObjectName(undefined as unknown as string)).toThrow(BadRequestError);
      expect(() => validateObjectName(undefined as unknown as string)).toThrow(
        "Name of a object is a required field",
      );
    });

    it("throws ValidationError when the object name is empty after trimming", () => {
      expect(() => validateObjectName("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the object name is not a string", () => {
      expect(() => validateObjectName(123 as unknown as string)).toThrow(ValidationError);
    });
  });

  describe("validateObjectId", () => {
    it("returns a trimmed object id", () => {
      expect(validateObjectId("  Object@123  ")).toBe("Object@123");
    });

    it("throws BadRequestError when the object id is missing", () => {
      expect(() => validateObjectId(undefined as unknown as string)).toThrow(BadRequestError);
      expect(() => validateObjectId(undefined as unknown as string)).toThrow(
        "ObjectId is a required field",
      );
    });

    it("throws ValidationError when the object id is empty after trimming", () => {
      expect(() => validateObjectId("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the object id is not a string", () => {
      expect(() => validateObjectId(false as unknown as string)).toThrow(ValidationError);
    });
  });
});
