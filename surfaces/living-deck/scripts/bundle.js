import fs from 'fs';
import path from 'path';

const distDir = 'y:/creative-liberation-engine/surfaces/living-deck/dist';
const assetsDir = path.join(distDir, 'assets');
const publicDir = 'y:/creative-liberation-engine/surfaces/living-deck/public';
const artifactDir = 'C:/Users/jahar/.gemini/antigravity/brain/348d3042-0044-49d2-812e-e4697ee1b45d';

console.log('Starting Single-File Presentation Bundler Swarm...');

// 1. Find the CSS and JS compiled bundles
const files = fs.readdirSync(assetsDir);
const cssFile = files.find(f => f.endsWith('.css'));
const jsFile = files.find(f => f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('CRITICAL: Compiled CSS or JS bundle not found in dist/assets!');
  process.exit(1);
}

console.log(`Found CSS asset: ${cssFile}`);
console.log(`Found JS asset: ${jsFile}`);

// 2. Read the asset contents
const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
let htmlContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// 3. Inline the CSS and JS into the HTML content
// Replace: <link rel="stylesheet" crossorigin href="/assets/index-CsVDviWt.css">
// With: <style>...css...</style>
const cssRegex = new RegExp(`<link[^>]*href=["']?\\/assets\\/${cssFile}["']?[^>]*>`, 'i');
htmlContent = htmlContent.replace(cssRegex, `<style>\n${cssContent}\n</style>`);

// Replace: <script type="module" crossorigin src="/assets/index-DPVsiRIB.js"></script>
// With: <script defer>...js...</script> to bypass CORS blocks on file:/// protocol
const jsRegex = new RegExp(`<script[^>]*src=["']?\\/assets\\/${jsFile}["']?[^>]*><\\/script>`, 'i');
htmlContent = htmlContent.replace(jsRegex, `<script defer>\n${jsContent}\n</script>`);

// 3.5. Convert absolute /image.png references to relative ./image.png references for file:/// portability
htmlContent = htmlContent.replace(/(["'])\/([^"'\s>]+\.png)(["'])/g, '$1./$2$3');
console.log('SUCCESS: Converted absolute asset paths to relative path pointers.');

// 3.6. Copy all public PNG assets directly to the artifacts directory
if (fs.existsSync(publicDir)) {
  const publicFiles = fs.readdirSync(publicDir);
  let copyCount = 0;
  publicFiles.forEach(file => {
    if (file.endsWith('.png')) {
      const srcPath = path.join(publicDir, file);
      const destPath = path.join(artifactDir, file);
      fs.copyFileSync(srcPath, destPath);
      copyCount++;
    }
  });
  console.log(`SUCCESS: Copied ${copyCount} public PNG assets directly to the artifacts directory.`);
}

// 4. Output the single standalone HTML file
const outputDeckPath = 'y:/creative-liberation-engine/surfaces/living-deck/dist/cle_v7_sovereign_deck.html';
const artifactDeckPath = 'C:/Users/jahar/.gemini/antigravity/brain/348d3042-0044-49d2-812e-e4697ee1b45d/cle_v7_sovereign_deck.html';

fs.writeFileSync(outputDeckPath, htmlContent, 'utf8');
fs.writeFileSync(artifactDeckPath, htmlContent, 'utf8');

console.log(`SUCCESS: Portable Standalone Keynote compiled at: ${outputDeckPath}`);
console.log(`SUCCESS: Copied to artifacts directory for direct user download: ${artifactDeckPath}`);

