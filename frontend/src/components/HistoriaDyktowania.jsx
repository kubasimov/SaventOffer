import { useState } from 'react'
import axios from 'axios'

export default function HistoriaDyktowania({ tabelaId }) {
  const [modal, setModal] = useState(false)
  const [log, setLog] = useState([])
  const [loading, setLoading] = useState(false)

  async function otworz() {
    setModal(true)
    setLoading(true)
    try {
      const res = await axios.get(`/api/oferty/tabele/${tabelaId}/dyktowanie`)
      setLog(res.data)
    } catch (e) {}
    setLoading(false)
  }

  function formatCzas(ts) {
    return new Date(ts).toLocaleString('pl-PL', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={otworz}>
        📋 Historia
      </button>
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{maxWidth:560}} onClick={e => e.stopPropagation()}>
            <h2>Historia dyktowania</h2>
            {loading ? (
              <div style={{padding:20, textAlign:'center', color:'#999'}}>Wczytywanie...</div>
            ) : log.length === 0 ? (
              <div className="empty-state">Brak nagrań dla tego mebla</div>
            ) : (
              <div style={{maxHeight:'60vh', overflowY:'auto'}}>
                {log.slice().reverse().map(entry => (
                  <div key={entry.id} style={{
                    padding:'10px 12px', borderBottom:'1px solid #f0f0f0',
                    display:'flex', flexDirection:'column', gap:4
                  }}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                      <span style={{fontSize:11, color:'#aaa'}}>{formatCzas(entry.utworzono)}</span>
                      <span style={{fontSize:12, color: entry.sukces ? '#2e7d32' : '#e65100'}}>
                        {entry.sukces ? '✓ rozpoznano' : '❓ nie rozpoznano'}
                      </span>
                    </div>
                    <div style={{fontSize:14, color:'#333', whiteSpace:'pre-wrap', wordBreak:'break-word'}}>
                      🎤 "{entry.tekst}"
                    </div>
                    {entry.rozpoznano && (
                      <div style={{fontSize:13, color:'#5a2d6e', fontWeight:500}}>
                        → {entry.rozpoznano}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
