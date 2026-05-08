import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";
import type { UserRole } from "../../src/users/user.type.js";
import { BadRequestError } from "../../src/utils/errors/http.errors.js";

const {
  createFolderServiceMock,
  deleteFolderByIdMock,
  getAllSubFoldersByParentIdMock,
  getFolderByIdMock,
  listAllMainFoldersMock,
  updateFolderNameByIdMock,
  updateParentIdByFolderIdMock,
} = vi.hoisted(() => ({
  createFolderServiceMock: vi.fn(),
  deleteFolderByIdMock: vi.fn(),
  getAllSubFoldersByParentIdMock: vi.fn(),
  getFolderByIdMock: vi.fn(),
  listAllMainFoldersMock: vi.fn(),
  updateFolderNameByIdMock: vi.fn(),
  updateParentIdByFolderIdMock: vi.fn(),
}));

vi.mock("../../src/folders/folder.service.js", () => ({
  createFolder: createFolderServiceMock,
  deleteFolderById: deleteFolderByIdMock,
  getAllSubFoldersByParentId: getAllSubFoldersByParentIdMock,
  getFolderById: getFolderByIdMock,
  listAllMainFolders: listAllMainFoldersMock,
  updateFolderNameById: updateFolderNameByIdMock,
  updateParentIdByFolderId: updateParentIdByFolderIdMock,
}));

import {
  createFolder,
  deleteFolder,
  getAllMainFolders,
  getAllSubFolders,
  getFolder,
  updateFolderName,
  updateParentId,
} from "../../src/folders/folder.controller.js";

const folder = {
  id: "Folder@123",
  name: "Documents",
  parentId: "ROOT",
  createdAt: "2026-05-02T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z",
};

type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  locals: { log: CanonicalLogContext };
};

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

