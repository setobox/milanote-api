<script setup lang="ts">
import type { MilanoteNode } from "@milanote-api/parser";
import { computed } from "vue";

import {
  formatCompactDate,
  getComments,
  getFileName,
  getFileSize,
  getImageUrl,
  getLinkUrl,
  getNodeChildren,
  getNodeDescription,
  getNodeLabel,
  getNodeTypeCode,
  getNodeTypeLabel,
  getTableRows,
  getTaskDueDate,
  getUnknownKind,
  isTaskComplete,
} from "../../utils/boardModel.ts";

const props = withDefaults(
  defineProps<{
    depth?: number;
    node: MilanoteNode;
  }>(),
  { depth: 0 },
);

const children = computed(() => getNodeChildren(props.node));
const label = computed(() => getNodeLabel(props.node));
const description = computed(() => getNodeDescription(props.node));
const typeCode = computed(() => getNodeTypeCode(props.node.type));
const typeLabel = computed(() => getNodeTypeLabel(props.node.type));
const imageUrl = computed(() => getImageUrl(props.node));
const imageAlt = computed(() => (label.value === "Image" ? "" : label.value));
const linkUrl = computed(() => getLinkUrl(props.node));
const linkHost = computed(() => {
  if (!linkUrl.value) {
    return undefined;
  }

  return new URL(linkUrl.value).hostname;
});
const fileName = computed(() => getFileName(props.node));
const fileSize = computed(() => getFileSize(props.node));
const taskComplete = computed(() => isTaskComplete(props.node));
const taskDueDate = computed(() => getTaskDueDate(props.node));
const tableRows = computed(() => getTableRows(props.node));
const comments = computed(() => getComments(props.node));
const unknownKind = computed(() => getUnknownKind(props.node));
const headingLevel = computed(() => Math.min(props.depth + 2, 6));
</script>

