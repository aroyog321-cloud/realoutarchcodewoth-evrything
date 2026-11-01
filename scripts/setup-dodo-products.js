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
  const existing = await request('https://test.dodopayments.com/products', { method: 'GET' });
  const items = existing.data?.items || [];
  console.log('Currently found', items.length, 'products:');
  items.forEach(p => console.log(`- ${p.name}: ${p.product_id}`));

  const productsToCreate = [
    {
      name: 'OUTARCH Pro - Monthly',
      description: '8 terminals, unlimited projects, mobile companion, MCP read-only.',
      tax_category: 'digital_products',
      price: { type: 'one_time_price', currency: 'USD', price: 730 }
    },
    {
      name: 'OUTARCH Pro - Annual (12 Months)',
      description: '8 terminals, unlimited projects, mobile companion, MCP read-only (2 months free).',
      tax_category: 'digital_products',
      price: { type: 'one_time_price', currency: 'USD', price: 7300 }
    },
    {
      name: 'OUTARCH Ultimate - Monthly',
      description: 'Unlimited terminals, full MCP gateway, VS Code bridge, unlimited recipes & keys.',
      tax_category: 'digital_products',
      price: { type: 'one_time_price', currency: 'USD', price: 1042 }
    },
    {
      name: 'OUTARCH Ultimate - Annual (12 Months)',
      description: 'Unlimited terminals, full MCP gateway, VS Code bridge, unlimited recipes & keys (2 months free).',
      tax_category: 'digital_products',
      price: { type: 'one_time_price', currency: 'USD', price: 10420 }
    }
  ];

  for (const item of productsToCreate) {
    const found = items.find(p => p.name === item.name);
    if (found) {
      console.log(`Product "${item.name}" already exists: ${found.product_id}`);
    } else {
      console.log(`Creating "${item.name}"...`);
      const res = await request('https://test.dodopayments.com/products', { method: 'POST' }, JSON.stringify(item));
      if (res.status === 200 || res.status === 201) {
        console.log(`Successfully created "${item.name}": ${res.data?.product_id}`);
      } else {
        console.error(`Failed to create "${item.name}":`, res);
      }
    }
  }

  const finalRes = await request('https://test.dodopayments.com/products', { method: 'GET' });
  console.log('\n--- Final Product List on Dodo Payments ---');
  (finalRes.data?.items || []).forEach(p => {
    console.log(`• ${p.name} | ID: ${p.product_id} | Price: $${(p.price / 100).toFixed(2)} USD`);
  });
}

run().catch(console.error);
