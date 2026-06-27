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
COL_NAME_W = 594
COL_VAL_W = 200
TABLE_W = COL_NAME_W + COL_VAL_W
BG_DARK = (0.369, 0.180, 0.298)   # #5e2e4c
BG_LIGHT = (0.906, 0.906, 0.906)
BG_WHITE = (0.949, 0.949, 0.949)
TEXT_DARK = (0.22, 0.18, 0.18)
TEXT_WHITE = (1, 1, 1)
TEXT_COLOR = (0.15, 0.12, 0.15)
BULLET_COLOR = (0.35, 0.28, 0.35)
FONT_SIZE_ZAL = 22
LINE_H_ZAL = 82
INTER_LINE_ZAL = int(FONT_SIZE_ZAL * 1.58)
FONT_SIZE_TAB = 19
FONT_SIZE_TAB_BOLD = 20


def formatPLN(val):
    return f"{val:,.2f}".replace(',', ' ').replace('.', ',') + " zł"


def oblicz_razem(tabela):
    return float(tabela.get('razem', 0))


def szablon(nazwa):
    return PdfReader(os.path.join(OBRAZY, nazwa)).pages[0]


def rysuj_liste_z_checkbox(c, punkty, start_y, line_h, font_size, inter_line):
    checkbox_path = os.path.join(OBRAZY, 'check-box.png')
    checkbox_size = int(font_size * 1.3)
    bullet_x = 65
    text_x = 108
    max_text_w = PAGE_W - text_x - 80
    c.setFont('Poppins', font_size)
    for i, punkt in enumerate(punkty):
        y = start_y - i * line_h
        if y < 40:
            break
        if os.path.exists(checkbox_path):
            try:
                img = ImageReader(checkbox_path)
                c.drawImage(img, bullet_x, y - 4, width=checkbox_size, height=checkbox_size, mask='auto')
            except Exception:
                c.setFillColorRGB(*BULLET_COLOR)
                c.circle(bullet_x + 10, y + 10, 6, fill=1, stroke=0)
        else:
            c.setFillColorRGB(*BULLET_COLOR)
            c.circle(bullet_x + 10, y + 10, 6, fill=1, stroke=0)
        words = punkt.split()
        lines = []
        line = ''
        for word in words:
            test = (line + ' ' + word).strip()
            if c.stringWidth(test, 'Poppins', font_size) < max_text_w:
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
            c.drawString(text_x, y + 6 - j * inter_line, extra)


def generuj_warstwe_klienta(klient):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    nazwa = klient.get('nazwa', '')
    adres = klient.get('adres', '')
    nazwa_inwestycji = klient.get('nazwa_inwestycji', '')
    data = datetime.now().strftime('%d.%m.%Y')
    # Nazwa inwestycji: 12cm od góry (10 + 2), środek, Poppins 75
    if nazwa_inwestycji:
        c.setFillColorRGB(*TEXT_COLOR)
        c.setFont('Poppins', 75)
        text_w = c.stringWidth(nazwa_inwestycji, 'Poppins', 75)
        c.drawString((PAGE_W - text_w) / 2, PAGE_H - 340, nazwa_inwestycji)
    # Reszta danych: 22cm od góry (20 + 2), środek
    y = PAGE_H - 624
    if nazwa:
        c.setFont('Poppins', 30)
        label = 'Inwestor: '
        label_w = c.stringWidth(label, 'Poppins', 30)
        full_text_w = label_w + c.stringWidth(nazwa, 'PoppinsBold', 36)
        start_x = (PAGE_W - full_text_w) / 2
        c.drawString(start_x, y, label)
        c.setFont('PoppinsBold', 36)
        c.drawString(start_x + label_w, y, nazwa)
        y -= 60
    if adres:
        c.setFont('Poppins', 30)
        text_w = c.stringWidth(f'Lokalizacja: {adres}', 'Poppins', 30)
        c.drawString((PAGE_W - text_w) / 2, y, f'Lokalizacja: {adres}')
        y -= 50
    c.setFont('Poppins', 30)
    c.drawCentredString(PAGE_W / 2, y, f'Data wystawienia: {data}')
    y -= 50
    c.drawCentredString(PAGE_W / 2, y, 'Ważność oferty: 5 dni od daty wystawienia')
    c.save()
    buf.seek(0)
    return buf


def generuj_warstwe_zalozen(zalozenia_tekst):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    punkty = [p.strip() for p in zalozenia_tekst.strip().split('\n') if p.strip()]
    start_y = PAGE_H - 162 - FONT_SIZE_ZAL * 2
    rysuj_liste_z_checkbox(c, punkty, start_y, LINE_H_ZAL, FONT_SIZE_ZAL, INTER_LINE_ZAL)
    c.save()
    buf.seek(0)
    return buf


