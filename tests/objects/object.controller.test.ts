import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import type { UserRole } from "../../src/users/user.type.js";
import { BadRequestError, ValidationError } from "../../src/utils/errors/http.errors.js";

const {
  completeObjectUploadByIdMock,
  deleteObjectByIdMock,
  fetchPendingObjectsByFolderIdMock,
  getObjectPresignedURLMock,
  getPresignedUrlForPendingUploadsMock,
  getPutObjectPresignedURLMock,
  getUploadedObjectsByFolderIdMock,
} = vi.hoisted(() => ({
  completeObjectUploadByIdMock: vi.fn(),
  deleteObjectByIdMock: vi.fn(),
  fetchPendingObjectsByFolderIdMock: vi.fn(),
  getObjectPresignedURLMock: vi.fn(),
  getPresignedUrlForPendingUploadsMock: vi.fn(),
  getPutObjectPresignedURLMock: vi.fn(),
  getUploadedObjectsByFolderIdMock: vi.fn(),
}));

vi.mock("../../src/objects/object.service.js", () => ({
  completeObjectUploadById: completeObjectUploadByIdMock,
  deleteObjectById: deleteObjectByIdMock,
  fetchPendingObjectsByFolderId: fetchPendingObjectsByFolderIdMock,
  getObjectPresignedURL: getObjectPresignedURLMock,
  getPresignedUrlForPendingUploads: getPresignedUrlForPendingUploadsMock,
  getPutObjectPresignedURL: getPutObjectPresignedURLMock,
  getUploadedObjectsByFolderId: getUploadedObjectsByFolderIdMock,
}));

import {
  completeObjectUpload,
  deleteObject,
  getObjectFromS3,
  getPendingObjectByFolder,
  getPresignedURL,
  getUploadedObjectsByFolder,
  uploadObjectToS3,
} from "../../src/objects/object.controller.js";

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  locals: { log: CanonicalLogContext };
};

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

