/**
 * Nexus V30 — Performance Monitoring Hook
 *
 * Tracks Core Web Vitals and reports to your observability backend.
 * Uses the Web Vitals library (zero-config with Next.js).
 * Wire to Grafana via the /api/vitals endpoint.
 */
'use client';

import { useEffect } from 'react';

interface Metric {
  name:  string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function sendVital(metric: Metric): void {
  // In production: POST to your metrics collector
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[Vitals] ${metric.name}: ${metric.value.toFixed(1)} (${metric.rating})`);
    return;
  }
  // Send to backend analytics endpoint (non-blocking)
  const body = JSON.stringify({
    name:   metric.name,
    value:  metric.value,
    rating: metric.rating,
    url:    window.location.pathname,
    ts:     Date.now(),
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true }).catch(() => {});
  }
}

// Thresholds from Google Web Vitals spec
const THRESHOLDS: Record<string, [number, number]> = {
  CLS:  [0.1,  0.25],
  FID:  [100,  300],
  FCP:  [1800, 3000],
  LCP:  [2500, 4000],
  TTFB: [800,  1800],
  INP:  [200,  500],
};

function rate(name: string, value: number): Metric['rating'] {
  const [good, poor] = THRESHOLDS[name] ?? [Infinity, Infinity];
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor';
}

export function useWebVitals(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Use PerformanceObserver for modern browsers
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const name  = entry.entryType === 'largest-contentful-paint' ? 'LCP'
                      : entry.entryType === 'first-input' ? 'FID'
                      : entry.entryType === 'layout-shift' ? 'CLS'
                      : entry.name;
          const value = (entry as any).processingStart
                      ? (entry as any).processingStart - entry.startTime
                      : (entry as any).value ?? entry.startTime;
          if (name && value != null) {
            sendVital({ name, value, rating: rate(name, value) });
          }
        }
      });
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      return () => observer.disconnect();
    } catch {}
  }, []);
}
