<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'
import { useTableRows, ordinal, money } from '../composables/useTableRows.js'
import InlineEdit from './InlineEdit.vue'
import CellMenu from './CellMenu.vue'
import MonthOverridesPopover from './MonthOverridesPopover.vue'

const store = useStore()

const hasOverrides = (bill) => bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0

const { rows, toggleSort, freeze, unfreeze, addRow, newRowId, ariaSort, sortIndicator } = useTableRows(
  store.bills,
  (bill, key) => {
    // Spread bills have no single day, so they sort after day 31
    if (key === 'dueDate') return bill.dueDate === 'spread' ? 32 : Number(bill.dueDate) || 0
    if (key === 'amount') return store.getBillCurrentAmount(bill)
    return bill[key] ?? ''
  }
)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'category', label: 'Category' },
  { key: 'dueDate', label: 'Due' }
]

const categoryOptions = store.categories.map(c => ({ value: c, label: c, dot: `var(--cat-${c.toLowerCase()})` }))
const dueOptions = [
  { value: 'spread', label: 'Spread' },
  ...Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: ordinal(i + 1) }))
]
const customMonthsAction = [{ key: 'custom', label: 'Custom months…' }]

const dueLabel = (bill) => (bill.dueDate === 'spread' ? 'Spread' : ordinal(bill.dueDate))

function update(id, field, value) {
  store.updateBill(id, field, value)
}

// Row order stays put while anything in the table is being edited or a panel is open
const tableRef = ref(null)
const openMenus = ref(0)
const popover = ref(null) // { id }
const calendarBtns = {}

function onMenuOpen() { openMenus.value++; freeze() }
function onMenuClose() { openMenus.value = Math.max(0, openMenus.value - 1) }
function onEditing(isEditing) { if (isEditing) freeze() }

function maybeUnfreeze() {
  setTimeout(() => {
    if (popover.value || openMenus.value) return
    if (tableRef.value && tableRef.value.contains(document.activeElement)) return
    unfreeze()
  }, 0)
}

function togglePopover(id) {
  if (popover.value?.id === id) {
    popover.value = null
    maybeUnfreeze()
  } else {
    freeze()
    popover.value = { id }
  }
}

function closePopover() {
  popover.value = null
  maybeUnfreeze()
}

const popoverBill = computed(() => popover.value && store.bills.value.find(b => b.id === popover.value.id))

function addBill() {
  addRow(store.addBill)
}

// Delete confirmation
const confirmDeleteId = ref(null)
const dialogRef = ref(null)
watch(confirmDeleteId, (val) => {
  if (val) nextTick(() => dialogRef.value?.focus())
})
function doDelete() {
  if (popover.value?.id === confirmDeleteId.value) popover.value = null
  store.deleteBill(confirmDeleteId.value)
  confirmDeleteId.value = null
}
</script>

