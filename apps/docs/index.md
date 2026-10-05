---
layout: false
search: false
---

<script setup>
import { onMounted } from 'vue';
import { useData, withBase } from 'vitepress';
const { site } = useData();
onMounted(() => window.location.replace(`${site.value.base}docs/`));
</script>

<a :href="withBase('/docs/')">打开 Milanote API 文档</a>
