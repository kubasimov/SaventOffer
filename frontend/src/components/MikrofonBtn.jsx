import { useState, useRef } from 'react'

export default function MikrofonBtn({ onWynik, jezyk = 'pl-PL' }) {
  const [nagrywanie, setNagrywanie] = useState(false)
  const [blad, setBlad] = useState(null)
  const recognitionRef = useRef(null)

  function start() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setBlad('Przeglądarka nie obsługuje mowy')
      return
    }

    const rec = new SpeechRecognition()
    rec.lang = jezyk
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => { setNagrywanie(true); setBlad(null) }
    rec.onend = () => setNagrywanie(false)
    rec.onerror = (e) => { setBlad('Błąd mikrofonu'); setNagrywanie(false) }
    rec.onresult = (e) => {
      const tekst = e.results[0][0].transcript
      onWynik(tekst)
    }

    recognitionRef.current = rec
    rec.start()
  }

  function stop() {
    recognitionRef.current?.stop()
    setNagrywanie(false)
  }

  return (
    <div style={{display:'inline-flex', flexDirection:'column', alignItems:'center', gap:2}}>
      <button
        type="button"
        onClick={nagrywanie ? stop : start}
        style={{
          width: 38, height: 38,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          background: nagrywanie ? '#e53935' : '#582A48',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: nagrywanie ? '0 0 0 4px rgba(229,57,53,0.3)' : 'none',
          transition: 'all 0.2s',
          animation: nagrywanie ? 'pulse 1s infinite' : 'none'
        }}
        title={nagrywanie ? 'Kliknij aby zatrzymać' : 'Kliknij aby mówić'}
      >
        {nagrywanie ? '⏹' : '🎤'}
      </button>
      {blad && <span style={{fontSize:10, color:'#e53935'}}>{blad}</span>}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(229,57,53,0.4); }
          70% { box-shadow: 0 0 0 8px rgba(229,57,53,0); }
          100% { box-shadow: 0 0 0 0 rgba(229,57,53,0); }
        }
      `}</style>
    </div>
  )
}
