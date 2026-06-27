import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../AuthContext'
import Login from '../pages/Login'
import axios from 'axios'

vi.mock('axios')

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  delete axios.defaults.headers.common['Authorization']
  // Ukryj bledy konsoli z Google Identity Services
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Login page', () => {
  it('renderuje formularz logowania', () => {
    renderLogin()
    expect(screen.getByPlaceholderText('email@savento.pl')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByText('Zaloguj się', { selector: 'button' })).toBeInTheDocument()
    expect(screen.getByText('SaventOffer')).toBeInTheDocument()
  })

  it('renderuje przycisk Google', () => {
    renderLogin()
    expect(screen.getByText('lub')).toBeInTheDocument()
  })

  it('loguje sie przez email/haslo i nawiguje do /', async () => {
    axios.post.mockResolvedValue({
      data: { token: 't', user: { email: 'a@b.pl' } }
    })
    // Potrzebny mock dla /api/auth/me (wywolywany przez AuthProvider)
    axios.get.mockResolvedValue({ data: { email: 'a@b.pl' } })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('email@savento.pl'), 'admin@savento.pl')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'admin12345')
    await userEvent.click(screen.getByText('Zaloguj się'))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
    expect(localStorage.getItem('savento_token')).toBe('t')
  })

  it('pokazuje blad przy blednym logowaniu', async () => {
    axios.post.mockRejectedValue({
      response: { data: { error: 'Nieprawidlowy email lub haslo' } }
    })
    axios.get.mockResolvedValue({ data: null })
    renderLogin()
    await userEvent.type(screen.getByPlaceholderText('email@savento.pl'), 'zly@email.pl')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'zlehaslo')
    await userEvent.click(screen.getByText('Zaloguj się'))
    await waitFor(() => {
      expect(screen.getByText('Nieprawidlowy email lub haslo')).toBeInTheDocument()
    })
  })

  it('wymaga wypelnienia email i hasla', async () => {
    renderLogin()
    const btn = screen.getByText('Zaloguj się')
    // Przycisk nie powinien byc disabled (required dziala natywnie w przegladarce)
    expect(btn).toBeInTheDocument()
    // Sprawdz czy form ma atrybuty required
    expect(screen.getByPlaceholderText('email@savento.pl')).toBeRequired()
    expect(screen.getByPlaceholderText('••••••••')).toBeRequired()
  })
})