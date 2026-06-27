# Specyfikacja aplikacji Savento

Niniejszy dokument stanowi kompleksową specyfikację aplikacji Savento – systemu B2B do zarządzania ofertami meblowymi i automatycznego generowania ofert w formacie PDF. Dokument został przygotowany tak, aby inny dewloper mógł na jego podstawie odtworzyć aplikację od zera.

---

## 1. Opis ogólny aplikacji

Savento to aplikacja do zarządzania ofertami meblowymi. Umożliwia tworzenie oferty od konfiguracji mebli, wyceny, generowania PDF z własnymi szablonami i załadowaniem obrazów realizacji.

### Główne funkcje
- Autoryzacja użytkowników (logowanie, rejestracja, role ADMIN_PRACOWNIK / PRACOWNIK).
- Zarządzanie klientami, cennikiem, meblami i pozycjami w tabelach.
- Sztuczna inteligencja (Whisper) do dyktowania tekstu założeń i uwag.
- Kreator PDF z wieloma krokami (dane klienta, założenia, specyfikacja, obrazy, generowanie).
- Generowanie PDF przez moduł Pythonowy z szablonami ReportLab/PyPDF2.
- Możliwość wgrywania własnych obrazów realizacji, które są nakładane na szablony PDF.
- Import danych z plików XLSX.
- Ustawienia systemowe i specyfikacja domyślna.

### Wymagania funkcjonalne (stos technologiczny)
- **Frontend:** React 19 + Vite 8, React Router DOM 7
- **Backend:** Node.js + Express 5
- **Baza danych:** PostgreSQL
- **Moduł PDF:** Python 3 + ReportLab + PyPDF2 + PIL
- **Autoryzacja:** JWT + bcrypt
- **Inne:** multer (multipart), axios, xlsx, cors, helmet

---

## 2. Architektura systemu

Aplikacja składa się z dwóch głównych modułów:

```
/opt/savento/
├── backend/   # Node.js + Python
│   ├── routes/
│   │   ├── auth.js
│   │   ├── cennik.js
│   │   ├── klienci.js
│   │   ├── oferty.js
│   │   ├── pdf.js
│   │   ├── import.js
│   │   ├── users.js
│   │   ├── whisper.js
│   │   └── ustawienia.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── admin.js
│   ├── db/
│   │   └── pool.js
│   ├── utils/
│   │   ├── calc.js
│   │   └── password.js
│   ├── obrazy/                 # szablony PDF i obrazy
│   ├── generate_pdf.py
│   ├── server.js
│   └── config.js
└── frontend/
    └── src/
        ├── components/
        ├── pages/
        ├── utils/
        └── ...
```

### Backend
Serwer nasłuchuje na porcie zdefiniowanym w zmiennej środowiskowej `PORT` (domyślnie 3001). Udostępnia REST API w prefixie `/api`.

### Frontend
Aplikacja React uruchamiana przez Vite dev serwer (domyślnie port 5173) lub jako statyczny bundle przez `vite build` + `vite preview`.

---

## 3. Baza danych – schemat

Baza danych PostgreSQL zawiera tabele opisane w pliku `/opt/savento/backend/migrate.sql`:

### Tabele:

**users** – dane użytkowników systemu
- `id` UUID PRIMARY KEY
- `imie_nazwisko` VARCHAR(100) NOT NULL
- `email` VARCHAR(100) UNIQUE NOT NULL
- `haslo_hash` VARCHAR(255) NOT NULL
- `rola` VARCHAR(20) DEFAULT 'pracownik' (ADMIN_PRACOWNIK lub PRACOWNIK)
- `aktywny` BOOLEAN DEFAULT true
- `utworzony` TIMESTAMP DEFAULT NOW()

**clients** – klienci
- `id` UUID PRIMARY KEY
- `nazwa` VARCHAR(200) NOT NULL
- `kontakt` VARCHAR(100)
- `email` VARCHAR(100)
- `telefon` VARCHAR(30)
- `uwagi` TEXT
- `utworzony` TIMESTAMP DEFAULT NOW()

