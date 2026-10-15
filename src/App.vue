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
const tabs = ['Overview', 'Bills', 'Subscriptions', 'Expenses', 'About']
const activeTab = ref('Overview')

const userMenuOpen = ref(false)
const userMenuRef = ref(null)
function toggleUserMenu() { userMenuOpen.value = !userMenuOpen.value }
function closeUserMenu() { userMenuOpen.value = false }
function handleSignOut() { closeUserMenu(); signOut() }
function handleClickOutside(e) {
  if (userMenuOpen.value && userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    closeUserMenu()
  }
}
function handleEscape(e) {
  if (e.key === 'Escape' && userMenuOpen.value) closeUserMenu()
}

// Segmented-control selection indicator — measured so it can slide between tabs
const tabButtonsRef = ref(null)
const tabEls = []
const indicator = ref({ x: 0, w: 0, ready: false })
function updateIndicator() {
  const el = tabEls[tabs.indexOf(activeTab.value)]
  if (!el) return
  indicator.value = { x: el.offsetLeft, w: el.offsetWidth, ready: indicator.value.ready }
  // Enable the spring only after the first placement so it doesn't slide in from 0
  if (!indicator.value.ready) requestAnimationFrame(() => { indicator.value.ready = true })
}
watch(activeTab, () => nextTick(updateIndicator))
let resizeObserver
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
  nextTick(updateIndicator)
  document.fonts?.ready.then(updateIndicator)
  resizeObserver = new ResizeObserver(updateIndicator)
  if (tabButtonsRef.value) resizeObserver.observe(tabButtonsRef.value)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
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
    <header class="app-header">
      <div>
        <div class="app-title-row">
          <h1 class="app-title">BonsaiBudget</h1>
          <div class="app-icon-tile">
            <BonsaiIcon class="app-icon" />
          </div>
        </div>
        <p class="text-secondary text-sm">
          Cultivating Your Financial Future
          <span v-if="store.syncStatus.uid.value" class="sync-badge" :class="{ syncing: store.syncStatus.isSyncing.value }" title="Synced to cloud">&#9679;</span>
        </p>
      </div>
      <div class="header-right">
        <div v-if="store.syncStatus.user.value" class="user-menu" ref="userMenuRef">
          <button class="avatar-btn" @click="toggleUserMenu" :aria-expanded="userMenuOpen" aria-haspopup="true" aria-label="Account menu">
            <img v-if="store.syncStatus.user.value.photoURL" :src="store.syncStatus.user.value.photoURL" class="avatar" referrerpolicy="no-referrer" alt="" />
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
            <button class="user-dropdown-item sign-out" role="menuitem" @click="handleSignOut">Sign out</button>
          </div>
          </Transition>
        </div>
        <a v-else class="sign-in-link text-sm" @click="signInWithGoogle">Sign in</a>
      </div>
    </header>

    <nav class="tab-bar">
      <div class="tab-buttons" role="tablist" ref="tabButtonsRef">
        <span
          class="tab-indicator"
          :class="{ ready: indicator.ready }"
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
      <select
        class="month-select"
        :value="store.selectedMonth.value"
        @change="store.selectedMonth.value = Number($event.target.value)"
      >
        <option v-for="(name, i) in store.monthNames" :key="i" :value="i">{{ name }}</option>
      </select>
    </nav>

    <main class="tab-content" role="tabpanel" :aria-labelledby="`tab-${activeTab}`">
      <transition name="tab-fade">
        <component :is="tabComponent" :key="activeTab" />
      </transition>
    </main>
</template>

<style scoped>
/* Header */
.app-title {
  font-family: 'Manrope', system-ui;
  font-weight: 800;
  letter-spacing: -0.025em;
}

.app-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-icon-tile {
  position: relative;
  width: 1em;
  height: 1em;
  font-size: var(--app-title-size, 2rem);
  background: var(--green);
  border-radius: 0.18em;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-icon {
  width: 78%;
  height: 78%;
  color: #ffffff;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
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
  transition: box-shadow 0.2s, transform var(--spring-duration) var(--spring);
}

.avatar-btn:active {
  transform: scale(0.92);
  transition-duration: var(--press-duration);
}

.avatar-btn:hover,
.avatar-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--green);
  outline: none;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: block;
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

.sign-in-link {
  color: var(--accent);
  cursor: pointer;
  font-weight: 500;
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

/* Sync indicator */
.sync-badge {
  font-size: 8px;
  color: var(--green);
  margin-left: 6px;
  vertical-align: middle;
  transition: color 0.3s;
}

.sync-badge.syncing {
  color: var(--orange);
  animation: pulse 1s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 50;
  margin: 0 -20px 28px;
  padding: 10px 20px;
  background: var(--material);
  -webkit-backdrop-filter: var(--material-blur);
  backdrop-filter: var(--material-blur);
}

/* Scroll edge: a hairline appears only once content scrolls under the bar */
@supports (animation-timeline: scroll()) {
  .tab-bar {
    animation: tab-bar-edge linear both;
    animation-timeline: scroll(root);
    animation-range: 0 120px;
  }
  @keyframes tab-bar-edge {
    from, 60% { box-shadow: 0 0.5px 0 transparent; }
    to { box-shadow: 0 0.5px 0 var(--border); }
  }
}

@media (max-width: 600px) {
  .tab-bar {
    margin: 0 -12px 20px;
    padding: 8px 12px;
  }
}

/* Segmented control */
.tab-buttons {
  display: flex;
  position: relative;
  min-width: 0;
  padding: 2px;
  gap: 2px;
  background: var(--fill);
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
  background: var(--surface);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04);
  pointer-events: none;
}

/* Slides from wherever it currently is — CSS transitions retarget mid-flight */
.tab-indicator.ready {
  transition: transform var(--spring-duration) var(--spring), width var(--spring-duration) var(--spring);
}

[data-theme="dark"] .tab-indicator {
  background: #636366;
}

.tab-btn {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  padding: 6px 16px;
  border: none;
  border-radius: 7px;
  background: none;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--text-secondary);
  cursor: pointer;
  touch-action: manipulation;
  transition: color 0.2s ease, opacity 0.15s ease;
}

@media (hover: hover) {
  .tab-btn:not(.active):hover {
    color: var(--text-primary);
  }
}

.tab-btn:not(.active):active {
  opacity: 0.55;
  transition-duration: var(--press-duration);
}

.tab-btn.active {
  color: var(--text-primary);
  font-weight: 600;
}

.tab-btn:focus-visible {
  outline-offset: -2px;
}

.month-select {
  flex-shrink: 0;
  font-family: var(--font);
  font-size: 14px;
  font-weight: 600;
  padding: 6px 28px 6px 12px;
  border: none;
  border-radius: 9px;
  background-color: var(--fill);
  color: var(--green);
  cursor: pointer;
  appearance: none;
  width: auto;
  max-width: 150px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5l3 3 3-3' fill='none' stroke='%238e8e93' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
  transition: background-color 0.15s ease;
}

.month-select:hover {
  background-color: var(--fill-strong);
}

.month-select:focus {
  outline: none;
  box-shadow: 0 0 0 4px var(--focus-ring);
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
