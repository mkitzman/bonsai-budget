<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, provide } from 'vue'
import OverviewTab from './components/OverviewTab.vue'
import BillsTab from './components/BillsTab.vue'
import SubscriptionsTab from './components/SubscriptionsTab.vue'
import ExpensesTab from './components/ExpensesTab.vue'
import AboutTab from './components/AboutTab.vue'
import BonsaiIcon from './components/BonsaiIcon.vue'
import { useStore } from './composables/useStore.js'
import { signInWithGoogle, signOut } from './composables/useFireSync.js'

const store = useStore()
// About lives in the account menu (or beside Sign in) so the segmented nav fits on phones
const tabs = ['Overview', 'Bills', 'Subscriptions', 'Expenses']
const activeTab = ref('Overview')

const userMenuOpen = ref(false)
const userMenuRef = ref(null)
function toggleUserMenu() { userMenuOpen.value = !userMenuOpen.value }
function closeUserMenu() { userMenuOpen.value = false }
function handleSignOut() { closeUserMenu(); signOut() }
function openAbout() { activeTab.value = 'About'; closeUserMenu() }
function handleClickOutside(e) {
  if (userMenuOpen.value && userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    closeUserMenu()
  }
}
function handleEscape(e) {
  if (e.key === 'Escape' && userMenuOpen.value) closeUserMenu()
}

// Month menu — anchored below the month button in the page header
const monthMenuOpen = ref(false)
const monthMenuRef = ref(null)
const monthButtonRef = ref(null)
const monthItemEls = []
function openMonthMenu(focusIndex = store.selectedMonth.value) {
  monthMenuOpen.value = true
  nextTick(() => monthItemEls[focusIndex]?.focus())
}
function closeMonthMenu({ restoreFocus = false } = {}) {
  monthMenuOpen.value = false
  if (restoreFocus) monthButtonRef.value?.focus()
}
function toggleMonthMenu() {
  if (monthMenuOpen.value) closeMonthMenu()
  else openMonthMenu()
}
function selectMonth(i) {
  store.selectedMonth.value = i
  closeMonthMenu({ restoreFocus: true })
}
function handleMonthButtonKeydown(e) {
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault()
    openMonthMenu()
  }
}
function handleMonthMenuKeydown(e) {
  const current = monthItemEls.indexOf(document.activeElement)
  const last = monthItemEls.length - 1
  const moves = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: last }
  if (e.key in moves) {
    e.preventDefault()
    monthItemEls[Math.min(last, Math.max(0, moves[e.key]))]?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closeMonthMenu({ restoreFocus: true })
  } else if (e.key === 'Tab') {
    closeMonthMenu()
  }
}
function handleMonthClickOutside(e) {
  if (monthMenuOpen.value && monthMenuRef.value && !monthMenuRef.value.contains(e.target)) {
    closeMonthMenu()
  }
}

// Segmented-control selection indicator — measured so it can slide between tabs
const tabButtonsRef = ref(null)
const tabEls = []
const indicator = ref({ x: 0, w: 0, ready: false })
function updateIndicator() {
  const el = tabEls[tabs.indexOf(activeTab.value)]
  // No segment is selected on About, so the thumb fades out in place
  if (!el) {
    indicator.value = { ...indicator.value, hidden: true }
    return
  }
  indicator.value = { x: el.offsetLeft, w: el.offsetWidth, ready: indicator.value.ready, hidden: false }
  // Enable the spring only after the first placement so it doesn't slide in from 0
  if (!indicator.value.ready) requestAnimationFrame(() => { indicator.value.ready = true })
}
watch(activeTab, () => nextTick(updateIndicator))
let resizeObserver
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('click', handleMonthClickOutside)
  document.addEventListener('keydown', handleEscape)
  nextTick(updateIndicator)
  document.fonts?.ready.then(updateIndicator)
  resizeObserver = new ResizeObserver(updateIndicator)
  if (tabButtonsRef.value) resizeObserver.observe(tabButtonsRef.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('click', handleMonthClickOutside)
  document.removeEventListener('keydown', handleEscape)
  resizeObserver?.disconnect()
})

