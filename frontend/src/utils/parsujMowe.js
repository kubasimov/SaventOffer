function tekstNaLiczbe(tekst) {
  const mapy = {
    'zero':0,'jeden':1,'jedna':1,'jedną':1,'dwa':2,'dwie':2,'trzy':3,'cztery':4,
    'pięć':5,'sześć':6,'siedem':7,'osiem':8,'dziewięć':9,'dziesięć':10,
    'jedenaście':11,'dwanaście':12,'trzynaście':13,'czternaście':14,
    'piętnaście':15,'szesnaście':16,'siedemnaście':17,'osiemnaście':18,
    'dziewiętnaście':19,'dwadzieścia':20,'trzydzieści':30,'czterdzieści':40,
    'pięćdziesiąt':50,'sześćdziesiąt':60,'siedemdziesiąt':70,
    'osiemdziesiąt':80,'dziewięćdziesiąt':90,'sto':100,'dwieście':200,
    'trzysta':300,'czterysta':400,'pięćset':500
  }
  // Buduj słownik ze znormalizowanymi kluczami (bez polskich znaków)
  const mapaNorm = {}
  for (const [k,v] of Object.entries(mapy)) {
    const kn = k.toLowerCase()
      .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
      .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
      .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    mapaNorm[kn] = v
  }
  // Obsługa "zero przecinek sześć" → 0.6, "dwa przecinek pięć" → 2.5
  const norm = tekst.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
  const przecinekMatch = norm.match(/([a-z]+)\s+przecinek\s+([a-z]+)/)
  if (przecinekMatch) {
    const cal = mapaNorm[przecinekMatch[1]] ?? 0
    const dz = mapaNorm[przecinekMatch[2]]
    if (dz !== undefined) return parseFloat(`${cal}.${dz}`)
  }
  tekst = tekst.toLowerCase()
    .replace(/przecinek/g, '.')
    .replace(/i pół/g, '.5')
    .replace(/,/g, '.')
  const num = parseFloat(tekst)
  if (!isNaN(num)) return num
  const slowa = tekst.split(/\s+/)
  let bufor = 0
  for (const slowo of slowa) {
    if (mapy[slowo] !== undefined) bufor += mapy[slowo]
  }
  if (bufor > 0) return bufor
  return null
}

function normalizuj(tekst) {
  return tekst.toLowerCase()
    .replace(/ą/g,'a').replace(/ć/g,'c').replace(/ę/g,'e')
    .replace(/ł/g,'l').replace(/ń/g,'n').replace(/ó/g,'o')
    .replace(/ś/g,'s').replace(/ź/g,'z').replace(/ż/g,'z')
    .replace(/(\d+),([0-9])/g, '$1.$2')
    .replace(/[^a-z0-9.\s]/g, '')
    .replace(/\s+/g, ' ').trim()
}

function znajdzPozycjeWCenniku(tekst, cennik) {
  const tekstNorm = normalizuj(tekst)
  let najlepsza = null
  let najdluzszy = 0
  for (const pozycja of cennik) {
    const nazwaNorm = normalizuj(pozycja.nazwa)
    if (tekstNorm.includes(nazwaNorm) && nazwaNorm.length > najdluzszy) {
      najlepsza = pozycja
      najdluzszy = nazwaNorm.length
    }
    for (const alias of (pozycja.aliasy || [])) {
      const aliasNorm = normalizuj(alias.alias)
      if (tekstNorm.includes(aliasNorm) && aliasNorm.length > najdluzszy) {
        najlepsza = pozycja
        najdluzszy = aliasNorm.length
      }
    }
  }
  return najlepsza
}

function wytnijLiczby(tekst, nazwaNorm) {
  return normalizuj(tekst).replace(nazwaNorm, '').trim()
}

