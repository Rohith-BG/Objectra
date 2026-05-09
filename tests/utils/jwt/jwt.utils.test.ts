import { beforeEach, describe, expect, it, vi } from "vitest";

const { jwtSignMock, jwtVerifyMock, randomIdMock, cursorEncodeMock } = vi.hoisted(() => ({
  jwtSignMock: vi.fn(),
  jwtVerifyMock: vi.fn(),
  randomIdMock: vi.fn(),
  cursorEncodeMock: vi.fn(),
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: jwtSignMock,
    verify: jwtVerifyMock,
    TokenExpiredError: class TokenExpiredError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "TokenExpiredError";
      }
    },
    JsonWebTokenError: class JsonWebTokenError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "JsonWebTokenError";
      }
    },
  },
}));

vi.mock("../../../src/utils/helpers/create-randomId.helper.js", () => ({
  default: {
    getId: randomIdMock,
  },
}));

vi.mock("../../../src/utils/helpers/cursorCodec.helper.js", () => ({
  default: {
    encode: cursorEncodeMock,
  },
}));

import {
  extractUserIdFromToken,
  generateAccessToken,
  generateOpaqueToken,
  hashToken,
  verifyToken,
} from "../../../src/utils/jwt/jwt.utils.js";
import { UnauthorizedError } from "../../../src/utils/errors/http.errors.js";

describe("JWT utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  describe("generateAccessToken", () => {
    it("signs a JWT with HS512 and 15m expiry", () => {
      jwtSignMock.mockReturnValue("signed-access-token");

      const payload = { id: "User@123", role: "ADMIN", allowedFolders: ["Folder@1"] };
      const result = generateAccessToken(payload);

      expect(result).toBe("signed-access-token");
      expect(jwtSignMock).toHaveBeenCalledWith(
        payload,
        "test-secret",
        { algorithm: "HS512", expiresIn: "15m" },
      );
    });
  });

  describe("generateOpaqueToken", () => {
    it("returns a token in the format userId.encodedRandom", () => {
      randomIdMock.mockReturnValue("uuid-value");
      cursorEncodeMock.mockReturnValue("encoded-uuid");

      const token = generateOpaqueToken("User@123");

      expect(token).toBe("User@123.encoded-uuid");
      expect(randomIdMock).toHaveBeenCalledTimes(1);
      expect(cursorEncodeMock).toHaveBeenCalledWith("uuid-value");
    });
  });

  describe("extractUserIdFromToken", () => {
    it("extracts the user id before the first dot", () => {
      expect(extractUserIdFromToken("User@123.some-random-data")).toBe("User@123");
    });

    it("returns null when there is no dot in the token", () => {
      expect(extractUserIdFromToken("no-dot-here")).toBeNull();
    });

    it("returns null when the dot is at position 0 (empty user id)", () => {
      expect(extractUserIdFromToken(".some-data")).toBeNull();
    });

    it("handles tokens with multiple dots by extracting up to the first dot", () => {
      expect(extractUserIdFromToken("User@456.data.more")).toBe("User@456");
    });
  });

  describe("hashToken", () => {
    it("returns a consistent SHA-256 hex digest for the same input", () => {
      const hash1 = hashToken("my-token");
      const hash2 = hashToken("my-token");

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns different hashes for different inputs", () => {
      const hash1 = hashToken("token-a");
      const hash2 = hashToken("token-b");

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyToken", () => {
    it("returns the decoded payload on a valid token", () => {
      const payload = { id: "User@123", role: "ADMIN", allowedFolders: ["Folder@1"] };
      jwtVerifyMock.mockReturnValue(payload);

      const result = verifyToken("valid-token");

      expect(result).toStrictEqual(payload);
      expect(jwtVerifyMock).toHaveBeenCalledWith("valid-token", "test-secret");
    });

    it("throws UnauthorizedError with expired message on TokenExpiredError", async () => {
      const jwt = await import("jsonwebtoken");
      jwtVerifyMock.mockImplementation(() => {
        throw new (jwt.default.TokenExpiredError as unknown as new (msg: string) => Error)("jwt expired");
      });

      expect(() => verifyToken("expired-token")).toThrow(UnauthorizedError);
      expect(() => verifyToken("expired-token")).toThrow("Access token has expired");
    });

    it("throws UnauthorizedError with invalid message on JsonWebTokenError", async () => {
      const jwt = await import("jsonwebtoken");
      jwtVerifyMock.mockImplementation(() => {
        throw new (jwt.default.JsonWebTokenError as unknown as new (msg: string) => Error)("invalid signature");
      });

      expect(() => verifyToken("tampered-token")).toThrow(UnauthorizedError);
      expect(() => verifyToken("tampered-token")).toThrow("Invalid access token");
    });

    it("re-throws unknown errors without wrapping", () => {
      const unknownError = new TypeError("something broke");
      jwtVerifyMock.mockImplementation(() => {
        throw unknownError;
      });

      expect(() => verifyToken("bad-token")).toThrow(unknownError);
    });
  });
});
