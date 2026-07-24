import { jsonValueSchema } from "@milanote-api/parser";
import { z } from "zod";

export const boardApiErrorCodeSchema = z.enum([
  "BOARD_NOT_FOUND",
  "INTERNAL_ERROR",
  "INVALID_FIELD_SELECTOR",
  "INVALID_REQUEST",
  "INVALID_SHARE_URL",
  "METHOD_NOT_ALLOWED",
  "NETWORK_ERROR",
  "NOT_FOUND",
  "UPSTREAM_ERROR",
]);

export const boardApiErrorSchema = z.object({
  code: boardApiErrorCodeSchema,
  field: z.enum(["exclude", "include"]).optional(),
  message: z.string(),
});

export const boardApiFailureSchema = z.object({
  error: boardApiErrorSchema,
  ok: z.literal(false),
});

export const boardApiProjectionSchema = z.record(z.string(), jsonValueSchema);

export const boardApiProjectionSuccessSchema = z.object({
  data: boardApiProjectionSchema,
  ok: z.literal(true),
});

export const boardApiProjectionResponseSchema = z.discriminatedUnion("ok", [
  boardApiFailureSchema,
  boardApiProjectionSuccessSchema,
]);

export type BoardApiError = z.infer<typeof boardApiErrorSchema>;
export type BoardApiFailure = z.infer<typeof boardApiFailureSchema>;
export type BoardApiProjection = z.infer<typeof boardApiProjectionSchema>;
export type BoardApiProjectionResponse = z.infer<typeof boardApiProjectionResponseSchema>;
export type BoardApiProjectionSuccess = z.infer<typeof boardApiProjectionSuccessSchema>;
