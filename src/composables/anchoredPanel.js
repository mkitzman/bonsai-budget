import { onBeforeUnmount } from 'vue'

const MARGIN = 8

/**
 * Position a fixed panel next to its anchor: below by default, flipped above when it
 * would overflow the viewport. `align: 'end'` lines up right edges, 'start' left edges.
 */
export function placePanel(anchorEl, panelEl, { gap = 8, align = 'start' } = {}) {
  const a = anchorEl.getBoundingClientRect()
  const p = panelEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = align === 'end' ? a.right - p.width : a.left
  left = Math.max(MARGIN, Math.min(left, vw - p.width - MARGIN))

  let top = a.bottom + gap
  let placement = 'below'
  if (top + p.height > vh - MARGIN && a.top - gap - p.height >= MARGIN) {
    top = a.top - gap - p.height
    placement = 'above'
  }
  return { top, left, placement, ready: true }
}

/**
 * Wires up the global listeners an open floating panel needs: reposition on
 * scroll/resize, close on pointer-down outside (the anchor counts as inside so
 * clicking it again can toggle).
 */
export function useFloatingListeners({ reposition, onOutside, getEls }) {
  const onScroll = () => reposition()
  const onPointerDown = (e) => {
    const els = getEls().filter(Boolean)
    if (!els.some(el => el.contains(e.target))) onOutside(e)
  }

  function attach() {
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('pointerdown', onPointerDown, true)
  }

  function detach() {
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', onScroll)
    document.removeEventListener('pointerdown', onPointerDown, true)
  }

  onBeforeUnmount(detach)
  return { attach, detach }
}
