function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100
}

// Zapytanie SQL liczące łączną ilość i wartość bazową pozycji
// (z zaokrągleniem per-wiersz, identycznie jak frontend)
const POZYCJE_Z_WARTOSCIA_SQL = `
  SELECT ti.*,
    CASE WHEN ti.jednostka = 'm2' THEN
      COALESCE((SELECT SUM(ROUND(d.wymiar_x * d.wymiar_y, 2)) FROM item_dimensions d WHERE d.item_id = ti.id),0)
    ELSE
      COALESCE((SELECT SUM(d.ilosc) FROM item_dimensions d WHERE d.item_id = ti.id),0)
    END as laczna_ilosc,
    CASE WHEN ti.jednostka = 'm2' THEN
      COALESCE((SELECT SUM(ROUND(ROUND(d.wymiar_x * d.wymiar_y, 2) * ti.cena_jedn, 2)) FROM item_dimensions d WHERE d.item_id = ti.id),0)
    ELSE
      COALESCE((SELECT SUM(ROUND(d.ilosc * ti.cena_jedn, 2)) FROM item_dimensions d WHERE d.item_id = ti.id),0)
    END as wartosc_bazowa
  FROM table_items ti WHERE ti.tabela_id = $1 ORDER BY ti.kolejnosc ASC
`;

async function pobierzPozycjeZWartoscia(pool, tabelaId) {
  const res = await pool.query(POZYCJE_Z_WARTOSCIA_SQL, [tabelaId]);
  return res.rows;
}

// Wartość po korekcie lokalnej + globalnej, zaokrąglona do 2 miejsc
function zKorekta(wartoscBazowa, kortLaczna) {
  return round2(parseFloat(wartoscBazowa || 0) * (1 + (kortLaczna || 0) / 100));
}

module.exports = { round2, pobierzPozycjeZWartoscia, zKorekta };
