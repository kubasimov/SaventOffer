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
  const [testStatus, setTestStatus] = useState(null)
  const [testMail, setTestMail] = useState([])
  const [testowanie, setTestowanie] = useState(false)

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

  async function testujPolaczenie() {
    setTestStatus(null); setTestMail([]); setBlad(null); setTestowanie(true)
    try {
      const res = await axios.post('/api/ustawienia/testuj-email', form)
      setTestStatus(res.data.ok ? 'sukces' : 'blad')
      if (res.data.ok) setTestMail(res.data.maile || [])
      if (res.data.error) setBlad(res.data.error)
    } catch (e) {
      setBlad(e.response?.data?.error || 'Błąd połączenia')
      setTestStatus('blad')
    }
    setTestowanie(false)
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

        {testStatus === 'sukces' && (
          <div style={{marginTop:12, background:'#1a3a1a', borderRadius:8, padding:12}}>
            <p style={{color:'#81c784', fontSize:13, fontWeight:600, marginBottom:8}}>✅ Połączenie OK — ostatnie maile:</p>
            {testMail.length === 0 ? (
              <p style={{color:'#aaa', fontSize:12}}>Brak maili w skrzynce</p>
            ) : (
              testMail.map((m, i) => (
                <div key={i} style={{fontSize:12, color:'#c6bec4', padding:'4px 0', borderBottom:'1px solid #2a4a2a'}}>
                  <strong>{m.subject || '(bez tematu)'}</strong> — {m.from} — {m.date ? new Date(m.date).toLocaleString('pl-PL') : ''}
                </div>
              ))
            )}
          </div>
        )}

        <div className="modal-actions" style={{paddingTop:8, gap:8}}>
          <button className="btn btn-primary" onClick={zapisz}>💾 Zapisz konfigurację</button>
          <button className="btn btn-secondary" onClick={testujPolaczenie} disabled={testowanie}>
            {testowanie ? '⏳ Testowanie...' : '🔍 Testuj połączenie'}
          </button>
        </div>
      </div>
    </div>
  )
}