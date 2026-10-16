<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { placePanel, useFloatingListeners } from '../composables/anchoredPanel.js'

// Small calendar popover for picking an expense date (same chrome as the month popover)
const props = defineProps({
  anchorEl: { type: Object, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  day: { type: Number, default: null }
})

const emit = defineEmits(['select', 'close'])

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const viewYear = ref(props.year)
const viewMonth = ref(props.month)
const focusDay = ref(props.day || 1)
const panelRef = ref(null)
const dayEls = {}
const pos = ref({ top: 0, left: 0, placement: 'below', ready: false })

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())
const leadingBlanks = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay())
const today = new Date()

function isSelected(d) {
  return d === props.day && viewMonth.value === props.month && viewYear.value === props.year
}
function isToday(d) {
  return d === today.getDate() && viewMonth.value === today.getMonth() && viewYear.value === today.getFullYear()
}

function shiftMonth(delta) {
  const date = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
  focusDay.value = Math.min(focusDay.value, daysInMonth.value)
}

function select(d) {
  emit('select', { year: viewYear.value, month: viewMonth.value, day: d })
  close()
}

function onGridKeydown(e) {
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key]
  if (step === undefined) return
  e.preventDefault()
  let next = focusDay.value + step
  if (next < 1) {
    shiftMonth(-1)
    next = daysInMonth.value + next
  } else if (next > daysInMonth.value) {
    next -= daysInMonth.value
    shiftMonth(1)
  }
  focusDay.value = next
  nextTick(() => dayEls[next]?.focus())
}

function reposition() {
  if (panelRef.value && props.anchorEl) pos.value = placePanel(props.anchorEl, panelRef.value, { gap: 6, align: 'start' })
}

const { attach, detach } = useFloatingListeners({
  reposition,
  onOutside: () => close(false),
  getEls: () => [panelRef.value, props.anchorEl]
})

function close(focusAnchor = true) {
  detach()
  emit('close')
  if (focusAnchor) props.anchorEl?.focus?.()
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close()
  }
}

onMounted(async () => {
  await nextTick()
  reposition()
  dayEls[focusDay.value]?.focus({ preventScroll: true })
  attach()
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="panelRef"
      class="months-popover date-popover"
      :class="`placed-${pos.placement}`"
      role="dialog"
      aria-label="Choose date"
      :style="{ top: `${pos.top}px`, left: `${pos.left}px`, visibility: pos.ready ? 'visible' : 'hidden' }"
      @keydown="onKeydown"
    >
      <div class="dp-header">
        <button type="button" class="dp-nav" aria-label="Previous month" @click="shiftMonth(-1)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
        </button>
        <div class="mp-title" aria-live="polite">{{ MONTH_NAMES[viewMonth] }} {{ viewYear }}</div>
        <button type="button" class="dp-nav" aria-label="Next month" @click="shiftMonth(1)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
        </button>
      </div>
      <div class="dp-grid" role="grid" @keydown="onGridKeydown">
        <span v-for="(w, i) in WEEKDAYS" :key="`w${i}`" class="dp-weekday" aria-hidden="true">{{ w }}</span>
        <span v-for="n in leadingBlanks" :key="`b${n}`" />
        <button
          v-for="d in daysInMonth"
          :key="d"
          :ref="el => (dayEls[d] = el)"
          type="button"
          class="dp-day"
          :class="{ selected: isSelected(d), today: isToday(d) }"
          :tabindex="d === focusDay ? 0 : -1"
          :aria-pressed="isSelected(d)"
          :aria-label="`${MONTH_NAMES[viewMonth]} ${d}, ${viewYear}`"
          @click="select(d)"
        >{{ d }}</button>
      </div>
    </div>
  </Teleport>
</template>
