<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'

// Plain-text cell that turns into an input in place when clicked.
// Enter (or blur) saves, Esc cancels; textarea mode allows Shift+Enter for new lines.
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' }, // 'text' | 'number' | 'textarea'
  placeholder: { type: String, default: '' },
  format: { type: Function, default: null },
  label: { type: String, required: true },
  autoEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'editing'])

const editing = ref(false)
const draft = ref('')
const inputRef = ref(null)
const displayRef = ref(null)

const isEmpty = computed(() => props.modelValue === '' || props.modelValue === null || props.modelValue === undefined)
const shown = computed(() => (props.format ? props.format(props.modelValue) : props.modelValue))

function start() {
  draft.value = props.modelValue ?? ''
  editing.value = true
  emit('editing', true)
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select?.()
  })
}

function commit() {
  if (!editing.value) return
  editing.value = false
  let value = draft.value
  if (props.type === 'number') value = Number(value) || 0
  else value = String(value).trim()
  if (value !== props.modelValue) emit('update:modelValue', value)
  emit('editing', false)
}

function cancel() {
  editing.value = false
  emit('editing', false)
}

// After a keyboard save/cancel, keep focus on the cell so the user doesn't lose their place
function refocus() {
  nextTick(() => displayRef.value?.focus())
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    cancel()
    refocus()
  } else if (e.key === 'Enter' && !(props.type === 'textarea' && e.shiftKey)) {
    e.preventDefault()
    commit()
    refocus()
  }
}

onMounted(() => { if (props.autoEdit) start() })
defineExpose({ start })
</script>

<template>
  <div class="inline-edit" :class="{ editing }">
    <template v-if="editing">
      <textarea
        v-if="type === 'textarea'"
        ref="inputRef"
        v-model="draft"
        rows="1"
        class="inline-input inline-textarea"
        :placeholder="placeholder"
        :aria-label="label"
        @blur="commit"
        @keydown="onKeydown"
      />
      <input
        v-else
        ref="inputRef"
        v-model="draft"
        :type="type === 'number' ? 'number' : 'text'"
        :step="type === 'number' ? '0.01' : undefined"
        :inputmode="type === 'number' ? 'decimal' : undefined"
        class="inline-input"
        :placeholder="placeholder"
        :aria-label="label"
        @blur="commit"
        @keydown="onKeydown"
      />
    </template>
    <button
      v-else
      ref="displayRef"
      type="button"
      class="inline-display"
      :class="{ placeholder: isEmpty }"
      :title="isEmpty ? undefined : String(shown)"
      :aria-label="`${label}: ${isEmpty ? 'empty' : shown}`"
      @click="start"
    >{{ isEmpty ? placeholder : shown }}</button>
  </div>
</template>
