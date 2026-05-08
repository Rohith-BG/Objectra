import { ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import {
  DescribeExecutionCommand,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "../../src/folders/folder.types.js";
import { UploadStatus, type Object as CloudObject } from "../../src/objects/object.types.js";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import { OBJECT_CACHE } from "../../src/utils/constants/cache.constants.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../src/utils/errors/http.errors.js";
import { StepFunctionExecutionError } from "../../src/utils/errors/stepFunctionExecution.error.js";

const {
  acquireLockMock,
  computeDurationMock,
  cursorDecodeMock,
  cursorEncodeMock,
  dynamoSendMock,
  generateGetObjectPresignedURLMock,
  generatePutObjectPresignedURLMock,
  getFolderByIdMock,
  randomIdMock,
  redisDelMock,
  redisGetMock,
  redisSetMock,
  releaseLockMock,
  sleepMock,
  stepFunctionSendMock,
  toExecutionStatusMock,
} = vi.hoisted(() => ({
  acquireLockMock: vi.fn(),
  computeDurationMock: vi.fn(),
  cursorDecodeMock: vi.fn(),
  cursorEncodeMock: vi.fn(),
  dynamoSendMock: vi.fn(),
  generateGetObjectPresignedURLMock: vi.fn(),
  generatePutObjectPresignedURLMock: vi.fn(),
  getFolderByIdMock: vi.fn(),
  randomIdMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSetMock: vi.fn(),
  releaseLockMock: vi.fn(),
  sleepMock: vi.fn(),
  stepFunctionSendMock: vi.fn(),
  toExecutionStatusMock: vi.fn(),
}));

vi.mock("../../src/configs/dynamoDb.client.js", () => ({
  default: {
    send: dynamoSendMock,
  },
}));

vi.mock("../../src/configs/stepFunction.client.js", () => ({
  default: {
    send: stepFunctionSendMock,
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
  getFolderById: getFolderByIdMock,
}));

vi.mock("../../src/utils/helpers/create-randomId.helper.js", () => ({
  default: {
    getId: randomIdMock,
  },
}));

vi.mock("../../src/utils/S3-PresignedUrl/putObject.js", () => ({
  generatePutObjectPresignedURL: generatePutObjectPresignedURLMock,
}));

vi.mock("../../src/utils/S3-PresignedUrl/getObject.js", () => ({
  generateGetObjectPresignedURL: generateGetObjectPresignedURLMock,
}));

vi.mock("../../src/utils/helpers/cursorCodec.helper.js", () => ({
  default: {
    decode: cursorDecodeMock,
    encode: cursorEncodeMock,
  },
}));

vi.mock("../../src/utils/helpers/redisLock.helper.js", () => ({
  acquireLock: acquireLockMock,
  releaseLock: releaseLockMock,
}));

vi.mock("../../src/utils/helpers/stepFunction.helpers.js", () => ({
  computeDuration: computeDurationMock,
  sleep: sleepMock,
  toExecutionStatus: toExecutionStatusMock,
}));

import {
  deleteObjectById,
  fetchPendingObjectsByFolderId,
  getObjectPresignedURL,
  getPresignedUrlForPendingUploads,
  getPutObjectPresignedURL,
  getUploadedObjectsByFolderId,
} from "../../src/objects/object.service.js";

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

function makeObject(overrides: Partial<CloudObject> = {}): CloudObject {
  return {
    id: "Object@123",
    name: "image.png",
    key: "image.png@key",
    folderId: "Folder@123",
    status: UploadStatus.uploaded,
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    ...overrides,
  };
}

function createLogContext(): CanonicalLogContext {
  return {
    requestId: "req-123",
    method: "GET",
    path: "/objects",
    ip: "127.0.0.1",
    userAgent: "vitest",
    operations: [],
  };
}

function dynamoCommandAt<TInput = Record<string, unknown>>(index: number): CommandWithInput<TInput> {
  return dynamoSendMock.mock.calls[index]?.[0] as CommandWithInput<TInput>;
}

function stepFunctionCommandAt<TInput = Record<string, unknown>>(
  index: number,
): CommandWithInput<TInput> {
  return stepFunctionSendMock.mock.calls[index]?.[0] as CommandWithInput<TInput>;
}

describe("object service", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    process.env.OBJECTS_TABLE = "ObjectsTable";
    process.env.FOLDER_NAME_INDEX = "FolderNameIndex";
    process.env.FOLDERID_INDEX = "FolderIdIndex";
    process.env.AWS_STEPFUNCTION_ARN = "arn:aws:states:local:123:stateMachine:deleteObject";

    acquireLockMock.mockResolvedValue("lock-value");
    computeDurationMock.mockImplementation(
      (startDate: Date | undefined, stopDate: Date | undefined, fallbackMs: number) => {
        return startDate && stopDate ? stopDate.getTime() - startDate.getTime() : fallbackMs;
      },
    );
    cursorDecodeMock.mockReturnValue({ id: "cursor-start" });
    cursorEncodeMock.mockReturnValue("encoded-next-cursor");
    dynamoSendMock.mockResolvedValue({});
    generateGetObjectPresignedURLMock.mockResolvedValue("https://get-url.test");
    generatePutObjectPresignedURLMock.mockResolvedValue("https://put-url.test");
    getFolderByIdMock.mockResolvedValue(makeFolder());
    randomIdMock.mockReturnValue("random-id");
    redisDelMock.mockResolvedValue(1);
    redisGetMock.mockResolvedValue(null);
    redisSetMock.mockResolvedValue("OK");
    releaseLockMock.mockResolvedValue(true);
    sleepMock.mockResolvedValue(undefined);
    stepFunctionSendMock.mockResolvedValue({});
    toExecutionStatusMock.mockImplementation((raw: string | undefined) => {
      if (!raw) {
        throw new Error("missing status");
      }
      return raw;
    });
  });

  describe("getPutObjectPresignedURL", () => {
    it("creates a pending object for a new upload and returns a put presigned URL", async () => {
      const ctx = createLogContext();
      dynamoSendMock.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});

      const result = await getPutObjectPresignedURL(
        "image.png",
        "Folder@123",
        ["Folder@123"],
        ctx,
      );

      expect(result).toBe("https://put-url.test");
      expect(getFolderByIdMock).toHaveBeenNthCalledWith(
        1,
        "Folder@123",
        ["Folder@123"],
        ctx,
      );
      expect(getFolderByIdMock).toHaveBeenNthCalledWith(2, "Folder@123", undefined, ctx);
      expect(acquireLockMock).toHaveBeenCalledWith("lock:putObject:Folder@123:image.png");
      expect(dynamoCommandAt(0)).toBeInstanceOf(QueryCommand);
      expect(dynamoCommandAt(0).input).toStrictEqual({
        TableName: "ObjectsTable",
        IndexName: "FolderNameIndex",
        KeyConditionExpression: "folderId = :fid AND #name = :name",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":fid": "Folder@123",
          ":name": "image.png",
        },
        Limit: 1,
      });
      expect(dynamoCommandAt(1)).toBeInstanceOf(PutCommand);
      expect(dynamoCommandAt(1).input).toMatchObject({
        TableName: "ObjectsTable",
        Item: {
          id: "Object@random-id",
          key: "image.png@random-id",
          folderId: "Folder@123",
          name: "image.png",
          status: UploadStatus.pending,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(releaseLockMock).toHaveBeenCalledWith(
        "lock:putObject:Folder@123:image.png",
        "lock-value",
      );
      expect(generatePutObjectPresignedURLMock).toHaveBeenCalledWith("image.png@random-id");
      expect(ctx.s3).toStrictEqual({ presignedUrlsGenerated: 1 });
    });

    it("reuses an existing pending object instead of creating another item", async () => {
      const pendingObject = makeObject({
        key: "existing-key",
        status: UploadStatus.pending,
      });
      dynamoSendMock.mockResolvedValueOnce({ Items: [pendingObject] });

      await expect(
        getPutObjectPresignedURL("image.png", "Folder@123", ["Folder@123"]),
      ).resolves.toBe("https://put-url.test");

      expect(dynamoSendMock).toHaveBeenCalledTimes(1);
      expect(generatePutObjectPresignedURLMock).toHaveBeenCalledWith("existing-key");
      expect(releaseLockMock).toHaveBeenCalledWith(
        "lock:putObject:Folder@123:image.png",
        "lock-value",
      );
    });

    it("rejects duplicate uploaded object names and releases the lock", async () => {
      const uploadedObject = makeObject({ status: UploadStatus.uploaded });
      dynamoSendMock.mockResolvedValueOnce({ Items: [uploadedObject] });

      const promise = getPutObjectPresignedURL("image.png", "Folder@123", ["Folder@123"]);

      await expect(promise).rejects.toThrow(ConflictError);
      await expect(promise).rejects.toThrow(
        'An object with the name "image.png" already exists in this folder.',
      );
      expect(releaseLockMock).toHaveBeenCalledWith(
        "lock:putObject:Folder@123:image.png",
        "lock-value",
      );
    });

    it("rejects lock contention before querying for existing objects", async () => {
      acquireLockMock.mockResolvedValueOnce(null);

      await expect(
        getPutObjectPresignedURL("image.png", "Folder@123", ["Folder@123"]),
      ).rejects.toThrow(ConflictError);

      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(generatePutObjectPresignedURLMock).not.toHaveBeenCalled();
      expect(releaseLockMock).not.toHaveBeenCalled();
    });

    it("does not acquire a lock when folder access is denied", async () => {
      getFolderByIdMock.mockRejectedValueOnce(
        new ForbiddenError("Access denied: You do not have permission to access folder 'Folder@123'"),
      );

      await expect(
        getPutObjectPresignedURL("image.png", "Folder@123", ["Folder@other"]),
      ).rejects.toThrow(ForbiddenError);

      expect(acquireLockMock).not.toHaveBeenCalled();
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("maps object table ResourceNotFoundException to BadRequestError and releases the lock", async () => {
      dynamoSendMock
        .mockResolvedValueOnce({ Items: [] })
        .mockRejectedValueOnce(
          new ResourceNotFoundException({ message: "missing table", $metadata: {} }),
        );

      await expect(
        getPutObjectPresignedURL("image.png", "Folder@123", ["Folder@123"]),
      ).rejects.toThrow(BadRequestError);
      expect(releaseLockMock).toHaveBeenCalledWith(
        "lock:putObject:Folder@123:image.png",
        "lock-value",
      );
    });
  });

  describe("getObjectPresignedURL", () => {
    it("returns a cached get presigned URL without loading the object", async () => {
      redisGetMock.mockResolvedValueOnce("https://cached-get-url.test");

      await expect(
        getObjectPresignedURL("Object@123", ["Folder@123"]),
      ).resolves.toBe("https://cached-get-url.test");

      expect(redisGetMock).toHaveBeenCalledWith(
        OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL("Object@123"),
      );
      expect(dynamoSendMock).not.toHaveBeenCalled();
      expect(generateGetObjectPresignedURLMock).not.toHaveBeenCalled();
    });

    it("loads an uploaded object from cache, generates a get URL, and caches it", async () => {
      const object = makeObject({ status: UploadStatus.uploaded });
      redisGetMock.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(object));

      await expect(
        getObjectPresignedURL("Object@123", ["Folder@123"]),
      ).resolves.toBe("https://get-url.test");

      expect(generateGetObjectPresignedURLMock).toHaveBeenCalledWith(object.key);
      expect(redisSetMock).toHaveBeenCalledWith(
        OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL("Object@123"),
        "https://get-url.test",
        "EX",
        OBJECT_CACHE.PRESIGNED_URL_TTL,
      );
      expect(dynamoSendMock).not.toHaveBeenCalled();
    });

    it("loads an uploaded object from DynamoDB, caches the object, and caches the URL", async () => {
      const object = makeObject({ status: UploadStatus.uploaded });
      redisGetMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      dynamoSendMock.mockResolvedValueOnce({ Item: object });

      await expect(
        getObjectPresignedURL("Object@123", ["Folder@123"]),
      ).resolves.toBe("https://get-url.test");

      expect(dynamoCommandAt(0)).toBeInstanceOf(GetCommand);
      expect(dynamoCommandAt(0).input).toStrictEqual({
        TableName: "ObjectsTable",
        Key: { id: "Object@123" },
      });
      expect(redisSetMock).toHaveBeenCalledWith(
        "Object@123",
        JSON.stringify(object),
        "EX",
        OBJECT_CACHE.OBJECT_TTL,
      );
      expect(redisSetMock).toHaveBeenCalledWith(
        OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL("Object@123"),
        "https://get-url.test",
        "EX",
        OBJECT_CACHE.PRESIGNED_URL_TTL,
      );
    });

    it("rejects get URL generation for pending objects", async () => {
      const object = makeObject({ status: UploadStatus.pending });
      redisGetMock.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(object));

      await expect(getObjectPresignedURL("Object@123", ["Folder@123"])).rejects.toThrow(
        BadRequestError,
      );
      expect(generateGetObjectPresignedURLMock).not.toHaveBeenCalled();
    });

    it("rejects access to cached objects outside allowedFolders", async () => {
      const object = makeObject({ folderId: "Folder@denied" });
      redisGetMock.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(object));

      await expect(getObjectPresignedURL("Object@123", ["Folder@allowed"])).rejects.toThrow(
        ForbiddenError,
      );
      expect(generateGetObjectPresignedURLMock).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the object does not exist", async () => {
      redisGetMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      dynamoSendMock.mockResolvedValueOnce({});

      await expect(getObjectPresignedURL("Object@missing", undefined)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("getPresignedUrlForPendingUploads", () => {
    it("returns a put presigned URL for a pending object", async () => {
      const object = makeObject({ status: UploadStatus.pending, key: "pending-key" });
      redisGetMock.mockResolvedValueOnce(JSON.stringify(object));

      await expect(
        getPresignedUrlForPendingUploads("Object@pending", ["Folder@123"]),
      ).resolves.toBe("https://put-url.test");

      expect(generatePutObjectPresignedURLMock).toHaveBeenCalledWith("pending-key");
    });

    it("rejects already uploaded objects", async () => {
      const object = makeObject({ status: UploadStatus.uploaded });
      redisGetMock.mockResolvedValueOnce(JSON.stringify(object));

      await expect(
        getPresignedUrlForPendingUploads("Object@123", ["Folder@123"]),
      ).rejects.toThrow("Cannot get the presigned url for the uploaded image");
      expect(generatePutObjectPresignedURLMock).not.toHaveBeenCalled();
    });

    it("rejects pending objects without an object key", async () => {
      const objectWithoutKey = {
        id: "Object@pending",
        name: "image.png",
        folderId: "Folder@123",
        status: UploadStatus.pending,
      };
      redisGetMock.mockResolvedValueOnce(JSON.stringify(objectWithoutKey));

      await expect(
        getPresignedUrlForPendingUploads("Object@pending", ["Folder@123"]),
      ).rejects.toThrow("ObjectKey is undefined,presignedURL cannot be genearated without objectKey");
      expect(generatePutObjectPresignedURLMock).not.toHaveBeenCalled();
    });
  });

  describe("getUploadedObjectsByFolderId", () => {
    it("queries uploaded objects using a decoded cursor and encodes the next cursor", async () => {
      const folder = makeFolder({ id: "Folder@123" });
      const object = makeObject({ status: UploadStatus.uploaded });
      getFolderByIdMock.mockResolvedValueOnce(folder);
      cursorDecodeMock.mockReturnValueOnce({ id: "Object@cursor" });
      cursorEncodeMock.mockReturnValueOnce("next-cursor");
      dynamoSendMock.mockResolvedValueOnce({
        Items: [object],
        LastEvaluatedKey: { id: "Object@last" },
      });

      await expect(getUploadedObjectsByFolderId(folder.id, "cursor-token")).resolves.toStrictEqual({
        objects: [object],
        lastEvaluatedKey: "next-cursor",
      });

      expect(cursorDecodeMock).toHaveBeenCalledWith("cursor-token");
      expect(dynamoCommandAt(0)).toBeInstanceOf(QueryCommand);
      expect(dynamoCommandAt(0).input).toStrictEqual({
        TableName: "ObjectsTable",
        IndexName: "FolderIdIndex",
        KeyConditionExpression: "folderId=:id AND #status=:status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":id": folder.id,
          ":status": UploadStatus.uploaded,
        },
        Limit: 10,
        ExclusiveStartKey: { id: "Object@cursor" },
      });
      expect(cursorEncodeMock).toHaveBeenCalledWith({ id: "Object@last" });
    });

    it("does not decode null or undefined cursor sentinel values", async () => {
      const object = makeObject({ status: UploadStatus.uploaded });
      dynamoSendMock.mockResolvedValueOnce({ Items: [object] });

      await expect(getUploadedObjectsByFolderId("Folder@123", "null")).resolves.toStrictEqual({
        objects: [object],
        lastEvaluatedKey: undefined,
      });

      expect(cursorDecodeMock).not.toHaveBeenCalled();
      expect(cursorEncodeMock).not.toHaveBeenCalled();
      expect(dynamoCommandAt(0).input).toMatchObject({
        ExclusiveStartKey: undefined,
      });
    });
  });

  describe("fetchPendingObjectsByFolderId", () => {
    it("queries pending objects with a page size of 2 and returns the next cursor", async () => {
      const pendingObject = makeObject({ status: UploadStatus.pending });
      cursorDecodeMock.mockReturnValueOnce({ id: "Object@cursor" });
      cursorEncodeMock.mockReturnValueOnce("next-pending-cursor");
      dynamoSendMock.mockResolvedValueOnce({
        Items: [pendingObject],
        LastEvaluatedKey: { id: "Object@last" },
      });

      await expect(fetchPendingObjectsByFolderId("Folder@123", "cursor-token")).resolves.toStrictEqual({
        objects: [pendingObject],
        lastEvaluatedKey: "next-pending-cursor",
      });

      expect(dynamoCommandAt(0)).toBeInstanceOf(QueryCommand);
      expect(dynamoCommandAt(0).input).toStrictEqual({
        TableName: "ObjectsTable",
        IndexName: "FolderIdIndex",
        KeyConditionExpression: "folderId = :folderId AND #status = :status",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":folderId": "Folder@123",
          ":status": UploadStatus.pending,
        },
        Limit: 2,
        ExclusiveStartKey: { id: "Object@cursor" },
      });
      expect(cursorEncodeMock).toHaveBeenCalledWith({ id: "Object@last" });
    });

    it("throws NotFoundError when no pending objects exist for the folder", async () => {
      dynamoSendMock.mockResolvedValueOnce({ Items: [] });

      const promise = fetchPendingObjectsByFolderId("Folder@123", "null");

      await expect(promise).rejects.toThrow(NotFoundError);
      await expect(promise).rejects.toThrow("No Uploaded Images with this folderId");
    });
  });

  describe("deleteObjectById", () => {
    it("starts the delete Step Function, returns success output, and invalidates object cache", async () => {
      const object = makeObject({ key: "s3-key" });
      redisGetMock.mockResolvedValueOnce(JSON.stringify(object));
      stepFunctionSendMock
        .mockResolvedValueOnce({ executionArn: "arn:execution:123" })
        .mockResolvedValueOnce({
          status: "SUCCEEDED",
          output: JSON.stringify({ deleted: true }),
          startDate: new Date("2026-05-02T00:00:00.000Z"),
          stopDate: new Date("2026-05-02T00:00:00.125Z"),
        });

      await expect(deleteObjectById("Object@123")).resolves.toStrictEqual({
        success: true,
        executionArn: "arn:execution:123",
        output: { deleted: true },
        durationMs: 125,
        attempts: 1,
      });

      expect(stepFunctionCommandAt(0)).toBeInstanceOf(StartExecutionCommand);
      expect(stepFunctionCommandAt(0).input).toStrictEqual({
        stateMachineArn: "arn:aws:states:local:123:stateMachine:deleteObject",
        input: JSON.stringify({
          objectId: "Object@123",
          S3ObjectKey: "s3-key",
        }),
      });
      expect(stepFunctionCommandAt(1)).toBeInstanceOf(DescribeExecutionCommand);
      expect(stepFunctionCommandAt(1).input).toStrictEqual({
        executionArn: "arn:execution:123",
      });
      expect(redisDelMock).toHaveBeenCalledWith("Object@123");
    });

    it("throws StepFunctionExecutionError when the delete execution fails", async () => {
      const object = makeObject({ key: "s3-key" });
      redisGetMock.mockResolvedValueOnce(JSON.stringify(object));
      stepFunctionSendMock
        .mockResolvedValueOnce({ executionArn: "arn:execution:failed" })
        .mockResolvedValueOnce({
          status: "FAILED",
          error: "DeleteFailed",
          cause: "S3 delete failed",
        });

      const promise = deleteObjectById("Object@123");

      await expect(promise).rejects.toThrow(StepFunctionExecutionError);
      await expect(promise).rejects.toMatchObject({
        executionArn: "arn:execution:failed",
        executionStatus: "FAILED",
        code: "DeleteFailed",
        cause: "S3 delete failed",
        attempts: 1,
      });
      expect(redisDelMock).not.toHaveBeenCalled();
    });

    it("throws StepFunctionExecutionError after polling is exhausted", async () => {
      const object = makeObject({ key: "s3-key" });
      redisGetMock.mockResolvedValueOnce(JSON.stringify(object));
      stepFunctionSendMock
        .mockResolvedValueOnce({ executionArn: "arn:execution:running" })
        .mockResolvedValueOnce({ status: "RUNNING" })
        .mockResolvedValueOnce({ status: "RUNNING" })
        .mockResolvedValueOnce({ status: "RUNNING" });

      const promise = deleteObjectById("Object@123");

      await expect(promise).rejects.toThrow(StepFunctionExecutionError);
      await expect(promise).rejects.toMatchObject({
        executionArn: "arn:execution:running",
        executionStatus: "POLLING_EXHAUSTED",
        code: "POLLING_EXHAUSTED",
        attempts: 3,
      });
      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(redisDelMock).not.toHaveBeenCalled();
    });

    it("does not start Step Functions when the object does not exist", async () => {
      redisGetMock.mockResolvedValueOnce(null);
      dynamoSendMock.mockResolvedValueOnce({});

      await expect(deleteObjectById("Object@missing")).rejects.toThrow(NotFoundError);

      expect(stepFunctionSendMock).not.toHaveBeenCalled();
    });
  });
});
