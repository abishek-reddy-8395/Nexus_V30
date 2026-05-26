-- Nexus V30 — Candle Time-Series Migration
-- Requires TimescaleDB extension.
-- Run AFTER 001_init.sql

-- TimescaleDB candles (hypertable)
CREATE TABLE IF NOT EXISTS candles (
  sym       TEXT        NOT NULL,
  tf        INT         NOT NULL,
  time      TIMESTAMPTZ NOT NULL,
  open      NUMERIC     NOT NULL,
  high      NUMERIC     NOT NULL,
  low       NUMERIC     NOT NULL,
  close     NUMERIC     NOT NULL,
  volume    NUMERIC     NOT NULL DEFAULT 0,
  source    TEXT        NOT NULL DEFAULT 'unknown',
  PRIMARY KEY (sym, tf, time)
);

-- Only create hypertable if TimescaleDB is installed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('candles', 'time', if_not_exists => TRUE, migrate_data => TRUE);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_candles_sym_tf ON candles(sym, tf, time DESC);

-- Price ticks table
CREATE TABLE IF NOT EXISTS price_ticks (
  sym    TEXT        NOT NULL,
  price  NUMERIC     NOT NULL,
  bid    NUMERIC,
  ask    NUMERIC,
  ts     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('price_ticks', 'ts', if_not_exists => TRUE);
  END IF;
END;
$$;
