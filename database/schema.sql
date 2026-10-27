-- Начальная схема PostgreSQL для «Где дешевле?». Не запускается автоматически.
create table if not exists categories (id bigint generated always as identity primary key, name text not null unique, parent_id bigint references categories(id));
create table if not exists products (id bigint generated always as identity primary key, category_id bigint references categories(id), name text not null, brand text, model text, gtin text, created_at timestamptz not null default now());
create table if not exists merchants (id bigint generated always as identity primary key, name text not null unique, website text);
create table if not exists offers (id bigint generated always as identity primary key, product_id bigint not null references products(id), merchant_id bigint not null references merchants(id), external_id text, product_url text not null, currency char(3) not null, price numeric(12,2) not null check(price>=0), shipping_price numeric(12,2), in_stock boolean, checked_at timestamptz not null default now(), unique(merchant_id,external_id));
create table if not exists price_history (id bigint generated always as identity primary key, offer_id bigint not null references offers(id), price numeric(12,2) not null, shipping_price numeric(12,2), observed_at timestamptz not null default now());
create index if not exists price_history_offer_time on price_history(offer_id,observed_at desc);
create table if not exists ingestion_runs (id bigint generated always as identity primary key, source text not null, started_at timestamptz not null default now(), finished_at timestamptz, status text not null default 'running', records_processed integer not null default 0, error_message text);
-- Важно: перед открытием API клиентам настроить RLS и политики только на чтение публичных данных.
