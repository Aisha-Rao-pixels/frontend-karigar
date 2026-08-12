const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const tags = '<meta property="og:title" content="Karigar" /><meta property="og:image" content="https://frontend-karigar-swart.vercel.app/og-image-1.jpg" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta name="twitter:card" content="summary_large_image" />';
html = html.replace('<link rel="icon" href="/favicon.ico" />', '<link rel="icon" href="/favicon.ico" />' + tags);
fs.writeFileSync(file, html);
console.log('OG tags injected successfully');
