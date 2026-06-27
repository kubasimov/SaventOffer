import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { round2 } from '../utils/calc'

export default function Import() {
  const [plik, setPlik] = useState(null)
  const [podglad, setPodglad] = useState(null)
  const [klienci, setKlienci] = useState([])
  const [form, setForm] = useState({ klient_id: '', nazwa_oferty: '' })
  const [loading, setLoading] = useState(false)
  const [blad, setBlad] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    axios.get('/api/klienci?all=true').then(r => setKlienci(r.data))
  }, [])

  async function wczytajPodglad(file) {
    if (!file) return
    setPlik(file)
    setPodglad(null)
    setBlad(null)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('plik', file)
      const res = await axios.post('/api/import/podglad', fd)
      setPodglad(res.data)
      // Zaproponuj nazwę oferty z nazwy pliku
      const nazwaPliku = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').toUpperCase()
      setForm(f => ({ ...f, nazwa_oferty: nazwaPliku }))
    } catch (err) {
      setBlad('Błąd odczytu pliku: ' + (err.response?.data?.error || err.message))
    }
    setLoading(false)
  }

  async function importuj() {
    if (!plik) return
    if (!form.nazwa_oferty.trim()) return alert('Podaj nazwę oferty')
    setLoading(true)
    setBlad(null)
    try {
      const fd = new FormData()
      fd.append('plik', plik)
      fd.append('klient_id', form.klient_id)
      fd.append('nazwa_oferty', form.nazwa_oferty.trim())
      const res = await axios.post('/api/import/zapisz', fd)
      navigate(`/oferty/${res.data.oferta_id}`)
    } catch (err) {
      setBlad('Błąd importu: ' + (err.response?.data?.error || err.message))
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Import z Excel</h1>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="form-group">
          <label>Plik Excel (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={e => wczytajPodglad(e.target.files[0])}
            style={{padding:'8px 0', background:'none', border:'none',
              color:'#333', fontSize:14}}
          />
        </div>

        {loading && (
          <div style={{color:'#582A48', fontSize:14, padding:'8px 0'}}>
            ⏳ Wczytuję plik...
          </div>
        )}

        {blad && (
          <div style={{color:'#e53935', fontSize:13, padding:'8px 12px',
            background:'#fff5f5', borderRadius:6, marginTop:8}}>
            {blad}
          </div>
        )}

        {podglad && (
          <>
            <div style={{
              background:'#f0f9f0', border:'1px solid #c8e6c9',
              borderRadius:8, padding:'10px 14px', marginTop:12, marginBottom:16
            }}>
              <strong style={{color:'#2e7d32'}}>✓ Znaleziono {podglad.liczba_tabel} mebli</strong>
              <div style={{marginTop:6, display:'flex', flexWrap:'wrap', gap:6}}>
                {podglad.tabele.map((t, i) => (
                  <span key={i} style={{
                    background:'#e8f5e9', color:'#2e7d32',
                    padding:'2px 10px', borderRadius:12, fontSize:12
                  }}>
                    {t.nazwa_mebla} ({t.pozycje.length} poz.)
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Nazwa oferty *</label>
              <input
                value={form.nazwa_oferty}
                onChange={e => setForm({...form, nazwa_oferty: e.target.value})}
                placeholder="np. OFERTA_CENOWA_01_13_06_2026"
              />
            </div>

            <div className="form-group">
              <label>Klient (opcjonalnie)</label>
              <select value={form.klient_id}
                onChange={e => setForm({...form, klient_id: e.target.value})}>
                <option value="">— wybierz klienta —</option>
                {klienci.map(k => (
                  <option key={k.id} value={k.id}>{k.nazwa}</option>
                ))}
              </select>
            </div>

            {/* Podgląd tabel */}
            {podglad.tabele.map((t, i) => (
              <div key={i} style={{
                marginBottom:12, border:'1px solid #eee',
                borderRadius:8, overflow:'hidden'
              }}>
                <div style={{
                  background:'#582A48', color:'white',
                  padding:'8px 14px', fontSize:13, fontWeight:600
                }}>
                  {t.nazwa_mebla}
                </div>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                  <thead>
                    <tr style={{background:'#f5f5f5'}}>
                      <th style={{padding:'6px 10px', fontSize:12, textAlign:'left', color:'#666'}}>Pozycja</th>
                      <th style={{padding:'6px 10px', fontSize:12, textAlign:'left', color:'#666'}}>Ilość</th>
                      <th style={{padding:'6px 10px', fontSize:12, textAlign:'left', color:'#666'}}>Jednostka</th>
                      <th style={{padding:'6px 10px', fontSize:12, textAlign:'right', color:'#666'}}>Cena jedn.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.pozycje.map((p, j) => (
                      <tr key={j} style={{borderTop:'1px solid #f0f0f0'}}>
                        <td style={{padding:'6px 10px', fontSize:13}}>{p.nazwa}</td>
                        <td style={{padding:'6px 10px', fontSize:13, color:'#888'}}>
                          {(() => {
                            const suma = p.jednostka === 'm2'
                              ? p.wymiary.reduce((a,d) => a + round2((d.wymiar_x||0)*(d.wymiar_y||0)), 0)
                              : p.wymiary.reduce((a,d) => a + (d.ilosc||0), 0)
                            return p.jednostka === 'm2'
                              ? `${round2(suma).toFixed(2)} m² (${p.wymiary.length} wym.)`
                              : `${suma} ${p.jednostka} (${p.wymiary.length} wier.)`
                          })()}
                        </td>
                        <td style={{padding:'6px 10px', fontSize:13}}>
                          <span className={`badge badge-${p.jednostka}`}>{p.jednostka}</span>
                        </td>
                        <td style={{padding:'6px 10px', fontSize:13, textAlign:'right'}}>
                          {p.cena_jedn > 0 ? p.cena_jedn.toFixed(2) + ' zł' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div style={{display:'flex', gap:10, justifyContent:'flex-end', marginTop:16}}>
              <button className="btn btn-secondary"
                onClick={() => { setPlik(null); setPodglad(null) }}>
                Anuluj
              </button>
              <button className="btn btn-primary" onClick={importuj} disabled={loading}>
                {loading ? 'Importuję...' : `✓ Importuj ${podglad.liczba_tabel} mebli`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
