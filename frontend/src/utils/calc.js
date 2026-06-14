export function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

export function obliczWartoscPozycji(pozycja) {
  const cena = parseFloat(pozycja.cena_jedn || 0)
  if (!pozycja.wymiary || pozycja.wymiary.length === 0) return 0
  return round2(pozycja.wymiary.reduce((acc, d) => {
    const il = pozycja.jednostka === 'm2'
      ? round2(parseFloat(d.wymiar_x || 0) * parseFloat(d.wymiar_y || 0))
      : parseFloat(d.ilosc || 0)
    return acc + round2(il * cena)
  }, 0))
}

export function obliczLacznaIlosc(pozycja) {
  if (!pozycja.wymiary || pozycja.wymiary.length === 0) return 0
  if (pozycja.jednostka === 'm2') {
    return round2(pozycja.wymiary.reduce((acc, d) =>
      acc + round2(parseFloat(d.wymiar_x || 0) * parseFloat(d.wymiar_y || 0)), 0))
  }
  return pozycja.wymiary.reduce((acc, d) => acc + parseFloat(d.ilosc || 0), 0)
}

export function obliczSume(pozycje) {
  return round2(pozycje.reduce((sum, p) => sum + obliczWartoscPozycji(p), 0))
}

export function formatPLN(val) {
  return val.toFixed(2).replace('.', ',') + ' zł'
}
