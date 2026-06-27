import { useState, useRef } from 'react'
import axios from 'axios'
import { parsujTranskrypt } from '../utils/parsujMowe'
import { round2 } from '../utils/calc'

export default function AudioUpload({ tabelaId, cennik, onDodano }) {
  const [przetwarzanie, setPrzetwarzanie] = useState(false)
  const [podsumowanie, setPodsumowanie] = useState(null)
  const [blad, setBlad] = useState(null)
  const fileRef = useRef(null)

  async function zapiszLog(tekst, rozpoznano, sukces) {
    try {
      await axios.post(`/api/oferty/tabele/${tabelaId}/dyktowanie`, { tekst, rozpoznano, sukces })
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

  async function wybierzPlik(e) {
    const file = e.target.files[0]
    if (!file) return
    setPrzetwarzanie(true)
    setBlad(null)
    setPodsumowanie(null)

    try {
      const form = new FormData()
      form.append('audio', file)
      const res = await axios.post('/api/whisper/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 1200000
      })
      const tekst = res.data.tekst

      if (!tekst) {
        await zapiszLog('[audio] (plik bez wykrytej mowy)', null, false)
        setBlad('Nie udało się rozpoznać mowy w pliku')
        setPrzetwarzanie(false)
        return
      }

      const wyniki = parsujTranskrypt(tekst, cennik)
      let dodane = 0, nierozpoznane = 0

      // Log per-fragment - co rozpoznano i co dodano
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

      // Log podsumowujący z PEŁNYM transkryptem - do weryfikacji jakości rozpoznawania mowy
      await zapiszLog(
        `📄 PEŁNY TRANSKRYPT z pliku "${file.name}":\n${tekst}`,
        `Znaleziono ${wyniki.length} fragmentów → dodano ${dodane}, nie rozpoznano ${nierozpoznane}`,
        dodane > 0
      )

      setPodsumowanie({ dodane, nierozpoznane, lacznie: wyniki.length })
      onDodano()
    } catch (err) {
      await zapiszLog('[audio] Błąd przetwarzania pliku', err.response?.data?.error || err.message, false)
      setBlad('Błąd przetwarzania: ' + (err.response?.data?.error || err.message))
    }
    setPrzetwarzanie(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      <label className="btn btn-secondary btn-sm" style={{cursor:'pointer', margin:0}}>
        🎵 Wgraj audio
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={wybierzPlik}
          style={{display:'none'}}
          disabled={przetwarzanie}
        />
      </label>

      {przetwarzanie && (
        <span style={{fontSize:12, color:'#582A48'}}>
          ⏳ Przetwarzanie audio... (może potrwać kilka minut, nie zamykaj strony)
        </span>
      )}

      {podsumowanie && (
        <span style={{fontSize:12, color:'#2e7d32'}}>
          ✓ Dodano {podsumowanie.dodane} z {podsumowanie.lacznie}
          {podsumowanie.nierozpoznane > 0 && (
            <span style={{color:'#e65100'}}> ({podsumowanie.nierozpoznane} nierozpoznanych)</span>
          )}
          {' — sprawdź 📋 Historia dla szczegółów'}
        </span>
      )}

      {blad && <span style={{fontSize:12, color:'#e53935'}}>{blad}</span>}
    </div>
  )
}
