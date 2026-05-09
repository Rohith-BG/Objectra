import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestError } from "../../../src/utils/errors/http.errors.js";

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

vi.mock("../../../src/configs/S3Bucket.client.js", () => ({
  default: {},
}));

import { generateGetObjectPresignedURL } from "../../../src/utils/S3-PresignedUrl/getObject.js";

describe("generateGetObjectPresignedURL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = "test-bucket";
  });

  it("returns a presigned URL for a valid object key", async () => {
    getSignedUrlMock.mockResolvedValue("https://s3.example.com/get-url");

    const result = await generateGetObjectPresignedURL("image.png@key");

    expect(result).toBe("https://s3.example.com/get-url");
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { expiresIn: 1200 },
    );
  });

  it("throws BadRequestError when getSignedUrl returns falsy", async () => {
    getSignedUrlMock.mockResolvedValue("");

    await expect(generateGetObjectPresignedURL("key")).rejects.toThrow(BadRequestError);
    await expect(generateGetObjectPresignedURL("key")).rejects.toThrow(
      "Failed to get the presigned URL from the S3",
    );
  });

  it("propagates errors from getSignedUrl", async () => {
    getSignedUrlMock.mockRejectedValue(new Error("S3 unavailable"));

    await expect(generateGetObjectPresignedURL("key")).rejects.toThrow("S3 unavailable");
  });
});
