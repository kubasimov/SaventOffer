import sys
import json
import io
import os
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Rejestruj fonty z polskimi znakami
FONT_PATH = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont('DejaVu', FONT_PATH + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold', FONT_PATH + 'DejaVuSans-Bold.ttf'))

PAGE_W = 1190
PAGE_H = 842

MARGIN_LEFT = 45
MARGIN_RIGHT = 45
TABLE_TOP = 630      # Y gdzie zaczyna się tabela (pod nagłówkiem strony 2)
ROW_H = 36           # wysokość wiersza (domyślna)
HEADER_H = 38        # wysokość nagłówka tabeli
COL_NAME_W = 697     # szerokość kolumny nazwy
COL_VAL_W = 238      # szerokość kolumny wartości
TABLE_W = COL_NAME_W + COL_VAL_W  # łączna szerokość tabeli

# Kolory
BG_DARK = (0.498, 0.239, 0.435)    # #7f3d6f - nagłówek tabeli (ciemny fiolet)
BG_LIGHT = (0.906, 0.906, 0.906)   # #e8e8e8 - wiersze parzyste
BG_WHITE = (0.949, 0.949, 0.949)   # nieco jaśniejszy dla nieparzystych
TEXT_DARK = (0.22, 0.18, 0.18)     # ciemny tekst
TEXT_WHITE = (1, 1, 1)             # biały tekst


def formatPLN(val):
    """Formatuje kwotę: 1234,56 zł"""
    return f"{val:,.2f}".replace(',', ' ').replace('.', ',') + " zł"


def oblicz_razem(tabela):
    """Oblicza sumę końcową tabeli po korekcie."""
    return float(tabela.get('razem', 0))


def generuj_strone_tabeli(tabela):
    """Generuje stronę PDF z tabelą dla jednego mebla."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    nazwa_mebla = tabela.get('nazwa_mebla', '')
    pozycje = tabela.get('pozycje', [])
    razem = oblicz_razem(tabela)

    # Oblicz dostępną przestrzeń i dopasuj wysokość wierszy
    TABLE_BOTTOM = 40          # margines dolny
    dostepna_wys = TABLE_TOP - TABLE_BOTTOM
    # Liczba elementów: nagłówek + wiersze + pusty separator + RAZEM
    n_elementow = 1 + len(pozycje) + 1 + 1
    # Wylicz wysokość wiersza żeby zmieścić wszystko
    wys_na_element = dostepna_wys / n_elementow
    ROW_H = min(36, max(18, wys_na_element))
    HEADER_H = min(38, max(20, wys_na_element))

    table_x = (PAGE_W - TABLE_W) / 2  # wyśrodkuj tabelę

    # --- Nagłówek tabeli (nazwa mebla) ---
    header_y = TABLE_TOP
    c.setFillColorRGB(*BG_DARK)
    c.rect(table_x, header_y, TABLE_W, HEADER_H, fill=1, stroke=0)

    c.setFillColorRGB(*TEXT_WHITE)
    c.setFont('DejaVuBold', 11)
    c.drawString(table_x + 12, header_y + 13, nazwa_mebla)

    # --- Wiersze pozycji ---
    current_y = header_y - ROW_H

    for i, poz in enumerate(pozycje):
        nazwa = poz.get('nazwa', '')
        wartosc = float(poz.get('wartosc_koncowa', 0))

        # Tło wiersza naprzemienne
        if i % 2 == 0:
            c.setFillColorRGB(*BG_LIGHT)
        else:
            c.setFillColorRGB(*BG_WHITE)
        c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)

        # Linia oddzielająca
        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.setLineWidth(0.5)
        c.line(table_x, current_y, table_x + TABLE_W, current_y)

        # Tekst nazwy
        c.setFillColorRGB(*TEXT_DARK)
        c.setFont('DejaVu', 10)
        c.drawString(table_x + 12, current_y + 12, nazwa)

        # Tekst wartości (wyrównany do prawej)
        val_str = formatPLN(wartosc)
        c.setFont('DejaVuBold', 10)
        c.drawRightString(table_x + TABLE_W - 12, current_y + 12, val_str)

        # Linia pionowa oddzielająca kolumny
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.5)
        c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + ROW_H)

        current_y -= ROW_H

    # --- Pusty wiersz separujący ---
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)
    current_y -= ROW_H

    # --- Wiersz RAZEM ---
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=1, stroke=0)

    # Obramowanie wiersza RAZEM
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setLineWidth(0.8)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=0, stroke=1)

    c.setFillColorRGB(*TEXT_DARK)
    c.setFont('DejaVuBold', 11)
    c.drawString(table_x + 12, current_y + 12, "RAZEM:")

    razem_str = formatPLN(razem)
    c.setFont('DejaVuBold', 11)
    c.drawRightString(table_x + TABLE_W - 12, current_y + 12, razem_str)

    # Linia pionowa w wierszu RAZEM
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + HEADER_H)

    c.save()
    buf.seek(0)
    return buf


def generuj_pdf(dane, output_path):
    """Składa finalny PDF z szablonów i wygenerowanych tabel."""
    base = os.path.dirname(os.path.abspath(__file__))
    szablon1 = PdfReader(os.path.join(base, 'szablon_strona1.pdf'))
    szablon2 = PdfReader(os.path.join(base, 'szablon_strona2.pdf'))
    szablon34 = PdfReader(os.path.join(base, 'szablon_strony34.pdf'))

    writer = PdfWriter()

    # Strona 1 - okładka
    writer.add_page(szablon1.pages[0])

    # Dla każdej tabeli mebla - strona 2 z tabelą
    tabele = dane.get('tabele', [])
    for tabela in tabele:
        # Generuj warstwę z tabelą
        tabela_buf = generuj_strone_tabeli(tabela)
        tabela_reader = PdfReader(tabela_buf)
        tabela_page = tabela_reader.pages[0]

        # Pobierz ŚWIEŻĄ kopię tła dla każdej tabeli
        szablon2_fresh = PdfReader(os.path.join(base, 'szablon_strona2.pdf'))
        tlo_page = szablon2_fresh.pages[0]

        # Nałóż tabelę na tło
        tlo_page.merge_page(tabela_page)
        writer.add_page(tlo_page)

    # Strony 3 i 4
    for page in szablon34.pages:
        writer.add_page(page)

    with open(output_path, 'wb') as f:
        writer.write(f)

    print(f"OK:{output_path}")


if __name__ == '__main__':
    dane = json.loads(sys.argv[1])
    output_path = sys.argv[2]
    generuj_pdf(dane, output_path)