// Theme
function getInitialTheme() {
  const saved = localStorage.getItem('bt-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const isDark = ref(getInitialTheme() === 'dark')
document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')

// Palette (color theme)
const PALETTES = [
  { id: 'apple', label: 'Modern', swatches: ['#0a84ff', '#2A684A', '#bf5af2'] },
  { id: 'bonsai', label: 'Bonsai', swatches: ['#4F128C', '#2A684A', '#b8860b'] },
]
const palette = ref(localStorage.getItem('bt-palette') || 'apple')
function applyPalette(p) {
  if (p === 'apple') document.documentElement.removeAttribute('data-palette')
  else document.documentElement.setAttribute('data-palette', p)
}
applyPalette(palette.value)
provide('palette', palette)
function setPalette(p) {
  palette.value = p
  localStorage.setItem('bt-palette', p)
  applyPalette(p)
}

function toggleTheme() {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('bt-theme', theme)
}

// Listen for system changes when no manual override
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('bt-theme')) {
    isDark.value = e.matches
    document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')
  }
})

const tabComponent = computed(() => {
  const map = { Overview: OverviewTab, Bills: BillsTab, Subscriptions: SubscriptionsTab, Expenses: ExpensesTab, About: AboutTab }
  return map[activeTab.value]
})

// Every page except About is scoped to the selected month
const isMonthScoped = computed(() => activeTab.value !== 'About')

function handleTabKeydown(event, index) {
  let newIndex
  if (event.key === 'ArrowLeft') {
    newIndex = index === 0 ? tabs.length - 1 : index - 1
  } else if (event.key === 'ArrowRight') {
    newIndex = index === tabs.length - 1 ? 0 : index + 1
  } else {
    return
  }
  event.preventDefault()
  activeTab.value = tabs[newIndex]
  document.getElementById(`tab-${tabs[newIndex]}`)?.focus()
}
</script>

