<script setup lang="ts">
import type { MilanoteNode } from "@milanote-api/parser";
import { computed } from "vue";

import BoardElement from "./BoardElement.vue";

type BoardNode = Extract<MilanoteNode, { type: "BOARD" }>;

const props = defineProps<{
  board: BoardNode;
}>();

const hasColumns = computed(() => props.board.children.some((node) => node.type === "COLUMN"));
</script>

<template>
  <section class="board-canvas" aria-label="画板内容">
    <div class="board-grid" :class="{ 'board-grid--columns': hasColumns }">
      <BoardElement v-for="node in board.children" :key="node.id" :node="node" :depth="0" />
    </div>
  </section>
</template>

<style scoped>
.board-canvas {
  min-height: calc(100vh - 10rem);
  padding: 1rem;
  overflow: hidden;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  align-items: start;
  gap: 1rem;
}

@media (min-width: 48rem) {
  .board-canvas {
    padding: 1.5rem;
  }

  .board-grid--columns {
    grid-auto-flow: column;
    grid-auto-columns: minmax(18rem, 22rem);
    grid-template-columns: none;
    padding-bottom: 0.75rem;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-color: var(--c-border-strong) transparent;
  }
}
</style>
