import { useState, useEffect } from 'react'
import axios from 'axios'
import ListaPunktow from './ListaPunktow'

const KROKI = ['Dane klienta', 'Założenia', 'Specyfikacja', 'Obrazy', 'Generuj']

export default function KreatorPDF({ ofertaId, ofertaNumer, ofertaNazwa, klientId, onClose }) {
  const [krok, setKrok] = useState(0)
  const [loading, setLoading] = useState(false)
  const [kategorie, setKategorie] = useState([])

  // Krok 1 — dane klienta
  const [nazwaInwestycji, setNazwaInwestycji] = useState(ofertaNazwa || '')
  const [klientDane, setKlientDane] = useState({
    nazwa: '', adres: '', telefon: '', email: '', uwagi: ''
  })

  // Krok 2 — założenia
  const [zalozenia, setZalozenia] = useState([])

  // Krok 3 — specyfikacja
  const [specyfikacja, setSpecyfikacja] = useState([])

  // Krok 4 — obrazy
  const [kategoria, setKategoria] = useState('')
  const [klienci, setKlienci] = useState([])
  const [recznyWpis, setRecznyWpis] = useState(false)
  const [wlasneObrazy, setWlasneObrazy] = useState([])
  const [uploadujac, setUploadujac] = useState(false)
  const [podglad, setPodglad] = useState(false)

  useEffect(() => {
    let savedFound = false
    axios.get(`/api/ustawienia/pdf_settings_${ofertaId}`)
      .then(r => {
        if (r.data?.wartosc) {
          try {
            const s = JSON.parse(r.data.wartosc)
            if (s.zalozenia) setZalozenia(Array.isArray(s.zalozenia) ? s.zalozenia : s.zalozenia.split('\n').filter(Boolean).map(t => ({ tekst: t.trim(), zaznaczony: true })));
                        if (s.specyfikacja) setSpecyfikacja(Array.isArray(s.specyfikacja) ? s.specyfikacja : s.specyfikacja.split('\n').filter(Boolean).map(t => ({ tekst: t.trim(), zaznaczony: true })));
            if (s.kategoria) setKategoria(s.kategoria)
            if (s.klientDane) setKlientDane(prev => ({ ...prev, ...s.klientDane }))
            if (s.nazwaInwestycji) setNazwaInwestycji(s.nazwaInwestycji)
            if (s.podglad !== undefined) setPodglad(s.podglad)
            savedFound = true
          } catch (e) {}
        }
      })
      .catch(() => {})

    if (klientId) {
      axios.get(`/api/klienci/${klientId}`)
        .then(r => {
          const k = r.data
          setKlientDane({
            nazwa: k.nazwa || '',
            adres: k.adres || '',
            telefon: k.telefon || '',
            email: k.email || '',
            uwagi: ''
          })
        })
        .catch(() => {})
    }
    axios.get('/api/pdf/kategorie')
      .then(r => setKategorie(r.data))
      .catch(() => {})
    axios.get('/api/pdf/zalozenia-domyslne')
      .then(r => { if (r.data.tekst && !savedFound) {
        setZalozenia(r.data.tekst.split('\n').filter(Boolean).map(t => ({ tekst: t.trim(), zaznaczony: true })))
      }})
      .catch(() => {})
    axios.get('/api/ustawienia/specyfikacja_domyslna')
      .then(r => {
        if (r.data.wartosc && !savedFound) {
          const punkty = r.data.wartosc.split('\n').filter(Boolean)
          setSpecyfikacja(punkty.map(t => ({ tekst: t.trim(), zaznaczony: true })))
        }
      })
      .catch(() => {})
    axios.get('/api/klienci?all=true')
      .then(r => setKlienci(r.data))
      .catch(() => {})
  }, [klientId, ofertaId])

  async function wgrajObraz(e) {
    const pliki = Array.from(e.target.files)
    if (!pliki.length) return
    setWlasneObrazy(prev => [...prev, ...pliki])
    setKategoria('__wlasne__')
  }

  async function generuj() {
    setLoading(true)
    try {
      const zalozeniaTekst = zalozenia.filter(p => p.zaznaczony).map(p => p.tekst).join('\n')
      const specAktywna = specyfikacja.filter(p => p.zaznaczony).map(p => p.tekst)

      let res
      if (kategoria === '__wlasne__' && wlasneObrazy.length > 0) {
        const formData = new FormData()
        formData.append('zalozenia', zalozeniaTekst)
        formData.append('klient_dane', JSON.stringify({ ...klientDane, nazwa_inwestycji: nazwaInwestycji }))
        formData.append('specyfikacja', JSON.stringify(specAktywna))
        formData.append('kategoria', '')
        wlasneObrazy.forEach((plik, i) => formData.append(`obraz_${i}`, plik, plik.name))
        res = await axios.post(`/api/pdf/${ofertaId}/z-obrazami`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          responseType: 'blob'
        })
      } else {
        res = await axios.post(`/api/pdf/${ofertaId}`, {
          zalozenia: zalozeniaTekst,
          klient_dane: { ...klientDane, nazwa_inwestycji: nazwaInwestycji },
          specyfikacja: specAktywna,
          kategoria
        }, { responseType: 'blob' })
      }

      zapiszUstawienia(specAktywna)
      const url = URL.createObjectURL(res.data)
      if (podglad) {
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      } else {
        const a = document.createElement('a')
        a.href = url
        a.download = `${ofertaNumer}.pdf`
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 100)
      }
      onClose()
    } catch (err) {
      alert('Błąd generowania PDF')
    }
    setLoading(false)
  }

  async function zapiszUstawienia(specAktywna) {
    try {
      await axios.put(`/api/ustawienia/pdf_settings_${ofertaId}`, {
        wartosc: JSON.stringify({
          nazwaInwestycji,
          klientDane,
          zalozenia,
          specyfikacja,
          kategoria,
          podglad
        })
      })
    } catch (e) { /* ignoruj */ }
  }

  const btnStyle = {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 14, fontWeight: 500
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Pasek kroków */}
        <div style={{ display: 'flex', marginBottom: 24, gap: 4 }}>
          {KROKI.map((nazwa, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 6,
                background: i <= krok ? '#5f2f4d' : '#3a3a3a',
                transition: 'background 0.2s'
              }} />
              <span style={{
                fontSize: 11, color: i === krok ? '#c6bec4' : '#666',
                fontWeight: i === krok ? 600 : 400
              }}>{nazwa}</span>
            </div>
          ))}
        </div>

        {/* Krok 1 — Dane klienta */}
        {krok === 0 && (
          <div>
            <h2 style={{ marginBottom: 16 }}>Dane klienta</h2>
            <div className="form-group">
              <label>Nazwa inwestycji (np. Zabudowa kuchenna)</label>
              <input value={nazwaInwestycji} onChange={e => setNazwaInwestycji(e.target.value)} placeholder="np. Zabudowa kuchenna" />
            </div>
            <div className="form-group">
              <label>Wybierz klienta</label>
              <div style={{display:'flex', gap:8}}>
                <select value={recznyWpis ? '__reczny__' : (klienci.find(k => k.nazwa === klientDane.nazwa)?.id || '')}
                  onChange={e => {
                    if (e.target.value === '__reczny__') {
                      setRecznyWpis(true)
                      setKlientDane({ nazwa:'', adres:'', telefon:'', email:'', uwagi:'' })
                    } else if (e.target.value) {
                      setRecznyWpis(false)
                      const k = klienci.find(c => c.id === e.target.value)
                      if (k) setKlientDane({ nazwa: k.nazwa || '', adres: k.adres || '', telefon: k.telefon || '', email: k.email || '', uwagi: '' })
                    }
                  }}
                  style={{flex:1}}>
                  <option value="">— wybierz klienta z bazy —</option>
                  {klienci.map(k => (<option key={k.id} value={k.id}>{k.nazwa}</option>))}
                  <option value="__reczny__">✏️ Wpisz ręcznie...</option>
                </select>
              </div>
            </div>
            {[['Imię i nazwisko / Firma', 'nazwa'], ['Adres', 'adres']].map(([label, field]) => (
              <div className="form-group" key={field}>
                <label>{label}</label>
                <input value={klientDane[field]} onChange={e => setKlientDane(prev => ({ ...prev, [field]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}

        {/* Krok 2 — Założenia */}
        {krok === 1 && (
          <ListaPunktow
            punkty={zalozenia}
            setPunkty={setZalozenia}
            label="Założenia oferty"
            opis="Zaznacz punkty do uwzględnienia. Przeciągaj by zmienić kolejność."
            placeholder="Dodaj założenie..."
          />
        )}

        {/* Krok 3 — Specyfikacja */}
        {krok === 2 && (
          <ListaPunktow
            punkty={specyfikacja}
            setPunkty={setSpecyfikacja}
            label="Specyfikacja materiałowa"
            opis="Zaznacz punkty do uwzględnienia w PDF. Przeciągaj by zmienić kolejność."
            placeholder="Dodaj własny punkt..."
          />
        )}

        {/* Krok 4 — Obrazy */}
        {krok === 3 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Obrazy realizacji</h2>
            <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16 }}>
              Wybierz kategorię obrazów do wstawienia po specyfikacji.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${kategoria === '' ? '#5f2f4d' : '#3a3a3a'}`,
                background: '#2b2b2b' }}>
                <input type="radio" name="kategoria" value=""
                  checked={kategoria === ''} onChange={() => setKategoria('')}
                  style={{ accentColor: '#5f2f4d' }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color:'white' }}>Bez obrazów</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>Pomiń sekcję z realizacjami</div>
                </div>
              </label>
              {kategorie.map(k => (
                <label key={k.nazwa} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${kategoria === k.nazwa ? '#5f2f4d' : '#3a3a3a'}`,
                  background: '#2b2b2b' }}>
                  <input type="radio" name="kategoria" value={k.nazwa}
                    checked={kategoria === k.nazwa} onChange={() => setKategoria(k.nazwa)}
                    style={{ accentColor: '#5f2f4d' }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14, color:'white' }}>{k.nazwa}</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>{k.pliki} {k.pliki === 1 ? 'strona' : 'stron'}</div>
                  </div>
                </label>
              ))}
              {kategorie.length === 0 && (
                <div style={{ fontSize: 13, color: '#aaa', padding: 16, textAlign: 'center' }}>
                  Brak dostępnych kategorii. Dodaj pliki PDF do katalogów w<br/>
                  <code style={{ fontSize: 12 }}>/opt/savento/backend/obrazy/</code>
                </div>
              )}
              <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #3a3a3a'}}>
                <div style={{fontSize:13, fontWeight:500, color:'#aaa', marginBottom:8}}>
                  lub wgraj własne pliki JPG/PNG:
                </div>
                <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                  <input type="file" accept="image/jpeg,image/png,image/jpg" multiple
                    onChange={wgrajObraz} style={{display:'none'}} />
                  Wybierz obrazy (JPG/PNG)
                </label>
                {wlasneObrazy.length > 0 && (
                  <div style={{marginTop:10}}>
                    <label style={{display:'flex', alignItems:'center', gap:12,
                      padding:'10px 14px', borderRadius:8, cursor:'pointer',
                      border: `2px solid ${kategoria === '__wlasne__' ? '#5f2f4d' : '#3a3a3a'}`,
                      background: '#2b2b2b', marginBottom:8}}>
                      <input type="radio" name="kategoria" value="__wlasne__"
                        checked={kategoria === '__wlasne__'} onChange={() => setKategoria('__wlasne__')}
                        style={{accentColor:'#5f2f4d'}} />
                      <div>
                        <div style={{fontWeight:500, fontSize:14, color:'white'}}>Wgrane pliki</div>
                        <div style={{fontSize:12, color:'#aaa'}}>{wlasneObrazy.length} {wlasneObrazy.length === 1 ? 'plik' : 'pliki'}: {wlasneObrazy.map(o => typeof o === 'string' ? o : o.name).join(', ')}</div>
                      </div>
                      <button onClick={e => {e.preventDefault(); setWlasneObrazy([]); setKategoria('')}}
                        style={{marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#666', fontSize:18}}>✕</button>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Krok 5 — Podsumowanie */}
        {krok === 4 && (
          <div>
            <h2 style={{ marginBottom: 16 }}>Podsumowanie PDF</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { ikona: '📄', label: 'Okładka', opis: 'zawsze' },
                { ikona: '👤', label: 'Dane klienta', opis: klientDane.nazwa || '(puste)' },
                { ikona: '📋', label: 'Założenia', opis: zalozenia.filter(p => p.zaznaczony).length > 0 ? `${zalozenia.filter(p => p.zaznaczony).length} punktów` : 'pominięte' },
                { ikona: '🔩', label: 'Specyfikacja', opis: specyfikacja.filter(p => p.zaznaczony).length > 0 ? `${specyfikacja.filter(p => p.zaznaczony).length} pozycji` : 'pominięta' },
                { ikona: '🖼️', label: 'Obrazy', opis: kategoria ? `Kategoria: ${kategoria} (${kategorie.find(k => k.nazwa === kategoria)?.pliki || 0} stron)` : 'pominięte' },
                { ikona: '📊', label: 'Wycena', opis: 'tabele mebli' },
                { ikona: '📎', label: 'Strony końcowe', opis: 'zawsze' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: '#2b2b2b', borderRadius: 8, border:'1px solid #3a3a3a' }}>
                  <span style={{ fontSize: 20 }}>{item.ikona}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, color:'white' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>{item.opis}</div>
                  </div>
                </div>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:10, marginTop:16,
              padding:'10px 14px', background:'#2b2b2b', borderRadius:8, cursor:'pointer',
              border:'1px solid #3a3a3a' }}>
              <input type="checkbox" checked={podglad} onChange={e => setPodglad(e.target.checked)}
                style={{ width:18, height:18, cursor:'pointer', accentColor:'#5f2f4d' }} />
              <div>
                <div style={{ fontWeight:500, fontSize:13, color:'#c6bec4' }}>Podgląd przed pobraniem</div>
                <div style={{ fontSize:12, color:'#aaa' }}>
                  {podglad ? 'PDF otworzy się w nowej karcie' : 'PDF zostanie pobrany automatycznie'}
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Nawigacja */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnStyle, background: '#3a3a3a', color: '#c6bec4' }} onClick={onClose}>Anuluj</button>
            {krok > 0 && (
              <button style={{ ...btnStyle, background: '#3a3a3a', color: '#c6bec4' }} onClick={() => setKrok(k => k - 1)}>← Wstecz</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {krok === 4 ? (
              <>
                <button style={{ ...btnStyle, background: '#3a3a3a', color: '#c6bec4' }} onClick={() => generuj()} disabled={loading}>
                  {loading ? <span className="spin">⏳</span> : 'Bez założeń i danych'}
                </button>
                <button style={{ ...btnStyle, background: '#5f2f4d', color: 'white' }} onClick={generuj} disabled={loading}>
                  {loading ? <span className="spin">⏳</span> : '⬇ Generuj PDF'}
                </button>
              </>
            ) : (
              <button style={{ ...btnStyle, background: '#5f2f4d', color: 'white' }} onClick={() => setKrok(k => k + 1)}>
                Dalej →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}