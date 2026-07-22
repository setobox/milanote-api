<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";

import { useBoardApi } from "../../composables/useBoardApi.ts";
import BoardCanvas from "./BoardCanvas.vue";
import BoardHeader from "./BoardHeader.vue";
import JsonViewer from "./JsonViewer.vue";

type ViewMode = "canvas" | "json";

const viewMode = shallowRef<ViewMode>("canvas");
const { boardDocument, error, isLoading, load } = useBoardApi();
const hasBoardItems = computed(() => (boardDocument.value?.board.children.length ?? 0) > 0);

function selectView(mode: ViewMode): void {
  viewMode.value = mode;
}

onMounted(load);
</script>

<template>
  <div class="mx-auto min-h-screen w-full">
    <BoardHeader
      v-if="boardDocument"
      :board="boardDocument.board"
      :fetched-at="boardDocument.fetchedAt"
      :loading="isLoading"
      @refresh="load"
    />

    <header v-else class="flex min-h-20 items-center border-b border-base px-4 sm:px-6">
      <div>
        <p class="m-0 text-xs font-700 tracking-[0.16em] color-active uppercase">Milanote API</p>
        <h1 class="m-0 mt-1 text-xl font-700 tracking-tight">Board playground</h1>
      </div>
    </header>

    <div
      v-if="boardDocument"
      class="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-base bg-base px-4 py-2 sm:px-6"
    >
      <div
        aria-label="查看方式"
        class="inline-flex rounded-md border border-base bg-secondary p-1"
        role="group"
      >
        <button
          class="focus-ring min-h-9 rounded px-3 text-sm font-600 transition-colors"
          :class="viewMode === 'canvas' ? 'bg-elevated color-base' : 'color-soft hover:color-base'"
          type="button"
          :aria-pressed="viewMode === 'canvas'"
          @click="selectView('canvas')"
        >
          Canvas
        </button>
        <button
          class="focus-ring min-h-9 rounded px-3 text-sm font-600 transition-colors"
          :class="viewMode === 'json' ? 'bg-elevated color-base' : 'color-soft hover:color-base'"
          type="button"
          :aria-pressed="viewMode === 'json'"
          @click="selectView('json')"
        >
          JSON
        </button>
      </div>

      <code class="technical-value text-xs color-soft">GET /api/board</code>
    </div>

    <div aria-live="polite" class="sr-only">
      {{ isLoading ? "正在加载画板" : "" }}
    </div>

    <section
      v-if="isLoading && !boardDocument"
      class="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12"
      role="status"
    >
      <div class="w-full max-w-sm text-center">
        <div class="loading-mark mx-auto" aria-hidden="true" />
        <h2 class="mb-1 mt-5 text-base font-700">正在解析画板</h2>
        <p class="m-0 text-sm leading-6 color-soft">API 正在读取并整理共享内容。</p>
      </div>
    </section>

    <section
      v-else-if="error && !boardDocument"
      class="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12"
      role="alert"
    >
      <div class="surface-panel w-full max-w-lg p-5 sm:p-6">
        <span class="type-badge">{{ error.code }}</span>
        <h2 class="mb-2 mt-4 text-lg font-700">无法载入画板</h2>
        <p class="m-0 text-sm leading-6 color-soft">{{ error.message }}</p>
        <button class="btn-action mt-5" type="button" @click="load">重新尝试</button>
      </div>
    </section>

    <template v-else-if="boardDocument">
      <div
        v-if="error"
        class="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--c-danger)]/30 bg-[var(--c-danger-soft)] px-4 py-3 sm:mx-6"
        role="alert"
      >
        <p class="m-0 text-sm">刷新失败，当前仍显示上一次结果：{{ error.message }}</p>
        <button class="btn-action" type="button" @click="load">重试</button>
      </div>

      <section
        v-if="viewMode === 'canvas' && !hasBoardItems"
        class="grid min-h-[24rem] place-items-center px-4 py-12"
      >
        <div class="max-w-md text-center">
          <span class="type-badge">EMPTY</span>
          <h2 class="mb-2 mt-4 text-lg font-700">画板暂时为空</h2>
          <p class="m-0 text-sm leading-6 color-soft">
            API 已成功响应，但没有可展示的画板元素。你仍可切换到 JSON 查看完整结果。
          </p>
        </div>
      </section>

      <BoardCanvas v-else-if="viewMode === 'canvas'" :board="boardDocument.board" />
      <JsonViewer v-else :value="boardDocument" />
    </template>
  </div>
</template>

<style scoped>
.loading-mark {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--c-border-strong);
  border-top-color: var(--c-accent);
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
