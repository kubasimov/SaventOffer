import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import KreatorPDF from '../components/KreatorPDF'
import axios from 'axios'

vi.mock('axios')

URL.createObjectURL = vi.fn(() => 'blob:test')
URL.revokeObjectURL = vi.fn()
vi.spyOn(window, 'alert').mockImplementation(() => {})

const defaultProps = {
  ofertaId: 'test-id-123',
  ofertaNumer: 'OFERTA_TEST',
  ofertaNazwa: 'Test',
  klientId: null,
  onClose: vi.fn(),
}

function renderKreator(props = {}) {
  return render(<KreatorPDF {...defaultProps} {...props} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  axios.get.mockImplementation((url) => {
    if (url === '/api/pdf/kategorie') return Promise.resolve({
      data: [{ nazwa: 'SALON', pliki: 2 }, { nazwa: 'LAZIENKA', pliki: 3 }]
    })
    if (url === '/api/pdf/zalozenia-domyslne') return Promise.resolve({
      data: { tekst: 'Domyslne zal\nDruga linia' }
    })
    if (url === '/api/ustawienia/specyfikacja_domyslna') return Promise.resolve({
      data: { wartosc: 'Plyta laminowana 18mm\nOkucia stalowe\nZawiasy' }
    })
    if (url === '/api/klienci') return Promise.resolve({
      data: [{ id: 'k1', nazwa: 'Jan Kowalski', adres: 'Warszawa' }]
    })
    return Promise.reject(new Error('nieznany url: ' + url))
  })
  axios.post.mockResolvedValue({ data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }) })
})

// Helper: idz do kroku N (0-indexed)
async function idzDoKroku(n) {
  for (let i = 0; i < n; i++) {
    await userEvent.click(screen.getByText('Dalej →'))
  }
}

describe('KreatorPDF', () => {
  it('renderuje 5 krokow', async () => {
    renderKreator()
    // Uzyj getAllByText bo "Dane klienta" jest w step bar i w h2
    await waitFor(() => {
      expect(screen.getAllByText('Dane klienta').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('Założenia')).toBeInTheDocument()
    expect(screen.getByText('Specyfikacja')).toBeInTheDocument()
    expect(screen.getByText('Obrazy')).toBeInTheDocument()
    expect(screen.getByText('Generuj')).toBeInTheDocument()
  })

  it('krok 1: pokazuje formularz danych klienta', async () => {
    renderKreator()
    await waitFor(() => {
      expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument()
    })
    expect(screen.getByText('Imię i nazwisko / Firma')).toBeInTheDocument()
    expect(screen.getByText('Adres')).toBeInTheDocument()
  })

  it('przechodzi przez wszystkie 5 krokow', async () => {
    renderKreator()
    await waitFor(() => expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument())
    await idzDoKroku(1)
    expect(screen.getByText('Założenia oferty')).toBeInTheDocument()
    await idzDoKroku(1)
    expect(screen.getByText('Specyfikacja materiałowa')).toBeInTheDocument()
    await idzDoKroku(1)
    expect(screen.getByText('Obrazy realizacji')).toBeInTheDocument()
    await idzDoKroku(1)
    expect(screen.getByText('Podsumowanie PDF')).toBeInTheDocument()
  })

  it('krok 4: pokazuje kategorie obrazow i opcje wlasnych plikow', async () => {
    renderKreator()
    await waitFor(() => expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument())
    // 3 klikniecia: 0→1 (Zalozenia), 1→2 (Specyfikacja), 2→3 (Obrazy)
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByText('Dalej →'))
    }
    // Kategorie laduja sie asynchronicznie w useEffect
    await waitFor(() => {
      expect(screen.getByText('SALON')).toBeInTheDocument()
      expect(screen.getByText('LAZIENKA')).toBeInTheDocument()
    })
    expect(screen.getByText('Bez obrazów')).toBeInTheDocument()
    expect(screen.getByText(/Wybierz obrazy \(JPG\/PNG\)/)).toBeInTheDocument()
  })

  it('generuje PDF przez POST do /api/pdf/:id (bez wlasnych obrazow)', async () => {
    renderKreator()
    await waitFor(() => expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument())
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByText('Dalej →'))
    }
    await waitFor(() => expect(screen.getByText('Podsumowanie PDF')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Generuj PDF/ }))
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled()
    })
    const [url, body] = axios.post.mock.calls[0]
    expect(url).toContain('/api/pdf/test-id-123')
    expect(body.kategoria).toBe('')
    expect(body.zalozenia).toBeTypeOf('string')
  })

  it('generuje PDF z wlasnymi obrazami przez FormData do /z-obrazami', async () => {
    renderKreator()
    await waitFor(() => expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument())
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByText('Dalej →'))
    }
    await waitFor(() => expect(screen.getByText('Obrazy realizacji')).toBeInTheDocument())

    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText(/Wybierz obrazy/)
    await userEvent.upload(fileInput, file)

    await userEvent.click(screen.getByText('Dalej →'))
    await waitFor(() => expect(screen.getByText('Podsumowanie PDF')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Generuj PDF/ }))
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled()
    })
    const [url, formData] = axios.post.mock.calls[0]
    expect(url).toContain('/api/pdf/test-id-123/z-obrazami')
    expect(formData).toBeInstanceOf(FormData)
  })

  it('przycisk "Bez zalozen i danych" generuje PDF', async () => {
    renderKreator()
    await waitFor(() => expect(screen.getByPlaceholderText('np. Zabudowa kuchenna')).toBeInTheDocument())
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByText('Dalej →'))
    }
    await waitFor(() => expect(screen.getByText('Podsumowanie PDF')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Bez założeń i danych/ }))
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled()
    })
  })
})