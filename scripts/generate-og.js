const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../public/WhatsApp Image 2026-06-08 at 6.43.17 PM.jpeg');
const outputPath = path.join(__dirname, '../public/og-image.jpeg');

sharp(inputPath)
  .resize(1200, 630, {
    fit: 'contain',
    background: { r: 255, g: 255, b: 255, alpha: 1 }
  })
  .toFile(outputPath)
  .then(info => console.log('Image created:', info))
  .catch(err => console.error('Error:', err));
