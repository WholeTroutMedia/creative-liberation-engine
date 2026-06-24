import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const libraryDir = path.join(__dirname, '../design-library');
const outputFilePath = path.join(__dirname, '../library-index.json');

const EXCLUDED_ITEMS = ['.DS_Store', 'vc-analysis.html'];

function buildIndex() {
    const index = {
        libraries: {},
        totalItems: 0,
        lastUpdated: new Date().toISOString()
    };

    if (!fs.existsSync(libraryDir)) {
        console.error(`Library directory not found: ${libraryDir}`);
        return;
    }

    const categories = fs.readdirSync(libraryDir).filter(file => {
        return fs.statSync(path.join(libraryDir, file)).isDirectory() && !EXCLUDED_ITEMS.includes(file);
    });

    categories.forEach(category => {
        const categoryPath = path.join(libraryDir, category);
        const files = getAllFiles(categoryPath);
        
        // Convert to relative paths from ATELIER root and filter out non-media files if necessary
        const mediaFiles = files
            .map(file => path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'))
            .filter(file => /\.(png|jpe?g|gif|svg|webp|mp4|webm)$/i.test(file));

        if (mediaFiles.length > 0) {
            index.libraries[category] = mediaFiles;
            index.totalItems += mediaFiles.length;
        }
    });

    fs.writeFileSync(outputFilePath, JSON.stringify(index, null, 2));
    console.log(`✅ Library index built successfully! Total items: ${index.totalItems}`);
}

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });

    return arrayOfFiles;
}

buildIndex();
