import { useState } from 'react'
import axios from 'axios'
import { parsujTranskrypt } from '../utils/parsujMowe'
import { round2 } from '../utils/calc'

export default function WklejTekst({ tabelaId, cennik, onDodano }) {
  const [modal, setModal] = useState(false)
  const [tekst, setTekst] = useState('')
  const [przetwarzanie, setPrzetwarzanie] = useState(false)
  const [podsumowanie, setPodsumowanie] = useState(null)
  const [blad, setBlad] = useState(null)

  async function zapiszLog(t, rozpoznano, sukces) {
    try {
      await axios.post(`/api/oferty/tabele/${tabelaId}/dyktowanie`, { tekst: t, rozpoznano, sukces })
    } catch (e) {}
  }

  async function dodajPozycje(wynik) {
    try {
      const aktualneRes = await axios.get(`/api/oferty/tabele-szczegoly/${tabelaId}`)
      const aktualnePozycje = aktualneRes.data.pozycje || []

      const istniejaca = aktualnePozycje.find(p =>
        p.nazwa.trim().toLowerCase() === wynik.pozycja.nazwa.trim().toLowerCase() &&
        parseFloat(p.cena_jedn) === parseFloat(wynik.pozycja.cena) &&
        p.jednostka === wynik.pozycja.jednostka
      )

      let itemId
      if (istniejaca) {
        itemId = istniejaca.id
      } else {
        const resPoz = await axios.post(`/api/oferty/tabele/${tabelaId}/pozycje`, {
          cennik_id: wynik.pozycja.id,
          nazwa: wynik.pozycja.nazwa,
          jednostka: wynik.pozycja.jednostka,
          cena_jedn: parseFloat(wynik.pozycja.cena),
          kolejnosc: 99
        })
        itemId = resPoz.data.id
      }

      const ilosc = wynik.pozycja.jednostka === 'm2'
        ? round2((wynik.wymiar_x || 0) * (wynik.wymiar_y || 0))
        : (wynik.ilosc || 1)

      await axios.post(`/api/oferty/pozycje/${itemId}/wymiary`, {
        wymiar_x: wynik.wymiar_x || null,
        wymiar_y: wynik.wymiar_y || null,
        ilosc,
        kolejnosc: (istniejaca?.wymiary?.length || 0) + 1
      })

      return wynik.pozycja.jednostka === 'm2'
        ? `${wynik.pozycja.nazwa} ${round2(wynik.wymiar_x)}×${round2(wynik.wymiar_y)}m² (${ilosc.toFixed(2)} m²)`
        : `${wynik.pozycja.nazwa} ${wynik.ilosc} ${wynik.pozycja.jednostka}`
    } catch (err) {
      return null
    }
  }

  async function przetworz() {
    if (!tekst.trim()) return
    setPrzetwarzanie(true)
    setBlad(null)
    setPodsumowanie(null)

    try {
      const wyniki = parsujTranskrypt(tekst, cennik)
      let dodane = 0, nierozpoznane = 0

      for (const wynik of wyniki) {
        if (wynik.sukces) {
          const info = await dodajPozycje(wynik)
          if (info) {
            await zapiszLog(wynik.segmentTekst, info, true)
            dodane++
          } else {
            await zapiszLog(wynik.segmentTekst, 'Błąd zapisu do bazy', false)
            nierozpoznane++
          }
        } else {
          await zapiszLog(wynik.segmentTekst, null, false)
          nierozpoznane++
        }
      }

      await zapiszLog(
        `📝 WKLEJONY TEKST:\n${tekst}`,
        `Znaleziono ${wyniki.length} fragmentów → dodano ${dodane}, nie rozpoznano ${nierozpoznane}`,
        dodane > 0
      )

      setPodsumowanie({ dodane, nierozpoznane, lacznie: wyniki.length })
      onDodano()
      setTekst('')
    } catch (err) {
      setBlad('Błąd przetwarzania tekstu')
    }
    setPrzetwarzanie(false)
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => { setModal(true); setPodsumowanie(null); setBlad(null) }}>
        📝 Wklej tekst
      </button>

      {modal && (
        <div className="modal-overlay" onClick={() => !przetwarzanie && setModal(false)}>
          <div className="modal" style={{maxWidth:560}} onClick={e => e.stopPropagation()}>
            <h2>Wklej transkrypcję</h2>
            <div className="form-group">
              <label>Tekst (np. z Google Keep)</label>
              <textarea
                value={tekst}
                onChange={e => setTekst(e.target.value)}
                placeholder="płyta meblowa dwa na zero przecinek sześć, szafka typ dziewięćdziesiąt trzy sztuki..."
                rows={8}
                style={{
                  width:'100%', padding:'10px 12px', border:'1px solid #ddd',
                  borderRadius:8, fontSize:14, resize:'vertical',
                  background:'white', color:'#333', fontFamily:'inherit'
                }}
                disabled={przetwarzanie}
              />
            </div>

            {przetwarzanie && (
              <div style={{fontSize:13, color:'#5a2d6e', marginBottom:12}}>
                ⏳ Przetwarzanie...
              </div>
            )}

            {podsumowanie && (
              <div style={{
                background:'#f0f9f0', border:'1px solid #c8e6c9',
                borderRadius:8, padding:'8px 12px', marginBottom:12, fontSize:13, color:'#2e7d32'
              }}>
                ✓ Dodano {podsumowanie.dodane} z {podsumowanie.lacznie}
                {podsumowanie.nierozpoznane > 0 && (
                  <span style={{color:'#e65100'}}> ({podsumowanie.nierozpoznane} nierozpoznanych)</span>
                )}
                {' — sprawdź 📋 Historia dla szczegółów'}
              </div>
            )}

            {blad && (
              <div style={{color:'#e53935', fontSize:13, marginBottom:12}}>{blad}</div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={przetwarzanie}>
                Zamknij
              </button>
              <button className="btn btn-primary" onClick={przetworz} disabled={przetwarzanie || !tekst.trim()}>
                {przetwarzanie ? 'Przetwarzanie...' : 'Przetwórz i dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
