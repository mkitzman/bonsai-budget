<script setup>
import { computed, inject } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { useStore } from '../composables/useStore.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, annotationPlugin)

const store = useStore()
const palette = inject('palette')

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const chartData = computed(() => {
  void palette.value
  const needsData = []
  const wantsData = []
  const savingsData = []

  for (let m = 0; m < 12; m++) {
    const totals = store.getCategoryTotalsForMonth(m)
    needsData.push(totals.Needs)
    wantsData.push(totals.Wants)
    savingsData.push(totals.Savings)
  }

  return {
    labels: shortMonths,
    datasets: [
      { label: 'Needs', data: needsData, backgroundColor: getCSSVar('--cat-needs'), borderRadius: 2 },
      { label: 'Wants', data: wantsData, backgroundColor: getCSSVar('--cat-wants'), borderRadius: 2 },
      { label: 'Savings', data: savingsData, backgroundColor: getCSSVar('--cat-savings'), borderRadius: 2 },
    ]
  }
})

const incomeVal = computed(() => Number(store.income.value) || 0)

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      ticks: {
        font: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#8e8e93'
      }
    },
    y: {
      stacked: true,
      max: incomeVal.value > 0 ? incomeVal.value : undefined,
      grid: { color: 'rgba(142, 142, 147, 0.12)' },
      ticks: {
        font: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' },
        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#8e8e93',
        callback: (v) => '$' + v.toLocaleString()
      }
    }
  },
  plugins: {
    annotation: {
      annotations: {
        needsLine: {
          type: 'line',
          yMin: incomeVal.value * (store.categoryTargets.value.Needs),
          yMax: incomeVal.value * (store.categoryTargets.value.Needs),
          borderColor: getCSSVar('--cat-needs') + '80',
          borderWidth: 1.5,
          borderDash: [6, 4],
          label: {
            display: true,
            content: `Needs ${Math.round(store.categoryTargets.value.Needs * 100)}%`,
            position: 'start',
            font: { size: 10 },
            backgroundColor: getCSSVar('--cat-needs') + 'cc',
            padding: 3
          }
        },
        wantsLine: {
          type: 'line',
          yMin: incomeVal.value * (store.categoryTargets.value.Needs + store.categoryTargets.value.Wants),
          yMax: incomeVal.value * (store.categoryTargets.value.Needs + store.categoryTargets.value.Wants),
          borderColor: getCSSVar('--cat-wants') + '80',
          borderWidth: 1.5,
          borderDash: [6, 4],
          label: {
            display: true,
            content: `+ Wants ${Math.round(store.categoryTargets.value.Wants * 100)}%`,
            position: 'start',
            font: { size: 10 },
            backgroundColor: getCSSVar('--cat-wants') + 'cc',
            padding: 3
          }
        },
      }
    },
    legend: {
      position: 'bottom',
      labels: {
        padding: 16,
        usePointStyle: true,
        pointStyle: 'circle',
        font: { size: 12, family: '-apple-system, BlinkMacSystemFont, sans-serif' }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(28, 28, 30, 0.95)',
      titleFont: { size: 13, weight: '600' },
      bodyFont: { size: 13 },
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y.toFixed(2)}`,
        footer: (items) => {
          const total = items.reduce((sum, i) => sum + i.parsed.y, 0)
          return `Total: $${total.toFixed(2)}`
        }
      }
    }
  }
}))

// Text alternative for the canvas: each category's yearly total
const ariaSummary = computed(() => {
  const parts = chartData.value.datasets.map(ds => `${ds.label} $${Math.round(ds.data.reduce((a, v) => a + (Number(v) || 0), 0)).toLocaleString()}`)
  return `Monthly spending by category, January to December. Year totals: ${parts.join(', ')}.`
})

const hasData = computed(() =>
  chartData.value.datasets.some(ds => ds.data.some(v => v > 0))
)
</script>

<template>
  <div class="card stacked-chart">
    <h3 class="mb-8">Monthly Spending by Category</h3>
    <div v-if="hasData" class="chart-container">
      <Bar :data="chartData" :options="chartOptions" :aria-label="ariaSummary" />
    </div>
    <div v-else class="empty-chart">
      <p class="text-secondary text-sm">No data yet</p>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  height: 300px;
}

.empty-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
</style>
