# Standalone Viewer Generator

This tool allows you to generate standalone HTML files with embedded JSON data that can be shared without needing a server.

## Usage

```bash
node generate-viewer.js --json=<path-to-json> [--output=<output-file>]
```

### Parameters

- `--json=<path>` (required): Path to the JSON file containing your sales cycle data
- `--output=<path>` (optional): Path for the output HTML file. If not specified, it will be named `<json-basename>-viewer.html`

### Examples

Generate a standalone viewer from a JSON file:
```bash
node generate-viewer.js --json=example-full-featured.json
```

This will create `example-full-featured-viewer.html` that automatically loads and displays the data when opened.

Specify a custom output filename:
```bash
node generate-viewer.js --json=example-full-featured.json --output=my-sales-cycle.html
```

Using a JSON file from another directory:
```bash
node generate-viewer.js --json=/path/to/your/project.json --output=project-viewer.html
```

## Features

- **Auto-loads data**: The embedded data automatically loads when you open the HTML file
- **Truly self-contained**: All CSS, JavaScript, and data embedded in a single HTML file - no external dependencies
- **No server required**: Can be opened directly in any web browser
- **Still flexible**: The "Open JSON File" button still works, allowing users to load other JSON files
- **Easy to share**: Just send the single HTML file via email, cloud storage, etc.

## Sharing Tips

Since some email systems block `.html` attachments, you can:
1. **Rename to `.txt`**: Rename the file to `.html.txt` before emailing. Recipient renames it back to `.html`
2. **Compress to ZIP**: Put the HTML file in a ZIP archive before sending
3. **Use cloud storage**: Upload to Google Drive/Dropbox and share the link

## What gets bundled

- All base CSS styles from css/styles.css (inlined)
- All viewer-specific CSS from viewer.html (already inline)
- All JavaScript from js/viewer.js (inlined)
- Your JSON data (embedded as a JavaScript variable)
- Theme switching functionality
- Font size selector
- Hidden scrollbars styling
- All viewer features

## File size

The generated file is typically 100-130KB depending on the size of your embedded JSON data.