**price_list** – cennik
- `id` UUID PRIMARY KEY
- `nazwa` VARCHAR(200) NOT NULL
- `opis` TEXT
- `cena` NUMERIC(10,2) NOT NULL
- `jednostka` VARCHAR(10) NOT NULL
- `aktywny` BOOLEAN DEFAULT true
- `zaktualizowany` TIMESTAMP DEFAULT NOW()

**offers** – oferty
- `id` UUID PRIMARY KEY
- `klient_id` UUID REFERENCES clients(id)
- `uzytkownik_id` UUID REFERENCES users(id)
- `numer` VARCHAR(50) UNIQUE NOT NULL
- `status` VARCHAR(20) DEFAULT 'szkic'
- `data_oferty` DATE DEFAULT CURRENT_DATE
- `uwagi` TEXT
- `utworzony` TIMESTAMP DEFAULT NOW()

**furniture_tables** – tabele mebli w ofercie
- `id` UUID PRIMARY KEY
- `oferta_id` UUID REFERENCES offers(id) ON DELETE CASCADE
- `nazwa_mebla` VARCHAR(200) NOT NULL
- `kolejnosc` INT DEFAULT 1
- `korekta_pct` NUMERIC(5,2)
- `razem_przed` NUMERIC(10,2)
- `razem` NUMERIC(10,2)

**table_items** – pozycje w tabeli mebla
- `id` UUID PRIMARY KEY
- `tabela_id` UUID REFERENCES furniture_tables(id) ON DELETE CASCADE
- `cennik_id` UUID REFERENCES price_list(id)
- `nazwa` VARCHAR(200) NOT NULL
- `wymiar_x` NUMERIC(8,3)
- `wymiar_y` NUMERIC(8,3)
- `ilosc` NUMERIC(8,3) NOT NULL
- `jednostka` VARCHAR(10) NOT NULL
- `cena_jedn` NUMERIC(10,2) NOT NULL
- `kolejnosc` INT DEFAULT 1

### Indeksy
- idx_offers_klient ON offers(klient_id)
- idx_furniture_oferta ON furniture_tables(oferta_id)
- idx_items_tabela ON table_items(tabela_id)

---

## 4. Struktura plików szablonów PDF (krytyczne dla generowania)

Wszystkie szablony PDF i obrazy znajdują się w katalogu:  
`/opt/savento/backend/obrazy/`

### 4.1. Podstawowe pliki wymagane do działania aplikacji

Poniższe pliki są OBRÓBIONE przez `generate_pdf.py` i muszą istnieć, aby generowanie PDF działało poprawnie. Brak dowolnego z nich spowoduje pominięcie sekcji w PDF lub błąd generowania.

| Plik | Opis | Uwagi |
|------|------|-------|
| `okladka.pdf` | Okładka oferty (strona 1) | Wymagany – jest dodawany na początku każdego PDF |
| `podklad_klient.pdf` | Tło dla danych klienta | Opcjonalny – jeśli istnieje, generowana warstwa z danymi klienta jest na nim nakładana |
| `podklad_zalozenia.pdf` | Tło dla założeń oferty | Opcjonalny – jeśli istnieje, punkty założeń są na nim nakładane |
| `podklad_specyfikacja.pdf` | Tło dla specyfikacji materiałowej | Opcjonalny – jeśli istnieje, lista specyfikacji jest na nim nakładana |
| `podklad_oferta_cenowa.pdf` | Tło dla tabeli wyceny | Opcjonalny – jeśli istnieje, tabela z cenami jest na nim nakładana |
| `podklad_obraz.pdf` | Tło dla własnych obrazów realizacji | Opcjonalny – jeśli istnieje, wgrane przez użytkownika obrazy są na nim nakładane |
| `spacer_vr.pdf` | Separator (strona spacer) | Opcjonalny – jeśli istnieje, dodawany między sekcjami |
| `koniec_zaproszenie.pdf` | Strona z zaproszeniem | Opcjonalna – jeśli istnieje, dodawana przed końcem |
| `koniec_haslo.pdf` | Strona końcowa z hasłem | Opcjonalna – jeśli istnieje, dodawana na koniec |
| `check-box.png` | Ikona checkboxa do listy | Opcjonalna – jeśli brak, rysowane są kółka jako bullet points |
| `ZALOZENIA.txt` | Domyślny tekst założeń | Opcjonalny – jeśli brak, API zwraca pusty tekst |

