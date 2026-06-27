import { useState, useEffect } from 'react'
import axios from 'axios'

// Dane ładowane z API

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
  const [zalozenia, setZalozenia] = useState('')

  // Krok 3 — specyfikacja
  const [specyfikacja, setSpecyfikacja] = useState([])
  const [nowyPunkt, setNowyPunkt] = useState('')

  // Krok 4 — obrazy
  const [kategoria, setKategoria] = useState('')
  // Lista klientów do dropdownu
  const [klienci, setKlienci] = useState([])
  const [recznyWpis, setRecznyWpis] = useState(false)
  // Własne obrazy
  const [wlasneObrazy, setWlasneObrazy] = useState([])
  const [uploadujac, setUploadujac] = useState(false)

  useEffect(() => {
    // Pobierz dane klienta z bazy
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
    // Pobierz kategorie obrazów
    axios.get('/api/pdf/kategorie')
      .then(r => setKategorie(r.data))
      .catch(() => {})
    // Pobierz domyślne założenia z pliku
    axios.get('/api/pdf/zalozenia-domyslne')
      .then(r => { if (r.data.tekst) setZalozenia(r.data.tekst) })
      .catch(() => {})
    // Pobierz domyślną specyfikację z bazy
    axios.get('/api/ustawienia/specyfikacja_domyslna')
      .then(r => {
        if (r.data.wartosc) {
          const punkty = r.data.wartosc.split('\n').filter(Boolean)
          setSpecyfikacja(punkty.map(t => ({ tekst: t.trim(), zaznaczony: true })))
        }
      })
      .catch(() => {})
    // Pobierz listę klientów do dropdownu
    axios.get('/api/klienci?all=true')
      .then(r => setKlienci(r.data))
      .catch(() => {})
  }, [klientId])

  async function wgrajObraz(e) {
    const pliki = Array.from(e.target.files)
    if (!pliki.length) return
    setWlasneObrazy(prev => [...prev, ...pliki])
    setKategoria('__wlasne__')
  }

  function dodajPunkt() {
    if (!nowyPunkt.trim()) return
    setSpecyfikacja(prev => [...prev, { tekst: nowyPunkt.trim(), zaznaczony: true }])
    setNowyPunkt('')
  }

  function togglePunkt(i) {
    setSpecyfikacja(prev => prev.map((p, idx) =>
      idx === i ? { ...p, zaznaczony: !p.zaznaczony } : p
    ))
  }

  function usunPunkt(i) {
    setSpecyfikacja(prev => prev.filter((_, idx) => idx !== i))
  }

  async function generuj() {
    setLoading(true)
    try {
      const specAktywna = specyfikacja.filter(p => p.zaznaczony).map(p => p.tekst)

      let res
      if (kategoria === '__wlasne__' && wlasneObrazy.length > 0) {
        const formData = new FormData()
        formData.append('zalozenia', zalozenia)
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
          zalozenia,
          klient_dane: { ...klientDane, nazwa_inwestycji: nazwaInwestycji },
          specyfikacja: specAktywna,
          kategoria
        }, { responseType: 'blob' })
      }
      const url = URL.createObjectURL(res.data)
      // Otworz PDF w nowej karcie — podglad przed pobraniem
      window.open(url, '_blank')
      // Zwolnij URL po 30s (daje czas na obejrzenie/zapisanie)
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      onClose()
    } catch (err) {
      alert('Błąd generowania PDF')
    }
    setLoading(false)
  }

  const btnStyle = {
    padding: '8px 20px', borderRadius: 8, border: 'none',
    cursor: 'pointer', fontSize: 14, fontWeight: 500
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Pasek kroków */}
        <div style={{ display: 'flex', marginBottom: 24, gap: 4 }}>
          {KROKI.map((nazwa, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 4, borderRadius: 2, marginBottom: 6,
                background: i <= krok ? '#5a2d6e' : '#ddd',
                transition: 'background 0.2s'
              }} />
              <span style={{
                fontSize: 11, color: i === krok ? '#5a2d6e' : '#aaa',
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
              <input
                value={nazwaInwestycji}
                onChange={e => setNazwaInwestycji(e.target.value)}
                placeholder="np. Zabudowa kuchenna"
              />
            </div>

            {/* Wybór klienta z bazy lub ręczny wpis */}
            <div className="form-group">
              <label>Wybierz klienta</label>
              <div style={{display:'flex', gap:8}}>
                <select
                  value={recznyWpis ? '__reczny__' : (klienci.find(k => k.nazwa === klientDane.nazwa)?.id || '')}
                  onChange={e => {
                    if (e.target.value === '__reczny__') {
                      setRecznyWpis(true)
                      setKlientDane({ nazwa:'', adres:'', telefon:'', email:'', uwagi:'' })
                    } else if (e.target.value) {
                      setRecznyWpis(false)
                      const k = klienci.find(c => c.id === e.target.value)
                      if (k) setKlientDane({
                        nazwa: k.nazwa || '', adres: k.adres || '',
                        telefon: k.telefon || '', email: k.email || '', uwagi: ''
                      })
                    }
                  }}
                  style={{flex:1}}
                >
                  <option value="">— wybierz klienta z bazy —</option>
                  {klienci.map(k => (
                    <option key={k.id} value={k.id}>{k.nazwa}</option>
                  ))}
                  <option value="__reczny__">✏️ Wpisz ręcznie...</option>
                </select>
              </div>
            </div>

            {/* Pola danych */}
            {[
              ['Imię i nazwisko / Firma', 'nazwa'],
              ['Adres', 'adres'],
              ['Telefon', 'telefon'],
              ['Email', 'email'],
            ].map(([label, field]) => (
              <div className="form-group" key={field}>
                <label>{label}</label>
                <input
                  value={klientDane[field]}
                  onChange={e => setKlientDane(prev => ({ ...prev, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className="form-group">
              <label>Uwagi do klienta</label>
              <textarea
                value={klientDane.uwagi}
                onChange={e => setKlientDane(prev => ({ ...prev, uwagi: e.target.value }))}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #ddd',
                  borderRadius: 8, fontSize: 14, background: 'white', color: '#333',
                  fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
          </div>
        )}

        {/* Krok 2 — Założenia */}
        {krok === 1 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Założenia oferty</h2>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              Każda linia = osobny punkt listy. Puste pole = brak strony założeń.
            </p>
            <textarea
              value={zalozenia}
              onChange={e => setZalozenia(e.target.value)}
              rows={12}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd',
                borderRadius: 8, fontSize: 13, resize: 'vertical',
                background: 'white', color: '#333', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
        )}

        {/* Krok 3 — Specyfikacja */}
        {krok === 2 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Specyfikacja materiałowa</h2>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              Zaznacz punkty do uwzględnienia w PDF. Możesz dodać własne.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {specyfikacja.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: p.zaznaczony ? '#f8f5ff' : '#f5f5f5',
                  borderRadius: 8, border: `1px solid ${p.zaznaczony ? '#c4a8d8' : '#eee'}` }}>
                  <input
                    type="checkbox"
                    checked={p.zaznaczony}
                    onChange={() => togglePunkt(i)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#5a2d6e' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: p.zaznaczony ? '#333' : '#aaa' }}>
                    {p.tekst}
                  </span>
                  <button onClick={() => usunPunkt(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ccc', fontSize: 16, padding: '0 4px' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={nowyPunkt}
                onChange={e => setNowyPunkt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && dodajPunkt()}
                placeholder="Dodaj własny punkt..."
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd',
                  borderRadius: 8, fontSize: 13, background: 'white', color: '#333' }}
              />
              <button className="btn btn-primary btn-sm" onClick={dodajPunkt}>+ Dodaj</button>
            </div>
          </div>
        )}

        {/* Krok 4 — Obrazy */}
        {krok === 3 && (
          <div>
            <h2 style={{ marginBottom: 8 }}>Obrazy realizacji</h2>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              Wybierz kategorię obrazów do wstawienia po specyfikacji.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${kategoria === '' ? '#5a2d6e' : '#eee'}`,
                background: kategoria === '' ? '#f8f5ff' : 'white' }}>
                <input type="radio" name="kategoria" value=""
                  checked={kategoria === ''}
                  onChange={() => setKategoria('')}
                  style={{ accentColor: '#5a2d6e' }} />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>Bez obrazów</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>Pomiń sekcję z realizacjami</div>
                </div>
              </label>
              {kategorie.map(k => (
                <label key={k.nazwa} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${kategoria === k.nazwa ? '#5a2d6e' : '#eee'}`,
                  background: kategoria === k.nazwa ? '#f8f5ff' : 'white' }}>
                  <input type="radio" name="kategoria" value={k.nazwa}
                    checked={kategoria === k.nazwa}
                    onChange={() => setKategoria(k.nazwa)}
                    style={{ accentColor: '#5a2d6e' }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{k.nazwa}</div>
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

              {/* Własne obrazy */}
              <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid #eee'}}>
                <div style={{fontSize:13, fontWeight:500, color:'#555', marginBottom:8}}>
                  lub wgraj własne pliki JPG/PNG:
                </div>
                <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    multiple
                    onChange={wgrajObraz}
                    style={{display:'none'}}
                  />
                  Wybierz obrazy (JPG/PNG)
                </label>
                {wlasneObrazy.length > 0 && (
                  <div style={{marginTop:10}}>
                    <label style={{display:'flex', alignItems:'center', gap:12,
                      padding:'10px 14px', borderRadius:8, cursor:'pointer',
                      border: `2px solid ${kategoria === '__wlasne__' ? '#5a2d6e' : '#eee'}`,
                      background: kategoria === '__wlasne__' ? '#f8f5ff' : 'white',
                      marginBottom:8}}>
                      <input type="radio" name="kategoria" value="__wlasne__"
                        checked={kategoria === '__wlasne__'}
                        onChange={() => setKategoria('__wlasne__')}
                        style={{accentColor:'#5a2d6e'}}
                      />
                      <div>
                        <div style={{fontWeight:500, fontSize:14}}>Wgrane pliki</div>
                        <div style={{fontSize:12, color:'#888'}}>{wlasneObrazy.length} {wlasneObrazy.length === 1 ? 'plik' : 'pliki'}: {wlasneObrazy.map(o => typeof o === 'string' ? o : o.name).join(', ')}</div>
                      </div>
                      <button onClick={e => {e.preventDefault(); setWlasneObrazy([]); setKategoria('')}}
                        style={{marginLeft:'auto', background:'none', border:'none',
                          cursor:'pointer', color:'#aaa', fontSize:18}}>✕</button>
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
                { ikona: '📋', label: 'Założenia', opis: zalozenia.trim() ? `${zalozenia.split('\n').filter(Boolean).length} punktów` : 'pominięte' },
                { ikona: '🔩', label: 'Specyfikacja', opis: specyfikacja.filter(p => p.zaznaczony).length > 0 ? `${specyfikacja.filter(p => p.zaznaczony).length} pozycji` : 'pominięta' },
                { ikona: '🖼️', label: 'Obrazy', opis: kategoria ? `Kategoria: ${kategoria} (${kategorie.find(k => k.nazwa === kategoria)?.pliki || 0} stron)` : 'pominięte' },
                { ikona: '📊', label: 'Wycena', opis: 'tabele mebli' },
                { ikona: '📎', label: 'Strony końcowe', opis: 'zawsze' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', background: '#f8f8f8', borderRadius: 8 }}>
                  <span style={{ fontSize: 20 }}>{item.ikona}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{item.opis}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nawigacja */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 10 }}>
          <button
            style={{ ...btnStyle, background: '#eee', color: '#555' }}
            onClick={krok === 0 ? onClose : () => setKrok(k => k - 1)}
          >
            {krok === 0 ? 'Anuluj' : '← Wstecz'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {krok === 4 ? (
              <>
                <button
                  style={{ ...btnStyle, background: '#eee', color: '#555' }}
                  onClick={() => generuj()}
                  disabled={loading}
                >
                  Bez założeń i danych
                </button>
                <button
                  style={{ ...btnStyle, background: '#5a2d6e', color: 'white' }}
                  onClick={generuj}
                  disabled={loading}
                >
                  {loading ? 'Generowanie...' : '⬇ Generuj PDF'}
                </button>
              </>
            ) : (
              <button
                style={{ ...btnStyle, background: '#5a2d6e', color: 'white' }}
                onClick={() => setKrok(k => k + 1)}
              >
                Dalej →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
