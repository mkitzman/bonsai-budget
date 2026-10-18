<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../composables/useStore.js'

const store = useStore()

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthLabel = computed(() => `${monthNames[viewMonth.value]} ${viewYear.value}`)

function prev() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function next() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

const calendarDays = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const days = []

  for (let i = 0; i < startDay; i++) {
    days.push({ day: null })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const billsOnDay = store.bills.value.filter(b => {
      if (b.seasonalRates && Object.keys(b.seasonalRates).length > 0) {
        const rate = b.seasonalRates[viewMonth.value]
        if (rate === 0 || rate === '0') return false
      }
      return Number(b.dueDate) === d
    })
    const subsOnDay = store.subscriptions.value.filter(s => {
      if (s.seasonalRates && Object.keys(s.seasonalRates).length > 0) {
        const rate = s.seasonalRates[viewMonth.value]
        if (rate === 0 || rate === '0') return false
      }
      return Number(s.renewalDate) === d
    })
    days.push({
      day: d,
      isToday: d === today.getDate() && viewMonth.value === today.getMonth() && viewYear.value === today.getFullYear(),
      bills: billsOnDay,
      subs: subsOnDay
    })
  }

  return days
})

// Up to 3 names per day; the rest collapse into "+N more"
const MAX_ITEMS = 3
function dayItems(cell) {
  const items = [
    ...(cell.bills || []).map(b => ({ key: 'b' + b.id, name: b.name || 'Untitled bill', type: 'bill' })),
    ...(cell.subs || []).map(s => ({ key: 's' + s.id, name: s.name || 'Untitled subscription', type: 'sub' }))
  ]
  return { shown: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) }
}

const hoveredDay = ref(null)

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function billAmountForView(bill) {
  if (bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0) {
    const rate = bill.seasonalRates[viewMonth.value]
    return rate !== undefined && rate !== null ? Number(rate) : Number(bill.amount) || 0
  }
  return Number(bill.amount) || 0
}

function subAmountForView(sub) {
  if (sub.seasonalRates && Object.keys(sub.seasonalRates).length > 0) {
    const rate = sub.seasonalRates[viewMonth.value]
    return rate !== undefined && rate !== null ? Number(rate) : Number(sub.cost) || 0
  }
  const cost = Number(sub.cost) || 0
  if (sub.frequency === 'Yearly') return cost / 12
  if (sub.frequency === 'Quarterly') return cost / 3
  return cost
}
</script>

<template>
  <div class="card calendar">
    <div class="flex items-center justify-between mb-16">
      <h3>Calendar</h3>
      <div class="flex items-center gap-8">
        <button class="btn-icon" @click="prev" aria-label="Previous month">&larr;</button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="btn-icon" @click="next" aria-label="Next month">&rarr;</button>
      </div>
    </div>

    <div class="cal-grid">
      <div v-for="name in dayNames" :key="name" class="cal-header">{{ name }}</div>
      <div
        v-for="(cell, i) in calendarDays"
        :key="i"
        :class="['cal-cell', { today: cell.isToday, empty: !cell.day }]"
        @mouseenter="hoveredDay = cell.day ? cell : null"
        @mouseleave="hoveredDay = null"
      >
        <span v-if="cell.day" class="day-num">{{ cell.day }}</span>
        <!-- Names on wider screens, dots on phones where cells are too narrow -->
        <ul v-if="cell.day && dayItems(cell).shown.length" class="cal-items">
          <li v-for="item in dayItems(cell).shown" :key="item.key" class="cal-item">
            <span class="dot" :class="item.type === 'bill' ? 'dot-bill' : 'dot-sub'" aria-hidden="true" />
            <span class="cal-item-name">{{ item.name }}</span>
          </li>
          <li v-if="dayItems(cell).more" class="cal-more">+{{ dayItems(cell).more }} more</li>
        </ul>
        <div v-if="cell.day" class="dots">
          <span v-for="b in (cell.bills || []).slice(0, 3)" :key="'b'+b.id" class="dot dot-bill" :title="b.name" />
          <span v-for="s in (cell.subs || []).slice(0, 3)" :key="'s'+s.id" class="dot dot-sub" :title="s.name" />
        </div>
      </div>
    </div>

    <div v-if="hoveredDay && (hoveredDay.bills?.length || hoveredDay.subs?.length)" class="cal-tooltip">
      <div v-for="b in hoveredDay.bills" :key="'tb'+b.id" class="tooltip-item">
        <span class="dot dot-bill" /> {{ b.name }} — ${{ fmt(billAmountForView(b)) }}
      </div>
      <div v-for="s in hoveredDay.subs" :key="'ts'+s.id" class="tooltip-item">
        <span class="dot dot-sub" /> {{ s.name }} — ${{ fmt(subAmountForView(s)) }}
      </div>
    </div>

    <div class="legend mt-8">
      <span><span class="dot dot-bill" /> Bills</span>
      <span><span class="dot dot-sub" /> Subscriptions</span>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  position: relative;
}

.month-label {
  font-weight: 600;
  font-size: 15px;
  min-width: 160px;
  text-align: center;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-header {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 6px 0;
}

.cal-cell {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  min-height: 104px;
  padding: 6px 6px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  cursor: default;
}

/* Day number sits top-right, like the month view in Calendar; same box as the "today" circle so numbers line up */
.cal-cell .day-num {
  align-self: flex-end;
  min-width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0;
}

.cal-items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cal-item {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-body);
}

.cal-item .dot {
  width: 6px;
  height: 6px;
}

.cal-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-more {
  padding-left: 11px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
}

/* Dots are the phone fallback */
.cal-cell .dots {
  display: none;
}

@media (max-width: 600px) {
  .cal-cell {
    min-height: 48px;
    align-items: center;
    padding: 4px 2px;
  }
  .cal-cell .day-num {
    align-self: center;
  }
  .cal-items {
    display: none;
  }
  .cal-cell .dots {
    display: flex;
  }
}

.cal-cell:not(.empty):hover {
  background: var(--surface-secondary);
}

.cal-cell.today .day-num {
  background: var(--accent);
  color: #fff;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.day-num {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}

.dots {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
  justify-content: center;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.dot-bill { background: var(--orange); }
.dot-sub { background: var(--accent); }

.cal-tooltip {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(28, 28, 30, 0.95);
  color: #fff;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  z-index: 10;
  white-space: nowrap;
  box-shadow: var(--shadow-lg);
}

.tooltip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend span {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
