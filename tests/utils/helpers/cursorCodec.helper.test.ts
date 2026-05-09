import { describe, expect, it } from "vitest";
import CursorCodec from "../../../src/utils/helpers/cursorCodec.helper.js";

describe("CursorCodec", () => {
  describe("encode", () => {
    it("encodes an object to a base64 string", () => {
      const data = { id: "Object@123" };
      const encoded = CursorCodec.encode(data);

      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(JSON.parse(decoded)).toStrictEqual(data);
    });

    it("encodes a plain string value", () => {
      const encoded = CursorCodec.encode("hello");

      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(JSON.parse(decoded)).toBe("hello");
    });

    it("encodes a number value", () => {
      const encoded = CursorCodec.encode(42);

      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(JSON.parse(decoded)).toBe(42);
    });

    it("encodes null", () => {
      const encoded = CursorCodec.encode(null);

      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(JSON.parse(decoded)).toBeNull();
    });

    it("encodes nested objects", () => {
      const data = { a: { b: { c: 1 } } };
      const encoded = CursorCodec.encode(data);

      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      expect(JSON.parse(decoded)).toStrictEqual(data);
    });
  });

  describe("decode", () => {
    it("decodes a base64 string back to the original object", () => {
      const original = { id: "Object@123", folderId: "Folder@456" };
      const encoded = Buffer.from(JSON.stringify(original), "utf-8").toString("base64");

      const decoded = CursorCodec.decode(encoded);

      expect(decoded).toStrictEqual(original);
    });

    it("throws an error with statusCode 400 for invalid base64 data", () => {
      try {
        CursorCodec.decode("!!NOT_VALID_BASE64_JSON!!");
        expect.fail("Expected an error to be thrown");
      } catch (error: any) {
        expect(error.message).toContain("Failed to decode the object");
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe("encode-decode round trip", () => {
    it("returns the original object after encoding and decoding", () => {
      const original = { id: "cursor-key", lastEvaluatedKey: "abc" };

      const encoded = CursorCodec.encode(original);
      const decoded = CursorCodec.decode(encoded);

      expect(decoded).toStrictEqual(original);
    });

    it("handles an empty object round trip", () => {
      const original = {};

      const encoded = CursorCodec.encode(original);
      const decoded = CursorCodec.decode(encoded);

      expect(decoded).toStrictEqual(original);
    });
  });
});
