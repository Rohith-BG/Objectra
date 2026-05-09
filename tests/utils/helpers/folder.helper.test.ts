import { describe, expect, it } from "vitest";
import type { Folder } from "../../../src/folders/folder.types.js";
import { assertFolderAccess, filterAllowedFolders } from "../../../src/utils/helpers/folder.helper.js";
import { ForbiddenError } from "../../../src/utils/errors/http.errors.js";

function makeFolder(id: string): Folder {
  return {
    id,
    name: `Folder ${id}`,
    parentId: "ROOT",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };
}

describe("folder helper", () => {
  describe("filterAllowedFolders", () => {
    it("returns all folders when allowedFolders is undefined", () => {
      const folders = [makeFolder("F1"), makeFolder("F2")];

      expect(filterAllowedFolders(folders, undefined)).toStrictEqual(folders);
    });

    it("returns all folders when allowedFolders is an empty array", () => {
      const folders = [makeFolder("F1"), makeFolder("F2")];

      expect(filterAllowedFolders(folders, [])).toStrictEqual(folders);
    });

    it("returns only folders whose id is in the allowed list", () => {
      const folders = [makeFolder("F1"), makeFolder("F2"), makeFolder("F3")];

      const result = filterAllowedFolders(folders, ["F1", "F3"]);

      expect(result).toStrictEqual([makeFolder("F1"), makeFolder("F3")]);
    });

    it("returns an empty array when no folders match", () => {
      const folders = [makeFolder("F1"), makeFolder("F2")];

      const result = filterAllowedFolders(folders, ["F99"]);

      expect(result).toStrictEqual([]);
    });

    it("handles an empty folders list", () => {
      expect(filterAllowedFolders([], ["F1"])).toStrictEqual([]);
    });
  });

  describe("assertFolderAccess", () => {
    it("does not throw when allowedFolders is undefined", () => {
      expect(() => assertFolderAccess("F1", undefined)).not.toThrow();
    });

    it("does not throw when allowedFolders is an empty array", () => {
      expect(() => assertFolderAccess("F1", [])).not.toThrow();
    });

    it("does not throw when the folder id is in the allowed list", () => {
      expect(() => assertFolderAccess("F1", ["F1", "F2"])).not.toThrow();
    });

    it("throws ForbiddenError when the folder id is not in the allowed list", () => {
      expect(() => assertFolderAccess("F3", ["F1", "F2"])).toThrow(ForbiddenError);
      expect(() => assertFolderAccess("F3", ["F1", "F2"])).toThrow(
        "Access denied: You do not have permission to access folder 'F3'",
      );
    });
  });
});
