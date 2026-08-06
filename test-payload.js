const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/courses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  res.on('data', d => console.log('DATA:', d.toString()));
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
});

// Create a 2.5MB payload
const payload = JSON.stringify({
  title: 'Test', subject: 'Math', educationalStage: 'HS',
  thumbnailUrl: 'data:image/jpeg;base64,' + 'A'.repeat(2500000)
});
req.write(payload);
req.end();
