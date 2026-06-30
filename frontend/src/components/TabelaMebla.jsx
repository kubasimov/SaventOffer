import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import MikrofonCiagly from './MikrofonCiagly'
import HistoriaDyktowania from './HistoriaDyktowania'
import AudioUpload from './AudioUpload'
import WklejTekst from './WklejTekst'

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

function obliczWartoscPozycji(pozycja) {
  const cena = parseFloat(pozycja.cena_jedn || 0)
  if (!pozycja.wymiary || pozycja.wymiary.length === 0) return 0
  return round2(pozycja.wymiary.reduce((acc, d) => {
    const il = pozycja.jednostka === 'm2'
      ? round2(parseFloat(d.wymiar_x || 0) * parseFloat(d.wymiar_y || 0))
      : parseFloat(d.ilosc || 0)
    return acc + round2(il * cena)
  }, 0))
}

function obliczLacznaIlosc(pozycja) {
  if (!pozycja.wymiary || pozycja.wymiary.length === 0) return 0
  if (pozycja.jednostka === 'm2') {
    return round2(pozycja.wymiary.reduce((acc, d) =>
      acc + round2(parseFloat(d.wymiar_x || 0) * parseFloat(d.wymiar_y || 0)), 0))
  }
  return pozycja.wymiary.reduce((acc, d) => acc + parseFloat(d.ilosc || 0), 0)
}

function obliczSume(pozycje) {
  return round2(pozycje.reduce((sum, p) => sum + obliczWartoscPozycji(p), 0))
}

function formatPLN(val) {
  return val.toFixed(2).replace('.', ',') + ' zł'
}

function znajdzIstniejaca(pozycje, form) {
  if (!form.nazwa.trim()) return null
  return pozycje.find(p =>
    p.nazwa.trim().toLowerCase() === form.nazwa.trim().toLowerCase() &&
    parseFloat(p.cena_jedn) === parseFloat(form.cena_jedn) &&
    p.jednostka === form.jednostka
  ) || null
}

