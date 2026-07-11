import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import axios from 'axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [blad, setBlad] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tryb, setTryb] = useState('login') // login | register | prosba
  const [imieNazwisko, setImieNazwisko] = useState('')
  const [komunikat, setKomunikat] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setBlad(null)
    setKomunikat(null)
    setLoading(true)
    try {
      if (tryb === 'register') {
        await axios.post('/api/auth/rejestracja', { email, haslo, imie_nazwisko: imieNazwisko })
        setKomunikat('Konto utworzone. Poczekaj na akceptację administratora.')
        setTryb('login')
      } else if (tryb === 'prosba') {
        await axios.post('/api/auth/prosba-haslo', { email })
        setKomunikat('Wiadomość wysłana do administratora.')
        setTryb('login')
      } else {
        await login(email, haslo)
        navigate('/')
      }
    } catch (err) {
      setBlad(err.response?.data?.error || 'Błąd')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#f5f5f5'
    }}>
      <div style={{
        background:'white', borderRadius:16, padding:'40px 36px',
        boxShadow:'0 4px 24px rgba(0,0,0,0.10)', width:'100%', maxWidth:380
      }}>
        <div style={{textAlign:'center', marginBottom:32}}>
          <div style={{fontSize:28, fontWeight:700, color:'#582A48', letterSpacing:1}}>
            SaventOffer
          </div>
          <div style={{fontSize:14, color:'#999', marginTop:4}}>Zaloguj się aby kontynuować</div>
        </div>

        <form onSubmit={handleSubmit}>
          {tryb === 'register' && (
            <div className="form-group">
              <label>Imię i nazwisko</label>
              <input value={imieNazwisko} onChange={e => setImieNazwisko(e.target.value)} placeholder="Jan Kowalski" required autoFocus />
            </div>
          )}
          <div className="form-group">
            <label>{tryb === 'prosba' ? 'Twój email' : 'Email'}</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@savento.pl" autoComplete="username"
              required autoFocus={tryb !== 'register'}
            />
          </div>
          {tryb !== 'prosba' && (
            <div className="form-group">
              <label>Hasło</label>
              <input type="password" value={haslo} onChange={e => setHaslo(e.target.value)}
                autoComplete={tryb === 'register' ? 'new-password' : 'current-password'}
                placeholder={tryb === 'register' ? 'min. 10 znaków, duża/mała litera, cyfra, znak spec.' : '••••••••'} required
              />
            </div>
          )}

          {blad && <div style={{color:'#e53935', fontSize:13, marginBottom:16, padding:'8px 12px', background:'#fff5f5', borderRadius:6}}>{blad}</div>}
          {komunikat && <div style={{color:'#2e7d32', fontSize:13, marginBottom:16, padding:'8px 12px', background:'#f0fff4', borderRadius:6}}>{komunikat}</div>}

          <button type="submit" className="btn btn-primary" style={{width:'100%', padding:'12px', fontSize:15, marginTop:4}} disabled={loading}>
            {loading ? 'Proszę czekać...' : tryb === 'register' ? 'Utwórz konto' : tryb === 'prosba' ? 'Wyślij prośbę' : 'Zaloguj się'}
          </button>

          <div style={{marginTop:16, display:'flex', flexDirection:'column', gap:8, textAlign:'center', fontSize:13}}>
            {tryb === 'login' && (
              <>
                <a href="#" onClick={e => { e.preventDefault(); setTryb('register'); setBlad(null); setKomunikat(null) }} style={{color:'#5f2f4d'}}>Nie masz konta? Zarejestruj się</a>
                <a href="#" onClick={e => { e.preventDefault(); setTryb('prosba'); setBlad(null); setKomunikat(null) }} style={{color:'#888'}}>Poproś o dostęp</a>
              </>
            )}
            {(tryb === 'register' || tryb === 'prosba') && (
              <a href="#" onClick={e => { e.preventDefault(); setTryb('login'); setBlad(null); setKomunikat(null) }} style={{color:'#5f2f4d'}}>← Powrót do logowania</a>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}