<template>
    <header class="toolbar" :class="{ 'signed-out': !store.syncStatus.user.value }">
      <button class="brand" @click="activeTab = 'Overview'" aria-label="BonsaiBudget — go to Overview">
        <span class="brand-mark"><BonsaiIcon class="brand-icon" /></span>
        <span class="brand-name">Bonsai<span class="brand-name-light">Budget</span></span>
      </button>

      <nav class="toolbar-nav" aria-label="Pages">
        <div class="tab-buttons" role="tablist" ref="tabButtonsRef">
          <span
            class="tab-indicator"
            :class="{ ready: indicator.ready, hidden: indicator.hidden }"
            :style="{ width: `${indicator.w}px`, transform: `translateX(${indicator.x}px)` }"
            aria-hidden="true"
          />
          <button
            v-for="(tab, index) in tabs"
            :key="tab"
            :ref="el => (tabEls[index] = el)"
            :id="`tab-${tab}`"
            role="tab"
            :aria-selected="activeTab === tab"
            :tabindex="activeTab === tab ? 0 : -1"
            :class="['tab-btn', { active: activeTab === tab }]"
            @click="activeTab = tab"
            @keydown="handleTabKeydown($event, index)"
          >
            {{ tab }}
          </button>
        </div>
      </nav>

      <div class="toolbar-right">
        <div v-if="store.syncStatus.user.value" class="user-menu" ref="userMenuRef">
          <button class="avatar-btn" @click="toggleUserMenu" :aria-expanded="userMenuOpen" aria-haspopup="true" aria-label="Account menu">
            <img v-if="store.syncStatus.user.value.photoURL" :src="store.syncStatus.user.value.photoURL" class="avatar" referrerpolicy="no-referrer" alt="" />
            <span v-else class="avatar avatar-fallback">{{ (store.syncStatus.user.value.displayName || store.syncStatus.user.value.email || '?')[0].toUpperCase() }}</span>
            <span
              v-if="store.syncStatus.uid.value"
              class="sync-badge"
              :class="{ syncing: store.syncStatus.isSyncing.value }"
              :title="store.syncStatus.isSyncing.value ? 'Syncing…' : 'Synced to cloud'"
            />
          </button>
          <Transition name="popover">
          <div v-if="userMenuOpen" class="user-dropdown" role="menu">
            <div class="user-dropdown-header">
              <img v-if="store.syncStatus.user.value.photoURL" :src="store.syncStatus.user.value.photoURL" class="avatar avatar-lg" referrerpolicy="no-referrer" alt="" />
              <div class="user-dropdown-identity">
                <div class="user-dropdown-name">{{ store.syncStatus.user.value.displayName || store.syncStatus.user.value.email }}</div>
                <div v-if="store.syncStatus.user.value.displayName" class="user-dropdown-email text-sm text-secondary">{{ store.syncStatus.user.value.email }}</div>
              </div>
            </div>
            <div class="user-dropdown-divider" />
            <div class="user-dropdown-section">
              <div class="user-dropdown-label">Color palette</div>
              <div class="palette-options">
                <button
                  v-for="p in PALETTES"
                  :key="p.id"
                  class="palette-option"
                  :class="{ active: palette === p.id }"
                  @click.stop="setPalette(p.id)"
                >
                  <span class="palette-swatches">
                    <span v-for="c in p.swatches" :key="c" class="palette-swatch" :style="{ background: c }" />
                  </span>
                  <span>{{ p.label }}</span>
                </button>
              </div>
            </div>
            <div class="user-dropdown-divider" />
            <div class="user-dropdown-item theme-row" role="menuitem">
              <span>{{ isDark ? 'Dark mode' : 'Light mode' }}</span>
              <button class="theme-toggle" :class="{ dark: isDark }" @click.stop="toggleTheme" :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
                <div class="toggle-track">
                  <div class="toggle-thumb">
                    <div class="crater crater-1" />
                    <div class="crater crater-2" />
                    <div class="crater crater-3" />
                  </div>
                  <div class="stars">
                    <div class="star star-1" />
                    <div class="star star-2" />
                    <div class="star star-3" />
                  </div>
                </div>
              </button>
            </div>
            <div class="user-dropdown-divider" />
            <button class="user-dropdown-item" :class="{ current: activeTab === 'About' }" role="menuitem" @click="openAbout">About</button>
            <div class="user-dropdown-divider" />
            <button class="user-dropdown-item sign-out" role="menuitem" @click="handleSignOut">Sign out</button>
          </div>
          </Transition>
        </div>
        <button v-else class="sign-in-link" @click="signInWithGoogle">Sign in</button>
      </div>
    </header>

    <div class="app-body">
    <div class="page-header">
      <div class="page-title-group">
        <h1 class="page-title">{{ activeTab }}</h1>
        <div v-if="isMonthScoped" class="month-menu" ref="monthMenuRef">
          <button
            ref="monthButtonRef"
            class="month-button"
            aria-haspopup="menu"
            :aria-expanded="monthMenuOpen"
            aria-controls="month-menu-list"
            @click="toggleMonthMenu"
            @keydown="handleMonthButtonKeydown"
          >
            {{ store.monthNames[store.selectedMonth.value] }}<span class="month-chevron" aria-hidden="true" />
          </button>
          <Transition name="popover">
            <div
              v-if="monthMenuOpen"
              id="month-menu-list"
              class="month-list"
              role="menu"
              aria-label="Month"
              @keydown="handleMonthMenuKeydown"
            >
              <button
                v-for="(name, i) in store.monthNames"
                :key="i"
                :ref="el => (monthItemEls[i] = el)"
                class="month-item"
                :class="{ selected: store.selectedMonth.value === i }"
                role="menuitemradio"
                :aria-checked="store.selectedMonth.value === i"
                tabindex="-1"
                @click="selectMonth(i)"
              >{{ name }}</button>
            </div>
          </Transition>
        </div>
      </div>
      <!-- Pages teleport their primary action (e.g. "+ Add Bill") here -->
      <div id="page-actions" class="page-actions" />
    </div>

    <main class="tab-content" :role="tabs.includes(activeTab) ? 'tabpanel' : undefined" :aria-labelledby="tabs.includes(activeTab) ? `tab-${activeTab}` : undefined">
      <transition name="tab-fade">
        <component :is="tabComponent" :key="activeTab" />
      </transition>
    </main>

    <!-- Signed-out visitors have no account menu, so About is reachable from the footer -->
    <footer v-if="!store.syncStatus.user.value" class="app-footer">
      <button class="about-link" :class="{ current: activeTab === 'About' }" @click="activeTab = 'About'">About BonsaiBudget</button>
    </footer>
    </div>
</template>

<style scoped>
/* Toolbar — 52px frosted bar: brand · segmented nav · avatar */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: grid;
  /* Equal side columns keep the nav truly centered */
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  height: 52px;
  padding: 0 20px;
  background: var(--toolbar-bg);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--hairline);
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
  justify-self: start;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font);
  border-radius: 6px;
}

