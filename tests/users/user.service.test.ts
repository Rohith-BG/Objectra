import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../src/folders/folder.types.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import type { User } from "../../src/users/user.type.js";
import { USER_CACHE } from "../../src/utils/constants/cache.constants.js";
import { BadRequestError } from "../../src/utils/errors/badrequest.error.js";
import { ForbiddenError } from "../../src/utils/errors/forbidden.error.js";
import { NotFoundError } from "../../src/utils/errors/notfound.error.js";

const {
  bcryptHashMock,
  dynamoSendMock,
  getFoldersByIdsMock,
  randomIdMock,
  redisDelMock,
  redisGetMock,
  redisSetMock,
} = vi.hoisted(() => ({
  bcryptHashMock: vi.fn(),
  dynamoSendMock: vi.fn(),
  getFoldersByIdsMock: vi.fn(),
  randomIdMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: bcryptHashMock,
  },
}));

vi.mock("../../src/configs/dynamoDb.client.js", () => ({
  default: {
    send: dynamoSendMock,
  },
}));

vi.mock("../../src/configs/redis.client.js", () => ({
  default: {
    del: redisDelMock,
    get: redisGetMock,
    set: redisSetMock,
  },
}));

vi.mock("../../src/folders/folder.service.js", () => ({
  getFoldersByIds: getFoldersByIdsMock,
}));

vi.mock("../../src/utils/helpers/create-randomId.helper.js", () => ({
  default: {
    getId: randomIdMock,
  },
}));

import {
  createUser,
  deleteUserById,
  getUserById,
  getUserByName,
  updateUserPasswordById,
} from "../../src/users/user.service.js";

type CommandWithInput<TInput = Record<string, unknown>> = {
  input: TInput;
};

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

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "Folder@123",
    name: "Documents",
    parentId: "ROOT",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    ...overrides,
  };
}

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "GET",
    path: "/users",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function commandAt<TInput = Record<string, unknown>>(index: number): CommandWithInput<TInput> {
  return dynamoSendMock.mock.calls[index][0] as CommandWithInput<TInput>;
}

function conditionalCheckFailed() {
  return new ConditionalCheckFailedException({
    message: "conditional check failed",
    $metadata: {},
  });
}

