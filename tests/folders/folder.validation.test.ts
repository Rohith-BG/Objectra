import { describe, expect, it } from "vitest";
import {
  validateCursor,
  validateFolderId,
  validateFoldername,
  validateParentId,
} from "../../src/folders/folder.validation.js";
import { BadRequestError } from "../../src/utils/errors/badrequest.error.js";
import { ValidationError } from "../../src/utils/errors/validation.error.js";

describe("folder validation", () => {
  describe("validateFoldername", () => {
    it("returns a trimmed folder name", () => {
      expect(validateFoldername("  Documents  ")).toBe("Documents");
    });

    it("throws BadRequestError when the folder name is missing", () => {
      expect(() => validateFoldername(undefined as unknown as string)).toThrow(BadRequestError);
      expect(() => validateFoldername(undefined as unknown as string)).toThrow(
        "FolderName is a required field",
      );
    });

    it("throws ValidationError when the folder name is empty after trimming", () => {
      expect(() => validateFoldername("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the folder name is not a string", () => {
      expect(() => validateFoldername(123 as unknown as string)).toThrow(ValidationError);
    });
  });

  describe("validateFolderId", () => {
    it("returns a trimmed folder id", () => {
      expect(validateFolderId("  Folder@123  ")).toBe("Folder@123");
    });

    it("throws BadRequestError when the folder id is missing", () => {
      expect(() => validateFolderId(undefined as unknown as string)).toThrow(BadRequestError);
      expect(() => validateFolderId(undefined as unknown as string)).toThrow(
        "FolderId is a required field",
      );
    });

    it("throws ValidationError when the folder id is empty after trimming", () => {
      expect(() => validateFolderId("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the folder id is not a string", () => {
      expect(() => validateFolderId(false as unknown as string)).toThrow(ValidationError);
    });
  });

  describe("validateParentId", () => {
    it("returns null for a root parent id", () => {
      expect(validateParentId(null)).toBeNull();
    });

    it("returns a trimmed parent id", () => {
      expect(validateParentId("  Folder@parent  ")).toBe("Folder@parent");
    });

    it("throws BadRequestError when the parent id is missing", () => {
      expect(() => validateParentId(undefined as unknown as string)).toThrow(BadRequestError);
      expect(() => validateParentId(undefined as unknown as string)).toThrow(
        "ParentId is a required field",
      );
    });

    it("throws ValidationError when the parent id is empty after trimming", () => {
      expect(() => validateParentId("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the parent id is not a string or null", () => {
      expect(() => validateParentId(42 as unknown as string)).toThrow(ValidationError);
    });
  });

  describe("validateCursor", () => {
    it("returns a trimmed cursor", () => {
      expect(validateCursor("  cursor-token  ")).toBe("cursor-token");
    });

    it("throws ValidationError when the cursor is empty after trimming", () => {
      expect(() => validateCursor("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError when the cursor is not a string", () => {
      expect(() => validateCursor(undefined)).toThrow(ValidationError);
      expect(() => validateCursor({ page: 2 })).toThrow(ValidationError);
    });
  });
});
