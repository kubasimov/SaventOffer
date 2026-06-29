import { useState, useEffect } from 'react'
import axios from 'axios'
import Cennik from './Cennik'
import Uzytkownicy from './Uzytkownicy'
import Import from './Import'
import ListaPunktow from '../components/ListaPunktow'

const ZAKLADKI = ['Cennik', 'Założenia', 'Specyfikacja', 'Użytkownicy', 'Import']

export default function Ustawienia() {
  const [aktywna, setAktywna] = useState(0)
  const [zalozenia, setZalozenia] = useState([])
  const [specyfikacja, setSpecyfikacja] = useState([])
  const [zapisano, setZapisano] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get('/api/ustawienia/specyfikacja_domyslna').catch(() => ({ data: { wartosc: '' } })),
      axios.get('/api/pdf/zalozenia-domyslne').catch(() => ({ data: { tekst: '' } }))
    ]).then(([spec, zal]) => {
      const specRaw = spec.data.wartosc || ''
      const zalRaw = zal.data.tekst || ''
      setSpecyfikacja(specRaw.split('\n').filter(Boolean).map(t => ({ tekst: t.trim(), zaznaczony: true })))
      setZalozenia(zalRaw.split('\n').filter(Boolean).map(t => ({ tekst: t.trim(), zaznaczony: true })))
      setLoading(false)
    })
  }, [])

  async function zapiszSpecyfikacje() {
    const txt = specyfikacja.map(p => p.tekst).join('\n')
    await axios.put('/api/ustawienia/specyfikacja_domyslna', { wartosc: txt })
    setZapisano('specyfikacja')
    setTimeout(() => setZapisano(null), 2000)
  }

  async function zapiszZalozenia() {
    const txt = zalozenia.map(p => p.tekst).join('\n')
    await axios.post('/api/ustawienia/zapisz-zalozenia', { tekst: txt })
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
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #3a3a3a' }}>
        {ZAKLADKI.map((n, i) => (
          <button
            key={n}
            onClick={() => setAktywna(i)}
            style={{
              padding: '10px 24px', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: aktywna === i ? 600 : 400,
              color: aktywna === i ? '#c6bec4' : '#888',
              background: 'none',
              borderBottom: aktywna === i ? '3px solid #c6bec4' : '3px solid transparent',
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
        <>
          <ListaPunktow
            punkty={zalozenia}
            setPunkty={setZalozenia}
            label="Domyślne założenia oferty"
            opis="Punkty wczytywane automatycznie w kreatorze PDF. Przeciągaj by zmienić kolejność."
            placeholder="Dodaj założenie..."
          />
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:12}}>
            {zapisano === 'zalozenia' && (
              <span style={{color:'#81c784', fontSize:13, marginRight:12, alignSelf:'center'}}>✓ Zapisano</span>
            )}
            <button className="btn btn-primary" onClick={zapiszZalozenia}>
              Zapisz założenia
            </button>
          </div>
        </>
      )}

      {/* Zakładka: Specyfikacja */}
      {aktywna === 2 && (
        <>
          <ListaPunktow
            punkty={specyfikacja}
            setPunkty={setSpecyfikacja}
            label="Domyślna specyfikacja materiałowa"
            opis="Punkty wczytywane w kreatorze PDF. Przeciągaj by zmienić kolejność."
            placeholder="Dodaj punkt specyfikacji..."
          />
          <div style={{display:'flex', justifyContent:'flex-end', marginTop:12}}>
            {zapisano === 'specyfikacja' && (
              <span style={{color:'#81c784', fontSize:13, marginRight:12, alignSelf:'center'}}>✓ Zapisano</span>
            )}
            <button className="btn btn-primary" onClick={zapiszSpecyfikacje}>
              Zapisz specyfikację
            </button>
          </div>
        </>
      )}

      {/* Zakładka: Użytkownicy */}
      {aktywna === 3 && <Uzytkownicy />}

      {/* Zakładka: Import */}
      {aktywna === 4 && <Import />}
    </div>
  )
}