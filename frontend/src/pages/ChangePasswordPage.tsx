import { useState } from 'react'
import { ApiError, changePassword } from '../lib/api'

export default function ChangePasswordPage({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    if (next !== confirm) return setError('New passwords do not match.')
    setLoading(true)
    try { await changePassword(current, next); onDone() }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not change password.') }
    finally { setLoading(false) }
  }
  return <div className="min-h-screen flex items-center justify-center px-4" style={{background:'var(--background)'}}>
    <form onSubmit={submit} className="w-full max-w-sm rounded-xl p-8" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
      <h1 className="text-xl font-semibold mb-2">Change your password</h1>
      <p className="text-sm mb-6" style={{color:'var(--muted-foreground)'}}>Your account was created with a temporary password. Choose a new password before continuing.</p>
      <div className="space-y-4">
        <input required type="password" placeholder="Current password" value={current} onChange={e=>setCurrent(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{border:'1px solid var(--border)',background:'var(--muted)'}} />
        <input required minLength={8} type="password" placeholder="New password (8+ characters)" value={next} onChange={e=>setNext(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{border:'1px solid var(--border)',background:'var(--muted)'}} />
        <input required minLength={8} type="password" placeholder="Confirm new password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{border:'1px solid var(--border)',background:'var(--muted)'}} />
        {error && <p className="text-xs rounded-lg px-3 py-2.5" style={{background:'#FEE2E2',color:'#B91C1C'}}>{error}</p>}
        <button disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-semibold" style={{background:'var(--primary)',color:'white',border:'none'}}>{loading?'Saving…':'Set new password'}</button>
      </div>
    </form>
  </div>
}
