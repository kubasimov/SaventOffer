import KreatorPDF from '../components/KreatorPDF'
import SidebarAkordeon, { AkordeonItem } from '../components/SidebarAkordeon'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import axios from 'axios'

export default function Oferty() {
  const { user } = useAuth()
  const isAdmin = user?.rola === 'admin'
  const [oferty, setOferty] = useState([])
  const [klienci, setKlienci] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [blad, setBlad] = useState(null)
  const [modalPDF, setModalPDF] = useState(null) // { id, numer, klientId, nazwa }
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ klient_id: '', uwagi: '' })
  const [szybkiKlient, setSzybkiKlient] = useState(false)
  const [nazwaSzybkiego, setNazwaSzybkiego] = useState('')
  const [modalMail, setModalMail] = useState(false)
  const [maileKlienta, setMaileKlienta] = useState([])
  const [emailKlienta, setEmailKlienta] = useState('')
  const [mailLoading, setMailLoading] = useState(false)
  const [mailForm, setMailForm] = useState({ odbiorca: '', temat: '', tresc: 'Dzień dobry,\n\noferta cenowa w załączniku.\n\nW razie pytań proszę o kontakt.', odpowiedz_na: '', html_oryginalny: '' })
  const [mailWysylanie, setMailWysylanie] = useState(false)
  const [mailWyslane, setMailWyslane] = useState([])
  const navigate = useNavigate()
  const [filtry, setFiltry] = useState({ status: '', klient_id: '', q: '' })
  const [szukaj, setSzukaj] = useState('')
  const [szukajKlienta, setSzukajKlienta] = useState('')

  useEffect(() => {
    pobierzOferty()
    pobierzKlientow()
  }, [page, filtry.status, filtry.klient_id, filtry.q])

  async function pobierzOferty() {
    try {
      setBlad(null)
      setLoading(true)
      const params = new URLSearchParams({ page, limit: 20 })
      if (filtry.status) params.set('status', filtry.status)
      if (filtry.klient_id) params.set('klient_id', filtry.klient_id)
      if (filtry.q) params.set('q', filtry.q)
      const res = await axios.get(`/api/oferty?${params}`)
      setOferty(res.data.rows)
      setTotal(res.data.total)
      setPages(res.data.pages)
    } catch (err) {
      setBlad(err.response?.data?.error || 'Błąd ładowania ofert')
      setOferty([])
    } finally {
      setLoading(false)
    }
  }

  async function pobierzKlientow() {
    try {
      const res = await axios.get('/api/klienci?all=true&sort=nazwa')
      setKlienci(res.data)
    } catch { /* ignoruj */ }
  }

  async function usunOferte(id, numer) {
    if (!confirm(`Usunąć ofertę "${numer}"? Tej operacji nie można cofnąć.`)) return
    await axios.delete(`/api/oferty/${id}`)
    pobierzOferty()
  }

  async function dodajSzybkiegoKlienta() {
    if (!nazwaSzybkiego.trim()) return
    const res = await axios.post('/api/klienci', { nazwa: nazwaSzybkiego.trim() })
    const noweKlienci = [...klienci, res.data].sort((a,b) => a.nazwa.localeCompare(b.nazwa))
    setKlienci(noweKlienci)
    setForm(f => ({ ...f, klient_id: res.data.id }))
    setNazwaSzybkiego('')
    setSzybkiKlient(false)
  }

  async function utworzOferte() {
    const res = await axios.post('/api/oferty', form)
    setModal(false)
    navigate(`/oferty/${res.data.id}`)
  }

  function formatData(str) {
    return new Date(str).toLocaleDateString('pl-PL')
  }

  async function otworzMail() {
    setModalMail(true)
    setMailLoading(true)
    const oferta = oferty.find(o => o.id === modalPDF?.id)
    setMailForm(f => ({ ...f, odbiorca: oferta?.klient_email || '', temat: `Wycena: ${oferta?.numer || ''}` }))
    setMaileKlienta([])
    try {
      const [mRes, wRes] = await Promise.all([
        axios.get(`/api/oferty/${modalPDF.id}/maile`),
        axios.get(`/api/oferty/${modalPDF.id}/wyslane`)
      ])
      if (mRes.data.email) setEmailKlienta(mRes.data.email)
      setMaileKlienta(mRes.data.maile || [])
      setMailWyslane(wRes.data || [])
    } catch(e) {}
    setMailLoading(false)
  }

  async function wybierzMailOdpowiedz(mail) {
    const cytatHtml = mail.html ? mail.html : `<pre>${mail.text}</pre>`
    setMailForm(prev => ({
      ...prev,
      odbiorca: mail.from || emailKlienta,
      temat: `Re: ${mail.subject}`,
      odpowiedz_na: mail.messageId,
      html_oryginalny: cytatHtml
    }))
  }

  async function wyslijMail() {
    if (!mailForm.odbiorca) return alert('Podaj adres odbiorcy')
    setMailWysylanie(true)
    try {
      await axios.post(`/api/oferty/${modalPDF.id}/wyslij`, {
        do_adresu: mailForm.odbiorca,
        temat: mailForm.temat,
        tresc: mailForm.tresc,
        odpowiedz_na: mailForm.odpowiedz_na,
        html_oryginalny: mailForm.html_oryginalny || ''
      })
      alert('Mail wysłany!')
      setModalMail(false)
    } catch (e) {
      alert('Błąd wysyłania: ' + (e.response?.data?.error || e.message))
    }
    setMailWysylanie(false)
  }

  const statusKolor = {
    szkic: '#888',
    wyslana: '#1565c0',
    zaakceptowana: '#2e7d32',
    anulowana: '#c62828'
  }

  const statusLabel = {
    szkic: 'Szkic',
    wyslana: 'Wysłana',
    zaakceptowana: 'Zaakceptowana',
    anulowana: 'Anulowana'
  }

  return (
    <div style={{display:'flex', gap:20}}>
      {/* Sidebar */}
      <div className="sidebar-desktop" style={{width:220, minWidth:220}}>
        <div className="card" style={{padding:0, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', borderRadius:12}}>
          <div style={{padding:'8px 10px', borderBottom:'1px solid #3a3a3a'}}>
            <input value={szukaj} onChange={e => setSzukaj(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setFiltry(f => ({...f, q: szukaj})); setPage(1) } }}
              placeholder="🔍 Szukaj oferty..." style={{width:'100%', padding:'6px 8px', borderRadius:6, border:'1px solid #444', fontSize:12, background:'#2b2b2b', color:'white', boxSizing:'border-box'}} />
            {szukaj && szukaj !== filtry.q && (
              <div style={{display:'flex', gap:4, marginTop:4}}>
                <button className="btn btn-primary btn-sm" style={{flex:1, fontSize:11, padding:'3px 0'}} onClick={() => { setFiltry(f => ({...f, q: szukaj})); setPage(1) }}>Szukaj</button>
                <button className="btn btn-secondary btn-sm" style={{fontSize:11, padding:'3px 6px'}} onClick={() => { setSzukaj(''); setFiltry(f => ({...f, q: ''})); setPage(1) }}>✕</button>
              </div>
            )}
          </div>
          <SidebarAkordeon title="Status" icon="📋" domyslnieOtwarty>
            <AkordeonItem label="Wszystkie" aktywny={!filtry.status} onClick={() => { setFiltry(f => ({...f, status: ''})); setPage(1) }} />
            {Object.entries({szkic:'Szkic', wyslana:'Wysłana', zaakceptowana:'Zaakceptowana', anulowana:'Anulowana'}).map(([k, v]) => (
              <AkordeonItem key={k} label={v} aktywny={filtry.status === k}
                kropka={statusKolor[k]}
                onClick={() => { setFiltry(f => ({...f, status: k})); setPage(1) }} />
            ))}
          </SidebarAkordeon>
          <SidebarAkordeon title="Klienci" icon="👤" domyslnieOtwarty={false}>
            <div style={{padding:'4px 8px'}}>
              <input value={szukajKlienta} onChange={e => setSzukajKlienta(e.target.value)}
                placeholder="🔍 Szukaj klienta..." style={{width:'100%', padding:'5px 8px', borderRadius:6, border:'1px solid #444', fontSize:12, background:'#2b2b2b', color:'white', boxSizing:'border-box'}} />
            </div>
            <AkordeonItem label="Wszyscy" aktywny={!filtry.klient_id} onClick={() => { setFiltry(f => ({...f, klient_id: ''})); setPage(1) }} />
            {klienci.filter(k => !szukajKlienta || k.nazwa.toLowerCase().includes(szukajKlienta.toLowerCase())).map(k => (
              <AkordeonItem key={k.id} label={k.nazwa} aktywny={filtry.klient_id === k.id}
                onClick={() => { setFiltry(f => ({...f, klient_id: k.id})); setPage(1) }} />
            ))}
          </SidebarAkordeon>
        </div>
      </div>
      {/* Tresci */}
      <div style={{flex:1}}>
      <div className="page-header">
        <h1>Oferty</h1>
        {isAdmin && <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nowa oferta</button>}
      </div>
      {blad && (
        <div className="card" style={{background:'#fff5f5', border:'1px solid #fcc', marginBottom:16}}>
          <p style={{color:'#c62828', fontSize:14, margin:0}}>⚠️ {blad}</p>
        </div>
      )}
      {loading ? (
        <div className="card">
          <div className="empty-state" style={{color:'#999'}}>
            <div style={{fontSize:32, marginBottom:8}}>⏳</div>
            <div>Ładowanie ofert...</div>
          </div>
        </div>
      ) : (
      <div className="card">
        {oferty.length === 0 ? (
          <div className="empty-state">Brak ofert — utwórz pierwszą</div>
        ) : (
          <div className="oferty-grid">
            {oferty.map(o => (
              <div key={o.id} className="oferta-card">
                <div className="oferta-card-header">
                  <div className="oferta-card-title">
                    <strong>{o.numer}</strong>
                  </div>
                  <div className={`oferta-card-status status-${o.status}`}>
                    <span className="status-dot" />
                    {statusLabel[o.status]}
                  </div>
                </div>
                <div className="oferta-card-body">
                  <div className="oferta-card-row">
                    <span className="oferta-card-label">Klient:</span>
                    <span className="oferta-card-value">{o.klient_nazwa || '—'}</span>
                  </div>
                  <div className="oferta-card-row">
                    <span className="oferta-card-label">Data:</span>
                    <span className="oferta-card-value">{formatData(o.data_oferty)}</span>
                  </div>
                  <div className="oferta-card-row">
                    <span className="oferta-card-label">Status:</span>
                    <span className="oferta-card-value" style={{ color: statusKolor[o.status], fontWeight: 500 }}>
                      {statusLabel[o.status]}
                    </span>
                  </div>
                </div>
                <div className="oferta-card-actions">
                  <button
                    className="btn btn-sm btn-pdf"
                    onClick={() => setModalPDF({ id: o.id, numer: o.numer, klientId: o.klient_id, nazwa: o.nazwa })}
                    title="Generuj PDF"
                  >
                    📄 PDF
                  </button>
                  {isAdmin && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => navigate(`/oferty/${o.id}`)}
                    >
                      Otwórz
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => usunOferte(o.id, o.numer)}
                    >
                      Usuń
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Paginacja */}
        {oferty.length > 0 && (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid #3a3a3a'}}>
            <span style={{fontSize:13, color:'#aaa'}}>
              {total} {total === 1 ? 'oferta' : (total >= 2 && total <= 4 ? 'oferty' : 'ofert')}
            </span>
            <div style={{display:'flex', gap:6, alignItems:'center'}}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Poprzednia
              </button>
              <span style={{fontSize:13, color:'#aaa', padding:'0 8px'}}>
                Strona {page} z {pages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
              >
                Następna →
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nowa oferta</h2>
            <div className="form-group">
              <label>Klient</label>
              {szybkiKlient ? (
                <div style={{display:'flex', gap:8}}>
                  <input
                    value={nazwaSzybkiego}
                    onChange={e => setNazwaSzybkiego(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && dodajSzybkiegoKlienta()}
                    placeholder="Nazwa nowego klienta"
                    autoFocus
                    style={{flex:1}}
                  />
                  <button className="btn btn-primary btn-sm" onClick={dodajSzybkiegoKlienta}>✓</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setSzybkiKlient(false); setNazwaSzybkiego('') }}>✕</button>
                </div>
              ) : (
                <div style={{display:'flex', gap:8}}>
                  <select
                    value={form.klient_id}
                    onChange={e => setForm({...form, klient_id: e.target.value})}
                    style={{flex:1}}
                  >
                    <option value="">— wybierz klienta —</option>
                    {klienci.map(k => (
                      <option key={k.id} value={k.id}>{k.nazwa}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSzybkiKlient(true)}>
                    + Klient
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Uwagi (opcjonalne)</label>
              <input
                value={form.uwagi}
                onChange={e => setForm({...form, uwagi: e.target.value})}
                placeholder="np. pilne, termin do piątku"
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={utworzOferte}>Utwórz</button>
            </div>
          </div>
        </div>
      )}
      {modalPDF && (
        <KreatorPDF
          ofertaId={modalPDF.id}
          ofertaNumer={modalPDF.numer}
          ofertaNazwa={modalPDF.nazwa}
          klientId={modalPDF.klientId}
          onClose={() => setModalPDF(null)}
          onWyslijMail={() => { setModalPDF(null); otworzMail() }}
        />
      )}
    {modalMail && (
        <div className="modal-overlay" onClick={() => setModalMail(false)}>
          <div className="modal" style={{maxWidth:700}} onClick={e => e.stopPropagation()}>
            <h2>✉️ Wyślij e-mailem</h2>
            {mailLoading ? (
              <div style={{padding:20, textAlign:'center', color:'#aaa'}}>Pobieranie maili klienta...</div>
            ) : (
              <>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13, color:'#c6bec4', fontWeight:500, marginBottom:8}}>
                    Otrzymane maile od klienta ({emailKlienta || 'brak adresu'})
                  </div>
                  {maileKlienta.length === 0 ? (
                    <div style={{fontSize:12, color:'#666', padding:8}}>Brak maili lub brak adresu email u klienta</div>
                  ) : (
                    <div style={{maxHeight:150, overflowY:'auto', display:'flex', flexDirection:'column', gap:4}}>
                      {maileKlienta.map((m, i) => (
                        <div key={i} onClick={() => wybierzMailOdpowiedz(m)}
                          style={{padding:'6px 10px', background:'#2b2b2b', borderRadius:6, cursor:'pointer',
                            border:'1px solid #3a3a3a', fontSize:12}}>
                          <div style={{fontWeight:500, color: mailForm.odpowiedz_na === m.messageId ? '#5f2f4d' : '#c6bec4'}}>
                            {m.subject || '(bez tematu)'}
                          </div>
                          <div style={{color:'#666', fontSize:11}}>
                            {new Date(m.date).toLocaleString('pl-PL')} — {m.from}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Odbiorca</label>
                  <input value={mailForm.odbiorca} onChange={e => setMailForm({...mailForm, odbiorca: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Temat</label>
                  <input value={mailForm.temat} onChange={e => setMailForm({...mailForm, temat: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Treść</label>
                  <textarea rows={8} value={mailForm.tresc}
                    onChange={e => setMailForm({...mailForm, tresc: e.target.value})}
                    style={{width:'100%', padding:8, borderRadius:6, border:'1.5px solid #555',
                      fontSize:13, background:'#3a3a3a', color:'white', resize:'vertical'}}
                  />
                </div>
                {mailWyslane.length > 0 && (
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:12, color:'#666', marginBottom:4}}>Wysłane wcześniej:</div>
                    {mailWyslane.map(m => (
                      <div key={m.id} style={{fontSize:11, color:'#888', padding:'2px 0'}}>
                        {new Date(m.utworzony).toLocaleString('pl-PL')} → {m.odbiorca} — {m.temat}
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => setModalMail(false)}>Anuluj</button>
                  <button className="btn btn-primary" onClick={wyslijMail} disabled={mailWysylanie}>
                    {mailWysylanie ? '⏳ Wysyłanie...' : '✉️ Wyślij'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
