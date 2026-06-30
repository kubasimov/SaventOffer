import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import KreatorPDF from '../components/KreatorPDF'
import TabelaMebla from '../components/TabelaMebla'

export default function EdytorOferty() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [oferta, setOferta] = useState(null)
  const [klienci, setKlienci] = useState([])
  const [cennik, setCennik] = useState([])
  const [loading, setLoading] = useState(true)
  const [kortGlobalna, setKortGlobalna] = useState(0)
  const [modalZalozenia, setModalZalozenia] = useState(false)
  const [edytujNumer, setEdytujNumer] = useState(false)
  const [nowyNumer, setNowyNumer] = useState('')
  const [edytujNazwe, setEdytujNazwe] = useState(false)
  const [nowaNazwaOferty, setNowaNazwaOferty] = useState('')
  const [historia, setHistoria] = useState([])
  const [modalHistoria, setModalHistoria] = useState(false)
  const [loadingHistoria, setLoadingHistoria] = useState(false)

  useEffect(() => {
    Promise.all([
      axios.get(`/api/oferty/${id}`),
      axios.get('/api/klienci?all=true'),
      axios.get('/api/cennik')
    ]).then(([o, k, c]) => {
      setOferta(o.data)
      setKlienci(k.data)
      setCennik(c.data)
      setKortGlobalna(parseFloat(o.data.korekta_globalna) || 0)
      setNowyNumer(o.data.numer)
      setNowaNazwaOferty(o.data.nazwa || '')
      setLoading(false)
    })
  }, [id])

  function generujPDF() {
    setModalZalozenia(true)
  }



  async function eksportCSV() {
    try {
      const res = await axios.get(`/api/oferty/${id}/csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${oferta.numer}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Błąd eksportu CSV')
    }
  }

  async function dodajTabele() {
    const nazwa = prompt('Nazwa mebla (np. KONTENEREK, ZABUDOWA KUCHENNA):')
    if (!nazwa) return
    const res = await axios.post(`/api/oferty/${id}/tabele`, {
      nazwa_mebla: nazwa.toUpperCase(),
      kolejnosc: (oferta.tabele?.length || 0) + 1
    })
    setOferta(prev => ({
      ...prev,
      tabele: [...(prev.tabele || []), res.data]
    }))
  }

  function aktualizujTabele(tabela_id, dane) {
    setOferta(prev => ({
      ...prev,
      tabele: prev.tabele.map(t => t.id === tabela_id ? { ...t, ...dane } : t)
    }))
  }

  async function usunTabele(tabela_id) {
    if (!confirm('Usunąć tę tabelę wraz z pozycjami?')) return
    await axios.delete(`/api/oferty/tabele/${tabela_id}`)
    setOferta(prev => ({
      ...prev,
      tabele: prev.tabele.filter(t => t.id !== tabela_id)
    }))
  }

  async function zapiszNazweOferty() {
    await axios.put(`/api/oferty/${id}`, {
      klient_id: oferta.klient_id,
      status: oferta.status,
      uwagi: oferta.uwagi,
      nazwa: nowaNazwaOferty.trim()
    })
    setOferta(prev => ({ ...prev, nazwa: nowaNazwaOferty.trim() }))
  }

  async function zapiszNumerOferty() {
    if (!nowyNumer.trim()) return
    await axios.put(`/api/oferty/${id}`, {
      klient_id: oferta.klient_id,
      status: oferta.status,
      uwagi: oferta.uwagi,
      numer: nowyNumer.trim()
    })
    setOferta(prev => ({ ...prev, numer: nowyNumer.trim() }))
    setEdytujNumer(false)
  }

  async function zapiszKortGlobalna(val) {
    const nowaKort = parseFloat(val) || 0
    setKortGlobalna(nowaKort)
    await axios.put(`/api/oferty/${id}`, {
      klient_id: oferta.klient_id,
      status: oferta.status,
      uwagi: oferta.uwagi,
      korekta_globalna: nowaKort
    })
  }

  async function zmienStatus(nowyStatus) {
    await axios.put(`/api/oferty/${id}`, {
      klient_id: oferta.klient_id,
      status: nowyStatus,
      uwagi: oferta.uwagi
    })
    setOferta(prev => ({ ...prev, status: nowyStatus }))
  }

  async function pokazHistorie() {
    setModalHistoria(true)
    setLoadingHistoria(true)
    try {
      const res = await axios.get(`/api/oferty/${id}/historia`)
      setHistoria(res.data)
    } catch {}
    setLoadingHistoria(false)
  }

  async function zapiszKlienta(klient_id) {
    await axios.put(`/api/oferty/${id}`, {
      klient_id,
      status: oferta.status,
      uwagi: oferta.uwagi
    })
    setOferta(prev => ({
      ...prev,
      klient_id,
      klient_nazwa: klienci.find(k => k.id === klient_id)?.nazwa || ''
    }))
  }

  if (loading) return <div className="empty-state">Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <button
            className="btn btn-secondary btn-sm"
            style={{marginBottom: 8}}
            onClick={() => navigate('/')}
          >
            ← Wróć do listy
          </button>
          <div style={{display:'flex', gap:24, alignItems:'flex-start', flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:11, color:'#aaa', fontWeight:500, marginBottom:2, textTransform:'uppercase', letterSpacing:0.5}}>Numer oferty</div>
              {edytujNumer ? (
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  <input
                    value={nowyNumer}
                    onChange={e => setNowyNumer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && zapiszNumerOferty()}
                    style={{padding:'4px 8px', border:'1.5px solid #555', borderRadius:6,
                      fontSize:16, fontWeight:600, width:280, background:'#3a3a3a', color:'white'}}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" onClick={zapiszNumerOferty}>✓</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEdytujNumer(false); setNowyNumer(oferta.numer) }}>✕</button>
                </div>
              ) : (
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                  <h1 style={{fontSize: 18, color:'white'}}>{oferta.numer}</h1>
                  <button onClick={() => setEdytujNumer(true)}
                    style={{background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#aaa'}}>
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <button className="btn btn-secondary" onClick={eksportCSV}>
            ⬇ CSV
          </button>
          <button className="btn btn-pdf" onClick={generujPDF}>
            ⬇ PDF
          </button>
          <button className="btn btn-secondary" onClick={pokazHistorie}>
            📋 Historia
          </button>
          <button className="btn btn-primary" onClick={dodajTabele}>
            + Dodaj mebel
          </button>
        </div>
      </div>

      <div className="card" style={{marginBottom: 16}}>
        <div style={{display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap'}}>
          <div className="form-group" style={{margin:0, flex:1}}>
            <label>Klient</label>
            <select
              value={oferta.klient_id || ''}
              onChange={e => zapiszKlienta(e.target.value)}
            >
              <option value="">— wybierz klienta —</option>
              {klienci.map(k => (
                <option key={k.id} value={k.id}>{k.nazwa}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{margin:0, flex:1}}>
            <label>Nazwa inwestycji</label>
            <input
              value={nowaNazwaOferty}
              onChange={e => setNowaNazwaOferty(e.target.value)}
              onBlur={zapiszNazweOferty}
              placeholder="np. Zabudowa kuchenna"
            />
          </div>
          <div style={{fontSize:13, color:'#aaa', minWidth:120}}>
            <div>Data: <strong>{new Date(oferta.data_oferty).toLocaleDateString('pl-PL')}</strong></div>
            <div style={{marginTop:4, display:'flex', alignItems:'center', gap:6}}>
              <span>Status:</span>
              <select
                value={oferta.status}
                onChange={e => zmienStatus(e.target.value)}
                style={{
                  padding:'3px 8px', border:'1.5px solid #555', borderRadius:6,
                  fontSize:13, fontWeight:600, background:'#3a3a3a', color:'white',
                  cursor:'pointer'
                }}
              >
                <option value="szkic">Szkic</option>
                <option value="wyslana">Wysłana</option>
                <option value="zaakceptowana">Zaakceptowana</option>
                <option value="anulowana">Anulowana</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
            background:'#2b2b2b', borderRadius:8, border:'1px solid #3a3a3a'}}>
            <span style={{fontSize:13, color:'#c6bec4', fontWeight:500}}>Korekta globalna %</span>
            <input
              type="number" step="1"
              value={kortGlobalna}
              onChange={e => setKortGlobalna(parseFloat(e.target.value) || 0)}
              onBlur={e => zapiszKortGlobalna(e.target.value)}
              style={{width:70, padding:'4px 8px', border:'1.5px solid #555',
                borderRadius:6, fontSize:14, textAlign:'center',
                background:'#3a3a3a', color:'white'}}
            />
            {kortGlobalna !== 0 && (
              <span style={{fontSize:12, color: kortGlobalna < 0 ? '#c62828' : '#2e7d32', fontWeight:500}}>
                {kortGlobalna > 0 ? '+' : ''}{kortGlobalna}%
              </span>
            )}
          </div>
        </div>
      </div>

      {(!oferta.tabele || oferta.tabele.length === 0) ? (
        <div className="card">
          <div className="empty-state">
            Brak mebli w ofercie — kliknij „+ Dodaj mebel"
          </div>
        </div>
      ) : (
        oferta.tabele.map(tabela => (
          <TabelaMebla
            key={tabela.id}
            tabela={tabela}
            cennik={cennik}
            kortGlobalna={kortGlobalna}
            onAktualizuj={aktualizujTabele}
            onUsun={usunTabele}
          />
        ))
      )}
      {modalZalozenia && (
        <KreatorPDF
          ofertaId={id}
          ofertaNumer={oferta?.numer || ''}
          ofertaNazwa={nowaNazwaOferty || oferta?.nazwa || ''}
          klientId={oferta?.klient_id}
          onClose={() => setModalZalozenia(false)}
        />
      )}

      {/* Modal historii */}
      {modalHistoria && (
        <div className="modal-overlay" onClick={() => setModalHistoria(false)}>
          <div className="modal" style={{maxWidth:620}} onClick={e => e.stopPropagation()}>
            <h2>Historia zmian</h2>
            {loadingHistoria ? (
              <div style={{padding:20, textAlign:'center', color:'#aaa'}}>Ładowanie...</div>
            ) : historia.length === 0 ? (
              <div className="empty-state">Brak historii zmian</div>
            ) : (
              <div style={{maxHeight:'55vh', overflowY:'auto', padding:'4px 0'}}>
                {/* Oś czasu */}
                <div style={{position:'relative', paddingLeft:28}}>
                  {/* Linia pionowa */}
                  <div style={{position:'absolute', left:10, top:6, bottom:6, width:2,
                    background:'#3a3a3a', borderRadius:1}} />
                  {historia.map((h, idx) => (
                    <div key={idx} style={{position:'relative', paddingBottom:16}}>
                      {/* Kropka na linii */}
                      <div style={{position:'absolute', left:-20, top:4, width:12, height:12,
                        borderRadius:'50%', background: h.pole === 'status' ? '#5f2f4d' : '#3a3a3a',
                        border:'2px solid #2b2b2b', zIndex:1}} />
                      <div style={{border:'1px solid #3a3a3a', borderRadius:8, padding:'10px 14px',
                        background:'#2b2b2b'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                          <span style={{fontSize:12, color:'#c6bec4', fontWeight:500}}>
                            {h.pole === 'numer' ? 'Numer oferty' :
                                                         h.pole === 'nazwa' ? 'Nazwa inwestycji' :
                                                         h.pole === 'klient' || h.pole === 'klient_id' ? 'Klient' :
                                                         h.pole === 'korekta_globalna' ? 'Korekta globalna' :
                                                         h.pole === 'status' ? 'Status' :
                                                         h.pole === 'uwagi' ? 'Uwagi' :
                                                         h.pole === 'utworzono' ? 'Utworzono' :
                                                         h.pole === 'suma calkowita' ? 'Suma całkowita' :
                                                         h.pole}
                          <span style={{fontSize:11, color:'#aaa'}}>
                            {new Date(h.utworzony).toLocaleString('pl-PL')}
                          </span>
                        </div>
                        {h.pole === 'status' ? (
                          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                            <span style={{fontSize:12, color:'#ef5350', fontWeight:500, background:'#3a1a1a', padding:'2px 10px', borderRadius:10}}>{h.stara_wartosc || '—'}</span>
                            <span style={{color:'#666'}}>→</span>
                            <span style={{fontSize:12, color:'#81c784', fontWeight:500, background:'#1a3a1a', padding:'2px 10px', borderRadius:10}}>{h.nowa_wartosc}</span>
                          </div>
                        ) : (
                          <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', fontSize:13}}>
                            <span style={{color:'#aaa'}}>{h.stara_wartosc || '(puste)'}</span>
                            <span style={{color:'#666'}}>→</span>
                            <span style={{color:'white'}}>{h.nowa_wartosc || '(puste)'}</span>
                          </div>
                        )}
                        <div style={{fontSize:11, color:'#666', marginTop:4}}>{h.uzytkownik || '?'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalHistoria(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
