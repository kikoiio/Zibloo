const fs = require('node:fs');
const path = require('node:path');
require('./mascot.js');

const output = path.join(__dirname, 'assets');
const character = Zibloo.svg();
fs.writeFileSync(path.join(output, 'zibloo-character.svg'), character);
const inner = character.slice(character.indexOf('>') + 1, character.lastIndexOf('</svg>'));
const mark = inner.replaceAll('#b5d8c7', '#154e52').replaceAll('#499f9e', '#154e52').replaceAll('#83bfb1', '#154e52');
const stroke = 'stroke="#154e52" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const letters = `<g transform="translate(112 31)"><path ${stroke} d="M7 8H41L7 47H41M63 8V47M91 -11V47M150 -11V47"/><circle ${stroke} cx="110" cy="28" r="19"/><circle ${stroke} cx="190" cy="28" r="20"/><circle ${stroke} cx="249" cy="28" r="20"/></g><circle cx="175" cy="15" r="7" fill="#154e52"/>`;
fs.writeFileSync(path.join(output, 'zibloo-lockup.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 108" role="img" aria-label="zibloo"><g transform="translate(0 3) scale(.23)">${mark}</g>${letters}</svg>`);
