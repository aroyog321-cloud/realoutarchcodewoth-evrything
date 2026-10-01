// Lightweight SEO metadata manager for client-side navigation.
// Maintains document title, meta descriptions, canonical URLs, robots indexing directives,
// and Open Graph / Twitter tags dynamically without external dependencies.

const BASE_URL = 'https://outarch.com';

const ROUTE_METADATA = {
  '/': {
    title: 'OUTARCH | One command center for your terminals, tests and AI agents',
    description: 'Run your dev servers, tests and AI coding agents side by side on Windows. OUTARCH watches them all and tells you the moment one needs you. Free to start.',
    canonical: `${BASE_URL}/`,
    robots: 'index, follow',
  },
  '/pricing': {
    title: 'Pricing | OUTARCH',
    description: 'Transparent prepaid plans for OUTARCH on Windows. Free, Pro, and Ultimate tiers with clear limits and no automatic renewals.',
    canonical: `${BASE_URL}/pricing`,
    robots: 'index, follow',
  },
  '/mobile': {
    title: 'Mobile companion | OUTARCH',
    description: 'Monitor running processes, view terminal summaries, and run recipes from your phone over local Wi-Fi with the OUTARCH mobile companion.',
    canonical: `${BASE_URL}/mobile`,
    robots: 'index, follow',
  },
  '/upgrades': {
    title: 'Plan Upgrade & Credit Conversion | OUTARCH',
    description: 'Learn how prorated plan upgrades, remaining credit conversions, and billing policies work in OUTARCH.',
    canonical: `${BASE_URL}/upgrades`,
    robots: 'index, follow',
  },
  '/upgrade-policy': {
    title: 'Plan Upgrade & Credit Conversion | OUTARCH',
    description: 'Learn how prorated plan upgrades, remaining credit conversions, and billing policies work in OUTARCH.',
    canonical: `${BASE_URL}/upgrades`,
    robots: 'index, follow',
  },
  '/legal': {
    title: 'Legal & privacy | OUTARCH',
    description: 'Overview of OUTARCH terms, privacy, software licensing, and developer data policies.',
    canonical: `${BASE_URL}/legal`,
    robots: 'index, follow',
  },
  '/terms': {
    title: 'Terms of service | OUTARCH',
    description: 'The agreement between you and OUTARCH for the desktop app, website, and account.',
    canonical: `${BASE_URL}/terms`,
    robots: 'index, follow',
  },
  '/eula': {
    title: 'End user licence agreement | OUTARCH',
    description: 'End user licence terms covering what you may and may not do with installed OUTARCH software.',
    canonical: `${BASE_URL}/eula`,
    robots: 'index, follow',
  },
  '/privacy': {
    title: 'Privacy policy | OUTARCH',
    description: 'What OUTARCH collects, why, where it goes, and your privacy choices.',
    canonical: `${BASE_URL}/privacy`,
    robots: 'index, follow',
  },
  '/ai-data': {
    title: 'AI & developer data | OUTARCH',
    description: 'Exactly what Mission AI, coding agents, MCP clients, the VS Code bridge, and project memory can read and transmit.',
    canonical: `${BASE_URL}/ai-data`,
    robots: 'index, follow',
  },
  '/ai-terms': {
    title: 'AI services terms | OUTARCH',
    description: "Terms and rules governing Mission AI, project memory's AI features, and connected AI providers.",
    canonical: `${BASE_URL}/ai-terms`,
    robots: 'index, follow',
  },
  '/acceptable-use': {
    title: 'Acceptable use policy | OUTARCH',
    description: 'Standards and guidelines on prohibited use cases for OUTARCH software and services.',
    canonical: `${BASE_URL}/acceptable-use`,
    robots: 'index, follow',
  },
  '/mobile-privacy': {
    title: 'Mobile companion privacy | OUTARCH',
    description: 'Privacy policy and network permissions for the local Wi-Fi OUTARCH phone companion.',
    canonical: `${BASE_URL}/mobile-privacy`,
    robots: 'index, follow',
  },
  '/cookies': {
    title: 'Cookie policy | OUTARCH',
    description: 'Information about essential local storage and cookie usage on the OUTARCH website.',
    canonical: `${BASE_URL}/cookies`,
    robots: 'index, follow',
  },
  '/data-retention': {
    title: 'Data retention & deletion | OUTARCH',
    description: 'How long each type of data is retained, and instructions for data deletion or account removal.',
    canonical: `${BASE_URL}/data-retention`,
    robots: 'index, follow',
  },
  '/security': {
    title: 'Security & responsible disclosure | OUTARCH',
    description: 'Security architecture, data protection measures, and responsible vulnerability disclosure process.',
    canonical: `${BASE_URL}/security`,
    robots: 'index, follow',
  },
  '/subprocessors': {
    title: 'Third-party services | OUTARCH',
    description: 'List of third-party infrastructure and service providers utilized by OUTARCH.',
    canonical: `${BASE_URL}/subprocessors`,
    robots: 'index, follow',
  },
  '/licenses': {
    title: 'Open-source licences | OUTARCH',
    description: 'Open-source libraries and component licences used in OUTARCH.',
    canonical: `${BASE_URL}/licenses`,
    robots: 'index, follow',
  },
  '/refunds': {
    title: 'Refunds and cancellation | OUTARCH',
    description: 'Refund, cancellation, and dispute policy for non-recurring prepaid OUTARCH purchases.',
    canonical: `${BASE_URL}/refunds`,
    robots: 'index, follow',
  },
  '/delivery': {
    title: 'Delivery | OUTARCH',
    description: 'Digital delivery, licensing, and immediate plan activation details for OUTARCH software.',
    canonical: `${BASE_URL}/delivery`,
    robots: 'index, follow',
  },
  '/contact': {
    title: 'Contact | OUTARCH',
    description: 'Contact information and support channels for OUTARCH.',
    canonical: `${BASE_URL}/contact`,
    robots: 'index, follow',
  },
  // Private application and transactional routes (noindex)
  '/auth': {
    title: 'Sign in | OUTARCH',
    description: 'Sign in or create an account for OUTARCH on Windows.',
    canonical: `${BASE_URL}/auth`,
    robots: 'noindex, nofollow',
  },
  '/account': {
    title: 'Dashboard | OUTARCH',
    description: 'Manage your OUTARCH account, active plans, and devices.',
    canonical: `${BASE_URL}/account`,
    robots: 'noindex, nofollow',
  },
  '/checkout': {
    title: 'Checkout | OUTARCH',
    description: 'Complete your OUTARCH plan purchase securely.',
    canonical: `${BASE_URL}/checkout`,
    robots: 'noindex, nofollow',
  },
  '/checkout/return': {
    title: 'Payment | OUTARCH',
    description: 'Order status and payment confirmation for OUTARCH.',
    canonical: `${BASE_URL}/checkout/return`,
    robots: 'noindex, nofollow',
  },
};

