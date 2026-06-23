import { useState, useEffect } from 'react'
import axios from 'axios'

const DOMYSLNE_ZALOZENIA = `Wycena wstępna na podstawie zapytania;
Oferta cenowa zawiera: projekt techniczny, wykonanie, transport i montaż na terenie Warszawy i okolic;
O ile nie zaznaczono inaczej, wycena nie obejmuje uchwytów i blatów;
Dokładna wycena możliwa po szczegółowych ustaleniach;
Podane ceny są cenami netto (FV+23%);
Zadatek materiałowy przy podpisaniu umowy ~50% wartości zamówienia;
Czas wykonania zlecenia: ~25–55 dni roboczych od podpisania umowy i wpłaty zadatku – dokładny termin ustalany w czasie podpisania umowy;
Wycena ważna 5 dni;
W razie pytań proszę o kontakt.`

const DOMYSLNA_SPECYFIKACJA = [
  'Płyta meblowa laminowana 18mm',
  'Plecy z płyty HDF 3mm',
  'Okucia stalowe ocynkowane',
  'Zawiasy z cichym domykaczem',
  'Prowadnice kulkowe z cichym domykaczem',
  'Nóżki regulowane meblowe',
]

const KROKI = ['Dane klienta', 'Założenia', 'Specyfikacja', 'Obrazy', 'Generuj']

export default function KreatorPDF({ ofertaId, ofertaNumer, klientId, onClose }) {
  const [krok, setKrok] = useState(0)
  const [loading, setLoading] = useState(false)
  const [kategorie, setKategorie] = useState([])

  // Krok 1 — dane klienta
  const [klientDane, setKlientDane] = useState({
    nazwa: '', adres: '', telefon: '', email: '', uwagi: ''
  })

  // Krok 2 — założenia
  const [zalozenia, setZalozenia] = useState(DOMYSLNE_ZALOZENIA)

  // Krok 3 — specyfikacja
  const [specyfikacja, setSpecyfikacja] = useState(
    DOMYSLNA_SPECYFIKACJA.map(t => ({ tekst: t, zaznaczony: true }))
  )
  const [nowyPunkt, setNowyPunkt] = useState('')

  // Krok 4 — obrazy
  const [kategoria, setKategoria] = useState('')

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
  }, [klientId])

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
      const res = await axios.get(`/api/pdf/${ofertaId}`, {
        params: {
          zalozenia,
          klient_dane: JSON.stringify(klientDane),
          specyfikacja: JSON.stringify(specAktywna),
          kategoria
        },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${ofertaNumer}.pdf`
      a.click()
      URL.revokeObjectURL(url)
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