def generuj_warstwe_specyfikacji(specyfikacja):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    punkty = [p.strip() for p in specyfikacja if p.strip()]
    start_y = PAGE_H - 162 - FONT_SIZE_ZAL * 2
    rysuj_liste_z_checkbox(c, punkty, start_y, LINE_H_ZAL, FONT_SIZE_ZAL, INTER_LINE_ZAL)
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
    c.setFillColorRGB(*BG_DARK)
    c.rect(table_x, TABLE_TOP, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setFillColorRGB(*TEXT_WHITE)
    c.setFont('PoppinsBold', FONT_SIZE_TAB_BOLD)
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
        c.setFont('Poppins', FONT_SIZE_TAB)
        c.drawString(table_x + 12, current_y + 12, nazwa)
        c.setFont('PoppinsBold', FONT_SIZE_TAB)
        c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(wartosc))
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.5)
        c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + ROW_H)
        current_y -= ROW_H
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)
    current_y -= ROW_H
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setLineWidth(0.8)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=0, stroke=1)
    c.setFillColorRGB(*TEXT_DARK)
    c.setFont('PoppinsBold', FONT_SIZE_TAB_BOLD)
    c.drawString(table_x + 12, current_y + 12, "RAZEM:")
    c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(razem))
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + HEADER_H)
    c.save()
    buf.seek(0)
    return buf


def generuj_strone_z_obrazem(sciezka_obrazu):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    podklad_obraz = os.path.join(OBRAZY, 'podklad_obraz.pdf')
    try:
        from PIL import Image as PILImage
        img_pil = PILImage.open(sciezka_obrazu)
        img_w, img_h = img_pil.size
    except Exception:
        img_w, img_h = 800, 600
    OBSZAR_TOP = PAGE_H - 162
    OBSZAR_BOT = 40
    OBSZAR_LEFT = 60
    OBSZAR_RIGHT = PAGE_W - 60
    dostepna_sz = OBSZAR_RIGHT - OBSZAR_LEFT
    dostepna_wys = OBSZAR_TOP - OBSZAR_BOT
    skala_sz = dostepna_sz / img_w
    skala_wys = dostepna_wys / img_h
    skala = min(skala_sz, skala_wys)
    rys_w = img_w * skala
    rys_h = img_h * skala
    x = OBSZAR_LEFT + (dostepna_sz - rys_w) / 2
    y = OBSZAR_TOP - rys_h
    img = ImageReader(sciezka_obrazu)
    c.drawImage(img, x, y, width=rys_w, height=rys_h, preserveAspectRatio=True, mask='auto')
    c.save()
    buf.seek(0)
    if os.path.exists(podklad_obraz):
        tlo = PdfReader(podklad_obraz).pages[0]
        buf_reader = PdfReader(buf)
        tlo_page = tlo
        merged = buf_reader.pages[0]
        tlo.merge_page(merged)
        out_buf = io.BytesIO()
        writer = PdfWriter()
        writer.add_page(tlo)
        writer.write(out_buf)
        out_buf.seek(0)
        return out_buf
    return buf


