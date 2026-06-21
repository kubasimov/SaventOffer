import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import ModalZalozenia from '../components/ModalZalozenia'
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

  useEffect(() => {
    Promise.all([
      axios.get(`/api/oferty/${id}`),
      axios.get('/api/klienci'),
      axios.get('/api/cennik')
    ]).then(([o, k, c]) => {
      setOferta(o.data)
      setKlienci(k.data)
      setCennik(c.data)
      setKortGlobalna(parseFloat(o.data.korekta_globalna) || 0)
      setNowyNumer(o.data.numer)
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
          {edytujNumer ? (
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <input
                value={nowyNumer}
                onChange={e => setNowyNumer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && zapiszNumerOferty()}
                style={{padding:'4px 8px', border:'1px solid #5a2d6e', borderRadius:6,
                  fontSize:16, fontWeight:600, width:280, background:'white', color:'#333'}}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={zapiszNumerOferty}>✓</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEdytujNumer(false); setNowyNumer(oferta.numer) }}>✕</button>
            </div>
          ) : (
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <h1 style={{fontSize: 18, color:'#222'}}>{oferta.numer}</h1>
              <button onClick={() => setEdytujNumer(true)}
                style={{background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#aaa'}}>
                ✏️
              </button>
            </div>
          )}
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
          <button className="btn btn-secondary" onClick={eksportCSV}>
            ⬇ CSV
          </button>
          <button className="btn btn-secondary" onClick={generujPDF}>
            ⬇ PDF
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
          <div style={{fontSize:13, color:'#888', minWidth:120}}>
            <div>Data: <strong>{new Date(oferta.data_oferty).toLocaleDateString('pl-PL')}</strong></div>
            <div style={{marginTop:4, display:'flex', alignItems:'center', gap:6}}>
              <span>Status:</span>
              <select
                value={oferta.status}
                onChange={e => zmienStatus(e.target.value)}
                style={{
                  padding:'3px 8px', border:'1px solid #ddd', borderRadius:6,
                  fontSize:13, fontWeight:600, background:'white', color:'#333',
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
            background:'#f8f5ff', borderRadius:8, border:'1px solid #e0d6f5'}}>
            <span style={{fontSize:13, color:'#5a2d6e', fontWeight:500}}>Korekta globalna %</span>
            <input
              type="number" step="1"
              value={kortGlobalna}
              onChange={e => setKortGlobalna(parseFloat(e.target.value) || 0)}
              onBlur={e => zapiszKortGlobalna(e.target.value)}
              style={{width:70, padding:'4px 8px', border:'1px solid #c4a8d8',
                borderRadius:6, fontSize:14, textAlign:'center',
                background:'white', color:'#333'}}
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
        <ModalZalozenia
          ofertaId={id}
          numer={oferta?.numer || ''}
          onClose={() => setModalZalozenia(false)}
        />
      )}
    </div>
  )
}
