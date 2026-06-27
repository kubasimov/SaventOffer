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
  const [modalPDF, setModalPDF] = useState(null) // { id, numer }
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ klient_id: '', uwagi: '' })
  const [szybkiKlient, setSzybkiKlient] = useState(false)
  const [nazwaSzybkiego, setNazwaSzybkiego] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    pobierzOferty()
    pobierzKlientow()
  }, [])

  async function pobierzOferty() {
    const res = await axios.get('/api/oferty')
    setOferty(res.data)
  }

  async function pobierzKlientow() {
    const res = await axios.get('/api/klienci')
    setKlienci(res.data)
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
                      onClick={async () => {
                        const res = await axios.get(`/api/oferty/${o.id}/csv`, { responseType: 'blob' })
                        const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
                        const a = document.createElement('a'); a.href = url
                        a.download = `${o.numer}.csv`; a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      ⬇ CSV
                    </button>
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
      </div>

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