def generuj_strone_podsumowania(tabele):
    """Tabelka zestawienia: kazdy mebel + jego cena."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
    TABLE_BOTTOM = 40
    dostepna_wys = TABLE_TOP - TABLE_BOTTOM
    n_elementow = 1 + len(tabele) + 1 + 1
    wys_na_element = dostepna_wys / n_elementow
    ROW_H = min(36, max(18, wys_na_element))
    HEADER_H = min(38, max(20, wys_na_element))
    table_x = (PAGE_W - TABLE_W) / 2
    # Nagłówek
    c.setFillColorRGB(*BG_DARK)
    c.rect(table_x, TABLE_TOP, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setFillColorRGB(*TEXT_WHITE)
    c.setFont('PoppinsBold', FONT_SIZE_TAB_BOLD)
    c.drawString(table_x + 12, TABLE_TOP + 13, 'Zestawienie')
    c.drawRightString(table_x + TABLE_W - 12, TABLE_TOP + 13, 'Cena')
    # Wiersze
    current_y = TABLE_TOP - ROW_H
    for i, tabela in enumerate(tabele):
        nazwa = tabela.get('nazwa_mebla', '')
        wartosc = oblicz_razem(tabela)
        c.setFillColorRGB(*(BG_LIGHT if i % 2 == 0 else BG_WHITE))
        c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)
        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.setLineWidth(0.5)
        c.line(table_x, current_y, table_x + TABLE_W, current_y)
        c.setFillColorRGB(*TEXT_DARK)
        c.setFont('Poppins', FONT_SIZE_TAB)
        c.drawString(table_x + 12, current_y + 12, nazwa)
        c.setFont('PoppinsBold', FONT_SIZE_TAB)
        c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(wartosc))
        c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + ROW_H)
        current_y -= ROW_H
    # Razem
    suma = sum(oblicz_razem(t) for t in tabele)
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, ROW_H, fill=1, stroke=0)
    current_y -= ROW_H
    c.setFillColorRGB(*BG_LIGHT)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=1, stroke=0)
    c.setStrokeColorRGB(0.7, 0.7, 0.7)
    c.setLineWidth(0.8)
    c.rect(table_x, current_y, TABLE_W, HEADER_H, fill=0, stroke=1)
    c.setFillColorRGB(*TEXT_DARK)
    c.setFont('PoppinsBold', FONT_SIZE_TAB_BOLD)
    c.drawString(table_x + 12, current_y + 12, 'RAZEM:')
    c.drawRightString(table_x + TABLE_W - 12, current_y + 12, formatPLN(suma))
    c.line(table_x + COL_NAME_W, current_y, table_x + COL_NAME_W, current_y + HEADER_H)
    c.save()
    buf.seek(0)
    return buf


def generuj_pdf(dane, output_path):
    writer = PdfWriter()
    writer.add_page(szablon('okladka.pdf'))
    klient = dane.get('klient_dane') or {}
    podklad_klient = os.path.join(OBRAZY, 'podklad_klient.pdf')
    if klient and any(klient.values()) and os.path.exists(podklad_klient):
        warstwa = generuj_warstwe_klienta(klient)
        tlo = szablon('podklad_klient.pdf')
        tlo.merge_page(PdfReader(warstwa).pages[0])
        writer.add_page(tlo)
    wlasne_obrazy = dane.get('wlasne_obrazy', [])
    if wlasne_obrazy:
        for plik in wlasne_obrazy:
            if os.path.exists(plik):
                try:
                    # Najpierw próbuj otworzyć jako obraz (PIL wykrywa po magic bytes)
                    from PIL import Image as PILImage
                    img_test = PILImage.open(plik)
                    img_test.verify()
                    strona_buf = generuj_strone_z_obrazem(plik)
                    writer.add_page(PdfReader(strona_buf).pages[0])
                except Exception:
                    # Jeśli to nie obraz, spróbuj jako PDF
                    try:
                        reader = PdfReader(plik)
                        for page in reader.pages:
                            writer.add_page(page)
                    except Exception as e:
                        print(f'Błąd pliku {plik}: {e}', file=sys.stderr)
    else:
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
    # Strona z naszymi standardami (podklad_nasze_standardy.pdf)
    nasze_standardy = os.path.join(OBRAZY, 'podklad_nasze_standardy.pdf')
    if os.path.exists(nasze_standardy):
        writer.add_page(szablon('podklad_nasze_standardy.pdf'))
    zalozenia = dane.get('zalozenia', '').strip()
    # Strona z informacjami (podklad_informacje.pdf) — dane z założeń
    podklad_info = os.path.join(OBRAZY, 'podklad_informacje.pdf')
    if zalozenia and os.path.exists(podklad_info):
        warstwa = generuj_warstwe_zalozen(zalozenia)
        tlo = szablon('podklad_informacje.pdf')
        tlo.merge_page(PdfReader(warstwa).pages[0])
        writer.add_page(tlo)
    specyfikacja = dane.get('specyfikacja', [])
    podklad_spec = os.path.join(OBRAZY, 'podklad_specyfikacja.pdf')
    if specyfikacja and os.path.exists(podklad_spec):
        warstwa = generuj_warstwe_specyfikacji(specyfikacja)
        tlo = PdfReader(podklad_spec).pages[0]
        tlo.merge_page(PdfReader(warstwa).pages[0])
        writer.add_page(tlo)
    for tabela in dane.get('tabele', []):
        tabela_buf = generuj_strone_tabeli(tabela)
        tlo = szablon('podklad_oferta_cenowa.pdf')
        tlo.merge_page(PdfReader(tabela_buf).pages[0])
        writer.add_page(tlo)
    # Podsumowanie wszystkich mebli
    tabele = dane.get('tabele', [])
    if tabele:
        podsumowanie_buf = generuj_strone_podsumowania(tabele)
        tlo = szablon('podklad_oferta_cenowa.pdf')
        tlo.merge_page(PdfReader(podsumowanie_buf).pages[0])
        writer.add_page(tlo)
    spacer = os.path.join(OBRAZY, 'spacer_vr.pdf')
    if os.path.exists(spacer):
        reader = PdfReader(spacer)
        for page in reader.pages:
            writer.add_page(page)
    koniec_zap = os.path.join(OBRAZY, 'koniec_zaproszenie.pdf')
    if os.path.exists(koniec_zap):
        writer.add_page(PdfReader(koniec_zap).pages[0])
    koniec_haslo = os.path.join(OBRAZY, 'koniec_haslo.pdf')
    if os.path.exists(koniec_haslo):
        writer.add_page(PdfReader(koniec_haslo).pages[0])
    with open(output_path, 'wb') as f:
        writer.write(f)
    print(f"OK:{output_path}")


if __name__ == '__main__':
    with open(sys.argv[1], 'r') as f:
        dane = json.load(f)
    output_path = sys.argv[2]
    generuj_pdf(dane, output_path)