<template>
  <div>
    <Teleport defer to="#page-actions">
      <button class="btn" @click="addBill">+ Add Bill</button>
    </Teleport>

    <div v-if="store.bills.value.length === 0" class="empty-state">
      <div class="icon">&#128195;</div>
      <p>No bills yet. Add your first bill to get started.</p>
    </div>

    <div v-else ref="tableRef" class="grid-table bills-table" role="table" aria-label="Bills" @focusout="maybeUnfreeze">
      <div class="grid-head" role="row">
        <div
          v-for="col in columns"
          :key="col.key"
          role="columnheader"
          :aria-sort="ariaSort(col.key)"
          :class="{ num: col.numeric, sorted: ariaSort(col.key) !== 'none' }"
        >
          <button type="button" class="th-btn" @click="toggleSort(col.key)">{{ col.label }}<span v-if="sortIndicator(col.key)" class="sort-ind">{{ sortIndicator(col.key) }}</span></button>
        </div>
        <div role="columnheader" class="c-notes">Notes</div>
        <div role="columnheader" class="c-actions"><span class="visually-hidden">Actions</span></div>
      </div>

      <div role="rowgroup">
        <div
          v-for="bill in rows"
          :key="bill.id"
          class="grid-row"
          :class="{ 'is-new': newRowId === bill.id, 'panel-open': popover?.id === bill.id }"
          role="row"
        >
          <div class="grid-cell c-name" role="cell">
            <InlineEdit
              :modelValue="bill.name"
              label="Name"
              placeholder="Bill name"
              :autoEdit="newRowId === bill.id && !bill.name"
              @update:modelValue="update(bill.id, 'name', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-amount num strong" role="cell">
            <button
              v-if="hasOverrides(bill)"
              type="button"
              class="inline-display"
              :aria-label="`Amount this month: ${money(store.getBillCurrentAmount(bill))}. Edit charged months`"
              @click="togglePopover(bill.id)"
            >{{ money(store.getBillCurrentAmount(bill)) }}</button>
            <InlineEdit
              v-else
              :modelValue="Number(bill.amount) || 0"
              type="number"
              label="Amount"
              :format="money"
              @update:modelValue="update(bill.id, 'amount', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-cat" role="cell">
            <CellMenu
              :modelValue="bill.category || 'Needs'"
              :options="categoryOptions"
              :label="`Category: ${bill.category || 'Needs'}`"
              @update:modelValue="update(bill.id, 'category', $event)"
              @open="onMenuOpen"
              @close="onMenuClose"
            >
              <span class="cat-dot" :style="{ background: `var(--cat-${(bill.category || 'Needs').toLowerCase()})` }" aria-hidden="true" />
              {{ bill.category || 'Needs' }}
            </CellMenu>
          </div>
          <div class="grid-cell c-due" role="cell">
            <CellMenu
              :modelValue="bill.dueDate === 'spread' ? 'spread' : Number(bill.dueDate) || 1"
              :options="dueOptions"
              :actions="customMonthsAction"
              :label="`Due: ${dueLabel(bill)}`"
              @update:modelValue="update(bill.id, 'dueDate', $event)"
              @action="togglePopover(bill.id)"
              @open="onMenuOpen"
              @close="onMenuClose"
            >
              <span v-if="bill.dueDate === 'spread'" class="tag" title="Split evenly across pay periods">Spread</span>
              <template v-else>{{ ordinal(bill.dueDate) }}</template>
            </CellMenu>
          </div>
          <div class="grid-cell c-notes muted" role="cell">
            <InlineEdit
              :modelValue="bill.notes || ''"
              type="textarea"
              label="Notes"
              placeholder="Add note"
              @update:modelValue="update(bill.id, 'notes', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-actions" role="cell">
            <div class="row-actions">
              <button
                :ref="el => (calendarBtns[bill.id] = el)"
                type="button"
                class="action-btn"
                :class="{ 'has-overrides': hasOverrides(bill), open: popover?.id === bill.id }"
                :aria-label="`Charged months for ${bill.name || 'bill'}`"
                :aria-expanded="popover?.id === bill.id"
                title="Charged months"
                @click="togglePopover(bill.id)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></svg>
              </button>
              <button
                type="button"
                class="action-btn"
                :aria-label="`Delete ${bill.name || 'bill'}`"
                title="Delete"
                @click="confirmDeleteId = bill.id"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-row totals" role="row">
        <div class="grid-cell c-name totals-label" role="rowheader">Total</div>
        <div class="grid-cell c-amount num strong" role="cell">{{ money(store.totalBills.value) }}</div>
        <div class="grid-cell c-cat" role="cell" />
        <div class="grid-cell c-due" role="cell" />
        <div class="grid-cell c-notes" role="cell" />
        <div class="grid-cell c-actions" role="cell" />
      </div>
    </div>

    <MonthOverridesPopover
      v-if="popoverBill && calendarBtns[popoverBill.id]"
      :key="popoverBill.id"
      :anchorEl="calendarBtns[popoverBill.id]"
      :name="popoverBill.name"
      :baseAmount="Number(popoverBill.amount) || 0"
      :rates="popoverBill.seasonalRates || {}"
      frequency="Monthly"
      :selectedMonth="store.selectedMonth.value"
      @update:rates="update(popoverBill.id, 'seasonalRates', $event)"
      @close="closePopover"
    />

    <!-- Confirm delete dialog -->
    <Transition name="modal" :duration="{ enter: 500, leave: 200 }">
      <div v-if="confirmDeleteId" class="confirm-overlay" @click.self="confirmDeleteId = null" @keydown.escape="confirmDeleteId = null">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-bill-title" ref="dialogRef" tabindex="-1">
          <h2 id="delete-bill-title" class="h3">Delete Bill?</h2>
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
/* Name · Amount · Category · Due · Notes · Actions */
.bills-table {
  --cols: minmax(150px, 2fr) 120px 140px 120px minmax(120px, 1.6fr) 64px;
}

/* Phone: two-line rows — name + amount, then category · due · note */
@media (max-width: 820px) {
  .bills-table .grid-row {
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      "name name name amount"
      "cat due notes actions";
  }
  .c-name { grid-area: name; }
  .c-amount { grid-area: amount; }
  .c-cat { grid-area: cat; }
  .c-due { grid-area: due; }
  .c-notes { grid-area: notes; }
  .c-actions { grid-area: actions; }
  .totals .c-cat,
  .totals .c-due,
  .totals .c-notes,
  .totals .c-actions {
    display: none;
  }
}
</style>
