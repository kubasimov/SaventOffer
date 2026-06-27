import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Cennik() {
  const [pozycje, setPozycje] = useState([])
  const [modal, setModal] = useState(false)
  const [edytowana, setEdytowana] = useState(null)
  const [rozwinietaId, setRozwinietaId] = useState(null)
  const [nowyAlias, setNowyAlias] = useState('')
  const [form, setForm] = useState({ nazwa: '', cena: '', jednostka: 'szt' })

  useEffect(() => { pobierzCennik() }, [])

  async function pobierzCennik() {
    const res = await axios.get('/api/cennik')
    setPozycje(res.data)
  }

  function otworzModal(pozycja = null) {
    if (pozycja) {
      setEdytowana(pozycja)
      setForm({ nazwa: pozycja.nazwa, cena: pozycja.cena, jednostka: pozycja.jednostka })
    } else {
      setEdytowana(null)
      setForm({ nazwa: '', cena: '', jednostka: 'szt' })
    }
    setModal(true)
  }

  async function zapiszPozycje() {
    if (edytowana) {
      await axios.put(`/api/cennik/${edytowana.id}`, { ...form, aktywny: true })
    } else {
      await axios.post('/api/cennik', form)
    }
    setModal(false)
    pobierzCennik()
  }

  async function usunPozycje(id) {
    if (confirm('Usunąć pozycję z cennika?')) {
      await axios.delete(`/api/cennik/${id}`)
      pobierzCennik()
    }
  }

  async function dodajAlias(cennikId) {
    if (!nowyAlias.trim()) return
    await axios.post(`/api/cennik/${cennikId}/aliasy`, { alias: nowyAlias.trim().toUpperCase() })
    setNowyAlias('')
    pobierzCennik()
  }

  async function usunAlias(aliasId) {
    await axios.delete(`/api/cennik/aliasy/${aliasId}`)
    pobierzCennik()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Cennik</h1>
        <button className="btn btn-primary" onClick={() => otworzModal()}>+ Dodaj pozycję</button>
      </div>
      <div className="card">
        <table className="cennik-table">
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Aliasy</th>
              <th>Cena</th>
              <th>Jednostka</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pozycje.map(p => (
              <>
                <tr key={p.id}>
                  <td><strong>{p.nazwa}</strong></td>
                  <td>
                    <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center'}}>
                      {(p.aliasy || []).map(a => (
                        <span key={a.id} style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          background:'#f0ebf8', color:'#5a2d6e',
                          borderRadius:12, padding:'2px 8px', fontSize:12
                        }}>
                          {a.alias}
                          <button
                            onClick={() => usunAlias(a.id)}
                            style={{background:'none', border:'none', cursor:'pointer',
                              color:'#aaa', fontSize:11, padding:0, lineHeight:1}}
                          >✕</button>
                        </span>
                      ))}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setRozwinietaId(rozwinietaId === p.id ? null : p.id)}
                        style={{fontSize:11, padding:'2px 8px'}}
                      >
                        + alias
                      </button>
                    </div>
                  </td>
                  <td><strong>{parseFloat(p.cena).toFixed(2)} zł</strong></td>
                  <td><span className={`badge badge-${p.jednostka}`}>{p.jednostka}</span></td>
                  <td style={{textAlign:'right', display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                    <button className="btn btn-secondary btn-sm" onClick={() => otworzModal(p)}>Edytuj</button>
                    <button className="btn btn-danger btn-sm" onClick={() => usunPozycje(p.id)}>Usuń</button>
                  </td>
                </tr>
                {rozwinietaId === p.id && (
                  <tr key={`alias-${p.id}`}>
                    <td colSpan={5} style={{background:'#f8f5ff', padding:'8px 16px'}}>
                      <div style={{display:'flex', gap:8, alignItems:'center'}}>
                        <input
                          value={nowyAlias}
                          onChange={e => setNowyAlias(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && dodajAlias(p.id)}
                          placeholder="np. SZUFLADA DTC"
                          style={{
                            padding:'6px 10px', border:'1px solid #ddd',
                            borderRadius:6, fontSize:13, width:260,
                            background:'white', color:'#333'
                          }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => dodajAlias(p.id)}>
                          Dodaj
                        </button>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => { setRozwinietaId(null); setNowyAlias('') }}>
                          Anuluj
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{edytowana ? 'Edytuj pozycję' : 'Nowa pozycja'}</h2>
            <div className="form-group">
              <label>Nazwa</label>
              <input value={form.nazwa} onChange={e => setForm({...form, nazwa: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Cena</label>
              <input type="number" step="0.01" value={form.cena}
                onChange={e => setForm({...form, cena: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Jednostka</label>
              <select value={form.jednostka} onChange={e => setForm({...form, jednostka: e.target.value})}>
                <option value="szt">szt</option>
                <option value="m2">m2</option>
                <option value="mb">mb</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={zapiszPozycje}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