### 4.2. Kategorie obrazów

W katalogu `obrazy/` mogą istnieć dodatkowe foldery, które są wykrywane automatycznie przez endpoint `GET /api/pdf/kategorie`. Każdy folder zawiera pliki `1.pdf`, `2.pdf`, itd., które są dodawane do PDF w kolejności numerycznej.

Przykładowe kategorie (istniejące w aktualnym projekcie):
- `BIURO_DOMOWE/`
- `LAZIENKA/`
- `POKOJ_DZIECIECY/`
- `POKOJ_MLODZIEZOWY/`
- `SALON/`

Każdy plik `N.pdf` w kategorii reprezentuje jedną stronę obrazu realizacji.

### 4.3. Wymagania techniczne dla szablonów PDF

Wszystkie szablony PDF muszą spełniać następujące wymagania:

- **Rozmiar strony:** A4 w orientacji poziomym (landscape) = 1190×842 punktów (pt)
- **Format:** PDF w wersji 1.4 lub wyższej
- **Kodowanie:** PDF z wewnętrznymi czcionkami lub z zewnętrznimi fontami wbudowanymi
- **Strony:** każdy szablon powinien mieć dokładnie 1 stronę
- **Tło:** szablony mogą być transparentne lub mieć tło graficzne

### 4.4. Obrazy użytkownika (wgrywane przez frontend)

Użytkownik może wgrać własne obrazy w formatach:
- JPG/JPEG
- PNG

Obrazy są przetwarzane przez `generate_pdf.py` w następujący sposób:
1. Obraz jest przeskalowany, aby zmieścić się w obszarze strony (od Y=40 do Y=PAGE_H-162)
2. Zachowywane jest proporcje obrazu
3. Obraz jest wyśrodkowany poziomo
4. Jeśli istnieje `podklad_obraz.pdf`, obraz jest nanoszony na jego tle za pomocą ReportLab
5. Strona jest zapisywana jako PDF i dodawana do głównego dokumentu

---

## 5. Struktura endpointów API

### 5.1. Autoryzacja

- `POST /api/auth/login` – logowanie (zwraca JWT)
- `POST /api/auth/register` – rejestracja nowego użytkownika
- Middleware `requireAuth` sprawdza token JWT w nagłówku `Authorization: Bearer <token>`
- Rola `ADMIN_PRACOWNIK` ma uprawnienia administracyjne

### 5.2. Zarządzanie ofertami

- `GET /api/oferty` – lista ofert
- `GET /api/oferty/:id` – szczegóły oferty
- `POST /api/oferty` – tworzenie nowej oferty
- `PUT /api/oferty/:id` – aktualizacja oferty
- `DELETE /api/oferty/:id` – usunięcie oferty

Oferta zawiera:
- Tabele mebli (`furniture_tables`) z pozycjami (`table_items`)
- Powiązania z klientem (`clients`) i użytkownikiem (`users`)
- Korekty procentowe na poziomie tabeli i globalne

### 5.3. Generowanie PDF (kluczowe endpointy)

**GET /api/pdf/kategorie**
- Zwraca listę kategorii obrazów z folderu `obrazy/`
- Każda kategoria ma `nazwa` i `pliki` (liczbę stron PDF)
- Wymagane uprawnienia: zalogowany użytkownik

**GET /api/pdf/zalozenia-domyslne**
- Odczytuje plik `/opt/savento/backend/obrazy/ZALOZENIA.txt`
- Zwraca `{ "tekst": "..." }` z domyślnymi założeniami
- Jeśli plik nie istnieje, zwraca pusty tekst

