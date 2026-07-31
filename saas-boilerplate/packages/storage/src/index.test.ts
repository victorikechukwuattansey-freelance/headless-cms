import { describe, it, expect } from "vitest";
import { StorageError, UploadFailedError, FileNotFoundError } from "./types";

describe("StorageError", () => {
  it("creates error with code and message", () => {
    const error = new StorageError("STORAGE_001", "storage error");
    expect(error.code).toBe("STORAGE_001");
    expect(error.message).toBe("storage error");
    expect(error.name).toBe("StorageError");
  });
});

describe("UploadFailedError", () => {
  it("has correct code and message", () => {
    const error = new UploadFailedError();
    expect(error.code).toBe("UPLOAD_FAILED");
    expect(error.message).toBe("File upload failed");
    expect(error).toBeInstanceOf(StorageError);
  });
});

describe("FileNotFoundError", () => {
  it("has correct code and message", () => {
    const error = new FileNotFoundError();
    expect(error.code).toBe("FILE_NOT_FOUND");
    expect(error.message).toBe("File not found");
    expect(error).toBeInstanceOf(StorageError);
  });
});
