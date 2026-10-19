<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../composables/useStore.js'
import { useTableRows, ordinal, money } from '../composables/useTableRows.js'
import InlineEdit from './InlineEdit.vue'
import CellMenu from './CellMenu.vue'
import MonthOverridesPopover from './MonthOverridesPopover.vue'

const store = useStore()

const hasOverrides = (sub) => sub.seasonalRates && Object.keys(sub.seasonalRates).length > 0
// Cost shows what's charged in the selected month once overrides exist, otherwise the base cost
const costShown = (sub) => (hasOverrides(sub) ? store.getSubscriptionCurrentAmount(sub) : Number(sub.cost) || 0)

const { rows, toggleSort, freeze, unfreeze, addRow, newRowId, ariaSort, sortIndicator } = useTableRows(
  store.subscriptions,
  (sub, key) => {
    if (key === 'monthlyCost') return store.averageMonthlyAmount(sub)
    if (key === 'yearlyCost') return store.yearlyAmount(sub)
    if (key === 'cost') return costShown(sub)
    if (key === 'renewalDate') return Number(sub.renewalDate) || 0
    return sub[key] ?? ''
  }
)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'renewalDate', label: 'Day', numeric: true, cls: 'c-day' },
  { key: 'cost', label: 'Cost', numeric: true },
  { key: 'monthlyCost', label: 'Monthly', numeric: true, cls: 'c-monthly' },
  { key: 'yearlyCost', label: 'Yearly', numeric: true, cls: 'c-yearly' }
]

const categoryOptions = store.categories.map(c => ({ value: c, label: c, dot: `var(--cat-${c.toLowerCase()})` }))
const frequencyOptions = ['Monthly', 'Quarterly', 'Yearly'].map(f => ({ value: f, label: f }))
const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: ordinal(i + 1) }))
const customMonthsAction = [{ key: 'custom', label: 'Custom months…' }]

