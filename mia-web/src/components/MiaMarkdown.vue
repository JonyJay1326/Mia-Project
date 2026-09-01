<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/renderMarkdown'

const props = defineProps<{
  /** Markdown 原文 */
  source: string
}>()

/** 渲染后的安全 HTML */
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="mia-markdown" v-html="html" />
</template>

<style scoped>
.mia-markdown {
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--c-ink);
  word-break: break-word;
}

.mia-markdown :deep(h1),
.mia-markdown :deep(h2),
.mia-markdown :deep(h3),
.mia-markdown :deep(h4) {
  margin: 1em 0 0.5em;
  font-weight: 800;
  line-height: 1.35;
  color: var(--c-ink);
}

.mia-markdown :deep(h1) {
  font-size: 1.15em;
}

.mia-markdown :deep(h2) {
  font-size: 1.08em;
}

.mia-markdown :deep(h3),
.mia-markdown :deep(h4) {
  font-size: 1em;
}

.mia-markdown :deep(p) {
  margin: 0.55em 0;
}

.mia-markdown :deep(ul),
.mia-markdown :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.35em;
}

.mia-markdown :deep(li) {
  margin: 0.25em 0;
}

.mia-markdown :deep(li > p) {
  margin: 0.2em 0;
}

.mia-markdown :deep(hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px dashed var(--c-cream-3);
}

.mia-markdown :deep(table) {
  width: 100%;
  margin: 0.75em 0;
  border-collapse: collapse;
  font-size: 0.95em;
}

.mia-markdown :deep(th),
.mia-markdown :deep(td) {
  padding: 8px 10px;
  border: 1px solid var(--c-cream-3);
  text-align: left;
  vertical-align: top;
}

.mia-markdown :deep(th) {
  background: var(--c-cream-2);
  font-weight: 800;
}

.mia-markdown :deep(tr:nth-child(even) td) {
  background: rgb(255 255 255 / 35%);
}

.mia-markdown :deep(blockquote) {
  margin: 0.75em 0;
  padding: 8px 12px;
  border-left: 3px solid var(--c-sky);
  background: var(--c-sky-soft);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
}

.mia-markdown :deep(code) {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--c-cream);
  border: 1px solid var(--c-cream-3);
  font-size: 0.92em;
}

.mia-markdown :deep(pre) {
  margin: 0.75em 0;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: var(--r-md);
  background: var(--c-cream);
  border: 1px solid var(--c-cream-3);
}

.mia-markdown :deep(pre code) {
  padding: 0;
  border: none;
  background: transparent;
}

.mia-markdown :deep(strong) {
  font-weight: 800;
  color: var(--c-ink);
}

.mia-markdown :deep(a) {
  color: var(--c-sky);
  font-weight: 700;
}

.mia-markdown :deep(:first-child) {
  margin-top: 0;
}

.mia-markdown :deep(:last-child) {
  margin-bottom: 0;
}
</style>
