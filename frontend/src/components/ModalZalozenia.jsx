import { useState } from 'react'
import axios from 'axios'

const DOMYSLNE = `Wycena wstępna na podstawie zapytania;
Oferta cenowa zawiera: projekt techniczny, wykonanie, transport i montaż na terenie Warszawy i okolic;
O ile nie zaznaczono inaczej, wycena nie obejmuje uchwytów i blatów;
Dokładna wycena możliwa po szczegółowych ustaleniach;
Podane ceny są cenami netto (FV+23%);
Zadatek materiałowy przy podpisaniu umowy ~50% wartości zamówienia;
Czas wykonania zlecenia: ~25–55 dni roboczych od podpisania umowy i wpłaty zadatku – dokładny termin ustalany w czasie podpisania umowy;
Wycena ważna 5 dni;
W razie pytań proszę o kontakt.`

export default function ModalZalozenia({ ofertaId, numer, onClose }) {
  const [tekst, setTekst] = useState(DOMYSLNE)
  const [loading, setLoading] = useState(false)

  async function generuj(zalozenia) {
    setLoading(true)
    try {
      const res = await axios.get(`/api/pdf/${ofertaId}`, {
        params: { zalozenia },
        responseType: 'blob'
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${numer}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (err) {
      alert('Błąd generowania PDF')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:580}} onClick={e => e.stopPropagation()}>
        <h2>Założenia oferty</h2>
        <p style={{fontSize:13, color:'#888', marginBottom:12}}>
          Edytuj lub zatwierdź tekst założeń który pojawi się na drugiej stronie PDF.
        </p>
        <div className="form-group">
          <textarea
            value={tekst}
            onChange={e => setTekst(e.target.value)}
            rows={12}
            style={{
              width:'100%', padding:'10px 12px', border:'1px solid #ddd',
              borderRadius:8, fontSize:13, resize:'vertical',
              background:'white', color:'#333', fontFamily:'inherit', lineHeight:1.6
            }}
          />
        </div>
        <div style={{fontSize:12, color:'#aaa', marginBottom:16}}>
          Każda linia to osobny punkt listy. Zostaw puste pole żeby pominąć stronę założeń.
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Anuluj
          </button>
          <button className="btn btn-secondary" onClick={() => generuj('')} disabled={loading}>
            Bez założeń
          </button>
          <button className="btn btn-primary" onClick={() => generuj(tekst)} disabled={loading}>
            {loading ? 'Generowanie...' : '⬇ Generuj PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
