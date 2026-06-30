const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { pobierzPozycjeZWartoscia, zKorekta } = require('../utils/calc');

async function generujNumer() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dataPart = `${dd}_${mm}_${yyyy}`;
  const res = await pool.query(`SELECT COUNT(*) FROM offers WHERE numer LIKE $1`, [`%_${dataPart}`]);
  const nr = String(parseInt(res.rows[0].count) + 1).padStart(2, '0');
  return `OFERTA_CENOWA_${nr}_${dataPart}`;
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM offers'
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(`
      SELECT o.*, o.nazwa as oferta_nazwa, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      ORDER BY o.utworzony DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json({ rows: result.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const oferta = await pool.query(`
      SELECT o.*, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });

    const tabele = await pool.query(`
      SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC
    `, [req.params.id]);

    for (let t of tabele.rows) {
      const pozycje = await pool.query(`
        SELECT * FROM table_items WHERE tabela_id = $1 ORDER BY kolejnosc ASC
      `, [t.id]);
      for (let p of pozycje.rows) {
        const dims = await pool.query(`
          SELECT * FROM item_dimensions WHERE item_id = $1 ORDER BY kolejnosc ASC
        `, [p.id]);
        p.wymiary = dims.rows;
      }
      t.pozycje = pozycje.rows;
    }
    res.json({ ...oferta.rows[0], tabele: tabele.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { klient_id, uwagi } = req.body;
  try {
    const numer = await generujNumer();
    const result = await pool.query(`
      INSERT INTO offers (klient_id, numer, uwagi) VALUES ($1, $2, $3) RETURNING *
    `, [klient_id || null, numer, uwagi || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { klient_id, status, uwagi, korekta_globalna, numer, nazwa } = req.body;
  try {
    // Pobierz stary status dla auditu
    const stary = (await pool.query('SELECT status, nazwa, numer, klient_id, korekta_globalna, uwagi FROM offers WHERE id=$1', [req.params.id])).rows[0];

    const result = await pool.query(`
      UPDATE offers SET klient_id=$1, status=$2, uwagi=$3,
        korekta_globalna=COALESCE($4, korekta_globalna),
        numer=COALESCE($5, numer),
        nazwa=COALESCE($6, nazwa)
      WHERE id=$7 RETURNING *
    `, [klient_id || null, status, uwagi || null,
        korekta_globalna !== undefined ? korekta_globalna : null,
        numer || null,
        nazwa !== undefined ? nazwa : null,
        req.params.id]);

    // Audit log: zapisz wszystkie zmienione pola
        console.log('[CHANGELOG] PUT /:id', req.params.id, 'body:', JSON.stringify(req.body));
        console.log('[CHANGELOG] req.user:', JSON.stringify(req.user));
        if (stary) {
          console.log('[CHANGELOG] stary (z DB):', JSON.stringify(stary));
          const zmiany = [];
          // Porownuj tylko pola, ktore zostaly wyslane w body
          if (req.body.status !== undefined && String(stary.status || '') !== String(req.body.status || '')) {
            zmiany.push({ pole: 'status', stara: stary.status, nowa: req.body.status });
          }
          if (req.body.klient_id !== undefined && String(stary.klient_id || '') !== String(req.body.klient_id || '')) {
            // Pobierz nazwe klienta
            let nowaNazwa = req.body.klient_id;
            try {
              const kr = await pool.query('SELECT nazwa FROM clients WHERE id=$1', [req.body.klient_id]);
              if (kr.rows.length) nowaNazwa = kr.rows[0].nazwa;
            } catch(e) {}
            let staraNazwa = stary.klient_id;
            try {
              const kr = await pool.query('SELECT nazwa FROM clients WHERE id=$1', [stary.klient_id]);
              if (kr.rows.length) staraNazwa = kr.rows[0].nazwa;
            } catch(e) {}
            zmiany.push({ pole: 'klient', stara: staraNazwa, nowa: nowaNazwa });
          }
          if (req.body.nazwa !== undefined && String(stary.nazwa || '') !== String(req.body.nazwa || '')) {
            zmiany.push({ pole: 'nazwa', stara: stary.nazwa, nowa: req.body.nazwa });
          }
          if (req.body.numer !== undefined && String(stary.numer || '') !== String(req.body.numer || '')) {
            zmiany.push({ pole: 'numer', stara: stary.numer, nowa: req.body.numer });
          }
          if (req.body.korekta_globalna !== undefined && String(stary.korekta_globalna || '') !== String(req.body.korekta_globalna || '')) {
            zmiany.push({ pole: 'korekta_globalna', stara: stary.korekta_globalna, nowa: req.body.korekta_globalna });
          }
          if (req.body.uwagi !== undefined && String(stary.uwagi || '') !== String(req.body.uwagi || '')) {
            zmiany.push({ pole: 'uwagi', stara: stary.uwagi, nowa: req.body.uwagi });
          }
          console.log('[CHANGELOG] zmiany do zapisu:', JSON.stringify(zmiany));
          if (zmiany.length > 0) {
            const vals = zmiany.map((_, i) => `($${i*5+1},$${i*5+2},$${i*5+3},$${i*5+4},$${i*5+5})`).join(',');
            const params = [];
            for (const z of zmiany) {
              params.push(req.params.id, req.user?.id, z.pole, z.stara || null, z.nowa || null);
            }
            console.log('[CHANGELOG] SQL vals:', vals);
            console.log('[CHANGELOG] SQL params:', JSON.stringify(params));
            try {
              const ins = await pool.query(
                `INSERT INTO offer_changelog (oferta_id, uzytkownik_id, pole, stara_wartosc, nowa_wartosc) VALUES ${vals}`,
                params
              );
              console.log('[CHANGELOG] INSERT OK, rows:', ins.rowCount);
            } catch (e) {
              console.error('[CHANGELOG] BLAD INSERT:', e.message);
            }
          } else {
            console.log('[CHANGELOG] brak zmian, nic nie loguje');
          }
        } else {
          console.log('[CHANGELOG] stary jest null/undefined');
        }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/tabele', async (req, res) => {
  const { nazwa_mebla, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO furniture_tables (oferta_id, nazwa_mebla, kolejnosc)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.params.id, nazwa_mebla, kolejnosc || 1]);
    res.status(201).json({ ...result.rows[0], pozycje: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/tabele/:tabela_id', async (req, res) => {
  const { nazwa_mebla, korekta_pct, razem_przed, razem } = req.body;
  try {
    const result = await pool.query(`
      UPDATE furniture_tables
      SET nazwa_mebla=$1, korekta_pct=$2, razem_przed=$3, razem=$4
      WHERE id=$5 RETURNING *
    `, [nazwa_mebla, korekta_pct || 0, razem_przed || 0, razem || 0, req.params.tabela_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/tabele/:tabela_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM furniture_tables WHERE id=$1', [req.params.tabela_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj pozycję (bez wymiarów - te dodawane osobno)
router.post('/tabele/:tabela_id/pozycje', async (req, res) => {
  const { cennik_id, nazwa, jednostka, cena_jedn, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO table_items (tabela_id, cennik_id, nazwa, jednostka, cena_jedn, ilosc, kolejnosc)
      VALUES ($1,$2,$3,$4,$5,0,$6) RETURNING *
    `, [req.params.tabela_id, cennik_id || null, nazwa, jednostka, cena_jedn, kolejnosc || 1]);
    res.status(201).json({ ...result.rows[0], wymiary: [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/pozycje/:pozycja_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM table_items WHERE id=$1', [req.params.pozycja_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj wymiar do pozycji
router.post('/pozycje/:item_id/wymiary', async (req, res) => {
  const { wymiar_x, wymiar_y, ilosc, kolejnosc } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO item_dimensions (item_id, wymiar_x, wymiar_y, ilosc, kolejnosc)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.params.item_id, wymiar_x || null, wymiar_y || null, ilosc, kolejnosc || 1]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Usuń wymiar
router.delete('/wymiary/:dim_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM item_dimensions WHERE id=$1', [req.params.dim_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Eksport oferty do XLSX
router.get('/:id/xlsx', async (req, res) => {
  try {
    const oferta = await pool.query(`
      SELECT o.*, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });

    const tabele = await pool.query(
      'SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC', [req.params.id]
    );
    const kortGlobalna = parseFloat(oferta.rows[0].korekta_globalna) || 0;

    const wb = XLSX.utils.book_new();

    // Strona tytulowa
    const info = [
      ['Numer oferty:', oferta.rows[0].numer],
      ['Klient:', oferta.rows[0].klient_nazwa || ''],
      ['Data:', new Date(oferta.rows[0].data_oferty).toLocaleDateString('pl-PL')],
      ['Status:', oferta.rows[0].status],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(info);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Informacje');

    // Tabele mebli
    for (const tabela of tabele.rows) {
      const pozycje = await pobierzPozycjeZWartoscia(pool, tabela.id);
      const kortLaczna = (parseFloat(tabela.korekta_pct) || 0) + kortGlobalna;

      const dane = [['Pozycja', 'Ilość', 'Jednostka', 'Cena jedn.', 'Wartość']];
      let suma = 0;
      for (const p of pozycje) {
        const ilosc = parseFloat(p.laczna_ilosc || 0);
        const wartosc = zKorekta(p.wartosc_bazowa, kortLaczna);
        suma += wartosc;
        dane.push([p.nazwa, ilosc, p.jednostka, parseFloat(p.cena_jedn), wartosc]);
      }
      dane.push(['RAZEM', '', '', '', suma]);
      if (kortLaczna !== 0) dane.push(['Korekta:', `${kortLaczna}%`]);

      const ws = XLSX.utils.aoa_to_sheet(dane);
      XLSX.utils.book_append_sheet(wb, ws, String(tabela.nazwa_mebla).slice(0, 31));
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${oferta.rows[0].numer}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

// Eksport oferty do CSV
router.get('/:id/csv', async (req, res) => {
  try {
    const oferta = await pool.query(`
      SELECT o.*, c.nazwa as klient_nazwa
      FROM offers o LEFT JOIN clients c ON o.klient_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!oferta.rows.length) return res.status(404).json({ error: 'Nie znaleziono' });

    const tabele = await pool.query(`
      SELECT * FROM furniture_tables WHERE oferta_id = $1 ORDER BY kolejnosc ASC
    `, [req.params.id]);

    const kortGlobalnaCSV = parseFloat(oferta.rows[0].korekta_globalna) || 0

    let csv = '\uFEFF' // BOM dla Excel
    csv += `Numer oferty;${oferta.rows[0].numer}\n`
    csv += `Klient;${oferta.rows[0].klient_nazwa || ''}\n`
    csv += `Data;${new Date(oferta.rows[0].data_oferty).toLocaleDateString('pl-PL')}\n`
    csv += '\n'

    for (const tabela of tabele.rows) {
      csv += `${tabela.nazwa_mebla}\n`
      const kortLaczCSV = (parseFloat(tabela.korekta_pct) || 0) + kortGlobalnaCSV
      csv += `Pozycja;Ilość;Jednostka;Cena jedn.;Wartość\n`

      const pozycjeRows = await pobierzPozycjeZWartoscia(pool, tabela.id)
      let sumaTabeli = 0
      for (const p of pozycjeRows) {
        const ilosc = parseFloat(p.laczna_ilosc || 0).toFixed(2).replace('.', ',')
        const wartoscZKort = zKorekta(p.wartosc_bazowa, kortLaczCSV)
        sumaTabeli += wartoscZKort
        csv += `${p.nazwa};${ilosc};${p.jednostka};;;${wartoscZKort.toFixed(2).replace('.', ',')}\n`
      }
      const razem = sumaTabeli.toFixed(2).replace('.', ',')
      csv += `RAZEM;;;; ${razem}\n`
      csv += '\n'
    }

    const nazwaPliku = `${oferta.rows[0].numer}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${nazwaPliku}"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
});

// Usuń ofertę
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM offers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pobierz szczegóły jednej tabeli z pozycjami i wymiarami
router.get('/tabele-szczegoly/:tabela_id', async (req, res) => {
  try {
    const tabela = await pool.query(
      'SELECT * FROM furniture_tables WHERE id = $1', [req.params.tabela_id]
    )
    if (!tabela.rows.length) return res.status(404).json({ error: 'Nie znaleziono' })

    const pozycje = await pool.query(
      'SELECT * FROM table_items WHERE tabela_id = $1 ORDER BY kolejnosc ASC',
      [req.params.tabela_id]
    )
    for (let p of pozycje.rows) {
      const dims = await pool.query(
        'SELECT * FROM item_dimensions WHERE item_id = $1 ORDER BY kolejnosc ASC', [p.id]
      )
      p.wymiary = dims.rows
    }
    res.json({ ...tabela.rows[0], pozycje: pozycje.rows })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Edytuj wymiar
router.put('/wymiary/:dim_id', async (req, res) => {
  const { wymiar_x, wymiar_y, ilosc } = req.body;
  try {
    const nowaIlosc = wymiar_x && wymiar_y
      ? parseFloat(wymiar_x) * parseFloat(wymiar_y)
      : parseFloat(ilosc);
    const result = await pool.query(
      `UPDATE item_dimensions SET wymiar_x=$1, wymiar_y=$2, ilosc=$3 WHERE id=$4 RETURNING *`,
      [wymiar_x || null, wymiar_y || null, nowaIlosc, req.params.dim_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Edytuj nazwę i/lub cenę pozycji
router.put('/pozycje/:pozycja_id', async (req, res) => {
  const { nazwa, cena_jedn } = req.body;
  try {
    const result = await pool.query(
      `UPDATE table_items SET nazwa=$1, cena_jedn=COALESCE($2, cena_jedn) WHERE id=$3 RETURNING *`,
      [nazwa, cena_jedn || null, req.params.pozycja_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dodaj wpis do logu dyktowania
router.post('/tabele/:tabela_id/dyktowanie', async (req, res) => {
  const { tekst, rozpoznano, sukces } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO dictation_log (tabela_id, tekst, rozpoznano, sukces) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.tabela_id, tekst, rozpoznano || null, !!sukces]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pobierz log dyktowania dla tabeli
router.get('/tabele/:tabela_id/dyktowanie', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM dictation_log WHERE tabela_id = $1 ORDER BY utworzono ASC`,
      [req.params.tabela_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pobierz historię zmian oferty (changelog + statusy)
router.get('/:id/historia', async (req, res) => {
  try {
    const wynik = await pool.query(`
      SELECT cl.utworzony, u.imie_nazwisko as uzytkownik,
        cl.pole, cl.stara_wartosc, cl.nowa_wartosc,
        NULL as stary_status, NULL as nowy_status
      FROM offer_changelog cl
      LEFT JOIN users u ON cl.uzytkownik_id = u.id
      WHERE cl.oferta_id = $1
      UNION ALL
      SELECT ol.utworzony, u.imie_nazwisko as uzytkownik,
        'status' as pole, ol.stary_status as stara_wartosc, ol.nowy_status as nowa_wartosc,
        ol.stary_status, ol.nowy_status
      FROM offer_log ol
      LEFT JOIN users u ON ol.uzytkownik_id = u.id
      WHERE ol.oferta_id = $1 AND NOT EXISTS (
        SELECT 1 FROM offer_changelog cl2
        WHERE cl2.oferta_id = ol.oferta_id AND cl2.pole = 'status'
        AND cl2.utworzony = ol.utworzony
      )
      ORDER BY utworzony DESC
    `, [req.params.id]);
    res.json(wynik.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
