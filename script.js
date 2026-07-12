const fs = require('fs');

function convert(htmlFile, jsxFile, componentName) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  let bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return;
  let bodyContent = bodyMatch[1];
  
  // replace custom SVG placeholder with actual img or div
  bodyContent = bodyContent.replace(/\{\{DATA:IMAGE:[^}]+\}\}/g, 'https://cdn-icons-png.flaticon.com/512/25/25231.png');
  bodyContent = bodyContent.replace(/class=/g, 'className=');
  bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, ''); // remove comments
  // fix self closing tags for jsx
  bodyContent = bodyContent.replace(/<(img|input|br|hr|meta|link)([^>]*?)>/g, (match, tag, attrs) => {
     if(attrs.endsWith('/')) return match;
     return '<' + tag + attrs + ' />';
  });
  // fix style tag
  bodyContent = bodyContent.replace(/style="([^"]*)"/g, ''); // remove inline styles to avoid object format errors
  
  // fix svg clip-path properties and other non-react properties if needed
  bodyContent = bodyContent.replace(/fill-rule=/g, 'fillRule=')
                           .replace(/clip-rule=/g, 'clipRule=')
                           .replace(/stroke-width=/g, 'strokeWidth=')
                           .replace(/stroke-linecap=/g, 'strokeLinecap=')
                           .replace(/stroke-linejoin=/g, 'strokeLinejoin=');
                           
  // remove unescaped entities that could fail jsx compilation
  bodyContent = bodyContent.replace(/&(?!(amp|lt|gt|quot|apos|nbsp);)/g, '&amp;');

  let jsx = `
export default function ${componentName}() {
  return (
    <>
      ${bodyContent}
    </>
  );
}
`;
  // create directory if it doesn't exist
  const dir = jsxFile.substring(0, jsxFile.lastIndexOf('/'));
  if (dir && !fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(jsxFile, jsx);
}

convert('landing.html', 'website/app/page.tsx', 'Landing');
convert('docs.html', 'website/app/docs/page.tsx', 'Docs');
console.log('JSX extraction complete.');
