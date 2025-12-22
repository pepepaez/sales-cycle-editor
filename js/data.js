const STAGE_COLORS = ['#58a6ff','#a371f7','#f778ba','#56d364','#f0883e','#f85149','#79c0ff','#ffd33d'];
const ACTIVITY_COL_WIDTH = 380;

let ganttData = {
    stages: [
        { id: 's1', num: '1', name: 'Discovery', color: '#58a6ff' },
        { id: 's2', num: '2', name: 'Evaluation', color: '#a371f7' },
        { id: 's3', num: '3', name: 'Decision', color: '#f778ba' },
        { id: 's4', num: '4', name: 'Close', color: '#56d364' }
    ],
    swimlanes: [
        {
            id: 'tutorial', name: 'HOW TO USE THIS EDITOR', color: '#58a6ff', collapsed: false,
            sections: [
                { id: 'tut_basics', name: 'Basic Controls', collapsed: false, activities: [
                    { id: 't1', name: 'Drag bar edges to resize activities', start: 5, end: 30, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Grab the left or right edge of any bar and drag to change its start or end position. The bar will stay within stage boundaries.' },
                    { id: 't2', name: 'Drag the bar center to move it', start: 35, end: 60, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Click and drag the middle of a bar to move the entire activity left or right along the timeline.' },
                    { id: 't3', name: 'Click activity name to edit details', start: 65, end: 95, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Click on any activity name in the left column to open the edit modal where you can change all properties.' }
                ]},
                { id: 'tut_features', name: 'Key Features', collapsed: false, activities: [
                    { id: 't4', name: 'This is an Exit Gate (diamond marker)', start: 25, end: 25, isGate: true, isDeliverable: false, isShared: false, sharedWith: [], predecessor: 't1', friction: '', resolution: '', deliverableDetails: '', notes: 'Exit gates snap to stage boundaries. They represent checkpoints that must be passed before moving to the next stage. Toggle via the G badge or in edit modal.' },
                    { id: 't5', name: 'This has a Deliverable (D indicator)', start: 30, end: 55, isGate: false, isDeliverable: true, isShared: false, sharedWith: [], predecessor: 't4', friction: '', resolution: '', deliverableDetails: 'Document, presentation, or artifact produced by this activity', notes: 'Activities marked as deliverables show a D indicator. Add details about what is produced in the Deliverable Details field.' },
                    { id: 't6', name: 'This has Friction (warning indicator)', start: 55, end: 80, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: 'This describes a known challenge or blocker', resolution: 'This describes how to address the friction', deliverableDetails: '', notes: 'Use friction and resolution fields to document known challenges and their solutions.' },
                    { id: 't7', name: 'This has Notes (memo indicator)', start: 80, end: 100, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'The Notes field lets you capture additional context, instructions, or any other relevant information about an activity. Look for the memo icon on the bar!' }
                ]}
            ]
        },
        {
            id: 'deps', name: 'DEPENDENCIES EXAMPLE', color: '#a371f7', collapsed: false,
            sections: [
                { id: 'dep_sec', name: 'Predecessor and Successor Relationships', collapsed: false, activities: [
                    { id: 'd1', name: 'First activity (has successors)', start: 5, end: 25, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'This activity has no predecessor but has successors. Hover over it to see the successor highlighted in green.' },
                    { id: 'd2', name: 'Second activity (has predecessor and successor)', start: 28, end: 50, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: 'd1', friction: '', resolution: '', deliverableDetails: '', notes: 'This activity depends on the first one. Hover to see predecessor highlighted in blue and successor in green.' },
                    { id: 'd3', name: 'Third activity (has predecessor only)', start: 55, end: 80, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: 'd2', friction: '', resolution: '', deliverableDetails: '', notes: 'This is the last in the chain. Hover to see its predecessor highlighted in blue.' },
                    { id: 'd4', name: 'Hover over any bar to see dependencies highlighted!', start: 85, end: 100, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'The dependency indicator (arrows icon) appears on bars that have predecessors or successors.' }
                ]}
            ]
        },
        {
            id: 'structure', name: 'ORGANIZING YOUR CHART', color: '#f0883e', collapsed: false,
            sections: [
                { id: 'struct_swim', name: 'Swimlanes (Top Level)', collapsed: false, activities: [
                    { id: 's1a', name: 'Click swimlane name to collapse/expand', start: 5, end: 35, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Swimlanes are the top-level groupings (like this one). Click the name to collapse. Use edit button to rename or change color.' },
                    { id: 's2a', name: 'Use + Add Swimlane at bottom to create new ones', start: 40, end: 70, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Scroll to the bottom of the chart to find the Add Swimlane button. Each swimlane can have its own color.' }
                ]},
                { id: 'struct_sec', name: 'Sections (Within Swimlanes)', collapsed: false, activities: [
                    { id: 's3a', name: 'Sections group related activities', start: 5, end: 40, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Sections help organize activities within a swimlane. Click section header to collapse. Drag the handle to reorder sections.' },
                    { id: 's4a', name: 'Click + on section header to add activity there', start: 45, end: 75, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Each section has a + button to add activities directly to that section. You can also drag activities between sections.' }
                ]},
                { id: 'struct_act', name: 'Activities (The Bars)', collapsed: false, activities: [
                    { id: 's5a', name: 'Drag the handle to reorder activities', start: 5, end: 50, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Use the drag handle (dots) on the left of each activity to reorder within a section or move to another section in the same swimlane.' },
                    { id: 's6a', name: 'Toggle G and D badges directly', start: 55, end: 95, isGate: false, isDeliverable: true, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: 'Quick toggle example', notes: 'The G (gate) and D (deliverable) badges can be clicked directly to toggle without opening the edit modal.' }
                ]}
            ]
        },
        {
            id: 'toolbar', name: 'TOOLBAR FEATURES', color: '#3fb950', collapsed: false,
            sections: [
                { id: 'tool_sec', name: 'Top Toolbar Buttons', collapsed: false, activities: [
                    { id: 'tb1', name: 'Stages button: configure stage names and colors', start: 5, end: 25, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Click Stages in the toolbar to add, remove, rename, reorder, and recolor the stages at the top of the chart.' },
                    { id: 'tb2', name: 'Export JSON: download your chart data', start: 28, end: 48, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Export saves your entire chart as a JSON file that you can share or import later.' },
                    { id: 'tb3', name: 'Import JSON: load a saved chart', start: 51, end: 71, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Import loads a previously exported JSON file, replacing the current chart data.' },
                    { id: 'tb4', name: 'Theme toggle: switch light/dark mode', start: 74, end: 100, isGate: false, isDeliverable: false, isShared: false, sharedWith: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Click the sun/moon icon to toggle between light and dark themes. Your preference is saved.' }
                ]}
            ]
        }
    ]
};
