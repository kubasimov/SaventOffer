/**
 * Testy narzedzi obliczeniowych — utils/calc.js
 */
const { round2, zKorekta, pobierzPozycjeZWartoscia } = require('../calc');

describe('round2()', () => {
  it('zaokragla do 2 miejsc', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(0)).toBe(0);
    expect(round2(100.999)).toBe(101.00);
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe('zKorekta()', () => {
  it('korekta 0% zwraca wartosc bez zmian', () => {
    expect(zKorekta(100, 0)).toBe(100);
  });

  it('korekta +10%', () => {
    expect(zKorekta(100, 10)).toBe(110);
  });

  it('korekta -10%', () => {
    expect(zKorekta(100, -10)).toBe(90);
  });

  it('korekta 15.5%', () => {
    expect(zKorekta(200, 15.5)).toBe(231);
  });

  it('obsluguje string jako wartosc bazowa', () => {
    expect(zKorekta('100', 10)).toBe(110);
  });

  it('obsluguje undefined/null', () => {
    expect(zKorekta(undefined, 10)).toBe(0);
    expect(zKorekta(null, 10)).toBe(0);
    expect(zKorekta(100, undefined)).toBe(100);
    expect(zKorekta(100, null)).toBe(100);
  });
});

describe('pobierzPozycjeZWartoscia()', () => {
  const mockPool = { query: jest.fn() };

  it('zwraca pozycje z obliczona laczna_ilosc i wartosc_bazowa (szt)', async () => {
    mockPool.query.mockResolvedValue({
      rows: [
        { id: 'p1', nazwa: 'Drzwi', jednostka: 'szt', cena_jedn: '500',
          laczna_ilosc: '3', wartosc_bazowa: '1500' }
      ]
    });
    const result = await pobierzPozycjeZWartoscia(mockPool, 'tabela-id');
    expect(result.length).toBe(1);
    expect(result[0]).toMatchObject({
      id: 'p1', nazwa: 'Drzwi', laczna_ilosc: '3', wartosc_bazowa: '1500'
    });
  });

  it('zwraca pusta tablice gdy brak pozycji', async () => {
    mockPool.query.mockResolvedValue({ rows: [] });
    const result = await pobierzPozycjeZWartoscia(mockPool, 'empty-id');
    expect(result).toEqual([]);
  });
});