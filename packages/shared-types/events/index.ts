/**
 * @nexus-v30/shared-types — Event Contracts
 *
 * Typed payloads for every Kafka event emitted in the system.
 * Producers and consumers both import from here.
 * If the payload shape changes, update this file and fix all imports.
 */

// ── Market events ─────────────────────────────────────────────────────
export interface CandleUpdatedEvent {
  sym:       string;
  tf:        number;
  price:     number;
  candles:   Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  fetchedAt: number;
}

export interface PriceTickEvent {
  sym:       string;
  price:     number;
  bid:       number;
  ask:       number;
  spread:    number;
  ts:        number;
}

// ── Engine events ─────────────────────────────────────────────────────
export interface SignalGeneratedEvent {
  sym:        string;
  tf:         number;
  mode:       string;
  bias:       'BULL' | 'BEAR' | 'NEUTRAL' | 'WAIT';
  conviction: number;
  entry:      number | null;
  sl:         number | null;
  tp1:        number | null;
  rr:         string | null;
  confluence: number;
  session:    string;
  ts:         number;
}

export interface ScanCompletedEvent {
  syms:  string[];
  tf:    number;
  count: number;
  ts:    number;
}

// ── Alert events ──────────────────────────────────────────────────────
export interface AlertTriggeredEvent {
  alertId:      string;
  userId:       string;
  tenantId:     string;
  sym:          string;
  alertType:    'price' | 'signal' | 'confluence';
  condition:    Record<string, unknown>;
  currentPrice: number;
  triggeredAt:  number;
}

export interface AlertCreatedEvent {
  alertId:  string;
  userId:   string;
  tenantId: string;
  sym:      string;
  type:     string;
}

// ── Journal events ────────────────────────────────────────────────────
export interface TradeLoggedEvent {
  entryId:  string;
  userId:   string;
  tenantId: string;
  sym:      string;
  dir:      'BUY' | 'SELL';
  mode:     string;
  entry:    number;
  ts:       number;
}

export interface TradeUpdatedEvent {
  entryId:  string;
  userId:   string;
  updates:  Record<string, unknown>;
  ts:       number;
}

// ── Auth events ───────────────────────────────────────────────────────
export interface UserRegisteredEvent {
  userId:   string;
  tenantId: string;
  email:    string;
  plan:     string;
  ts:       number;
}

export interface UserLoggedInEvent {
  userId:   string;
  tenantId: string;
  ts:       number;
}

// ── Billing events ────────────────────────────────────────────────────
export interface SubscriptionChangedEvent {
  tenantId: string;
  userId:   string;
  oldPlan:  string;
  newPlan:  string;
  ts:       number;
}

// ── Audit events ──────────────────────────────────────────────────────
export interface AuditEvent {
  tenantId:   string;
  userId:     string | null;
  action:     string;
  resource:   string;
  resourceId: string | null;
  metadata:   Record<string, unknown>;
  ip:         string | null;
  ts:         number;
}

// ── Notification events ───────────────────────────────────────────────
export interface NotificationSendEvent {
  userId:   string;
  tenantId: string;
  channel:  'email' | 'push' | 'in_app';
  title:    string;
  body:     string;
  data?:    Record<string, unknown>;
  ts:       number;
}

// ── Envelope (wraps all events on the bus) ────────────────────────────
export interface EventEnvelope<T> {
  data: T;
  ts:   number;
}
