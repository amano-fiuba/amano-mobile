// Helpers shared by the API clients to read a ProblemDetail (RFC 9457) error body.
// Extracted from expenseClient.js (033) so the income client reuses them.

/** Field errors of a ProblemDetail, keeping only string messages. */
export function safeFields(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(fields).filter(([, message]) => typeof message === 'string'),
  )
}

/** Parsed JSON body of an error response, or an empty object when it has none. */
export async function problemOf(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}
