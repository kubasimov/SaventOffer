import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Uzytkownicy() {
  const [uzytkownicy, setUzytkownicy] = useState([])
  const [oczekujacy, setOczekujacy] = useState([])
  const [modal, setModal] = useState(false)
  const [rozwinietaId, setRozwinietaId] = useState(null)
  const [form, setForm] = useState({ email: '', haslo: '', imie: '', rola: 'pracownik' })
  const [blad, setBlad] = useState(null)

  useEffect(() => { pobierz(); pobierzOczekujacych() }, [])

  async function pobierz() {
    const res = await axios.get('/api/users')
    setUzytkownicy(res.data)
  }

  async function pobierzOczekujacych() {
    try { const res = await axios.get('/api/auth/oczekujacy'); setOczekujacy(res.data) } catch {}
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

  async function zatwierdz(u, rola) {
    await axios.put(`/api/auth/zatwierdz/${u.id}`, { rola })
    pobierzOczekujacych()
    pobierz()
  }

  async function odrzuc(u) {
    if (!confirm(`Odrzucić prośbę "${u.imie_nazwisko}"?`)) return
    await axios.delete(`/api/auth/oczekujacy/${u.id}`)
    pobierzOczekujacych()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Użytkownicy</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Dodaj</button>
      </div>
      {oczekujacy.length > 0 && (
        <div className="card" style={{marginBottom:16, borderLeft:'3px solid #5f2f4d'}}>
          <h2 style={{fontSize:16, marginBottom:12}}>⏳ Oczekujący na akceptację ({oczekujacy.length})</h2>
          <table className="mobile-card-table">
            <thead><tr><th>Imię</th><th>Email</th><th>Data zgłoszenia</th><th></th></tr></thead>
            <tbody>
              {oczekujacy.map(u => (
                <tr key={u.id}>
                  <td>{u.imie_nazwisko}</td>
                  <td>{u.email}</td>
                  <td>{new Date(u.utworzony).toLocaleString('pl-PL')}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-primary btn-sm" onClick={() => zatwierdz(u, 'pracownik')}>Zatwierdź</button>
                    {' '}
                    <button className="btn btn-secondary btn-sm" onClick={() => zatwierdz(u, 'admin')}>Admin</button>
                    {' '}
                    <button className="btn btn-danger btn-sm" onClick={() => odrzuc(u)}>Odrzuć</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
                    background: u.aktywny ? '#1a3a1a' : '#3a1a1a',
                    color: u.aktywny ? '#81c784' : '#ef5350'
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
                  <button className="btn btn-danger btn-sm"
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