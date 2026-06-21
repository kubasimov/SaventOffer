import sys
import json
import io
import os
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

BASE = os.path.dirname(os.path.abspath(__file__))
FONT_PATH = "/usr/share/fonts/truetype/dejavu/"

# Rejestruj DejaVu (fallback) i Poppins
pdfmetrics.registerFont(TTFont('DejaVu', FONT_PATH + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold', FONT_PATH + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Poppins', os.path.join(BASE, 'Poppins-Regular.ttf')))
pdfmetrics.registerFont(TTFont('PoppinsBold', os.path.join(BASE, 'Poppins-Bold.ttf')))

PAGE_W = 1190
PAGE_H = 842

TABLE_TOP = 630
COL_NAME_W = 697
COL_VAL_W = 238
TABLE_W = COL_NAME_W + COL_VAL_W

BG_DARK  = (0.498, 0.239, 0.435)
BG_LIGHT = (0.906, 0.906, 0.906)
BG_WHITE = (0.949, 0.949, 0.949)
TEXT_DARK  = (0.22, 0.18, 0.18)
TEXT_WHITE = (1, 1, 1)
BULLET_COLOR = (0.35, 0.28, 0.35)


def formatPLN(val):
    return f"{val:,.2f}".replace(',', ' ').replace('.', ',') + " zł"


def oblicz_razem(tabela):
    return float(tabela.get('razem', 0))


def generuj_warstwe_zalozen(zalozenia_tekst):
    """Generuje warstwę z tekstem założeń — nakładaną na szablon_zalozenia.pdf."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    punkty = [p.strip() for p in zalozenia_tekst.strip().split('\n') if p.strip()]

    # Pozycja startowa — pod drugą kreską nagłówka szablonu
    start_y = PAGE_H - 189
    line_h = 48
    bullet_x = 78
    text_x = 108
    max_text_w = PAGE_W - text_x - 100

    c.setFont('Poppins', 14)

    for i, punkt in enumerate(punkty):
        y = start_y - i * line_h
        if y < 55:
            break

        # Bullet — wypełniony okrąg
        c.setFillColorRGB(*BULLET_COLOR)
        c.circle(bullet_x, y + 7, 4, fill=1, stroke=0)

        # Tekst — zawijanie długich linii
        words = punkt.split()
        lines = []
        line = ''
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, 'Poppins', 14) < max_text_w:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)

        c.setFillColorRGB(*TEXT_DARK)
        c.drawString(text_x, y + 3, lines[0])
        for j, extra in enumerate(lines[1:], 1):
            c.drawString(text_x, y + 3 - j * 19, extra)

    c.save()
    buf.seek(0)
    return buf


def generuj_strone_tabeli(tabela):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    nazwa_mebla = tabela.get('nazwa_mebla', '')
    pozycje = tabela.get('pozycje', [])
    razem = oblicz_razem(tabela)

    TABLE_BOTTOM = 40
    dostepna_wys = TABLE_TOP - TABLE_BOTTOM
    n_elementow = 1 + len(pozycje) + 1 + 1
    wys_na_element = dostepna_wys / n_elementow
    ROW_H = min(36, max(18, wys_na_element))
    HEADER_H = min(38, max(20, wys_na_element))

    table_x = (PAGE_W - TABLE_W) / 2

    # Nagłówek
    c.setFillColorRGB(*BG_DARK)
    c.rect(table_x, TABLE_TOP, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setFillColorRGB(*TEXT_WHITE)
    c.setFont('PoppinsBold', 11)
    c.drawString(table_x + 12, TABLE_TOP + 13, nazwa_mebla)

    current_y = TABLE_TOP - ROW_H

    for i, poz in enumerate(pozycje):
        nazwa = poz.get('nazwa', '')
        wartosc = float(poz.get('wartosc_koncowa', 0))

        c.setFillColorRGB(*(BG_LIGHT if i % 2 == 0 else BG_WHITE))
        c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)

        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.setLineWidth(0.5)
        c.line(table_x, current_y, table_x + TABLE_W, current_y)

        c.setFillColorRGB(*TEXT_DARK)
        c.setFont('Poppins', 10)
        c.drawString(table_x + 12, current_y + 12, nazwa)

        c.setFont('PoppinsBold', 10)
        c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(wartosc))

        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.5)
        c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + ROW_H)

        current_y -= ROW_H

    # Pusty separator
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)
    current_y -= ROW_H

    # RAZEM
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setLineWidth(0.8)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=0, stroke=1)
    c.setFillColorRGB(*TEXT_DARK)
    c.setFont('PoppinsBold', 11)
    c.drawString(table_x + 12, current_y + 12, "RAZEM:")
    c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(razem))
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + HEADER_H)

    c.save()
    buf.seek(0)
    return buf


def generuj_pdf(dane, output_path):
    szablon1   = PdfReader(os.path.join(BASE, 'szablon_strona1.pdf'))
    szablon2   = PdfReader(os.path.join(BASE, 'szablon_strona2.pdf'))
    szablon_zal = PdfReader(os.path.join(BASE, 'szablon_zalozenia.pdf'))
    szablon34  = PdfReader(os.path.join(BASE, 'szablon_strony34.pdf'))

    writer = PdfWriter()

    # Strona 1 — okładka
    writer.add_page(szablon1.pages[0])

    # Strona założeń — tło z szablonu + warstwa tekstu
    zalozenia = dane.get('zalozenia', '').strip()
    if zalozenia:
        warstwa_buf = generuj_warstwe_zalozen(zalozenia)
        warstwa_reader = PdfReader(warstwa_buf)
        warstwa_page = warstwa_reader.pages[0]

        tlo_zal = PdfReader(os.path.join(BASE, 'szablon_zalozenia.pdf')).pages[0]
        tlo_zal.merge_page(warstwa_page)
        writer.add_page(tlo_zal)

    # Strony tabel mebli
    for tabela in dane.get('tabele', []):
        tabela_buf = generuj_strone_tabeli(tabela)
        tabela_reader = PdfReader(tabela_buf)
        tabela_page = tabela_reader.pages[0]

        tlo = PdfReader(os.path.join(BASE, 'szablon_strona2.pdf')).pages[0]
        tlo.merge_page(tabela_page)
        writer.add_page(tlo)

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
