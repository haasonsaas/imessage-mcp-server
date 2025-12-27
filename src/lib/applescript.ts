/**
 * AppleScript operations for the iMessage MCP Server
 * Handles all interactions with macOS Messages and Contacts apps via AppleScript
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { Contact } from "./types.js";
import { getErrorMessage, escapeAppleScript } from "./utils.js";

const execFileAsync = promisify(execFile);

/**
 * Execute an AppleScript
 */
export async function runAppleScript(script: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout.trim();
  } catch (error) {
    throw new Error(`AppleScript error: ${getErrorMessage(error)}`);
  }
}

/**
 * Send an iMessage
 * Returns success message or throws error
 */
export async function sendMessage(
  recipient: string,
  message: string,
  isGroupChat: boolean = false
): Promise<string> {
  const escapedMessage = escapeAppleScript(message);
  const escapedRecipient = escapeAppleScript(recipient);

  let script: string;

  if (isGroupChat) {
    script = `
      tell application "Messages"
        set targetChat to chat "${escapedRecipient}"
        send "${escapedMessage}" to targetChat
      end tell
    `;
  } else {
    script = `
      tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "${escapedRecipient}" of targetService
        send "${escapedMessage}" to targetBuddy
      end tell
    `;
  }

  try {
    await runAppleScript(script);
    return `Message sent successfully to ${recipient}`;
  } catch (error) {
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
        await runAppleScript(smsScript);
        return `Message sent via SMS to ${recipient} (iMessage unavailable)`;
      } catch {
        // Fall through to error
      }
    }
    throw new Error(`Failed to send message: ${getErrorMessage(error)}`);
  }
}

/**
 * Check if a recipient has iMessage available
 */
export async function checkImessageAvailable(recipient: string): Promise<boolean> {
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
    const result = await runAppleScript(script);
    return result.includes("available") && !result.includes("unavailable");
  } catch {
    return false;
  }
}

/**
 * Get all contacts from Contacts app
 */
export async function getAllContacts(): Promise<Contact[]> {
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

  const result = await runAppleScript(script);
  return JSON.parse(result) as Contact[];
}

/**
 * Search contacts by name, phone, or email
 */
export async function searchContacts(query: string): Promise<Contact[]> {
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

  const result = await runAppleScript(script);
  return JSON.parse(result) as Contact[];
}

/**
 * Get contact by phone number
 */
export async function getContactByPhone(phone: string): Promise<Contact | null> {
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
    const result = await runAppleScript(script);
    if (!result) return null;
    return JSON.parse(result) as Contact;
  } catch {
    return null;
  }
}

/**
 * Start a new conversation (opens Messages app)
 */
export async function startConversation(recipient: string): Promise<void> {
  const escapedRecipient = escapeAppleScript(recipient);

  const script = `
    tell application "Messages"
      activate
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${escapedRecipient}" of targetService
    end tell
  `;

  await runAppleScript(script);
}

/**
 * Get the active conversation's recipient
 */
export async function getActiveConversation(): Promise<string | null> {
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
    const result = await runAppleScript(script);
    return result || null;
  } catch {
    return null;
  }
}
