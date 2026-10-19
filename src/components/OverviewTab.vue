<script setup>
import { ref, computed, inject } from 'vue'
import { useStore } from '../composables/useStore.js'
import PieChart from './PieChart.vue'
import CalendarView from './CalendarView.vue'
import BudgetSettings from './BudgetSettings.vue'
import MonthlyBreakdownChart from './MonthlyBreakdownChart.vue'

const store = useStore()
const palette = inject('palette')

const editingIncome = ref(false)
const incomeInput = ref(null)
const showSettings = ref(false)

function startEditIncome() {
  editingIncome.value = true
  setTimeout(() => incomeInput.value?.select(), 10)
}

function finishEditIncome() {
  editingIncome.value = false
}

const editingPayPeriods = ref(false)
const payPeriodDraft = ref([])

function startEditPayPeriods() {
  payPeriodDraft.value = [...store.payPeriodStarts.value]
  editingPayPeriods.value = true
}

function savePayPeriods() {
  store.setPayPeriodStarts(payPeriodDraft.value)
  editingPayPeriods.value = false
}

const showBudgetHint = ref(false)
const expandedCategory = ref(null)

function toggleCategory(cat) {
  expandedCategory.value = expandedCategory.value === cat ? null : cat
}

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Currency with a true minus sign before the $: −$1,553.48
const money = (n) => {
  const num = Number(n) || 0
  return `${num < 0 ? '\u2212' : ''}$${fmt(Math.abs(num))}`
}

// Share of income allocated to bills + subscriptions (segments clamped to 100% total)
const allocation = computed(() => {
  const income = Number(store.income.value) || 0
  const bills = store.totalBills.value
  const subs = store.totalSubscriptions.value
  if (income <= 0) return { bills: 0, subs: 0, pct: null, over: false }
  const billsPct = (bills / income) * 100
  const subsPct = (subs / income) * 100
  const pct = billsPct + subsPct
  const clampedBills = Math.min(100, billsPct)
  return {
    bills: clampedBills,
    subs: Math.min(100 - clampedBills, subsPct),
    pct: Math.round(pct),
    over: pct > 100
  }
})

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
const categoryColors = computed(() => {
  void palette.value // reactive trigger on palette change
  return {
    Needs: getCSSVar('--cat-needs'),
    Wants: getCSSVar('--cat-wants'),
    Savings: getCSSVar('--cat-savings'),
  }
})

function progressColor(cat) {
  const pct = store.categoryBreakdown.value[cat].pctUsed
  if (pct >= 100) return '#EF4444'
  if (pct >= 90) return '#F59E0B'
  return categoryColors.value[cat]
}

function progressClass(cat) {
  const pct = store.categoryBreakdown.value[cat].pctUsed
  if (pct >= 100) return 'critical'
  if (pct >= 90) return 'warning'
  return ''
}

const budgetLabel = computed(() => {
  const t = store.categoryTargets.value
  return `${Math.round(t.Needs * 100)} / ${Math.round(t.Wants * 100)} / ${Math.round(t.Savings * 100)} Budget`
})
const categoryIcons = { Needs: 'N', Wants: 'W', Savings: 'S' }

// Pie chart data
const incomeBreakdown = computed(() => {
  void palette.value
  const hasExpenses = store.includeExpenses.value && store.totalExpenses.value > 0
  const finalRemaining = hasExpenses ? store.adjustedRemaining.value : store.remaining.value
  const labels = ['Bills', 'Subscriptions']
  const data = [store.totalBills.value, store.totalSubscriptions.value]
  const colors = [getCSSVar('--orange'), getCSSVar('--teal')]

  if (hasExpenses) {
    labels.push('Expenses')
    data.push(store.totalExpenses.value)
    colors.push(getCSSVar('--red'))
  }

  labels.push(finalRemaining >= 0 ? 'Remaining' : 'Over Budget')
  data.push(Math.abs(finalRemaining))
  colors.push(finalRemaining >= 0 ? getCSSVar('--green') : getCSSVar('--red'))

  return { labels, data, colors }
})

