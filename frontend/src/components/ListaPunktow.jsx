import { useState, useRef } from 'react'

const btnS = {
  background:'none', border:'none', cursor:'pointer',
  fontSize:13, padding:'0 4px'
}

export default function ListaPunktow({ punkty, setPunkty, placeholder, label, opis }) {
  const [nowy, setNowy] = useState('')
  const [edytIdx, setEdytIdx] = useState(null)
  const [edytVal, setEdytVal] = useState('')
  const dragIdx = useRef(null)

  function dodaj() {
    if (!nowy.trim()) return
    setPunkty(prev => [...prev, { tekst: nowy.trim(), zaznaczony: true }])
    setNowy('')
  }

  function toggle(i) {
    setPunkty(prev => prev.map((p, idx) =>
      idx === i ? { ...p, zaznaczony: !p.zaznaczony } : p
    ))
  }

  function usun(i) {
    setPunkty(prev => prev.filter((_, idx) => idx !== i))
  }

  function edytuj(i) {
    setEdytIdx(i)
    setEdytVal(punkty[i].tekst)
  }

  function zapiszEdycje() {
    if (edytIdx === null) return
    setPunkty(prev => prev.map((p, i) =>
      i === edytIdx ? { ...p, tekst: edytVal.trim() || p.tekst } : p
    ))
    setEdytIdx(null)
    setEdytVal('')
  }

  function onDragStart(e, i) {
    dragIdx.current = i
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', i)
  }

  function onDragOver(e, i) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDrop(e, i) {
    e.preventDefault()
    const from = dragIdx.current
    if (from === null || from === i) return
    setPunkty(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(from, 1)
      arr.splice(i, 0, moved)
      return arr
    })
    dragIdx.current = null
  }

  const itemStyle = (zaznaczony) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', cursor: 'grab',
    background: '#2b2b2b', borderRadius: 8,
    border: `1px solid ${zaznaczony ? '#3a3a3a' : '#3a3a3a'}`
  })

  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div>
          {label && <h2 style={{fontSize:16, marginBottom:4}}>{label}</h2>}
          {opis && <p style={{fontSize:13, color:'#aaa'}}>{opis}</p>}
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:6, marginBottom:16}}>
        {punkty.map((p, i) => (
          <div
            key={i}
            draggable
            onDragStart={e => onDragStart(e, i)}
            onDragOver={e => onDragOver(e, i)}
            onDrop={e => onDrop(e, i)}
            style={itemStyle(p.zaznaczony)}
          >
            <span style={{color:'#666', fontSize:12, cursor:'grab', userSelect:'none'}}>⠿</span>
            <input
              type="checkbox"
              checked={p.zaznaczony}
              onChange={() => toggle(i)}
              style={{width:16, height:16, cursor:'pointer', accentColor:'#5f2f4d'}}
            />
            {edytIdx === i ? (
              <span style={{flex:1, display:'flex', gap:4}}>
                <input
                  value={edytVal}
                  onChange={e => setEdytVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') zapiszEdycje(); if (e.key === 'Escape') setEdytIdx(null) }}
                  autoFocus
                  style={{flex:1, padding:'4px 8px', border:'1.5px solid #5f2f4d', borderRadius:6,
                    fontSize:13, background:'#3a3a3a', color:'white'}}
                />
                <button className="btn btn-primary btn-sm" onClick={zapiszEdycje}>✓</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEdytIdx(null)}>✕</button>
              </span>
            ) : (
              <span style={{flex:1, fontSize:13, color: p.zaznaczony ? 'white' : '#aaa'}}>
                {p.tekst}
              </span>
            )}
            {edytIdx !== i && (
              <>
                <button onClick={() => edytuj(i)} style={btnS} title="Edytuj">✏️</button>
                <button onClick={() => usun(i)} style={{...btnS, color:'#666', fontSize:16}} title="Usuń">✕</button>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{display:'flex', gap:8}}>
        <input
          value={nowy}
          onChange={e => setNowy(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && dodaj()}
          placeholder={placeholder || 'Dodaj nowy punkt...'}
          style={{flex:1, padding:'8px 12px', border:'1.5px solid #555',
            borderRadius:8, fontSize:13, background:'#3a3a3a', color:'white'}}
        />
        <button className="btn btn-primary btn-sm" onClick={dodaj}>+ Dodaj</button>
      </div>
    </div>
  )
}