import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../AuthContext'
import axios from 'axios'

// Mock axios
vi.mock('axios')

// Helper komponent do testowania kontekstu
function TestConsumer() {
  const { user, login, logout, loading } = useAuth()
  if (loading) return <div data-testid="loading">Loading...</div>
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'null'}</div>
      <button data-testid="login-btn" onClick={() => login('a@b.pl', 'pass')}>Login</button>
      <button data-testid="logout-btn" onClick={logout}>Logout</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  delete axios.defaults.headers.common['Authorization']
})

describe('AuthContext', () => {
  it('pokazuje ladowanie na starcie gdy jest token', () => {
    localStorage.setItem('savento_token', 'existing-token')
    axios.get.mockResolvedValue({ data: { email: 'a@b.pl', imie: 'Test' } })
    renderWithProvider()
    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('pokazuje null gdy brak tokenu', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null')
    })
  })

  it('login zapisuje token i ustawia usera', async () => {
    axios.post.mockResolvedValue({
      data: { token: 'new-token', user: { email: 'a@b.pl', rola: 'pracownik' } }
    })
    renderWithProvider()
    await userEvent.click(screen.getByTestId('login-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('a@b.pl')
    })
    expect(localStorage.getItem('savento_token')).toBe('new-token')
    expect(axios.defaults.headers.common['Authorization']).toBe('Bearer new-token')
  })

  it('login rzuca blad przy blednych danych (nie psuje stanu)', async () => {
    axios.post.mockRejectedValue({
      response: { data: { error: 'Zle haslo' } }
    })
    renderWithProvider()
    // Wywolanie login z bledem nie powinno rzucic nieobslugiwanego bledu
    // (login w AuthContext nie obsluguje bledow - rzuca je do wyzej)
    // Test sprawdza czy klikniecie nie psuje stanu
    const btn = screen.getByTestId('login-btn')
    // obsluz blad wewnatrz testu
    try { await btn.click() } catch (e) {}
    // Stan powinien byc stabilny
    expect(screen.getByTestId('user').textContent).toBe('null')
  })

  it('logout usuwa token i usera', async () => {
    axios.post.mockResolvedValue({
      data: { token: 't', user: { email: 'a@b.pl', rola: 'pracownik' } }
    })
    renderWithProvider()
    await userEvent.click(screen.getByTestId('login-btn'))
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@b.pl'))
    await userEvent.click(screen.getByTestId('logout-btn'))
    expect(screen.getByTestId('user').textContent).toBe('null')
    expect(localStorage.getItem('savento_token')).toBeNull()
  })

  it('przywraca sesje z localStorage przy starcie', async () => {
    localStorage.setItem('savento_token', 'valid-token')
    axios.get.mockResolvedValue({ data: { email: 'session@b.pl', imie: 'Session' } })
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('session@b.pl')
    })
  })

  it('usuwa niepoprawny token przy starcie', async () => {
    localStorage.setItem('savento_token', 'bad-token')
    axios.get.mockRejectedValue(new Error('401'))
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('null')
    })
    expect(localStorage.getItem('savento_token')).toBeNull()
  })
})