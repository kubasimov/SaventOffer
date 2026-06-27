import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import axios from 'axios'

const GOOGLE_CLIENT_ID = '753577956588-022i7jbafn0045e560tbqi10alam3lt9.apps.googleusercontent.com'

export default function Login() {
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [blad, setBlad] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Załaduj Google Identity Services
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse
      })
      window.google.accounts.id.renderButton(
        document.getElementById('google-btn'),
        { theme: 'outline', size: 'large', width: 308, text: 'signin_with', locale: 'pl' }
      )
    }
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  async function handleGoogleResponse(response) {
    setBlad(null)
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/google', { credential: response.credential })
      const { token, user } = res.data
      localStorage.setItem('savento_token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Odśwież stronę żeby AuthContext pobrał usera
      window.location.href = '/'
    } catch (err) {
      setBlad(err.response?.data?.error || 'Błąd logowania przez Google')
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBlad(null)
    setLoading(true)
    try {
      await login(email, haslo)
      navigate('/')
    } catch (err) {
      setBlad(err.response?.data?.error || 'Błąd logowania')
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
          <div style={{fontSize:28, fontWeight:700, color:'#5a2d6e', letterSpacing:1}}>
            SaventOffer
          </div>
          <div style={{fontSize:14, color:'#999', marginTop:4}}>Zaloguj się aby kontynuować</div>
        </div>

        {/* Przycisk Google */}
        <div style={{display:'flex', justifyContent:'center', marginBottom:20}}>
          <div id="google-btn"></div>
        </div>

        <div style={{
          display:'flex', alignItems:'center', gap:12, marginBottom:20
        }}>
          <div style={{flex:1, height:1, background:'#eee'}}></div>
          <span style={{fontSize:12, color:'#aaa'}}>lub</span>
          <div style={{flex:1, height:1, background:'#eee'}}></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@savento.pl"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Hasło</label>
            <input
              type="password"
              value={haslo}
              onChange={e => setHaslo(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          {blad && (
            <div style={{
              color:'#e53935', fontSize:13, marginBottom:16,
              padding:'8px 12px', background:'#fff5f5', borderRadius:6
            }}>
              {blad}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{width:'100%', padding:'12px', fontSize:15, marginTop:4}}
            disabled={loading}
          >
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  )
}
