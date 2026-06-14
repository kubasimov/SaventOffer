const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const upload = multer({ dest: '/tmp/import/' });

// Parsuj arkusz Excel do struktury tabel mebli (maszyna stanów)
function parsujArkusz(ws) {
  const tabele = []
  let obecnaTabela = null
  let pending = null // { nazwa, jednostka, wymiary: [...] }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:F1')
  const maxRow = range.e.r

  function finalizePending(cena) {
    if (!pending) return
    pending.cena_jedn = cena || 0
    if (!obecnaTabela) {
      obecnaTabela = { nazwa_mebla: 'IMPORT', pozycje: [] }
      tabele.push(obecnaTabela)
    }
    obecnaTabela.pozycje.push(pending)
    pending = null
  }

  for (let r = 0; r <= maxRow; r++) {
    const get = c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      return cell ? cell.v : undefined
    }
    const A = get(0), B = get(1), C = get(2), D = get(3), E = get(4), F = get(5)

    const hasA = A !== undefined && A !== null && A !== ''
    const hasB = B !== undefined && B !== null
    const hasC = C !== undefined && C !== null
    const hasD = D !== undefined && D !== null
    const hasE = E !== undefined && E !== null
    const hasF = F !== undefined && F !== null

    if (!hasA && !hasB && !hasC && !hasD && !hasE && !hasF) continue // pusty wiersz

    // Wiersz RAZEM - koniec tabeli mebla
    if (hasA && typeof A === 'string' && A.toUpperCase().includes('RAZEM')) {
      finalizePending(null)
      continue
    }

    // Nagłówek mebla - tylko A wypełnione
    if (hasA && typeof A === 'string' && !hasB && !hasC && !hasD && !hasE && !hasF) {
      finalizePending(null)
      obecnaTabela = { nazwa_mebla: A.trim(), pozycje: [] }
      tabele.push(obecnaTabela)
      continue
    }

    // Pozycja "wszystko w jednym wierszu": A=nazwa, D=ilosc, E=cena (szt/mb, bez B/C)
    if (hasA && typeof A === 'string' && hasD && hasE && !hasB && !hasC) {
      finalizePending(null)
      pending = { nazwa: A.trim(), jednostka: 'szt', wymiary: [{ ilosc: parseFloat(D) }] }
      finalizePending(parseFloat(E))
      continue
    }

    // Pierwszy wiersz m2: A=nazwa, B=x, C=y, D=x*y
    if (hasA && typeof A === 'string' && hasB && hasC) {
      finalizePending(null)
      pending = { nazwa: A.trim(), jednostka: 'm2', wymiary: [{ wymiar_x: parseFloat(B), wymiar_y: parseFloat(C) }] }
      continue
    }

    // Pierwszy wiersz szt/mb: A=nazwa, D=ilosc (bez B/C, bez E)
    if (hasA && typeof A === 'string' && hasD && !hasB && !hasC) {
      finalizePending(null)
      pending = { nazwa: A.trim(), jednostka: 'szt', wymiary: [{ ilosc: parseFloat(D) }] }
      continue
    }

    // Kolejny wiersz wymiarów m2 (bez A, z B i C)
    if (!hasA && hasB && hasC && pending?.jednostka === 'm2') {
      pending.wymiary.push({ wymiar_x: parseFloat(B), wymiar_y: parseFloat(C) })
      continue
    }

    // Wiersz podsumowania (bez A,B,C, z D=ilosc/m2 i E=cena)
    if (!hasA && !hasB && !hasC && hasD && hasE) {
      finalizePending(parseFloat(E))
      continue
    }
  }

  finalizePending(null)
  return tabele.filter(t => t.pozycje.length > 0)
}

// Endpoint podglądu przed importem
router.post('/podglad', upload.single('plik'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' })
    const wb = XLSX.readFile(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const tabele = parsujArkusz(ws)
    fs.unlinkSync(req.file.path)
    res.json({ tabele, liczba_tabel: tabele.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Endpoint importu do bazy
router.post('/zapisz', upload.single('plik'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Brak pliku' })

    const { klient_id, nazwa_oferty } = req.body
    const wb = XLSX.readFile(req.file.path)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const tabele = parsujArkusz(ws)
    fs.unlinkSync(req.file.path)

    const cennik = await pool.query('SELECT * FROM price_list WHERE aktywny = true')

    const numer = nazwa_oferty || `IMPORT_${Date.now()}`
    const oferta = await pool.query(
      'INSERT INTO offers (klient_id, numer) VALUES ($1, $2) RETURNING *',
      [klient_id || null, numer]
    )
    const ofertaId = oferta.rows[0].id

    for (let i = 0; i < tabele.length; i++) {
      const t = tabele[i]

      const tabela = await pool.query(
        'INSERT INTO furniture_tables (oferta_id, nazwa_mebla, kolejnosc) VALUES ($1,$2,$3) RETURNING *',
        [ofertaId, t.nazwa_mebla, i + 1]
      )
      const tabelaId = tabela.rows[0].id

      let razem = 0

      for (let j = 0; j < t.pozycje.length; j++) {
        const p = t.pozycje[j]

        const dopasowana = cennik.rows.find(c =>
          c.nazwa.toLowerCase() === p.nazwa.toLowerCase()
        )
        const cena = p.cena_jedn > 0 ? p.cena_jedn : (dopasowana ? parseFloat(dopasowana.cena) : 0)
        const cennikId = dopasowana ? dopasowana.id : null
        const jednostka = dopasowana ? dopasowana.jednostka : p.jednostka

        const pozycja = await pool.query(
          `INSERT INTO table_items (tabela_id, cennik_id, nazwa, jednostka, cena_jedn, ilosc, kolejnosc)
           VALUES ($1,$2,$3,$4,$5,0,$6) RETURNING *`,
          [tabelaId, cennikId, p.nazwa, jednostka, cena, j + 1]
        )
        const pozycjaId = pozycja.rows[0].id

        let wartoscPoz = 0
        for (let k = 0; k < p.wymiary.length; k++) {
          const d = p.wymiary[k]
          const ilosc = jednostka === 'm2'
            ? (d.wymiar_x || 0) * (d.wymiar_y || 0)
            : (d.ilosc || 0)
          await pool.query(
            'INSERT INTO item_dimensions (item_id, wymiar_x, wymiar_y, ilosc, kolejnosc) VALUES ($1,$2,$3,$4,$5)',
            [pozycjaId, jednostka === 'm2' ? d.wymiar_x : null, jednostka === 'm2' ? d.wymiar_y : null, ilosc, k + 1]
          )
          wartoscPoz += ilosc * cena
        }
        razem += wartoscPoz
      }

      await pool.query(
        'UPDATE furniture_tables SET razem_przed=$1, razem=$2 WHERE id=$3',
        [razem, razem, tabelaId]
      )
    }

    res.json({ success: true, oferta_id: ofertaId, numer })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router;
