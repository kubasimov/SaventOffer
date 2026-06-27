-- Użytkownicy systemu
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imie_nazwisko VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    haslo_hash VARCHAR(255) NOT NULL,
    rola VARCHAR(20) NOT NULL DEFAULT 'pracownik',
    aktywny BOOLEAN DEFAULT true,
    utworzony TIMESTAMP DEFAULT NOW()
);

-- Klienci
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazwa VARCHAR(200) NOT NULL,
    kontakt VARCHAR(100),
    email VARCHAR(100),
    telefon VARCHAR(30),
    uwagi TEXT,
    utworzony TIMESTAMP DEFAULT NOW()
);

-- Cennik
CREATE TABLE price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nazwa VARCHAR(200) NOT NULL,
    opis TEXT,
    cena NUMERIC(10,2) NOT NULL,
    jednostka VARCHAR(10) NOT NULL,
    aktywny BOOLEAN DEFAULT true,
    zaktualizowany TIMESTAMP DEFAULT NOW()
);

-- Oferty
CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    klient_id UUID REFERENCES clients(id),
    uzytkownik_id UUID REFERENCES users(id),
    numer VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'szkic',
    data_oferty DATE DEFAULT CURRENT_DATE,
    uwagi TEXT,
    utworzony TIMESTAMP DEFAULT NOW()
);

-- Tabele mebli w ofercie
CREATE TABLE furniture_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oferta_id UUID REFERENCES offers(id) ON DELETE CASCADE,
    nazwa_mebla VARCHAR(200) NOT NULL,
    kolejnosc INT DEFAULT 1,
    korekta_pct NUMERIC(5,2) DEFAULT 0,
    razem_przed NUMERIC(10,2) DEFAULT 0,
    razem NUMERIC(10,2) DEFAULT 0
);

-- Pozycje w tabeli mebla
CREATE TABLE table_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela_id UUID REFERENCES furniture_tables(id) ON DELETE CASCADE,
    cennik_id UUID REFERENCES price_list(id),
    nazwa VARCHAR(200) NOT NULL,
    wymiar_x NUMERIC(8,3),
    wymiar_y NUMERIC(8,3),
    ilosc NUMERIC(8,3) NOT NULL,
    jednostka VARCHAR(10) NOT NULL,
    cena_jedn NUMERIC(10,2) NOT NULL,
    kolejnosc INT DEFAULT 1
);

-- Indeksy
CREATE INDEX idx_offers_klient ON offers(klient_id);
CREATE INDEX idx_furniture_oferta ON furniture_tables(oferta_id);
CREATE INDEX idx_items_tabela ON table_items(tabela_id);

-- Audit log zmian statusu ofert
CREATE TABLE IF NOT EXISTS offer_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oferta_id UUID REFERENCES offers(id) ON DELETE CASCADE,
    uzytkownik_id UUID REFERENCES users(id),
    stary_status VARCHAR(20),
    nowy_status VARCHAR(20) NOT NULL,
    utworzony TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_offer_log_oferta ON offer_log(oferta_id);
