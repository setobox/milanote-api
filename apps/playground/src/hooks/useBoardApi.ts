import { milanoteDocumentSchema, type MilanoteDocument } from "@milanote-api/parser";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  boardApiProjectionResponseSchema,
  type BoardApiError,
  type BoardApiProjection,
} from "@/types/api.ts";

type LoadStatus = "idle" | "loading" | "success" | "error";

export interface UseBoardApiOptions {
  fetcher?: typeof fetch;
}

export interface UseBoardApiReturn {
  boardDocument: MilanoteDocument | undefined;
  error: BoardApiError | undefined;
  isLoading: boolean;
  load: (requestPath: string) => Promise<void>;
  responseData: BoardApiProjection | undefined;
  status: LoadStatus;
}

export function useBoardApi(options: UseBoardApiOptions = {}): UseBoardApiReturn {
  const fetcher = options.fetcher ?? fetch;
  const [boardDocument, setBoardDocument] = useState<MilanoteDocument>();
  const [responseData, setResponseData] = useState<BoardApiProjection>();
  const [error, setError] = useState<BoardApiError>();
  const [status, setStatus] = useState<LoadStatus>("idle");
  const activeController = useRef<AbortController | undefined>(undefined);

  const load = useCallback(
    async (requestPath: string): Promise<void> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      setBoardDocument(undefined);
      setResponseData(undefined);
      setError(undefined);
      setStatus("loading");

      const isInactive = (): boolean =>
        controller.signal.aborted || activeController.current !== controller;

      try {
        const response = await fetcher(requestPath, {
          cache: "no-cache",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const responseBody: unknown = await response.json();
        if (isInactive()) {
          return;
        }

        const result = boardApiProjectionResponseSchema.safeParse(responseBody);

        if (!result.success) {
          throw new Error("INVALID_API_RESPONSE");
        }

        const payload = result.data;
        if (!payload.ok) {
          setError(payload.error);
          setStatus("error");
          return;
        }

        if (!response.ok) {
          throw new Error("INVALID_API_STATUS");
        }

        const fullDocument = milanoteDocumentSchema.safeParse(payload.data);
        setBoardDocument(fullDocument.success ? fullDocument.data : undefined);
        setResponseData(payload.data);
        setStatus("success");
      } catch (caught: unknown) {
        if (isInactive()) {
          return;
        }

        setError({
          code: "NETWORK_ERROR",
          message:
            caught instanceof TypeError
              ? "无法连接到 API，请稍后重试。"
              : "API 返回了无法识别的数据。",
        });
        setStatus("error");
      } finally {
        if (activeController.current === controller) {
          activeController.current = undefined;
        }
      }
    },
    [fetcher],
  );

  useEffect(() => () => activeController.current?.abort(), []);

  return {
    boardDocument,
    error,
    isLoading: status === "loading",
    load,
    responseData,
    status,
  };
}
