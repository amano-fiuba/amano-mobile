// Geometría SVG de la torta (032) reutilizada por las estadísticas (034).
export const SIZE = 200
export const CENTER = SIZE / 2
export const RADIUS = 92

export function pointAt(angle, radius = RADIUS) {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}

/** SVG path of the slice between two angles (radians, 0 = right, clockwise). */
export function slicePath(start, end) {
  const [x1, y1] = pointAt(start)
  const [x2, y2] = pointAt(end)
  const largeArc = end - start > Math.PI ? 1 : 0
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`
}
