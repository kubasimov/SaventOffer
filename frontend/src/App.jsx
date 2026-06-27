import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Cennik from './pages/Cennik'
import Klienci from './pages/Klienci'
import Oferty from './pages/Oferty'
import EdytorOferty from './pages/EdytorOferty'
import Import from './pages/Import'
import Login from './pages/Login'
import Uzytkownicy from './pages/Uzytkownicy'
import Ustawienia from './pages/Ustawienia'
import Profil from './pages/Profil'
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
  const isAdmin = user?.rola === 'admin'
  return (
    <Router>
      <div className="app">
        {user && (
        <nav className="navbar">
          <div className="navbar-brand">SaventOffer</div>
          <div className="navbar-links">
            <NavLink to="/" end>Oferty</NavLink>
            {isAdmin && <NavLink to="/klienci">Klienci</NavLink>}
            {isAdmin && <NavLink to="/cennik">Cennik</NavLink>}
            {isAdmin && <NavLink to="/import">Import</NavLink>}
            {isAdmin && <NavLink to="/uzytkownicy">Użytkownicy</NavLink>}
            {isAdmin && <NavLink to="/ustawienia">Ustawienia</NavLink>}
            <div style={{display:'flex', alignItems:'center', gap:12, marginLeft:'auto'}}>
              <NavLink to="/profil" style={{fontSize:13, color:'rgba(255,255,255,0.7)',
                textDecoration:'none', padding:'5px 8px', borderRadius:6,
                background:'rgba(255,255,255,0.1)'}}>
                {user.imie || user.email}
              </NavLink>
              <button
                onClick={logout}
                style={{background:'rgba(255,255,255,0.15)', border:'none',
                  color:'white', padding:'5px 12px', borderRadius:6,
                  cursor:'pointer', fontSize:13}}
              >
                Wyloguj
              </button>
            </div>
          </div>
        </nav>
        )}
        <main className="main-content">
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<Oferty />} />
              {isAdmin && <Route path="/oferty/:id" element={<EdytorOferty />} />}
              {isAdmin && <Route path="/klienci" element={<Klienci />} />}
              {isAdmin && <Route path="/cennik" element={<Cennik />} />}
              {isAdmin && <Route path="/import" element={<Import />} />}
              {isAdmin && <Route path="/uzytkownicy" element={<Uzytkownicy />} />}
              {isAdmin && <Route path="/ustawienia" element={<Ustawienia />} />}
              <Route path="/profil" element={<Profil />} />
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
