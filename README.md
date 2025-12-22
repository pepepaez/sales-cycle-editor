# Sales Cycle Interactive Editor

A visual Gantt-style editor for mapping out sales cycle activities, stages, dependencies, and deliverables.

## Project Structure

```
sales-cycle-editor/
├── index.html              # Main HTML file
├── css/
│   └── styles.css          # All styles (themes, components, layout)
├── js/
│   ├── data.js             # Default/sample data and constants
│   └── app.js              # Application logic
├── sales-cycle-editor.code-workspace  # VS Code workspace
└── README.md               # This file
```

## Getting Started

### Option 1: Live Server (Recommended)
1. Open the project folder in VS Code
2. Install the "Live Server" extension if you haven't already
3. Right-click on `index.html` and select "Open with Live Server"
4. The editor will open in your browser at `http://localhost:5500`

### Option 2: Direct File
Simply open `index.html` in any modern browser. Note: Some features may be limited due to CORS restrictions when running from file://.

## Features

### Chart Elements
- **Stages**: Configurable sales stages (Discovery, Evaluation, Decision, Close, etc.)
- **Swimlanes**: Top-level groupings (e.g., Account Executive, Solution Strategist, Prospect)
- **Sections**: Sub-groupings within swimlanes
- **Activities**: Individual tasks with timing bars

### Activity Properties
- **Exit Gates**: Diamond markers that snap to stage boundaries
- **Deliverables**: Activities that produce artifacts
- **Shared**: Activities spanning multiple swimlanes
- **Dependencies**: Predecessor/successor relationships (multi-select)
- **Friction Points**: Known challenges with resolution paths
- **Notes**: Additional context and details

### Interactions
- Drag bar edges to resize activities
- Drag bar center to move activities
- Click activity name to edit in slide panel
- Toggle G (gate) and D (deliverable) badges directly
- Drag sections and activities to reorder
- Collapse/expand swimlanes and sections

### Data Management
- **Export**: Download chart as JSON
- **Import**: Load JSON data
- **Save**: Store to localStorage
- **Reset**: Return to default tutorial data

### Keyboard Shortcuts
- `Escape`: Close slide panel without saving

## Customization

### Modifying Default Data
Edit `js/data.js` to change the initial chart data, including:
- `STAGE_COLORS`: Available color palette
- `ACTIVITY_COL_WIDTH`: Width of the activity name column
- `ganttData`: Default stages, swimlanes, sections, and activities

### Styling
All styles are in `css/styles.css` with CSS custom properties for theming:
- Dark theme (default): Root variables
- Light theme: `.light` class overrides

### Adding Features
Main application logic is in `js/app.js`, organized by:
- Rendering functions (`render`, `renderStageHeaders`, `renderSwimlanes`, etc.)
- Modal functions (`openActivityModal`, `closeActivityModal`, etc.)
- Slide panel functions (`openSlidePanel`, `saveSlidePanel`, etc.)
- Drag and drop handlers
- Data manipulation utilities

## Browser Support

Tested in modern browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
