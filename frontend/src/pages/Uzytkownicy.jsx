import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Uzytkownicy() {
  const [uzytkownicy, setUzytkownicy] = useState([])
  const [modal, setModal] = useState(false)
  const [rozwinietaId, setRozwinietaId] = useState(null)
  const [form, setForm] = useState({ email: '', haslo: '', imie: '', rola: 'pracownik' })
  const [blad, setBlad] = useState(null)

  useEffect(() => { pobierz() }, [])

  async function pobierz() {
    const res = await axios.get('/api/users')
    setUzytkownicy(res.data)
  }

  async function dodaj() {
    setBlad(null)
    try {
      await axios.post('/api/users', form)
      setModal(false)
      setForm({ email: '', haslo: '', imie: '', rola: 'pracownik' })
      pobierz()
    } catch (err) {
      setBlad(err.response?.data?.error || 'Błąd')
    }
  }

  async function toggleAktywny(u) {
    await axios.put(`/api/users/${u.id}`, { aktywny: !u.aktywny })
    pobierz()
  }

  async function zmienRole(u, nowaRola) {
    await axios.put(`/api/users/${u.id}`, { rola: nowaRola })
    pobierz()
  }

  async function usunUzytkownika(u) {
    if (!confirm(`Usunąć użytkownika "${u.imie_nazwisko || u.email}"?`)) return
    try {
      await axios.delete(`/api/users/${u.id}`)
      pobierz()
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd usuwania')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Użytkownicy</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Dodaj</button>
      </div>
      <div className="card">
        <table className="mobile-card-table">
          <thead>
            <tr>
              <th>Imię</th>
              <th>Email</th>
              <th>Rola</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {uzytkownicy.map(u => (
              <tr key={u.id}
                className={rozwinietaId === u.id ? 'expanded' : ''}
                onClick={() => setRozwinietaId(rozwinietaId === u.id ? null : u.id)}>
                <td>{u.imie_nazwisko || '—'}</td>
                <td className="mobile-hide">{u.email}</td>
                <td className="mobile-hide">
                  <select
                    value={u.rola}
                    onChange={e => zmienRole(u, e.target.value)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd',
                      fontSize: 13, background: '#fff', color: '#333', cursor: 'pointer'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <option value="pracownik">Pracownik</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="mobile-hide">
                  <span style={{
                    display:'inline-block', padding:'2px 10px', borderRadius:12,
                    fontSize:12, fontWeight:500,
                    background: u.aktywny ? '#e8f5e9' : '#fce4e4',
                    color: u.aktywny ? '#2e7d32' : '#c62828'
                  }}>
                    {u.aktywny ? 'Aktywny' : 'Zablokowany'}
                  </span>
                </td>
                <td className="mobile-hide" style={{textAlign:'right'}}
                  onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={() => toggleAktywny(u)}>
                    {u.aktywny ? 'Zablokuj' : 'Odblokuj'}
                  </button>
                  {' '}
                  <button className="btn btn-sm" style={{background:'#e53935', color:'white', border:'none', padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:12}}
                    onClick={() => usunUzytkownika(u)}>Usuń</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nowy użytkownik</h2>
            <div className="form-group">
              <label>Imię</label>
              <input value={form.imie} onChange={e => setForm({...form, imie: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Hasło</label>
              <input type="password" value={form.haslo} onChange={e => setForm({...form, haslo: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Rola</label>
              <select
                value={form.rola}
                onChange={e => setForm({...form, rola: e.target.value})}
                style={{width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:14}}
              >
                <option value="pracownik">Pracownik</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {blad && <div style={{color:'#e53935', fontSize:13, marginBottom:12}}>{blad}</div>}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={dodaj}>Dodaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}