**POST /api/pdf/:id**
- Generuje PDF dla oferty o podanym ID
- Przyjmuje JSON: `zalozenia`, `klient_dane`, `specyfikacja`, `kategoria`
- Jeśli `kategoria` jest podana, dodaje obrazy z folderu `obrazy/{kategoria}/`
- Używa skryptu Python `generate_pdf.py` do generowania
- Zwraca plik PDF jako attachment

**POST /api/pdf/:id/z-obrazami** (multipart/form-data)
- Generuje PDF dla oferty o podanym ID z własnymi obrazami
- Przyjmuje multipart: `zalozenia`, `klient_dane` (JSON string), `specyfikacja` (JSON string), `obraz_N` (pliki)
- Obrazy są sortowane po nazwie pola (`obraz_0`, `obraz_1`, itd.)
- Pliki tymczasowe są usuwane po wygenerowaniu PDF
- Zwraca plik PDF jako attachment

### 5.4. Inne endpointy

- `GET /api/cennik` – lista pozycji cennika
- `GET /api/klienci` – lista klientów
- `GET /api/klienci/:id` – szczegóły klienta
- `GET /api/ustawienia/specyfikacja_domyslna` – domyślna specyfikacja z bazy
- `POST /api/whisper/transkrybuj` – transkrypcja audio przez Whisper (OpenAI)
- `POST /api/import` – import danych z XLSX
- `GET /api/users` – lista użytkowników (admin)
- `GET /api/health` – health check (zwraca `{"status":"ok"}`)

---

## 6. Kreator PDF (frontend)

Kreator PDF (`KreatorPDF.jsx`) składa się z 5 kroków:

### Krok 1 – Dane klienta
- Nazwa inwestycji
- Wybór klienta z bazy lub ręczny wpis
- Imię i nazwisko / Firma
- Adres
- Telefon
- Email
- Uwagi do klienta

### Krok 2 – Założenia
- Textarea do wpisania założeń oferty
- Każda linia to osobny punkt listy
- Domyślnie wypełniane z `/api/pdf/zalozenia-domyslne`

### Krok 3 – Specyfikacja
- Lista punktów specyfikacji materiałowej
- Możliwość zaznaczania/odznaczania poszczególnych punktów
- Możliwość dodania własnych punktów
- Domyślnie ładowana z `/api/ustawienia/specyfikacja_domyslna`

### Krok 4 – Obrazy
- Wybór kategorii obrazów z radiobuttonami
- Opcja "Bez obrazów"
- Możliwość wgrywania własnych plików (JPG/PNG)
- Własne obrazy są wysyłane jako multipart/form-data

### Krok 5 – Podsumowanie
- Lista wszystkich sekcji PDF
- Przycisk "Generuj PDF"
- Przycisk "Bez założeń i danych" (szybkie generowanie)

---

## 7. Moduł generowania PDF (`generate_pdf.py`)

### Struktura dokumentu PDF (kolejność stron)

1. **Okładka** – zawsze: `obrazy/okladka.pdf`
2. **Dane klienta** – jeśli podano i istnieje `podklad_klient.pdf`
3. **Obrazy realizacji** – w zależności od wybranej kategorii lub własnych plików
4. **Założenia** – jeśli podano tekst i istnieje `podklad_zalozenia.pdf`
5. **Specyfikacja** – jeśli podano punkty i istnieje `podklad_specyfikacja.pdf` (lub `podklad_zalozenia.pdf` jako fallback)
6. **Tabele wyceny** – dla każdej tabeli mebla w ofercie
7. **Spacer VR** – jeśli istnieje `spacer_vr.pdf`
8. **Strona zaproszenia** – jeśli istnieje `koniec_zaproszenie.pdf`
9. **Strona końcowa** – jeśli istnieje `koniec_haslo.pdf`

### Kluczowe funkcje modułu

