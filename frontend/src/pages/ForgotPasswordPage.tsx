import { useMemo, useState } from 'react'

interface Props { onBack: () => void }

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'admin@lexicon.edu'

export default function ForgotPasswordPage({ onBack }: Props) {
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)

  const mailtoLink = useMemo(() => {
    const subject = encodeURIComponent('Password Reset Request - Smart Learning Assistant')
    const body = encodeURIComponent(
      `Hello Admin,\n\nI forgot my password for the Smart Learning Assistant account.\n\nMy account email: ${email || '[enter your account email]'}\n\nCould you please reset my password?\n\nThank you.`
    )
    return `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`
  }, [email])

  async function copyAdminEmail() {
    try {
      await navigator.clipboard.writeText(ADMIN_EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="lexicon-login-page">
      <section className="lexicon-reset-shell">
        <div className="lexicon-reset-brand">
          <img src="/lexicon-logo.png" alt="Lexicon" />
        </div>

        <button type="button" className="lexicon-back-button" onClick={onBack}>
          ← Back to Login
        </button>

        <div className="lexicon-reset-card">
          <div className="lexicon-reset-icon">✉</div>
          <h1>Forgot Password?</h1>
          <p>
            Password changes are handled by the administrator for now.
            Send the admin an email and they can reset your password for you.
          </p>

          <div className="lexicon-admin-contact-card">
            <span className="lexicon-admin-contact-label">Administrator email</span>
            <strong>{ADMIN_EMAIL}</strong>
            <button type="button" className="lexicon-copy-email" onClick={copyAdminEmail}>
              {copied ? 'Copied!' : 'Copy email'}
            </button>
          </div>

          <form
            className="lexicon-reset-form"
            onSubmit={(e) => {
              e.preventDefault()
              window.location.href = mailtoLink
            }}
          >
            <label htmlFor="reset-email">Your account email</label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="john.doe@gmail.com"
              autoComplete="email"
              required
            />

            <button type="submit">
              Email Admin About Password Reset
            </button>
          </form>

          <div className="lexicon-reset-note">
            <strong>How it works</strong>
            <span>1. Enter the email you use to log in.</span>
            <span>2. We open your email app with a ready-made request.</span>
            <span>3. The administrator resets your password.</span>
          </div>
        </div>
      </section>

      <footer className="lexicon-login-footer">© 2024 Lexicon. All rights reserved.</footer>
    </main>
  )
}
