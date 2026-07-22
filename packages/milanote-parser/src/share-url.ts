import { MilanoteParserError } from "./errors.ts";
import type { MilanoteShareReference } from "./types.ts";

const MILANOTE_HOSTNAME = "app.milanote.com";
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function parseMilanoteShareUrl(input: string): MilanoteShareReference {
  try {
    const url = new URL(input.trim());
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const permissionValues = url.searchParams.getAll("p");
    const boardId = decodeURIComponent(pathSegments[0] ?? "");
    const permissionId = permissionValues[0] ?? "";

    if (
      url.protocol !== "https:" ||
      url.hostname !== MILANOTE_HOSTNAME ||
      (url.port !== "" && url.port !== "443") ||
      url.username !== "" ||
      url.password !== "" ||
      permissionValues.length !== 1 ||
      !IDENTIFIER_PATTERN.test(boardId) ||
      !IDENTIFIER_PATTERN.test(permissionId)
    ) {
      throw new MilanoteParserError("INVALID_SHARE_URL");
    }

    return { boardId, permissionId };
  } catch (error: unknown) {
    if (error instanceof MilanoteParserError) {
      throw error;
    }

    throw new MilanoteParserError("INVALID_SHARE_URL");
  }
}
