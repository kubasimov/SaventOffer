import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [blad, setBlad] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

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

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@savento.pl"
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
