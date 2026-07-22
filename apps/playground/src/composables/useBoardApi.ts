import type { MilanoteDocument } from "@milanote-api/parser";
import { computed, onScopeDispose, shallowRef, type ComputedRef } from "vue";

import { isBoardApiResponse, type BoardApiError } from "../types/api.ts";

type LoadStatus = "idle" | "loading" | "success" | "error";

export interface UseBoardApiOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

export interface UseBoardApiReturn {
  boardDocument: ComputedRef<MilanoteDocument | undefined>;
  error: ComputedRef<BoardApiError | undefined>;
  isLoading: ComputedRef<boolean>;
  load: () => Promise<void>;
  status: ComputedRef<LoadStatus>;
}

export function useBoardApi(options: UseBoardApiOptions = {}): UseBoardApiReturn {
  const endpoint = options.endpoint ?? "/api/board";
  const fetcher = options.fetcher ?? fetch;
  const boardDocumentState = shallowRef<MilanoteDocument>();
  const errorState = shallowRef<BoardApiError>();
  const statusState = shallowRef<LoadStatus>("idle");
  let activeController: AbortController | undefined;

  async function load(): Promise<void> {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    errorState.value = undefined;
    statusState.value = "loading";

    try {
      const response = await fetcher(endpoint, {
        cache: "no-cache",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const payload: unknown = await response.json();

      if (!isBoardApiResponse(payload)) {
        throw new Error("INVALID_API_RESPONSE");
      }

      if (!payload.ok) {
        errorState.value = payload.error;
        statusState.value = "error";
        return;
      }

      if (!response.ok) {
        throw new Error("INVALID_API_STATUS");
      }

      boardDocumentState.value = payload.data;
      statusState.value = "success";
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      errorState.value = {
        code: "NETWORK_ERROR",
        message:
          error instanceof TypeError
            ? "无法连接到 API，请稍后重试。"
            : "API 返回了无法识别的数据。",
      };
      statusState.value = "error";
    } finally {
      if (activeController === controller) {
        activeController = undefined;
      }
    }
  }

  onScopeDispose(() => activeController?.abort());

  return {
    boardDocument: computed(() => boardDocumentState.value),
    error: computed(() => errorState.value),
    isLoading: computed(() => statusState.value === "loading"),
    load,
    status: computed(() => statusState.value),
  };
}
