import { useState } from 'react'
import type { User } from '../types'
import { login, ApiError } from '../lib/api'

interface Props {
  onLogin: (user: User) => void
  onForgotPassword: () => void
}


const REMEMBER_EMAIL_KEY = 'lexicon_remember_email'

export default function LoginPage({ onLogin, onForgotPassword }: Props) {
  // Pre-fill from a previous "Remember me" login, if any, so the email
  // field (and the checkbox itself) survive a logout / page reload.
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_EMAIL_KEY) || '')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem(REMEMBER_EMAIL_KEY)))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      if (remember) {
        localStorage.setItem(REMEMBER_EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }
      onLogin(user)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }


  return (
    <main className="lexicon-login-page">
      <section className="lexicon-login-shell">
        <div className="lexicon-login-visual">
          <div className="lexicon-visual-image" />
          <div className="lexicon-visual-overlay" />
          <div className="lexicon-visual-content">
            <img src="/lexicon-logo.png" alt="Lexicon" className="lexicon-login-logo" />
          </div>
        </div>

        <div className="lexicon-login-panel">
          <div className="lexicon-form-wrap">
            <h2>Login</h2>
            <p className="lexicon-welcome">Welcome back! Please login to your account.</p>

            <form onSubmit={handleSubmit} className="lexicon-login-form">
              <label htmlFor="login-email">Email</label>
              <div className="lexicon-input-wrap">
                <span className="lexicon-input-icon">✉</span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@gmail.com"
                  autoComplete="email"
                  required
                />
              </div>

              <label htmlFor="login-password">Password</label>
              <div className="lexicon-input-wrap">
                <span className="lexicon-input-icon">▣</span>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="lexicon-login-options">
                <label className="lexicon-remember">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember me</span>
                </label>
                <button type="button" className="lexicon-forgot" onClick={onForgotPassword}>
                  Forgot Password?
                </button>
              </div>

              {error && <div className="lexicon-login-error">{error}</div>}

              <button className="lexicon-login-button" type="submit" disabled={loading}>
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="lexicon-signup">Don't have an account? <span>Sign up</span></p>

            
          </div>
        </div>
      </section>
      <footer className="lexicon-login-footer">© 2024 Lexicon. All rights reserved.</footer>
    </main>
  )
}