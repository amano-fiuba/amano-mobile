// Shared submit button for authentication forms: disabled state + spinner while
// the request is in flight, with the same visual treatment as the rest of the
// design system. The accessible name can stay stable or switch to the progress
// label of the flow (for example "Ingresando…").
export default function SubmitButton({
  loading = false,
  loadingLabel,
  children,
  disabled,
  ...buttonProps
}) {
  return (
    <button
      type="submit"
      {...buttonProps}
      disabled={loading || disabled}
      aria-busy={loading || undefined}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {loading ? loadingLabel ?? children : children}
    </button>
  )
}
