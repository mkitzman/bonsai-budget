<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'
import SeasonalRatesEditor from './SeasonalRatesEditor.vue'

const store = useStore()

const sortKey = ref('name')
const sortAsc = ref(true)
const expandedId = ref(null)
const confirmDeleteId = ref(null)
const sortFrozen = ref(false)
const lastSorted = ref(null)

function toggleSort(key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

function sortArrow(key) {
  if (sortKey.value !== key) return '\u2195'
  return sortAsc.value ? '\u2191' : '\u2193'
}

const sorted = computed(() => {
  const arr = [...store.bills.value]
  if (sortFrozen.value && lastSorted.value) return lastSorted.value
  arr.sort((a, b) => {
    let va = a[sortKey.value]
    let vb = b[sortKey.value]
    if (sortKey.value === 'dueDate') {
      // Spread bills have no single day, so they sort after day 31
      va = va === 'spread' ? 32 : Number(va) || 0
      vb = vb === 'spread' ? 32 : Number(vb) || 0
    } else if (sortKey.value === 'amount') {
      va = Number(va) || 0
      vb = Number(vb) || 0
    } else if (typeof va === 'string') {
      va = va.toLowerCase()
      vb = (vb || '').toLowerCase()
    }
    if (va < vb) return sortAsc.value ? -1 : 1
    if (va > vb) return sortAsc.value ? 1 : -1
    return 0
  })
  lastSorted.value = arr
  return arr
})

function updateField(id, field, event) {
  let val = event.target.value
  if (field === 'amount' || (field === 'dueDate' && val !== 'spread')) val = Number(val) || 0
  store.updateBill(id, field, val)
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function updateSeasonalRates(id, rates) {
  store.updateBill(id, 'seasonalRates', rates)
}

function confirmDelete(id) {
  confirmDeleteId.value = id
}

function doDelete() {
  store.deleteBill(confirmDeleteId.value)
  confirmDeleteId.value = null
}

function addBill() {
  store.addBill()
  lastSorted.value = null
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

const dialogRef = ref(null)
watch(confirmDeleteId, (val) => {
  if (val) nextTick(() => dialogRef.value?.focus())
})

const hasSeasonal = (bill) => bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0
const categoryColors = {
  get Needs() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-needs').trim() },
  get Wants() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-wants').trim() },
  get Savings() { return getComputedStyle(document.documentElement).getPropertyValue('--cat-savings').trim() },
}

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-16">
      <h2>Bills</h2>
      <button class="btn" @click="addBill">+ Add Bill</button>
    </div>

    <div v-if="store.bills.value.length === 0" class="empty-state">
      <div class="icon">&#128195;</div>
      <p>No bills yet. Add your first bill to get started.</p>
    </div>

    <div v-else class="card table-wrapper" @focusout="onTableBlur">
      <table class="data-table bill-table">
        <thead>
          <tr>
            <th :class="{ sorted: sortKey === 'name' }" @click="toggleSort('name')">
              Name <span class="sort-arrow">{{ sortArrow('name') }}</span>
            </th>
            <th class="amount-col" :class="{ sorted: sortKey === 'amount' }" @click="toggleSort('amount')">
              Amount <span class="sort-arrow">{{ sortArrow('amount') }}</span>
            </th>
            <th :class="{ sorted: sortKey === 'category' }" @click="toggleSort('category')">
              Category <span class="sort-arrow">{{ sortArrow('category') }}</span>
            </th>
            <th :class="{ sorted: sortKey === 'dueDate' }" @click="toggleSort('dueDate')">
              Due Date <span class="sort-arrow">{{ sortArrow('dueDate') }}</span>
            </th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="bill in sorted" :key="bill.id">
            <tr>
              <td class="cell-edit cat-border" :style="{ borderLeftColor: categoryColors[bill.category] || categoryColors.Needs }">
                <input
                  type="text"
                  :value="bill.name"
                  placeholder="Bill name"
                  @input="updateField(bill.id, 'name', $event)"
                  @focus="sortFrozen = true"
                />
              </td>
              <td :class="hasSeasonal(bill) ? 'amount-col' : 'cell-edit amount-col'">
                <div class="amount-cell">
                  <span v-if="hasSeasonal(bill)" class="seasonal-amount">${{ fmt(store.getBillCurrentAmount(bill)) }}</span>
                  <template v-else>
                    <input
                      type="number"
                      :value="bill.amount"
                      @input="updateField(bill.id, 'amount', $event)"
                      style="width: 100px"
                    />
                  </template>
                </div>
              </td>
              <td class="cell-edit">
                <select :value="bill.category || 'Needs'" @change="updateField(bill.id, 'category', $event)" :style="{ color: categoryColors[bill.category] || categoryColors.Needs }">
                  <option v-for="c in store.categories" :key="c" :value="c">{{ c }}</option>
                </select>
              </td>
              <td class="cell-edit">
                <select
                  :value="bill.dueDate"
                  aria-label="Due date"
                  title="Spread splits the bill evenly across pay periods"
                  @change="updateField(bill.id, 'dueDate', $event)"
                  style="width: 96px"
                >
                  <option value="spread">Spread</option>
                  <option v-for="d in 31" :key="d" :value="d">{{ d }}</option>
                </select>
              </td>
              <td class="cell-edit">
                <textarea
                  :value="bill.notes"
                  placeholder="Notes"
                  class="notes-input"
                  @input="updateField(bill.id, 'notes', $event)"
                ></textarea>
              </td>
              <td>
                <div class="row-actions">
                  <button class="btn-icon" :class="{ 'seasonal-active': hasSeasonal(bill) }" title="Seasonal rates" aria-label="Seasonal rates" @click="toggleExpand(bill.id)">&#128197;</button>
                  <button class="btn-icon" title="Delete" aria-label="Delete bill" @click="confirmDelete(bill.id)">&#128465;</button>
                </div>
              </td>
            </tr>
            <tr v-if="expandedId === bill.id">
              <td colspan="6" style="background: var(--surface-secondary); padding: 16px;">
                <SeasonalRatesEditor
                  :modelValue="bill.seasonalRates || {}"
                  :baseAmount="Number(bill.amount) || 0"
                  @update:modelValue="updateSeasonalRates(bill.id, $event)"
                />
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr class="totals-row">
            <td style="text-align: right; font-weight: 600;">Total:</td>
            <td class="amount-col" style="font-weight: 700; color: var(--orange);">${{ fmt(store.totalBills.value) }}</td>
            <td colspan="4"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Confirm delete dialog -->
    <Transition name="modal" :duration="{ enter: 500, leave: 200 }">
      <div v-if="confirmDeleteId" class="confirm-overlay" @click.self="confirmDeleteId = null" @keydown.escape="confirmDeleteId = null">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-bill-title" ref="dialogRef" tabindex="-1">
          <h3 id="delete-bill-title">Delete Bill?</h3>
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
.amount-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.amount-col {
  text-align: right;
}

.amount-col input {
  text-align: right;
}

.seasonal-amount {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 10px 12px 10px 0;
}

.seasonal-active {
  background: rgba(10, 132, 255, 0.1);
  color: var(--accent) !important;
  border-radius: 50%;
}

.notes-input {
  field-sizing: content;
  resize: none;
  min-width: 120px;
}

.row-actions {
  display: flex;
  gap: 2px;
}

.totals-row td {
  border-top: 2px solid var(--border);
  padding-top: 12px;
}

.bill-table {
  min-width: 800px;
}

.bill-table th:first-child,
.bill-table td:first-child {
  min-width: 160px;
}

.cat-border {
  border-left: 5px solid;
  border-radius: 2px 0 0 2px;
}
</style>
