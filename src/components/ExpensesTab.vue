<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'
import { useTableRows, money, MONTH_ABBR } from '../composables/useTableRows.js'
import InlineEdit from './InlineEdit.vue'
import CellMenu from './CellMenu.vue'
import DatePopover from './DatePopover.vue'

const store = useStore()

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// --- Summary strip -----------------------------------------------------------
const selMonth = computed(() => store.selectedMonth.value)
const selYear = computed(() => store.selectedYear.value)

const yearToDate = computed(() =>
  store.expenses.value.filter(e => e.year === selYear.value && e.month <= selMonth.value)
)
const ytdTotal = computed(() => yearToDate.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))
const ytdMonthsWithExpenses = computed(() => new Set(yearToDate.value.map(e => e.month)).size)
const monthsElapsed = computed(() => selMonth.value + 1)

// --- Table -------------------------------------------------------------------
// Position in the stored list stands in for created-at on older expenses
const createdOrder = computed(() => new Map(store.expenses.value.map((e, i) => [e.id, e.createdAt ?? i])))

const { rows, toggleSort, sortAsc, freeze, unfreeze, addRow, newRowId, ariaSort, sortIndicator } = useTableRows(
  store.expenses,
  (exp, key) => {
    if (key === 'date') {
      // Newest first: by day, then most recently created
      return (Number(exp.date) || 0) * 1e13 + (createdOrder.value.get(exp.id) || 0)
    }
    if (key === 'amount') return Number(exp.amount) || 0
    return exp[key] ?? ''
  },
  'date'
)
sortAsc.value = false

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'date', label: 'Date' }
]

// Sections are always newest month first; rows inside follow the column sort
const sections = computed(() => {
  const groups = new Map()
  rows.value.forEach(exp => {
    const key = exp.year * 12 + exp.month
    if (!groups.has(key)) groups.set(key, { key, year: exp.year, month: exp.month, items: [], total: 0 })
    const g = groups.get(key)
    g.items.push(exp)
    g.total += Number(exp.amount) || 0
  })
  return [...groups.values()].sort((a, b) => b.key - a.key)
})

const categoryOptions = store.categories.map(c => ({ value: c, label: c, dot: `var(--cat-${c.toLowerCase()})` }))

const dateLabel = (exp) => (exp.date ? `${MONTH_ABBR[exp.month]} ${exp.date}` : '')

function update(id, field, value) {
  store.updateExpense(id, field, value)
}

// Row order stays put while editing or while a menu/popover is open
const tableRef = ref(null)
const openMenus = ref(0)
const datePicker = ref(null) // { id }
const dateBtns = {}

function onMenuOpen() { openMenus.value++; freeze() }
function onMenuClose() { openMenus.value = Math.max(0, openMenus.value - 1) }
function onEditing(isEditing) { if (isEditing) freeze() }

function maybeUnfreeze() {
  setTimeout(() => {
    if (datePicker.value || openMenus.value) return
    if (tableRef.value && tableRef.value.contains(document.activeElement)) return
    unfreeze()
  }, 0)
}

function toggleDatePicker(id) {
  if (datePicker.value?.id === id) {
    datePicker.value = null
    maybeUnfreeze()
  } else {
    freeze()
    datePicker.value = { id }
  }
}

function closeDatePicker() {
  datePicker.value = null
  maybeUnfreeze()
}

const pickerExpense = computed(() => datePicker.value && store.expenses.value.find(e => e.id === datePicker.value.id))

function setDate(exp, { year, month, day }) {
  update(exp.id, 'year', year)
  update(exp.id, 'month', month)
  update(exp.id, 'date', day)
}

function addExpense() {
  addRow(store.addExpense)
}

// Delete confirmation
const confirmDeleteId = ref(null)
const dialogRef = ref(null)
watch(confirmDeleteId, (val) => {
  if (val) nextTick(() => dialogRef.value?.focus())
})
function doDelete() {
  store.deleteExpense(confirmDeleteId.value)
  confirmDeleteId.value = null
}
</script>

