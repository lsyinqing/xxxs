#!/bin/bash
cat << 'INNER_EOF' > patch3.ts
import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const data = await response\.json\(\);\n      \n      const subResults: SubResult\[\] = data\.results\.map/m;

const replacement = `const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const subResults: SubResult[] = data.results.map`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', content);

INNER_EOF
npx tsx patch3.ts
