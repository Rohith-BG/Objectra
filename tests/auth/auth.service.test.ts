import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, PutCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { RefreshTokenItem } from "../../src/auth/auth.types.js";
import type { User } from "../../src/users/user.type.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { NotFoundError, UnauthorizedError } from "../../src/utils/errors/http.errors.js";

const {
  bcryptCompareMock,
  dynamoSendMock,
  generateAccessTokenMock,
  generateOpaqueTokenMock,
  getUserByIdMock,
  getUserByNameMock,
  hashTokenMock,
  extractUserIdMock,
  randomIdMock,
} = vi.hoisted(() => ({
  bcryptCompareMock: vi.fn(),
  dynamoSendMock: vi.fn(),
  generateAccessTokenMock: vi.fn(),
  generateOpaqueTokenMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  getUserByNameMock: vi.fn(),
  hashTokenMock: vi.fn(),
  extractUserIdMock: vi.fn(),
  randomIdMock: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: bcryptCompareMock,
  },
}));

vi.mock("../../src/configs/dynamoDb.client.js", () => ({
  default: {
    send: dynamoSendMock,
  },
}));

vi.mock("../../src/users/user.service.js", () => ({
  getUserById: getUserByIdMock,
  getUserByName: getUserByNameMock,
}));

vi.mock("../../src/utils/jwt/jwt.utils.js", () => ({
  generateAccessToken: generateAccessTokenMock,
  generateOpaqueToken: generateOpaqueTokenMock,
  hashToken: hashTokenMock,
  extractUserIdFromToken: extractUserIdMock,
}));

vi.mock("../../src/utils/helpers/create-randomId.helper.js", () => ({
  default: {
    getId: randomIdMock,
  },
}));

import {
  getAcessAndRefreshToken,
  refreshAcessToken,
  revokeAllUserSessions,
  revokeRefreshToken,
} from "../../src/auth/auth.service.js";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "User@123",
    name: "alice",
    password: "hashed-password",
    role: "READ_ONLY",
    allowedFolders: ["Folder@123"],
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeRefreshTokenItem(overrides: Partial<RefreshTokenItem> = {}): RefreshTokenItem {
  return {
    id: "RefreshToken@abc",
    userId: "User@123",
    refreshToken: "hashed-refresh-token",
    createdAt: "2026-05-02T00:00:00.000Z",
    ttl: Math.floor(Date.now() / 1000) + 86400,
    ...overrides,
  };
}

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "POST",
    path: "/auth",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

