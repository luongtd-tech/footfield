const fs = require('fs');
const path = require('path');

const files = [
    { html: 'customer.html', css: 'customer.css', js: 'customer.js' },
    { html: 'tenant-admin.html', css: 'tenant.css', js: 'tenant.js' },
    { html: 'provider-admin.html', css: 'provider.css', js: 'provider.js' }
];

const publicDir = path.join(__dirname, 'public');

for (const fileObj of files) {
    const htmlPath = path.join(publicDir, fileObj.html);
    const cssPath = path.join(publicDir, 'css', fileObj.css);
    const jsPath = path.join(publicDir, 'js', fileObj.js);

    if (!fs.existsSync(htmlPath)) {
        console.log(`Skipping ${fileObj.html}, not found.`);
        continue;
    }

    let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 1. Extract CSS
    // Regex matches <style> ... </style> lazily.
    // Assuming there's only one major <style> block, or we match all and concatenate.
    let cssContent = '';
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/g;
    
    htmlContent = htmlContent.replace(styleRegex, (match, p1) => {
        cssContent += p1 + '\n';
        return ''; // Remove it temporarily
    });

    if (cssContent.trim()) {
        fs.writeFileSync(cssPath, cssContent.trim());
        // Insert the <link> where the first style was, or in <head>
        htmlContent = htmlContent.replace('</head>', `  <link rel="stylesheet" href="/css/${fileObj.css}">\n</head>`);
        console.log(`Extracted CSS for ${fileObj.html}`);
    }

    // 2. Extract JS
    // Regex matches <script> ... </script> where there is no src attribute.
    let jsContent = '';
    const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;

    htmlContent = htmlContent.replace(scriptRegex, (match, p1) => {
        jsContent += p1 + '\n';
        return ''; // Remove it temporarily
    });

    if (jsContent.trim()) {
        fs.writeFileSync(jsPath, jsContent.trim());
        // Insert the <script> before </body>
        htmlContent = htmlContent.replace('</body>', `  <script src="/js/${fileObj.js}"></script>\n</body>`);
        console.log(`Extracted JS for ${fileObj.html}`);
    }

    // Write the cleaned HTML back
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`Updated ${fileObj.html}`);
}

console.log('Optimization complete!');
