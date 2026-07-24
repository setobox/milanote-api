import type { MilanoteDocument } from "@milanote-api/parser";
import { useCallback, useEffect, useRef, useState } from "react";

import { boardApiResponseSchema, type BoardApiError } from "@/types/api.ts";

type LoadStatus = "idle" | "loading" | "success" | "error";

export interface UseBoardApiOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

export interface UseBoardApiReturn {
  boardDocument: MilanoteDocument | undefined;
  error: BoardApiError | undefined;
  isLoading: boolean;
  load: () => Promise<void>;
  status: LoadStatus;
}

export function useBoardApi(options: UseBoardApiOptions = {}): UseBoardApiReturn {
  const endpoint = options.endpoint ?? "/api/board";
  const fetcher = options.fetcher ?? fetch;
  const [boardDocument, setBoardDocument] = useState<MilanoteDocument>();
  const [error, setError] = useState<BoardApiError>();
  const [status, setStatus] = useState<LoadStatus>("idle");
  const activeController = useRef<AbortController | undefined>(undefined);

  const load = useCallback(async (): Promise<void> => {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    setError(undefined);
    setStatus("loading");

    try {
      const response = await fetcher(endpoint, {
        cache: "no-cache",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const result = boardApiResponseSchema.safeParse(await response.json());

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

      setBoardDocument(payload.data);
      setStatus("success");
    } catch (caught: unknown) {
      if (controller.signal.aborted) {
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
  }, [endpoint, fetcher]);

  useEffect(() => {
    void load();
    return () => activeController.current?.abort();
  }, [load]);

  return {
    boardDocument,
    error,
    isLoading: status === "loading",
    load,
    status,
  };
}
