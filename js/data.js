const STAGE_COLORS = ['#58a6ff','#a371f7','#f778ba','#56d364','#f0883e','#f85149','#79c0ff','#ffd33d'];
let ACTIVITY_COL_WIDTH = 380;

// Bright colors for actors
const ACTOR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
];

// Pastel colors for swimlanes (sections)
const SWIMLANE_COLORS = [
    '#FFE5E5', '#E5F9F9', '#E5F4FF', '#FFF0E5', '#E5F9F0',
    '#FFFAE5', '#F5E5FF', '#E5F0FF', '#FFF7E5', '#E5FFE5'
];

// Medium-bright colors for activity types
const ACTIVITY_TYPE_COLORS = [
    '#58a6ff', '#a371f7', '#f778ba', '#56d364', '#f0883e',
    '#f85149', '#79c0ff', '#ffd33d', '#FF6B6B', '#4ECDC4',
    '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'
];

let ganttData = {
    activityColumnWidth: 380,
    stages: [
        { id: 's1', num: '1', name: 'Phase 1', color: '#58a6ff' },
        { id: 's2', num: '2', name: 'Phase 2', color: '#a371f7' },
        { id: 's3', num: '3', name: 'Phase 3', color: '#f778ba' },
        { id: 's4', num: '4', name: 'Phase 4', color: '#56d364' }
    ],
    actors: [
        { id: 'actor1', name: 'First Actor', color: '#FF6B6B' },
        { id: 'actor2', name: 'Second Actor', color: '#4ECDC4' },
        { id: 'actor3', name: 'Third Actor', color: '#45B7D1' },
        { id: 'actor4', name: 'Fourth Actor', color: '#FFA07A' }
    ],
    activityTypes: [
        { id: 'type1', name: 'Discovery', color: '#58a6ff' },
        { id: 'type2', name: 'Analysis', color: '#a371f7' },
        { id: 'type3', name: 'Design', color: '#f778ba' },
        { id: 'type4', name: 'Implementation', color: '#56d364' },
        { id: 'type5', name: 'Review', color: '#f0883e' }
    ],
    swimlanes: [
        {
            id: 'tutorial1', name: 'Tutorial: Basic Features', color: '#FFE5E5', collapsed: false,
            activities: [
                { id: 'swim1', name: 'Swimlane-level activity (no section)', start: 5, end: 30, isGate: false, isDeliverable: false, accountable: 'actor1', responsible: ['actor2'], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Activities can exist at the swimlane level without being in a section. Use the "+ Activity" button at the swimlane level to create these.', activityType: 'type1' }
            ],
            sections: [
                { id: 'basics', name: 'Section: Interactive Controls', collapsed: false, activities: [
                    { id: 'act1', name: 'Drag bar edges to resize', start: 5, end: 30, isGate: false, isDeliverable: false, accountable: 'actor1', responsible: [], consulted: ['actor2'], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Grab the left or right edge of any bar and drag to change duration.', activityType: 'type1' },
                    { id: 'act2', name: 'Drag center to move (no notes)', start: 35, end: 60, isGate: false, isDeliverable: false, accountable: 'actor2', responsible: ['actor1'], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: '', activityType: 'type2' },
                    { id: 'act3', name: 'Click name to edit', start: 65, end: 95, isGate: false, isDeliverable: false, accountable: 'actor1', responsible: [], consulted: [], informed: ['actor3'], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Click activity name or double-click bar to open the edit panel.', activityType: 'type3' }
                ]},
                { id: 'features', name: 'Section: Special Activity Types', collapsed: false, activities: [
                    { id: 'gate1', name: 'Exit Gate', start: 25, end: 25, isGate: true, isDeliverable: false, gateOwner: 'actor4', predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Exit gates (diamond markers) snap to stage boundaries and represent approval checkpoints.' },
                    { id: 'deliv1', name: 'Activity with Deliverable (D)', start: 30, end: 55, isGate: false, isDeliverable: true, accountable: 'actor2', responsible: ['actor3'], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: 'Example output or artifact', notes: 'The D indicator shows this activity produces a deliverable.', activityType: 'type4' },
                    { id: 'fric1', name: 'Activity with Friction (⚠)', start: 60, end: 85, isGate: false, isDeliverable: false, accountable: 'actor3', responsible: [], consulted: ['actor1'], informed: [], predecessor: null, friction: 'Known challenge or blocker', resolution: 'How to address it', deliverableDetails: '', notes: 'The warning icon indicates documented friction points.', activityType: 'type5' }
                ]}
            ]
        },
        {
            id: 'tutorial2', name: 'Tutorial: Dependencies & RACI', color: '#E5F9F9', collapsed: false,
            sections: [
                { id: 'deps', name: 'Section: Activity Dependencies', collapsed: false, activities: [
                    { id: 'dep1', name: 'First activity', start: 5, end: 25, isGate: false, isDeliverable: false, accountable: 'actor1', responsible: [], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'This activity has no predecessor. Hover to see successor highlighted in green.', activityType: 'type1' },
                    { id: 'dep2', name: 'Depends on first', start: 30, end: 55, isGate: false, isDeliverable: false, accountable: 'actor2', responsible: ['actor1'], consulted: [], informed: [], predecessor: 'dep1', friction: '', resolution: '', deliverableDetails: '', notes: 'This depends on the first activity. Hover to see predecessor (blue) and successor (green).', activityType: 'type2' },
                    { id: 'dep3', name: 'Depends on second', start: 60, end: 85, isGate: false, isDeliverable: false, accountable: 'actor3', responsible: [], consulted: [], informed: [], predecessor: 'dep2', friction: '', resolution: '', deliverableDetails: '', notes: 'Last in the chain. Hover to see predecessor highlighted in blue.', activityType: 'type3' }
                ]},
                { id: 'raci', name: 'Section: RACI Model Explained', collapsed: false, activities: [
                    { id: 'raci1', name: 'Accountable: One person (larger box)', start: 5, end: 40, isGate: false, isDeliverable: false, accountable: 'actor1', responsible: [], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'The larger colored box shows the Accountable actor - the one person ultimately answerable.', activityType: 'type4' },
                    { id: 'raci2', name: 'Responsible: Multiple people (small boxes)', start: 45, end: 80, isGate: false, isDeliverable: false, accountable: 'actor2', responsible: ['actor1', 'actor3'], consulted: [], informed: [], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Smaller boxes show Responsible actors - those doing the work. Can be multiple.', activityType: 'type5' },
                    { id: 'raci3', name: 'Full RACI: A, R, C, I roles', start: 85, end: 100, isGate: false, isDeliverable: false, accountable: 'actor4', responsible: ['actor1'], consulted: ['actor2'], informed: ['actor3'], predecessor: null, friction: '', resolution: '', deliverableDetails: '', notes: 'Accountable (decides), Responsible (does work), Consulted (provides input), Informed (kept updated). See tooltip!', activityType: 'type1' }
                ]}
            ]
        }
    ]
};
