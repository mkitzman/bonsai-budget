<script setup>
import { ref, nextTick } from 'vue'
import { placePanel, useFloatingListeners } from '../composables/anchoredPanel.js'

// A table cell whose value is picked from a small anchored menu (category, frequency, day).
const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, required: true }, // [{ value, label, dot? }]
  actions: { type: Array, default: () => [] }, // [{ key, label }] shown below a divider
  label: { type: String, required: true },
  align: { type: String, default: 'start' }
})

const emit = defineEmits(['update:modelValue', 'action', 'open', 'close'])

const open = ref(false)
const triggerRef = ref(null)
const panelRef = ref(null)
const pos = ref({ top: 0, left: 0, placement: 'below', ready: false })
const itemEls = []

function reposition() {
  if (open.value && triggerRef.value && panelRef.value) {
    pos.value = placePanel(triggerRef.value, panelRef.value, { gap: 4, align: props.align })
  }
}

const { attach, detach } = useFloatingListeners({
  reposition,
  onOutside: () => hide(false),
  getEls: () => [triggerRef.value, panelRef.value]
})

async function show() {
  pos.value = { ...pos.value, ready: false }
  open.value = true
  emit('open')
  await nextTick()
  reposition()
  const selected = props.options.findIndex(o => o.value === props.modelValue)
  const el = itemEls[Math.max(0, selected)]
  el?.scrollIntoView({ block: 'nearest' })
  el?.focus({ preventScroll: true })
  attach()
}

function hide(focusTrigger = true) {
  if (!open.value) return
  open.value = false
  detach()
  if (focusTrigger) triggerRef.value?.focus()
  emit('close')
}

function choose(option) {
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
  hide()
}

function runAction(action) {
  hide(false)
  emit('action', action.key)
}

function onKeydown(e) {
  const items = itemEls.filter(Boolean)
  const current = items.indexOf(document.activeElement)
  const moves = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: items.length - 1 }
  if (e.key in moves) {
    e.preventDefault()
    items[Math.min(items.length - 1, Math.max(0, moves[e.key]))]?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    hide()
  } else if (e.key === 'Tab') {
    hide(false)
  }
}

function onTriggerKeydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    show()
  }
}
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="cell-menu-trigger"
    aria-haspopup="menu"
    :aria-expanded="open"
    :aria-label="label"
    @click="open ? hide() : show()"
    @keydown="onTriggerKeydown"
  >
    <slot />
    <span class="menu-chevron" aria-hidden="true" />
  </button>
  <Teleport to="body">
    <Transition name="float">
      <div
        v-if="open"
        ref="panelRef"
        class="cell-menu"
        :class="`placed-${pos.placement}`"
        role="menu"
        :aria-label="label"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px`, visibility: pos.ready ? 'visible' : 'hidden' }"
        @keydown="onKeydown"
      >
        <button
          v-for="(option, i) in options"
          :key="option.value"
          :ref="el => (itemEls[i] = el)"
          type="button"
          class="cell-menu-item"
          :class="{ selected: option.value === modelValue }"
          role="menuitemradio"
          :aria-checked="option.value === modelValue"
          tabindex="-1"
          @click="choose(option)"
        >
          <span v-if="option.dot" class="cat-dot" :style="{ background: option.dot }" aria-hidden="true" />
          {{ option.label }}
        </button>
        <template v-if="actions.length">
          <div class="cell-menu-divider" role="separator" />
          <button
            v-for="(action, j) in actions"
            :key="action.key"
            :ref="el => (itemEls[options.length + j] = el)"
            type="button"
            class="cell-menu-item"
            role="menuitem"
            tabindex="-1"
            @click="runAction(action)"
          >{{ action.label }}</button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
