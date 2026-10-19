<script setup>
import { ref, computed, watch, nextTick, inject, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from '../composables/useStore.js'
import { money, MONTH_ABBR } from '../composables/useTableRows.js'
import { placePanel, useFloatingListeners } from '../composables/anchoredPanel.js'

// macOS Calendar–style month grid (handoff 11c): named chips per day, click a day for details
const store = useStore()
const navigate = inject('navigate', () => {})

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const today = new Date()
const viewYear = ref(store.selectedYear.value)
const viewMonth = ref(store.selectedMonth.value)

// Follow the page's month menu
watch(() => [store.selectedMonth.value, store.selectedYear.value], ([m, y]) => {
  viewMonth.value = m
  viewYear.value = y
  closePopover(false)
})

function step(delta) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
  closePopover(false)
}

function goToCurrentMonth() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
  closePopover(false)
}

const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())
const leadingPad = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay())

// --- Items -------------------------------------------------------------------
const hasOverrides = (item) => item.seasonalRates && Object.keys(item.seasonalRates).length > 0
// An override of 0 means "not charged this month"
const offThisMonth = (item) => {
  const rate = hasOverrides(item) ? item.seasonalRates[viewMonth.value] : undefined
  return rate !== undefined && rate !== null && Number(rate) === 0
}

// Day → items charged that day this month. Spread bills aren't placed; days past the
// end of a short month land on its last day (same rule as pay periods).
const itemsByDay = computed(() => {
  const m = viewMonth.value
  const byDay = new Map()
  const place = (day, item) => {
    const d = Math.min(Math.max(1, day), daysInMonth.value)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(item)
  }
  store.bills.value.forEach(b => {
    if (b.dueDate === 'spread' || !Number(b.dueDate) || offThisMonth(b)) return
    place(Number(b.dueDate), { key: `b-${b.id}`, type: 'bill', name: b.name || 'Untitled bill', category: b.category || 'Needs', amount: store.getBillAmountForMonth(b, m) })
  })
  store.subscriptions.value.forEach(s => {
    if (!Number(s.renewalDate) || offThisMonth(s)) return
    place(Number(s.renewalDate), { key: `s-${s.id}`, type: 'sub', name: s.name || 'Untitled subscription', category: s.category || 'Needs', amount: store.getSubscriptionAmountForMonth(s, m) })
  })
  // Bills before subscriptions, then largest first
  byDay.forEach(list => list.sort((a, b) => (a.type === b.type ? b.amount - a.amount : a.type === 'bill' ? -1 : 1)))
  return byDay
})

const monthTotal = computed(() => {
  let total = 0
  itemsByDay.value.forEach(list => list.forEach(i => { total += i.amount }))
  return total
})

const isCurrentMonth = computed(() => viewMonth.value === today.getMonth() && viewYear.value === today.getFullYear())

// Still to come this month: anything due today or later
const remainingDue = computed(() => {
  let total = 0
  itemsByDay.value.forEach((list, day) => {
    if (day >= today.getDate()) list.forEach(i => { total += i.amount })
  })
  return total
})

const cells = computed(() => {
  const out = []
  for (let i = 0; i < leadingPad.value; i++) out.push({ key: `lead-${i}`, pad: true })
  for (let d = 1; d <= daysInMonth.value; d++) {
    const items = itemsByDay.value.get(d) || []
    out.push({
      key: `d-${d}`,
      day: d,
      items,
      hasBills: items.some(i => i.type === 'bill'),
      hasSubs: items.some(i => i.type === 'sub'),
      isToday: d === today.getDate() && viewMonth.value === today.getMonth() && viewYear.value === today.getFullYear()
    })
  }
  while (out.length % 7) out.push({ key: `trail-${out.length}`, pad: true })
  return out
})

