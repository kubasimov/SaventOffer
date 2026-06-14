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
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim()
}

function znajdzPozycjeWCenniku(tekst, cennik) {
  const tekstNorm = normalizuj(tekst)
  
  let najlepsza = null
  let najdluzszy = 0

  for (const pozycja of cennik) {
    // Sprawdź główną nazwę
    const nazwaNorm = normalizuj(pozycja.nazwa)
    if (tekstNorm.includes(nazwaNorm) && nazwaNorm.length > najdluzszy) {
      najlepsza = pozycja
      najdluzszy = nazwaNorm.length
    }
    // Sprawdź aliasy
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
  // Usuń nazwę z tekstu żeby zostały tylko liczby/wymiary
  const tekstBezNazwy = normalizuj(tekst).replace(nazwaNorm, '').trim()
  return tekstBezNazwy
}

export function parsujMoweCiagla(tekst, cennik) {
  const wynik = {
    pozycja: null,    // obiekt z cennika
    wymiar_x: null,
    wymiar_y: null,
    ilosc: null,
    sukces: false
  }

  // Znajdź pozycję w cenniku
  const pozycja = znajdzPozycjeWCenniku(tekst, cennik)
  if (!pozycja) return wynik
  wynik.pozycja = pozycja

  const nazwaNorm = normalizuj(pozycja.nazwa)
  const reszta = wytnijLiczby(tekst, nazwaNorm)

  if (pozycja.jednostka === 'm2') {
    // Szukaj X na Y (cyfry)
    const wzCyfry = /(\d+[.,]?\d*)\s*(na|przez|x)\s*(\d+[.,]?\d*)/i
    const matchC = tekst.match(wzCyfry)
    if (matchC) {
      wynik.wymiar_x = parseFloat(matchC[1].replace(',','.'))
      wynik.wymiar_y = parseFloat(matchC[3].replace(',','.'))
      wynik.sukces = true
      return wynik
    }
    // Szukaj słownie "dwa przecinek trzy na zero przecinek sześć"
    const wzSlowny = /([a-ząćęłńóśźż\d\s]+przecinek[a-ząćęłńóśźż\d\s]*|[\d]+[.,][\d]+|[a-ząćęłńóśźż]+)\s+na\s+([a-ząćęłńóśźż\d\s]+przecinek[a-ząćęłńóśźż\d\s]*|[\d]+[.,][\d]+|[a-ząćęłńóśźż]+)/i
    const matchS = reszta.match(wzSlowny)
    if (matchS) {
      wynik.wymiar_x = tekstNaLiczbe(matchS[1])
      wynik.wymiar_y = tekstNaLiczbe(matchS[2])
      if (wynik.wymiar_x && wynik.wymiar_y) { wynik.sukces = true; return wynik }
    }
  } else {
    // szt lub mb — szukaj liczby
    const wzCyfry = /(\d+[.,]?\d*)/
    const matchC = reszta.match(wzCyfry)
    if (matchC) {
      wynik.ilosc = parseFloat(matchC[1].replace(',','.'))
      wynik.sukces = true
      return wynik
    }
    // Słownie
    const liczba = tekstNaLiczbe(reszta)
    if (liczba !== null) {
      wynik.ilosc = liczba
      wynik.sukces = true
      return wynik
    }
    // Jeśli nie podano ilości — domyślnie 1
    wynik.ilosc = 1
    wynik.sukces = true
  }

  return wynik
}
