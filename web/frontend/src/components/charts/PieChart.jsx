import { useState } from 'react'
import { CENTER, RADIUS, SIZE, pointAt, slicePath } from './geometry'
import './PieChart.scss'

/**
 * Pie chart drawn with plain SVG (specs/032-estadisticas-gastos, plan D13; tooltip
 * in 034). One slice per item, proportional to `value`, starting at the top and
 * going clockwise in the given order; a single item is a full circle. Each slice
 * is focusable, and hovering, focusing or tapping it shows a tooltip over the
 * slice with the item's `tooltip` (its `detail` when absent). Nothing is written
 * under the chart: the full `detail` (name, amount, percentage) is the slice's
 * accessible name, and the category list next to the chart carries the same
 * information as text, so nothing depends on color alone (FR-016, FR-021).
 *
 * items: [{ key, label, color, value, detail, tooltip?, percentage? }]; `percentage` is
 * written over the slice when it is large enough.
 */
export default function PieChart({ items, label }) {
  const [active, setActive] = useState(null)
  const total = items.reduce((sum, item) => sum + item.value, 0)

  const sweeps = items.map((item) => (total > 0 ? (item.value / total) * 2 * Math.PI : 0))
  const slices = items.map((item, index) => {
    const start = -Math.PI / 2 + sweeps.slice(0, index).reduce((sum, sweep) => sum + sweep, 0)
    return { ...item, start, end: start + sweeps[index] }
  })
  const activeSlice = slices.find((slice) => slice.key === active)

  // The tooltip is centered across the chart, at the height of the slice's centroid, so
  // a long text always fits inside the chart and never gets cut at the edges.
  const tooltipStyle = (slice) => {
    const [, y] =
      slices.length === 1 ? [CENTER, CENTER] : pointAt((slice.start + slice.end) / 2, RADIUS * 0.6)
    return { left: '50%', top: `${(y / SIZE) * 100}%` }
  }

  const sliceProps = (slice) => ({
    className: slice.key === active ? 'pie-chart__slice is-active' : 'pie-chart__slice',
    fill: slice.color,
    tabIndex: 0,
    role: 'img',
    'aria-label': slice.detail,
    onMouseEnter: () => setActive(slice.key),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(slice.key),
    onBlur: () => setActive(null),
    onClick: () => setActive(slice.key),
  })

  return (
    <figure className="pie-chart">
      <div className="pie-chart__canvas">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label={label}>
          {slices.length === 1 ? (
            <circle cx={CENTER} cy={CENTER} r={RADIUS} {...sliceProps(slices[0])} />
          ) : (
            slices
              .filter((slice) => slice.end > slice.start)
              .map((slice) => (
                <path key={slice.key} d={slicePath(slice.start, slice.end)} {...sliceProps(slice)} />
              ))
          )}
        </svg>
        {activeSlice && (
          <div className="pie-chart__tooltip" role="tooltip" style={tooltipStyle(activeSlice)}>
            {activeSlice.tooltip ?? activeSlice.detail}
          </div>
        )}
      </div>
    </figure>
  )
}
