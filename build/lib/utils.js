/**
 * Pure utility functions for the iMessage MCP Server
 * These functions have no side effects and are easily testable
 */
/**
 * Apple's Cocoa epoch is January 1, 2001
 * Unix epoch is January 1, 1970
 * Difference in seconds
 */
export const COCOA_EPOCH_DIFF = 978307200;
/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    if (typeof error === "string")
        return error;
    return String(error);
}
/**
 * Convert Apple's Cocoa timestamp to JavaScript Date
 * Cocoa timestamps are seconds since 2001-01-01
 * After iOS 11, they're in nanoseconds
 */
export function cocoaTimestampToDate(timestamp) {
    // Check if timestamp is in nanoseconds (very large number)
    if (timestamp > 1e12) {
        timestamp = timestamp / 1e9;
    }
    return new Date((timestamp + COCOA_EPOCH_DIFF) * 1000);
}
/**
 * Convert JavaScript Date to Cocoa timestamp (in nanoseconds)
 */
export function dateToCocoaTimestamp(date) {
    const unixSeconds = date.getTime() / 1000;
    return (unixSeconds - COCOA_EPOCH_DIFF) * 1e9;
}
/**
 * Convert hours ago to Cocoa timestamp
 */
export function hoursAgoToCocoaTimestamp(hours) {
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return (cutoffTime / 1000 - COCOA_EPOCH_DIFF) * 1e9;
}
/**
 * Convert days ago to Cocoa timestamp
 */
export function daysAgoToCocoaTimestamp(days) {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    return (cutoffTime / 1000 - COCOA_EPOCH_DIFF) * 1e9;
}
/**
 * Format a Date object to a human-readable string
 */
export function formatDate(date) {
    return date.toLocaleString();
}
/**
 * Format a phone number to E.164 format
 * Handles common US phone number formats
 */
export function formatPhoneNumber(phone) {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, "");
    // If it starts with 1 and is 11 digits, it's a US number
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
        return `+${cleaned}`;
    }
    // If it's 10 digits, assume US number
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    // If it already has a +, return as is
    if (cleaned.startsWith("+")) {
        return cleaned;
    }
    return phone;
}
/**
 * Check if a string looks like a phone number
 */
export function isPhoneNumber(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
}
/**
 * Check if a string looks like an email address
 */
export function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
/**
 * Escape special characters for AppleScript strings
 */
export function escapeAppleScript(str) {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.substring(0, maxLength - 3) + "...";
}
/**
 * Parse a date string or return null if invalid
 */
export function parseDate(dateStr) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}
/**
 * Calculate relative time (e.g., "2 hours ago")
 */
export function relativeTime(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffSec < 60)
        return "just now";
    if (diffMin < 60)
        return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
    if (diffHour < 24)
        return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
    if (diffDay < 7)
        return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
    return formatDate(date);
}
/**
 * Validate and normalize limit parameter
 */
export function normalizeLimit(limit, defaultLimit, maxLimit) {
    if (limit === undefined || limit === null)
        return defaultLimit;
    if (limit <= 0)
        return defaultLimit;
    if (limit > maxLimit)
        return maxLimit;
    return Math.floor(limit);
}
/**
 * Validate and normalize hours parameter
 */
export function normalizeHours(hours, defaultHours, maxHours) {
    if (hours === undefined || hours === null)
        return defaultHours;
    if (hours <= 0)
        return defaultHours;
    if (hours > maxHours)
        return maxHours;
    return hours;
}
/**
 * Validate and normalize days parameter
 */
export function normalizeDays(days, defaultDays, maxDays) {
    if (days === undefined || days === null)
        return defaultDays;
    if (days <= 0)
        return defaultDays;
    if (days > maxDays)
        return maxDays;
    return days;
}
/**
 * Get MIME type from filename
 */
export function getMimeTypeFromFilename(filename) {
    var _a;
    if (!filename)
        return null;
    const ext = (_a = filename.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    const mimeTypes = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        heic: "image/heic",
        heif: "image/heif",
        webp: "image/webp",
        mp4: "video/mp4",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        aac: "audio/aac",
        wav: "audio/wav",
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        txt: "text/plain",
    };
    return ext ? mimeTypes[ext] || null : null;
}
/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes) {
    if (bytes === null || bytes === 0)
        return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
/**
 * Check if running on macOS
 */
export function isMacOS() {
    return process.platform === "darwin";
}
/**
 * Sanitize a string for safe use in SQL LIKE patterns
 */
export function sanitizeForSqlLike(str) {
    return str.replace(/[%_]/g, (char) => `\\${char}`);
}