<template>
  <div>
    <Teleport defer to="#page-actions">
      <button class="btn" @click="addExpense">+ Add Expense</button>
    </Teleport>

    <!-- Summary strip -->
    <div class="expense-stats">
      <div class="stat-card stat-month">
        <div class="stat-label">{{ store.monthNames[selMonth] }}</div>
        <div class="stat-value">{{ money(store.totalExpenses.value) }}</div>
        <div class="stat-caption">
          {{ store.monthExpenses.value.length ? plural(store.monthExpenses.value.length, 'expense') : 'No expenses yet' }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Year to date</div>
        <div class="stat-value">{{ money(ytdTotal) }}</div>
        <div class="stat-caption">{{ plural(yearToDate.length, 'expense') }} across {{ plural(ytdMonthsWithExpenses, 'month') }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Monthly average</div>
        <div class="stat-value">{{ money(ytdTotal / monthsElapsed) }}</div>
        <div class="stat-caption">Across {{ plural(monthsElapsed, 'month') }}</div>
      </div>
    </div>

    <!-- One continuous table, a section per month (newest first) -->
    <div ref="tableRef" class="grid-table expense-table" role="table" aria-label="Expenses" @focusout="maybeUnfreeze">
      <template v-if="sections.length">
        <div class="grid-head" role="row">
          <div
            v-for="col in columns"
            :key="col.key"
            role="columnheader"
            :aria-sort="ariaSort(col.key)"
            :class="[`c-${col.key}`, { sorted: ariaSort(col.key) !== 'none' }]"
          >
            <button type="button" class="th-btn" @click="toggleSort(col.key)">{{ col.label }}<span v-if="sortIndicator(col.key)" class="sort-ind">{{ sortIndicator(col.key) }}</span></button>
          </div>
          <div role="columnheader" class="c-notes">Notes</div>
          <div role="columnheader" class="num c-amount" :aria-sort="ariaSort('amount')" :class="{ sorted: ariaSort('amount') !== 'none' }">
            <button type="button" class="th-btn" @click="toggleSort('amount')">Amount<span v-if="sortIndicator('amount')" class="sort-ind">{{ sortIndicator('amount') }}</span></button>
          </div>
          <div role="columnheader" class="c-actions"><span class="visually-hidden">Actions</span></div>
        </div>

        <div v-for="section in sections" :key="section.key" role="rowgroup" :aria-label="`${store.monthNames[section.month]} ${section.year}`">
          <div class="section-head" role="row">
            <div class="section-title" role="rowheader">
              <span class="section-month">{{ store.monthNames[section.month] }} {{ section.year }}</span>
              <span class="section-count">{{ plural(section.items.length, 'expense') }}</span>
            </div>
            <span class="section-total" role="cell">{{ money(section.total) }}</span>
          </div>

          <div
            v-for="exp in section.items"
            :key="exp.id"
            class="grid-row"
            :class="{ 'is-new': newRowId === exp.id, 'panel-open': datePicker?.id === exp.id }"
            role="row"
          >
            <div class="grid-cell c-name" role="cell">
              <div class="name-stack">
                <InlineEdit
                  :modelValue="exp.name"
                  label="Name"
                  placeholder="Expense name"
                  :autoEdit="newRowId === exp.id && !exp.name"
                  @update:modelValue="update(exp.id, 'name', $event)"
                  @editing="onEditing"
                />
                <span v-if="exp.notes" class="name-note">{{ exp.notes }}</span>
              </div>
            </div>
            <div class="grid-cell c-category" role="cell">
              <CellMenu
                :modelValue="exp.category || 'Needs'"
                :options="categoryOptions"
                :label="`Category: ${exp.category || 'Needs'}`"
                @update:modelValue="update(exp.id, 'category', $event)"
                @open="onMenuOpen"
                @close="onMenuClose"
              >
                <span class="cat-dot" :style="{ background: `var(--cat-${(exp.category || 'Needs').toLowerCase()})` }" aria-hidden="true" />
                {{ exp.category || 'Needs' }}
              </CellMenu>
            </div>
            <div class="grid-cell c-date" role="cell">
              <button
                :ref="el => (dateBtns[exp.id] = el)"
                type="button"
                class="cell-menu-trigger"
                :class="{ placeholder: !exp.date }"
                aria-haspopup="dialog"
                :aria-expanded="datePicker?.id === exp.id"
                :aria-label="`Date: ${dateLabel(exp) || 'none'}`"
                @click="toggleDatePicker(exp.id)"
              >{{ dateLabel(exp) || 'Add date' }}</button>
            </div>
            <div class="grid-cell c-notes muted" role="cell">
              <InlineEdit
                :modelValue="exp.notes || ''"
                type="textarea"
                label="Notes"
                placeholder="Add note"
                @update:modelValue="update(exp.id, 'notes', $event)"
                @editing="onEditing"
              />
            </div>
            <div class="grid-cell c-amount num strong" role="cell">
              <InlineEdit
                :modelValue="Number(exp.amount) || 0"
                type="number"
                label="Amount"
                :format="money"
                @update:modelValue="update(exp.id, 'amount', $event)"
                @editing="onEditing"
              />
            </div>
            <div class="grid-cell c-actions" role="cell">
              <div class="row-actions">
                <button
                  type="button"
                  class="action-btn"
                  :aria-label="`Delete ${exp.name || 'expense'}`"
                  title="Delete"
                  @click="confirmDeleteId = exp.id"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="table-empty">
        <div class="table-empty-title">No expenses in {{ selYear }}</div>
        <button type="button" class="table-empty-link" @click="addExpense">Add an expense</button>
      </div>
    </div>

    <DatePopover
      v-if="pickerExpense && dateBtns[pickerExpense.id]"
      :key="pickerExpense.id"
      :anchorEl="dateBtns[pickerExpense.id]"
      :year="pickerExpense.year"
      :month="pickerExpense.month"
      :day="Number(pickerExpense.date) || null"
      @select="setDate(pickerExpense, $event)"
      @close="closeDatePicker"
    />

    <!-- Confirm delete dialog -->
    <Transition name="modal" :duration="{ enter: 500, leave: 200 }">
      <div v-if="confirmDeleteId" class="confirm-overlay" @click.self="confirmDeleteId = null" @keydown.escape="confirmDeleteId = null">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-expense-title" ref="dialogRef" tabindex="-1">
          <h3 id="delete-expense-title">Delete Expense?</h3>
          <p>This action cannot be undone.</p>
          <div class="actions">
            <button class="btn btn-secondary" @click="confirmDeleteId = null">Cancel</button>
            <button class="btn btn-danger" @click="doDelete">Delete</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Summary strip (10b) — reuses the Overview stat-card look */
.expense-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
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

.stat-caption {
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Name · Category · Date · Notes · Amount · Actions */
.expense-table {
  --cols: minmax(150px, 2fr) 140px 110px minmax(120px, 1.6fr) 120px 48px;
}

/* Month section header — sticks below the toolbar while scrolling */
.section-head {
  position: sticky;
  top: 52px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 20px;
  background: var(--section-bg);
  border-bottom: 1px solid var(--row-divider);
}

.section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.section-month {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.section-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.section-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* The last section's last row rounds off the card */
.grid-row:last-child {
  border-radius: 0;
}
[role="rowgroup"]:last-child > .grid-row:last-child {
  border-bottom: none;
  border-radius: 0 0 14px 14px;
}
[role="rowgroup"]:not(:last-child) > .grid-row:last-child {
  border-bottom: 1px solid var(--row-divider);
}

.c-date .cell-menu-trigger.placeholder {
  color: var(--text-placeholder);
}

.name-stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Under 900px the notes column folds into a sub-line under the name */
.name-note {
  display: none;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px;
}

.table-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.table-empty-link {
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 15px;
  font-weight: 500;
  color: var(--accent-text);
  cursor: pointer;
  border-radius: 4px;
}

@media (max-width: 1100px) {
  .expense-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .stat-month {
    grid-column: 1 / -1;
  }
}

@media (max-width: 900px) {
  .expense-table {
    --cols: minmax(150px, 1fr) 130px 90px 110px 48px;
  }
  .c-notes {
    display: none;
  }
  .name-note {
    display: block;
  }
}

@media (max-width: 820px) {
  .expense-table .grid-row {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      "name name name amount"
      "cat date . actions";
  }
  .c-name { grid-area: name; }
  .c-amount { grid-area: amount; }
  .c-category { grid-area: cat; }
  .c-date { grid-area: date; }
  .c-actions { grid-area: actions; }
  .section-head {
    padding: 0 16px;
  }
}

@media (max-width: 600px) {
  .expense-stats {
    grid-template-columns: 1fr;
  }
}
</style>