// Chips per cell: 2 on desktop, 1 at ≤1024px; dots only at ≤720px
const mqTablet = window.matchMedia('(max-width: 1024px)')
const mqPhone = window.matchMedia('(max-width: 720px)')
const isTablet = ref(mqTablet.matches)
const isPhone = ref(mqPhone.matches)
const onMq = () => { isTablet.value = mqTablet.matches; isPhone.value = mqPhone.matches }
onMounted(() => { mqTablet.addEventListener('change', onMq); mqPhone.addEventListener('change', onMq) })
onBeforeUnmount(() => { mqTablet.removeEventListener('change', onMq); mqPhone.removeEventListener('change', onMq) })
const chipLimit = computed(() => (isTablet.value ? 1 : 2))

const chipClass = (item) => [item.type === 'bill' ? 'is-bill' : 'is-sub', item.category === 'Wants' ? 'outlined' : 'filled']
const typeLabel = (item) => (item.type === 'bill' ? 'Bill' : 'Subscription')

function cellLabel(cell) {
  const n = cell.items.length
  return `${MONTH_NAMES[viewMonth.value]} ${cell.day}${cell.isToday ? ', today' : ''}: ${n ? `${n} due, ${money(cell.items.reduce((s, i) => s + i.amount, 0))}` : 'nothing due'}`
}

// --- Day popover ---------------------------------------------------------------
const gridRef = ref(null)
const panelRef = ref(null)
const dayEls = {}
const selectedDay = ref(null)
const pos = ref({ top: 0, left: 0, placement: 'below', ready: false, arrowX: 160 })

const selectedItems = computed(() => (selectedDay.value ? itemsByDay.value.get(selectedDay.value) || [] : []))
const selectedTotal = computed(() => selectedItems.value.reduce((s, i) => s + i.amount, 0))
const selectedTitle = computed(() => {
  if (!selectedDay.value) return ''
  const date = new Date(viewYear.value, viewMonth.value, selectedDay.value)
  return `${WEEKDAYS_LONG[date.getDay()]}, ${MONTH_ABBR[viewMonth.value]} ${selectedDay.value}`
})
const openLinks = computed(() => {
  const types = new Set(selectedItems.value.map(i => i.type))
  const links = []
  if (types.has('bill')) links.push({ tab: 'Bills', label: 'Open in Bills' })
  if (types.has('sub')) links.push({ tab: 'Subscriptions', label: 'Open in Subscriptions' })
  // Whichever type comes first in the list leads
  if (selectedItems.value[0]?.type === 'sub') links.reverse()
  return links
})

function reposition() {
  if (isPhone.value || !selectedDay.value || !panelRef.value || !dayEls[selectedDay.value]) return
  pos.value = placePanel(dayEls[selectedDay.value], panelRef.value, {
    gap: 8,
    align: 'center',
    bounds: gridRef.value?.getBoundingClientRect()
  })
}

const { attach, detach } = useFloatingListeners({
  reposition,
  onOutside: () => closePopover(false),
  getEls: () => [panelRef.value, selectedDay.value ? dayEls[selectedDay.value] : null]
})

async function openDay(day) {
  if (selectedDay.value === day) {
    closePopover(false)
    return
  }
  const wasOpen = !!selectedDay.value
  selectedDay.value = day
  pos.value = { ...pos.value, ready: isPhone.value }
  await nextTick()
  reposition()
  // Wait for the positioned (now visible) panel before focusing — hidden elements can't take focus
  await nextTick()
  panelRef.value?.focus({ preventScroll: true })
  if (!wasOpen) attach()
}

function closePopover(focusCell = true) {
  if (!selectedDay.value) return
  const day = selectedDay.value
  selectedDay.value = null
  detach()
  if (focusCell) dayEls[day]?.focus()
}

// Arrow keys move the selection between days while the popover is open
async function onPopoverKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closePopover()
    return
  }
  const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
  if (delta === undefined || !selectedDay.value) return
  e.preventDefault()
  const next = selectedDay.value + delta
  if (next < 1 || next > daysInMonth.value) return
  selectedDay.value = next
  await nextTick()
  reposition()
}

function openPage(tab) {
  store.selectedYear.value = viewYear.value
  store.selectedMonth.value = viewMonth.value
  closePopover(false)
  navigate(tab)
}
</script>

