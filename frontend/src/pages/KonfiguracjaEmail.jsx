import { useState, useEffect } from 'react'
import axios from 'axios'

export default function KonfiguracjaEmail() {
  const [form, setForm] = useState({
    smtp_host: 'n3.smarthost.pl',
    smtp_port: '465',
    smtp_user: '',
    smtp_pass: '',
    imap_host: 'n3.smarthost.pl',
    imap_port: '993',
    email_from: ''
  })
  const [loading, setLoading] = useState(true)
  const [zapisano, setZapisano] = useState(null)
  const [blad, setBlad] = useState(null)

  useEffect(() => {
    axios.get('/api/ustawienia/konfiguracja_email')
      .then(r => {
        if (r.data?.wartosc) {
          const cfg = JSON.parse(r.data.wartosc)
          setForm(prev => ({ ...prev, ...cfg }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function zapisz() {
    setBlad(null); setZapisano(null)
    try {
      await axios.put('/api/ustawienia/konfiguracja_email', { wartosc: JSON.stringify(form) })
      setZapisano('Zapisano')
      setTimeout(() => setZapisano(null), 3000)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Błąd zapisu')
    }
  }

  if (loading) return <div className="empty-state" style={{color:'#aaa'}}>⏳ Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <h1 style={{fontSize:18}}>Konfiguracja poczty email</h1>
      </div>
      <div className="card" style={{maxWidth:600}}>
        <h2 style={{fontSize:15, marginBottom:12, color:'#c6bec4'}}>SMTP (wysyłanie)</h2>
        <div className="form-group">
          <label>Host SMTP</label>
          <input value={form.smtp_host} onChange={e => setForm({...form, smtp_host: e.target.value})} placeholder="n3.smarthost.pl" />
        </div>
        <div className="form-group">
          <label>Port SMTP</label>
          <input value={form.smtp_port} onChange={e => setForm({...form, smtp_port: e.target.value})} placeholder="465" />
        </div>
        <div className="form-group">
          <label>Użytkownik SMTP</label>
          <input value={form.smtp_user} onChange={e => setForm({...form, smtp_user: e.target.value})} placeholder="reklamacja@savento.pl" />
        </div>
        <div className="form-group">
          <label>Hasło SMTP</label>
          <input type="password" value={form.smtp_pass} onChange={e => setForm({...form, smtp_pass: e.target.value})} placeholder="••••••••" />
        </div>

        <h2 style={{fontSize:15, margin:'16px 0 12px', color:'#c6bec4'}}>IMAP (odbiór)</h2>
        <div className="form-group">
          <label>Host IMAP</label>
          <input value={form.imap_host} onChange={e => setForm({...form, imap_host: e.target.value})} placeholder="n3.smarthost.pl" />
        </div>
        <div className="form-group">
          <label>Port IMAP</label>
          <input value={form.imap_port} onChange={e => setForm({...form, imap_port: e.target.value})} placeholder="993" />
        </div>

        <h2 style={{fontSize:15, margin:'16px 0 12px', color:'#c6bec4'}}>Inne</h2>
        <div className="form-group">
          <label>Adres nadawcy (From)</label>
          <input value={form.email_from} onChange={e => setForm({...form, email_from: e.target.value})} placeholder="reklamacja@savento.pl" />
        </div>

        {blad && <p style={{color:'#e53935', fontSize:13, margin:'8px 0'}}>{blad}</p>}
        {zapisano && <p style={{color:'#2e7d32', fontSize:13, margin:'8px 0'}}>{zapisano}</p>}

        <div className="modal-actions" style={{paddingTop:8}}>
          <button className="btn btn-primary" onClick={zapisz}>💾 Zapisz konfigurację</button>
        </div>
      </div>
    </div>
  )
}