<template>
  <section v-if="node.type === 'COLUMN'" class="surface-panel min-w-0 p-3">
    <header class="mb-3 flex items-start justify-between gap-3 border-b border-base pb-3">
      <div class="min-w-0">
        <span class="type-badge">{{ typeCode }}</span>
        <div class="mt-2 break-words text-sm font-750" role="heading" :aria-level="headingLevel">
          {{ label }}
        </div>
      </div>
      <span class="technical-value shrink-0 text-xs color-soft">
        {{ children.length }}
      </span>
    </header>

    <div v-if="children.length > 0" class="grid gap-2.5">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
    <p v-else class="m-0 py-5 text-center text-xs color-soft">Empty column</p>
  </section>

  <section v-else-if="node.type === 'BOARD'" class="surface-panel min-w-0 p-3">
    <header class="mb-3 flex items-center justify-between gap-3">
      <div
        class="min-w-0 truncate text-sm font-750"
        role="heading"
        :aria-level="headingLevel"
        :title="label"
      >
        {{ label }}
      </div>
      <span class="type-badge">{{ typeCode }}</span>
    </header>
    <div class="grid gap-2.5">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
  </section>

  <article
    v-else-if="node.type === 'CARD'"
    class="min-w-0 rounded-md border border-base bg-[var(--c-accent-soft)]/35 p-3"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="type-badge">{{ typeCode }}</span>
      <span class="text-xs color-soft">{{ typeLabel }}</span>
    </div>
    <p class="m-0 whitespace-pre-wrap break-words text-sm leading-6">{{ label }}</p>
    <p v-if="description" class="mb-0 mt-2 whitespace-pre-wrap text-xs leading-5 color-soft">
      {{ description }}
    </p>
    <div v-if="children.length > 0" class="mt-3 grid gap-2 border-t border-base pt-3">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
  </article>

  <figure
    v-else-if="node.type === 'IMAGE'"
    class="m-0 min-w-0 overflow-hidden rounded-md border border-base bg-secondary"
  >
    <div class="relative aspect-[4/3] grid place-items-center overflow-hidden bg-secondary">
      <img
        v-if="imageUrl"
        class="h-full w-full object-contain"
        :src="imageUrl"
        :alt="imageAlt"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div v-else class="grid place-items-center gap-2 color-soft" aria-hidden="true">
        <span class="technical-value text-2xl">IMG</span>
        <span class="text-xs">No preview</span>
      </div>
    </div>
    <figcaption class="flex items-start justify-between gap-3 border-t border-base bg-elevated p-3">
      <span class="min-w-0 break-words text-sm">{{ label }}</span>
      <span class="type-badge shrink-0">{{ typeCode }}</span>
    </figcaption>
  </figure>

  <article
    v-else-if="node.type === 'FILE'"
    class="min-w-0 rounded-md border border-base bg-elevated p-3"
  >
    <div class="flex items-start gap-3">
      <span class="type-badge shrink-0">{{ typeCode }}</span>
      <div class="min-w-0 flex-1">
        <a
          v-if="linkUrl"
          class="focus-ring block truncate rounded text-sm font-650 color-active underline-offset-3 hover:underline"
          :href="linkUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="fileName"
        >
          {{ fileName }}
        </a>
        <p v-else class="m-0 truncate text-sm font-650" :title="fileName">
          {{ fileName }}
        </p>
        <p v-if="fileSize" class="technical-value mb-0 mt-1 text-xs color-soft">
          {{ fileSize }}
        </p>
      </div>
    </div>
  </article>

  <article
    v-else-if="node.type === 'LINK'"
    class="min-w-0 rounded-md border border-base bg-elevated p-3"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="type-badge">{{ typeCode }}</span>
      <span
        v-if="linkHost"
        class="technical-value max-w-44 truncate text-xs color-soft"
        :title="linkHost"
      >
        {{ linkHost }}
      </span>
    </div>
    <a
      v-if="linkUrl"
      class="focus-ring block rounded text-sm font-650 color-active underline-offset-3 hover:underline"
      :href="linkUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ label }}
      <span aria-hidden="true"> ↗</span>
    </a>
    <p v-else class="m-0 text-sm font-650">{{ label }}</p>
    <p v-if="description" class="mb-0 mt-2 text-xs leading-5 color-soft">
      {{ description }}
    </p>
  </article>

  <section
    v-else-if="node.type === 'TASK_LIST'"
    class="min-w-0 rounded-md border border-base bg-elevated p-3"
  >
    <header class="mb-2 flex items-center justify-between gap-3">
      <div class="text-sm font-700" role="heading" :aria-level="headingLevel">
        {{ label }}
      </div>
      <span class="type-badge">{{ typeCode }}</span>
    </header>
    <div v-if="children.length > 0" class="grid gap-1">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
    <p v-else class="m-0 py-2 text-xs color-soft">No tasks</p>
  </section>

  <div v-else-if="node.type === 'TASK'" class="flex min-w-0 items-start gap-2 rounded px-1.5 py-2">
    <input
      class="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-accent)]"
      type="checkbox"
      :checked="taskComplete"
      disabled
      :aria-label="taskComplete ? `已完成：${label}` : `未完成：${label}`"
    />
    <span
      class="min-w-0 break-words text-sm leading-5"
      :class="taskComplete ? 'line-through color-soft' : 'color-base'"
    >
      {{ label }}
    </span>
    <time
      v-if="taskDueDate"
      class="technical-value ml-auto shrink-0 text-[0.6875rem] color-soft"
      :datetime="taskDueDate"
      :title="taskDueDate"
    >
      {{ formatCompactDate(taskDueDate) }}
    </time>
  </div>

  <section
    v-else-if="node.type === 'TABLE'"
    class="min-w-0 overflow-hidden rounded-md border border-base bg-elevated"
  >
    <header class="flex items-center justify-between gap-3 border-b border-base p-3">
      <div class="text-sm font-700" role="heading" :aria-level="headingLevel">
        {{ label }}
      </div>
      <span class="type-badge">{{ typeCode }}</span>
    </header>
    <div v-if="tableRows.length > 0" class="overflow-x-auto" tabindex="0">
      <table class="w-full border-collapse text-left text-xs">
        <tbody>
          <tr v-for="(row, rowIndex) in tableRows" :key="rowIndex">
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              class="min-w-28 border-b border-r border-base px-3 py-2 align-top last:border-r-0"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="children.length > 0" class="grid gap-2 p-3">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
    <p v-else class="m-0 p-3 text-xs color-soft">Empty table</p>
  </section>

  <aside
    v-else-if="node.type === 'COMMENT_THREAD'"
    class="min-w-0 rounded-md border-l-2 border-[var(--c-accent)] bg-secondary p-3"
  >
    <header class="mb-2 flex items-center justify-between gap-3">
      <div
        class="text-xs font-700 uppercase tracking-wide color-soft"
        role="heading"
        :aria-level="headingLevel"
      >
        {{ label }}
      </div>
      <span class="technical-value text-xs color-soft">{{ comments.length }}</span>
    </header>
    <ol v-if="comments.length > 0" class="m-0 grid list-none gap-2 p-0">
      <li
        v-for="comment in comments"
        :key="comment.id"
        class="rounded border border-base bg-elevated p-2.5"
      >
        <div
          v-if="comment.author || comment.createdAt"
          class="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[0.6875rem] color-soft"
        >
          <span v-if="comment.author" class="font-650">{{ comment.author }}</span>
          <time
            v-if="comment.createdAt"
            class="technical-value"
            :datetime="comment.createdAt"
            :title="comment.createdAt"
          >
            {{ formatCompactDate(comment.createdAt) }}
          </time>
        </div>
        <p class="m-0 whitespace-pre-wrap break-words text-xs leading-5">
          {{ comment.text }}
        </p>
      </li>
    </ol>
    <p v-else class="m-0 text-xs color-soft">No comments</p>
    <div v-if="children.length > 0" class="mt-2 grid gap-2 border-t border-base pt-2">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
  </aside>

  <div
    v-else-if="node.type === 'SKELETON'"
    class="min-w-0 rounded-md border border-dashed border-base bg-secondary px-3 py-4 text-center"
  >
    <span class="type-badge">{{ typeCode }}</span>
    <p class="mb-0 mt-2 text-xs color-soft">This item was not returned by the source.</p>
  </div>

  <article v-else class="min-w-0 rounded-md border border-dashed border-base bg-elevated p-3">
    <div class="flex items-center justify-between gap-2">
      <span class="type-badge">{{ typeCode }}</span>
      <span
        v-if="unknownKind"
        class="technical-value max-w-40 truncate text-xs color-soft"
        :title="unknownKind"
      >
        {{ unknownKind }}
      </span>
    </div>
    <p class="mb-0 mt-3 break-words text-sm">{{ label }}</p>
    <code
      class="technical-value mt-2 block max-w-full truncate text-[0.6875rem] color-soft"
      :title="node.id"
    >
      {{ node.id }}
    </code>
    <div v-if="children.length > 0" class="mt-3 grid gap-2 border-t border-base pt-3">
      <BoardElement v-for="child in children" :key="child.id" :node="child" :depth="depth + 1" />
    </div>
  </article>
</template>