describe("folder controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createFolder", () => {
    it("validates request body, creates a folder, and responds with 201", async () => {
      createFolderServiceMock.mockResolvedValue(folder);
      const req = { body: { name: "Documents", parentId: null } };
      const res = createMockResponse();
      const next = vi.fn();

      await createFolder(mockRequest<typeof createFolder>(req), res, next as NextFunction);

      expect(createFolderServiceMock).toHaveBeenCalledWith("Documents", null, res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: folder.id });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(folder);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes validation errors to next without calling the service", async () => {
      const req = { body: { parentId: null } };
      const res = createMockResponse();
      const next = vi.fn();

      await createFolder(mockRequest<typeof createFolder>(req), res, next as NextFunction);

      expect(createFolderServiceMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("create failed");
      createFolderServiceMock.mockRejectedValue(error);
      const req = { body: { name: "Documents", parentId: null } };
      const res = createMockResponse();
      const next = vi.fn();

      await createFolder(mockRequest<typeof createFolder>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getFolder", () => {
    it("reads the query id, fetches the folder, and responds with 200", async () => {
      getFolderByIdMock.mockResolvedValue(folder);
      const req = { query: { id: "Folder@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getFolder(mockRequest<typeof getFolder>(req), res, next as NextFunction);

      expect(getFolderByIdMock).toHaveBeenCalledWith("Folder@123", undefined, res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(folder);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("lookup failed");
      getFolderByIdMock.mockRejectedValue(error);
      const req = { query: { id: "Folder@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getFolder(mockRequest<typeof getFolder>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getAllMainFolders", () => {
    it("passes allowed folders from the authenticated user and responds with 200", async () => {
      listAllMainFoldersMock.mockResolvedValue([folder]);
      const req = { user: mockUser(["Folder@123"]) };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllMainFolders(mockRequest<typeof getAllMainFolders>(req), res, next as NextFunction);

      expect(listAllMainFoldersMock).toHaveBeenCalledWith(["Folder@123"], res.locals.log);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([folder]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes READ_ONLY user's allowed folders to the folder service", async () => {
      listAllMainFoldersMock.mockResolvedValue([folder]);
      const req = { user: mockUser(["Folder@123"], "READ_ONLY") };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllMainFolders(mockRequest<typeof getAllMainFolders>(req), res, next as NextFunction);

      expect(listAllMainFoldersMock).toHaveBeenCalledWith(["Folder@123"], res.locals.log);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([folder]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes WRITE_ONLY user's allowed folders to the folder service", async () => {
      const writeAllowedFolder = { ...folder, id: "Folder@write-allowed" };
      listAllMainFoldersMock.mockResolvedValue([writeAllowedFolder]);
      const req = { user: mockUser(["Folder@write-allowed"], "WRITE_ONLY") };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllMainFolders(mockRequest<typeof getAllMainFolders>(req), res, next as NextFunction);

      expect(listAllMainFoldersMock).toHaveBeenCalledWith(
        ["Folder@write-allowed"],
        res.locals.log,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([writeAllowedFolder]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("list failed");
      listAllMainFoldersMock.mockRejectedValue(error);
      const req = { user: mockUser([]) };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllMainFolders(mockRequest<typeof getAllMainFolders>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getAllSubFolders", () => {
    it("validates parentId, passes allowed folders, and responds with 200", async () => {
      getAllSubFoldersByParentIdMock.mockResolvedValue([folder]);
      const req = {
        query: { parentId: "Folder@parent" },
        user: mockUser(["Folder@parent"]),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllSubFolders(mockRequest<typeof getAllSubFolders>(req), res, next as NextFunction);

      expect(getAllSubFoldersByParentIdMock).toHaveBeenCalledWith(
        "Folder@parent",
        ["Folder@parent"],
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ parentId: "Folder@parent" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([folder]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes READ_ONLY user's allowed folders to the folder service", async () => {
      getAllSubFoldersByParentIdMock.mockResolvedValue([folder]);
      const req = {
        query: { parentId: "Folder@parent" },
        user: mockUser(["Folder@parent"], "READ_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllSubFolders(mockRequest<typeof getAllSubFolders>(req), res, next as NextFunction);

      expect(getAllSubFoldersByParentIdMock).toHaveBeenCalledWith(
        "Folder@parent",
        ["Folder@parent"],
        res.locals.log,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([folder]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes WRITE_ONLY user's allowed folders to the folder service", async () => {
      const child = { ...folder, id: "Folder@child", parentId: "Folder@parent" };
      getAllSubFoldersByParentIdMock.mockResolvedValue([child]);
      const req = {
        query: { parentId: "Folder@parent" },
        user: mockUser(["Folder@parent", "Folder@child"], "WRITE_ONLY"),
      };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllSubFolders(mockRequest<typeof getAllSubFolders>(req), res, next as NextFunction);

      expect(getAllSubFoldersByParentIdMock).toHaveBeenCalledWith(
        "Folder@parent",
        ["Folder@parent", "Folder@child"],
        res.locals.log,
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([child]);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("children failed");
      getAllSubFoldersByParentIdMock.mockRejectedValue(error);
      const req = { query: { parentId: "Folder@parent" }, user: mockUser([]) };
      const res = createMockResponse();
      const next = vi.fn();

      await getAllSubFolders(mockRequest<typeof getAllSubFolders>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("updateFolderName", () => {
    it("validates params and body, updates the folder, and responds with 200", async () => {
      const updatedFolder = { ...folder, name: "Reports" };
      updateFolderNameByIdMock.mockResolvedValue(updatedFolder);
      const req = { params: { id: "Folder@123" }, body: { name: "Reports" } };
      const res = createMockResponse();
      const next = vi.fn();

      await updateFolderName(mockRequest<typeof updateFolderName>(req), res, next as NextFunction);

      expect(updateFolderNameByIdMock).toHaveBeenCalledWith(
        "Folder@123",
        "Reports",
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedFolder);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("rename failed");
      updateFolderNameByIdMock.mockRejectedValue(error);
      const req = { params: { id: "Folder@123" }, body: { name: "Reports" } };
      const res = createMockResponse();
      const next = vi.fn();

      await updateFolderName(mockRequest<typeof updateFolderName>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("updateParentId", () => {
    it("validates params and body, updates the parent id, and responds with 200", async () => {
      const updatedFolder = { ...folder, parentId: "Folder@new-parent" };
      updateParentIdByFolderIdMock.mockResolvedValue(updatedFolder);
      const req = {
        params: { id: "Folder@123"},
        body: {
          oldParentId: " Folder@old-parent ",
          parentId: " Folder@new-parent ",
        },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await updateParentId(mockRequest<typeof updateParentId>(req), res, next as NextFunction);

      expect(updateParentIdByFolderIdMock).toHaveBeenCalledWith(
        "Folder@123",
        "Folder@old-parent",
        "Folder@new-parent",
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({
        folderId: "Folder@123",
        oldParentId: "Folder@old-parent",
        newParentId: "Folder@new-parent",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedFolder);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("move failed");
      updateParentIdByFolderIdMock.mockRejectedValue(error);
      const req = {
        params: { id: "Folder@123" },
        body: { oldParentId: "Folder@old-parent", parentId: "Folder@new-parent" },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await updateParentId(mockRequest<typeof updateParentId>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("deleteFolder", () => {
    it("validates query id, deletes the folder, and responds with 200", async () => {
      deleteFolderByIdMock.mockResolvedValue(folder);
      const req = { query: { id: "Folder@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteFolder(mockRequest<typeof deleteFolder>(req), res, next as NextFunction);

      expect(deleteFolderByIdMock).toHaveBeenCalledWith("Folder@123", res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ folderId: "Folder@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(folder);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("delete failed");
      deleteFolderByIdMock.mockRejectedValue(error);
      const req = { query: { id: "Folder@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteFolder(mockRequest<typeof deleteFolder>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