<template>
  <section class="calendar" aria-labelledby="calendar-title">
    <div class="cal-titlebar">
      <div class="cal-title-group">
        <h2 id="calendar-title" class="cal-title">Calendar</h2>
        <span class="cal-due">
          {{ money(monthTotal) }} total<template v-if="isCurrentMonth"><span class="cal-sep" aria-hidden="true">/</span><span class="visually-hidden">, </span>{{ money(remainingDue) }} remaining</template>
        </span>
      </div>
      <div class="cal-stepper" role="group" aria-label="Month">
        <button type="button" class="stepper-arrow" aria-label="Previous month" @click="step(-1)">
          <svg viewBox="0 0 8 12" aria-hidden="true"><path d="M6.5 1L1.5 6l5 5" /></svg>
        </button>
        <button type="button" class="stepper-label" title="Go to this month" @click="goToCurrentMonth">{{ MONTH_NAMES[viewMonth] }} {{ viewYear }}</button>
        <button type="button" class="stepper-arrow" aria-label="Next month" @click="step(1)">
          <svg viewBox="0 0 8 12" aria-hidden="true"><path d="M1.5 1l5 5-5 5" /></svg>
        </button>
      </div>
    </div>

    <div class="cal-wrap">
      <div ref="gridRef" class="cal-card">
        <div class="cal-weekdays" aria-hidden="true">
          <span v-for="w in WEEKDAYS" :key="w">{{ w }}</span>
        </div>
        <div class="cal-grid">
          <template v-for="cell in cells" :key="cell.key">
            <div v-if="cell.pad" class="cal-cell pad" aria-hidden="true" />
            <button
              v-else
              :ref="el => (dayEls[cell.day] = el)"
              type="button"
              class="cal-cell"
              :class="{ selected: selectedDay === cell.day }"
              :aria-label="cellLabel(cell)"
              :aria-expanded="selectedDay === cell.day"
              aria-haspopup="dialog"
              @click="openDay(cell.day)"
            >
              <span class="cal-num-row">
                <span class="cal-num" :class="{ today: cell.isToday }">{{ cell.day }}</span>
              </span>
              <template v-if="isPhone">
                <span v-if="cell.items.length" class="cal-dots" aria-hidden="true">
                  <span v-if="cell.hasBills" class="cal-dot is-bill" />
                  <span v-if="cell.hasSubs" class="cal-dot is-sub" />
                </span>
              </template>
              <template v-else>
                <span v-for="item in cell.items.slice(0, chipLimit)" :key="item.key" class="chip" :class="chipClass(item)" aria-hidden="true">
                  <span class="chip-name">{{ item.name }}</span>
                </span>
                <span v-if="cell.items.length > chipLimit" class="cal-more" aria-hidden="true">+{{ cell.items.length - chipLimit }} more</span>
              </template>
            </button>
          </template>
        </div>
      </div>
    </div>

    <div class="cal-legend" aria-hidden="true">
      <span class="legend-item"><span class="legend-swatch is-bill" />Bills</span>
      <span class="legend-item"><span class="legend-swatch is-sub" />Subscriptions</span>
      <span class="legend-divider" />
      <span class="legend-item"><span class="legend-sample filled" />Needs</span>
      <span class="legend-item"><span class="legend-sample outlined" />Wants</span>
    </div>

    <Teleport to="body">
      <div v-if="selectedDay && isPhone" class="sheet-scrim" aria-hidden="true" />
      <div
        v-if="selectedDay"
        ref="panelRef"
        class="day-popover"
        :class="[isPhone ? 'as-sheet' : `placed-${pos.placement}`]"
        role="dialog"
        :aria-label="`Due on ${selectedTitle}`"
        tabindex="-1"
        :style="isPhone ? null : { top: `${pos.top}px`, left: `${pos.left}px`, visibility: pos.ready ? 'visible' : 'hidden', '--arrow-x': `${pos.arrowX}px` }"
        @keydown="onPopoverKeydown"
      >
        <span v-if="!isPhone" class="dp-arrow" aria-hidden="true" />
        <div class="dp-head">
          <span class="dp-date">{{ selectedTitle }}</span>
          <span class="dp-count">{{ selectedItems.length }} due</span>
        </div>

        <p v-if="!selectedItems.length" class="dp-empty">Nothing due</p>
        <template v-else>
          <ul class="dp-list">
            <li v-for="item in selectedItems" :key="item.key">
              <button type="button" class="dp-row" @click="openPage(item.type === 'bill' ? 'Bills' : 'Subscriptions')">
                <span class="dp-bar" :class="chipClass(item)" aria-hidden="true" />
                <span class="dp-text">
                  <span class="dp-name">{{ item.name }}</span>
                  <span class="dp-meta">{{ typeLabel(item) }} · {{ item.category }}</span>
                </span>
                <span class="dp-amount">{{ money(item.amount) }}</span>
              </button>
            </li>
          </ul>
          <div class="dp-total">
            <span>Total</span>
            <span class="dp-total-value">{{ money(selectedTotal) }}</span>
          </div>
          <div class="dp-links">
            <button v-for="link in openLinks" :key="link.tab" type="button" class="dp-link" @click="openPage(link.tab)">{{ link.label }}</button>
          </div>
        </template>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