- `generuj_warstwe_klienta(klient)` – generuje stronę z danymi klienta
- `generuj_warstwe_zalozen(zalozenia_tekst)` – generuje listę założeń z checkboxami
- `generuj_warstwe_specyfikacji(specyfikacja)` – generuje listę specyfikacji
- `generuj_strone_tabeli(tabela)` – generuje tabelę z wyceneną
- `generuj_strone_z_obrazem(sciezka_obrazu)` – generuje stronę z własnym obrazem na podkładzie
- `generuj_pdf(dane, output_path)` – główna funkcja łącząca wszystkie warstwy

### Wymagania bibliotek Python
- `pypdf` (PyPDF2) – odczyt/zapis PDF
- `reportlab` – generowanie warstw graficznych
- `PIL` (Pillow) – odczyt wymiarów obrazów
- `json`, `io`, `os`, `sys`, `datetime` – standardowa biblioteka

### Parametry strony
- Szerokość: 1190 pt
- Wysokość: 842 pt (A4 landscape)
- Kolory: określone w stałych (BG_DARK, BG_LIGHT, TEXT_DARK, itp.)
- Czcionki: DejaVu, Poppins (wymagane pliki TTF w katalogu backendu)

---

## 8. Wymagane pliki szablonów – szczegółowy opis

### 8.1. Pliki obowiązkowe do działania

#### `okladka.pdf`
- Pierwsza stronka każdej oferty
- Rozmiar: A4 landscape (1190×842 pt)
- Zawiera logo, nazwę firmy, miejsce na numer oferty

#### `check-box.png` (lub `check-box.png`)
- Ikona checkboxa używana w generowaniu list założeń i specyfikacji
- Rozmiar: zależny od czcionki (domyślnie FontSize × 1.3)
- Format: PNG z przezroczystością
- Jeśli brak – rysowane są kółka

### 8.2. Pliki opcjonalne (sekcje warunkowe)

#### `podklad_klient.pdf`
- Tło na które nakładane są dane klienta
- Strona powinna mieć obszar do wpisania: nazwa inwestycji, inwestor, lokalizacja, data

#### `podklad_zalozenia.pdf`
- Tło listy założeń oferty
- Obszar od Y=40 do Y=PAGE_H-162

#### `podklad_specyfikacja.pdf`
- Tło listy specyfikacji materiałowej
- Jeśli brakuje, używany jest `podklad_zalozenia.pdf`

#### `podklad_oferta_cenowa.pdf`
- Tło tabeli wyceny
- Nagłówek: nazwa mebla
- Treść: pozycje, wymiary, ceny, suma

#### `podklad_obraz.pdf`
- Tło dla własnych obrazów uploadowanych przez użytkownika
- Obszar od Y=40 do Y=PAGE_H-162, od X=60 do X=PAGE_W-60
- Obraz użytkownika jest nanoszony na to tło

#### `spacer_vr.pdf`
- Strona separatorska (np. z efektem VR lub fade)

#### `koniec_zaproszenie.pdf`
- Strona z personalizowanym zaproszeniem

#### `koniec_haslo.pdf`
- Strona końcowa z hasłem lub stopką

### 8.3. Pliki konfiguracyjne

#### `ZALOZENIA.txt`
- Domyślny tekst założeń oferty
- Każda linia = osobny punkt
- Kodowanie UTF-8

---

## 9. Wymagania systemowe

### Wymagania sprzętowe/softwareowe
- System operacyjny: Linux (Ubuntu/Debian)
- Node.js 18+ (backend)
- npm 9+
- Python 3.9+
- PostgreSQL 13+
- Pamięć: minimum 2 GB RAM (do generowania PDF)
- Przestrzeń dyskowa: minimum 10 GB (na szablony PDF i cache)

### Zmienne środowiskowe (backend `.env`)
```
PORT=3001
JWT_SECRET=<tajny_klucz_JWT>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=savento_db
DB_USER=savento
DB_PASSWORD=<haslo_bazy>
GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_secret>
NODE_ENV=development|production
```

