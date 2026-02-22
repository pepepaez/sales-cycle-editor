// Sales Cycle Stage Viewer
let ganttData = null;
let currentStageIndex = 0;

// Display settings for card sections
let displaySettings = {
    showRaci: true,
    showGateOwner: true,
    showDependencies: true,
    showStageNotes: true,
    showChecklist: true,
    showDeliverable: true,
    showFriction: true,
    showGeneralNotes: true,
    showSwimlane: true
};

// Visible lanes (swimlane IDs) - default all visible
let visibleLanes = {};

// Theme management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.classList.contains('light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    if (newTheme === 'light') {
        html.classList.add('light');
    } else {
        html.classList.remove('light');
    }

    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (newTheme === 'dark') {
        icon.textContent = '🌙';
        label.textContent = 'Dark';
    } else {
        icon.textContent = '☀️';
        label.textContent = 'Light';
    }

    localStorage.setItem('theme', newTheme);
}

// Load theme on startup
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';

    if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
    } else {
        document.documentElement.classList.remove('light');
    }

    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (savedTheme === 'dark') {
        icon.textContent = '🌙';
        label.textContent = 'Dark';
    } else {
        icon.textContent = '☀️';
        label.textContent = 'Light';
    }
}

// Font size management
function changeFontSize(size) {
    // Set the CSS variable for base font size on both root and body
    const fontSize = size + 'px';
    document.documentElement.style.setProperty('--base-font-size', fontSize);
    document.body.style.setProperty('--base-font-size', fontSize);
    localStorage.setItem('fontSize', size);
}

// Load font size on startup
function loadFontSize() {
    const savedSize = localStorage.getItem('fontSize') || '13';
    const selector = document.getElementById('font-size-selector');
    if (selector) {
        selector.value = savedSize;
    }
    changeFontSize(savedSize);
}

