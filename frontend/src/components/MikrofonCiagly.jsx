import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { parsujMoweCiagla } from '../utils/parsujMowe'
import { round2 } from '../utils/calc'

export default function MikrofonCiagly({ tabelaId, cennik, onDodano }) {
  const [aktywny, setAktywny] = useState(false)
  const [ostatni, setOstatni] = useState(null)
  const [blad, setBlad] = useState(null)
  const [tryb, setTryb] = useState('web')
  const recRef = useRef(null)
  const mediaRecRef = useRef(null)

  useEffect(() => {
    return () => {
      recRef.current?.stop()
      mediaRecRef.current?.stop()
    }
  }, [])

  // --- Web Speech API ---
  function startWeb() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setBlad('Brak obsługi mowy — użyj trybu Whisper'); return }

    const rec = new SR()
    rec.lang = 'pl-PL'
    rec.continuous = true
    rec.interimResults = false

    rec.onstart = () => { setAktywny(true); setBlad(null); setOstatni(null) }
    rec.onend = () => {
      if (recRef.current) {
        try { rec.start() } catch(e) {}
      } else {
        setAktywny(false)
      }
    }
    rec.onerror = (e) => {
      if (e.error === 'no-speech') return
      setBlad(`Błąd: ${e.error}`)
      setAktywny(false)
    }
    rec.onresult = (e) => {
      const tekst = e.results[e.results.length - 1][0].transcript
      przetworzTekst(tekst)
    }

    recRef.current = rec
    rec.start()
  }

  function stopWeb() {
    recRef.current?.stop()
    recRef.current = null
    setAktywny(false)
  }

  // --- Whisper ---
  async function startWhisper() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAktywny(true)
      setBlad(null)
      setOstatni(null)

      const mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecRef.current = mediaRec
      mediaRec.start(4000)

      mediaRec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setAktywny(false)
      }

      mediaRec.addEventListener('dataavailable', async (e) => {
        if (e.data.size < 1000) return
        await wyslijDoWhisper(e.data)
      })

    } catch (err) {
      setBlad('Brak dostępu do mikrofonu')
    }
  }

  async function wyslijDoWhisper(blob) {
    try {
      const form = new FormData()
      form.append('audio', blob, 'audio.webm')
      const res = await axios.post('/api/whisper/transcribe', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const tekst = res.data.tekst
      if (tekst) przetworzTekst(tekst)
    } catch (err) {
      console.error('Whisper error:', err)
    }
  }

  function stopWhisper() {
    mediaRecRef.current?.stop()
    mediaRecRef.current = null
    setAktywny(false)
  }

  // --- Wspólna logika ---
  async function przetworzTekst(tekst) {
    const wynik = parsujMoweCiagla(tekst, cennik)
    if (wynik.sukces) {
      const info = await dodajPozycje(wynik)
      await zapiszLog(tekst, info, true)
    } else {
      setOstatni(`❓ Nie rozpoznano: "${tekst}"`)
      await zapiszLog(tekst, null, false)
    }
  }

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

      const dimPayload = {
        wymiar_x: wynik.wymiar_x || null,
        wymiar_y: wynik.wymiar_y || null,
        ilosc,
        kolejnosc: (istniejaca?.wymiary?.length || 0) + 1
      }

      await axios.post(`/api/oferty/pozycje/${itemId}/wymiary`, dimPayload)

      const info = wynik.pozycja.jednostka === 'm2'
        ? `${wynik.pozycja.nazwa} ${round2(wynik.wymiar_x)}×${round2(wynik.wymiar_y)}m² (${ilosc.toFixed(2)} m²)`
        : `${wynik.pozycja.nazwa} ${wynik.ilosc} ${wynik.pozycja.jednostka}`

      setOstatni(info)
      onDodano()
      return info
    } catch (err) {
      setBlad('Błąd zapisu')
      return null
    }
  }

  function start() { tryb === 'web' ? startWeb() : startWhisper() }
  function stop() { tryb === 'web' ? stopWeb() : stopWhisper() }

  return (
    <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      <select
        value={tryb}
        onChange={e => setTryb(e.target.value)}
        disabled={aktywny}
        style={{
          padding:'4px 8px', borderRadius:6, border:'1px solid #ddd',
          fontSize:12, color:'#555', background:'white', cursor:'pointer'
        }}
      >
        <option value="web">🌐 Web Speech</option>
        <option value="whisper">🤖 Whisper (lokalny)</option>
      </select>

      <button
        onClick={aktywny ? stop : start}
        style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'6px 14px', borderRadius:20, border:'none',
          cursor:'pointer', fontSize:13, fontWeight:500,
          background: aktywny ? '#e53935' : '#582A48',
          color:'white',
          transition: 'all 0.2s'
        }}
      >
        {aktywny ? '⏹ Stop' : '🎤 Dyktuj'}
      </button>

      {aktywny && (
        <span style={{fontSize:12, color:'#e53935', fontWeight:500}}>
          ● Słucham...
        </span>
      )}

      {ostatni && (
        <span style={{fontSize:12, color: ostatni.startsWith('❓') ? '#e65100' : '#2e7d32',
          maxWidth:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
          {ostatni.startsWith('❓') ? ostatni : `✓ ${ostatni}`}
        </span>
      )}

      {blad && <span style={{fontSize:12, color:'#e53935'}}>{blad}</span>}
    </div>
  )
}
