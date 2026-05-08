import type { NextFunction, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanonicalLogContext } from "../../src/types/canonicalLog.types.js";

const {
  createUserServiceMock,
  deleteUserByIdMock,
  getUserByIdMock,
  updateUserPasswordByIdMock,
} = vi.hoisted(() => ({
  createUserServiceMock: vi.fn(),
  deleteUserByIdMock: vi.fn(),
  getUserByIdMock: vi.fn(),
  updateUserPasswordByIdMock: vi.fn(),
}));

vi.mock("../../src/users/user.service.js", () => ({
  createUser: createUserServiceMock,
  deleteUserById: deleteUserByIdMock,
  getUserById: getUserByIdMock,
  updateUserPasswordById: updateUserPasswordByIdMock,
}));

import {
  createUser,
  deleteUser,
  getUser,
  updateUserPassword,
} from "../../src/users/user.controller.js";

const user = {
  id: "User@123",
  name: "alice",
  role: "READ_ONLY",
  allowedFolders: ["Folder@123"],
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
    path: "/users",
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

describe("user controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createUser", () => {
    it("delegates to the service, sets resource id, and responds with 201", async () => {
      createUserServiceMock.mockResolvedValue(user);
      const req = {
        body: {
          name: "alice",
          password: "Password1!",
          role: "READ_ONLY",
          allowedFolders: ["Folder@123"],
        },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await createUser(mockRequest<typeof createUser>(req), res, next as NextFunction);

      expect(createUserServiceMock).toHaveBeenCalledWith(req.body, res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ userId: user.id });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: "User created",
        data: user,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("create failed");
      createUserServiceMock.mockRejectedValue(error);
      const req = { body: { name: "alice" } };
      const res = createMockResponse();
      const next = vi.fn();

      await createUser(mockRequest<typeof createUser>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("getUser", () => {
    it("reads query id, delegates to the service, and responds with 200", async () => {
      getUserByIdMock.mockResolvedValue(user);
      const req = { query: { id: "User@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getUser(mockRequest<typeof getUser>(req), res, next as NextFunction);

      expect(getUserByIdMock).toHaveBeenCalledWith("User@123", res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ userId: "User@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(user);
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("lookup failed");
      getUserByIdMock.mockRejectedValue(error);
      const req = { query: { id: "User@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await getUser(mockRequest<typeof getUser>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("updateUserPassword", () => {
    it("reads body id and password, delegates to the service, and responds with 200", async () => {
      updateUserPasswordByIdMock.mockResolvedValue(undefined);
      const req = { body: { id: "User@123", password: "NewPass1!" } };
      const res = createMockResponse();
      const next = vi.fn();

      await updateUserPassword(
        mockRequest<typeof updateUserPassword>(req),
        res,
        next as NextFunction,
      );

      expect(updateUserPasswordByIdMock).toHaveBeenCalledWith(
        "User@123",
        "NewPass1!",
        res.locals.log,
      );
      expect(res.locals.log.resourceIds).toStrictEqual({ userId: "User@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Password Updated Successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("update failed");
      updateUserPasswordByIdMock.mockRejectedValue(error);
      const req = { body: { id: "User@123", password: "NewPass1!" } };
      const res = createMockResponse();
      const next = vi.fn();

      await updateUserPassword(
        mockRequest<typeof updateUserPassword>(req),
        res,
        next as NextFunction,
      );

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    it("reads query id, delegates to the service, and responds with 200", async () => {
      deleteUserByIdMock.mockResolvedValue(user);
      const req = { query: { id: "User@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteUser(mockRequest<typeof deleteUser>(req), res, next as NextFunction);

      expect(deleteUserByIdMock).toHaveBeenCalledWith("User@123", res.locals.log);
      expect(res.locals.log.resourceIds).toStrictEqual({ userId: "User@123" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        messagae: "User deleted successfully",
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("passes service errors to next", async () => {
      const error = new Error("delete failed");
      deleteUserByIdMock.mockRejectedValue(error);
      const req = { query: { id: "User@123" } };
      const res = createMockResponse();
      const next = vi.fn();

      await deleteUser(mockRequest<typeof deleteUser>(req), res, next as NextFunction);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
