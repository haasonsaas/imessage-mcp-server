import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getErrorMessage,
  cocoaTimestampToDate,
  dateToCocoaTimestamp,
  hoursAgoToCocoaTimestamp,
  daysAgoToCocoaTimestamp,
  formatDate,
  formatPhoneNumber,
  isPhoneNumber,
  isEmail,
  escapeAppleScript,
  truncate,
  parseDate,
  relativeTime,
  normalizeLimit,
  normalizeHours,
  normalizeDays,
  getMimeTypeFromFilename,
  formatFileSize,
  isMacOS,
  sanitizeForSqlLike,
  COCOA_EPOCH_DIFF,
} from "../src/lib/utils.js";

describe("getErrorMessage", () => {
  it("returns message from Error object", () => {
    const error = new Error("test error");
    expect(getErrorMessage(error)).toBe("test error");
  });

  it("returns string as-is", () => {
    expect(getErrorMessage("string error")).toBe("string error");
  });

  it("converts other types to string", () => {
    expect(getErrorMessage(123)).toBe("123");
    expect(getErrorMessage({ foo: "bar" })).toBe("[object Object]");
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
  });
});

describe("cocoaTimestampToDate", () => {
  it("converts seconds-based timestamp", () => {
    // January 1, 2001 00:00:00 UTC in Cocoa time is 0
    const date = cocoaTimestampToDate(0);
    expect(date.getUTCFullYear()).toBe(2001);
    expect(date.getUTCMonth()).toBe(0); // January
    expect(date.getUTCDate()).toBe(1);
  });

  it("converts nanoseconds-based timestamp", () => {
    // Large timestamps are in nanoseconds
    const nanoTimestamp = 700000000 * 1e9; // About 22 years from 2001
    const date = cocoaTimestampToDate(nanoTimestamp);
    expect(date.getFullYear()).toBeGreaterThanOrEqual(2023);
  });

  it("handles typical iMessage timestamps", () => {
    // A timestamp from 2024
    const timestamp = 756864000 * 1e9; // In nanoseconds
    const date = cocoaTimestampToDate(timestamp);
    expect(date.getFullYear()).toBe(2024);
  });
});

describe("dateToCocoaTimestamp", () => {
  it("converts Date to Cocoa nanosecond timestamp", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const timestamp = dateToCocoaTimestamp(date);

    // Should be in nanoseconds (very large number)
    expect(timestamp).toBeGreaterThan(1e15);

    // Round-trip should work
    const roundTrip = cocoaTimestampToDate(timestamp);
    expect(roundTrip.getTime()).toBeCloseTo(date.getTime(), -3);
  });
});

describe("hoursAgoToCocoaTimestamp", () => {
  it("returns a timestamp in the past", () => {
    const now = dateToCocoaTimestamp(new Date());
    const oneHourAgo = hoursAgoToCocoaTimestamp(1);

    expect(oneHourAgo).toBeLessThan(now);
  });

  it("difference matches expected hours", () => {
    const now = dateToCocoaTimestamp(new Date());
    const twoHoursAgo = hoursAgoToCocoaTimestamp(2);

    // Difference should be about 2 hours in nanoseconds
    const diffNano = now - twoHoursAgo;
    const diffHours = diffNano / (1e9 * 60 * 60);
    expect(diffHours).toBeCloseTo(2, 0);
  });
});

