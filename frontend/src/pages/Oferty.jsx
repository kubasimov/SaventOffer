import KreatorPDF from '../components/KreatorPDF'
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
  const [modalPDF, setModalPDF] = useState(null) // { id, numer }
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ klient_id: '', uwagi: '' })
  const [szybkiKlient, setSzybkiKlient] = useState(false)
  const [nazwaSzybkiego, setNazwaSzybkiego] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    pobierzOferty()
    pobierzKlientow()
  }, [page])

  async function pobierzOferty() {
    try {
      setBlad(null)
      setLoading(true)
      const res = await axios.get(`/api/oferty?page=${page}&limit=20`)
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
      const res = await axios.get('/api/klienci?all=true')
      setKlienci(res.data)
    } catch { /* ignoruj — dropdown nie jest krytyczny */ }
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
    <div>
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
          <table className="oferty-table">
            <thead>
              <tr>
                <th>Numer</th>
                <th>Klient</th>
                <th>Data</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {oferty.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.numer}</strong></td>
                  <td>{o.klient_nazwa || '—'}</td>
                  <td>{formatData(o.data_oferty)}</td>
                  <td>
                    <span style={{
                      color: statusKolor[o.status],
                      fontWeight: 500,
                      fontSize: 13
                    }}>
                      {statusLabel[o.status]}
                    </span>
                  </td>
                  <td style={{textAlign:'right'}}>
                  <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setModalPDF({ id: o.id, numer: o.numer, klientId: o.klient_id, nazwa: o.nazwa })}
                    >
                      ⬇ PDF
                    </button>
                    {isAdmin && <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => navigate(`/oferty/${o.id}`)}
                    >
                      Otwórz
                    </button>}
                  {isAdmin && <button
                      className="btn btn-danger btn-sm"
                      onClick={() => usunOferte(o.id, o.numer)}
                    >
                      Usuń
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Paginacja */}
        {oferty.length > 0 && (
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid #eee'}}>
            <span style={{fontSize:13, color:'#888'}}>
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
              <span style={{fontSize:13, color:'#666', padding:'0 8px'}}>
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
        />
      )}
    </div>
  )
}