function createMockResponse(): MockResponse {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    locals: {
      log: createLogContext(),
    },
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

function mockRequest<TController extends (req: any, res: any, next: any) => unknown>(
  request: unknown,
): Parameters<TController>[0] {
  return request as unknown as Parameters<TController>[0];
}

function mockUser(allowedFolders: string[], role: UserRole = "ADMIN") {
  return {
    id: "User@123",
    role,
    allowedFolders,
  };
}

describe("object controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadObjectToS3", () => {
    it("validates body, passes allowed folders, and responds with a put presigned URL", async () => {
      const payload = { objectId: "Object@123", presignedURL: "https://put-url.test" };
      getPutObjectPresignedURLMock.mockResolvedValue(payload);
      const req = {
        body: { folderId: "  Folder@123  ", name: "  image.png  " },
        user: mockUser(["Folder@123"]),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await uploadObjectToS3(mockRequest<typeof uploadObjectToS3>(req), res, next as NextFunction);

      expect(getPutObjectPresignedURLMock).toHaveBeenCalledWith(
        "image.png",
        "Folder@123",
        ["Folder@123"],
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes READ_ONLY user's allowed folders to the object service", async () => {
      getPutObjectPresignedURLMock.mockResolvedValue("https://put-url.test");
      const req = {
        body: { folderId: "Folder@allowed", name: "image.png" },
        user: mockUser(["Folder@allowed"], "READ_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await uploadObjectToS3(mockRequest<typeof uploadObjectToS3>(req), res, next as NextFunction);

      expect(getPutObjectPresignedURLMock).toHaveBeenCalledWith(
        "image.png",
        "Folder@allowed",
        ["Folder@allowed"],
        res.locals.log,
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("passes validation errors to next without calling the service", async () => {
      const req = { body: { name: "image.png" }, user: mockUser(["Folder@123"]) };
      const res = createMockResponse();
      const next = vi.fn();

      await uploadObjectToS3(mockRequest<typeof uploadObjectToS3>(req), res, next as NextFunction);

      expect(getPutObjectPresignedURLMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("upload failed");
      getPutObjectPresignedURLMock.mockRejectedValue(error);
      const req = {
        body: { folderId: "Folder@123", name: "image.png" },
        user: mockUser(["Folder@123"]),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await uploadObjectToS3(mockRequest<typeof uploadObjectToS3>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("completeObjectUpload", () => {
    it("validates body object id, passes allowed folders, and responds with completed status", async () => {
      const payload = { objectId: "Object@123", status: "UPLOADED" };
      completeObjectUploadByIdMock.mockResolvedValue(payload);
      const req = {
        body: { objectId: "  Object@123  " },
        user: mockUser(["Folder@123"], "WRITE_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await completeObjectUpload(mockRequest<typeof completeObjectUpload>(req), res, next as NextFunction);

      expect(completeObjectUploadByIdMock).toHaveBeenCalledWith(
        "Object@123",
        ["Folder@123"],
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ objectId: "Object@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes validation errors to next without calling the service", async () => {
      const req = { body: {}, user: mockUser(["Folder@123"]) };
      const res = createMockResponse();
      const next = vi.fn();

      await completeObjectUpload(mockRequest<typeof completeObjectUpload>(req), res, next as NextFunction);

      expect(completeObjectUploadByIdMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("completion failed");
      completeObjectUploadByIdMock.mockRejectedValue(error);
      const req = {
        body: { objectId: "Object@123" },
        user: mockUser(["Folder@123"]),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await completeObjectUpload(mockRequest<typeof completeObjectUpload>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getObjectFromS3", () => {
    it("validates query id, passes allowed folders, and responds with a get presigned URL", async () => {
      getObjectPresignedURLMock.mockResolvedValue("https://get-url.test");
      const req = {
        query: { id: "  Object@123  " },
        user: mockUser(["Folder@123"], "READ_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await getObjectFromS3(mockRequest<typeof getObjectFromS3>(req), res, next as NextFunction);

      expect(getObjectPresignedURLMock).toHaveBeenCalledWith(
        "Object@123",
        ["Folder@123"],
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ objectId: "Object@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("https://get-url.test");
      expect(next).not.toHaveBeenCalled();
    });

    it("passes validation errors to next", async () => {
      const req = { query: {}, user: mockUser(["Folder@123"]) };
      const res = createMockResponse();
      const next = vi.fn();

      await getObjectFromS3(mockRequest<typeof getObjectFromS3>(req), res, next as NextFunction);

      expect(getObjectPresignedURLMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
    });
  });

  describe("getPresignedURL", () => {
    it("validates query id, passes allowed folders, and responds with a pending upload URL", async () => {
      getPresignedUrlForPendingUploadsMock.mockResolvedValue("https://pending-put-url.test");
      const req = {
        query: { id: "Object@pending" },
        user: mockUser(["Folder@123"], "WRITE_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await getPresignedURL(mockRequest<typeof getPresignedURL>(req), res, next as NextFunction);

      expect(getPresignedUrlForPendingUploadsMock).toHaveBeenCalledWith(
        "Object@pending",
        ["Folder@123"],
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ objectId: "Object@pending" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("https://pending-put-url.test");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("getUploadedObjectsByFolder", () => {
    it("validates folder id and cursor, delegates to service, and responds with uploaded objects", async () => {
      const payload = { objects: [{ id: "Object@1" }], lastEvaluatedKey: "next-cursor" };
      getUploadedObjectsByFolderIdMock.mockResolvedValue(payload);
      const req = { query: { id: " Folder@123 ", cursor: " cursor-token " } };
      const res = createMockResponse();
      const next = vi.fn();

      await getUploadedObjectsByFolder(
        mockRequest<typeof getUploadedObjectsByFolder>(req),
        res,
        next as NextFunction,
      );

      expect(getUploadedObjectsByFolderIdMock).toHaveBeenCalledWith(
        "Folder@123",
        "cursor-token",
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes cursor validation errors to next", async () => {
      const req = { query: { id: "Folder@123", cursor: "   " } };
      const res = createMockResponse();
      const next = vi.fn();

      await getUploadedObjectsByFolder(
        mockRequest<typeof getUploadedObjectsByFolder>(req),
        res,
        next as NextFunction,
      );

      expect(getUploadedObjectsByFolderIdMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe("getPendingObjectByFolder", () => {
    it("validates folder id and cursor, delegates to service, and responds with pending objects", async () => {
      const payload = { objects: [{ id: "Object@pending" }], lastEvaluatedKey: undefined };
      fetchPendingObjectsByFolderIdMock.mockResolvedValue(payload);
      const req = { query: { id: "Folder@123", cursor: "null" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getPendingObjectByFolder(
        mockRequest<typeof getPendingObjectByFolder>(req),
        res,
        next as NextFunction,
      );

      expect(fetchPendingObjectsByFolderIdMock).toHaveBeenCalledWith(
        "Folder@123",
        "null",
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("pending lookup failed");
      fetchPendingObjectsByFolderIdMock.mockRejectedValue(error);
      const req = { query: { id: "Folder@123", cursor: "null" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getPendingObjectByFolder(
        mockRequest<typeof getPendingObjectByFolder>(req),
        res,
        next as NextFunction,
      );

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("deleteObject", () => {
    it("validates query id, deletes the object, and responds with the deletion result", async () => {
      const deletionResult = { success: true, executionArn: "arn:test", attempts: 1 };
      deleteObjectByIdMock.mockResolvedValue(deletionResult);
      const req = { query: { id: " Object@123 " } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteObject(mockRequest<typeof deleteObject>(req), res, next as NextFunction);

      expect(deleteObjectByIdMock).toHaveBeenCalledWith("Object@123", res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ objectId: "Object@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(deletionResult);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("delete failed");
      deleteObjectByIdMock.mockRejectedValue(error);
      const req = { query: { id: "Object@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteObject(mockRequest<typeof deleteObject>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