/* Title row: section title + month total, segmented month stepper on the right */
.cal-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.cal-title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  flex-wrap: wrap;
}

.cal-title {
  font-family: var(--font);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--text-primary);
}

.cal-due {
  font-size: 15px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.cal-sep {
  margin: 0 8px;
  color: var(--text-tertiary);
}

.cal-stepper {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 9px;
  background: var(--segment-track);
  flex-shrink: 0;
}

.stepper-arrow {
  width: 30px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--text-body);
  cursor: pointer;
}

.stepper-arrow:hover {
  background: var(--action-hover);
}

.stepper-arrow svg {
  width: 7px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.stepper-label {
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 7px;
  background: var(--segment-thumb);
  box-shadow: var(--segment-thumb-shadow);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  color: var(--segment-label-active);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  cursor: pointer;
}

.stepper-arrow:focus-visible,
.stepper-label:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.5);
}

/* Grid card — hairlines are the 1px gaps showing the grid background through */
.cal-wrap {
  position: relative;
}

.cal-card {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--card-ring);
  overflow: hidden;
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid var(--popover-ring);
}

.cal-weekdays span {
  padding: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-align: right;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: 104px;
  gap: 1px;
  background: var(--row-divider);
}

.cal-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  min-width: 0;
  padding: 4px 6px 6px;
  border: none;
  background: var(--surface);
  font-family: var(--font);
  text-align: left;
  overflow: hidden;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.cal-cell.pad {
  background: var(--section-bg);
  cursor: default;
}

.cal-cell:not(.pad):hover {
  background: var(--row-hover);
}

.cal-cell.selected,
.cal-cell.selected:hover {
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

.cal-cell:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent);
}

.cal-num-row {
  display: flex;
  justify-content: flex-end;
  height: 24px;
  align-items: center;
  flex-shrink: 0;
}

