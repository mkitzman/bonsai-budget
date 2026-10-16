import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useFireSync, useSyncStatus } from './useFireSync.js'

const income = useFireSync('bt-income', 0)
const bills = useFireSync('bt-bills', [])
const subscriptions = useFireSync('bt-subscriptions', [])
const expenses = useFireSync('bt-expenses', [])
const selectedMonth = ref(new Date().getMonth()) // 0-indexed, shared across all consumers
const selectedYear = ref(new Date().getFullYear())
const categoryTargets = useFireSync('bt-category-targets', { Needs: 0.50, Wants: 0.30, Savings: 0.20 })
const includeExpenses = useFireSync('bt-include-expenses', true)
// Day of month each pay period starts on; each period runs until the day before the next one
const payPeriodStarts = useFireSync('bt-pay-period-starts', [1, 16])

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function useStore() {
  const totalBills = computed(() => {
    return bills.value.reduce((sum, bill) => {
      if (bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0) {
        const rate = bill.seasonalRates[selectedMonth.value]
        return sum + (rate !== undefined && rate !== null ? Number(rate) : Number(bill.amount) || 0)
      }
      return sum + (Number(bill.amount) || 0)
    }, 0)
  })

  const totalSubscriptions = computed(() => {
    return subscriptions.value
      .reduce((sum, s) => sum + getSubscriptionCurrentAmount(s), 0)
  })

  const remaining = computed(() => {
    return (Number(income.value) || 0) - totalBills.value - totalSubscriptions.value
  })

  const categories = ['Needs', 'Wants', 'Savings']

  function setPayPeriodStarts(starts) {
    const clean = [...new Set(starts.map(d => Math.min(31, Math.max(1, Math.round(Number(d) || 1)))))]
      .sort((a, b) => a - b)
    if (clean[0] !== 1) clean.unshift(1)
    payPeriodStarts.value = clean
  }

  // Bills and subscriptions for the selected month, split by pay period (based on due/renewal day)
  const payPeriods = computed(() => {
    const daysInMonth = new Date(selectedYear.value, selectedMonth.value + 1, 0).getDate()
    const starts = (payPeriodStarts.value.length ? payPeriodStarts.value : [1]).filter(d => d <= daysInMonth)
    const incomeShare = (Number(income.value) || 0) / starts.length
    const shortMonth = monthNames[selectedMonth.value].slice(0, 3)

    // Days past the end of the month (e.g. 31 in a 30-day month) land in the last period
    const periodIndex = (day) => {
      const d = Math.max(1, Number(day) || 1)
      let idx = 0
      starts.forEach((start, i) => { if (d >= start) idx = i })
      return idx
    }

    const periods = starts.map((start, i) => {
      const end = i < starts.length - 1 ? starts[i + 1] - 1 : daysInMonth
      return {
        start,
        end,
        label: start === end ? `${shortMonth} ${start}` : `${shortMonth} ${start}–${end}`,
        income: incomeShare,
        bills: 0,
        subscriptions: 0,
        remaining: 0
      }
    })

    bills.value.forEach(b => {
      const amount = getBillCurrentAmount(b)
      // Spread bills (e.g. groceries) are paid from every paycheck, so split them evenly like income
      if (b.dueDate === 'spread') periods.forEach(p => { p.bills += amount / periods.length })
      else periods[periodIndex(b.dueDate)].bills += amount
    })
    subscriptions.value.forEach(s => { periods[periodIndex(s.renewalDate)].subscriptions += getSubscriptionCurrentAmount(s) })
    periods.forEach(p => { p.remaining = p.income - p.bills - p.subscriptions })

    return periods
  })

  function setCategoryTargets(targets) {
    categoryTargets.value = { ...targets }
  }

  const categoryBreakdown = computed(() => {
    const inc = Number(income.value) || 0
    const result = {}

    for (const cat of categories) {
      const target = categoryTargets.value[cat]
      const budgeted = inc * target

      const billItems = bills.value
        .filter(b => b.category === cat)
        .map(b => ({ name: b.name || 'Unnamed', amount: getBillCurrentAmount(b), type: 'bill' }))

      const subItems = subscriptions.value
        .filter(s => s.category === cat)
        .map(s => ({ name: s.name || 'Unnamed', amount: getSubscriptionCurrentAmount(s), type: 'subscription' }))

      const expItems = includeExpenses.value
        ? monthExpenses.value
            .filter(e => e.category === cat)
            .map(e => ({ name: e.name || 'Unnamed', amount: Number(e.amount) || 0, type: 'expense' }))
        : []

      const items = [...billItems, ...subItems, ...expItems]
      const spent = items.reduce((sum, i) => sum + i.amount, 0)
      const remaining = budgeted - spent
      const pctUsed = budgeted > 0 ? (spent / budgeted) * 100 : 0

      result[cat] = { budgeted, spent, remaining, pctUsed, items, target }
    }

    return result
  })

  function monthlyAmount(sub) {
    const cost = Number(sub.cost) || 0
    if (sub.frequency === 'Yearly') return cost / 12
    if (sub.frequency === 'Quarterly') return cost / 3
    return cost
  }

  // Average monthly cost; with monthly overrides this is the year's total spread over 12 months
  function averageMonthlyAmount(sub) {
    return yearlyAmount(sub) / 12
  }

  function yearlyAmount(sub) {
    if (sub.seasonalRates && Object.keys(sub.seasonalRates).length > 0) {
      let total = 0
      for (let m = 0; m < 12; m++) total += getSubscriptionAmountForMonth(sub, m)
      return total
    }
    const cost = Number(sub.cost) || 0
    if (sub.frequency === 'Yearly') return cost
    if (sub.frequency === 'Quarterly') return cost * 4
    return cost * 12
  }

  // Bills CRUD
  function addBill() {
    bills.value.push({
      id: uuidv4(),
      name: '',
      amount: 0,
      tags: [],
      dueDate: 1,
      notes: '',
      fixed: true,
      seasonalRates: {},
      category: 'Needs'
    })
  }

  function updateBill(id, field, value) {
    const bill = bills.value.find(b => b.id === id)
    if (bill) bill[field] = value
  }

  function deleteBill(id) {
    const idx = bills.value.findIndex(b => b.id === id)
    if (idx !== -1) bills.value.splice(idx, 1)
  }

  // Subscriptions CRUD
  function addSubscription() {
    subscriptions.value.push({
      id: uuidv4(),
      name: '',
      tags: [],
      frequency: 'Monthly',
      renewalDate: 1,
      cost: 0,
      notes: '',
      seasonalRates: {},
      category: 'Needs'
    })
  }

  function updateSubscription(id, field, value) {
    const sub = subscriptions.value.find(s => s.id === id)
    if (sub) sub[field] = value
  }

  function deleteSubscription(id) {
    const idx = subscriptions.value.findIndex(s => s.id === id)
    if (idx !== -1) subscriptions.value.splice(idx, 1)
  }

  // Expenses CRUD
  function addExpense() {
    // Dated today when adding to the current month, otherwise the 1st of the selected month
    const now = new Date()
    const isCurrentMonth = now.getMonth() === selectedMonth.value && now.getFullYear() === selectedYear.value
    expenses.value.push({
      id: uuidv4(),
      name: '',
      amount: 0,
      category: 'Needs',
      date: isCurrentMonth ? now.getDate() : 1,
      notes: '',
      month: selectedMonth.value,
      year: selectedYear.value,
      createdAt: Date.now()
    })
  }

  function updateExpense(id, field, value) {
    const exp = expenses.value.find(e => e.id === id)
    if (exp) exp[field] = value
  }

  function deleteExpense(id) {
    const idx = expenses.value.findIndex(e => e.id === id)
    if (idx !== -1) expenses.value.splice(idx, 1)
  }

  const monthExpenses = computed(() => {
    return expenses.value.filter(e =>
      e.month === selectedMonth.value && e.year === selectedYear.value
    )
  })

  const totalExpenses = computed(() => {
    return monthExpenses.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  })

  const adjustedRemaining = computed(() => {
    if (!includeExpenses.value) return remaining.value
    return remaining.value - totalExpenses.value
  })

  // Expenses grouped by month for the Expenses tab
  const expensesByMonth = computed(() => {
    const groups = {}
    expenses.value.forEach(e => {
      const key = `${e.year}-${String(e.month).padStart(2, '0')}`
      if (!groups[key]) {
        groups[key] = { month: e.month, year: e.year, label: `${monthNames[e.month]} ${e.year}`, items: [], total: 0 }
      }
      groups[key].items.push(e)
      groups[key].total += Number(e.amount) || 0
    })
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  })

  function getSubscriptionCurrentAmount(sub) {
    if (sub.seasonalRates && Object.keys(sub.seasonalRates).length > 0) {
      const rate = sub.seasonalRates[selectedMonth.value]
      return rate !== undefined && rate !== null ? Number(rate) : Number(sub.cost) || 0
    }
    return monthlyAmount(sub)
  }

  function getSubscriptionAmountForMonth(sub, month) {
    if (sub.seasonalRates && Object.keys(sub.seasonalRates).length > 0) {
      const rate = sub.seasonalRates[month]
      return rate !== undefined && rate !== null ? Number(rate) : Number(sub.cost) || 0
    }
    return monthlyAmount(sub)
  }

  function getBillAmountForMonth(bill, month) {
    if (bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0) {
      const rate = bill.seasonalRates[month]
      return rate !== undefined && rate !== null ? Number(rate) : Number(bill.amount) || 0
    }
    return Number(bill.amount) || 0
  }

  function getCategoryTotalsForMonth(month) {
    const result = {}
    for (const cat of categories) {
      const billTotal = bills.value
        .filter(b => b.category === cat)
        .reduce((sum, b) => sum + getBillAmountForMonth(b, month), 0)
      const subTotal = subscriptions.value
        .filter(s => s.category === cat)
        .reduce((sum, s) => sum + getSubscriptionAmountForMonth(s, month), 0)
      result[cat] = billTotal + subTotal
    }
    return result
  }

  function getBillCurrentAmount(bill) {
    if (bill.seasonalRates && Object.keys(bill.seasonalRates).length > 0) {
      const rate = bill.seasonalRates[selectedMonth.value]
      return rate !== undefined && rate !== null ? Number(rate) : Number(bill.amount) || 0
    }
    return Number(bill.amount) || 0
  }

  return {
    income,
    bills,
    subscriptions,
    totalBills,
    totalSubscriptions,
    remaining,
    monthlyAmount,
    averageMonthlyAmount,
    yearlyAmount,
    addBill,
    updateBill,
    deleteBill,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    getSubscriptionCurrentAmount,
    getCategoryTotalsForMonth,
    getBillCurrentAmount,
    selectedMonth,
    selectedYear,
    monthNames,
    categories,
    categoryTargets,
    setCategoryTargets,
    includeExpenses,
    payPeriodStarts,
    setPayPeriodStarts,
    payPeriods,
    categoryBreakdown,
    expenses,
    addExpense,
    updateExpense,
    deleteExpense,
    monthExpenses,
    totalExpenses,
    adjustedRemaining,
    expensesByMonth,
    syncStatus: useSyncStatus()
  }
}
