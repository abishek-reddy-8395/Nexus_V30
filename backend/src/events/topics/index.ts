/**
 * Nexus V30 — Kafka Event Topics
 *
 * All async communication between backend services flows through Kafka.
 * Topics are defined here; producers and consumers reference these constants.
 *
 * Topic naming: nexus.<domain>.<event>  (kebab-case)
 */

export const TOPICS = {
  // Market data
  CANDLE_UPDATED:    'nexus.market.candle-updated',
  PRICE_TICK:        'nexus.market.price-tick',
  WATCHLIST_REFRESH: 'nexus.market.watchlist-refresh',

  // Engine
  SIGNAL_GENERATED:  'nexus.engine.signal-generated',
  SCAN_COMPLETED:    'nexus.engine.scan-completed',
  ANALYSIS_READY:    'nexus.engine.analysis-ready',

  // Alerts
  ALERT_TRIGGERED:   'nexus.alerts.alert-triggered',
  ALERT_CREATED:     'nexus.alerts.alert-created',

  // Journal
  TRADE_LOGGED:      'nexus.journal.trade-logged',
  TRADE_UPDATED:     'nexus.journal.trade-updated',

  // Auth / Users
  USER_REGISTERED:   'nexus.auth.user-registered',
  USER_LOGGED_IN:    'nexus.auth.user-logged-in',

  // Billing
  SUBSCRIPTION_CHANGED: 'nexus.billing.subscription-changed',
  PLAN_UPGRADED:        'nexus.billing.plan-upgraded',

  // Notifications
  NOTIFICATION_SEND: 'nexus.notifications.send',

  // Audit
  AUDIT_EVENT:       'nexus.audit.event',
} as const;

export type Topic = typeof TOPICS[keyof typeof TOPICS];