### Zainstalowane zależności backendu (package.json)
```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "form-data": "^4.0.5",
    "google-auth-library": "^10.7.0",
    "helmet": "^8.2.0",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.1.1",
    "node-fetch": "^2.7.0",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "pg": "^8.21.0",
    "uuid": "^14.0.0",
    "xlsx": "^0.18.5",
    "jest": "^30.4.2",
    "supertest": "^7.2.2"
  }
}
```

### Zainstalowane zależności frontendu (package.json)
```json
{
  "dependencies": {
    "axios": "^1.17.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.17.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.1",
    "vite": "^8.0.12",
    "eslint": "^10.3.0"
  }
}
```

### Zainstalowane zależności Python
```
pypdf
reportlab
Pillow
```

---

## 10. Bezpieczeństwo

- Wszystkie zapytania (poza `/api/auth/login` i `/api/auth/register`) wymagają tokenu JWT
- Hasła przechowywane są jako bcrypt hash
- Middleware auth.js weryfikuje token i ustawia `req.user`
- Middleware admin.js sprawdza rolę `ADMIN_PRACOWNIK`
- CORS i Helmet są skonfigurowane w `server.js`
- Plik `.env` nie powinien być commitowany do repozytorium
- W produkcji ustawić `NODE_ENV=production`

---

## 11. Krok po kroku – jak uruchomić aplikację od zera

### 11.1. Baza danych

1. Zainstaluj PostgreSQL
2. Utwórz bazę danych: `CREATE DATABASE savento_db;`
3. Utwórz użytkownika: `CREATE USER savento WITH PASSWORD '<haslo>';`
4. Przyznaj uprawnienia: `GRANT ALL PRIVILEGES ON DATABASE savento_db TO savento;`
5. Uruchom migrację: `psql -U savento -d savento_db -f backend/migrate.sql`

### 11.2. Backend

1. Przejdź do katalogu: `cd /opt/savento/backend`
2. Zainstaluj zależności: `npm install`
3. Skonfiguruj `.env` zgodnie z sekcją 9
4. Uruchom serwer: `node server.js` lub `npm start`
5. Serwer będzie nasłuchiwać na porcie 3001

### 11.3. Frontend

1. Przejdź do katalogu: `cd /opt/savento/frontend`
2. Zainstaluj zależności: `npm install`
3. Uruchom dev serwer: `npm run dev` (port 5173)
4. Zbuduj do produkcji: `npm run build`
5. Serwuj statyczne pliki: `npm run preview`

### 11.4. Szablony PDF

1. Utwórz katalog: `mkdir -p backend/obrazy/`
2. Dodaj wymagane pliki szablonów (sekcja 8)
3. Dla każdej kategorii obrazów utwórz podkatalog z plikami `1.pdf`, `2.pdf`, itd.
4. Sprawdź, czy `podklad_obraz.pdf` istnieje jeśli chcesz obsługiwać własne obrazy

---

## 12. Rozwój i testy

### Testy backendu
- Uruchom testy: `cd /opt/savento/backend && npm test`
- Testy używają Jest + Supertest
- Specjalny test dla endpointu `/api/pdf/:id/z-obrazami` znajduje się w `backend/routes/pdf.test.js`

### Testy i weryfikacja PDF
- Skrypt weryfikacyjny Python: `/tmp/hermes-verify-generate_pdf.py`
- Sprawdza: eksport funkcji, generowanie PDF z obrazem, poprawność struktury pliku

### Lintowanie
- Frontend: `npm run lint` (eslint)

---

## 13. Struktura komponentów frontendu

### Strony (pages/)
- `Login.jsx` – logowanie/rejestracja
- `Oferty.jsx` – lista ofert
- `EdytorOferty.jsx` – edycja oferty z meblami
- `Klienci.jsx` – zarządzanie klientami
- `Cennik.jsx` – zarządzanie cennikiem
- `Import.jsx` – import z XLSX
- `Uzytkownicy.jsx` – zarządzanie użytkownikami (admin)
- `Ustawienia.jsx` – ustawienia domyślne
- `Profil.jsx` – profil użytkownika