.brand-mark {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-icon {
  /* Visible glyph ≈ 52% of the tile, matching the 4a reference (16px padded asset in a 22px tile) */
  width: 11.5px;
  height: 11.5px;
  color: #fff;
}

/* Wordmark: Manrope, "Bonsai" bold + "Budget" medium grey, no space */
.brand-name {
  font-family: 'Manrope', var(--font);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.3px;
  color: var(--wordmark-primary);
  white-space: nowrap;
}

.brand-name-light {
  font-weight: 500;
  color: var(--wordmark-secondary);
}

.toolbar-nav {
  min-width: 0;
  display: flex;
  justify-content: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

/* Page header — large title with inline month menu, page action on the right */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 36px 0 28px;
}

.page-title-group {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.page-title {
  font-family: var(--font);
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.6px;
  color: var(--text-primary);
}

.month-menu {
  position: relative;
}

.month-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 17px;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.month-button:hover {
  color: var(--accent-light);
}

.month-chevron {
  width: 6px;
  height: 6px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: translateY(-3px) rotate(45deg);
}

.month-list {
  position: absolute;
  top: calc(100% + 8px);
  left: -8px;
  z-index: 60;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-height: min(420px, 70vh);
  overflow-y: auto;
  padding: 6px;
  background: var(--material-thick);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border-radius: 12px;
  box-shadow: 0 0 0 0.5px var(--material-edge) inset, 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.18);
  /* Grows out of the month button that opened it */
  transform-origin: top left;
}

.month-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 6px 26px;
  border: none;
  border-radius: 7px;
  background: none;
  font-family: var(--font);
  font-size: 14px;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  position: relative;
}

.month-item.selected::before {
  content: '✓';
  position: absolute;
  left: 9px;
  font-weight: 600;
}

.month-item:hover,
.month-item:focus-visible {
  background: var(--accent);
  color: #fff;
  outline: none;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.page-actions:empty {
  display: none;
}

/* Header-level primary action: 36px, radius 10, 15/600 */
.page-actions :deep(.btn) {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
}

/* Keyboard focus ring for toolbar + page header controls */
.brand:focus-visible,
.tab-btn:focus-visible,
.month-button:focus-visible,
.avatar-btn:focus-visible,
.sign-in-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.5);
}

.user-menu {
  position: relative;
}

.avatar-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  line-height: 0;
  position: relative;
  transition: box-shadow 0.2s, transform var(--spring-duration) var(--spring);
}

.avatar-btn:active {
  transform: scale(0.92);
  transition-duration: var(--press-duration);
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: block;
  box-shadow: 0 0 0 1px var(--avatar-ring);
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--green);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
}

.avatar-lg {
  width: 40px;
  height: 40px;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 250px;
  background: var(--material-thick);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
  border-radius: 14px;
  box-shadow: 0 0 0 0.5px var(--material-edge) inset, 0 0 0 0.5px rgba(0, 0, 0, 0.08), 0 12px 40px rgba(0, 0, 0, 0.18);
  padding: 6px;
  z-index: 100;
  /* Grows out of the avatar that opened it */
  transform-origin: top right;
}

.popover-enter-active {
  transition: opacity 0.2s ease, transform var(--spring-duration) var(--spring);
}
.popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease-in;
}
.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.user-dropdown-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 10px;
}

.user-dropdown-identity {
  min-width: 0;
}

.user-dropdown-name {
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-dropdown-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-dropdown-divider {
  height: 0.5px;
  background: var(--border);
  margin: 5px 10px;
}

.user-dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 8px 10px;
  border-radius: 8px;
  font: inherit;
  color: var(--text-primary);
  cursor: pointer;
}

.user-dropdown-item.sign-out {
  color: var(--red);
}

.user-dropdown-item.sign-out:hover {
  background: var(--red);
  color: #fff;
}

.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: default;
}

.user-dropdown-section {
  padding: 6px 10px;
}

.user-dropdown-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.palette-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.palette-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font: inherit;
  color: var(--text-primary);
  text-align: left;
}

.palette-option:hover {
  background: var(--fill);
}

.palette-option.active {
  background: var(--fill);
  font-weight: 600;
}

.palette-option.active::after {
  content: '✓';
  margin-left: auto;
  color: var(--accent);
  font-weight: 600;
}

.palette-swatches {
  display: inline-flex;
  gap: 2px;
}

.palette-swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  box-shadow: 0 0 0 0.5px rgba(0, 0, 0, 0.15) inset;
}

.theme-row:hover {
  background: transparent;
  color: var(--text-primary);
}

.app-footer {
  display: flex;
  justify-content: center;
  padding-top: 32px;
}

.about-link {
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
}

.about-link:hover,
.about-link.current {
  color: var(--text-primary);
}

.about-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.5);
}

.user-dropdown-item.current {
  font-weight: 600;
}

