// Shared shell for every authentication screen (register, login, email
// verification and password recovery). Keeping the same `.page` card here makes
// the whole flow share Register's layout, typography and palette.
export default function AuthPage({ title, children }) {
  return (
    <main className="page auth-page">
      <h1>{title}</h1>
      {children}
    </main>
  )
}
