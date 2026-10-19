<script setup>
import { computed, ref, inject } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  labels: { type: Array, default: () => [] },
  data: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] },
  title: { type: String, default: '' }
})

const palette = inject('palette', ref('apple'))

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const defaultColors = computed(() => {
  void palette.value
  const g = getCSSVar('--green')
  const o = getCSSVar('--orange')
  const r = getCSSVar('--red')
  const t = getCSSVar('--teal')
  const y = getCSSVar('--yellow')
  const cn = getCSSVar('--cat-needs')
  const cw = getCSSVar('--cat-wants')
  const cs = getCSSVar('--cat-savings')
  return [cn, o, cw, r, cs, t, y, g, '#9b7a7a', '#8c7b6b']
})

const resolvedColors = computed(() =>
  props.colors.length ? props.colors : defaultColors.value.slice(0, props.data.length)
)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.data,
    backgroundColor: resolvedColors.value,
    borderWidth: 0,
    hoverBorderWidth: 2,
    hoverBorderColor: '#fff'
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '60%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(28, 28, 30, 0.95)',
      titleFont: { size: 13, weight: '600' },
      bodyFont: { size: 13 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toFixed(2)}`
      }
    }
  }
}

const hasData = computed(() => props.data.some(v => v > 0))

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const total = computed(() => props.data.reduce((sum, v) => sum + (Number(v) || 0), 0))

const VISIBLE_COUNT = 5
const expanded = ref(false)

const rankedItems = computed(() => {
  const items = props.labels.map((label, i) => ({
    label,
    value: Number(props.data[i]) || 0,
    color: resolvedColors.value[i] || '#8e8e93'
  }))
  return items
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
})

const visibleItems = computed(() =>
  expanded.value ? rankedItems.value : rankedItems.value.slice(0, VISIBLE_COUNT)
)

const hasMore = computed(() => rankedItems.value.length > VISIBLE_COUNT)
const hiddenCount = computed(() => rankedItems.value.length - VISIBLE_COUNT)
</script>

<template>
  <div class="pie-chart-wrapper card">
    <h3 class="mb-8">{{ title }}</h3>
    <template v-if="hasData">
      <div class="chart-area">
        <Doughnut :data="chartData" :options="chartOptions" :aria-label="`${title} breakdown chart, $${fmt(total)} total. Amounts are listed below.`" />
        <div class="chart-center">
          <span class="center-amount">${{ fmt(total) }}</span>
        </div>
      </div>
      <div class="ranked-list">
        <div v-for="(item, i) in visibleItems" :key="i" class="ranked-item">
          <span class="ranked-dot" :style="{ background: item.color }" />
          <span class="ranked-label">{{ item.label }}</span>
          <span class="ranked-value">${{ fmt(item.value) }}</span>
        </div>
        <button
          v-if="hasMore"
          class="expand-btn"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Show less' : `${hiddenCount} more` }}
        </button>
      </div>
    </template>
    <div v-else class="empty-chart">
      <p class="text-secondary text-sm">No data yet</p>
    </div>
  </div>
</template>

<style scoped>
.pie-chart-wrapper {
  display: flex;
  flex-direction: column;
}

.chart-area {
  position: relative;
  max-width: 200px;
  margin: 0 auto 12px;
}

.chart-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.center-amount {
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.ranked-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ranked-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-light);
}

.ranked-item:last-child {
  border-bottom: none;
}

.ranked-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ranked-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranked-value {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.expand-btn {
  display: block;
  width: 100%;
  padding: 6px 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 500;
  color: var(--accent-text);
  cursor: pointer;
  text-align: center;
  transition: opacity 0.2s;
}

.expand-btn:hover {
  opacity: 0.7;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
</style>