// Load JSON file
function loadJSONFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            ganttData = JSON.parse(e.target.result);
            document.getElementById('project-name').textContent = file.name.replace('.json', '');
            initializeViewer();
        } catch (error) {
            alert('Error loading JSON file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Initialize the viewer
function initializeViewer() {
    if (!ganttData || !ganttData.stages || ganttData.stages.length === 0) {
        alert('Invalid JSON file: No stages found');
        return;
    }

    // Initialize visible lanes (all visible by default)
    initializeVisibleLanes();

    // Hide no-data message, show content
    document.getElementById('no-data').style.display = 'none';
    document.getElementById('legend-container').style.display = 'block';
    document.getElementById('stage-tabs-container').style.display = 'block';
    document.getElementById('kanban-board').style.display = 'flex';

    // Render legend
    renderLegend();

    // Render stage tabs
    renderStageTabs();

    // Render first stage by default
    currentStageIndex = 0;
    renderStage(currentStageIndex);
}

// Initialize visible lanes from saved settings or default to all visible
function initializeVisibleLanes() {
    const saved = localStorage.getItem('viewerVisibleLanes');
    if (saved) {
        try {
            visibleLanes = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading visible lanes:', e);
        }
    }

    // Ensure all swimlanes have an entry (default to true if not set)
    ganttData.swimlanes.forEach(swimlane => {
        if (visibleLanes[swimlane.id] === undefined) {
            visibleLanes[swimlane.id] = true;
        }
    });
}

// Render legend
function renderLegend() {
    const container = document.getElementById('legend');
    let html = '';

    // Add activity types
    if (ganttData.activityTypes && ganttData.activityTypes.length > 0) {
        html += `<div class="legend-header">Activity Types:</div>`;
        ganttData.activityTypes.forEach(type => {
            html += `<div class="legend-item"><div class="legend-bar" style="background:${type.color}"></div>${type.name}</div>`;
        });

        // Add separator between activity types and actors
        if (ganttData.actors && ganttData.actors.length > 0) {
            html += `<div class="legend-separator"></div>`;
        }
    }

    // Add actors
    if (ganttData.actors && ganttData.actors.length > 0) {
        html += `<div class="legend-header">Actors:</div>`;
        ganttData.actors.forEach(actor => {
            html += `<div class="legend-item"><div class="legend-bar" style="background:${actor.color}"></div>${actor.name}</div>`;
        });
    }

    container.innerHTML = html;
}

// Render stage tabs
function renderStageTabs() {
    const container = document.getElementById('stage-tabs');
    container.innerHTML = '';

    ganttData.stages.forEach((stage, index) => {
        const tab = document.createElement('button');
        tab.className = 'stage-tab';
        tab.style.borderColor = stage.color || '#58a6ff';
        if (index === currentStageIndex) {
            tab.classList.add('active');
            tab.style.color = stage.color || '#58a6ff';
        }
        tab.textContent = `${stage.num}. ${stage.name}`;
        tab.onclick = () => switchStage(index);
        container.appendChild(tab);
    });
}

// Switch to a different stage
function switchStage(index) {
    currentStageIndex = index;
    renderStageTabs();
    renderStage(index);
}

// Render a specific stage as kanban board
function renderStage(stageIndex) {
    const stage = ganttData.stages[stageIndex];
    const stageWidth = 100 / ganttData.stages.length;
    const stageStart = stageIndex * stageWidth;
    const stageEnd = (stageIndex + 1) * stageWidth;

    const board = document.getElementById('kanban-board');
    board.innerHTML = '';

    // Collect all gates and regular activities separately
    const allGates = [];

    // For each swimlane, create a kanban column
    ganttData.swimlanes.forEach(swimlane => {
        // Skip if lane is not visible
        if (visibleLanes[swimlane.id] === false) return;

        const { activities, gates } = getAllActivitiesForStage(swimlane, stageStart, stageEnd, stage.id);

        // Collect gates with swimlane info
        gates.forEach(gate => {
            allGates.push({ ...gate, swimlane: swimlane });
        });

        // Only show column if it has non-gate activities in this stage
        if (activities.length === 0) return;

        const column = createKanbanColumn(swimlane, activities, stage);
        board.appendChild(column);
    });

    // Add gates column if there are any gates
    if (allGates.length > 0) {
        const gatesColumn = createGatesColumn(allGates, stage);
        board.appendChild(gatesColumn);
    }

    // If no activities in any swimlane, show message
    if (board.children.length === 0) {
        board.innerHTML = '<div class="no-data-message"><h2>No activities in this stage</h2></div>';
    }
}

// Get all activities for a swimlane that overlap with a stage, separated by gates
function getAllActivitiesForStage(swimlane, stageStart, stageEnd, stageId) {
    const activities = [];
    const gates = [];

    // Get swimlane-level activities
    if (swimlane.activities) {
        swimlane.activities.forEach(act => {
            if (act.end > stageStart && act.start <= stageEnd) {
                const actWithSection = { ...act, section: null };
                if (act.isGate) {
                    gates.push(actWithSection);
                } else {
                    activities.push(actWithSection);
                }
            }
        });
    }

    // Get section activities
    if (swimlane.sections) {
        swimlane.sections.forEach(section => {
            if (section.activities) {
                section.activities.forEach(act => {
                    if (act.end > stageStart && act.start <= stageEnd) {
                        const actWithSection = { ...act, section: section.name };
                        if (act.isGate) {
                            gates.push(actWithSection);
                        } else {
                            activities.push(actWithSection);
                        }
                    }
                });
            }
        });
    }

    return { activities, gates };
}

// Create kanban column for a swimlane
function createKanbanColumn(swimlane, activities, stage) {
    const column = document.createElement('div');
    column.className = 'kanban-column';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    const swimlaneColor = swimlane.color || '#58a6ff';
    header.style.borderBottomColor = swimlaneColor;

    const title = document.createElement('h3');
    title.className = 'kanban-column-title';
    title.textContent = swimlane.name;
    title.style.color = swimlaneColor;

    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.style.color = swimlaneColor;
    count.textContent = `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`;

    header.appendChild(title);
    header.appendChild(count);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';

    // Group activities by activity type
    const groupedActivities = {};
    activities.forEach(activity => {
        const typeId = activity.activityType || 'none';
        if (!groupedActivities[typeId]) {
            groupedActivities[typeId] = [];
        }
        groupedActivities[typeId].push(activity);
    });

    // Render activities grouped by type
    Object.keys(groupedActivities).forEach(typeId => {
        groupedActivities[typeId].forEach(activity => {
            const card = createActivityCard(activity, stage);
            cardsContainer.appendChild(card);
        });
    });

    column.appendChild(header);
    column.appendChild(cardsContainer);

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'column-resize-handle';
    resizeHandle.addEventListener('mousedown', (e) => startColumnResize(e, column));
    column.appendChild(resizeHandle);

    return column;
}

// Create gates column
function createGatesColumn(gates, stage) {
    const column = document.createElement('div');
    column.className = 'kanban-column gates-column';

    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.style.borderBottomColor = '#f85149';

    const title = document.createElement('h3');
    title.className = 'kanban-column-title';
    title.textContent = '🚪 Exit Gates';
    title.style.color = '#f85149';

    const count = document.createElement('div');
    count.className = 'kanban-column-count';
    count.style.color = '#f85149';
    count.textContent = `${gates.length} ${gates.length === 1 ? 'gate' : 'gates'}`;

    header.appendChild(title);
    header.appendChild(count);

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards';

    gates.forEach(gate => {
        const card = createActivityCard(gate, stage);
        cardsContainer.appendChild(card);
    });

    column.appendChild(header);
    column.appendChild(cardsContainer);

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'column-resize-handle';
    resizeHandle.addEventListener('mousedown', (e) => startColumnResize(e, column));
    column.appendChild(resizeHandle);

    return column;
}

// Create activity card
function createActivityCard(activity, stage) {
    const card = document.createElement('div');
    card.className = 'activity-card';

    // Get activity type info
    let typeColor = '#58a6ff';
    let typeName = 'Activity';
    if (activity.activityType && ganttData.activityTypes) {
        const actType = ganttData.activityTypes.find(t => t.id === activity.activityType);
        if (actType) {
            typeColor = actType.color;
            typeName = actType.name;
        }
    }

    // Card header with title and RACI matrix
    const header = document.createElement('div');
    header.className = 'card-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'card-header-left';

    const typeIndicator = document.createElement('div');
    typeIndicator.className = 'card-type-indicator';
    typeIndicator.style.background = typeColor;

    const titleSection = document.createElement('div');
    titleSection.className = 'card-title-section';

    const title = document.createElement('h4');
    title.className = 'card-title';
    title.textContent = activity.name;
    if (activity.section) {
        title.textContent += ` (${activity.section})`;
    }

    const badges = document.createElement('div');
    badges.className = 'card-badges';

    // Only show deliverable badge if there are no deliverable details
    if (activity.isDeliverable && !activity.deliverableDetails) {
        const badge = document.createElement('span');
        badge.className = 'card-badge deliverable';
        badge.textContent = 'Deliverable';
        badges.appendChild(badge);
    }

    titleSection.appendChild(title);
    if (badges.children.length > 0) {
        titleSection.appendChild(badges);
    }

    headerLeft.appendChild(typeIndicator);
    headerLeft.appendChild(titleSection);
    header.appendChild(headerLeft);

    // Header right side: activity type badge, RACI matrix, or gate owner
    const headerRight = document.createElement('div');
    headerRight.className = 'card-header-right';

    // Activity type badge
    if (activity.activityType) {
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-type-badge';
        typeBadge.style.background = typeColor;
        typeBadge.style.color = 'white';
        typeBadge.textContent = typeName;
        headerRight.appendChild(typeBadge);
    }

    // RACI matrix (if not a gate)
    if (displaySettings.showRaci && !activity.isGate && ganttData.actors) {
        const raciMatrix = createRACIMatrix(activity);
        if (raciMatrix) headerRight.appendChild(raciMatrix);
    }

    // Gate owner (if gate and showing gate owner)
    if (displaySettings.showGateOwner && activity.isGate && activity.gateOwner && ganttData.actors) {
        const gateOwner = createGateOwnerBadge(activity.gateOwner);
        if (gateOwner) headerRight.appendChild(gateOwner);
    }

    if (headerRight.children.length > 0) {
        header.appendChild(headerRight);
    }

    card.appendChild(header);

    // Swimlane indicator for gates (when shown in gates column)
    if (displaySettings.showSwimlane && activity.isGate && activity.swimlane) {
        const swimlaneIndicator = document.createElement('div');
        swimlaneIndicator.className = 'card-swimlane-indicator';
        swimlaneIndicator.style.borderLeftColor = activity.swimlane.color || '#58a6ff';

        const label = document.createElement('span');
        label.className = 'swimlane-label';
        label.textContent = 'Swimlane:';

        const name = document.createElement('span');
        name.className = 'swimlane-name';
        name.style.color = activity.swimlane.color || '#58a6ff';
        name.textContent = activity.swimlane.name;

        swimlaneIndicator.appendChild(label);
        swimlaneIndicator.appendChild(name);
        card.appendChild(swimlaneIndicator);
    }

    // Dependencies
    if (displaySettings.showDependencies && activity.predecessor) {
        const depSection = createDependencySection(activity);
        if (depSection) card.appendChild(depSection);
    }

    // Stage-specific notes (prioritized)
    if (displaySettings.showStageNotes && activity.stageNotes && activity.stageNotes[stage.id]) {
        const notesSection = createStageNotesSection(activity.stageNotes[stage.id], stage);
        card.appendChild(notesSection);
    }

    // Checklist / Exit Criteria
    if (displaySettings.showChecklist && activity.checklist && activity.checklist.length > 0) {
        const checklistSection = createChecklistSection(activity.checklist, activity.isGate);
        card.appendChild(checklistSection);
    }

    // Deliverable details
    if (displaySettings.showDeliverable && activity.isDeliverable && activity.deliverableDetails) {
        const delivSection = createDeliverableSection(activity.deliverableDetails);
        card.appendChild(delivSection);
    }

    // Friction
    if (displaySettings.showFriction && activity.friction) {
        const frictionSection = createFrictionSection(activity.friction);
        card.appendChild(frictionSection);
    }

    // General notes (only if no stage-specific notes)
    if (displaySettings.showGeneralNotes && activity.notes && (!activity.stageNotes || !activity.stageNotes[stage.id])) {
        const notesSection = createGeneralNotesSection(activity.notes);
        card.appendChild(notesSection);
    }

    return card;
}

// Create RACI matrix (compact grid on card header)
function createRACIMatrix(activity) {
    const hasRaci = activity.accountable ||
                    (activity.responsible && activity.responsible.length > 0) ||
                    (activity.consulted && activity.consulted.length > 0) ||
                    (activity.informed && activity.informed.length > 0);

    if (!hasRaci) return null;

    const matrix = document.createElement('div');
    matrix.className = 'raci-matrix';

    // Collect all actors by role
    const roles = [];

    if (activity.accountable) {
        const actor = ganttData.actors.find(a => a.id === activity.accountable);
        if (actor) roles.push({ role: 'A', actor, tooltip: 'Accountable' });
    }

    if (activity.responsible && activity.responsible.length > 0) {
        activity.responsible.forEach(rId => {
            const actor = ganttData.actors.find(a => a.id === rId);
            if (actor) roles.push({ role: 'R', actor, tooltip: 'Responsible' });
        });
    }

    if (activity.consulted && activity.consulted.length > 0) {
        activity.consulted.forEach(cId => {
            const actor = ganttData.actors.find(a => a.id === cId);
            if (actor) roles.push({ role: 'C', actor, tooltip: 'Consulted' });
        });
    }

    if (activity.informed && activity.informed.length > 0) {
        activity.informed.forEach(iId => {
            const actor = ganttData.actors.find(a => a.id === iId);
            if (actor) roles.push({ role: 'I', actor, tooltip: 'Informed' });
        });
    }

    // Create grid items
    roles.forEach(({ role, actor, tooltip }) => {
        const item = document.createElement('div');
        item.className = 'raci-matrix-item';
        item.title = `${tooltip}: ${actor.name}`;

        const box = document.createElement('div');
        box.className = 'raci-actor-box';
        box.style.background = actor.color;

        // Get initials
        const words = actor.name.trim().split(/\s+/);
        let initials;
        if (words.length === 1) {
            initials = words[0].substring(0, 2).toUpperCase();
        } else {
            initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
        }
        box.textContent = initials;

        const roleLabel = document.createElement('span');
        roleLabel.className = 'raci-role-label';
        roleLabel.textContent = role;

        item.appendChild(box);
        item.appendChild(roleLabel);
        matrix.appendChild(item);
    });

    return matrix;
}

// Create gate owner badge (compact for header)
function createGateOwnerBadge(gateOwnerId) {
    const actor = ganttData.actors.find(a => a.id === gateOwnerId);
    if (!actor) return null;

    const container = document.createElement('div');
    container.className = 'card-gate-owner';
    container.title = `Gate Owner: ${actor.name}`;

    const box = document.createElement('div');
    box.className = 'gate-owner-box';
    box.style.background = actor.color;

    // Get initials
    const words = actor.name.trim().split(/\s+/);
    let initials;
    if (words.length === 1) {
        initials = words[0].substring(0, 2).toUpperCase();
    } else {
        initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    box.textContent = initials;

    const label = document.createElement('span');
    label.className = 'gate-owner-label';
    label.textContent = 'Owner';

    container.appendChild(box);
    container.appendChild(label);

    return container;
}

// Create dependency section
function createDependencySection(activity) {
    if (!activity.predecessor) return null;

    const section = document.createElement('div');
    section.className = 'card-info-row';

    const icon = document.createElement('span');
    icon.className = 'info-icon';
    icon.textContent = '🔗';

    const label = document.createElement('span');
    label.className = 'info-label';
    label.textContent = 'Depends on:';

    const value = document.createElement('span');
    value.className = 'info-value';

    // Find predecessor activity name
    let predName = activity.predecessor;
    ganttData.swimlanes.forEach(sl => {
        if (sl.activities) {
            const pred = sl.activities.find(a => a.id === activity.predecessor);
            if (pred) predName = pred.name;
        }
        if (sl.sections) {
            sl.sections.forEach(sec => {
                if (sec.activities) {
                    const pred = sec.activities.find(a => a.id === activity.predecessor);
                    if (pred) predName = pred.name;
                }
            });
        }
    });

    value.textContent = predName;

    section.appendChild(icon);
    section.appendChild(label);
    section.appendChild(value);

    return section;
}

// Create stage-specific notes section
function createStageNotesSection(notes, stage) {
    const section = document.createElement('div');
    section.className = 'card-stage-notes';

    const header = document.createElement('div');
    header.className = 'stage-notes-header';
    header.style.color = 'white';
    header.textContent = '📌 Notes';

    const text = document.createElement('p');
    text.className = 'card-notes-text';
    text.textContent = notes;

    section.appendChild(header);
    section.appendChild(text);
    return section;
}

// Create general notes section
function createGeneralNotesSection(notes) {
    const section = document.createElement('div');
    section.className = 'card-general-notes';

    const text = document.createElement('p');
    text.className = 'card-notes-text';
    text.textContent = notes;

    section.appendChild(text);
    return section;
}

// Create RACI section (old version - keeping for compatibility)
function createRACISection(activity) {
    const hasRaci = activity.accountable ||
                    (activity.responsible && activity.responsible.length > 0) ||
                    (activity.consulted && activity.consulted.length > 0) ||
                    (activity.informed && activity.informed.length > 0);

    if (!hasRaci) return null;

    const section = document.createElement('div');
    section.className = 'card-section';

    const title = document.createElement('div');
    title.className = 'card-section-title';
    title.textContent = 'RACI Assignments';
    section.appendChild(title);

    const raciContainer = document.createElement('div');
    raciContainer.className = 'card-raci';

    // Accountable
    if (activity.accountable) {
        const actor = ganttData.actors.find(a => a.id === activity.accountable);
        if (actor) {
            const item = createRACIItem('A', actor);
            raciContainer.appendChild(item);
        }
    }

    // Responsible
    if (activity.responsible && activity.responsible.length > 0) {
        activity.responsible.forEach(rId => {
            const actor = ganttData.actors.find(a => a.id === rId);
            if (actor) {
                const item = createRACIItem('R', actor);
                raciContainer.appendChild(item);
            }
        });
    }

    // Consulted
    if (activity.consulted && activity.consulted.length > 0) {
        activity.consulted.forEach(cId => {
            const actor = ganttData.actors.find(a => a.id === cId);
            if (actor) {
                const item = createRACIItem('C', actor);
                raciContainer.appendChild(item);
            }
        });
    }

    // Informed
    if (activity.informed && activity.informed.length > 0) {
        activity.informed.forEach(iId => {
            const actor = ganttData.actors.find(a => a.id === iId);
            if (actor) {
                const item = createRACIItem('I', actor);
                raciContainer.appendChild(item);
            }
        });
    }

    section.appendChild(raciContainer);
    return section;
}

// Create RACI item
function createRACIItem(role, actor) {
    const item = document.createElement('div');
    item.className = 'card-raci-item';

    const box = document.createElement('div');
    box.className = 'card-actor-box';
    box.style.background = actor.color;

    // Get initials
    const words = actor.name.trim().split(/\s+/);
    let initials;
    if (words.length === 1) {
        initials = words[0].substring(0, 2).toUpperCase();
    } else {
        initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    box.textContent = initials;

    const label = document.createElement('span');
    label.className = 'card-raci-label';
    label.textContent = role + ':';

    const name = document.createElement('span');
    name.className = 'card-raci-name';
    name.textContent = actor.name;

    item.appendChild(box);
    item.appendChild(label);
    item.appendChild(name);

    return item;
}

// Create gate owner section
function createGateOwnerSection(activity) {
    const actor = ganttData.actors.find(a => a.id === activity.gateOwner);
    if (!actor) return null;

    const section = document.createElement('div');
    section.className = 'card-info-row';

    const icon = document.createElement('span');
    icon.className = 'info-icon';
    icon.textContent = '👤';

    const label = document.createElement('span');
    label.className = 'info-label';
    label.textContent = 'Gate Owner:';

    const box = document.createElement('div');
    box.className = 'raci-actor-box';
    box.style.background = actor.color;
    box.style.width = '28px';
    box.style.height = '28px';
    box.style.fontSize = '11px';

    // Get initials
    const words = actor.name.trim().split(/\s+/);
    let initials;
    if (words.length === 1) {
        initials = words[0].substring(0, 2).toUpperCase();
    } else {
        initials = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    box.textContent = initials;

    const name = document.createElement('span');
    name.className = 'info-value';
    name.textContent = actor.name;

    section.appendChild(icon);
    section.appendChild(label);
    section.appendChild(box);
    section.appendChild(name);

    return section;
}

// Create notes section
function createNotesSection(notes, stage) {
    const section = document.createElement('div');
    section.className = 'card-notes';
    section.style.borderLeftColor = stage.color || '#58a6ff';

    const text = document.createElement('p');
    text.className = 'card-notes-text';
    text.textContent = notes;

    section.appendChild(text);
    return section;
}

// Create deliverable section
function createDeliverableSection(details) {
    const section = document.createElement('div');
    section.className = 'card-section';

    const title = document.createElement('div');
    title.className = 'card-section-title';
    title.textContent = '📄 Deliverable';
    section.appendChild(title);

    const text = document.createElement('p');
    text.className = 'card-notes-text';
    text.textContent = details;

    section.appendChild(text);
    return section;
}

// Create friction section
function createFrictionSection(friction) {
    const section = document.createElement('div');
    section.className = 'card-section friction';

    const title = document.createElement('div');
    title.className = 'card-section-title';
    title.textContent = '⚠️ Friction';
    section.appendChild(title);

    const text = document.createElement('p');
    text.className = 'card-notes-text';
    text.textContent = friction;

    section.appendChild(text);
    return section;
}

function createChecklistSection(checklist, isGate) {
    const section = document.createElement('div');
    section.className = 'card-section checklist';
    section.style.borderLeftColor = isGate ? '#f85149' : '#79c0ff';

    const title = document.createElement('div');
    title.className = 'card-section-title';
    title.style.color = isGate ? '#f85149' : '#79c0ff';
    title.textContent = isGate ? '✓ Exit Criteria' : '✓ Checklist';
    section.appendChild(title);

    const list = document.createElement('ul');
    list.style.cssText = 'margin: 0; padding-left: 20px; color: var(--text-primary);';

    checklist.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.text;
        li.style.cssText = 'font-size: 13px; line-height: 1.6; margin-bottom: 4px;';
        list.appendChild(li);
    });

    section.appendChild(list);
    return section;
}

// Helper function to get contrasting text color
function getContrastingTextColor(hexColor) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Column resize functionality
let resizingColumn = null;
let resizeStartX = 0;
let resizeStartWidth = 0;

function startColumnResize(e, column) {
    e.preventDefault();
    resizingColumn = column;
    resizeStartX = e.clientX;
    resizeStartWidth = column.offsetWidth;

    document.addEventListener('mousemove', doColumnResize);
    document.addEventListener('mouseup', stopColumnResize);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

function doColumnResize(e) {
    if (!resizingColumn) return;

    const deltaX = e.clientX - resizeStartX;
    const newWidth = resizeStartWidth + deltaX;

    // Respect min width
    const minWidth = 280;
    const clampedWidth = Math.max(minWidth, newWidth);

    // Override flex with fixed width
    resizingColumn.style.flex = 'none';
    resizingColumn.style.width = clampedWidth + 'px';
}

function stopColumnResize() {
    resizingColumn = null;
    document.removeEventListener('mousemove', doColumnResize);
    document.removeEventListener('mouseup', stopColumnResize);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

// ===== SETTINGS MODAL =====

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');

    // Load current settings into checkboxes
    document.getElementById('show-raci').checked = displaySettings.showRaci;
    document.getElementById('show-gate-owner').checked = displaySettings.showGateOwner;
    document.getElementById('show-dependencies').checked = displaySettings.showDependencies;
    document.getElementById('show-stage-notes').checked = displaySettings.showStageNotes;
    document.getElementById('show-checklist').checked = displaySettings.showChecklist;
    document.getElementById('show-deliverable').checked = displaySettings.showDeliverable;
    document.getElementById('show-friction').checked = displaySettings.showFriction;
    document.getElementById('show-general-notes').checked = displaySettings.showGeneralNotes;
    document.getElementById('show-swimlane').checked = displaySettings.showSwimlane;

    // Populate lane checkboxes
    populateLaneCheckboxes();

    modal.classList.add('visible');
}

function populateLaneCheckboxes() {
    const container = document.getElementById('lane-checkboxes');
    if (!ganttData || !ganttData.swimlanes) {
        container.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">No lanes available</div>';
        return;
    }

    container.innerHTML = '';
    ganttData.swimlanes.forEach(swimlane => {
        const label = document.createElement('label');
        label.className = 'checkbox-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `lane-${swimlane.id}`;
        checkbox.checked = visibleLanes[swimlane.id] !== false;
        checkbox.onchange = () => updateLaneVisibility(swimlane.id, checkbox.checked);

        const span = document.createElement('span');
        span.textContent = swimlane.name;
        span.style.color = swimlane.color || 'var(--text-primary)';

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

function updateLaneVisibility(laneId, isVisible) {
    visibleLanes[laneId] = isVisible;

    // Save to localStorage
    localStorage.setItem('viewerVisibleLanes', JSON.stringify(visibleLanes));

    // Re-render current stage to apply changes
    if (ganttData) {
        renderStage(currentStageIndex);
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('visible');
}

function updateDisplaySettings() {
    // Update settings from checkboxes
    displaySettings.showRaci = document.getElementById('show-raci').checked;
    displaySettings.showGateOwner = document.getElementById('show-gate-owner').checked;
    displaySettings.showDependencies = document.getElementById('show-dependencies').checked;
    displaySettings.showStageNotes = document.getElementById('show-stage-notes').checked;
    displaySettings.showChecklist = document.getElementById('show-checklist').checked;
    displaySettings.showDeliverable = document.getElementById('show-deliverable').checked;
    displaySettings.showFriction = document.getElementById('show-friction').checked;
    displaySettings.showGeneralNotes = document.getElementById('show-general-notes').checked;
    displaySettings.showSwimlane = document.getElementById('show-swimlane').checked;

    // Save to localStorage
    localStorage.setItem('viewerDisplaySettings', JSON.stringify(displaySettings));

    // Re-render current stage to apply changes
    if (ganttData) {
        renderStage(currentStageIndex);
    }
}

function loadDisplaySettings() {
    const saved = localStorage.getItem('viewerDisplaySettings');
    if (saved) {
        try {
            displaySettings = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading display settings:', e);
        }
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('settings-modal');
    if (e.target === modal) {
        closeSettingsModal();
    }
});

// ===== END SETTINGS MODAL =====

// Initialize
loadTheme();
loadFontSize();
loadDisplaySettings();
