<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { placePanel, useFloatingListeners } from '../composables/anchoredPanel.js'
import { money, moneyCompact, MONTH_ABBR } from '../composables/useTableRows.js'

/*
 * "Charged months" popover. Reads/writes the existing seasonalRates map:
 *   undefined/null → charged at base, 0 → not charged, number → charged at that amount.
 * With no overrides yet, Monthly items (and bills) are charged every month; Yearly and
 * Quarterly ones preview a default schedule anchored on the selected month. Nothing is
 * saved until a month or amount is changed.
 */
const props = defineProps({
  anchorEl: { type: Object, required: true },
  name: { type: String, default: '' },
  baseAmount: { type: Number, default: 0 },
  rates: { type: Object, default: () => ({}) },
  frequency: { type: String, default: 'Monthly' },
  selectedMonth: { type: Number, required: true }
})

const emit = defineEmits(['update:rates', 'close'])

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const panelRef = ref(null)
const monthEls = []
const activeMonth = ref(props.selectedMonth)
const isSheet = ref(window.matchMedia('(max-width: 820px)').matches)
const pos = ref({ top: 0, left: 0, placement: 'below', ready: isSheet.value })

const hasOverrides = computed(() => Object.keys(props.rates || {}).length > 0)
const chargesEveryMonth = computed(() => props.frequency !== 'Yearly' && props.frequency !== 'Quarterly')

function chargedByDefault(m) {
  if (props.frequency === 'Yearly') return m === props.selectedMonth
  if (props.frequency === 'Quarterly') return (((m - props.selectedMonth) % 3) + 3) % 3 === 0
  return true
}

function monthState(m) {
  if (hasOverrides.value) {
    const v = props.rates[m]
    if (v === undefined || v === null) return { charged: true, amount: props.baseAmount }
    const n = Number(v)
    return n === 0 ? { charged: false, amount: 0 } : { charged: true, amount: n }
  }
  return chargedByDefault(m) ? { charged: true, amount: props.baseAmount } : { charged: false, amount: 0 }
}

const months = computed(() => MONTH_ABBR.map((abbr, m) => ({ m, abbr, ...monthState(m) })))

// Start from the stored overrides, or spell out the default schedule on first edit
function materialize() {
  if (hasOverrides.value) return { ...props.rates }
  if (chargesEveryMonth.value) return {}
  const r = {}
  for (let m = 0; m < 12; m++) if (!chargedByDefault(m)) r[m] = 0
  return r
}

function write(r) {
  // An empty map means "no overrides", which for Yearly/Quarterly items falls back to an
  // even monthly spread — so keep every month explicit instead.
  if (Object.keys(r).length === 0 && !chargesEveryMonth.value) {
    for (let m = 0; m < 12; m++) r[m] = props.baseAmount
  }
  emit('update:rates', r)
}

function toggle(m) {
  activeMonth.value = m
  const r = materialize()
  if (monthState(m).charged) r[m] = 0
  else delete r[m]
  write(r)
}

// Amount field for the active month — updates live; 0 un-charges the month
const amountFocused = ref(false)
const amountDraft = ref('')
const activeState = computed(() => monthState(activeMonth.value))

function onAmountFocus() {
  amountFocused.value = true
  amountDraft.value = activeState.value.charged ? String(activeState.value.amount) : '0'
}

function onAmountInput(e) {
  amountDraft.value = e.target.value
  if (amountDraft.value.trim() === '') return
  const value = Number(amountDraft.value)
  if (Number.isNaN(value)) return
  const r = materialize()
  const m = activeMonth.value
  if (value === 0) r[m] = 0
  else if (value === props.baseAmount) delete r[m]
  else r[m] = value
  write(r)
}

function onAmountKeydown(e) {
  if (e.key === 'Enter') e.target.blur()
}

// Keyboard: arrows move across the 4×3 grid, Space/Enter toggles (native button)
function onGridKeydown(e) {
  const i = monthEls.indexOf(document.activeElement)
  if (i < 0) return
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[e.key]
  if (step === undefined) return
  e.preventDefault()
  const next = Math.min(11, Math.max(0, i + step))
  monthEls[next]?.focus()
}

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

function reposition() {
  if (isSheet.value || !panelRef.value || !props.anchorEl) return
  pos.value = placePanel(props.anchorEl, panelRef.value, { gap: 8, align: 'end' })
}

const { attach, detach } = useFloatingListeners({
  reposition,
  onOutside: () => close(false),
  getEls: () => [panelRef.value, props.anchorEl]
})

onMounted(async () => {
  await nextTick()
  reposition()
  monthEls[activeMonth.value]?.focus({ preventScroll: true })
  attach()
})

defineExpose({ close })
</script>

<template>
  <Teleport to="body">
    <div v-if="isSheet" class="sheet-scrim" aria-hidden="true" />
    <div
      ref="panelRef"
      class="months-popover"
      :class="[isSheet ? 'as-sheet' : `placed-${pos.placement}`]"
      role="dialog"
      :aria-label="`Charged months for ${name || 'item'}`"
      :style="isSheet ? null : { top: `${pos.top}px`, left: `${pos.left}px`, visibility: pos.ready ? 'visible' : 'hidden' }"
      @keydown="onKeydown"
    >
      <div>
        <div class="mp-title">Charged months</div>
        <div class="mp-subtitle">{{ name || 'Untitled' }} · base {{ money(baseAmount) }}</div>
      </div>

      <div class="mp-grid" @keydown="onGridKeydown">
        <button
          v-for="month in months"
          :key="month.m"
          :ref="el => (monthEls[month.m] = el)"
          type="button"
          class="mp-month"
          :class="{ charged: month.charged, current: month.m === selectedMonth, active: month.m === activeMonth }"
          :tabindex="month.m === activeMonth ? 0 : -1"
          :aria-pressed="month.charged"
          :aria-label="`${MONTH_NAMES[month.m]}: ${month.charged ? `charged ${money(month.amount)}` : 'not charged'}`"
          @click="toggle(month.m)"
        >
          <span class="mp-abbr">{{ month.abbr }}</span>
          <span class="mp-amount">{{ month.charged ? moneyCompact(month.amount) : '—' }}</span>
        </button>
      </div>

      <div class="mp-amount-row">
        <label class="mp-amount-label" for="mp-amount-input">Amount in <strong>{{ MONTH_NAMES[activeMonth] }}</strong></label>
        <input
          id="mp-amount-input"
          class="mp-amount-input"
          type="text"
          inputmode="decimal"
          :value="amountFocused ? amountDraft : money(activeState.amount)"
          @focus="onAmountFocus"
          @blur="amountFocused = false"
          @input="onAmountInput"
          @keydown="onAmountKeydown"
        />
      </div>

      <p class="mp-help">Tap a month to toggle it. Selected months use the base amount unless you change it.</p>
    </div>
  </Teleport>
</template>
