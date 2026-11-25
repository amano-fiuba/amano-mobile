/** Human-readable date of a notification: relative for recent ones, absolute afterwards. */
export function notificationDate(value, now = Date.now()) {
  if (!value) return ''
  const time = Date.parse(value)
  if (Number.isNaN(time)) return ''
  const minutes = Math.floor((now - time) / 60000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(time))
}
