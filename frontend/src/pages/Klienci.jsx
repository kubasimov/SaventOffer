import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Klienci() {
  const [klienci, setKlienci] = useState([])
  const [modal, setModal] = useState(false)
  const [edytowany, setEdytowany] = useState(null)
  const [form, setForm] = useState({ nazwa: '', kontakt: '', email: '', telefon: '', uwagi: '' })

  useEffect(() => { pobierzKlientow() }, [])

  async function pobierzKlientow() {
    const res = await axios.get('/api/klienci')
    setKlienci(res.data)
  }

  function otworzModal(klient = null) {
    if (klient) {
      setEdytowany(klient)
      setForm({
        nazwa: klient.nazwa || '',
        kontakt: klient.kontakt || '',
        email: klient.email || '',
        telefon: klient.telefon || '',
        uwagi: klient.uwagi || ''
      })
    } else {
      setEdytowany(null)
      setForm({ nazwa: '', kontakt: '', email: '', telefon: '', uwagi: '' })
    }
    setModal(true)
  }

  async function zapiszKlienta() {
    if (!form.nazwa.trim()) return alert('Nazwa klienta jest wymagana')
    if (edytowany) {
      await axios.put(`/api/klienci/${edytowany.id}`, form)
    } else {
      await axios.post('/api/klienci', form)
    }
    setModal(false)
    pobierzKlientow()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Klienci</h1>
        <button className="btn btn-primary" onClick={() => otworzModal()}>+ Dodaj klienta</button>
      </div>
      <div className="card">
        {klienci.length === 0 ? (
          <div className="empty-state">Brak klientów — dodaj pierwszego</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Kontakt</th>
                <th>Email</th>
                <th>Telefon</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {klienci.map(k => (
                <tr key={k.id}>
                  <td><strong>{k.nazwa}</strong></td>
                  <td>{k.kontakt || '—'}</td>
                  <td>{k.email || '—'}</td>
                  <td>{k.telefon || '—'}</td>
                  <td style={{textAlign:'right'}}>
                    <button className="btn btn-secondary btn-sm" onClick={() => otworzModal(k)}>Edytuj</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{edytowany ? 'Edytuj klienta' : 'Nowy klient'}</h2>
            <div className="form-group">
              <label>Nazwa firmy / klienta *</label>
              <input
                value={form.nazwa}
                onChange={e => setForm({...form, nazwa: e.target.value})}
                placeholder="np. Jan Kowalski"
              />
            </div>
            <div className="form-group">
              <label>Osoba kontaktowa</label>
              <input
                value={form.kontakt}
                onChange={e => setForm({...form, kontakt: e.target.value})}
                placeholder="np. Anna Nowak"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                placeholder="np. jan@example.com"
              />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input
                value={form.telefon}
                onChange={e => setForm({...form, telefon: e.target.value})}
                placeholder="np. 600 123 456"
              />
            </div>
            <div className="form-group">
              <label>Uwagi</label>
              <input
                value={form.uwagi}
                onChange={e => setForm({...form, uwagi: e.target.value})}
                placeholder="opcjonalne"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={zapiszKlienta}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