### Komponenty (components/)
- `KreatorPDF.jsx` – 5-krokowy kreator PDF (najważniejszy komponent)
- `TabelaMebla.jsx` – edycja tabeli mebla (pozycje, wymiary, ceny)
- `WIklejTekst.jsx` – wklejanie tekstu z schowka
- `AudioUpload.jsx` – upload plików audio
- `MikrofonBtn.jsx` – przycisk mikrofonu
- `MikrofonCiagly.jsx` – ciągłe dyktowanie
- `HistoriaDyktowania.jsx` – historia transkrypcji
- `ModalZalozenia.jsx` – modal założeń

### Context API
- `AuthContext.jsx` – kontekst autoryzacji (stan zalogowania, użytkownik, login/logout)

### Narzędzia (utils/)
- `calc.js` – obliczenia cen (korekty, zaokrąglania)
- `parsujMowe.js` – parsowanie transkrypcji głosowej na dane strukturalne

---

## 14. Przepływ generowania PDF (szczegółowy)

### 14.1. Z kategorii obrazów
1. Użytkownik wybiera kategorię w Kreatorze PDF (krok 4)
2. Frontend wysyła `POST /api/pdf/:id` z `kategoria: "nazwa_kategorii"`
3. Backend pobiera listę plików z `obrazy/{kategoria}/N.pdf`
4. Dla każdej strony: `PdfReader(plik).pages` → dodaje do `PdfWriter`
5. Po wszystkich obrazach dodawane są kolejne sekcje (założenia, specyfikacja, tabele)

### 14.2. Z własnymi obrazami
1. Użytkownik wgrywa pliki JPG/PNG w Kreatorze PDF (krok 4)
2. Frontend tworzy `FormData` z polami:
   - `zalozenia` (string)
   - `klient_dane` (JSON string)
   - `specyfikacja` (JSON string)
   - `obraz_0`, `obraz_1`, ... (pliki)
3. Frontend wysyła `POST /api/pdf/:id/z-obrazami` (multipart/form-data)
4. Multer zapisuje pliki w `/tmp/pdf-obrazy/`
5. Backend wywołuje Python: `python3 generate_pdf.py '<json>' '<output>'`
6. Python:
   - Dla każdego obrazu wywołuje `generuj_strone_z_obrazem()`
   - Otwiera `podklad_obraz.pdf` jako tło
   - Nanosi obraz na tło za pomocą ReportLab
   - Zapisuje wynik do bufora PDF
   - Nakłada na główny dokument
7. Backend strumieniuje plik PDF do przeglądarki
8. Pliki tymczasowe (`/tmp/pdf-obrazy/*` i `/tmp/{numer}.pdf`) są usuwane

---

## 15. Isolated test scenarios (do odtworzenia logiki testów)

### Test 1: Brak oferty → 404
- Endpoint: `POST /api/pdf/:id/z-obrazami`
- Dane: nieistniejące ID
- Oczekiwany wynik: 404, brak wywołania `furniture_tables`

### Test 2: Błąd Pythona → 500
- Endpoint: `POST /api/pdf/:id/z-obrazami`
- Mock: `pool.query` zwraca ofertę, `exec` zwraca błąd
- Oczekiwany wynik: 500, `{ error: "Błąd generowania PDF" }`

### Test 3: Poprawne generowanie → 200
- Endpoint: `POST /api/pdf/:id/z-obrazami`
- Mock: `pool.query` zwraca ofertę, `exec` tworzy plik `/tmp/OFERTA_XX.pdf`
- Oczekiwany wynik: 200, nagłówki `Content-Type: application/pdf` i `Content-Disposition`

---

## 16. Znane ograniczenia i uwagi

