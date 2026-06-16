import { useState } from 'react'
import { useAuth } from '../AuthContext'
import axios from 'axios'

export default function Profil() {
  const { user } = useAuth()
  const [form, setForm] = useState({ stare_haslo: '', nowe_haslo: '', powtorz: '' })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  async function zmienHaslo(e) {
    e.preventDefault()
    setStatus(null)
    if (form.nowe_haslo !== form.powtorz) {
      setStatus({ ok: false, msg: 'Nowe hasła nie są identyczne' })
      return
    }
    if (form.nowe_haslo.length < 6) {
      setStatus({ ok: false, msg: 'Hasło musi mieć co najmniej 6 znaków' })
      return
    }
    setLoading(true)
    try {
      await axios.post('/api/auth/zmien-haslo', {
        stare_haslo: form.stare_haslo,
        nowe_haslo: form.nowe_haslo
      })
      setStatus({ ok: true, msg: 'Hasło zostało zmienione' })
      setForm({ stare_haslo: '', nowe_haslo: '', powtorz: '' })
    } catch (err) {
      setStatus({ ok: false, msg: err.response?.data?.error || 'Błąd zmiany hasła' })
    }
    setLoading(false)
  }

  return (
    <div style={{maxWidth:480}}>
      <div className="page-header">
        <h1>Profil</h1>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          <div style={{fontSize:13, color:'#888'}}>Zalogowany jako</div>
          <div style={{fontSize:18, fontWeight:600, color:'#222'}}>{user?.imie || '—'}</div>
          <div style={{fontSize:14, color:'#666'}}>{user?.email}</div>
          <div style={{marginTop:4}}>
            <span style={{
              background:'#f0ebf8', color:'#5a2d6e',
              padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:500
            }}>
              {user?.rola}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{fontSize:16, marginBottom:16}}>Zmień hasło</h2>
        <form onSubmit={zmienHaslo}>
          <div className="form-group">
            <label>Aktualne hasło</label>
            <input
              type="password"
              value={form.stare_haslo}
              onChange={e => setForm({...form, stare_haslo: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Nowe hasło</label>
            <input
              type="password"
              value={form.nowe_haslo}
              onChange={e => setForm({...form, nowe_haslo: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Powtórz nowe hasło</label>
            <input
              type="password"
              value={form.powtorz}
              onChange={e => setForm({...form, powtorz: e.target.value})}
              required
            />
          </div>

          {status && (
            <div style={{
              padding:'8px 12px', borderRadius:6, marginBottom:12, fontSize:13,
              background: status.ok ? '#f0f9f0' : '#fff5f5',
              color: status.ok ? '#2e7d32' : '#e53935',
              border: `1px solid ${status.ok ? '#c8e6c9' : '#ffcdd2'}`
            }}>
              {status.ok ? '✓ ' : '✗ '}{status.msg}
            </div>
          )}

          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Zapisywanie...' : 'Zmień hasło'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
