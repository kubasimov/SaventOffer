import { useState, useEffect } from 'react'
import axios from 'axios'
import SidebarAkordeon, { AkordeonItem } from '../components/SidebarAkordeon'

export default function Klienci() {
  const [klienci, setKlienci] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [modal, setModal] = useState(false)
  const [edytowany, setEdytowany] = useState(null)
  const [rozwinietaId, setRozwinietaId] = useState(null)
  const [form, setForm] = useState({ nazwa: '', adres: '', kontakt: '', email: '', telefon: '', uwagi: '' })
  const [sortBy, setSortBy] = useState('nazwa')
  const [sortOrder, setSortOrder] = useState('asc')
  const [szukaj, setSzukaj] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => { pobierzKlientow() }, [page, sortBy, sortOrder, q])

  async function pobierzKlientow() {
    const res = await axios.get(`/api/klienci?page=${page}&limit=20&sort_by=${sortBy}&sort_order=${sortOrder}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
    setKlienci(res.data.rows)
    setTotal(res.data.total)
    setPages(res.data.pages)
    setLoading(false)
  }

  function otworzModal(klient = null) {
    if (klient) {
      setEdytowany(klient)
      setForm({
        nazwa: klient.nazwa || '',
        adres: klient.adres || '',
        kontakt: klient.kontakt || '',
        email: klient.email || '',
        telefon: klient.telefon || '',
        uwagi: klient.uwagi || ''
      })
    } else {
      setEdytowany(null)
      setForm({ nazwa: '', adres: '', kontakt: '', email: '', telefon: '', uwagi: '' })
    }
    setModal(true)
  }

  async function zapiszKlienta() {
    if (!form.nazwa.trim()) return alert('Nazwa klienta jest wymagana')
    if (edytowany) {
      await axios.put(`/api/klienci/${edytowany.id}`, form)
    } else {
      await axios.post('/api/klienci', form)
    }
    setModal(false)
    pobierzKlientow()
  }

  async function usunKlienta(klient) {
    if (!confirm(`Usunąć klienta "${klient.nazwa}"?`)) return
    try {
      await axios.delete(`/api/klienci/${klient.id}`)
      pobierzKlientow()
    } catch (err) {
      alert(err.response?.data?.error || 'Błąd usuwania')
    }
  }

  return (
    <div style={{display:'flex', gap:20}}>
      {/* Sidebar */}
      <div className="sidebar-desktop" style={{width:220, minWidth:220}}>
        <div className="card" style={{padding:0, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.25)', borderRadius:12}}>
          <SidebarAkordeon title="Sortowanie" icon="🔤" domyslnieOtwarty>
            <AkordeonItem label="Nazwa A-Z" ikona="A" aktywny={sortBy === 'nazwa' && sortOrder === 'asc'}
              onClick={() => { setSortBy('nazwa'); setSortOrder('asc'); setPage(1) }} />
            <AkordeonItem label="Nazwa Z-A" ikona="Z" aktywny={sortBy === 'nazwa' && sortOrder === 'desc'}
              onClick={() => { setSortBy('nazwa'); setSortOrder('desc'); setPage(1) }} />
            <AkordeonItem label="Najnowsi" ikona="🆕" aktywny={sortBy === 'data' && sortOrder === 'desc'}
              onClick={() => { setSortBy('data'); setSortOrder('desc'); setPage(1) }} />
            <AkordeonItem label="Najstarsi" ikona="📅" aktywny={sortBy === 'data' && sortOrder === 'asc'}
              onClick={() => { setSortBy('data'); setSortOrder('asc'); setPage(1) }} />
          </SidebarAkordeon>
        </div>
      </div>
      {/* Tresc */}
      <div style={{flex:1}}>
      <div className="page-header">
        <div style={{display:'flex', alignItems:'center', gap:12, flex:1}}>
          <h1 style={{margin:0}}>Klienci</h1>
          <input value={szukaj} onChange={e => setSzukaj(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setQ(szukaj); setPage(1) } }}
            placeholder="🔍 Szukaj po nazwie, emailu lub telefonie..."
            style={{flex:1, maxWidth:320, padding:'6px 10px', borderRadius:6, border:'1px solid #444', fontSize:13, background:'#2b2b2b', color:'white'}} />
          {(q || szukaj) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSzukaj(''); setQ(''); setPage(1) }}>✕</button>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => otworzModal()}>+ Dodaj klienta</button>
      </div>
      <div className="card">
        {loading ? (
          <div className="empty-state" style={{color:'#aaa'}}>
            <div style={{fontSize:32, marginBottom:8}}>⏳</div>
            <div>Ładowanie klientów...</div>
          </div>
        ) : klienci.length === 0 ? (
          <div className="empty-state">Brak klientów — dodaj pierwszego</div>
        ) : (
          <>
          <table className="mobile-card-table">
            <thead>
              <tr>
                <th style={{cursor:'pointer'}} onClick={() => { setSortBy('nazwa'); setSortOrder(sortBy === 'nazwa' && sortOrder === 'asc' ? 'desc' : 'asc'); setPage(1) }}>
                  Nazwa {sortBy === 'nazwa' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Kontakt</th>
                <th>Email</th>
                <th>Telefon</th>
                <th style={{cursor:'pointer'}} onClick={() => { setSortBy('data'); setSortOrder(sortBy === 'data' && sortOrder === 'desc' ? 'asc' : 'desc'); setPage(1) }}>
                  Data {sortBy === 'data' ? (sortOrder === 'desc' ? '▼' : '▲') : ''}
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {klienci.map(k => (
                <tr key={k.id}
                  className={rozwinietaId === k.id ? 'expanded' : ''}
                  onClick={() => setRozwinietaId(rozwinietaId === k.id ? null : k.id)}>
                  <td><strong>{k.nazwa}</strong></td>
                  <td className="mobile-hide">{k.kontakt || '—'}</td>
                  <td className="mobile-hide">{k.email || '—'}</td>
                  <td className="mobile-hide">{k.telefon || '—'}</td>
                  <td className="mobile-hide">{k.utworzony ? new Date(k.utworzony).toLocaleDateString('pl-PL') : '—'}</td>
                  <td className="mobile-hide" style={{textAlign:'right'}}
                    onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={() => otworzModal(k)}>Edytuj</button>
                    {' '}
                    <button className="btn btn-danger btn-sm"
                      onClick={() => usunKlienta(k)}>Usuń</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Paginacja */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', borderTop:'1px solid #3a3a3a'}}>
            <span style={{fontSize:13, color:'#aaa'}}>
              {total} {total === 1 ? 'klient' : (total >= 2 && total <= 4 ? 'klientów' : 'klientów')}
            </span>
            <div style={{display:'flex', gap:6, alignItems:'center'}}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                ← Poprzednia
              </button>
              <span style={{fontSize:13, color:'#aaa', padding:'0 8px'}}>Strona {page} z {pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                Następna →
              </button>
            </div>
          </div>
          </>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{edytowany ? 'Edytuj klienta' : 'Nowy klient'}</h2>
            <div className="form-group">
              <label>Nazwa firmy / klienta *</label>
              <input value={form.nazwa} onChange={e => setForm({...form, nazwa: e.target.value})} placeholder="np. Jan Kowalski" />
            </div>
            <div className="form-group">
              <label>Adres</label>
              <input value={form.adres} onChange={e => setForm({...form, adres: e.target.value})} placeholder="np. ul. Kwiatowa 15, 00-001 Warszawa" />
            </div>
            <div className="form-group">
              <label>Osoba kontaktowa</label>
              <input value={form.kontakt} onChange={e => setForm({...form, kontakt: e.target.value})} placeholder="np. Anna Nowak" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="np. jan@example.com" />
            </div>
            <div className="form-group">
              <label>Telefon</label>
              <input value={form.telefon} onChange={e => setForm({...form, telefon: e.target.value})} placeholder="np. 600 123 456" />
            </div>
            <div className="form-group">
              <label>Uwagi</label>
              <input value={form.uwagi} onChange={e => setForm({...form, uwagi: e.target.value})} placeholder="opcjonalne" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={zapiszKlienta}>Zapisz</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}