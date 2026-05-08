import {
  ConditionalCheckFailedException,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../src/folders/folder.types.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { CACHE_KEYS } from "../../src/utils/constants/cache.constants.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../src/utils/errors/http.errors.js";

const {
  dynamoSendMock,
  redisDelMock,
  redisGetMock,
  redisSetMock,
  randomIdMock,
  getUploadedObjectsByFolderIdMock,
} = vi.hoisted(() => ({
  dynamoSendMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
  randomIdMock: vi.fn(),
  getUploadedObjectsByFolderIdMock: vi.fn(),
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

vi.mock("../../src/utils/helpers/create-randomId.helper.js", () => ({
  default: {
    getId: randomIdMock,
  },
}));

vi.mock("../../src/objects/object.service.js", () => ({
  getUploadedObjectsByFolderId: getUploadedObjectsByFolderIdMock,
}));

import {
  createFolder,
  deleteFolderById,
  getAllSubFoldersByParentId,
  getFolderById,
  getFoldersByIds,
  listAllMainFolders,
  updateFolderNameById,
  updateParentIdByFolderId,
} from "../../src/folders/folder.service.js";

type CommandWithInput<TInput = Record<string, unknown>> = {
  input: TInput;
};

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
    path: "/folders",
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

describe("folder service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    process.env.FOLDERS_TABLE = "FoldersTable";
    process.env.PARENTID_INDEX = "ParentIdIndex";

    randomIdMock.mockReturnValue("random-id");
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue("OK");
    redisDelMock.mockResolvedValue(1);
    dynamoSendMock.mockResolvedValue({});
    getUploadedObjectsByFolderIdMock.mockResolvedValue({
      objects: [],
      lastEvaluatedKey: undefined,
    });
  });

  describe("createFolder", () => {
    it("creates a root folder and invalidates the main folders cache", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({});

      const result = await createFolder("Documents", null, ctx);

      expect(result).toMatchObject({
        id: "Folder@random-id",
        name: "Documents",
        parentId: "ROOT",
      });
      expect(result.createdAt).toEqual(expect.any(String));
      expect(result.updatedAt).toEqual(expect.any(String));

      expect(dynamoSendMock).toHaveBeenCalledTimes(1);
      expect(commandAt(0)).toBeInstanceOf(PutCommand);
      expect(commandAt(0).input).toMatchObject({
        TableName: "FoldersTable",
        Item: {
          id: "Folder@random-id",
          name: "Documents",
          parentId: "ROOT",
        },
      });
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.MAIN_FOLDERS);
      expect(ctx.db).toStrictEqual({ queriesExecuted: 1, totalDbDurationMs: expect.any(Number) });
      expect(ctx.operations.at(-1)).toMatchObject({ name: "createFolder", result: "success" });
    });

    it("creates a child folder after verifying the parent exists", async () => {
      const parent = makeFolder({ id: "Folder@parent" });
      dynamoSendMock.mockResolvedValueOnce({ Item: parent }).mockResolvedValueOnce({});

      const result = await createFolder("Child", parent.id);

      expect(result.parentId).toBe(parent.id);
      expect(dynamoSendMock).toHaveBeenCalledTimes(2);
      expect(commandAt(0)).toBeInstanceOf(GetCommand);
      expect(commandAt(0).input).toMatchObject({
        TableName: "FoldersTable",
        Key: { id: parent.id },
      });
      expect(commandAt(1)).toBeInstanceOf(PutCommand);
      expect(commandAt(1).input).toMatchObject({
        TableName: "FoldersTable",
        Item: expect.objectContaining({
          id: "Folder@random-id",
          name: "Child",
          parentId: parent.id,
        }),
      });
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.SUB_FOLDERS(parent.id));
    });

    it("throws NotFoundError when the parent folder does not exist", async () => {
      dynamoSendMock.mockResolvedValueOnce({});

      const promise = createFolder("Child", "Folder@missing");

      await expect(promise).rejects.toThrow(NotFoundError);
      await expect(promise).rejects.toThrow(
        "Parent folder with id Folder@missing not found",
      );
    });

    it("maps a missing DynamoDB table to BadRequestError", async () => {
      dynamoSendMock.mockRejectedValueOnce(
        new ResourceNotFoundException({ message: "missing table", $metadata: {} }),
      );

      await expect(createFolder("Documents", null)).rejects.toThrow(BadRequestError);
    });
  });

  describe("getFolderById", () => {
    it("returns a folder from the main folders cache", async () => {
      const folder = makeFolder();
      const ctx = createLogContext();
      redisGetMock.mockResolvedValueOnce(JSON.stringify([folder]));

      const result = await getFolderById(folder.id, [folder.id], ctx);

      expect(result).toStrictEqual(folder);
      expect(redisGetMock).toHaveBeenCalledWith(CACHE_KEYS.MAIN_FOLDERS);
      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(ctx.cache).toStrictEqual({ hits: 1, misses: 0 });
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getFolderById",
        result: "success",
        detail: "cache_hit",
      });
    });

    it("throws ForbiddenError when cached folder access is not allowed", async () => {
      const folder = makeFolder();
      redisGetMock.mockResolvedValueOnce(JSON.stringify([folder]));

      await expect(getFolderById(folder.id, ["Folder@other"])).rejects.toThrow(ForbiddenError);
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("returns a folder from the individual folder cache", async () => {
      const folder = makeFolder({ parentId: "Folder@parent" });
      redisGetMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(folder));

      const result = await getFolderById(folder.id);

      expect(result).toStrictEqual(folder);
      expect(redisGetMock).toHaveBeenNthCalledWith(1, CACHE_KEYS.MAIN_FOLDERS);
      expect(redisGetMock).toHaveBeenNthCalledWith(2, CACHE_KEYS.FOLDER(folder.id));
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("fetches a non-root folder from DynamoDB and caches it", async () => {
      const folder = makeFolder({ parentId: "Folder@parent" });
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({ Item: folder });

      const result = await getFolderById(folder.id, undefined, ctx);

      expect(result).toStrictEqual(folder);
      expect(commandAt(0)).toBeInstanceOf(GetCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "FoldersTable",
        Key: { id: folder.id },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.FOLDER(folder.id),
        JSON.stringify(folder),
        "EX",
        1800,
      );
      expect(ctx.cache).toStrictEqual({ hits: 0, misses: 1 });
      expect(ctx.db).toStrictEqual({ queriesExecuted: 1, totalDbDurationMs: expect.any(Number) });
    });

    it("throws ForbiddenError when a DynamoDB folder is outside allowedFolders", async () => {
      const folder = makeFolder({ id: "Folder@denied", parentId: "Folder@parent" });
      dynamoSendMock.mockResolvedValueOnce({ Item: folder });

      await expect(getFolderById(folder.id, ["Folder@allowed"])).rejects.toThrow(ForbiddenError);
      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.FOLDER(folder.id),
        JSON.stringify(folder),
        "EX",
        1800,
      );
    });

    it("does not cache a root folder fetched from DynamoDB", async () => {
      const folder = makeFolder({ parentId: "ROOT" });
      dynamoSendMock.mockResolvedValueOnce({ Item: folder });

      await expect(getFolderById(folder.id)).resolves.toStrictEqual(folder);

      expect(redisSetMock).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when DynamoDB does not return an item", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({});

      await expect(getFolderById("Folder@missing", undefined, ctx)).rejects.toThrow(
        NotFoundError,
      );
      expect(ctx.operations.at(-1)).toMatchObject({
        name: "getFolderById",
        result: "failure",
        detail: "not_found",
      });
    });
  });

  describe("getFoldersByIds", () => {
    it("returns an empty list when no folder ids are provided", async () => {
      await expect(getFoldersByIds([])).resolves.toStrictEqual([]);
      expect(redisGetMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("returns all requested folders", async () => {
      const folderOne = makeFolder({ id: "Folder@one" });
      const folderTwo = makeFolder({ id: "Folder@two" });
      redisGetMock.mockResolvedValue(JSON.stringify([folderOne, folderTwo]));

      await expect(getFoldersByIds([folderOne.id, folderTwo.id])).resolves.toStrictEqual([
        folderOne,
        folderTwo,
      ]);
    });

    it("throws NotFoundError listing missing folder ids", async () => {
      const existing = makeFolder({ id: "Folder@existing" });
      dynamoSendMock.mockImplementation(async (command: CommandWithInput<{ Key: { id: string } }>) => {
        return command.input.Key.id === existing.id ? { Item: existing } : {};
      });

      await expect(getFoldersByIds([existing.id, "Folder@missing"])).rejects.toThrow(
        "Following folderId's do not exist: Folder@missing",
      );
    });
  });

  describe("listAllMainFolders", () => {
    it("returns filtered main folders from cache", async () => {
      const allowed = makeFolder({ id: "Folder@allowed" });
      const denied = makeFolder({ id: "Folder@denied" });
      redisGetMock.mockResolvedValueOnce(JSON.stringify([allowed, denied]));

      await expect(listAllMainFolders([allowed.id])).resolves.toStrictEqual([allowed]);
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("queries DynamoDB, caches main folders, and returns them", async () => {
      const folder = makeFolder();
      dynamoSendMock.mockResolvedValueOnce({ Items: [folder] });

      await expect(listAllMainFolders(undefined)).resolves.toStrictEqual([folder]);

      expect(commandAt(0)).toBeInstanceOf(QueryCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "FoldersTable",
        IndexName: "ParentIdIndex",
        KeyConditionExpression: "parentId=:parentId",
        ExpressionAttributeValues: {
          ":parentId": "ROOT",
        },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.MAIN_FOLDERS,
        JSON.stringify([folder]),
        "EX",
        1800,
      );
    });

    it("filters DynamoDB main folder results to allowedFolders", async () => {
      const allowed = makeFolder({ id: "Folder@allowed" });
      const denied = makeFolder({ id: "Folder@denied" });
      dynamoSendMock.mockResolvedValueOnce({ Items: [allowed, denied] });

      await expect(listAllMainFolders([allowed.id])).resolves.toStrictEqual([allowed]);

      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.MAIN_FOLDERS,
        JSON.stringify([allowed, denied]),
        "EX",
        1800,
      );
    });
  });

  describe("getAllSubFoldersByParentId", () => {
    it("throws ForbiddenError before querying when parent access is denied", async () => {
      await expect(getAllSubFoldersByParentId("Folder@parent", ["Folder@other"])).rejects.toThrow(
        ForbiddenError,
      );
      expect(redisGetMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the parent folder does not exist", async () => {
      dynamoSendMock.mockResolvedValueOnce({});

      await expect(getAllSubFoldersByParentId("Folder@missing")).rejects.toThrow(
        "ParentId with this Id not found",
      );
    });

    it("returns filtered subfolders from cache", async () => {
      const parent = makeFolder({ id: "Folder@parent" });
      const allowedChild = makeFolder({ id: "Folder@child-allowed", parentId: parent.id });
      const deniedChild = makeFolder({ id: "Folder@child-denied", parentId: parent.id });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([parent]);
        if (key === CACHE_KEYS.SUB_FOLDERS(parent.id)) {
          return JSON.stringify([allowedChild, deniedChild]);
        }
        return null;
      });

      await expect(
        getAllSubFoldersByParentId(parent.id, [parent.id, allowedChild.id]),
      ).resolves.toStrictEqual([allowedChild]);
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("queries DynamoDB, caches subfolders, and returns them", async () => {
      const parent = makeFolder({ id: "Folder@parent" });
      const child = makeFolder({ id: "Folder@child", parentId: parent.id });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([parent]);
        return null;
      });
      dynamoSendMock.mockResolvedValueOnce({ Items: [child] });

      await expect(getAllSubFoldersByParentId(parent.id)).resolves.toStrictEqual([child]);

      expect(commandAt(0)).toBeInstanceOf(QueryCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "FoldersTable",
        IndexName: "ParentIdIndex",
        KeyConditionExpression: "parentId = :parentId",
        ExpressionAttributeValues: {
          ":parentId": parent.id,
        },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.SUB_FOLDERS(parent.id),
        JSON.stringify([child]),
        "EX",
        1800,
      );
    });

    it("filters DynamoDB subfolder results to allowedFolders", async () => {
      const parent = makeFolder({ id: "Folder@parent" });
      const allowedChild = makeFolder({ id: "Folder@child-allowed", parentId: parent.id });
      const deniedChild = makeFolder({ id: "Folder@child-denied", parentId: parent.id });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([parent]);
        return null;
      });
      dynamoSendMock.mockResolvedValueOnce({ Items: [allowedChild, deniedChild] });

      await expect(
        getAllSubFoldersByParentId(parent.id, [parent.id, allowedChild.id]),
      ).resolves.toStrictEqual([allowedChild]);

      expect(redisSetMock).toHaveBeenCalledWith(
        CACHE_KEYS.SUB_FOLDERS(parent.id),
        JSON.stringify([allowedChild, deniedChild]),
        "EX",
        1800,
      );
    });
  });

  describe("updateFolderNameById", () => {
    it("updates a root folder name and invalidates root folder caches", async () => {
      const folder = makeFolder();
      const updatedFolder = { ...folder, name: "Reports" };
      redisGetMock.mockResolvedValueOnce(JSON.stringify([folder]));
      dynamoSendMock.mockResolvedValueOnce({ Attributes: updatedFolder });

      await expect(updateFolderNameById(folder.id, "Reports")).resolves.toStrictEqual(
        updatedFolder,
      );

      expect(commandAt(0)).toBeInstanceOf(UpdateCommand);
      expect(commandAt(0).input).toMatchObject({
        TableName: "FoldersTable",
        Key: { id: folder.id },
        UpdateExpression: "set #name=:name,#updatedAt=:updatedAt",
        ExpressionAttributeValues: {
          ":name": "Reports",
          ":updatedAt": expect.any(String),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      });
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.MAIN_FOLDERS);
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.FOLDER(folder.id));
    });

    it("updates a child folder name and invalidates parent subfolder cache", async () => {
      const folder = makeFolder({ parentId: "Folder@parent" });
      const updatedFolder = { ...folder, name: "Reports" };
      redisGetMock
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify(folder));
      dynamoSendMock.mockResolvedValueOnce({ Attributes: updatedFolder });

      await expect(updateFolderNameById(folder.id, "Reports")).resolves.toStrictEqual(
        updatedFolder,
      );

      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.SUB_FOLDERS("Folder@parent"));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.FOLDER(folder.id));
    });

    it("throws a clearer NotFoundError when the folder does not exist", async () => {
      dynamoSendMock.mockResolvedValueOnce({});

      await expect(updateFolderNameById("Folder@missing", "Reports")).rejects.toThrow(
        "Failed to update as folder with the id not found",
      );
    });
  });

  describe("updateParentIdByFolderId", () => {
    it("updates the parent id and invalidates old, new, folder, and main caches", async () => {
      const newParent = makeFolder({ id: "Folder@new-parent" });
      const updatedFolder = makeFolder({
        id: "Folder@child",
        parentId: newParent.id,
      });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.FOLDER(newParent.id)) return JSON.stringify(newParent);
        return null;
      });
      dynamoSendMock.mockResolvedValueOnce({ Attributes: updatedFolder });

      await expect(
        updateParentIdByFolderId(updatedFolder.id, "ROOT", newParent.id),
      ).resolves.toStrictEqual(updatedFolder);

      expect(commandAt(0)).toBeInstanceOf(UpdateCommand);
      expect(commandAt(0).input).toMatchObject({
        TableName: "FoldersTable",
        Key: { id: updatedFolder.id },
        UpdateExpression: "set #parentId = :parentId , #updatedAt=:updatedAt",
        ExpressionAttributeValues: {
          ":parentId": newParent.id,
          ":updatedAt": expect.any(String),
        },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_NEW",
      });
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.SUB_FOLDERS("ROOT"));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.SUB_FOLDERS(newParent.id));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.FOLDER(updatedFolder.id));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.MAIN_FOLDERS);
    });

    it("maps a conditional update failure to NotFoundError", async () => {
      const newParent = makeFolder({ id: "Folder@new-parent" });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.FOLDER(newParent.id)) return JSON.stringify(newParent);
        return null;
      });
      dynamoSendMock.mockRejectedValueOnce(conditionalCheckFailed());

      await expect(
        updateParentIdByFolderId("Folder@missing", "ROOT", newParent.id),
      ).rejects.toThrow("Folder with the requested Id not found");
    });
  });

  describe("deleteFolderById", () => {
    it("deletes an empty root folder and invalidates folder caches", async () => {
      const folder = makeFolder();
      const ctx = createLogContext();
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([folder]);
        if (key === CACHE_KEYS.SUB_FOLDERS(folder.id)) return "[]";
        return null;
      });
      dynamoSendMock.mockResolvedValueOnce({ Attributes: folder });

      await expect(deleteFolderById(folder.id, ctx)).resolves.toStrictEqual(folder);

      expect(getUploadedObjectsByFolderIdMock).toHaveBeenCalledWith(folder.id, undefined, ctx);
      expect(commandAt(0)).toBeInstanceOf(DeleteCommand);
      expect(commandAt(0).input).toStrictEqual({
        TableName: "FoldersTable",
        Key: { id: folder.id },
        ConditionExpression: "attribute_exists(id)",
        ReturnValues: "ALL_OLD",
      });
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.FOLDER(folder.id));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.SUB_FOLDERS(folder.id));
      expect(redisDelMock).toHaveBeenCalledWith(CACHE_KEYS.MAIN_FOLDERS);
      expect(ctx.operations.at(-1)).toMatchObject({ name: "deleteFolderById", result: "success" });
    });

    it("rejects deletion when the folder still contains subfolders", async () => {
      const folder = makeFolder();
      const child = makeFolder({ id: "Folder@child", parentId: folder.id });
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([folder]);
        if (key === CACHE_KEYS.SUB_FOLDERS(folder.id)) return JSON.stringify([child]);
        return null;
      });

      const promise = deleteFolderById(folder.id);

      await expect(promise).rejects.toThrow(BadRequestError);
      await expect(promise).rejects.toThrow("Folder contains sub folders");
      expect(getUploadedObjectsByFolderIdMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("rejects deletion when the folder still contains uploaded objects", async () => {
      const folder = makeFolder();
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([folder]);
        if (key === CACHE_KEYS.SUB_FOLDERS(folder.id)) return "[]";
        return null;
      });
      getUploadedObjectsByFolderIdMock.mockResolvedValueOnce({
        objects: [{ id: "Object@123" }],
        lastEvaluatedKey: undefined,
      });

      const promise = deleteFolderById(folder.id);

      await expect(promise).rejects.toThrow(BadRequestError);
      await expect(promise).rejects.toThrow("Folder contains objects");
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("maps a conditional delete failure to NotFoundError", async () => {
      const folder = makeFolder();
      redisGetMock.mockImplementation(async (key: string) => {
        if (key === CACHE_KEYS.MAIN_FOLDERS) return JSON.stringify([folder]);
        if (key === CACHE_KEYS.SUB_FOLDERS(folder.id)) return "[]";
        return null;
      });
      dynamoSendMock.mockRejectedValueOnce(conditionalCheckFailed());

      await expect(deleteFolderById(folder.id)).rejects.toThrow("Folder with the id is not found");
    });
  });
});
