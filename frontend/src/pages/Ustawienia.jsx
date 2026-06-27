import { useState, useEffect } from 'react'
import axios from 'axios'
import Cennik from './Cennik'

const ZAKLADKI = ['Cennik', 'Założenia', 'Specyfikacja']

export default function Ustawienia() {
  const [aktywna, setAktywna] = useState(0)
  const [zalozenia, setZalozenia] = useState('')
  const [specyfikacja, setSpecyfikacja] = useState('')
  const [zapisano, setZapisano] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('/api/ustawienia/specyfikacja_domyslna').catch(() => ({ data: { wartosc: '' } })),
      axios.get('/api/pdf/zalozenia-domyslne').catch(() => ({ data: { tekst: '' } }))
    ]).then(([spec, zal]) => {
      setSpecyfikacja(spec.data.wartosc || '')
      setZalozenia(zal.data.tekst || '')
      setLoading(false)
    })
  }, [])

  async function zapiszSpecyfikacje() {
    await axios.put('/api/ustawienia/specyfikacja_domyslna', { wartosc: specyfikacja })
    setZapisano('specyfikacja')
    setTimeout(() => setZapisano(null), 2000)
  }

  async function zapiszZalozenia() {
    await axios.post('/api/ustawienia/zapisz-zalozenia', { tekst: zalozenia })
    setZapisano('zalozenia')
    setTimeout(() => setZapisano(null), 2000)
  }

  if (loading) return <div className="empty-state">Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Ustawienia</h1>
      </div>

      {/* Zakładki */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #eee' }}>
        {ZAKLADKI.map((n, i) => (
          <button
            key={n}
            onClick={() => setAktywna(i)}
            style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: aktywna === i ? 600 : 400,
              color: aktywna === i ? '#5a2d6e' : '#888',
              background: 'none',
              borderBottom: aktywna === i ? '3px solid #5a2d6e' : '3px solid transparent',
              marginBottom: -2, transition: 'all 0.15s'
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Zakładka: Cennik */}
      {aktywna === 0 && <Cennik />}

      {/* Zakładka: Założenia */}
      {aktywna === 1 && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div>
              <h2 style={{fontSize:16, marginBottom:4}}>Domyślne założenia oferty</h2>
              <p style={{fontSize:13, color:'#888'}}>
                Tekst wczytywany automatycznie w kreatorze PDF. Każda linia = osobny punkt.
              </p>
            </div>
            {zapisano === 'zalozenia' && (
              <span style={{color:'#2e7d32', fontSize:13}}>✓ Zapisano</span>
            )}
          </div>
          <textarea
            value={zalozenia}
            onChange={e => setZalozenia(e.target.value)}
            rows={12}
            style={{width:'100%', padding:'10px 12px', border:'1px solid #ddd',
              borderRadius:8, fontSize:13, resize:'vertical',
              background:'white', color:'#333', fontFamily:'inherit', lineHeight:1.6,
              marginBottom:12}}
          />
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn btn-primary" onClick={zapiszZalozenia}>
              Zapisz założenia
            </button>
          </div>
        </div>
      )}

      {/* Zakładka: Specyfikacja */}
      {aktywna === 2 && (
        <div className="card">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
            <div>
              <h2 style={{fontSize:16, marginBottom:4}}>Domyślna specyfikacja materiałowa</h2>
              <p style={{fontSize:13, color:'#888'}}>
                Punkty wczytywane w kreatorze PDF. Każda linia = osobny punkt listy.
              </p>
            </div>
            {zapisano === 'specyfikacja' && (
              <span style={{color:'#2e7d32', fontSize:13}}>✓ Zapisano</span>
            )}
          </div>
          <textarea
            value={specyfikacja}
            onChange={e => setSpecyfikacja(e.target.value)}
            rows={12}
            style={{width:'100%', padding:'10px 12px', border:'1px solid #ddd',
              borderRadius:8, fontSize:13, resize:'vertical',
              background:'white', color:'#333', fontFamily:'inherit', lineHeight:1.6,
              marginBottom:12}}
          />
          <div style={{display:'flex', justifyContent:'flex-end'}}>
            <button className="btn btn-primary" onClick={zapiszSpecyfikacje}>
              Zapisz specyfikację
            </button>
          </div>
        </div>
      )}
    </div>
  )
}