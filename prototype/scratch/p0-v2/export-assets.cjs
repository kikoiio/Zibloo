const fs=require('node:fs');
const path=require('node:path');
require('./mascot.js');
const output=path.join(__dirname,'assets');
const sources={
 'assets/reference-B2.png':`data:image/png;base64,${fs.readFileSync(path.join(output,'reference-B2.png')).toString('base64')}`,
 'assets/reference-C3.png':`data:image/png;base64,${fs.readFileSync(path.join(output,'reference-C3.png')).toString('base64')}`,
 ...Object.fromEntries(['stroke-a','stroke-b','stroke-c','stroke-d','greet'].map(name=>[
   `assets/frames/${name}.png`,
   `data:image/png;base64,${fs.readFileSync(path.join(output,'frames',`${name}.png`)).toString('base64')}`,
 ])),
};
function embedded(markup){for(const [url,data] of Object.entries(sources))markup=markup.replaceAll(`href="${url}"`,`href="${data}"`);return markup;}
fs.writeFileSync(path.join(output,'zibloo-character.svg'),embedded(Zibloo.svg()));
fs.writeFileSync(path.join(output,'zibloo-symbol.svg'),embedded(Zibloo.svg({symbol:true})));
fs.writeFileSync(path.join(output,'zibloo-lockup.svg'),embedded(Zibloo.logo()));
