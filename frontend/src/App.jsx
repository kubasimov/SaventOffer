import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Cennik from './pages/Cennik'
import Klienci from './pages/Klienci'
import Oferty from './pages/Oferty'
import EdytorOferty from './pages/EdytorOferty'
import Import from './pages/Import'
import Login from './pages/Login'
import Uzytkownicy from './pages/Uzytkownicy'
import { AuthProvider, useAuth } from './AuthContext'
import './App.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',color:'#5a2d6e',fontSize:16}}>
      Ładowanie...
    </div>
  )
  if (!user) return <Login />
  return children
}

function AppInner() {
  const { user, logout } = useAuth()
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">SaventOffer</div>
          <div className="navbar-links">
            <NavLink to="/" end>Oferty</NavLink>
            <NavLink to="/klienci">Klienci</NavLink>
            <NavLink to="/cennik">Cennik</NavLink>
            <NavLink to="/import">Import</NavLink>
            <NavLink to="/uzytkownicy">Użytkownicy</NavLink>
            {user && (
              <div style={{display:'flex', alignItems:'center', gap:12, marginLeft:8}}>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.7)'}}>
                  {user.imie || user.email}
                </span>
                <button
                  onClick={logout}
                  style={{background:'rgba(255,255,255,0.15)', border:'none',
                    color:'white', padding:'5px 12px', borderRadius:6,
                    cursor:'pointer', fontSize:13}}
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>
        </nav>
        <main className="main-content">
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Oferty />} />
              <Route path="/oferty/:id" element={<EdytorOferty />} />
              <Route path="/klienci" element={<Klienci />} />
              <Route path="/cennik" element={<Cennik />} />
              <Route path="/import" element={<Import />} />
              <Route path="/uzytkownicy" element={<Uzytkownicy />} />
            </Routes>
          </ProtectedRoute>
        </main>
      </div>
    </Router>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