- Wszystkie szablony PDF muszą mieć rozmiar A4 landscape (1190×842 pt)
- Pliki w kategoriach muszą być nazwane `1.pdf`, `2.pdf`, itd. (sekwencja numeryczna)
- Własne obrazy są przekalkowane do 1190×842 przy zachowaniu proporcji
- Dominujący kolor: `#5a2d6e` (fiolet) w interfejsie
- Cena końcowa obliczana jest przez korektę procentową: `cena * (1 + korekta/100)`
- Suma w tabeli to suma `wartosc_bazowa` po korekcie (nie po cenie jednostkowej)

---

## 17. Pliki źródłowe i ich lokalizacja

| Plik | Ścieżka | Rola |
|------|---------|------|
| `package.json` (backend) | `/opt/savento/backend/package.json` | Zależności Node.js |
| `server.js` | `/opt/savento/backend/server.js` | Główny serwer Express |
| `config.js` | `/opt/savento/backend/config.js` | Konfiguracja .env |
| `pool.js` | `/opt/savento/backend/db/pool.js` | Pool połączeń PostgreSQL |
| `generate_pdf.py` | `/opt/savento/backend/generate_pdf.py` | Generowanie PDF |
| `migrate.sql` | `/opt/savento/backend/migrate.sql` | Schemat bazy danych |
| `pdf.js` | `/opt/savento/backend/routes/pdf.js` | Trasy PDF |
| `pdf.test.js` | `/opt/savento/backend/routes/pdf.test.js` | Testy endpointu PDF |
| `KreatorPDF.jsx` | `/opt/savento/frontend/src/components/KreatorPDF.jsx` | Kreator 5-krokowy |
| `App.jsx` | `/opt/savento/frontend/src/App.jsx` | Główny komponent aplikacji |
| `AuthContext.jsx` | `/opt/savento/frontend/src/AuthContext.jsx` | Kontekst autoryzacji |

---

## 18. Checklista dla developera odtwarzającego aplikację

- [ ] Stworzenie bazy PostgreSQL z tabelami z `migrate.sql`
- [ ] Konfiguracja `.env` w backend
- [ ] Instalacja zależności npm w backend i frontend
- [ ] Stworzenie katalogu `backend/obrazy/`
- [ ] Dodanie `okladka.pdf` (A4 landscape)
- [ ] Dodanie `podklad_klient.pdf` (opcjonalny)
- [ ] Dodanie `podklad_zalozenia.pdf` (opcjonalny)
- [ ] Dodanie `podklad_oferta_cenowa.pdf` (opcjonalny)
- [ ] Dodanie `podklad_obraz.pdf` (opcjonalny, do własnych obrazów)
- [ ] Dodanie `check-box.png` (lub zrezygnuj z checkboxów)
- [ ] Stworzenie co najmniej jednej kategorii obrazów (folder z `1.pdf`, `2.pdf`, itd.)
- [ ] Dodanie `ZALOZENIA.txt` (opcjonalny)
- [ ] Stworzenie szablonu `koniec_zaproszenie.pdf` (opcjonalny)
- [ ] Stworzenie szablonu `koniec_haslo.pdf` (opcjonalny)
- [ ] Uruchomienie backendu na porcie 3001
- [ ] Uruchomienie frontendu na porcie 5173
- [ ] Sprawdzenie `/api/health`
- [ ] Test wygenerowania PDF bez obrazów
- [ ] Test wygenerowania PDF z kategorią obrazów
- [ ] Test wygenerowania PDF z własnymi obrazami (multipart)
- [ ] Przejście wszystkich 5 kroków Kreatora PDF

---

## 19. Rozszerzenia i przyszłe funkcje

- Eksport ofert do innych formatów (DOCX, XLSX)
- Szablony PDF konfigurowalne przez użytkownika (drag & drop)
- Podgląd PDF w przeglądarce przed pobraniem
- Wersjonowanie ofert
- Współdzielenie ofert przez link
- Integracja z zewnętrznymi systemami księgowymi
- Automatyczne wysyłanie ofert e-mailem

---

Dokument wygenerowany automatycznie na podstawie analizy kodu źródłowego aplikacji Savento.
