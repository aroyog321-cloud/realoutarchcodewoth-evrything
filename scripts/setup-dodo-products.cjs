const https = require('https');
const apiKey = '21mvCEFFdwN5GIC4.Mjqh3XIUgtSl2Ut8kOY4haYFpxwnS9JQsE3eyNP9oaOBC7zb';

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  const planItems = [
    { name: 'OUTARCH Pro - Monthly', id: 'pdt_0NohxyGlqUEFWQEpCzug5', inrPaise: 70000, usd: '$7.30', inr: '₹700' },
    { name: 'OUTARCH Pro - Annual (12 Months)', id: 'pdt_0NohxyIVrgAJKAwIfAfCi', inrPaise: 700000, usd: '$73.00', inr: '₹7,000' },
    { name: 'OUTARCH Ultimate - Monthly', id: 'pdt_0NohxyJbqntvWYdXdykwW', inrPaise: 100000, usd: '$10.42', inr: '₹1,000' },
    { name: 'OUTARCH Ultimate - Annual (12 Months)', id: 'pdt_0NohxyLvPont2ODalPpvX', inrPaise: 1000000, usd: '$104.20', inr: '₹10,000' },
  ];

  for (const item of planItems) {
    console.log(`Setting pricing_mode=by_currency for ${item.name}...`);
    const patchRes = await request(`https://test.dodopayments.com/products/${item.id}`, { method: 'PATCH' }, JSON.stringify({
      pricing_mode: 'by_currency'
    }));
    console.log(`Patch result (${item.name}):`, patchRes.status);

    console.log(`Adding INR localized price for ${item.name} (${item.inr})...`);
    const locRes = await request(`https://test.dodopayments.com/products/${item.id}/localized-prices`, { method: 'POST' }, JSON.stringify({
      currency: 'INR',
      amount: item.inrPaise
    }));
    console.log(`Localized price status (${item.name}):`, locRes.status, locRes.data);
  }

  console.log('\n========================================');
  console.log('DODO PAYMENTS PRODUCTS & PRICING CONFIGURED:');
  console.log('========================================');
  for (const p of planItems) {
    console.log(`• ${p.name}`);
    console.log(`  - Product ID: ${p.id}`);
    console.log(`  - USD Price:  ${p.usd}`);
    console.log(`  - INR Price:  ${p.inr}`);
  }
}

run().catch(console.error);
