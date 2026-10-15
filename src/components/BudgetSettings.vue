<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'

const store = useStore()
const emit = defineEmits(['close'])

const needs = ref(Math.round(store.categoryTargets.value.Needs * 100))
const wants = ref(Math.round(store.categoryTargets.value.Wants * 100))
const savings = ref(Math.round(store.categoryTargets.value.Savings * 100))
const includeExpenses = ref(store.includeExpenses.value)

const presets = [
  { label: 'Standard', values: [50, 30, 20] },
  { label: 'Lean / HCOL', values: [60, 20, 20] },
  { label: 'Aggressive Saver', values: [40, 10, 50] },
]

function applyPreset(values) {
  needs.value = values[0]
  wants.value = values[1]
  savings.value = values[2]
}

function isActivePreset(values) {
  return needs.value === values[0] && wants.value === values[1] && savings.value === values[2]
}

function adjustLinked(changed, delta) {
  const others = ['needs', 'wants', 'savings'].filter(k => k !== changed)
  const refs = { needs, wants, savings }
  const total = refs[others[0]].value + refs[others[1]].value

  if (total === 0) {
    refs[others[0]].value = Math.round(-delta / 2)
    refs[others[1]].value = -delta - Math.round(-delta / 2)
    return
  }

  const ratio0 = refs[others[0]].value / total
  const adj0 = Math.round(-delta * ratio0)
  const adj1 = -delta - adj0

  refs[others[0]].value = Math.max(0, Math.min(100, refs[others[0]].value + adj0))
  refs[others[1]].value = Math.max(0, Math.min(100, refs[others[1]].value + adj1))

  // Ensure total is exactly 100
  const sum = needs.value + wants.value + savings.value
  if (sum !== 100) {
    const diff = 100 - sum
    // Apply remainder to the largest other bucket
    const largest = refs[others[0]].value >= refs[others[1]].value ? others[0] : others[1]
    refs[largest].value = Math.max(0, refs[largest].value + diff)
  }
}

function onSlider(field, event) {
  const refs = { needs, wants, savings }
  const oldVal = refs[field].value
  const newVal = Number(event.target.value)
  const delta = newVal - oldVal
  refs[field].value = newVal
  adjustLinked(field, delta)
}

function save() {
  store.setCategoryTargets({
    Needs: needs.value / 100,
    Wants: wants.value / 100,
    Savings: savings.value / 100
  })
  store.includeExpenses.value = includeExpenses.value
  emit('close')
}

const dialogRef = ref(null)
onMounted(() => nextTick(() => dialogRef.value?.focus()))

const categoryColors = {
  get needs() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-needs').trim() },
  get wants() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-wants').trim() },
  get savings() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-savings').trim() },
}
</script>

<template>
  <div class="confirm-overlay" @click.self="$emit('close')" @keydown.escape="$emit('close')">
    <div class="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="budget-settings-title" ref="dialogRef" tabindex="-1">
      <h3 id="budget-settings-title">Budget Strategy</h3>

      <div class="presets">
        <button
          v-for="p in presets"
          :key="p.label"
          class="preset-btn"
          :class="{ active: isActivePreset(p.values) }"
          @click="applyPreset(p.values)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="sliders">
        <div class="slider-row">
          <label>
            <span class="slider-dot" :style="{ background: categoryColors.needs }" />
            Needs
          </label>
          <input type="range" min="0" max="100" :value="needs" @input="onSlider('needs', $event)" />
          <span class="slider-value">{{ needs }}%</span>
        </div>
        <div class="slider-row">
          <label>
            <span class="slider-dot" :style="{ background: categoryColors.wants }" />
            Wants
          </label>
          <input type="range" min="0" max="100" :value="wants" @input="onSlider('wants', $event)" />
          <span class="slider-value">{{ wants }}%</span>
        </div>
        <div class="slider-row">
          <label>
            <span class="slider-dot" :style="{ background: categoryColors.savings }" />
            Savings
          </label>
          <input type="range" min="0" max="100" :value="savings" @input="onSlider('savings', $event)" />
          <span class="slider-value">{{ savings }}%</span>
        </div>
      </div>

      <div class="preview-bar">
        <div class="preview-segment" :style="{ width: needs + '%', background: categoryColors.needs }" />
        <div class="preview-segment" :style="{ width: wants + '%', background: categoryColors.wants }" />
        <div class="preview-segment" :style="{ width: savings + '%', background: categoryColors.savings }" />
      </div>

      <label class="toggle-row">
        <span class="toggle-label">
          Include Expenses
          <span class="toggle-hint">Factor one-time expenses into the budget</span>
        </span>
        <span class="toggle-switch" :class="{ on: includeExpenses }">
          <input type="checkbox" v-model="includeExpenses" />
          <span class="toggle-track" />
          <span class="toggle-thumb" />
        </span>
      </label>

      <div class="actions">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn" @click="save">Apply</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-dialog {
  background: var(--material-thick);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border-radius: 16px;
  padding: 24px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 0 0 0.5px var(--material-edge) inset, 0 20px 50px rgba(0, 0, 0, 0.25);
}

.settings-dialog h3 {
  margin-bottom: 16px;
  text-align: center;
}

/* Segmented control */
.presets {
  display: flex;
  gap: 2px;
  padding: 2px;
  margin-bottom: 20px;
  background: var(--fill);
  border-radius: 9px;
}

.preset-btn {
  flex: 1;
  padding: 6px 4px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  touch-action: manipulation;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform var(--spring-duration) var(--spring);
}

.preset-btn:active {
  transform: scale(0.95);
  transition-duration: var(--press-duration);
}

.preset-btn.active {
  background: var(--surface);
  font-weight: 600;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04);
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-row label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 80px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.slider-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--fill-strong);
  border-radius: 2px;
  outline: none;
}

.slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  cursor: grab;
  border: none;
  box-shadow: 0 0.5px 4px rgba(0, 0, 0, 0.12), 0 6px 13px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease;
}

.slider-row input[type="range"]:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.12);
}

.slider-row input[type="range"]::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 0.5px 4px rgba(0, 0, 0, 0.12), 0 6px 13px rgba(0, 0, 0, 0.12);
}

.slider-value {
  width: 40px;
  text-align: right;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.preview-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}

.preview-segment {
  transition: width var(--spring-duration) var(--spring);
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  margin-bottom: 8px;
  border-top: 0.5px solid var(--border);
  cursor: pointer;
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
  font-weight: 600;
}

.toggle-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 51px;
  height: 31px;
  flex-shrink: 0;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.toggle-track {
  position: absolute;
  inset: 0;
  background: var(--fill-strong);
  border-radius: 16px;
  transition: background-color 0.25s ease;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16);
  transition: transform var(--spring-duration) var(--spring), width var(--spring-duration) var(--spring);
  pointer-events: none;
}

.toggle-switch.on .toggle-track {
  background: var(--green);
}

.toggle-switch.on .toggle-thumb {
  transform: translateX(20px);
}

/* Thumb stretches toward its destination while pressed */
.toggle-row:active .toggle-thumb { width: 33px; }
.toggle-row:active .toggle-switch.on .toggle-thumb { transform: translateX(14px); }
</style>
