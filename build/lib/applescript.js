/**
 * AppleScript operations for the iMessage MCP Server
 * Handles all interactions with macOS Messages and Contacts apps via AppleScript
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { execFile } from "child_process";
import { promisify } from "util";
import { getErrorMessage, escapeAppleScript } from "./utils.js";
const execFileAsync = promisify(execFile);
/**
 * Execute an AppleScript
 */
export function runAppleScript(script) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stdout } = yield execFileAsync("osascript", ["-e", script]);
            return stdout.trim();
        }
        catch (error) {
            throw new Error(`AppleScript error: ${getErrorMessage(error)}`);
        }
    });
}
/**
 * Send an iMessage
 * Returns success message or throws error
 */
export function sendMessage(recipient_1, message_1) {
    return __awaiter(this, arguments, void 0, function* (recipient, message, isGroupChat = false) {
        const escapedMessage = escapeAppleScript(message);
        const escapedRecipient = escapeAppleScript(recipient);
        let script;
        if (isGroupChat) {
            script = `
      tell application "Messages"
        set targetChat to chat "${escapedRecipient}"
        send "${escapedMessage}" to targetChat
      end tell
    `;
        }
        else {
            script = `
      tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "${escapedRecipient}" of targetService
        send "${escapedMessage}" to targetBuddy
      end tell
    `;
        }
        try {
            yield runAppleScript(script);
            return `Message sent successfully to ${recipient}`;
        }
        catch (error) {
            // Try SMS fallback for individual messages
            if (!isGroupChat) {
                try {
                    const smsScript = `
          tell application "Messages"
            set targetService to 1st account whose service type = SMS
            set targetBuddy to participant "${escapedRecipient}" of targetService
            send "${escapedMessage}" to targetBuddy
          end tell
        `;
                    yield runAppleScript(smsScript);
                    return `Message sent via SMS to ${recipient} (iMessage unavailable)`;
                }
                catch (_a) {
                    // Fall through to error
                }
            }
            throw new Error(`Failed to send message: ${getErrorMessage(error)}`);
        }
    });
}
/**
 * Check if a recipient has iMessage available
 */
export function checkImessageAvailable(recipient) {
    return __awaiter(this, void 0, void 0, function* () {
        const escapedRecipient = escapeAppleScript(recipient);
        const script = `
    tell application "Messages"
      try
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "${escapedRecipient}" of targetService
        return "available"
      on error
        return "unavailable"
      end try
    end tell
  `;
        try {
            const result = yield runAppleScript(script);
            return result.includes("available") && !result.includes("unavailable");
        }
        catch (_a) {
            return false;
        }
    });
}
/**
 * Get all contacts from Contacts app
 */
export function getAllContacts() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `
    tell application "Contacts"
      set output to "["
      repeat with p in every person
        if output is not "[" then
          set output to output & ","
        end if
        set output to output & "{"
        set output to output & "\\"name\\":\\"" & (name of p as text) & "\\","
        set output to output & "\\"phones\\":["
        set firstPhone to true
        repeat with ph in phones of p
          if not firstPhone then
            set output to output & ","
          end if
          set output to output & "\\"" & (value of ph) & "\\""
          set firstPhone to false
        end repeat
        set output to output & "],"
        set output to output & "\\"emails\\":["
        set firstEmail to true
        repeat with em in emails of p
          if not firstEmail then
            set output to output & ","
          end if
          set output to output & "\\"" & (value of em) & "\\""
          set firstEmail to false
        end repeat
        set output to output & "]"
        set output to output & "}"
      end repeat
      return output & "]"
    end tell
  `;
        const result = yield runAppleScript(script);
        return JSON.parse(result);
    });
}
/**
 * Search contacts by name, phone, or email
 */
export function searchContacts(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const escapedQuery = escapeAppleScript(query.toLowerCase());
        const script = `
    tell application "Contacts"
      set output to "["
      set isFirst to true
      repeat with p in every person
        set personName to (name of p as text)
        set matched to false

        if personName contains "${escapedQuery}" then
          set matched to true
        end if

        if not matched then
          repeat with ph in phones of p
            if (value of ph as text) contains "${escapedQuery}" then
              set matched to true
              exit repeat
            end if
          end repeat
        end if

        if not matched then
          repeat with em in emails of p
            if (value of em as text) contains "${escapedQuery}" then
              set matched to true
              exit repeat
            end if
          end repeat
        end if

        if matched then
          if not isFirst then
            set output to output & ","
          end if
          set output to output & "{"
          set output to output & "\\"name\\":\\"" & personName & "\\","
          set output to output & "\\"phones\\":["
          set firstPhone to true
          repeat with ph in phones of p
            if not firstPhone then
              set output to output & ","
            end if
            set output to output & "\\"" & (value of ph) & "\\""
            set firstPhone to false
          end repeat
          set output to output & "],"
          set output to output & "\\"emails\\":["
          set firstEmail to true
          repeat with em in emails of p
            if not firstEmail then
              set output to output & ","
            end if
            set output to output & "\\"" & (value of em) & "\\""
            set firstEmail to false
          end repeat
          set output to output & "]"
          set output to output & "}"
          set isFirst to false
        end if
      end repeat
      return output & "]"
    end tell
  `;
        const result = yield runAppleScript(script);
        return JSON.parse(result);
    });
}
/**
 * Get contact by phone number
 */
export function getContactByPhone(phone) {
    return __awaiter(this, void 0, void 0, function* () {
        const escapedPhone = escapeAppleScript(phone);
        const script = `
    tell application "Contacts"
      set output to ""
      repeat with p in every person
        repeat with ph in phones of p
          if (value of ph as text) contains "${escapedPhone}" then
            set output to "{"
            set output to output & "\\"name\\":\\"" & (name of p as text) & "\\","
            set output to output & "\\"phones\\":["
            set firstPhone to true
            repeat with phInner in phones of p
              if not firstPhone then
                set output to output & ","
              end if
              set output to output & "\\"" & (value of phInner) & "\\""
              set firstPhone to false
            end repeat
            set output to output & "],"
            set output to output & "\\"emails\\":["
            set firstEmail to true
            repeat with em in emails of p
              if not firstEmail then
                set output to output & ","
              end if
              set output to output & "\\"" & (value of em) & "\\""
              set firstEmail to false
            end repeat
            set output to output & "]"
            set output to output & "}"
            return output
          end if
        end repeat
      end repeat
      return output
    end tell
  `;
        try {
            const result = yield runAppleScript(script);
            if (!result)
                return null;
            return JSON.parse(result);
        }
        catch (_a) {
            return null;
        }
    });
}
/**
 * Start a new conversation (opens Messages app)
 */
export function startConversation(recipient) {
    return __awaiter(this, void 0, void 0, function* () {
        const escapedRecipient = escapeAppleScript(recipient);
        const script = `
    tell application "Messages"
      activate
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${escapedRecipient}" of targetService
    end tell
  `;
        yield runAppleScript(script);
    });
}
/**
 * Get the active conversation's recipient
 */
export function getActiveConversation() {
    return __awaiter(this, void 0, void 0, function* () {
        const script = `
    tell application "Messages"
      try
        set activeChat to (item 1 of (get chats whose room type is not missing value or id is not missing value))
        return id of activeChat
      on error
        return ""
      end try
    end tell
  `;
        try {
            const result = yield runAppleScript(script);
            return result || null;
        }
        catch (_a) {
            return null;
        }
    });
}