.cal-num {
  min-width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.cal-num.today {
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

/* Chips: color = type (bill/subscription), fill = category (Needs filled, Wants outlined) */
.chip {
  display: flex;
  align-items: center;
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  overflow: hidden;
  flex-shrink: 0;
}

.chip-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.chip.is-bill { color: var(--type-bill-text); }
.chip.is-sub { color: var(--type-sub-text); }
.chip.filled.is-bill { background: var(--type-bill-tint); }
.chip.filled.is-sub { background: var(--type-sub-tint); }
.chip.outlined { background: var(--surface); }
.chip.outlined.is-bill { box-shadow: inset 0 0 0 1px var(--type-bill-outline); }
.chip.outlined.is-sub { box-shadow: inset 0 0 0 1px var(--type-sub-outline); }

.cal-more {
  padding: 0 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}

.cal-dots {
  display: flex;
  justify-content: center;
  gap: 3px;
}

.cal-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cal-dot.is-bill { background: var(--type-bill); }
.cal-dot.is-sub { background: var(--type-sub); }

/* Legend */
.cal-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  padding: 16px 4px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-swatch.is-bill { background: var(--type-bill); }
.legend-swatch.is-sub { background: var(--type-sub); }

.legend-divider {
  width: 1px;
  height: 12px;
  background: var(--border);
}

.legend-sample {
  width: 18px;
  height: 10px;
  border-radius: 3px;
}

.legend-sample.filled { background: rgba(60, 60, 67, 0.18); }
.legend-sample.outlined { box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.45); }

[data-theme="dark"] .legend-sample.filled { background: rgba(235, 235, 245, 0.2); }
[data-theme="dark"] .legend-sample.outlined { box-shadow: inset 0 0 0 1px rgba(235, 235, 245, 0.45); }

/* Day popover — same chrome as the charged-months popover */
.day-popover {
  position: fixed;
  z-index: 200;
  width: 320px;
  padding: 14px 16px;
  background: var(--popover-bg);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  backdrop-filter: saturate(180%) blur(24px);
  border-radius: 14px;
  box-shadow: 0 0 0 0.5px var(--popover-ring), 0 18px 50px rgba(0, 0, 0, 0.18);
  font-variant-numeric: tabular-nums;
  transform-origin: var(--arrow-x, 50%) top;
  animation: popover-in 160ms ease-out;
  outline: none;
}

.day-popover.placed-above {
  transform-origin: var(--arrow-x, 50%) bottom;
}

.dp-arrow {
  position: absolute;
  left: calc(var(--arrow-x) - 6px);
  top: -6px;
  width: 12px;
  height: 12px;
  background: inherit;
  transform: rotate(45deg);
  border-radius: 2px;
  box-shadow: -0.5px -0.5px 0 0 var(--popover-ring);
}

.placed-above .dp-arrow {
  top: auto;
  bottom: -6px;
  box-shadow: 0.5px 0.5px 0 0 var(--popover-ring);
}

.dp-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--popover-ring);
}

.dp-date {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.dp-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.dp-empty {
  padding: 16px 0 4px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
}

.dp-list {
  list-style: none;
  max-height: 320px;
  overflow-y: auto;
}

.dp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 4px 0;
  border: none;
  border-bottom: 1px solid var(--row-divider);
  background: none;
  font-family: var(--font);
  text-align: left;
  cursor: pointer;
}

.dp-row:hover .dp-name {
  color: var(--accent-text);
}

.dp-row:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--accent);
  border-radius: 6px;
}

.dp-bar {
  width: 4px;
  height: 24px;
  border-radius: 2px;
  flex-shrink: 0;
}

.dp-bar.filled.is-bill { background: var(--type-bill); }
.dp-bar.filled.is-sub { background: var(--type-sub); }
.dp-bar.outlined.is-bill { box-shadow: inset 0 0 0 1px var(--type-bill); }
.dp-bar.outlined.is-sub { box-shadow: inset 0 0 0 1px var(--type-sub); }

.dp-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.dp-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 120ms ease;
}

.dp-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.dp-amount {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.dp-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.dp-total-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.dp-links {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}

.dp-link {
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-text);
  cursor: pointer;
  border-radius: 4px;
}

.dp-link:hover {
  text-decoration: underline;
}

/* Phone: the day detail is a bottom sheet */
.day-popover.as-sheet {
  top: auto;
  left: 0;
  right: 0;
  bottom: 0;
  width: auto;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  border-radius: 14px 14px 0 0;
  background: var(--material-thick);
  animation: sheet-in var(--spring-duration) var(--spring);
}

@media (max-width: 1024px) {
  .cal-grid {
    grid-auto-rows: 88px;
  }
}

@media (max-width: 720px) {
  .cal-grid {
    grid-auto-rows: 56px;
  }
  .cal-cell {
    align-items: center;
    padding: 4px 2px;
  }
  .cal-num-row {
    justify-content: center;
  }
  .cal-weekdays span {
    padding: 8px 0;
    text-align: center;
  }
  .cal-titlebar {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .day-popover,
  .day-popover.as-sheet {
    animation: popover-fade 0.15s ease;
  }
}
</style>