describe("daysAgoToCocoaTimestamp", () => {
  it("returns a timestamp in the past", () => {
    const now = dateToCocoaTimestamp(new Date());
    const oneDayAgo = daysAgoToCocoaTimestamp(1);

    expect(oneDayAgo).toBeLessThan(now);
  });

  it("difference matches expected days", () => {
    const now = dateToCocoaTimestamp(new Date());
    const sevenDaysAgo = daysAgoToCocoaTimestamp(7);

    // Difference should be about 7 days in nanoseconds
    const diffNano = now - sevenDaysAgo;
    const diffDays = diffNano / (1e9 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });
});

describe("formatDate", () => {
  it("formats date to locale string", () => {
    const date = new Date("2024-01-15T10:30:00");
    const formatted = formatDate(date);

    expect(formatted).toContain("2024");
    expect(typeof formatted).toBe("string");
  });
});

describe("formatPhoneNumber", () => {
  it("formats 10-digit US number", () => {
    expect(formatPhoneNumber("5551234567")).toBe("+15551234567");
    expect(formatPhoneNumber("555-123-4567")).toBe("+15551234567");
    expect(formatPhoneNumber("(555) 123-4567")).toBe("+15551234567");
  });

  it("formats 11-digit number starting with 1", () => {
    expect(formatPhoneNumber("15551234567")).toBe("+15551234567");
    expect(formatPhoneNumber("1-555-123-4567")).toBe("+15551234567");
  });

  it("preserves numbers with + prefix", () => {
    expect(formatPhoneNumber("+15551234567")).toBe("+15551234567");
    expect(formatPhoneNumber("+442071234567")).toBe("+442071234567");
  });

  it("returns original for non-standard formats", () => {
    expect(formatPhoneNumber("john@example.com")).toBe("john@example.com");
    expect(formatPhoneNumber("12345")).toBe("12345");
  });
});

describe("isPhoneNumber", () => {
  it("recognizes valid phone numbers", () => {
    expect(isPhoneNumber("5551234567")).toBe(true);
    expect(isPhoneNumber("+1-555-123-4567")).toBe(true);
    expect(isPhoneNumber("15551234567")).toBe(true);
    expect(isPhoneNumber("+442071234567")).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    expect(isPhoneNumber("123")).toBe(false);
    expect(isPhoneNumber("john@example.com")).toBe(false);
    expect(isPhoneNumber("hello")).toBe(false);
  });
});

describe("isEmail", () => {
  it("recognizes valid emails", () => {
    expect(isEmail("john@example.com")).toBe(true);
    expect(isEmail("user.name@domain.org")).toBe(true);
    expect(isEmail("test+tag@gmail.com")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isEmail("not an email")).toBe(false);
    expect(isEmail("@missing.user")).toBe(false);
    expect(isEmail("missing@domain")).toBe(false);
    expect(isEmail("5551234567")).toBe(false);
  });
});

describe("escapeAppleScript", () => {
  it("escapes backslashes", () => {
    expect(escapeAppleScript("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("escapes double quotes", () => {
    expect(escapeAppleScript('say "hello"')).toBe('say \\"hello\\"');
  });

  it("escapes both together", () => {
    expect(escapeAppleScript('path\\to\\"file"')).toBe('path\\\\to\\\\\\"file\\"');
  });

  it("leaves normal text unchanged", () => {
    expect(escapeAppleScript("Hello World")).toBe("Hello World");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hi", 10)).toBe("hi");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world this is a long string", 10)).toBe("hello w...");
    expect(truncate("abcdefghijklmnop", 10)).toBe("abcdefg...");
  });

  it("handles edge cases", () => {
    expect(truncate("", 10)).toBe("");
    expect(truncate("abc", 3)).toBe("abc");
    expect(truncate("abcd", 3)).toBe("...");
  });
});

describe("parseDate", () => {
  it("parses valid date strings", () => {
    const date = parseDate("2024-01-15");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2024);
  });

  it("returns null for invalid dates", () => {
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for recent times", () => {
    const recent = new Date("2024-06-15T11:59:30Z");
    expect(relativeTime(recent)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date("2024-06-15T11:55:00Z");
    expect(relativeTime(fiveMinAgo)).toBe("5 minutes ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date("2024-06-15T09:00:00Z");
    expect(relativeTime(threeHoursAgo)).toBe("3 hours ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date("2024-06-13T12:00:00Z");
    expect(relativeTime(twoDaysAgo)).toBe("2 days ago");
  });

  it("returns formatted date for old times", () => {
    const twoWeeksAgo = new Date("2024-06-01T12:00:00Z");
    expect(relativeTime(twoWeeksAgo)).toContain("2024");
  });

  it("handles singular forms", () => {
    const oneMinAgo = new Date("2024-06-15T11:59:00Z");
    expect(relativeTime(oneMinAgo)).toBe("1 minute ago");

    const oneHourAgo = new Date("2024-06-15T11:00:00Z");
    expect(relativeTime(oneHourAgo)).toBe("1 hour ago");

    const oneDayAgo = new Date("2024-06-14T12:00:00Z");
    expect(relativeTime(oneDayAgo)).toBe("1 day ago");
  });
});

describe("normalizeLimit", () => {
  it("returns default for undefined", () => {
    expect(normalizeLimit(undefined, 50, 100)).toBe(50);
  });

  it("returns default for zero or negative", () => {
    expect(normalizeLimit(0, 50, 100)).toBe(50);
    expect(normalizeLimit(-5, 50, 100)).toBe(50);
  });

  it("caps at max limit", () => {
    expect(normalizeLimit(200, 50, 100)).toBe(100);
  });

  it("returns valid values as-is", () => {
    expect(normalizeLimit(30, 50, 100)).toBe(30);
    expect(normalizeLimit(75, 50, 100)).toBe(75);
  });

  it("floors decimal values", () => {
    expect(normalizeLimit(30.7, 50, 100)).toBe(30);
  });
});

describe("normalizeHours", () => {
  it("returns default for undefined", () => {
    expect(normalizeHours(undefined, 24, 168)).toBe(24);
  });

  it("caps at max", () => {
    expect(normalizeHours(500, 24, 168)).toBe(168);
  });
});

describe("normalizeDays", () => {
  it("returns default for undefined", () => {
    expect(normalizeDays(undefined, 7, 365)).toBe(7);
  });

  it("caps at max", () => {
    expect(normalizeDays(1000, 7, 365)).toBe(365);
  });
});

describe("getMimeTypeFromFilename", () => {
  it("returns correct MIME types for images", () => {
    expect(getMimeTypeFromFilename("photo.jpg")).toBe("image/jpeg");
    expect(getMimeTypeFromFilename("photo.jpeg")).toBe("image/jpeg");
    expect(getMimeTypeFromFilename("image.png")).toBe("image/png");
    expect(getMimeTypeFromFilename("animation.gif")).toBe("image/gif");
    expect(getMimeTypeFromFilename("photo.heic")).toBe("image/heic");
  });

  it("returns correct MIME types for videos", () => {
    expect(getMimeTypeFromFilename("video.mp4")).toBe("video/mp4");
    expect(getMimeTypeFromFilename("video.mov")).toBe("video/quicktime");
  });

  it("returns correct MIME types for audio", () => {
    expect(getMimeTypeFromFilename("audio.mp3")).toBe("audio/mpeg");
    expect(getMimeTypeFromFilename("audio.m4a")).toBe("audio/mp4");
  });

  it("returns null for unknown extensions", () => {
    expect(getMimeTypeFromFilename("file.xyz")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(getMimeTypeFromFilename(null)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
  });

  it("returns unknown for null or zero", () => {
    expect(formatFileSize(null)).toBe("Unknown size");
    expect(formatFileSize(0)).toBe("Unknown size");
  });
});

describe("isMacOS", () => {
  it("returns boolean", () => {
    expect(typeof isMacOS()).toBe("boolean");
  });
});

describe("sanitizeForSqlLike", () => {
  it("escapes percent signs", () => {
    expect(sanitizeForSqlLike("100% done")).toBe("100\\% done");
  });

  it("escapes underscores", () => {
    expect(sanitizeForSqlLike("hello_world")).toBe("hello\\_world");
  });

  it("leaves normal text unchanged", () => {
    expect(sanitizeForSqlLike("hello world")).toBe("hello world");
  });
});

describe("COCOA_EPOCH_DIFF", () => {
  it("equals seconds between Unix and Cocoa epochs", () => {
    // January 1, 1970 to January 1, 2001 is 31 years
    // 31 years * 365.25 days * 24 hours * 60 minutes * 60 seconds ≈ 978307200
    expect(COCOA_EPOCH_DIFF).toBe(978307200);
  });
});