function update(id, field, value) {
  store.updateSubscription(id, field, value)
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

const popoverSub = computed(() => popover.value && store.subscriptions.value.find(s => s.id === popover.value.id))

function addSubscription() {
  addRow(store.addSubscription)
}

// Delete confirmation
const confirmDeleteId = ref(null)
const dialogRef = ref(null)
watch(confirmDeleteId, (val) => {
  if (val) nextTick(() => dialogRef.value?.focus())
})
function doDelete() {
  if (popover.value?.id === confirmDeleteId.value) popover.value = null
  store.deleteSubscription(confirmDeleteId.value)
  confirmDeleteId.value = null
}

const totalMonthly = computed(() => store.subscriptions.value.reduce((sum, s) => sum + store.averageMonthlyAmount(s), 0))
const totalYearly = computed(() => store.subscriptions.value.reduce((sum, s) => sum + store.yearlyAmount(s), 0))
const totalCost = computed(() => store.subscriptions.value.reduce((sum, s) => sum + costShown(s), 0))
</script>

<template>
  <div>
    <Teleport defer to="#page-actions">
      <button class="btn" @click="addSubscription">+ Add Subscription</button>
    </Teleport>

    <div v-if="store.subscriptions.value.length === 0" class="empty-state">
      <div class="icon">&#128179;</div>
      <p>No subscriptions yet. Add your first subscription to track it.</p>
    </div>

    <div v-else ref="tableRef" class="grid-table subs-table" role="table" aria-label="Subscriptions" @focusout="maybeUnfreeze">
      <div class="grid-head" role="row">
        <div
          v-for="col in columns"
          :key="col.key"
          role="columnheader"
          :aria-sort="ariaSort(col.key)"
          :class="[col.cls, { num: col.numeric, sorted: ariaSort(col.key) !== 'none' }]"
        >
          <button type="button" class="th-btn" @click="toggleSort(col.key)">{{ col.label }}<span v-if="sortIndicator(col.key)" class="sort-ind">{{ sortIndicator(col.key) }}</span></button>
        </div>
        <div role="columnheader" class="c-notes">Notes</div>
        <div role="columnheader" class="c-actions"><span class="visually-hidden">Actions</span></div>
      </div>

      <div role="rowgroup">
        <div
          v-for="sub in rows"
          :key="sub.id"
          class="grid-row"
          :class="{ 'is-new': newRowId === sub.id, 'panel-open': popover?.id === sub.id }"
          role="row"
        >
          <div class="grid-cell c-name" role="cell">
            <InlineEdit
              :modelValue="sub.name"
              label="Name"
              placeholder="Subscription name"
              :autoEdit="newRowId === sub.id && !sub.name"
              @update:modelValue="update(sub.id, 'name', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-cat" role="cell">
            <CellMenu
              :modelValue="sub.category || 'Needs'"
              :options="categoryOptions"
              :label="`Category: ${sub.category || 'Needs'}`"
              @update:modelValue="update(sub.id, 'category', $event)"
              @open="onMenuOpen"
              @close="onMenuClose"
            >
              <span class="cat-dot" :style="{ background: `var(--cat-${(sub.category || 'Needs').toLowerCase()})` }" aria-hidden="true" />
              {{ sub.category || 'Needs' }}
            </CellMenu>
          </div>
          <div class="grid-cell c-freq" role="cell">
            <CellMenu
              :modelValue="sub.frequency"
              :options="frequencyOptions"
              :actions="customMonthsAction"
              :label="`Frequency: ${sub.frequency}`"
              @update:modelValue="update(sub.id, 'frequency', $event)"
              @action="togglePopover(sub.id)"
              @open="onMenuOpen"
              @close="onMenuClose"
            >{{ sub.frequency }}</CellMenu>
          </div>
          <div class="grid-cell c-day num" role="cell">
            <CellMenu
              :modelValue="Number(sub.renewalDate) || 1"
              :options="dayOptions"
              align="end"
              :label="`Renewal day: ${ordinal(sub.renewalDate)}`"
              @update:modelValue="update(sub.id, 'renewalDate', $event)"
              @open="onMenuOpen"
              @close="onMenuClose"
            >{{ ordinal(sub.renewalDate) }}</CellMenu>
          </div>
          <div class="grid-cell c-cost num strong" role="cell">
            <button
              v-if="hasOverrides(sub)"
              type="button"
              class="inline-display"
              :aria-label="`Cost this month: ${money(costShown(sub))}. Edit charged months`"
              @click="togglePopover(sub.id)"
            >{{ money(costShown(sub)) }}</button>
            <InlineEdit
              v-else
              :modelValue="Number(sub.cost) || 0"
              type="number"
              label="Cost"
              :format="money"
              @update:modelValue="update(sub.id, 'cost', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-monthly num muted" role="cell">{{ money(store.averageMonthlyAmount(sub)) }}</div>
          <div class="grid-cell c-yearly num muted" role="cell">{{ money(store.yearlyAmount(sub)) }}</div>
          <div class="grid-cell c-notes muted" role="cell">
            <InlineEdit
              :modelValue="sub.notes || ''"
              type="textarea"
              label="Notes"
              placeholder="Add note"
              @update:modelValue="update(sub.id, 'notes', $event)"
              @editing="onEditing"
            />
          </div>
          <div class="grid-cell c-actions" role="cell">
            <div class="row-actions">
              <button
                :ref="el => (calendarBtns[sub.id] = el)"
                type="button"
                class="action-btn"
                :class="{ 'has-overrides': hasOverrides(sub), open: popover?.id === sub.id }"
                :aria-label="`Charged months for ${sub.name || 'subscription'}`"
                :aria-expanded="popover?.id === sub.id"
                title="Charged months"
                @click="togglePopover(sub.id)"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></svg>
              </button>
              <button
                type="button"
                class="action-btn"
                :aria-label="`Delete ${sub.name || 'subscription'}`"
                title="Delete"
                @click="confirmDeleteId = sub.id"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid-row totals" role="row">
        <div class="grid-cell c-name totals-label" role="rowheader">Total</div>
        <div class="grid-cell c-cat" role="cell" />
        <div class="grid-cell c-freq" role="cell" />
        <div class="grid-cell c-day" role="cell" />
        <div class="grid-cell c-cost num strong" role="cell">{{ money(totalCost) }}</div>
        <div class="grid-cell c-monthly num strong" role="cell">{{ money(totalMonthly) }}</div>
        <div class="grid-cell c-yearly num strong" role="cell">{{ money(totalYearly) }}</div>
        <div class="grid-cell c-notes" role="cell" />
        <div class="grid-cell c-actions" role="cell" />
      </div>
    </div>

    <MonthOverridesPopover
      v-if="popoverSub && calendarBtns[popoverSub.id]"
      :key="popoverSub.id"
      :anchorEl="calendarBtns[popoverSub.id]"
      :name="popoverSub.name"
      :baseAmount="Number(popoverSub.cost) || 0"
      :rates="popoverSub.seasonalRates || {}"
      :frequency="popoverSub.frequency"
      :selectedMonth="store.selectedMonth.value"
      @update:rates="update(popoverSub.id, 'seasonalRates', $event)"
      @close="closePopover"
    />

    <!-- Confirm delete dialog -->
    <Transition name="modal" :duration="{ enter: 500, leave: 200 }">
      <div v-if="confirmDeleteId" class="confirm-overlay" @click.self="confirmDeleteId = null" @keydown.escape="confirmDeleteId = null">
        <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-sub-title" ref="dialogRef" tabindex="-1">
          <h2 id="delete-sub-title" class="h3">Delete Subscription?</h2>
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
/* Name · Category · Frequency · Day · Cost · Monthly · Yearly · Notes · Actions */
.subs-table {
  --cols: minmax(140px, 1.5fr) 112px 104px 52px 100px 96px 100px minmax(100px, 1.2fr) 64px;
}

@media (max-width: 1100px) {
  .subs-table {
    --cols: minmax(140px, 1.5fr) 112px 104px 52px 100px minmax(100px, 1.2fr) 64px;
  }
  .c-monthly,
  .c-yearly {
    display: none;
  }
}

/* Phone: two-line rows — name + cost, then category · frequency · day · note */
@media (max-width: 820px) {
  .subs-table .grid-row {
    grid-template-columns: auto auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      "name name name name cost"
      "cat freq day notes actions";
  }
  .c-name { grid-area: name; }
  .c-cost { grid-area: cost; }
  .c-cat { grid-area: cat; }
  .c-freq { grid-area: freq; }
  .c-day { grid-area: day; }
  .c-notes { grid-area: notes; }
  .c-actions { grid-area: actions; }
  .totals .c-cat,
  .totals .c-freq,
  .totals .c-day,
  .totals .c-notes,
  .totals .c-actions {
    display: none;
  }
}
</style>