const DEFAULT_META = {
  title: 'Page not found | OUTARCH',
  description: 'The requested page could not be found on OUTARCH.',
  canonical: null,
  robots: 'noindex, nofollow',
};

function upsertMeta(name, property, content) {
  if (typeof document === 'undefined') return;
  const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
  let meta = document.querySelector(selector);
  if (!content) {
    if (meta) meta.remove();
    return;
  }
  if (!meta) {
    meta = document.createElement('meta');
    if (name) meta.setAttribute('name', name);
    if (property) meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function upsertCanonical(url) {
  if (typeof document === 'undefined') return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!url) {
    if (link) link.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', url);
}

export function updatePageMetadata(path) {
  const meta = ROUTE_METADATA[path] || DEFAULT_META;

  // Title
  document.title = meta.title;

  // Primary tags
  upsertMeta('description', null, meta.description);
  upsertMeta('robots', null, meta.robots);
  upsertCanonical(meta.canonical);

  // Open Graph
  upsertMeta(null, 'og:title', meta.title);
  upsertMeta(null, 'og:description', meta.description);
  upsertMeta(null, 'og:url', meta.canonical || undefined);

  // Twitter
  upsertMeta('twitter:title', null, meta.title);
  upsertMeta('twitter:description', null, meta.description);
}
