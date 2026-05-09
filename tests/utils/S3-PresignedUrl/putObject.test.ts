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

import { generatePutObjectPresignedURL } from "../../../src/utils/S3-PresignedUrl/putObject.js";

describe("generatePutObjectPresignedURL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BUCKET_NAME = "test-bucket";
  });

  it("returns a presigned URL for a valid object key", async () => {
    getSignedUrlMock.mockResolvedValue("https://s3.example.com/put-url");

    const result = await generatePutObjectPresignedURL("image.png@key");

    expect(result).toBe("https://s3.example.com/put-url");
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { expiresIn: 1200 },
    );
  });

  it("throws BadRequestError when getSignedUrl returns a falsy value", async () => {
    getSignedUrlMock.mockResolvedValue("");

    await expect(generatePutObjectPresignedURL("key")).rejects.toThrow(BadRequestError);
  });

  it("propagates errors from getSignedUrl", async () => {
    getSignedUrlMock.mockRejectedValue(new Error("S3 unavailable"));

    await expect(generatePutObjectPresignedURL("key")).rejects.toThrow("S3 unavailable");
  });
});