.sign-in-link {
  padding: 0;
  border: none;
  background: none;
  font-family: var(--font);
  font-size: 14px;
  color: var(--accent);
  cursor: pointer;
  font-weight: 500;
  border-radius: 4px;
}

.sign-in-link:hover {
  text-decoration: underline;
}

/* Sun/Moon Toggle */
.theme-toggle {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  outline: none;
}

.toggle-track {
  width: 56px;
  height: 28px;
  border-radius: 14px;
  background: linear-gradient(180deg, #74b9ff 0%, #81ecec 100%);
  position: relative;
  overflow: hidden;
  transition: background 0.4s ease;
}

.dark .toggle-track {
  background: linear-gradient(180deg, #2d3436 0%, #636e72 100%);
}

.toggle-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffeaa7;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform var(--spring-duration) var(--spring), background-color 0.4s ease, box-shadow 0.4s ease;
  box-shadow: 0 0 6px rgba(253, 203, 110, 0.6);
  z-index: 2;
}

.dark .toggle-thumb {
  transform: translateX(28px);
  background: #dfe6e9;
  box-shadow: 0 0 6px rgba(223, 230, 233, 0.4);
}

/* Craters (moon) */
.crater {
  position: absolute;
  border-radius: 50%;
  background: #b2bec3;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.dark .crater {
  opacity: 1;
}

.crater-1 { width: 5px; height: 5px; top: 4px; left: 6px; }
.crater-2 { width: 3px; height: 3px; top: 12px; left: 10px; }
.crater-3 { width: 4px; height: 4px; top: 8px; left: 3px; }

/* Stars */
.stars {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.star {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.dark .star {
  opacity: 1;
}

.star-1 { width: 2px; height: 2px; top: 6px; left: 10px; }
.star-2 { width: 3px; height: 3px; top: 16px; left: 16px; }
.star-3 { width: 2px; height: 2px; top: 10px; left: 22px; }

/* Sync indicator — small status dot on the avatar */
.sync-badge {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 2px var(--bg);
  transition: background-color 0.3s;
}

.sync-badge.syncing {
  background: var(--orange);
  animation: pulse 1s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Segmented control */
.tab-buttons {
  display: flex;
  position: relative;
  min-width: 0;
  padding: 2px;
  gap: 2px;
  background: var(--segment-track);
  border-radius: 9px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-buttons::-webkit-scrollbar {
  display: none;
}

.tab-indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  border-radius: 7px;
  background: var(--segment-thumb);
  box-shadow: var(--segment-thumb-shadow);
  pointer-events: none;
}

/* Slides from wherever it currently is — CSS transitions retarget mid-flight */
.tab-indicator.hidden {
  opacity: 0;
}

.tab-indicator.ready {
  transition: transform var(--spring-duration) var(--spring), width var(--spring-duration) var(--spring), opacity 0.2s ease;
}

.tab-btn {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 5px 14px;
  border: none;
  border-radius: 7px;
  background: none;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  color: var(--segment-label);
  cursor: pointer;
  touch-action: manipulation;
  transition: color 0.2s ease, opacity 0.15s ease;
}

@media (hover: hover) {
  .tab-btn:not(.active):hover {
    color: var(--segment-label-active);
  }
}

.tab-btn:not(.active):active {
  opacity: 0.55;
  transition-duration: var(--press-duration);
}

.tab-btn.active {
  color: var(--segment-label-active);
  font-weight: 600;
}

/* Responsive */
@media (max-width: 900px) {
  .tab-btn {
    font-size: 12px;
    padding: 5px 10px;
  }
}

@media (max-width: 720px) {
  .toolbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .brand-name {
    display: none;
  }
}

@media (max-width: 600px) {
  .toolbar {
    padding: 0 12px;
    gap: 8px;
  }
  .toolbar-right {
    gap: 10px;
  }
  .tab-btn {
    padding: 5px 6px;
  }
  .toolbar.signed-out {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .toolbar.signed-out .brand {
    display: none;
  }
}

/* Small phones (iPhone mini/SE): the Overview tab already goes home, so the logo can step aside */
@media (max-width: 380px) {
  .toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .brand {
    display: none;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 24px 0 20px;
  }
}

/* New tab fades in immediately — no waiting for the old one to leave */
.tab-fade-enter-active {
  transition: opacity 0.2s ease;
}
.tab-fade-enter-from {
  opacity: 0;
}
.tab-fade-leave-active {
  display: none;
}

.tab-content {
  min-height: 400px;
}
</style>
