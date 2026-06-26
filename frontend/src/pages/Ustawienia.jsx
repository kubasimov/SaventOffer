import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Ustawienia() {
  const [specyfikacja, setSpecyfikacja] = useState('')
  const [zalozenia, setZalozenia] = useState('')
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
    const fs_res = await axios.post('/api/ustawienia/zapisz-zalozenia', { tekst: zalozenia })
    setZapisano('zalozenia')
    setTimeout(() => setZapisano(null), 2000)
  }

  if (loading) return <div className="empty-state">Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Ustawienia</h1>
      </div>

      {/* Założenia domyślne */}
      <div className="card" style={{marginBottom: 20}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <div>
            <h2 style={{fontSize:16, marginBottom:4}}>Domyślne założenia oferty</h2>
            <p style={{fontSize:13, color:'#888'}}>
              Tekst wczytywany automatycznie w kreatorze PDF. Każda linia = osobny punkt.
              Zapisywany w <code>/opt/savento/backend/obrazy/ZALOZENIA.txt</code>
            </p>
          </div>
          {zapisano === 'zalozenia' && (
            <span style={{color:'#2e7d32', fontSize:13}}>✓ Zapisano</span>
          )}
        </div>
        <textarea
          value={zalozenia}
          onChange={e => setZalozenia(e.target.value)}
          rows={10}
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

      {/* Specyfikacja domyślna */}
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
          rows={10}
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
    </div>
  )
}