describe("user service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    process.env.USERS_TABLE = "UsersTable";
    process.env.USERNAME_INDEX = "UsernameIndex";

    bcryptHashMock.mockResolvedValue("hashed-password");
    dynamoSendMock.mockResolvedValue({});
    getFoldersByIdsMock.mockResolvedValue([makeFolder()]);
    randomIdMock.mockReturnValue("random-id");
    redisDelMock.mockResolvedValue(1);
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue("OK");
  });

  describe("createUser", () => {
    it("rejects attempts to create an admin user before checking username or folders", async () => {
      const ctx = createLogContext();

      await expect(
        createUser(
          {
            name: "admin-user",
            password: "Password1!",
            role: "ADMIN",
            allowedFolders: ["Folder@123"],
          },
          ctx,
        ),
      ).rejects.toThrow(ForbiddenError);

      expect(redisGetMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(getFoldersByIdsMock).not.toHaveBeenCalled();
      expect(ctx.operations.at(-1)).toMatchObject({ name: "createUser", result: "failure" });
    });

    it("rejects duplicate usernames found in cache", async () => {
      const existingUser = makeUser();
      redisGetMock.mockResolvedValueOnce(JSON.stringify(existingUser));

      await expect(
        createUser({
          name: existingUser.name,
          password: "Password1!",
          role: "READ_ONLY",
          allowedFolders: ["Folder@123"],
        }),
      ).rejects.toThrow(BadRequestError);

      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(getFoldersByIdsMock).not.toHaveBeenCalled();
      expect(bcryptHashMock).not.toHaveBeenCalled();
    });

    it("validates allowed folders, hashes the password, stores the user, and omits password", async () => {
      const ctx = createLogContext();
      redisGetMock.mockResolvedValueOnce(null);
      dynamoSendMock.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});

      const result = await createUser(
        {
          name: "alice",
          password: "Password1!",
          role: "READ_WRITE",
          allowedFolders: ["Folder@123"],
        },
        ctx,
      );

      expect(getFoldersByIdsMock).toHaveBeenCalledWith(["Folder@123"], ctx);
      expect(bcryptHashMock).toHaveBeenCalledWith("Password1!", 12);
      expect(commandAt(0)).toBeInstanceOf(QueryCommand);
      expect(commandAt(1)).toBeInstanceOf(PutCommand);
      expect(commandAt(1).input).toMatchObject({
        TableName: "UsersTable",
        Item: {
          id: "User@random-id",
          name: "alice",
          password: "hashed-password",
          role: "READ_WRITE",
          allowedFolders: ["Folder@123"],
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(result).toStrictEqual({
        id: "User@random-id",
        name: "alice",
        role: "READ_WRITE",
        allowedFolders: ["Folder@123"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(ctx.operations.at(-1)).toMatchObject({ name: "createUser", result: "success" });
    });

    it("propagates folder validation failures before hashing or writing", async () => {
      const error = new NotFoundError("Following folderId's do not exist: Folder@missing");
      redisGetMock.mockResolvedValueOnce(null);
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });
      getFoldersByIdsMock.mockRejectedValueOnce(error);

      await expect(
        createUser({
          name: "alice",
          password: "Password1!",
          role: "READ_ONLY",
          allowedFolders: ["Folder@missing"],
        }),
      ).rejects.toThrow(error);

      expect(bcryptHashMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getUserByName", () => {
    it("returns a cached user without querying DynamoDB", async () => {
      const cachedUser = {
        id: "User@123",
        name: "alice",
        role: "READ_ONLY",
        allowedFolders: ["Folder@123"],
        createdAt: "2026-05-02T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      };
      const ctx = createLogContext();
      redisGetMock.mockResolvedValueOnce(JSON.stringify(cachedUser));

      await expect(getUserByName("alice", ctx)).resolves.toStrictEqual(cachedUser);

      expect(redisGetMock).toHaveBeenCalledWith(USER_CACHE.USERNAME("alice"));
      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(ctx.cache).toStrictEqual({ hits: 1, misses: 0 });
    });

    it("queries DynamoDB by username, caches the user without password, and returns the DB user", async () => {
      const user = makeUser();
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({ Items: [user] });

      await expect(getUserByName("alice", ctx)).resolves.toStrictEqual(user);

      expect(commandAt(0)).toBeInstanceOf(QueryCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "UsersTable",
        IndexName: "UsernameIndex",
        KeyConditionExpression: "#name = :name",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": "alice",
        },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        expect.any(String),
        JSON.stringify({
          id: user.id,
          name: user.name,
          role: user.role,
          allowedFolders: user.allowedFolders,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }),
        "EX",
        USER_CACHE.USER_TTL,
      );
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getUserByName",
        result: "success",
        detail: "fetched_from_db",
      });
    });

    it("returns null when the username does not exist", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });

      await expect(getUserByName("missing", ctx)).resolves.toBeNull();

      expect(redisSetMock).not.toHaveBeenCalled();
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getUserByName",
        result: "skipped",
        detail: "not_found",
      });
    });
  });

  describe("getUserById", () => {
    it("returns a cached user without querying DynamoDB", async () => {
      const cachedUser = {
        id: "User@123",
        name: "alice",
        role: "READ_ONLY",
        allowedFolders: ["Folder@123"],
        createdAt: "2026-05-02T00:00:00.000Z",
        updatedAt: "2026-05-02T00:00:00.000Z",
      };
      const ctx = createLogContext();
      redisGetMock.mockResolvedValueOnce(JSON.stringify(cachedUser));

      await expect(getUserById("User@123", ctx)).resolves.toStrictEqual(cachedUser);

      expect(redisGetMock).toHaveBeenCalledWith(USER_CACHE.USERID("User@123"));
      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(ctx.cache).toStrictEqual({ hits: 1, misses: 0 });
    });

    it("fetches a user from DynamoDB, caches it, and omits password from the return value", async () => {
      const user = makeUser();
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({ Item: user });

      await expect(getUserById(user.id, ctx)).resolves.toStrictEqual({
        id: user.id,
        name: user.name,
        role: user.role,
        allowedFolders: user.allowedFolders,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });

      expect(commandAt(0)).toBeInstanceOf(GetCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "UsersTable",
        Key: { id: user.id },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        USER_CACHE.USERID(user.id),
        JSON.stringify(user),
        "EX",
        USER_CACHE.USER_TTL,
      );
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getUserById",
        result: "success",
        detail: "fetched_from_db",
      });
    });

    it("throws NotFoundError when DynamoDB does not return a user", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({});

      const promise = getUserById("User@missing", ctx);

      await expect(promise).rejects.toThrow(NotFoundError);
      await expect(promise).rejects.toThrow("User with userId:User@missing not found");
    });
  });

  describe("updateUserPasswordById", () => {
    it("hashes the new password, updates DynamoDB, and invalidates user caches", async () => {
      const ctx = createLogContext();
      const updatedUser = makeUser({ name: "alice" });
      dynamoSendMock.mockResolvedValueOnce({ Attributes: updatedUser });

      await expect(updateUserPasswordById("User@123", "NewPass1!", ctx)).resolves.toBeUndefined();

      expect(bcryptHashMock).toHaveBeenCalledWith("NewPass1!", 12);
      expect(commandAt(0)).toBeInstanceOf(UpdateCommand);
      expect(commandAt(0).input).toMatchObject({
        TableName: "UsersTable",
        Key: { id: "User@123" },
        UpdateExpression: "Set password = :password , updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":password": "hashed-password",
          ":updatedAt": expect.any(String),
        },
        ConditionExpression: "attribute_exists(id)",
      });
      expect(redisDelMock).toHaveBeenCalledWith(USER_CACHE.USERID("User@123"));
      expect(redisDelMock).toHaveBeenCalledWith(USER_CACHE.USERNAME("alice"));
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "updateUserPasswordById",
        result: "success",
      });
    });

    it("maps update failures to NotFoundError", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockRejectedValueOnce(new Error("write failed"));

      await expect(updateUserPasswordById("User@missing", "NewPass1!", ctx)).rejects.toThrow(
        "User with the userId:User@missing not found",
      );
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "updateUserPasswordById",
        result: "failure",
      });
    });
  });

  describe("deleteUserById", () => {
    it("deletes the user, invalidates caches, and returns the deleted user", async () => {
      const ctx = createLogContext();
      const user = makeUser();
      dynamoSendMock.mockResolvedValueOnce({ Attributes: user });

      await expect(deleteUserById(user.id, ctx)).resolves.toStrictEqual(user);

      expect(commandAt(0)).toBeInstanceOf(DeleteCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "UsersTable",
        Key: { id: user.id },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_OLD",
      });
      expect(redisDelMock).toHaveBeenCalledWith(USER_CACHE.USERID(user.id));
      expect(redisDelMock).toHaveBeenCalledWith(USER_CACHE.USERNAME(user.name));
      expect(ctx.operations.at(-1)).toMatchObject({ name: "deleteUserById", result: "success" });
    });

    it("maps conditional delete failures to NotFoundError", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockRejectedValueOnce(conditionalCheckFailed());

      await expect(deleteUserById("User@missing", ctx)).rejects.toThrow(
        "User with the id:User@missing not exists to delete",
      );
      expect(ctx.operations.at(-1)).toMatchObject({ name: "deleteUserById", result: "failure" });
    });

    it("propagates non-conditional delete failures", async () => {
      const error = new Error("delete failed");
      dynamoSendMock.mockRejectedValueOnce(error);

      await expect(deleteUserById("User@123")).rejects.toThrow(error);
    });
  });
});
