import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../AuthContext'
import Klienci from '../pages/Klienci'
import axios from 'axios'

vi.mock('axios')

function renderPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Klienci />
      </AuthProvider>
    </BrowserRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('savento_token', 'test')
  axios.get.mockResolvedValue({ data: { email: 'admin@savento.pl', rola: 'admin' } })
  axios.post.mockRejectedValue(new Error('fail'))
})

describe('Klienci page', () => {
  it('pokazuje pusta liste', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/klienci')) return Promise.resolve({ data: { rows: [], total: 0, page: 1, pages: 1 } })
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Brak klientów — dodaj pierwszego')).toBeInTheDocument()
    })
  })

  it('pokazuje naglowek i przycisk dodawania', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/klienci')) return Promise.resolve({ data: { rows: [], total: 0, page: 1, pages: 1 } })
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Klienci')).toBeInTheDocument()
      expect(screen.getByText('+ Dodaj klienta')).toBeInTheDocument()
    })
  })

  it('pokazuje liste klientow', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/klienci')) return Promise.resolve({ data: {
        rows: [
          { id: '1', nazwa: 'Jan Kowalski', kontakt: 'Anna', email: 'jan@test.pl', telefon: '600700800' },
          { id: '2', nazwa: 'Firma XYZ', kontakt: '', email: '', telefon: '' },
        ],
        total: 2, page: 1, pages: 1
      }})
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument()
      expect(screen.getByText('Firma XYZ')).toBeInTheDocument()
      expect(screen.getByText('Anna')).toBeInTheDocument()
    })
  })

  it('otwiera modal dodawania klienta', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/klienci')) return Promise.resolve({ data: { rows: [], total: 0, page: 1, pages: 1 } })
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Klienci')).toBeInTheDocument())
    await userEvent.click(screen.getByText('+ Dodaj klienta'))
    expect(screen.getByText('Nowy klient')).toBeInTheDocument()
  })

  it('pokazuje paginacje', async () => {
    const klienci = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), nazwa: `Klient ${i + 1}`, kontakt: '', email: '', telefon: ''
    }))
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/klienci')) return Promise.resolve({ data: {
        rows: klienci.slice(0, 20), total: 45, page: 1, pages: 3
      }})
      return Promise.resolve({ data: null })
    })
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Strona 1 z 3')).toBeInTheDocument()
    })
  })
})