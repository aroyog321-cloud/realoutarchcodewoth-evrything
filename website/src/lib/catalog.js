import { useEffect, useState } from 'react';
import { readPublic } from './config.js';

// Plans, prices and the latest desktop release, read from the same database
// the desktop app and the checkout use. FALLBACK mirrors the seeded rows so the
// page has something true to show before the first answer arrives (or if the
// network is down); the database always wins once it answers.

export const FALLBACK_PLANS = [
  {
    id: 'free', name: 'Free', rank: 0, tagline: 'Start supervising your terminals.',
    limits: { terminals: 3, projects: 1, projectSwitching: false, mcp: 'none', mobileCompanion: false, vscodeBridge: false, recipes: 1, recipeTrialDays: 3, byokKeys: 0, missionAiMessages: 3, missionAiPeriod: 'day' },
  },
  {
    id: 'pro', name: 'Pro', rank: 1, tagline: 'For developers running a real stack.',
    limits: { terminals: 8, projects: null, projectSwitching: true, mcp: 'read', mobileCompanion: true, vscodeBridge: false, recipes: 3, recipeTrialDays: null, byokKeys: 1, missionAiMessages: null, missionAiPeriod: 'day' },
  },
  {
    id: 'ultimate', name: 'Ultimate', rank: 2, tagline: 'Everything OUTARCH can do, without limits.',
    limits: { terminals: null, projects: null, projectSwitching: true, mcp: 'full', mobileCompanion: true, vscodeBridge: true, recipes: null, recipeTrialDays: null, byokKeys: null, missionAiMessages: null, missionAiPeriod: 'day' },
  },
];

export const FALLBACK_PRICES = [
  { plan_id: 'pro', period: 'month', currency: 'INR', amount: 700, months: 1 },
  { plan_id: 'pro', period: 'month', currency: 'USD', amount: 7.3, months: 1 },
  { plan_id: 'pro', period: 'year', currency: 'INR', amount: 7000, months: 12 },
  { plan_id: 'pro', period: 'year', currency: 'USD', amount: 73, months: 12 },
  { plan_id: 'ultimate', period: 'month', currency: 'INR', amount: 1000, months: 1 },
  { plan_id: 'ultimate', period: 'month', currency: 'USD', amount: 10.42, months: 1 },
  { plan_id: 'ultimate', period: 'year', currency: 'INR', amount: 10000, months: 12 },
  { plan_id: 'ultimate', period: 'year', currency: 'USD', amount: 104.2, months: 12 },
];

export const DEFAULT_MICROSOFT_STORE_ID = '9PLVP4HLNJZQ';
export const MICROSOFT_STORE_PAGE_URL = 'https://apps.microsoft.com/store/detail/9PLVP4HLNJZQ?cid=DevShareMCLPCS';

// The 12-character Store ID Partner Center shows under Product identity.
export function microsoftStoreIdOf(value) {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[0-9A-Z]{12}$/.test(id) ? id : DEFAULT_MICROSOFT_STORE_ID;
}

// "Direct" launch mode starts the Microsoft Store web installer, while listing
// opens the official Microsoft Store product detail page.
export function microsoftStoreLinks(id) {
  const storeId = id ? (microsoftStoreIdOf(id) || DEFAULT_MICROSOFT_STORE_ID) : DEFAULT_MICROSOFT_STORE_ID;
  return {
    install: `https://apps.microsoft.com/store/detail/${storeId}?cid=DevShareMCLPCS`,
    direct: `https://apps.microsoft.com/detail/${storeId}?mode=direct&cid=DevShareMCLPCS`,
    listing: `https://apps.microsoft.com/store/detail/${storeId}?cid=DevShareMCLPCS`,
  };
}

export const VS_CODE_MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=outarch.outarch-bridge&ssr=false';

let catalogPromise = null;

function loadCatalog() {
  if (!catalogPromise) {
    // Each read may fail on its own (for example before a table exists); the
    // fallback covers just that part.
    const settle = promise => promise.catch(() => []);
    catalogPromise = Promise.all([
      settle(readPublic('plans', 'select=id,name,rank,tagline,limits,purchasable&order=rank.asc')),
      settle(readPublic('plan_prices', 'select=plan_id,period,currency,amount,months&active=is.true')),
      settle(readPublic('app_releases', 'select=version,notes,download_url,file_name,size_bytes,sha256,published_at&channel=eq.stable&order=published_at.desc&limit=1')),
      settle(readPublic('app_config', 'select=key,value&key=in.(support_email,android_apk_url,microsoft_store_id)')),
    ]).then(([plans, prices, releases, config]) => {
      const settings = Object.fromEntries(config.map(row => [row.key, row.value]));
      return {
        plans: plans.length ? plans : FALLBACK_PLANS,
        prices: prices.length ? prices.map(row => ({ ...row, amount: Number(row.amount) })) : FALLBACK_PRICES,
        release: releases[0] || null,
        supportEmail: typeof settings.support_email === 'string' ? settings.support_email : '',
        androidApkUrl: typeof settings.android_apk_url === 'string' && /^https:\/\//.test(settings.android_apk_url) ? settings.android_apk_url : '',
        microsoftStoreId: settings.microsoft_store_id ? microsoftStoreIdOf(settings.microsoft_store_id) : DEFAULT_MICROSOFT_STORE_ID,
        live: Boolean(plans.length),
      };
    });
  }
  return catalogPromise;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState({ plans: FALLBACK_PLANS, prices: FALLBACK_PRICES, release: null, supportEmail: '', androidApkUrl: '', microsoftStoreId: DEFAULT_MICROSOFT_STORE_ID, live: false, loading: true });
  useEffect(() => {
    let alive = true;
    loadCatalog().then(result => { if (alive) setCatalog({ ...result, loading: false }); });
    return () => { alive = false; };
  }, []);
  return catalog;
}

export function priceOf(prices, planId, period, currency) {
  if (!Array.isArray(prices)) return null;
  return prices.find(row => row && row.plan_id === planId && row.period === period && row.currency === currency) || null;
}

// The comparison rows, read from a plan's limits. null means unlimited.
export const LIMIT_ROWS = [
  ['Terminals at once', limits => (limits.terminals == null ? 'Unlimited' : String(limits.terminals))],
  ['Projects', limits => (limits.projectSwitching ? 'Unlimited, switch any time' : '1 project')],
  ['Mission AI messages', limits => (limits.missionAiMessages == null ? 'Unlimited*' : `${limits.missionAiMessages} a ${limits.missionAiPeriod || 'day'}`)],
  ['Your own AI keys (BYOK)', limits => (limits.byokKeys === 0 ? false : limits.byokKeys == null ? 'Unlimited' : `${limits.byokKeys} key`)],
  ['Workspace recipes', limits => (limits.recipes == null ? 'Unlimited' : limits.recipeTrialDays ? `${limits.recipes}, ${limits.recipeTrialDays}-day trial` : String(limits.recipes))],
  ['Secure MCP gateway', limits => (limits.mcp === 'full' ? 'Full access' : limits.mcp === 'read' ? 'Read-only tools' : false)],
  ['Mobile companion', limits => Boolean(limits.mobileCompanion)],
  ['VS Code bridge', limits => Boolean(limits.vscodeBridge)],
];

export const EVERY_PLAN = [
  'Agent permission alerts with sound',
  'Needs You decision queue',
  'Split layouts and Focus mode',
  'Crash recovery and History',
  'Project memory for AI agents',
  'Command palette',
  'Signed updates',
];

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '';
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(value / 1024)} KB`;
}
