#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
let jsonPath = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--json=')) {
        jsonPath = args[i].substring('--json='.length);
    } else if (args[i].startsWith('--output=')) {
        outputPath = args[i].substring('--output='.length);
    }
}

// Validate arguments
if (!jsonPath) {
    console.error('Error: --json parameter is required');
    console.log('Usage: node generate-viewer.js --json=<path-to-json> [--output=<output-file>]');
    console.log('Example: node generate-viewer.js --json=template-example.json --output=my-viewer.html');
    process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found: ${jsonPath}`);
    process.exit(1);
}

// Set default output path if not provided
if (!outputPath) {
    const basename = path.basename(jsonPath, '.json');
    outputPath = `${basename}-viewer.html`;
}

console.log(`Reading JSON from: ${jsonPath}`);
console.log(`Output will be written to: ${outputPath}`);

try {
    // Read the JSON file
    const jsonData = fs.readFileSync(jsonPath, 'utf8');

    // Validate JSON
    const parsedData = JSON.parse(jsonData);
    const projectName = parsedData.projectName || path.basename(jsonPath, '.json');

    // Read viewer.html
    const viewerHtmlPath = path.join(__dirname, 'viewer.html');
    if (!fs.existsSync(viewerHtmlPath)) {
        console.error('Error: viewer.html not found in the same directory as this script');
        process.exit(1);
    }
    let viewerHtml = fs.readFileSync(viewerHtmlPath, 'utf8');

    // Read viewer.js
    const viewerJsPath = path.join(__dirname, 'js', 'viewer.js');
    if (!fs.existsSync(viewerJsPath)) {
        console.error('Error: js/viewer.js not found');
        process.exit(1);
    }
    const viewerJs = fs.readFileSync(viewerJsPath, 'utf8');

    // Read styles.css to inline it
    const stylesPath = path.join(__dirname, 'css', 'styles.css');
    if (!fs.existsSync(stylesPath)) {
        console.error('Error: css/styles.css not found');
        process.exit(1);
    }
    const stylesCSS = fs.readFileSync(stylesPath, 'utf8');

    // Remove the external stylesheet link and replace with inline styles
    viewerHtml = viewerHtml.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        `<style>\n${stylesCSS}\n</style>`
    );

    // Create the embedded data script
    const embeddedDataScript = `
    // Embedded JSON data
    const EMBEDDED_DATA = ${jsonData};

    // Auto-load embedded data on page load
    window.addEventListener('DOMContentLoaded', function() {
        if (EMBEDDED_DATA) {
            console.log('Loading embedded data...');
            document.getElementById('project-name').textContent = '${projectName.replace(/'/g, "\\'")}';
            ganttData = EMBEDDED_DATA;
            initializeViewer();
        }
    });
    `;

    // Replace the script tag in viewer.html with inline script including embedded data
    let standaloneHtml = viewerHtml.replace(
        '<script src="js/viewer.js"></script>',
        `<script>\n${embeddedDataScript}\n\n${viewerJs}\n</script>`
    );

    // Write the standalone HTML file
    fs.writeFileSync(outputPath, standaloneHtml, 'utf8');

    console.log(`✅ Successfully generated standalone viewer: ${outputPath}`);
    console.log(`📦 The file includes embedded JSON data and can be opened directly in a browser`);
    console.log(`📄 You can still use the "Open JSON File" button to load other JSON files`);

} catch (error) {
    console.error('Error generating standalone viewer:', error.message);
    process.exit(1);
}
