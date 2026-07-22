<script setup lang="ts">
import { computed, onScopeDispose, shallowRef } from "vue";

const props = defineProps<{
  value: unknown;
}>();

const formattedValue = computed(() => JSON.stringify(props.value, null, 2));
const copyState = shallowRef<"idle" | "success" | "error">("idle");
let resetTimer: ReturnType<typeof setTimeout> | undefined;

const copyStatus = computed(() => {
  if (copyState.value === "success") {
    return "JSON 已复制";
  }
  if (copyState.value === "error") {
    return "复制失败，请手动选择文本";
  }
  return "";
});

async function copyJson(): Promise<void> {
  try {
    if (!navigator.clipboard) {
      throw new Error("CLIPBOARD_UNAVAILABLE");
    }
    await navigator.clipboard.writeText(formattedValue.value);
    copyState.value = "success";
  } catch {
    copyState.value = "error";
  }

  if (resetTimer) {
    clearTimeout(resetTimer);
  }
  resetTimer = setTimeout(() => {
    copyState.value = "idle";
  }, 2400);
}

onScopeDispose(() => {
  if (resetTimer) {
    clearTimeout(resetTimer);
  }
});
</script>

<template>
  <section class="p-4 sm:p-6" aria-labelledby="json-viewer-title">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 id="json-viewer-title" class="m-0 text-sm font-700">解析结果</h2>
      <div class="flex items-center gap-3">
        <span class="text-xs color-soft" aria-live="polite">{{ copyStatus }}</span>
        <button class="btn-action" type="button" @click="copyJson">复制 JSON</button>
      </div>
    </div>
    <pre
      class="surface-panel m-0 max-h-[calc(100vh-14rem)] overflow-auto p-4 text-xs leading-5 sm:text-sm"
      tabindex="0"
    ><code class="technical-value">{{ formattedValue }}</code></pre>
  </section>
</template>