function PozycjaRow({ pozycja, onUsunPozycje, onZaktualizujPozycje, korekta }) {
  const [rozwiniety, setRozwiniety] = useState(false)
  const [nowyWymiar, setNowyWymiar] = useState({ wymiar_x: '', wymiar_y: '', ilosc: '1' })
  const [edytujNazwePoz, setEdytujNazwePoz] = useState(false)
  const [nowaNazwaPoz, setNowaNazwaPoz] = useState(pozycja.nazwa)
  const [edytujCene, setEdytujCene] = useState(false)
  const [nowaCena, setNowaCena] = useState(parseFloat(pozycja.cena_jedn))
  const [edytowanyWymiar, setEdytowanyWymiar] = useState(null)
  const [edytWartosci, setEdytWartosci] = useState({})
  const firstInputRef = useRef(null)
  const wymiary = pozycja.wymiary || []

  useEffect(() => {
    if (rozwiniety && firstInputRef.current) {
      firstInputRef.current.focus()
    }
  }, [wymiary.length])

  const lacznie = obliczLacznaIlosc(pozycja)
  const wartoscBazowa = obliczWartoscPozycji(pozycja)
  const wartosc = wartoscBazowa * (1 + (korekta || 0) / 100)

  async function zapiszNazwePozycji() {
    await axios.put(`/api/oferty/pozycje/${pozycja.id}`, { nazwa: nowaNazwaPoz })
    setEdytujNazwePoz(false)
    onZaktualizujPozycje(pozycja.id, wymiary, nowaNazwaPoz)
  }

  async function zapiszCene() {
    await axios.put(`/api/oferty/pozycje/${pozycja.id}`, {
      nazwa: nowaNazwaPoz,
      cena_jedn: parseFloat(nowaCena)
    })
    setEdytujCene(false)
    onZaktualizujPozycje(pozycja.id, wymiary, nowaNazwaPoz, parseFloat(nowaCena))
  }

  async function zapiszWymiar(dim) {
    const val = edytWartosci
    const nowyX = val.wymiar_x !== undefined ? parseFloat(val.wymiar_x) : parseFloat(dim.wymiar_x)
    const nowyY = val.wymiar_y !== undefined ? parseFloat(val.wymiar_y) : parseFloat(dim.wymiar_y)
    const nowaIlosc = val.ilosc !== undefined ? parseFloat(val.ilosc) : parseFloat(dim.ilosc)
    await axios.put(`/api/oferty/wymiary/${dim.id}`, {
      wymiar_x: pozycja.jednostka === 'm2' ? nowyX : null,
      wymiar_y: pozycja.jednostka === 'm2' ? nowyY : null,
      ilosc: nowaIlosc,
    })
    const nowe = wymiary.map(d => d.id === dim.id ? {
      ...d,
      wymiar_x: nowyX, wymiar_y: nowyY, ilosc: nowaIlosc
    } : d)
    setEdytowanyWymiar(null)
    setEdytWartosci({})
    onZaktualizujPozycje(pozycja.id, nowe)
  }

  async function dodajWymiar() {
    const payload = {
      wymiar_x: pozycja.jednostka === 'm2' ? parseFloat(nowyWymiar.wymiar_x) : null,
      wymiar_y: pozycja.jednostka === 'm2' ? parseFloat(nowyWymiar.wymiar_y) : null,
      ilosc: pozycja.jednostka === 'm2'
        ? round2(parseFloat(nowyWymiar.wymiar_x || 0) * parseFloat(nowyWymiar.wymiar_y || 0))
        : parseFloat(nowyWymiar.ilosc || 1),
      kolejnosc: wymiary.length + 1
    }
    const res = await axios.post(`/api/oferty/pozycje/${pozycja.id}/wymiary`, payload)
    const nowe = [...wymiary, res.data]
    setNowyWymiar({ wymiar_x: '', wymiar_y: '', ilosc: '1' })
    onZaktualizujPozycje(pozycja.id, nowe)
  }

  async function usunWymiar(dim_id) {
    await axios.delete(`/api/oferty/wymiary/${dim_id}`)
    const nowe = wymiary.filter(d => d.id !== dim_id)
    onZaktualizujPozycje(pozycja.id, nowe)
  }

  function formatIlosc() {
    if (pozycja.jednostka === 'm2') return `${lacznie.toFixed(2)} m²`
    if (pozycja.jednostka === 'mb') return `${lacznie.toFixed(2)} mb`
    return `${lacznie % 1 === 0 ? lacznie : lacznie.toFixed(2)} szt`
  }

  return (
    <>
      <tr
        style={{cursor:'pointer', background: rozwiniety ? '#2b2b2b' : undefined}}
        onClick={() => setRozwiniety(!rozwiniety)}
      >
        <td>
          <div style={{display:'flex', alignItems:'center', gap:6}}>
            <span style={{color:'#aaa', fontSize:12}}>{rozwiniety ? '▼' : '▶'}</span>
            {edytujNazwePoz ? (
              <span onClick={e => e.stopPropagation()} style={{display:'flex', gap:4}}>
                <input
                  value={nowaNazwaPoz}
                  onChange={e => setNowaNazwaPoz(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && zapiszNazwePozycji()}
                  style={{padding:'2px 6px', border:'1.5px solid #555', borderRadius:4,
                    fontSize:13, width:180, background:'#3a3a3a', color:'white'}}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm"
                  onClick={e => { e.stopPropagation(); zapiszNazwePozycji() }}>✓</button>
                <button className="btn btn-secondary btn-sm"
                  onClick={e => { e.stopPropagation(); setEdytujNazwePoz(false) }}>✕</button>
              </span>
            ) : (
              <>
                <span>{nowaNazwaPoz}</span>
                <button
                  onClick={e => { e.stopPropagation(); setEdytujNazwePoz(true) }}
                  style={{background:'none', border:'none', cursor:'pointer',
                    fontSize:12, color:'#ccc', padding:'0 2px'}}
                >✏️</button>
              </>
            )}
            <span style={{fontSize:11, color:'#bbb'}}>
              ({wymiary.length} {wymiary.length === 1 ? 'wiersz' : 'wierszy'})
            </span>
          </div>
        </td>
        <td style={{color:'#555', fontSize:13}}>{formatIlosc()}</td>
        <td onClick={e => e.stopPropagation()}>
          {edytujCene ? (
            <span style={{display:'flex', gap:4, alignItems:'center'}}>
              <input
                type="number" step="0.01"
                value={nowaCena}
                onChange={e => setNowaCena(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') zapiszCene(); if(e.key==='Escape') setEdytujCene(false) }}
                style={{width:80, padding:'2px 6px', border:'1.5px solid #555',
                  borderRadius:4, fontSize:13, background:'#3a3a3a', color:'white'}}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={zapiszCene}>✓</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEdytujCene(false)}>✕</button>
            </span>
          ) : (
            <span style={{display:'flex', gap:4, alignItems:'center', cursor:'pointer'}}
              onClick={() => setEdytujCene(true)}>
              {formatPLN(parseFloat(pozycja.cena_jedn))}
              <span style={{fontSize:11, color:'#ccc'}}>✏️</span>
            </span>
          )}
        </td>
        <td style={{textAlign:'right', fontWeight:600}}>{formatPLN(wartosc)}</td>
        <td>
          <button className="btn btn-danger btn-sm"
            onClick={e => { e.stopPropagation(); onUsunPozycje(pozycja.id) }}>✕</button>
        </td>
      </tr>

      {rozwiniety && (
        <tr>
          <td colSpan={5} style={{padding:0, background:'#2b2b2b'}}>
            <div style={{padding:'12px 16px 16px 32px'}}>
              {wymiary.length > 0 && (
                <table style={{width:'100%', marginBottom:12}}>
                  <thead>
                    <tr>
                      {pozycja.jednostka === 'm2' ? (
                        <>
                          <th style={{fontSize:12, color:'#aaa', fontWeight:500}}>Wym. X (m)</th>
                          <th style={{fontSize:12, color:'#aaa', fontWeight:500}}>Wym. Y (m)</th>
                          <th style={{fontSize:12, color:'#aaa', fontWeight:500}}>m²</th>
                        </>
                      ) : (
                        <th style={{fontSize:12, color:'#aaa', fontWeight:500}}>
                          Ilość ({pozycja.jednostka})
                        </th>
                      )}
                      <th style={{fontSize:12, color:'#aaa', fontWeight:500, textAlign:'right'}}>Wartość</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {wymiary.map(d => {
                      const il = pozycja.jednostka === 'm2'
                        ? round2(parseFloat(d.wymiar_x || 0) * parseFloat(d.wymiar_y || 0))
                        : parseFloat(d.ilosc || 0)
                      const wart = round2(round2(il * parseFloat(pozycja.cena_jedn || 0)) * (1 + (korekta || 0) / 100))
                      const czyEdytowany = edytowanyWymiar === d.id
                      return (
                        <tr key={d.id}>
                          {czyEdytowany ? (
                            <>
                              {pozycja.jednostka === 'm2' ? (
                                <>
                                  <td>
                                    <input type="number" step="0.01"
                                      defaultValue={parseFloat(d.wymiar_x)}
                                      onChange={e => setEdytWartosci(v => ({...v, wymiar_x: e.target.value}))}
                                      style={{width:65, padding:'3px 5px', border:'1.5px solid #555',
                                        borderRadius:4, fontSize:12, background:'#3a3a3a', color:'white'}}
                                    />
                                  </td>
                                  <td>
                                    <input type="number" step="0.01"
                                      defaultValue={parseFloat(d.wymiar_y)}
                                      onChange={e => setEdytWartosci(v => ({...v, wymiar_y: e.target.value}))}
                                      style={{width:65, padding:'3px 5px', border:'1.5px solid #555',
                                        borderRadius:4, fontSize:12, background:'#3a3a3a', color:'white'}}
                                    />
                                  </td>
                                  <td style={{fontSize:12, color:'#aaa'}}>
                                    {round2(parseFloat(edytWartosci.wymiar_x || d.wymiar_x) *
                                      parseFloat(edytWartosci.wymiar_y || d.wymiar_y)).toFixed(2)}
                                  </td>
                                </>
                              ) : (
                                <td>
                                  <input type="number" step="0.01"
                                    defaultValue={parseFloat(d.ilosc)}
                                    onChange={e => setEdytWartosci(v => ({...v, ilosc: e.target.value}))}
                                    style={{width:80, padding:'3px 5px', border:'1.5px solid #555',
                                      borderRadius:4, fontSize:12, background:'#3a3a3a', color:'white'}}
                                  />
                                </td>
                              )}
                              <td style={{textAlign:'right'}}>
                                <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
                                  <button className="btn btn-primary btn-sm"
                                    onClick={() => zapiszWymiar(d)}>✓</button>
                                  <button className="btn btn-secondary btn-sm"
                                    onClick={() => { setEdytowanyWymiar(null); setEdytWartosci({}) }}>✕</button>
                                </div>
                              </td>
                              <td></td>
                            </>
                          ) : (
                            <>
                              {pozycja.jednostka === 'm2' ? (
                                <>
                                  <td style={{fontSize:13}}>{parseFloat(d.wymiar_x)}</td>
                                  <td style={{fontSize:13}}>{parseFloat(d.wymiar_y)}</td>
                                  <td style={{fontSize:13}}>{il.toFixed(2)}</td>
                                </>
                              ) : (
                                <td style={{fontSize:13}}>{parseFloat(d.ilosc)}</td>
                              )}
                              <td style={{textAlign:'right', fontSize:13}}>{formatPLN(wart)}</td>
                              <td>
                                <div style={{display:'flex', gap:4}}>
                                  <button className="btn btn-secondary btn-sm"
                                    onClick={() => { setEdytowanyWymiar(d.id); setEdytWartosci({}) }}>✏️</button>
                                  <button className="btn btn-danger btn-sm"
                                    onClick={() => usunWymiar(d.id)}>✕</button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              <div style={{display:'flex', gap:8, alignItems:'flex-end'}}>
                {pozycja.jednostka === 'm2' ? (
                  <>
                    <div>
                                        <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Wym. X (m)</div>
                                        <input type="number" step="0.01"
                                          value={nowyWymiar.wymiar_x}
                                          ref={firstInputRef}
                                          onChange={e => setNowyWymiar({...nowyWymiar, wymiar_x: e.target.value})}
                                          onKeyDown={e => e.key === 'Enter' && dodajWymiar()}
                        style={{width:80, padding:'5px 8px', border:'1.5px solid #555', borderRadius:6, fontSize:13, background:'#3a3a3a', color:'white'}}
                      />
                    </div>
                    <div>
                      <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Wym. Y (m)</div>
                      <input type="number" step="0.01"
                        value={nowyWymiar.wymiar_y}
                        onChange={e => setNowyWymiar({...nowyWymiar, wymiar_y: e.target.value})}
                        onKeyDown={e => e.key === 'Enter' && dodajWymiar()}
                        style={{width:80, padding:'5px 8px', border:'1.5px solid #555', borderRadius:6, fontSize:13, background:'#3a3a3a', color:'white'}}
                      />
                    </div>
                    {nowyWymiar.wymiar_x && nowyWymiar.wymiar_y && (
                      <div style={{fontSize:13, color:'#c6bec4', alignSelf:'center', paddingBottom:2}}>
                        = {round2(parseFloat(nowyWymiar.wymiar_x) * parseFloat(nowyWymiar.wymiar_y)).toFixed(2)} m²
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Ilość ({pozycja.jednostka})</div>
                    <input type="number" step="1"
                      value={nowyWymiar.ilosc}
                      ref={firstInputRef}
                      onChange={e => setNowyWymiar({...nowyWymiar, ilosc: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && dodajWymiar()}
                      style={{width:80, padding:'5px 8px', border:'1.5px solid #555',
                        borderRadius:6, fontSize:13, background:'#3a3a3a', color:'white'}}
                    />
                  </div>
                )}
                <button className="btn btn-primary btn-sm" onClick={dodajWymiar}>
                  + Dodaj wiersz
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function TabelaMebla({ tabela, cennik, kortGlobalna = 0, onAktualizuj, onUsun }) {
  const [pozycje, setPozycje] = useState(tabela.pozycje || [])
  const [korekta, setKorekta] = useState(parseFloat(tabela.korekta_pct) || 0)
  const [vatPct, setVatPct] = useState(parseInt(tabela.vat_pct) || 23)
  const [modalPozycja, setModalPozycja] = useState(false)
  const [openNarzedzia, setOpenNarzedzia] = useState(false)
  const [edytujNazwe, setEdytujNazwe] = useState(false)
  const [nowaNazwa, setNowaNazwa] = useState(tabela.nazwa_mebla)
  const [form, setForm] = useState({
    cennik_id: '', nazwa: '', jednostka: 'szt', cena_jedn: '',
    wymiar_x: '', wymiar_y: '', ilosc: '1'
  })
  const [dodanoCount, setDodanoCount] = useState(0)
  const modalFirstInputRef = useRef(null)

  const sumaRaw = obliczSume(pozycje)
  const kortLokalna = parseFloat(korekta) || 0
  const kortGlob = parseFloat(kortGlobalna) || 0
  const kortLaczna = kortLokalna + kortGlob
  const razem = sumaRaw * (1 + kortLaczna / 100)

  async function zapiszNazweMebla() {
    await axios.put(`/api/oferty/tabele/${tabela.id}`, {
      nazwa_mebla: nowaNazwa,
      korekta_pct: korekta,
      razem_przed: sumaRaw,
      razem: razem
    })
    onAktualizuj(tabela.id, { nazwa_mebla: nowaNazwa })
    setEdytujNazwe(false)
  }

  async function kopiujTabele() {
    const nowaNazwaMebla = tabela.nazwa_mebla + ' WERSJA 2'
    const res = await axios.post(`/api/oferty/${tabela.oferta_id}/tabele`, {
      nazwa_mebla: nowaNazwaMebla,
      kolejnosc: 99
    })
    const nowaTabela = res.data
    for (const poz of pozycje) {
      const resPoz = await axios.post(`/api/oferty/tabele/${nowaTabela.id}/pozycje`, {
        cennik_id: poz.cennik_id,
        nazwa: poz.nazwa,
        jednostka: poz.jednostka,
        cena_jedn: poz.cena_jedn,
        kolejnosc: poz.kolejnosc
      })
      for (const dim of (poz.wymiary || [])) {
        await axios.post(`/api/oferty/pozycje/${resPoz.data.id}/wymiary`, {
          wymiar_x: dim.wymiar_x,
          wymiar_y: dim.wymiar_y,
          ilosc: dim.ilosc,
          kolejnosc: dim.kolejnosc
        })
      }
    }
    await axios.put(`/api/oferty/tabele/${nowaTabela.id}`, {
      nazwa_mebla: nowaNazwaMebla,
      korekta_pct: korekta,
      razem_przed: sumaRaw,
      razem: razem
    })
    window.location.reload()
  }

  async function zapiszKorekteDoDb(nowaKorekta, noweVat) {
    const kVat = noweVat !== undefined ? noweVat : vatPct
    const kKor = nowaKorekta !== undefined ? nowaKorekta : korekta
    const sumaR = obliczSume(pozycje)
    const r = sumaR * (1 + kKor / 100)
    await axios.put(`/api/oferty/tabele/${tabela.id}`, {
      nazwa_mebla: nowaNazwa,
      korekta_pct: kKor,
      razem_przed: sumaR,
      razem: r,
      vat_pct: kVat
    })
    if (kVat !== vatPct) setVatPct(kVat)
    if (kKor !== korekta) setKorekta(kKor)
    onAktualizuj(tabela.id, { korekta_pct: kKor, razem_przed: sumaR, razem: r, vat_pct: kVat })
  }

  async function odswiezPoMikrofonie() {
    try {
      const res = await axios.get(`/api/oferty/tabele-szczegoly/${tabela.id}`)
      if (res.data) setPozycje(res.data.pozycje || [])
    } catch(e) {}
    setTimeout(() => {
      const sumaR = obliczSume(pozycje)
      const r = sumaR * (1 + korekta / 100)
      axios.put(`/api/oferty/tabele/${tabela.id}`, {
        nazwa_mebla: nowaNazwa, korekta_pct: korekta,
        razem_przed: sumaR, razem: r
      })
      onAktualizuj(tabela.id, { razem_przed: sumaR, razem: r })
    }, 500)
  }

  function wybierzZCennika(id) {
    const poz = cennik.find(c => c.id === id)
    if (!poz) return
    setForm(f => ({
      ...f, cennik_id: id, nazwa: poz.nazwa,
      jednostka: poz.jednostka, cena_jedn: poz.cena,
      wymiar_x: '', wymiar_y: '', ilosc: '1'
    }))
  }

  async function przeliczTabele(nowePozycje) {
    const sumaR = obliczSume(nowePozycje)
    const r = sumaR * (1 + korekta / 100)
    await axios.put(`/api/oferty/tabele/${tabela.id}`, {
      nazwa_mebla: nowaNazwa, korekta_pct: korekta, razem_przed: sumaR, razem: r
    })
    onAktualizuj(tabela.id, { razem_przed: sumaR, razem: r })
  }

  async function dodajPozycje() {
    if (!form.nazwa) return alert('Wybierz pozycję z cennika lub wpisz nazwę')
    const istniejaca = znajdzIstniejaca(pozycje, form)
    const dimPayload = {
      wymiar_x: form.jednostka === 'm2' ? parseFloat(form.wymiar_x) : null,
      wymiar_y: form.jednostka === 'm2' ? parseFloat(form.wymiar_y) : null,
      ilosc: form.jednostka === 'm2'
        ? round2(parseFloat(form.wymiar_x || 0) * parseFloat(form.wymiar_y || 0))
        : parseFloat(form.ilosc || 1),
      kolejnosc: istniejaca ? (istniejaca.wymiary?.length || 0) + 1 : 1
    }
    let nowe
    if (istniejaca) {
      const res = await axios.post(`/api/oferty/pozycje/${istniejaca.id}/wymiary`, dimPayload)
      nowe = pozycje.map(p =>
        p.id === istniejaca.id ? { ...p, wymiary: [...(p.wymiary || []), res.data] } : p
      )
    } else {
      const resPoz = await axios.post(`/api/oferty/tabele/${tabela.id}/pozycje`, {
        cennik_id: form.cennik_id || null,
        nazwa: form.nazwa, jednostka: form.jednostka,
        cena_jedn: parseFloat(form.cena_jedn), kolejnosc: pozycje.length + 1
      })
      const resDim = await axios.post(`/api/oferty/pozycje/${resPoz.data.id}/wymiary`, dimPayload)
      nowe = [...pozycje, { ...resPoz.data, wymiary: [resDim.data] }]
    }
    setPozycje(nowe)
    await przeliczTabele(nowe)
    setDodanoCount(c => c + 1)
    // Wyczyść tylko wymiary - zostań w modalu
    setForm(f => ({ ...f, wymiar_x: '', wymiar_y: '', ilosc: '1' }))
    // Skocz na pierwsze pole wymiarów
    setTimeout(() => modalFirstInputRef.current?.focus(), 50)
  }

  function zamknijModal() {
    setModalPozycja(false)
    setDodanoCount(0)
    setForm({ cennik_id: '', nazwa: '', jednostka: 'szt', cena_jedn: '', wymiar_x: '', wymiar_y: '', ilosc: '1' })
  }

  async function usunPozycje(poz_id) {
    if (!confirm('Usunąć tę pozycję wraz z wymiarami?')) return
    await axios.delete(`/api/oferty/pozycje/${poz_id}`)
    const nowe = pozycje.filter(p => p.id !== poz_id)
    setPozycje(nowe)
    await przeliczTabele(nowe)
  }

  function zaktualizujWymiary(poz_id, noweWymiary, nowaNazwaPoz, nowaCenaPoz) {
    const nowe = pozycje.map(p =>
      p.id === poz_id ? {
        ...p,
        wymiary: noweWymiary,
        nazwa: nowaNazwaPoz !== undefined ? nowaNazwaPoz : p.nazwa,
        cena_jedn: nowaCenaPoz !== undefined ? nowaCenaPoz : p.cena_jedn
      } : p
    )
    setPozycje(nowe)
    przeliczTabele(nowe)
  }

  const m2Preview = form.jednostka === 'm2' && form.wymiar_x && form.wymiar_y
    ? round2(parseFloat(form.wymiar_x) * parseFloat(form.wymiar_y)) : null

  const czyIstnieje = znajdzIstniejaca(pozycje, form)

  return (
    <div className="card" style={{marginBottom: 16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {edytujNazwe ? (
            <>
              <input
                value={nowaNazwa}
                onChange={e => setNowaNazwa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && zapiszNazweMebla()}
                style={{padding:'4px 8px', border:'1.5px solid #555', borderRadius:6,
                  fontSize:15, fontWeight:600, width:220, background:'#3a3a3a', color:'white'}}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={zapiszNazweMebla}>✓</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEdytujNazwe(false)}>✕</button>
            </>
          ) : (
            <>
              <h2 style={{fontSize:16, fontWeight:600, color:'white'}}>{nowaNazwa}</h2>
              <button onClick={() => setEdytujNazwe(true)}
                style={{background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#aaa'}}>
                ✏️
              </button>
            </>
          )}
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <div className="btn-group" style={{position:'relative', display:'inline-block'}}>
            <button className="btn btn-secondary btn-sm" onClick={e => {e.stopPropagation(); setOpenNarzedzia(!openNarzedzia)}}>
              🛠️ Narzędzia {openNarzedzia ? '▲' : '▼'}
            </button>
            {openNarzedzia && (
              <div style={{position:'absolute', top:'100%', left:0, zIndex:100, background:'#2b2b2b',
                border:'1px solid #3a3a3a', borderRadius:8, padding:10, marginTop:4,
                display:'flex', flexDirection:'column', gap:8, minWidth:200}}>
                <MikrofonCiagly tabelaId={tabela.id} cennik={cennik} onDodano={odswiezPoMikrofonie} />
                <HistoriaDyktowania tabelaId={tabela.id} />
                <AudioUpload tabelaId={tabela.id} cennik={cennik} onDodano={odswiezPoMikrofonie} />
                <WklejTekst tabelaId={tabela.id} cennik={cennik} onDodano={odswiezPoMikrofonie} />
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={kopiujTabele}>⧉ Kopiuj</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setModalPozycja(true)}>+ Pozycja</button>
          <button className="btn btn-danger btn-sm" onClick={() => onUsun(tabela.id)}>Usuń tabelę</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nazwa</th>
            <th>Łącznie</th>
            <th>Cena jedn.</th>
            <th style={{textAlign:'right'}}>Wartość</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pozycje.length === 0 ? (
            <tr>
              <td colSpan={5} style={{color:'#bbb', textAlign:'center', padding:16}}>
                Brak pozycji — kliknij „+ Pozycja"
              </td>
            </tr>
          ) : (
            pozycje.map(p => (
              <PozycjaRow
                key={p.id}
                pozycja={p}
                korekta={kortLaczna}
                onUsunPozycje={usunPozycje}
                onZaktualizujPozycje={zaktualizujWymiary}
              />
            ))
          )}
        </tbody>
      </table>

      <div style={{marginTop:16, paddingTop:12, borderTop:'2px solid #3a3a3a',
        display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <span style={{fontSize:13, color:'#aaa'}}>Korekta %</span>
          <input type="number" step="1" value={korekta}
            onChange={e => setKorekta(parseFloat(e.target.value) || 0)}
            onBlur={() => zapiszKorekteDoDb(korekta)}
            style={{width:80, padding:'4px 8px', border:'1.5px solid #555',
              borderRadius:6, fontSize:14, textAlign:'center', background:'#3a3a3a', color:'white'}}
          />
          {korekta !== 0 && (
            <span style={{fontSize:13, color: korekta < 0 ? '#ef5350' : '#81c784'}}>
              {korekta > 0 ? '+' : ''}{formatPLN(sumaRaw * korekta / 100)}
            </span>
          )}
          <span style={{fontSize:13, color:'#aaa', marginLeft:8}}>VAT</span>
          <select value={vatPct}
            onChange={e => { const v = parseInt(e.target.value); setVatPct(v); zapiszKorekteDoDb(korekta, v); }}
            style={{padding:'4px 8px', border:'1.5px solid #555', borderRadius:6,
              fontSize:13, background:'#3a3a3a', color:'white', cursor:'pointer'}}>
            <option value={8}>8%</option>
            <option value={23}>23%</option>
          </select>
        </div>
        <div style={{textAlign:'right'}}>
          {kortLaczna !== 0 && (
            <div style={{fontSize:12, color:'#aaa', marginBottom:2}}>
              Przed: {formatPLN(sumaRaw)}
              {kortGlob !== 0 && (
                <span style={{marginLeft:8, color:'#c6bec4'}}>
                  (glob: {kortGlob > 0 ? '+' : ''}{kortGlob}%)
                </span>
              )}
            </div>
          )}
          <div style={{fontSize:18, fontWeight:700, color:'#c6bec4'}}>
            RAZEM: {formatPLN(razem)}
          </div>
        </div>
      </div>

      {modalPozycja && (
        <div className="modal-overlay" onClick={zamknijModal}>
          <div className="modal" style={{maxWidth:480}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h2 style={{margin:0}}>Dodaj pozycję</h2>
              {dodanoCount > 0 && (
                <span style={{fontSize:13, color:'#81c784', fontWeight:500}}>
                  ✓ Dodano: {dodanoCount} {dodanoCount === 1 ? 'wiersz' : 'wierszy'}
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Wybierz z cennika</label>
              <select value={form.cennik_id} onChange={e => wybierzZCennika(e.target.value)}>
                <option value="">— wybierz pozycję —</option>
                {cennik.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nazwa} ({c.cena} zł / {c.jednostka})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Nazwa</label>
              <input value={form.nazwa} onChange={e => setForm({...form, nazwa: e.target.value})} />
            </div>
            <div style={{display:'flex', gap:12}}>
              <div className="form-group" style={{flex:1}}>
                <label>Jednostka</label>
                <select value={form.jednostka}
                  onChange={e => setForm({...form, jednostka: e.target.value, wymiar_x:'', wymiar_y:'', ilosc:'1'})}>
                  <option value="szt">szt</option>
                  <option value="m2">m2</option>
                  <option value="mb">mb</option>
                </select>
              </div>
              <div className="form-group" style={{flex:1}}>
                <label>Cena jedn. (zł)</label>
                <input type="number" step="0.01" value={form.cena_jedn}
                  onChange={e => setForm({...form, cena_jedn: e.target.value})} />
              </div>
            </div>
            <div style={{background:'#2b2b2b', border:'1px solid #3a3a3a',
              borderRadius:8, padding:'12px 14px', marginBottom:16}}>
              <div style={{fontSize:12, color:'#c6bec4', fontWeight:600, marginBottom:10}}>
                {form.jednostka === 'm2' ? 'Wymiary' : 'Ilość'}
                {czyIstnieje && (
                  <span style={{marginLeft:8, fontSize:11, fontWeight:400,
                    background:'#5f2f4d', color:'white', padding:'1px 8px', borderRadius:10}}>
                    doda do istniejącej pozycji
                  </span>
                )}
              </div>
              {form.jednostka === 'm2' ? (
                <div style={{display:'flex', gap:10, alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Wym. X (m)</div>
                    <input type="number" step="0.01" value={form.wymiar_x}
                      ref={modalFirstInputRef}
                      onChange={e => setForm({...form, wymiar_x: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && dodajPozycje()}
                      style={{width:90, padding:'6px 8px', border:'1.5px solid #555',
                        borderRadius:6, fontSize:14, background:'#3a3a3a', color:'white'}} />
                  </div>
                  <div style={{fontSize:18, color:'#666', marginTop:16}}>×</div>
                  <div>
                    <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Wym. Y (m)</div>
                    <input type="number" step="0.01" value={form.wymiar_y}
                      onChange={e => setForm({...form, wymiar_y: e.target.value})}
                      onKeyDown={e => e.key === 'Enter' && dodajPozycje()}
                      style={{width:90, padding:'6px 8px', border:'1.5px solid #555',
                        borderRadius:6, fontSize:14, background:'#3a3a3a', color:'white'}} />
                  </div>
                  {m2Preview !== null && (
                    <div style={{marginTop:16, fontSize:14, color:'#c6bec4', fontWeight:600}}>
                      = {m2Preview.toFixed(2)} m²
                      {form.cena_jedn && (
                        <div style={{fontSize:12, color:'#aaa', fontWeight:400}}>
                          {formatPLN(round2(m2Preview * parseFloat(form.cena_jedn)))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{fontSize:11, color:'#aaa', marginBottom:3}}>Ilość ({form.jednostka})</div>
                  <input type="number" step="1" value={form.ilosc}
                    ref={modalFirstInputRef}
                    onChange={e => setForm({...form, ilosc: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && dodajPozycje()}
                    style={{width:100, padding:'6px 8px', border:'1.5px solid #555',
                      borderRadius:6, fontSize:14, background:'#3a3a3a', color:'white'}} />
                  {form.cena_jedn && form.ilosc && (
                    <div style={{fontSize:12, color:'#aaa', marginTop:4}}>
                      = {formatPLN(parseFloat(form.ilosc) * parseFloat(form.cena_jedn))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={zamknijModal}>Zamknij</button>
              <button className="btn btn-primary" onClick={dodajPozycje}>+ Dodaj wiersz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
