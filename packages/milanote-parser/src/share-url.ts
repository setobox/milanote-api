import { MilanoteParserError } from "./errors.ts";
import { milanoteShareUrlSchema } from "./schemas.ts";
import type { MilanoteShareReference } from "./types.ts";

export function parseMilanoteShareUrl(input: string): MilanoteShareReference {
  try {
    const result = milanoteShareUrlSchema.safeParse(input);
    if (!result.success) {
      throw new MilanoteParserError("INVALID_SHARE_URL");
    }

    const url = new URL(result.data);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const boardId = decodeURIComponent(pathSegments[0] ?? "");
    const permissionId = url.searchParams.get("p") ?? "";

    return { boardId, permissionId };
  } catch (error: unknown) {
    if (error instanceof MilanoteParserError) {
      throw error;
    }

    throw new MilanoteParserError("INVALID_SHARE_URL");
  }
}
