import { describe, expect, it } from "vitest";
import RandomIdGenerator from "../../../src/utils/helpers/create-randomId.helper.js";

describe("RandomIdGenerator", () => {
  describe("getId", () => {
    it("returns a string", () => {
      const id = RandomIdGenerator.getId();

      expect(typeof id).toBe("string");
    });

    it("returns a valid UUID v4 format", () => {
      const id = RandomIdGenerator.getId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id).toMatch(uuidRegex);
    });

    it("generates unique ids on successive calls", () => {
      const id1 = RandomIdGenerator.getId();
      const id2 = RandomIdGenerator.getId();
      const id3 = RandomIdGenerator.getId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });
});