const billsBreakdown = computed(() => {
  const activeBills = store.bills.value.filter(b => store.getBillCurrentAmount(b) > 0)
  return {
    labels: activeBills.map(b => b.name || 'Unnamed'),
    data: activeBills.map(b => store.getBillCurrentAmount(b)),
    colors: []
  }
})

const subsBreakdown = computed(() => {
  const active = store.subscriptions.value.filter(s => store.getSubscriptionCurrentAmount(s) > 0)
  return {
    labels: active.map(s => s.name || 'Unnamed'),
    data: active.map(s => store.getSubscriptionCurrentAmount(s)),
    colors: []
  }
})
</script>

<template>
  <div>
    <!-- Summary grid: income + totals -->
    <div class="stat-grid">
      <div class="stat-card income-card">
        <div class="stat-label">Monthly Income</div>
        <button v-if="!editingIncome" class="stat-value income-value" @click="startEditIncome" aria-label="Edit monthly income">
          {{ money(store.income.value) }}
          <svg class="edit-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11.1 2.3a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1L6 12.6l-3.1.6.6-3.1 7.6-7.8Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        </button>
        <div v-else class="income-edit">
          <span class="income-edit-dollar">$</span>
          <input
            ref="incomeInput"
            type="number"
            min="0"
            v-model.number="store.income.value"
            @blur="finishEditIncome"
            @keydown.enter="finishEditIncome"
            class="income-input"
            aria-label="Monthly income"
          />
        </div>
        <div
          class="alloc-bar"
          role="img"
          :aria-label="allocation.pct === null ? 'No income set' : `${allocation.pct}% of income allocated to bills and subscriptions`"
        >
          <span class="alloc-bills" :style="{ width: `${allocation.bills}%` }" />
          <span class="alloc-subs" :style="{ width: `${allocation.subs}%` }" />
        </div>
        <div class="alloc-caption" :class="{ over: allocation.over }">
          {{ allocation.pct === null ? 'Set your income to see allocation' : `${allocation.pct}% allocated` }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Bills</div>
        <div class="stat-value" style="color: var(--type-bill-text)">{{ money(store.totalBills.value) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Subscriptions</div>
        <div class="stat-value" style="color: var(--type-sub-text)">{{ money(store.totalSubscriptions.value) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Remaining</div>
        <div class="stat-value" :class="store.remaining.value >= 0 ? 'positive' : 'negative'">{{ money(store.remaining.value) }}</div>
      </div>
    </div>

    <!-- Pay period breakdown -->
    <section class="period-section" aria-labelledby="period-heading">
      <div class="pay-period-header">
        <h2 id="period-heading" class="period-heading">By pay period</h2>
        <button v-if="!editingPayPeriods" class="link-btn" @click="startEditPayPeriods">Edit</button>
      </div>
      <div v-if="editingPayPeriods" class="pay-period-editor card text-sm">
        <span class="text-secondary">Periods start on day:</span>
        <span v-for="(day, i) in payPeriodDraft" :key="i" class="pay-period-day">
          <input type="number" min="1" max="31" v-model.number="payPeriodDraft[i]" :disabled="i === 0" :aria-label="`Pay period ${i + 1} start day`" />
          <button v-if="i > 0" class="btn-icon" aria-label="Remove pay period" @click="payPeriodDraft.splice(i, 1)">&times;</button>
        </span>
        <button class="btn btn-secondary btn-sm" @click="payPeriodDraft.push(Math.min(31, payPeriodDraft[payPeriodDraft.length - 1] + 7))">+ Period</button>
        <button class="btn btn-sm" @click="savePayPeriods">Save</button>
        <button class="btn btn-secondary btn-sm" @click="editingPayPeriods = false">Cancel</button>
      </div>
      <div class="period-list">
        <div v-for="p in store.payPeriods.value" :key="p.start" class="period-row">
          <div class="period-name-block">
            <div class="period-name">{{ p.label }}</div>
            <div class="period-income">{{ money(p.income) }} in</div>
          </div>
          <div class="period-cell">
            <div class="period-label">Bills</div>
            <div class="period-value" style="color: var(--type-bill-text)">{{ money(p.bills) }}</div>
          </div>
          <div class="period-cell">
            <div class="period-label">Subscriptions</div>
            <div class="period-value" style="color: var(--type-sub-text)">{{ money(p.subscriptions) }}</div>
          </div>
          <div class="period-cell">
            <div class="period-label">Remaining</div>
            <div class="period-value" :class="p.remaining >= 0 ? 'positive' : 'negative'">{{ money(p.remaining) }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- One-time expenses + adjusted remaining -->
    <div v-if="store.totalExpenses.value > 0" class="expense-banner mb-24">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="label">One-Time Expenses</div>
          <div class="value" style="color: var(--negative)">${{ fmt(store.totalExpenses.value) }}</div>
          <div class="text-sm text-secondary mt-4">{{ store.monthExpenses.value.length }} expense{{ store.monthExpenses.value.length === 1 ? '' : 's' }} this month</div>
        </div>
        <div class="summary-card">
          <div class="label">Adjusted Remaining</div>
          <div class="value" :style="{ color: store.adjustedRemaining.value >= 0 ? 'var(--green-text)' : 'var(--negative)' }">
            ${{ fmt(store.adjustedRemaining.value) }}
          </div>
          <div class="text-sm text-secondary mt-4">After all expenses</div>
        </div>
      </div>
    </div>

    <!-- Budget Breakdown -->
    <div class="mb-24">
      <div class="flex items-center justify-between mb-16">
        <h2>{{ budgetLabel }}
          <button class="budget-info-hint" :aria-expanded="showBudgetHint" aria-label="What is this?" @click="showBudgetHint = !showBudgetHint">&#9432;</button>
        </h2>
        <button class="btn btn-secondary btn-sm" @click="showSettings = true">Adjust</button>
      </div>
      <div v-if="showBudgetHint" class="budget-hint-text text-sm text-secondary">
        Split your income into <strong>Needs</strong> (essentials like rent, groceries, utilities), <strong>Wants</strong> (dining, entertainment, subscriptions), and <strong>Savings</strong> (investments, emergency fund). Adjust the percentages with the button above.
      </div>
      <div class="budget-categories">
        <div
          v-for="cat in store.categories"
          :key="cat"
          class="budget-card card"
          :class="{ expanded: expandedCategory === cat }"
        >
          <button class="budget-card-header" @click="toggleCategory(cat)">
            <div class="budget-card-left">
              <span class="cat-badge" :style="{ background: `var(--cat-${cat.toLowerCase()}-badge)` }">
                {{ Math.round(store.categoryTargets.value[cat] * 100) }}%
              </span>
              <div>
                <div class="cat-name">{{ cat }}</div>
                <div class="cat-spent text-sm">
                  ${{ fmt(store.categoryBreakdown.value[cat].spent) }} of ${{ fmt(store.categoryBreakdown.value[cat].budgeted) }}
                </div>
              </div>
            </div>
            <div class="budget-card-right">
              <div
                class="cat-remaining"
                :style="{ color: store.categoryBreakdown.value[cat].remaining >= 0 ? 'var(--green-text)' : 'var(--negative)' }"
              >
                {{ store.categoryBreakdown.value[cat].remaining >= 0 ? '' : '-' }}${{ fmt(Math.abs(store.categoryBreakdown.value[cat].remaining)) }}
                <span class="text-sm text-secondary">{{ store.categoryBreakdown.value[cat].remaining >= 0 ? 'left' : 'over' }}</span>
              </div>
              <span class="chevron" :class="{ open: expandedCategory === cat }">&#9207;</span>
            </div>
          </button>

          <!-- Progress bar -->
          <div class="progress-track" :class="progressClass(cat)">
            <div
              class="progress-fill"
              :style="{
                width: Math.min(store.categoryBreakdown.value[cat].pctUsed, 100) + '%',
                background: progressColor(cat)
              }"
            />
            <div v-if="store.categoryBreakdown.value[cat].pctUsed > 100" class="progress-overflow"
              :style="{ width: Math.min(store.categoryBreakdown.value[cat].pctUsed - 100, 100) + '%' }"
            />
          </div>
          <div class="progress-label text-sm" :class="progressClass(cat) ? 'text-' + progressClass(cat) : 'text-secondary'">
            {{ Math.round(store.categoryBreakdown.value[cat].pctUsed) }}% of {{ Math.round(store.categoryTargets.value[cat] * 100) }}% used
          </div>

          <!-- Reveal: item list -->
          <div v-if="expandedCategory === cat" class="cat-items">
            <div v-if="store.categoryBreakdown.value[cat].items.length === 0" class="text-secondary text-sm" style="padding: 12px 0;">
              No items in this category yet.
            </div>
            <div v-for="(item, i) in store.categoryBreakdown.value[cat].items" :key="i" class="cat-item">
              <div class="cat-item-left">
                <span class="item-type-dot" :style="{ background: item.type === 'bill' ? 'var(--type-bill)' : item.type === 'subscription' ? 'var(--type-sub)' : 'var(--red)' }" />
                <span>{{ item.name }}</span>
                <span class="chip">{{ item.type === 'bill' ? 'Bill' : 'Sub' }}</span>
              </div>
              <span class="cat-item-amount">${{ fmt(item.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Calendar -->
    <div class="mb-24">
      <CalendarView />
    </div>

    <!-- Pie Charts -->
    <div class="chart-row mb-24">
      <PieChart
        title="Income"
        :labels="incomeBreakdown.labels"
        :data="incomeBreakdown.data"
        :colors="incomeBreakdown.colors"
      />
      <PieChart
        title="Bills"
        :labels="billsBreakdown.labels"
        :data="billsBreakdown.data"
        :colors="billsBreakdown.colors"
      />
      <PieChart
        title="Subscriptions"
        :labels="subsBreakdown.labels"
        :data="subsBreakdown.data"
        :colors="subsBreakdown.colors"
      />
    </div>

    <!-- Monthly Stacked Bar Chart -->
    <div class="mb-24">
      <MonthlyBreakdownChart />
    </div>

    <!-- Budget Settings Modal -->
    <Transition name="modal" :duration="{ enter: 500, leave: 200 }">
      <BudgetSettings v-if="showSettings" @close="showSettings = false" />
    </Transition>
  </div>
</template>

<style scoped>
/* Summary grid (handoff 6b) — income first, then totals; same 4 columns as pay-period rows */
.stat-grid,
.period-row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 1fr;
  gap: 16px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--card-ring);
  min-width: 0;
}

.stat-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.6px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.positive { color: var(--positive); }
.negative { color: var(--negative); }

/* Income value is the one editable thing on the card */
.income-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  text-align: left;
  cursor: text;
  border-radius: 6px;
}

.edit-icon {
  width: 15px;
  height: 15px;
  color: var(--text-tertiary);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.income-value:hover .edit-icon,
.income-value:focus-visible .edit-icon {
  opacity: 1;
}

.income-edit {
  display: flex;
  align-items: center;
  gap: 2px;
}

.income-edit-dollar {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-secondary);
}

.income-input {
  font-family: var(--font);
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.6px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  padding: 0;
  border: none;
  border-bottom: 2px solid var(--accent);
  border-radius: 0;
  background: transparent;
  color: var(--text-primary);
  width: 100%;
  min-width: 0;
}

.income-input:focus {
  box-shadow: none;
}

.alloc-bar {
  display: flex;
  height: 4px;
  margin-top: 10px;
  border-radius: 2px;
  overflow: hidden;
  background: var(--bar-track);
}

.alloc-bills,
.alloc-subs {
  height: 100%;
  transition: width var(--spring-duration) var(--spring);
}

.alloc-bills { background: var(--orange); }
.alloc-subs { background: var(--type-sub); }

.alloc-caption {
  font-size: 11px;
  color: var(--text-tertiary);
}

.alloc-caption.over {
  color: var(--negative);
}

/* By pay period — one grouped card, rows share the summary grid's columns */
.period-section {
  margin: 28px 0 24px;
}

.pay-period-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.period-heading {
  font-family: var(--font);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.link-btn {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--accent-text);
  font-family: var(--font);
  font-size: 15px;
  border-radius: 4px;
}

.pay-period-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.pay-period-day {
  display: inline-flex;
  align-items: center;
}

.pay-period-day input {
  width: 64px;
}

.period-list {
  background: var(--surface);
  border-radius: 14px;
  box-shadow: 0 0 0 1px var(--card-ring);
  overflow: hidden;
}

.period-row {
  padding: 16px 0;
  align-items: center;
  border-bottom: 1px solid var(--row-divider);
}

/* Inset each cell (not the row) so columns line up exactly with the summary cards above */
.period-row > * {
  padding: 0 20px;
}

.period-row:last-child {
  border-bottom: none;
}

.period-name-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.period-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.period-income {
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.period-cell {
  min-width: 0;
}

.period-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.period-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.3px;
  font-variant-numeric: tabular-nums;
}

/* Tablet: 2×2 summary, income full width; period name on its own line above 3 value columns */
@media (max-width: 1024px) {
  /* Income full width, then the three totals in the same 3 columns as the period rows below */
  .stat-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .income-card {
    grid-column: 1 / -1;
  }
  .period-row {
    grid-template-columns: repeat(3, 1fr);
    row-gap: 10px;
  }
  .period-name-block {
    grid-column: 1 / -1;
  }
}

/* Phone: single column; period values become label/value pairs */
@media (max-width: 600px) {
  .stat-grid,
  .period-row {
    grid-template-columns: 1fr;
  }
  .period-row {
    row-gap: 6px;
  }
  .period-cell {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .period-label {
    font-size: 13px;
  }
  .period-value {
    font-size: 17px;
  }
}

.mt-4 { margin-top: 4px; }

.expense-banner .summary-cards {
  grid-template-columns: repeat(2, 1fr);
}

/* 50/30/20 Budget Cards */
.budget-categories {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.budget-card {
  padding: 0;
  overflow: hidden;
}

.budget-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 16px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
  color: var(--text-primary);
}

.budget-card-header:hover {
  background: var(--surface-secondary);
}

.budget-card-header:active {
  background: var(--fill);
}

.budget-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cat-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.cat-name {
  font-size: 16px;
  font-weight: 600;
}

.cat-spent {
  color: var(--text-secondary);
}

.budget-card-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cat-remaining {
  font-size: 18px;
  font-weight: 700;
  text-align: right;
}

.cat-remaining .text-sm {
  font-weight: 400;
}

.chevron {
  font-size: 14px;
  color: var(--text-tertiary);
  transition: transform var(--spring-duration) var(--spring);
}

.chevron.open {
  transform: rotate(180deg);
}

/* Progress bar */
.progress-track {
  height: 6px;
  background: var(--fill);
  margin: 0 20px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width var(--spring-duration) var(--spring), background-color 0.3s ease;
}

.progress-overflow {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  background: var(--red);
  opacity: 0.4;
  border-radius: 3px;
}

.progress-label {
  padding: 6px 20px 12px;
}

/* Reveal items */
.cat-items {
  border-top: 1px solid var(--border-light);
  padding: 4px 20px 12px;
  animation: revealItems 0.35s var(--ease-out);
}

@keyframes revealItems {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: none; }
}

.cat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.cat-item:last-child {
  border-bottom: none;
}

.cat-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cat-item-amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.text-warning { color: var(--warning-text); }
.text-critical { color: var(--negative); }

.budget-info-hint {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 400;
  color: var(--text-tertiary);
  margin-left: 4px;
  padding: 0 2px;
  vertical-align: middle;
  transition: color 0.2s;
}

.budget-info-hint:hover {
  color: var(--accent-text);
}

.budget-hint-text {
  background: var(--surface);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  margin-bottom: 12px;
  line-height: 1.5;
}

.budget-hint-text strong {
  color: var(--text-primary);
}

.btn-sm {
  font-size: 12px;
  padding: 6px 14px;
}
</style>
