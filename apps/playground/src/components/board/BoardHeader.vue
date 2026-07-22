<script setup lang="ts">
import type { MilanoteNode } from "@milanote-api/parser";
import { computed } from "vue";

import { countDescendants, formatFetchedAt, getNodeLabel } from "../../utils/boardModel.ts";

type BoardNode = Extract<MilanoteNode, { type: "BOARD" }>;

const props = defineProps<{
  board: BoardNode;
  fetchedAt: string;
  loading: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const title = computed(() => getNodeLabel(props.board));
const directItemCount = computed(() => props.board.children.length);
const totalItemCount = computed(() => countDescendants(props.board));
const fetchedAtLabel = computed(() => formatFetchedAt(props.fetchedAt));
</script>

<template>
  <header class="border-b border-base px-4 py-4 sm:px-6 sm:py-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <p class="m-0 text-xs font-700 tracking-[0.16em] color-active uppercase">Milanote API</p>
        <h1 class="m-0 mt-1 truncate text-xl font-750 tracking-tight sm:text-2xl" :title="title">
          {{ title }}
        </h1>
        <dl class="m-0 mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs color-soft">
          <div class="flex items-baseline gap-1.5">
            <dt>顶层</dt>
            <dd class="technical-value m-0 color-base">{{ directItemCount }}</dd>
          </div>
          <div class="flex items-baseline gap-1.5">
            <dt>全部元素</dt>
            <dd class="technical-value m-0 color-base">{{ totalItemCount }}</dd>
          </div>
          <div class="flex min-w-0 items-baseline gap-1.5">
            <dt>抓取于</dt>
            <dd class="technical-value m-0 max-w-64 truncate color-base" :title="fetchedAt">
              {{ fetchedAtLabel }}
            </dd>
          </div>
        </dl>
      </div>

      <button
        class="btn-action shrink-0"
        type="button"
        :aria-busy="loading"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <span aria-hidden="true">↻</span>
        {{ loading ? "刷新中" : "刷新" }}
      </button>
    </div>
  </header>
</template>