describe("auth service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    process.env.REFRESHTOKENS_TABLE = "RefreshTokensTable";
    process.env.REFRESHTOKEN_INDEX = "RefreshTokenIndex";
    process.env.REFRESHTOKEN_USERID_INDEX = "UserIdIndex";
    process.env.REFRESHTOKEN_TTL = "86400";
    process.env.JWT_SECRET = "test-secret";

    bcryptCompareMock.mockResolvedValue(true);
    dynamoSendMock.mockResolvedValue({});
    generateAccessTokenMock.mockReturnValue("access-token");
    generateOpaqueTokenMock.mockReturnValue("User@123.opaque-token");
    getUserByIdMock.mockResolvedValue(makeUser());
    getUserByNameMock.mockResolvedValue(makeUser());
    hashTokenMock.mockReturnValue("hashed-refresh-token");
    extractUserIdMock.mockReturnValue("User@123");
    randomIdMock.mockReturnValue("random-id");
  });

  describe("getAcessAndRefreshToken", () => {
    it("returns access and refresh tokens for valid credentials", async () => {
      const result = await getAcessAndRefreshToken("alice", "Password1!");

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("User@123.opaque-token");
      expect(getUserByNameMock).toHaveBeenCalledWith("alice", undefined);
      expect(bcryptCompareMock).toHaveBeenCalledWith("Password1!", "hashed-password");
      expect(generateAccessTokenMock).toHaveBeenCalledWith({
        id: "User@123",
        role: "READ_ONLY",
        allowedFolders: ["Folder@123"],
      });
    });

    it("records success in canonical log context", async () => {
      const ctx = createLogContext();

      await getAcessAndRefreshToken("alice", "Password1!", ctx);

      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getAccessAndRefreshToken",
        result: "success",
      });
    });

    it("throws UnauthorizedError when the user is not found", async () => {
      getUserByNameMock.mockResolvedValue(null);

      await expect(getAcessAndRefreshToken("unknown", "Password1!")).rejects.toThrow(
        UnauthorizedError,
      );
      await expect(getAcessAndRefreshToken("unknown", "Password1!")).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("throws UnauthorizedError when the password is invalid", async () => {
      bcryptCompareMock.mockResolvedValue(false);

      await expect(getAcessAndRefreshToken("alice", "WrongPass1!")).rejects.toThrow(
        UnauthorizedError,
      );
    });

    it("records failure in canonical log context on error", async () => {
      getUserByNameMock.mockResolvedValue(null);
      const ctx = createLogContext();

      await expect(getAcessAndRefreshToken("alice", "p", ctx)).rejects.toThrow();

      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getAccessAndRefreshToken",
        result: "failure",
      });
    });

    it("saves the refresh token to DynamoDB", async () => {
      await getAcessAndRefreshToken("alice", "Password1!");

      expect(dynamoSendMock).toHaveBeenCalledTimes(1);
      const command = dynamoSendMock.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutCommand);
      expect(command.input.TableName).toBe("RefreshTokensTable");
      expect(command.input.Item).toMatchObject({
        id: "RefreshToken@random-id",
        userId: "User@123",
        refreshToken: "hashed-refresh-token",
      });
    });
  });

  describe("refreshAcessToken", () => {
    it("rotates the refresh token and returns new access and refresh tokens", async () => {
      const item = makeRefreshTokenItem();
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [item] })
        .mockResolvedValueOnce({});

      const result = await refreshAcessToken("User@123.opaque-token");

      expect(result.accessToken).toBe("access-token");
      expect(result.newRefreshToken).toBe("User@123.opaque-token");
      expect(result.expiresAt).toBe(item.ttl);
    });

    it("throws UnauthorizedError for token reuse when sessions exist", async () => {
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [makeRefreshTokenItem()] })
        .mockResolvedValueOnce({});

      await expect(refreshAcessToken("User@123.opaque-token")).rejects.toThrow(
        "Token reuse detected , all sessions revoked",
      );
    });

    it("throws UnauthorizedError for expired session when no sessions exist", async () => {
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [] })
        .mockResolvedValueOnce({ Items: [] });

      await expect(refreshAcessToken("User@123.opaque-token")).rejects.toThrow(
        "Session expired",
      );
    });

    it("throws UnauthorizedError when user id cannot be extracted", async () => {
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });
      extractUserIdMock.mockReturnValue(null);

      await expect(refreshAcessToken("bad-token")).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("throws UnauthorizedError when the token TTL has expired", async () => {
      const expired = makeRefreshTokenItem({ ttl: Math.floor(Date.now() / 1000) - 100 });
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [expired] })
        .mockResolvedValueOnce({});

      await expect(refreshAcessToken("User@123.opaque-token")).rejects.toThrow(
        "Session expired",
      );
    });

    it("throws UnauthorizedError when the user no longer exists", async () => {
      const item = makeRefreshTokenItem();
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [item] })
        .mockResolvedValueOnce({});
      getUserByIdMock.mockResolvedValue(null);

      await expect(refreshAcessToken("User@123.opaque-token")).rejects.toThrow(
        "User not found - login again",
      );
    });
  });

  describe("revokeRefreshToken", () => {
    it("returns SUCCESS when a matching token is found and deleted", async () => {
      const item = makeRefreshTokenItem();
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [item] })
        .mockResolvedValueOnce({});

      const result = await revokeRefreshToken("User@123.opaque-token");

      expect(result).toStrictEqual({ status: "SUCCESS" });
    });

    it("returns ALREADY_LOGGED_OUT when no matching token is found", async () => {
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });

      const result = await revokeRefreshToken("User@123.opaque-token");

      expect(result).toStrictEqual({ status: "ALREADY_LOGGED_OUT" });
    });

    it("records operations in canonical log context", async () => {
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });
      const ctx = createLogContext();

      await revokeRefreshToken("User@123.opaque-token", ctx);

      expect(ctx.operations).toContainEqual(
        expect.objectContaining({ name: "revokeRefreshToken", result: "skipped" }),
      );
    });
  });

  describe("revokeAllUserSessions", () => {
    it("deletes all user sessions from DynamoDB", async () => {
      const sessions = [
        makeRefreshTokenItem({ id: "RT@1" }),
        makeRefreshTokenItem({ id: "RT@2" }),
      ];
      dynamoSendMock
        .mockResolvedValueOnce({ Items: sessions })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await revokeAllUserSessions("User@123");

      expect(dynamoSendMock).toHaveBeenCalledTimes(3);
    });

    it("skips deletion when no sessions exist", async () => {
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });
      const ctx = createLogContext();

      await revokeAllUserSessions("User@123", ctx);

      expect(dynamoSendMock).toHaveBeenCalledTimes(1);
      expect(ctx.operations).toContainEqual(
        expect.objectContaining({ name: "revokeAllUserSessions", result: "skipped" }),
      );
    });
  });
});
