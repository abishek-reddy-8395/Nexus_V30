/**
 * @nexus-v30/sdk — Client SDK
 *
 * Re-exports all client-facing API and WebSocket utilities.
 * Import from this package in apps — don't import from internal paths.
 *
 * Usage:
 *   import { nexusAuth, nexusEngine, nexusRisk, NexusWebSocket } from '@nexus-v30/sdk';
 */

// REST clients
export {
  nexusAuth,
  nexusMarket,
  nexusEngine,
  nexusScanner,
  nexusJournal,
  nexusRisk,
  nexusSession,
  nexusAI,
  nexusCalendar,
  nexusPortfolio,
  nexusExecution,
  nexusAnalytics,
  nexusAlerts,
  nexusBilling,
} from '../../apps/web/src/services/api.client';

// WebSocket client
export { NexusWebSocket, nexusWS } from '../../apps/web/src/websocket/nexus-ws.client';

// Shared types
export * from '../shared-types/engine/index';
