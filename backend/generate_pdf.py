import sys
import json
import io
import os
from datetime import datetime
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

BASE = os.path.dirname(os.path.abspath(__file__))
OBRAZY = os.path.join(BASE, 'obrazy')
FONT_PATH = "/usr/share/fonts/truetype/dejavu/"

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
BG_DARK   = (0.498, 0.239, 0.435)
BG_LIGHT  = (0.906, 0.906, 0.906)
BG_WHITE  = (0.949, 0.949, 0.949)
TEXT_DARK  = (0.22, 0.18, 0.18)
TEXT_WHITE = (1, 1, 1)
TEXT_COLOR = (0.15, 0.12, 0.15)


def formatPLN(val):
    return f"{val:,.2f}".replace(',', ' ').replace('.', ',') + " zł"


def oblicz_razem(tabela):
    return float(tabela.get('razem', 0))


def szablon(nazwa):
    """Pobierz świeżą kopię strony szablonu z katalogu obrazów."""
    return PdfReader(os.path.join(OBRAZY, nazwa)).pages[0]


def generuj_warstwe_klienta(klient):
    """Nakłada dane klienta na podkład."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    nazwa = klient.get('nazwa', '')
    adres = klient.get('adres', '')
    telefon = klient.get('telefon', '')
    email = klient.get('email', '')
    uwagi = klient.get('uwagi', '')
    data = datetime.now().strftime('%d.%m.%Y')

    c.setFillColorRGB(*TEXT_COLOR)
    c.setFont('Poppins', 22)

    # Inwestor + adres (górny blok)
    if nazwa:
        c.drawString(75, 420, nazwa)
    if adres:
        c.drawString(75, 388, adres)

    # Telefon + email (środkowy blok)
    if telefon or email:
        y = 340
        if telefon:
            c.drawString(75, y, telefon)
            y -= 32
        if email:
            c.drawString(75, y, email)

    # Data wystawienia + ważność (dolny blok)
    c.setFont('Poppins', 20)
    c.drawString(75, 270, f'Data wystawienia: {data}')
    c.drawString(75, 238, 'Ważność oferty: 7 dni od daty wystawienia')

    # Uwagi
    if uwagi:
        c.setFont('Poppins', 16)
        c.drawString(75, 185, uwagi)

    c.save()
    buf.seek(0)
    return buf


def generuj_warstwe_zalozen(zalozenia_tekst):
    """Nakłada tekst założeń na podkład z checkbox jako bullet."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))

    punkty = [p.strip() for p in zalozenia_tekst.strip().split('\n') if p.strip()]

    # Checkbox PNG jako bullet
    checkbox_path = os.path.join(OBRAZY, 'check-box.png')
    checkbox_size = 28

    start_y = PAGE_H - 162
    line_h = 70
    bullet_x = 65
    text_x = 108
    max_text_w = PAGE_W - text_x - 80

    c.setFont('Poppins', 15)

    for i, punkt in enumerate(punkty):
        y = start_y - i * line_h
        if y < 40:
            break

        # Checkbox PNG
        if os.path.exists(checkbox_path):
            try:
                img = ImageReader(checkbox_path)
                c.drawImage(img, bullet_x, y - 4, width=checkbox_size,
                           height=checkbox_size, mask='auto')
            except Exception:
                c.setFillColorRGB(0.498, 0.239, 0.435)
                c.circle(bullet_x + 10, y + 10, 6, fill=1, stroke=0)
        else:
            c.setFillColorRGB(0.498, 0.239, 0.435)
            c.circle(bullet_x + 10, y + 10, 6, fill=1, stroke=0)

        # Tekst z zawijaniem
        words = punkt.split()
        lines = []
        line = ''
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, 'Poppins', 15) < max_text_w:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)

        c.setFillColorRGB(*TEXT_COLOR)
        c.drawString(text_x, y + 6, lines[0])
        for j, extra in enumerate(lines[1:], 1):
            c.drawString(text_x, y + 6 - j * 20, extra)

    c.save()
    buf.seek(0)
    return buf


def generuj_strone_tabeli(tabela):
    """Generuje warstwę tabeli wyceny."""
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
        c.line(table_x + COL_NAME_W, current_y,
               table_x + COL_NAME_W, current_y + ROW_H)
        current_y -= ROW_H

    # Separator
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
    c.line(table_x + COL_NAME_W, current_y,
           table_x + COL_NAME_W, current_y + HEADER_H)

    c.save()
    buf.seek(0)
    return buf


def generuj_pdf(dane, output_path):
    writer = PdfWriter()

    # 1. Okładka
    writer.add_page(szablon('okladka.pdf'))

    # 2. Dane klienta
    klient = dane.get('klient_dane', {})
    if klient:
        warstwa = generuj_warstwe_klienta(klient)
        tlo = szablon('podklad_klient.pdf')
        tlo.merge_page(PdfReader(warstwa).pages[0])
        writer.add_page(tlo)

    # 3. Obrazy z wybranej kategorii
    kategoria = dane.get('kategoria', '')
    if kategoria:
        obrazy_dir = os.path.join(OBRAZY, kategoria)
        if os.path.exists(obrazy_dir):
            i = 1
            while True:
                plik = os.path.join(obrazy_dir, f'{i}.pdf')
                if not os.path.exists(plik):
                    break
                try:
                    reader = PdfReader(plik)
                    for page in reader.pages:
                        writer.add_page(page)
                except Exception:
                    pass
                i += 1

    # 4. Założenia
    zalozenia = dane.get('zalozenia', '').strip()
    if zalozenia:
        warstwa = generuj_warstwe_zalozen(zalozenia)
        tlo = szablon('podklad_zalozenia.pdf')
        tlo.merge_page(PdfReader(warstwa).pages[0])
        writer.add_page(tlo)

    # 5. Tabele wyceny na podkładzie oferty cenowej
    for tabela in dane.get('tabele', []):
        tabela_buf = generuj_strone_tabeli(tabela)
        tlo = szablon('podklad_oferta_cenowa.pdf')
        tlo.merge_page(PdfReader(tabela_buf).pages[0])
        writer.add_page(tlo)

    # 6. Strona zaproszenia
    writer.add_page(szablon('koniec_zaproszenie.pdf'))

    # 7. Strona końcowa z hasłem
    writer.add_page(szablon('koniec_haslo.pdf'))

    with open(output_path, 'wb') as f:
        writer.write(f)
    print(f"OK:{output_path}")


if __name__ == '__main__':
    dane = json.loads(sys.argv[1])
    output_path = sys.argv[2]
    generuj_pdf(dane, output_path)
