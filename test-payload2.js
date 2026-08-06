const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/test-upload',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  res.on('data', d => console.log('DATA:', d.toString()));
});

req.on('error', (e) => console.error('ERROR:', e.message));

const payload = JSON.stringify({ data: 'A'.repeat(2500000) });
req.write(payload);
req.end();
