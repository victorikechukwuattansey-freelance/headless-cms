import { describe, it, expect } from "vitest";
import { NotificationError } from "./types";
import type { NotificationPayload, NotificationRecord } from "./types";

describe("NotificationError", () => {
  it("creates error with code and message", () => {
    const error = new NotificationError("NOTIFY_001", "notification error");
    expect(error.code).toBe("NOTIFY_001");
    expect(error.message).toBe("notification error");
    expect(error.name).toBe("NotificationError");
  });
});

describe("NotificationPayload type", () => {
  it("valid payloads satisfy the interface", () => {
    const payload: NotificationPayload = {
      userId: "user-1",
      type: "in_app",
      channel: "system",
      title: "Test",
      message: "Hello",
      link: "/dashboard",
    };
    expect(payload.userId).toBe("user-1");
    expect(payload.type).toBe("in_app");
  });

  it("supports email type", () => {
    const payload: NotificationPayload = {
      userId: "user-1",
      type: "email",
      channel: "billing",
      title: "Invoice Ready",
    };
    expect(payload.type).toBe("email");
  });
});

describe("NotificationRecord type", () => {
  it("valid records satisfy the interface", () => {
    const record: NotificationRecord = {
      id: "notif-1",
      userId: "user-1",
      type: "in_app",
      channel: "team",
      title: "New Member",
      message: "John joined",
      link: "/team",
      readAt: null,
      createdAt: new Date(),
    };
    expect(record.readAt).toBeNull();
    expect(record.createdAt).toBeInstanceOf(Date);
  });
});