export function parsujMoweCiagla(tekst, cennik) {
  tekst = tekst.toLowerCase().trim()
  const wynik = {
    pozycja: null, wymiar_x: null, wymiar_y: null, ilosc: null, sukces: false
  }
  const pozycja = znajdzPozycjeWCenniku(tekst, cennik)
  if (!pozycja) return wynik
  wynik.pozycja = pozycja
  const nazwaNorm = normalizuj(pozycja.nazwa)
  const reszta = wytnijLiczby(tekst, nazwaNorm)

  if (pozycja.jednostka === 'm2') {
    const wzCyfry = /(\d+[.,]?\d*)\s*(na|przez|x)\s*(\d+[.,]?\d*)/i
    const matchC = tekst.match(wzCyfry)
    if (matchC) {
      wynik.wymiar_x = parseFloat(matchC[1].replace(',','.'))
      wynik.wymiar_y = parseFloat(matchC[3].replace(',','.'))
      wynik.sukces = true
      return wynik
    }
    const wzSlowny = /([a-ząćęłńóśźż\d\s]+przecinek[a-ząćęłńóśźż\d\s]*|[\d]+[.,][\d]+|[a-ząćęłńóśźż]+)\s+na\s+([a-ząćęłńóśźż\d\s]+przecinek[a-ząćęłńóśźż\d\s]*|[\d]+[.,][\d]+|[a-ząćęłńóśźż]+)/i
    const matchS = reszta.match(wzSlowny)
    if (matchS) {
      wynik.wymiar_x = tekstNaLiczbe(matchS[1])
      wynik.wymiar_y = tekstNaLiczbe(matchS[2])
      if (wynik.wymiar_x && wynik.wymiar_y) { wynik.sukces = true; return wynik }
    }
  } else {
    const segmentKrotki = reszta.slice(0, 50)
    const matchC = segmentKrotki.match(/(\d+[.,]?\d*)/)
    if (matchC) {
      wynik.ilosc = parseFloat(matchC[1].replace(',','.'))
      wynik.sukces = true
      return wynik
    }
    const liczba = tekstNaLiczbe(segmentKrotki)
    if (liczba !== null) {
      wynik.ilosc = liczba
      wynik.sukces = true
      return wynik
    }
    wynik.ilosc = 1
    wynik.sukces = true
  }
  return wynik
}

function wyodrebnijLiczby(segment, pozycja) {
  const wynik = { pozycja, wymiar_x: null, wymiar_y: null, ilosc: null, sukces: false }

  if (pozycja.jednostka === 'm2') {
    const wzCyfry = /(\d+\.?\d*)\s*(na|przez|x)\s*(\d+\.?\d*)/i
    const matchC = segment.match(wzCyfry)
    if (matchC) {
      wynik.wymiar_x = parseFloat(matchC[1])
      wynik.wymiar_y = parseFloat(matchC[3])
      wynik.sukces = true
      return wynik
    }
    const wzSlowny = /([a-z\d\s]+przecinek[a-z\d\s]*|[\d]+\.[\d]+|[a-z]+)\s+na\s+([a-z\d\s]+przecinek[a-z\d\s]*|[\d]+\.[\d]+|[a-z]+)/i
    const matchS = segment.match(wzSlowny)
    if (matchS) {
      wynik.wymiar_x = tekstNaLiczbe(matchS[1])
      wynik.wymiar_y = tekstNaLiczbe(matchS[2])
      if (wynik.wymiar_x && wynik.wymiar_y) { wynik.sukces = true; return wynik }
    }
  } else {
    const segmentKrotki = segment.slice(0, 50)
    const matchC = segmentKrotki.match(/(\d+\.?\d*)/)
    if (matchC) {
      wynik.ilosc = parseFloat(matchC[1])
      wynik.sukces = true
      return wynik
    }
    const liczba = tekstNaLiczbe(segmentKrotki)
    if (liczba !== null) {
      wynik.ilosc = liczba
      wynik.sukces = true
      return wynik
    }
    wynik.ilosc = 1
    wynik.sukces = true
  }
  return wynik
}

export function parsujTranskrypt(tekst, cennik) {
  const tekstNorm = normalizuj(tekst)

  const kandydaci = []
  for (const pozycja of cennik) {
    kandydaci.push({ wzorzec: normalizuj(pozycja.nazwa), pozycja })
    for (const alias of (pozycja.aliasy || [])) {
      kandydaci.push({ wzorzec: normalizuj(alias.alias), pozycja })
    }
  }
  kandydaci.sort((a, b) => b.wzorzec.length - a.wzorzec.length)

  const matches = []
  let i = 0
  while (i < tekstNorm.length) {
    let znaleziono = false
    for (const k of kandydaci) {
      if (!k.wzorzec) continue
      if (tekstNorm.startsWith(k.wzorzec, i)) {
        matches.push({ start: i, end: i + k.wzorzec.length, pozycja: k.pozycja })
        i += k.wzorzec.length
        znaleziono = true
        break
      }
    }
    if (!znaleziono) i++
  }

  const wyniki = []
  for (let idx = 0; idx < matches.length; idx++) {
    const m = matches[idx]
    const segEnd = idx + 1 < matches.length ? matches[idx + 1].start : tekstNorm.length
    const segment = tekstNorm.slice(m.end, segEnd)
    const wynik = wyodrebnijLiczby(segment, m.pozycja)
    wynik.segmentTekst = tekstNorm.slice(m.start, segEnd).trim()
    wyniki.push(wynik)
  }
  return wyniki
}
