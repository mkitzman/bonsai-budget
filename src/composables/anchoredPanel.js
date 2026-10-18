import { onBeforeUnmount } from 'vue'

const MARGIN = 8

/**
 * Position a fixed panel next to its anchor: below by default, flipped above when it
 * would overflow the viewport. `align: 'end'` lines up right edges, 'start' left edges,
 * 'center' centers on the anchor. `bounds` (a DOMRect) clamps horizontally to a region.
 * Returns `arrowX`, the anchor's center relative to the panel's left edge.
 */
export function placePanel(anchorEl, panelEl, { gap = 8, align = 'start', bounds = null } = {}) {
  const a = anchorEl.getBoundingClientRect()
  const p = panelEl.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = align === 'end' ? a.right - p.width : align === 'center' ? a.left + a.width / 2 - p.width / 2 : a.left
  const minLeft = Math.max(MARGIN, bounds ? bounds.left : MARGIN)
  const maxLeft = Math.min(vw - MARGIN, bounds ? bounds.right : vw - MARGIN) - p.width
  left = Math.max(minLeft, Math.min(left, maxLeft))

  let top = a.bottom + gap
  let placement = 'below'
  if (top + p.height > vh - MARGIN && a.top - gap - p.height >= MARGIN) {
    top = a.top - gap - p.height
    placement = 'above'
  }
  return { top, left, placement, ready: true, arrowX: a.left + a.width / 2 - left }
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
