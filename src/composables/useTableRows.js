import { ref, computed } from 'vue'

/**
 * Sorting + row-order freezing shared by the Bills and Subscriptions tables.
 *
 * While someone is editing, the row order is frozen so rows don't jump out from
 * under the cursor; it re-sorts once focus leaves the table. New rows are pinned
 * to the top until the table unfreezes.
 *
 * @param {import('vue').Ref<Array>} source - reactive list of rows (each with an `id`)
 * @param {(row: object, key: string) => any} sortValue - value to sort a row by for a given key
 * @param {string} initialKey
 */
export function useTableRows(source, sortValue, initialKey = 'name') {
  const sortKey = ref(initialKey)
  const sortAsc = ref(true)
  const frozenIds = ref(null)
  const newRowId = ref(null)

  function toggleSort(key) {
    if (sortKey.value === key) sortAsc.value = !sortAsc.value
    else {
      sortKey.value = key
      sortAsc.value = true
    }
    frozenIds.value = null
  }

  function compare(a, b) {
    let va = sortValue(a, sortKey.value)
    let vb = sortValue(b, sortKey.value)
    if (typeof va === 'string' || typeof vb === 'string') {
      va = String(va ?? '').toLowerCase()
      vb = String(vb ?? '').toLowerCase()
    }
    if (va < vb) return sortAsc.value ? -1 : 1
    if (va > vb) return sortAsc.value ? 1 : -1
    return 0
  }

  const rows = computed(() => {
    const list = source.value
    if (frozenIds.value) {
      const byId = new Map(list.map(r => [r.id, r]))
      const ordered = frozenIds.value.map(id => byId.get(id)).filter(Boolean)
      const known = new Set(frozenIds.value)
      list.forEach(r => { if (!known.has(r.id)) ordered.push(r) })
      return ordered
    }
    return [...list].sort(compare)
  })

  function freeze() {
    if (!frozenIds.value) frozenIds.value = rows.value.map(r => r.id)
  }

  function unfreeze() {
    frozenIds.value = null
    newRowId.value = null
  }

  // Runs the store's add function, then pins the new row to the top
  function addRow(addFn) {
    const before = new Set(source.value.map(r => r.id))
    addFn()
    const added = source.value.find(r => !before.has(r.id))
    if (!added) return null
    freeze()
    frozenIds.value = [added.id, ...frozenIds.value.filter(id => id !== added.id)]
    newRowId.value = added.id
    return added.id
  }

  function ariaSort(key) {
    if (sortKey.value !== key) return 'none'
    return sortAsc.value ? 'ascending' : 'descending'
  }

  function sortIndicator(key) {
    if (sortKey.value !== key) return ''
    return sortAsc.value ? '↑' : '↓'
  }

  return { sortKey, sortAsc, rows, toggleSort, freeze, unfreeze, addRow, newRowId, ariaSort, sortIndicator }
}

const ordinalSuffix = (n) => {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

export const ordinal = (n) => {
  const num = Number(n) || 0
  return `${num}${ordinalSuffix(num)}`
}

export const money = (n) => {
  const num = Number(n) || 0
  const abs = Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${num < 0 ? '−' : ''}$${abs}`
}

// Compact currency for tight spaces: no cents when whole ($433), cents otherwise ($35.88)
export const moneyCompact = (n) => {
  const num = Number(n) || 0
  const whole = Math.round(num * 100) % 100 === 0
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
