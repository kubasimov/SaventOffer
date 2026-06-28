import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../AuthContext'
import Oferty from '../pages/Oferty'
import axios from 'axios'

vi.mock('axios')
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

function renderPage() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Oferty />
      </AuthProvider>
    </BrowserRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.setItem('savento_token', 'test')
  // Auth /me
  axios.get.mockImplementation((url) => {
    if (url === '/api/auth/me') return Promise.resolve({ data: { email: 'admin@savento.pl', rola: 'admin' } })

    if (url.includes('/api/oferty') && !url.includes('/api/oferty/')) {
      return Promise.resolve({ data: {
        rows: [
          { id: '1', numer: 'OFERTA_01', klient_nazwa: 'Jan', data_oferty: '2026-06-01', status: 'szkic', nazwa: '' },
          { id: '2', numer: 'OFERTA_02', klient_nazwa: 'Anna', data_oferty: '2026-06-15', status: 'wyslana', nazwa: '' },
        ],
        total: 2, page: 1, pages: 1
      }})
    }
    if (url.includes('/api/klienci')) return Promise.resolve({ data: [] })
    return Promise.resolve({ data: null })
  })
})

describe('Oferty page', () => {
  it('pokazuje liste ofert', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('OFERTA_01')).toBeInTheDocument()
      expect(screen.getByText('OFERTA_02')).toBeInTheDocument()
    })
  })

  it('pokazuje naglowek Oferty', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Oferty')).toBeInTheDocument()
    })
  })

  it('pokazuje przycisk PDF dla kazdej oferty', async () => {
    renderPage()
    await waitFor(() => {
      const pdfButtons = screen.getAllByText('📄 PDF')
      expect(pdfButtons.length).toBe(2)
    })
  })

  it('ma przycisk Nowa oferta dla admina', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('+ Nowa oferta')).toBeInTheDocument()
    })
  })
})