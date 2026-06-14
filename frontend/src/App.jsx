import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Cennik from './pages/Cennik'
import Klienci from './pages/Klienci'
import Oferty from './pages/Oferty'
import EdytorOferty from './pages/EdytorOferty'
import Import from './pages/Import'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">SaventOffer</div>
          <div className="navbar-links">
            <NavLink to="/" end>Oferty</NavLink>
            <NavLink to="/klienci">Klienci</NavLink>
            <NavLink to="/cennik">Cennik</NavLink>
            <NavLink to="/import">Import</NavLink>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Oferty />} />
            <Route path="/oferty/:id" element={<EdytorOferty />} />
            <Route path="/klienci" element={<Klienci />} />
            <Route path="/cennik" element={<Cennik />} />
            <Route path="/import" element={<Import />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
