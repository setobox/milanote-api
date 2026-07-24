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
  search: (shareUrl: string) => Promise<void>;
  status: LoadStatus;
}

export function useBoardApi(options: UseBoardApiOptions = {}): UseBoardApiReturn {
  const endpoint = options.endpoint ?? "/api/search";
  const fetcher = options.fetcher ?? fetch;
  const [boardDocument, setBoardDocument] = useState<MilanoteDocument>();
  const [error, setError] = useState<BoardApiError>();
  const [status, setStatus] = useState<LoadStatus>("idle");
  const activeController = useRef<AbortController | undefined>(undefined);

  const search = useCallback(
    async (shareUrl: string): Promise<void> => {
      activeController.current?.abort();
      const controller = new AbortController();
      activeController.current = controller;
      setBoardDocument(undefined);
      setError(undefined);
      setStatus("loading");

      try {
        const query = new URLSearchParams({ url: shareUrl });
        const response = await fetcher(`${endpoint}?${query.toString()}`, {
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
    },
    [endpoint, fetcher],
  );

  useEffect(() => () => activeController.current?.abort(), []);

  return {
    boardDocument,
    error,
    isLoading: status === "loading",
    search,
    status,
  };
}
