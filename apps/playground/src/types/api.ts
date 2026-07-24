import { milanoteDocumentSchema } from "@milanote-api/parser";
import { z } from "zod";

export const boardApiErrorCodeSchema = z.enum([
  "BOARD_NOT_FOUND",
  "CONFIGURATION_ERROR",
  "INTERNAL_ERROR",
  "INVALID_REQUEST",
  "INVALID_SHARE_URL",
  "METHOD_NOT_ALLOWED",
  "NETWORK_ERROR",
  "NOT_FOUND",
  "UPSTREAM_ERROR",
]);

export const boardApiErrorSchema = z.object({
  code: boardApiErrorCodeSchema,
  message: z.string(),
});

export const boardApiFailureSchema = z.object({
  error: boardApiErrorSchema,
  ok: z.literal(false),
});

export const boardApiSuccessSchema = z.object({
  data: milanoteDocumentSchema,
  ok: z.literal(true),
});

export const boardApiResponseSchema = z.discriminatedUnion("ok", [
  boardApiFailureSchema,
  boardApiSuccessSchema,
]);

export type BoardApiError = z.infer<typeof boardApiErrorSchema>;
export type BoardApiFailure = z.infer<typeof boardApiFailureSchema>;
export type BoardApiSuccess = z.infer<typeof boardApiSuccessSchema>;
export type BoardApiResponse = z.infer<typeof boardApiResponseSchema>;
