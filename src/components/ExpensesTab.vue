<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'

const store = useStore()

const confirmDeleteId = ref(null)
const sortFrozen = ref(false)
const dialogRef = ref(null)
watch(confirmDeleteId, (val) => {
  if (val) nextTick(() => dialogRef.value?.focus())
})

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function addExpense() {
  store.addExpense()
  sortFrozen.value = true
}

function onTableBlur(event) {
  const wrapper = event.currentTarget
  setTimeout(() => {
    if (!wrapper.contains(document.activeElement)) {
      sortFrozen.value = false
    }
  }, 0)
}

function updateField(id, field, event) {
  let val = event.target.value
  if (field === 'amount') val = Number(val) || 0
  store.updateExpense(id, field, val)
}

function confirmDelete(id) {
  confirmDeleteId.value = id
}

function doDelete() {
  store.deleteExpense(confirmDeleteId.value)
  confirmDeleteId.value = null
}

// Current month's expenses for the quick-add section
const currentMonthLabel = computed(() =>
  `${store.monthNames[store.selectedMonth.value]} ${store.selectedYear.value}`
)

// Show current month section + historical grouped months
const otherMonths = computed(() =>
  store.expensesByMonth.value.filter(g =>
    !(g.month === store.selectedMonth.value && g.year === store.selectedYear.value)
  )
)

const expandedMonths = ref({})

function toggleMonth(key) {
  expandedMonths.value[key] = !expandedMonths.value[key]
}
</script>

<template>
  <div>
    <Teleport defer to="#page-actions">
      <button class="btn" @click="addExpense">+ Add Expense</button>
    </Teleport>

    <!-- Current month section -->

    <div v-if="store.monthExpenses.value.length === 0" class="empty-state">
      <div class="icon">&#128660;</div>
      <p>No one-time expenses for {{ currentMonthLabel }}.</p>
    </div>

    <div v-else class="card table-wrapper mb-24" @focusout="onTableBlur">
      <table class="data-table expense-table">
        <thead>
          <tr>
            <th>Name</th>
            <th class="money-col">Amount</th>
            <th>Category</th>
            <th>Date</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="exp in store.monthExpenses.value" :key="exp.id">
            <td class="cell-edit">
              <input type="text" :value="exp.name" placeholder="Expense name" @input="updateField(exp.id, 'name', $event)" />
            </td>
            <td class="cell-edit money-col">
              <div class="cost-cell">
                <span class="dollar-prefix">$</span>
                <input type="number" :value="exp.amount" @input="updateField(exp.id, 'amount', $event)" style="width: 100px" />
              </div>
            </td>
            <td class="cell-edit">
              <select :value="exp.category || 'Needs'" @change="updateField(exp.id, 'category', $event)">
                <option v-for="c in store.categories" :key="c" :value="c">{{ c }}</option>
              </select>
            </td>
            <td class="cell-edit">
              <input type="number" :value="exp.date" placeholder="Day" min="1" max="31" @input="updateField(exp.id, 'date', $event)" style="width: 70px" />
            </td>
            <td class="cell-edit">
              <input type="text" :value="exp.notes" placeholder="Notes" @input="updateField(exp.id, 'notes', $event)" />
            </td>
            <td>
              <button class="btn-icon" title="Delete" aria-label="Delete expense" @click="confirmDelete(exp.id)">&#128465;</button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td style="text-align: right; font-weight: 600;">Total:</td>
            <td class="money-col" style="font-weight: 700; color: var(--red);">${{ fmt(store.totalExpenses.value) }}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Historical months -->
    <div v-if="otherMonths.length > 0" class="mt-24">
      <h2 class="mb-16">Previous Months</h2>
      <div class="history-list">
        <div v-for="group in otherMonths" :key="`${group.year}-${group.month}`" class="card history-card">
          <button class="history-header" @click="toggleMonth(`${group.year}-${group.month}`)">
            <div>
              <span class="history-label">{{ group.label }}</span>
              <span class="history-count text-sm text-secondary">{{ group.items.length }} expense{{ group.items.length === 1 ? '' : 's' }}</span>
            </div>
            <div class="flex items-center gap-12">
              <span class="history-total">${{ fmt(group.total) }}</span>
              <span class="chevron" :class="{ open: expandedMonths[`${group.year}-${group.month}`] }">&#9207;</span>
            </div>
          </button>
          <div v-if="expandedMonths[`${group.year}-${group.month}`]" class="history-items">
            <div v-for="exp in group.items" :key="exp.id" class="history-item">
              <div class="flex items-center gap-8">
                <span>{{ exp.name || 'Unnamed' }}</span>
                <span class="chip">{{ exp.category }}</span>
                <span v-if="exp.date" class="text-sm text-secondary">{{ exp.date }}</span>
              </div>
              <span class="history-item-amount">${{ fmt(exp.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

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
.expense-table {
  min-width: 600px;
}

.expense-table th:first-child,
.expense-table td:first-child {
  min-width: 160px;
}

.money-col {
  text-align: right;
}

.money-col input {
  text-align: right;
}

.cost-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.dollar-prefix {
  font-size: 14px;
  color: var(--text-secondary);
}

.totals-row td {
  border-top: 2px solid var(--border);
  padding-top: 12px;
}

/* History */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-card {
  padding: 0;
  overflow: hidden;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 14px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-primary);
  text-align: left;
}

.history-header:hover {
  background: var(--surface-secondary);
}

.history-header:active {
  background: var(--fill);
}

.history-label {
  font-weight: 600;
  font-size: 15px;
  margin-right: 8px;
}

.history-total {
  font-weight: 700;
  font-size: 16px;
  color: var(--red);
  font-variant-numeric: tabular-nums;
}

.chevron {
  font-size: 14px;
  color: var(--text-tertiary);
  transition: transform var(--spring-duration) var(--spring);
}

.chevron.open {
  transform: rotate(180deg);
}

.history-items {
  border-top: 1px solid var(--border-light);
  padding: 4px 20px 12px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.history-item:last-child {
  border-bottom: none;
}

.history-item-amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
