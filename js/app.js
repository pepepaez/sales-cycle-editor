
let currentSwimlane = null, currentSection = null, currentActivity = null, editMode = false;
let editSectionMode = false, currentEditSection = null;
let editingStageId = null, selectedStageColor = null;
let dragState = null, draggedSection = null, draggedActivity = null, draggedSwimlane = null;
let isDarkMode = true;
let hasUnsavedChanges = false;
let lastSavedState = null;
let lastImportedData = null;
let currentTextSize = 14;
let isAutoSaving = false; // Flag to bypass change detection during auto-saves
const tooltip = document.getElementById('tooltip');

function markAsChanged() {
    hasUnsavedChanges = true;
    updateUnsavedIndicator();
}

function markAsSaved() {
    hasUnsavedChanges = false;
    lastSavedState = JSON.stringify(ganttData);
    updateUnsavedIndicator();
}

function updateUnsavedIndicator() {
    const indicator = document.getElementById('unsaved-indicator');
    const saveBtn = document.querySelector('.btn.primary[onclick="saveToLocalStorage()"]');
    if (hasUnsavedChanges) {
        indicator.style.display = 'inline';
        indicator.title = 'You have unsaved changes';
        if (saveBtn) {
            saveBtn.style.background = '#ff6b6b';
            saveBtn.textContent = 'Save*';
        }
    } else {
        indicator.style.display = 'none';
        if (saveBtn) {
            saveBtn.style.background = '';
            saveBtn.textContent = 'Save';
        }
    }
}

function getStageEnds() {
    const count = ganttData.stages.length;
    return ganttData.stages.map((_, i) => ((i + 1) / count) * 100);
}

function getStageWidth() {
    return 100 / ganttData.stages.length;
}

// Convert stage-based position to percentage (for display)
function stageToPercent(stagePos, totalStages = ganttData.stages.length) {
    return (stagePos / totalStages) * 100;
}

// Convert percentage to stage-based position (for storage)
function percentToStage(percent, totalStages = ganttData.stages.length) {
    return (percent / 100) * totalStages;
}

// Migrate old percentage-based activities to stage-based positioning
function migrateActivityPositioning() {
    const stageCount = ganttData.stages.length;
    
    ganttData.swimlanes.forEach(sl => {
        sl.sections.forEach(sec => {
            sec.activities.forEach(act => {
                // Only migrate if using old percentage system (0-100 range)
                if (act.start <= 100 && act.end <= 100 && !act._stageBasedPos) {
                    // Convert from percentage to stage-based positioning
                    act.startStage = percentToStage(act.start, stageCount);
                    act.endStage = percentToStage(act.end, stageCount);
                    act._stageBasedPos = true; // Mark as migrated
                }
                
                // Ensure we have stage-based positions
                if (act.startStage === undefined) {
                    act.startStage = percentToStage(act.start || 0, stageCount);
                }
                if (act.endStage === undefined) {
                    act.endStage = percentToStage(act.end || stageCount, stageCount);
                }
                
                // Update display percentages based on current stage count
                act.start = stageToPercent(act.startStage);
                act.end = stageToPercent(act.endStage);
            });
        });
    });
}

function snapToStageEnd(pos) {
    const ends = getStageEnds();
    let closest = ends[0], minDist = Math.abs(pos - closest);
    for (const end of ends) {
        const dist = Math.abs(pos - end);
        if (dist < minDist) { minDist = dist; closest = end; }
    }
    return closest;
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle('light', !isDarkMode);
    document.getElementById('theme-icon').textContent = isDarkMode ? '🌙' : '☀️';
    document.getElementById('theme-label').textContent = isDarkMode ? 'Dark' : 'Light';
    localStorage.setItem('pricefx-gantt-theme', isDarkMode ? 'dark' : 'light');
}

function loadTheme() {
    const saved = localStorage.getItem('pricefx-gantt-theme');
    if (saved === 'light') {
        isDarkMode = false;
        document.documentElement.classList.add('light');
        document.getElementById('theme-icon').textContent = '☀️';
        document.getElementById('theme-label').textContent = 'Light';
    }
}

function changeTextSize() {
    const selector = document.getElementById('text-size-selector');
    currentTextSize = parseInt(selector.value);
    localStorage.setItem('pricefx-gantt-text-size', currentTextSize);
    applyTextSize();
}

function applyTextSize() {
    document.documentElement.style.setProperty('--chart-text-size', currentTextSize + 'px');
}

function loadTextSize() {
    const saved = localStorage.getItem('pricefx-gantt-text-size');
    if (saved) {
        currentTextSize = parseInt(saved);
        document.getElementById('text-size-selector').value = currentTextSize;
    }
    applyTextSize();
}

function findActivityById(id) {
    for (const sl of ganttData.swimlanes) {
        // Check swimlane-level activities first
        if (sl.activities) {
            const act = sl.activities.find(a => a.id === id);
            if (act) return { activity: act, section: null, swimlane: sl };
        }
        // Check section activities
        if (sl.sections) {
            for (const sec of sl.sections) {
                const act = sec.activities.find(a => a.id === id);
                if (act) return { activity: act, section: sec, swimlane: sl };
            }
        }
    }
    return null;
}

function getSuccessors(activityId) {
    const successors = [];
    ganttData.swimlanes.forEach(sl => {
        // Check swimlane-level activities
        if (sl.activities) {
            sl.activities.forEach(act => {
                const hasPredecessor = act.predecessor === activityId ||
                    (Array.isArray(act.predecessors) && act.predecessors.includes(activityId));
                if (hasPredecessor) successors.push({ activity: act, section: null, swimlane: sl });
            });
        }
        // Check section activities
        if (sl.sections) {
            sl.sections.forEach(sec => {
                sec.activities.forEach(act => {
                    const hasPredecessor = act.predecessor === activityId ||
                        (Array.isArray(act.predecessors) && act.predecessors.includes(activityId));
                    if (hasPredecessor) successors.push({ activity: act, section: sec, swimlane: sl });
                });
            });
        }
    });
    return successors;
}

function getPredecessors(activityId) {
    const result = findActivityById(activityId);
    if (!result) return [];
    const act = result.activity;
    if (Array.isArray(act.predecessors) && act.predecessors.length > 0) {
        return act.predecessors;
    } else if (act.predecessor) {
        return [act.predecessor];
    }
    return [];
}

function hasFriction(act) { return act.friction && act.friction.trim().length > 0; }
function hasNotes(act) { return act.notes && act.notes.trim().length > 0; }

function updateGridTemplates() {
    const stageCount = ganttData.stages.length;
    const stageCols = `repeat(${stageCount}, 1fr)`;
    document.querySelectorAll('.stage-headers').forEach(el => {
        el.style.gridTemplateColumns = `${ACTIVITY_COL_WIDTH}px ${stageCols}`;
    });
    document.querySelectorAll('.swimlane-header, .section-header, .activity-row').forEach(el => {
        el.style.gridTemplateColumns = `${ACTIVITY_COL_WIDTH}px 1fr`;
    });
    document.querySelectorAll('.stage-dividers, .section-chart').forEach(el => {
        el.style.gridTemplateColumns = stageCols;
    });
}

function render() {
    migrateActivityPositioning(); // Ensure positions are up to date
    renderLegend();
    renderStageHeaders();
    renderSwimlanes();
    updateGridTemplates();
    attachDragListeners();
    attachTooltipListeners();
    attachReorderListeners();
    attachColumnResizeListeners();
}

// Track currently active filters
let activeActorFilter = null;
let activeActivityTypeFilter = null;

function renderLegend() {
    const container = document.getElementById('legend');
    let html = '';

    // Add activity types with header and click toggle functionality
    if (ganttData.activityTypes && ganttData.activityTypes.length > 0) {
        html += `<div class="legend-header">Activity Types:</div>`;
        ganttData.activityTypes.forEach(type => {
            const isActive = activeActivityTypeFilter === type.id ? ' active' : '';
            html += `<div class="legend-item${isActive}" data-type-id="${type.id}" onclick="toggleActivityTypeHighlight('${type.id}')"><div class="legend-bar" style="background:${type.color}"></div>${type.name}</div>`;
        });

        // Add separator between activity types and actors
        if (ganttData.actors && ganttData.actors.length > 0) {
            html += `<div class="legend-separator"></div>`;
        }
    }

    // Add actors with header and click toggle functionality
    if (ganttData.actors && ganttData.actors.length > 0) {
        html += `<div class="legend-header">Actors:</div>`;
        ganttData.actors.forEach(actor => {
            const isActive = activeActorFilter === actor.id ? ' active' : '';
            html += `<div class="legend-item${isActive}" data-actor-id="${actor.id}" onclick="toggleActorHighlight('${actor.id}')"><div class="legend-bar" style="background:${actor.color}"></div>${actor.name}</div>`;
        });
    }

    container.innerHTML = html;
}

function toggleActivityTypeHighlight(typeId) {
    // If clicking the same type, deactivate
    if (activeActivityTypeFilter === typeId) {
        activeActivityTypeFilter = null;
        clearActivityTypeHighlight();
        renderLegend(); // Re-render to remove active class
        return;
    }

    // Otherwise, activate this type and deactivate actor filter
    activeActivityTypeFilter = typeId;
    activeActorFilter = null; // Deactivate actor filter
    clearActivityTypeHighlight();
    highlightActivityTypeActivities(typeId);
    renderLegend(); // Re-render to update active class
}

function highlightActivityTypeActivities(typeId) {
    ganttData.swimlanes.forEach(sl => {
        // Check swimlane-level activities
        if (sl.activities) {
            sl.activities.forEach(act => {
                if (act.activityType === typeId) {
                    const actType = ganttData.activityTypes.find(t => t.id === typeId);
                    if (actType) {
                        highlightActivity(act.id, actType.color);
                    }
                }
            });
        }
        // Check section activities
        if (sl.sections) {
            sl.sections.forEach(sec => {
                if (sec.activities) {
                    sec.activities.forEach(act => {
                        if (act.activityType === typeId) {
                            const actType = ganttData.activityTypes.find(t => t.id === typeId);
                            if (actType) {
                                highlightActivity(act.id, actType.color);
                            }
                        }
                    });
                }
            });
        }
    });
}

function clearActivityTypeHighlight() {
    document.querySelectorAll('.activity-row').forEach(row => {
        const bar = row.querySelector('.bar');
        if (bar) {
            bar.style.outline = '';
            bar.style.outlineOffset = '';
        }
        // Remove vertical bar indicator from activity label
        const indicator = row.querySelector('.actor-filter-indicator');
        if (indicator) indicator.remove();
    });
}

function toggleActorHighlight(actorId) {
    // If clicking the same actor, deactivate
    if (activeActorFilter === actorId) {
        activeActorFilter = null;
        clearActorHighlight();
        renderLegend(); // Re-render to remove active class
        return;
    }

    // Otherwise, activate this actor and deactivate activity type filter
    activeActorFilter = actorId;
    activeActivityTypeFilter = null; // Deactivate activity type filter
    clearActorHighlight();
    highlightActorActivities(actorId);
    renderLegend(); // Re-render to update active class
}

function highlightActorActivities(actorId) {
    const actor = ganttData.actors.find(a => a.id === actorId);
    if (!actor) return;

    // Find all activities where this actor has any RACI role
    ganttData.swimlanes.forEach(sl => {
        // Check swimlane-level activities
        if (sl.activities) {
            sl.activities.forEach(act => {
                if (isActorInActivity(act, actorId)) {
                    highlightActivity(act.id, actor.color);
                }
            });
        }
        // Check section activities
        if (sl.sections) {
            sl.sections.forEach(sec => {
                if (sec.activities) {
                    sec.activities.forEach(act => {
                        if (isActorInActivity(act, actorId)) {
                            highlightActivity(act.id, actor.color);
                        }
                    });
                }
            });
        }
    });
}

function isActorInActivity(activity, actorId) {
    // Check if actor is in any RACI role or is gate owner
    if (activity.isGate) {
        return activity.gateOwner === actorId;
    }
    return activity.accountable === actorId ||
           (activity.responsible && activity.responsible.includes(actorId)) ||
           (activity.consulted && activity.consulted.includes(actorId)) ||
           (activity.informed && activity.informed.includes(actorId));
}

function highlightActivity(activityId, color) {
    const activityRow = document.querySelector(`.activity-row[data-activity-id="${activityId}"]`);
    if (activityRow) {
        const bar = activityRow.querySelector('.bar');
        if (bar) {
            bar.style.outline = `3px solid ${color}`;
            bar.style.outlineOffset = '2px';
        }

        // Add vertical bar indicator to activity label
        const activityLabel = activityRow.querySelector('.activity-label');
        if (activityLabel) {
            // Create or update the indicator
            let indicator = activityLabel.querySelector('.actor-filter-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'actor-filter-indicator';
                activityLabel.insertBefore(indicator, activityLabel.firstChild);
            }
            indicator.style.background = color;
        }
    }
}

function clearActorHighlight() {
    // Remove outline from all activity bars
    document.querySelectorAll('.bar').forEach(bar => {
        bar.style.outline = '';
        bar.style.outlineOffset = '';
    });

    // Remove indicators from activity names
    document.querySelectorAll('.actor-filter-indicator').forEach(indicator => {
        indicator.remove();
    });
}

function renderStageHeaders() {
    const container = document.getElementById('stage-headers');
    let html = '<div class="header-spacer" style="position:relative;">ACTIVITIES<div class="column-resize-handle" title="Drag to resize activity column"></div></div>';
    ganttData.stages.forEach((stage, i) => {
        const stageNum = stage.num !== undefined ? stage.num : (i + 1);
        html += `<div class="stage-header" data-stage-id="${stage.id}">
            <div class="stage-color-bar" style="background:${stage.color}"></div>
            <div class="stage-header-content">
                <div class="stage-num">STAGE ${stageNum}</div>
                <div class="stage-name">${stage.name}</div>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function renderSwimlanes() {
    const container = document.getElementById('gantt-content');
    container.innerHTML = '';
    const stageCount = ganttData.stages.length;
    const stageCols = `repeat(${stageCount}, 1fr)`;

    ganttData.swimlanes.forEach(sl => {
        const el = document.createElement('div');
        el.className = 'swimlane';
        el.dataset.swimlaneId = sl.id;

        // Render swimlane-level activities (no section)
        let swimlaneActivitiesHtml = '';
        if (!sl.collapsed && sl.activities && sl.activities.length > 0) {
            swimlaneActivitiesHtml = sl.activities.map(act => renderActivityRow(sl, null, act, stageCols)).join('');
        }

        // Render sections and their activities
        let sectionsHtml = sl.collapsed ? '' : (sl.sections || []).map(sec => renderSection(sl, sec, stageCols)).join('');

        let dividers = '';
        for (let i = 0; i < stageCount; i++) dividers += '<div class="stage-divider"></div>';

        const swimlaneActivityCount = sl.activities ? sl.activities.length : 0;
        const sectionActivityCount = (sl.sections || []).reduce((sum, sec) => sum + sec.activities.length, 0);
        const totalActivities = swimlaneActivityCount + sectionActivityCount;
        const slColor = sl.color || '#58a6ff';

        el.innerHTML = `
            <div class="swimlane-header" style="grid-template-columns: ${ACTIVITY_COL_WIDTH}px 1fr;" data-swimlane-id="${sl.id}">
                <div class="swimlane-label" style="color: ${slColor};position:relative;">
                    <span class="swimlane-drag-handle" draggable="true" data-swimlane-id="${sl.id}" style="cursor:move;margin-right:6px;opacity:0.5;" title="Drag to reorder">⋮⋮</span>
                    <div class="swimlane-label-content">
                        <div class="swimlane-label-text" onclick="toggleSwimlaneCollapse('${sl.id}')" style="cursor:pointer;">
                            <span class="swimlane-collapse ${sl.collapsed ? 'collapsed' : ''}">▸</span>
                            <div class="swimlane-dot" style="background: ${slColor};"></div>
                            <span>${sl.name}</span>
                            <span class="swimlane-count">${totalActivities}</span>
                        </div>
                        <div class="swimlane-actions">
                            <button class="add-btn" onclick="openSectionModal('${sl.id}')" ${sl.collapsed ? 'disabled style="opacity:0.4;"' : ''}>+ Section</button>
                            <button class="add-btn" onclick="openAddActivityModal('${sl.id}')" ${sl.collapsed ? 'disabled style="opacity:0.4;"' : ''}>+ Activity</button>
                            <button class="add-btn" onclick="openEditSwimlaneModal('${sl.id}')" title="Edit">✎</button>
                            <button class="add-btn" onclick="deleteSwimlane('${sl.id}')" title="Delete" ${ganttData.swimlanes.length <= 1 ? 'disabled style="opacity:0.4;"' : ''}>✕</button>
                        </div>
                    </div>
                    <div class="column-resize-handle" title="Drag to resize activity column"></div>
                </div>
                <div class="stage-dividers" style="grid-template-columns: ${stageCols};">${dividers}</div>
            </div>
            <div class="swimlane-content ${sl.collapsed ? 'collapsed' : ''}">
                ${swimlaneActivitiesHtml}
                ${sectionsHtml}
            </div>
        `;
        container.appendChild(el);
    });

    // Add "Add Swimlane" button at the end
    const addBtn = document.createElement('div');
    addBtn.className = 'add-swimlane-row';
    addBtn.innerHTML = `<button class="btn" onclick="openAddSwimlaneModal()">+ Add Swimlane</button>`;
    container.appendChild(addBtn);
}

function renderSection(sl, sec, stageCols) {
    const stageCount = ganttData.stages.length;
    let chartBgs = '';
    for (let i = 0; i < stageCount; i++) chartBgs += '<div class="section-chart-bg"></div>';
    
    const actCount = sec.activities.length;
    let activitiesHtml = actCount === 0 
        ? `<div class="empty-lane" data-section-id="${sec.id}" data-swimlane-id="${sl.id}">Drop activities here or click "+ Activity" on this section</div>` 
        : sec.activities.map(act => renderActivityRow(sl, sec, act, stageCols)).join('');
    
    return `
        <div class="section-group" data-section-id="${sec.id}" data-swimlane-id="${sl.id}">
            <div class="section-header" data-section-id="${sec.id}" data-swimlane-id="${sl.id}" style="grid-template-columns: ${ACTIVITY_COL_WIDTH}px 1fr;">
                <div class="section-label" onclick="toggleSectionCollapse('${sl.id}', '${sec.id}')">
                    <span class="section-drag-handle" draggable="true" data-section-id="${sec.id}" data-swimlane-id="${sl.id}">☰</span>
                    <span class="section-collapse ${sec.collapsed ? 'collapsed' : ''}">▸</span>
                    <span class="section-name">${sec.name}</span>
                    <span class="section-count">${actCount}</span>
                    <div class="section-actions">
                        <button class="section-action-btn" onclick="event.stopPropagation();openAddActivityToSectionModal('${sl.id}','${sec.id}')" title="Add Activity">+</button>
                        <button class="section-action-btn" onclick="event.stopPropagation();openEditSectionModal('${sl.id}','${sec.id}')" title="Edit">✎</button>
                        <button class="section-action-btn delete" onclick="event.stopPropagation();deleteSection('${sl.id}','${sec.id}')" title="Delete">✕</button>
                    </div>
                </div>
                <div class="section-chart" style="grid-template-columns: ${stageCols};">${chartBgs}</div>
            </div>
            <div class="activity-rows ${sec.collapsed ? 'collapsed' : ''}" data-section-id="${sec.id}" data-swimlane-id="${sl.id}" style="max-height: ${sec.collapsed ? 0 : Math.max(actCount * 60 + 100, 60)}px;">
                ${activitiesHtml}
            </div>
        </div>
    `;
}

function renderActivityRow(sl, sec, act, stageCols) {
    const stageCount = ganttData.stages.length;

    let stageBgs = '';
    const stageWidth = 100 / stageCount;
    for (let i = 0; i < stageCount; i++) {
        stageBgs += `<div class="stage-bg" style="left:${i * stageWidth}%;width:${stageWidth}%;${i === stageCount - 1 ? 'border-right:none;' : ''}"></div>`;
    }

    // Use activity type color for activity bars, default to white if no type
    let barColor = '#FFFFFF'; // Default white
    if (act.activityType && ganttData.activityTypes) {
        const actType = ganttData.activityTypes.find(t => t.id === act.activityType);
        if (actType) {
            barColor = actType.color;
        }
    }
    const barBg = hexToRgba(barColor, 0.4);
    const barBorder = hexToRgba(barColor, 0.8);

    const secId = sec ? sec.id : null;

    let barHtml;
    if (act.isGate) {
        // Gate bars use gate owner's color and initials
        let gateColor = '#FFFFFF'; // Default white
        let gateLabel = 'G';
        if (act.gateOwner && ganttData.actors) {
            const owner = ganttData.actors.find(a => a.id === act.gateOwner);
            if (owner) {
                gateColor = owner.color;
                // Get initials (max 2 letters)
                const words = owner.name.trim().split(/\s+/);
                if (words.length === 1) {
                    gateLabel = words[0].substring(0, 2).toUpperCase();
                } else {
                    gateLabel = words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
                }
            }
        }
        barHtml = `<div class="bar exit-gate" style="left:calc(${act.start}% - 11px);background:${gateColor};border:2px solid rgba(255,255,255,0.6);box-shadow:0 1px 2px rgba(0,0,0,0.2);" data-swimlane="${sl.id}" data-section="${secId}" data-activity="${act.id}"><span class="gate-label" style="color:white;">${gateLabel}</span></div>`;
    } else {
        const width = act.end - act.start;

        // Build RACI indicator boxes on the bar
        let raciBoxes = '';

        // Helper function to get actor initials
        const getInitials = (name) => {
            const words = name.trim().split(/\s+/);
            if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
            return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
        };

        // Accountable - show first with distinct styling
        if (act.accountable && ganttData.actors) {
            const accActor = ganttData.actors.find(a => a.id === act.accountable);
            if (accActor) {
                const initials = getInitials(accActor.name);
                const textColor = getContrastingTextColor(accActor.color);
                raciBoxes += `<div class="raci-box accountable" style="background:${accActor.color};color:${textColor};" title="Accountable: ${accActor.name}">${initials}</div>`;
            }
        }

        // Responsible - show as small squares
        if (act.responsible && act.responsible.length > 0 && ganttData.actors) {
            act.responsible.forEach(rId => {
                const rActor = ganttData.actors.find(a => a.id === rId);
                if (rActor) {
                    const initials = getInitials(rActor.name);
                    const textColor = getContrastingTextColor(rActor.color);
                    raciBoxes += `<div class="raci-box responsible" style="background:${rActor.color};color:${textColor};" title="Responsible: ${rActor.name}">${initials}</div>`;
                }
            });
        }

        // Other indicators (deliverable, dependencies, friction, notes)
        let indicators = '';
        if (act.isDeliverable) indicators += '<div class="bar-indicator deliverable">D</div>';
        const actPreds = (Array.isArray(act.predecessors) && act.predecessors.length > 0) || act.predecessor;
        if (actPreds || getSuccessors(act.id).length > 0) indicators += '<div class="bar-indicator dependency">⇋</div>';
        if (hasFriction(act)) indicators += '<div class="bar-indicator friction">⚠</div>';
        if (hasNotes(act)) indicators += '<div class="bar-indicator notes">📝</div>';

        barHtml = `<div class="bar" style="left:${act.start}%;width:${width}%;background:${barBg};border:1.5px solid ${barBorder};" data-swimlane="${sl.id}" data-section="${secId}" data-activity="${act.id}">
            <div class="resize-handle left" data-handle="left"></div>
            <div class="resize-handle right" data-handle="right"></div>
            ${raciBoxes ? `<div class="raci-boxes">${raciBoxes}</div>` : ''}
            ${indicators ? `<div class="bar-indicators">${indicators}</div>` : ''}
        </div>`;
    }

    // No badges needed since we show RACI on the bars
    let raciBadges = '';

    return `
        <div class="activity-row" draggable="true" data-activity-id="${act.id}" data-section-id="${secId}" data-swimlane-id="${sl.id}" style="grid-template-columns: ${ACTIVITY_COL_WIDTH}px 1fr;">
            <div class="activity-label">
                <span class="activity-drag-handle">⋮⋮</span>
                <div class="activity-name" onclick="openSlidePanel('${sl.id}',${secId === null ? 'null' : `'${secId}'`},'${act.id}')">${act.name}</div>
                <div class="activity-badges">
                    <div class="badge deliverable ${act.isDeliverable ? '' : 'inactive'}" onclick="toggleDeliverableProp('${sl.id}',${secId === null ? 'null' : `'${secId}'`},'${act.id}')" title="Deliverable">D</div>
                    <div class="badge gate ${act.isGate ? '' : 'inactive'}" onclick="toggleGateProp('${sl.id}',${secId === null ? 'null' : `'${secId}'`},'${act.id}')" title="Exit Gate">G</div>
                    <div class="badge friction ${hasFriction(act) ? '' : 'inactive'}" title="Friction Point">⚠</div>
                    <div class="badge notes ${hasNotes(act) ? '' : 'inactive'}" title="Notes">📝</div>
                    ${raciBadges}
                </div>
                <div class="activity-actions">
                    <button class="action-btn" onclick="openSlidePanel('${sl.id}',${secId === null ? 'null' : `'${secId}'`},'${act.id}')" title="Edit">✎</button>
                    <button class="action-btn delete" onclick="deleteActivity('${sl.id}',${secId === null ? 'null' : `'${secId}'`},'${act.id}')" title="Delete">✕</button>
                </div>
            </div>
            <div class="activity-chart" data-activity-id="${act.id}">${stageBgs}${barHtml}</div>
        </div>
    `;
}

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Calculate relative luminance and return appropriate text color (white or black)
function getContrastingTextColor(hexColor) {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16) / 255;
    const g = parseInt(hexColor.slice(3, 5), 16) / 255;
    const b = parseInt(hexColor.slice(5, 7), 16) / 255;

    // Apply gamma correction
    const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // Calculate relative luminance (ITU-R BT.709)
    const luminance = 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;

    // Return black for light backgrounds, white for dark backgrounds
    // Threshold of 0.5 works well for most cases
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function toggleSectionCollapse(slId, secId) {
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return;
    const sec = sl.sections.find(s => s.id === secId);
    if (!sec) return;
    sec.collapsed = !sec.collapsed;
    markAsChanged();
    render();
}

function attachReorderListeners() {
    // Swimlane drag and drop
    document.querySelectorAll('.swimlane-drag-handle[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', e => {
            e.stopPropagation();
            draggedSwimlane = el.dataset.swimlaneId;
            el.closest('.swimlane').classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', e => {
            el.closest('.swimlane').classList.remove('dragging');
            document.querySelectorAll('.swimlane').forEach(x => x.classList.remove('drag-over'));
            draggedSwimlane = null;
        });
    });

    document.querySelectorAll('.swimlane').forEach(el => {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedSwimlane || el.dataset.swimlaneId === draggedSwimlane) return;
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', e => {
            e.classList.remove('drag-over');
        });
        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedSwimlane) return;
            const targetId = el.dataset.swimlaneId;
            if (targetId === draggedSwimlane) return;

            const fromIndex = ganttData.swimlanes.findIndex(s => s.id === draggedSwimlane);
            const toIndex = ganttData.swimlanes.findIndex(s => s.id === targetId);

            if (fromIndex === -1 || toIndex === -1) return;

            // Move swimlane
            const [movedSwimlane] = ganttData.swimlanes.splice(fromIndex, 1);
            ganttData.swimlanes.splice(toIndex, 0, movedSwimlane);

            markAsChanged();
            render();
        });
    });

    document.querySelectorAll('.section-drag-handle[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', e => {
            e.stopPropagation();
            draggedSection = { swimlaneId: el.dataset.swimlaneId, sectionId: el.dataset.sectionId };
            el.closest('.section-header').classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', e => {
            el.closest('.section-header').classList.remove('dragging');
            document.querySelectorAll('.section-header').forEach(x => x.classList.remove('drag-over'));
            draggedSection = null;
        });
    });
    document.querySelectorAll('.section-header').forEach(el => {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedSection || el.dataset.sectionId === draggedSection.sectionId) return;
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', e => el.classList.remove('drag-over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedSection) return;
            const tsl = el.dataset.swimlaneId, tsec = el.dataset.sectionId;
            if (tsec === draggedSection.sectionId) return;

            // Find source swimlane and remove section
            const sourceSwimlane = ganttData.swimlanes.find(s => s.id === draggedSection.swimlaneId);
            if (!sourceSwimlane) return;
            const fi = sourceSwimlane.sections.findIndex(s => s.id === draggedSection.sectionId);
            if (fi === -1) return;
            const [movedSection] = sourceSwimlane.sections.splice(fi, 1);

            // Find target swimlane and insert section
            const targetSwimlane = ganttData.swimlanes.find(s => s.id === tsl);
            if (!targetSwimlane) return;
            const ti = targetSwimlane.sections.findIndex(s => s.id === tsec);
            if (ti === -1) {
                targetSwimlane.sections.push(movedSection);
            } else {
                targetSwimlane.sections.splice(ti, 0, movedSection);
            }

            markAsChanged();
            render();
        });
    });
    
    // Activity drag and drop
    document.querySelectorAll('.activity-row[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', e => {
            draggedActivity = { swimlaneId: el.dataset.swimlaneId, sectionId: el.dataset.sectionId, activityId: el.dataset.activityId };
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', e => {
            el.classList.remove('dragging');
            document.querySelectorAll('.activity-row').forEach(x => x.classList.remove('drag-over'));
            document.querySelectorAll('.empty-lane').forEach(x => x.classList.remove('drag-over'));
            draggedActivity = null;
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedActivity || el.dataset.activityId === draggedActivity.activityId) return;
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', e => el.classList.remove('drag-over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            if (!draggedActivity) return;
            const tsl = el.dataset.swimlaneId, tsec = el.dataset.sectionId, tact = el.dataset.activityId;
            if (tact === draggedActivity.activityId) return;

            // Find and remove the activity from its current location (source swimlane)
            let moved = null;
            const sourceSwimlane = ganttData.swimlanes.find(s => s.id === draggedActivity.swimlaneId);
            if (!sourceSwimlane) return;

            // Check swimlane-level activities first
            if (sourceSwimlane.activities) {
                const idx = sourceSwimlane.activities.findIndex(a => a.id === draggedActivity.activityId);
                if (idx !== -1) {
                    [moved] = sourceSwimlane.activities.splice(idx, 1);
                }
            }

            // If not found at swimlane level, check sections
            if (!moved && sourceSwimlane.sections) {
                for (const sec of sourceSwimlane.sections) {
                    const idx = sec.activities.findIndex(a => a.id === draggedActivity.activityId);
                    if (idx !== -1) {
                        [moved] = sec.activities.splice(idx, 1);
                        break;
                    }
                }
            }

            if (!moved) return;

            // Add to target location (target swimlane)
            const targetSwimlane = ganttData.swimlanes.find(s => s.id === tsl);
            if (!targetSwimlane) return;

            if (tsec === 'null' || tsec === null) {
                // Drop to swimlane level
                if (!targetSwimlane.activities) targetSwimlane.activities = [];
                const ti = targetSwimlane.activities.findIndex(a => a.id === tact);
                ti === -1 ? targetSwimlane.activities.push(moved) : targetSwimlane.activities.splice(ti, 0, moved);
            } else {
                // Drop to section
                const tsecObj = targetSwimlane.sections.find(s => s.id === tsec);
                if (!tsecObj) return;
                const ti = tsecObj.activities.findIndex(a => a.id === tact);
                ti === -1 ? tsecObj.activities.push(moved) : tsecObj.activities.splice(ti, 0, moved);
            }

            markAsChanged();
            render();
        });
    });
    
    // Empty lane drop targets for empty sections and swimlane-level
    document.querySelectorAll('.empty-lane').forEach(el => {
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedActivity) return;
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', e => el.classList.remove('drag-over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('drag-over');
            if (!draggedActivity) return;
            const tsl = el.dataset.swimlaneId, tsec = el.dataset.sectionId;

            // Find and remove the activity from its current location (source swimlane)
            let moved = null;
            const sourceSwimlane = ganttData.swimlanes.find(s => s.id === draggedActivity.swimlaneId);
            if (!sourceSwimlane) return;

            // Check swimlane-level activities first
            if (sourceSwimlane.activities) {
                const idx = sourceSwimlane.activities.findIndex(a => a.id === draggedActivity.activityId);
                if (idx !== -1) {
                    [moved] = sourceSwimlane.activities.splice(idx, 1);
                }
            }

            // If not found at swimlane level, check sections
            if (!moved && sourceSwimlane.sections) {
                for (const sec of sourceSwimlane.sections) {
                    const idx = sec.activities.findIndex(a => a.id === draggedActivity.activityId);
                    if (idx !== -1) {
                        [moved] = sec.activities.splice(idx, 1);
                        break;
                    }
                }
            }

            if (!moved) return;

            // Add to target location (target swimlane)
            const targetSwimlane = ganttData.swimlanes.find(s => s.id === tsl);
            if (!targetSwimlane) return;

            if (tsec === 'null' || tsec === null || tsec === undefined) {
                // Drop to swimlane level
                if (!targetSwimlane.activities) targetSwimlane.activities = [];
                targetSwimlane.activities.push(moved);
            } else {
                // Drop to section
                const tsecObj = targetSwimlane.sections.find(s => s.id === tsec);
                if (!tsecObj) return;
                tsecObj.activities.push(moved);
            }

            markAsChanged();
            render();
        });
    });
}

function attachColumnResizeListeners() {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    document.querySelectorAll('.column-resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            isResizing = true;
            startX = e.clientX;
            startWidth = ACTIVITY_COL_WIDTH;
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        e.preventDefault();
        const delta = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(800, startWidth + delta)); // Min 200px, Max 800px
        ACTIVITY_COL_WIDTH = newWidth;
        updateGridTemplates();
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.querySelectorAll('.column-resize-handle').forEach(h => h.classList.remove('resizing'));
        }
    });
}

function attachTooltipListeners() {
    document.querySelectorAll('.bar').forEach(bar => {
        bar.addEventListener('mouseenter', showTooltip);
        bar.addEventListener('mouseleave', hideTooltip);
    });
}

function showTooltip(e) {
    const bar = e.currentTarget, actId = bar.dataset.activity, result = findActivityById(actId);
    if (!result) return;
    const { activity: act, section: sec, swimlane: sl } = result;
    const predIds = (Array.isArray(act.predecessors) && act.predecessors.length > 0) ? act.predecessors : (act.predecessor ? [act.predecessor] : []);
    const predInfos = predIds.map(pid => findActivityById(pid)).filter(p => p);
    const succs = getSuccessors(actId);
    const stageIdx = Math.floor(act.start / getStageWidth());
    const stageName = ganttData.stages[Math.min(stageIdx, ganttData.stages.length - 1)]?.name || '';

    // Highlight predecessors and successors
    highlightDependencies(actId, predIds, succs.map(s => s.activity.id));

    let html = `<div class="tooltip-title">${act.name}</div>`;
    html += `<div class="tooltip-row"><span class="tooltip-label">Section:</span><span class="tooltip-value">${sl.name}</span></div>`;
    if (sec) {
        html += `<div class="tooltip-row"><span class="tooltip-label">Subsection:</span><span class="tooltip-value">${sec.name}</span></div>`;
    } else {
        html += `<div class="tooltip-row"><span class="tooltip-label">Subsection:</span><span class="tooltip-value" style="font-style:italic;opacity:0.7;">(No subsection)</span></div>`;
    }

    if (act.isGate) {
        const gateStageIdx = getStageEnds().findIndex(end => Math.abs(end - act.start) < 1);
        const gateStage = ganttData.stages[gateStageIdx >= 0 ? gateStageIdx : ganttData.stages.length - 1];
        html += `<div class="tooltip-row"><span class="tooltip-label">Type:</span><span class="tooltip-value" style="color:var(--gate-color);">Exit Gate (${gateStage?.name || 'End'})</span></div>`;
        if (act.gateOwner && ganttData.actors) {
            const owner = ganttData.actors.find(a => a.id === act.gateOwner);
            if (owner) {
                html += `<div class="tooltip-row"><span class="tooltip-label">Gate Owner:</span><span class="tooltip-value" style="color:${owner.color};font-weight:600;">${owner.name}</span></div>`;
            }
        }
    } else {
        // Show RACI roles for regular activities
        if (act.accountable && ganttData.actors) {
            const accActor = ganttData.actors.find(a => a.id === act.accountable);
            if (accActor) {
                html += `<div class="tooltip-row"><span class="tooltip-label">Accountable:</span><span class="tooltip-value" style="color:${accActor.color};font-weight:600;">${accActor.name}</span></div>`;
            }
        }
        if (act.responsible && act.responsible.length > 0 && ganttData.actors) {
            const respActors = act.responsible.map(id => ganttData.actors.find(a => a.id === id)).filter(a => a);
            if (respActors.length > 0) {
                html += `<div class="tooltip-row"><span class="tooltip-label">Responsible:</span><span class="tooltip-value">${respActors.map(a => `<span style="color:${a.color};font-weight:600;">${a.name}</span>`).join(', ')}</span></div>`;
            }
        }
        if (act.consulted && act.consulted.length > 0 && ganttData.actors) {
            const consActors = act.consulted.map(id => ganttData.actors.find(a => a.id === id)).filter(a => a);
            if (consActors.length > 0) {
                html += `<div class="tooltip-row"><span class="tooltip-label">Consulted:</span><span class="tooltip-value">${consActors.map(a => `<span style="color:${a.color};font-weight:600;">${a.name}</span>`).join(', ')}</span></div>`;
            }
        }
        if (act.informed && act.informed.length > 0 && ganttData.actors) {
            const infActors = act.informed.map(id => ganttData.actors.find(a => a.id === id)).filter(a => a);
            if (infActors.length > 0) {
                html += `<div class="tooltip-row"><span class="tooltip-label">Informed:</span><span class="tooltip-value">${infActors.map(a => `<span style="color:${a.color};font-weight:600;">${a.name}</span>`).join(', ')}</span></div>`;
            }
        }
    }

    if (act.isDeliverable) html += `<div class="tooltip-row"><span class="tooltip-label">Deliverable:</span><span class="tooltip-value" style="color:var(--deliverable-color);">Yes</span></div>`;
    if (predInfos.length) html += `<div class="tooltip-row"><span class="tooltip-label">Predecessor${predInfos.length > 1 ? 's' : ''}:</span><span class="tooltip-value predecessor">← ${predInfos.map(p => p.activity.name).join(', ')}</span></div>`;
    if (succs.length) html += `<div class="tooltip-row"><span class="tooltip-label">Successor${succs.length > 1 ? 's' : ''}:</span><span class="tooltip-value successor">→ ${succs.map(s => s.activity.name).join(', ')}</span></div>`;
    if (act.friction?.trim()) html += `<div class="tooltip-section"><div class="tooltip-section-title">⚠ Friction</div><div class="tooltip-text">${act.friction}</div></div>`;
    if (act.resolution?.trim()) html += `<div class="tooltip-section"><div class="tooltip-section-title">Resolution</div><div class="tooltip-text">${act.resolution}</div></div>`;
    if (act.deliverableDetails?.trim()) html += `<div class="tooltip-section"><div class="tooltip-section-title">📄 Deliverable</div><div class="tooltip-text">${act.deliverableDetails}</div></div>`;
    if (act.notes?.trim()) html += `<div class="tooltip-section"><div class="tooltip-section-title">📝 Notes</div><div class="tooltip-text">${act.notes}</div></div>`;
    tooltip.innerHTML = html;
    tooltip.classList.add('visible');

    // Position tooltip at top right of bar
    positionTooltipAtBar(bar);
}

function positionTooltipAtBar(bar) {
    const barRect = bar.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // Position bottom left of tooltip aligned with bottom right of bar
    let x = barRect.right + 8;
    let y = barRect.bottom - tooltipRect.height;
    
    // Adjust if tooltip goes off right edge
    if (x + tooltipRect.width > window.innerWidth - 16) {
        x = barRect.left - tooltipRect.width - 8;
    }
    
    // Adjust if tooltip goes off top
    if (y < 16) {
        y = 16;
    }
    
    // Adjust if tooltip goes off bottom
    if (y + tooltipRect.height > window.innerHeight - 16) {
        y = window.innerHeight - tooltipRect.height - 16;
    }
    
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function highlightDependencies(currentId, predecessorIds, successorIds) {
    // Clear any existing highlights first
    clearDependencyHighlights();
    
    // Highlight predecessors
    const predArray = Array.isArray(predecessorIds) ? predecessorIds : (predecessorIds ? [predecessorIds] : []);
    predArray.forEach(predecessorId => {
        const predBar = document.querySelector(`.bar[data-activity="${predecessorId}"]`);
        if (predBar) {
            predBar.classList.add('highlight-predecessor');
        }
        const predRow = document.querySelector(`.activity-row[data-activity-id="${predecessorId}"]`);
        if (predRow) {
            predRow.classList.add('highlight-predecessor-row');
        }
    });
    
    // Highlight successors
    successorIds.forEach(succId => {
        const succBar = document.querySelector(`.bar[data-activity="${succId}"]`);
        if (succBar) {
            succBar.classList.add('highlight-successor');
        }
        const succRow = document.querySelector(`.activity-row[data-activity-id="${succId}"]`);
        if (succRow) {
            succRow.classList.add('highlight-successor-row');
        }
    });
}

function clearDependencyHighlights() {
    document.querySelectorAll('.highlight-predecessor, .highlight-successor').forEach(el => {
        el.classList.remove('highlight-predecessor', 'highlight-successor');
    });
    document.querySelectorAll('.highlight-predecessor-row, .highlight-successor-row').forEach(el => {
        el.classList.remove('highlight-predecessor-row', 'highlight-successor-row');
    });
}

function hideTooltip() { 
    tooltip.classList.remove('visible'); 
    clearDependencyHighlights();
}

function attachDragListeners() {
    document.querySelectorAll('.bar').forEach(bar => {
        bar.addEventListener('mousedown', startBarDrag);
        bar.addEventListener('dblclick', openBarEditPanel);
    });
}

function openBarEditPanel(e) {
    e.preventDefault();
    e.stopPropagation();

    // If slide panel is already open, close it first without saving
    if (document.getElementById('slide-panel').classList.contains('open')) {
        closeSlidePanel(false); // Close without saving
    }

    const bar = e.currentTarget;
    const actId = bar.dataset.activity;
    const result = findActivityById(actId);

    if (result) {
        const { swimlane, section, activity } = result;
        const secId = section ? section.id : null;
        openSlidePanel(swimlane.id, secId, actId);
    }
}

function startBarDrag(e) {
    if (e.target.classList.contains('resize-handle')) { startResize(e); return; }
    const bar = e.currentTarget, actId = bar.dataset.activity, chart = bar.parentElement, chartRect = chart.getBoundingClientRect();
    const result = findActivityById(actId);
    if (!result) return;
    dragState = {
        type: result.activity.isGate ? 'gate-move' : 'move',
        bar, activityId: actId, activity: result.activity, chartRect,
        startX: e.clientX, originalStart: result.activity.start, originalEnd: result.activity.end
    };
    bar.classList.add('dragging');
    hideTooltip();
    document.addEventListener('mousemove', onBarDrag);
    document.addEventListener('mouseup', endBarDrag);
    e.preventDefault();
}

function startResize(e) {
    const handle = e.target, bar = handle.parentElement, actId = bar.dataset.activity, chart = bar.parentElement, chartRect = chart.getBoundingClientRect();
    const result = findActivityById(actId);
    if (!result || result.activity.isGate) return;
    dragState = {
        type: 'resize', handle: handle.dataset.handle,
        bar, activityId: actId, activity: result.activity, chartRect,
        startX: e.clientX, originalStart: result.activity.start, originalEnd: result.activity.end
    };
    bar.classList.add('dragging');
    hideTooltip();
    document.addEventListener('mousemove', onBarDrag);
    document.addEventListener('mouseup', endBarDrag);
    e.preventDefault();
}

function onBarDrag(e) {
    if (!dragState) return;
    const deltaX = e.clientX - dragState.startX;
    const deltaPercent = (deltaX / dragState.chartRect.width) * 100;
    
    if (dragState.type === 'gate-move') {
        let newPos = Math.max(0, Math.min(100, dragState.originalStart + deltaPercent));
        const snapped = snapToStageEnd(newPos);
        dragState.activity.start = snapped;
        dragState.activity.end = snapped;
        dragState.bar.style.left = `calc(${snapped}% - 11px)`;
    } else if (dragState.type === 'move') {
        let newStart = dragState.originalStart + deltaPercent;
        let newEnd = dragState.originalEnd + deltaPercent;
        const width = newEnd - newStart;
        if (newStart < 0) { newStart = 0; newEnd = width; }
        if (newEnd > 100) { newEnd = 100; newStart = 100 - width; }
        dragState.activity.start = Math.round(newStart);
        dragState.activity.end = Math.round(newEnd);
        dragState.bar.style.left = `${newStart}%`;
    } else if (dragState.type === 'resize') {
        if (dragState.handle === 'left') {
            let newStart = Math.max(0, Math.min(dragState.originalStart + deltaPercent, dragState.originalEnd - 5));
            dragState.activity.start = Math.round(newStart);
            dragState.bar.style.left = `${newStart}%`;
            dragState.bar.style.width = `${dragState.activity.end - newStart}%`;
        } else {
            let newEnd = Math.max(dragState.originalStart + 5, Math.min(dragState.originalEnd + deltaPercent, 100));
            dragState.activity.end = Math.round(newEnd);
            dragState.bar.style.width = `${newEnd - dragState.activity.start}%`;
        }
    }
}

function endBarDrag() {
    if (dragState?.bar) {
        dragState.bar.classList.remove('dragging');
        
        // Update stage-based positions after drag ends
        if (dragState.activity) {
            dragState.activity.startStage = percentToStage(dragState.activity.start);
            dragState.activity.endStage = percentToStage(dragState.activity.end);
        }
        
        markAsChanged(); // Mark as changed when bar manipulation ends
    }
    dragState = null;
    document.removeEventListener('mousemove', onBarDrag);
    document.removeEventListener('mouseup', endBarDrag);
}

function getActivity(slId, secId, actId) {
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return null;

    // If secId is null, look in swimlane's direct activities
    if (secId === null) {
        return sl.activities?.find(a => a.id === actId);
    }

    // Otherwise look in section's activities
    const sec = sl.sections?.find(s => s.id === secId);
    if (!sec) return null;
    return sec.activities.find(a => a.id === actId);
}

function toggleGateProp(slId, secId, actId) {
    const act = getActivity(slId, secId, actId);
    if (act) {
        act.isGate = !act.isGate;
        if (act.isGate) {
            const snapped = snapToStageEnd(act.end);
            act.start = snapped;
            act.end = snapped;
            act.startStage = percentToStage(snapped);
            act.endStage = percentToStage(snapped);
        }
        markAsChanged();
        render();
    }
}

function toggleDeliverableProp(slId, secId, actId) {
    const act = getActivity(slId, secId, actId);
    if (act) { act.isDeliverable = !act.isDeliverable; markAsChanged(); render(); }
}

function deleteActivity(slId, secId, actId) {
    if (!confirm('Delete this activity?')) return;
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return;

    // Handle swimlane-level activities (no section)
    if (secId === null) {
        // Remove from swimlane's activities array
        if (sl.activities) {
            sl.activities = sl.activities.filter(a => a.id !== actId);
        }
    } else {
        // Remove from section's activities array
        const sec = sl.sections?.find(s => s.id === secId);
        if (!sec) return;
        sec.activities = sec.activities.filter(a => a.id !== actId);
    }

    // Remove this activity as predecessor from all other activities
    ganttData.swimlanes.forEach(s => {
        // Check swimlane-level activities
        if (s.activities) {
            s.activities.forEach(a => {
                if (a.predecessor === actId) a.predecessor = null;
                if (Array.isArray(a.predecessors)) {
                    a.predecessors = a.predecessors.filter(p => p !== actId);
                }
            });
        }
        // Check section activities
        if (s.sections) {
            s.sections.forEach(sc => {
                sc.activities.forEach(a => {
                    if (a.predecessor === actId) a.predecessor = null;
                    if (Array.isArray(a.predecessors)) {
                        a.predecessors = a.predecessors.filter(p => p !== actId);
                    }
                });
            });
        }
    });

    markAsChanged();
    render();
}

function deleteSection(slId, secId) {
    if (!confirm('Delete section and all activities?')) return;
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return;
    const sec = sl.sections.find(s => s.id === secId);
    if (sec) {
        const actIds = sec.activities.map(a => a.id);
        ganttData.swimlanes.forEach(s => s.sections.forEach(sc => sc.activities.forEach(a => { if (actIds.includes(a.predecessor)) a.predecessor = null; })));
    }
    sl.sections = sl.sections.filter(s => s.id !== secId);
    markAsChanged();
    render();
}

function getAllActivities() {
    const all = [];
    ganttData.swimlanes.forEach(sl => {
        // Add swimlane-level activities (no section)
        if (sl.activities) {
            sl.activities.forEach(act => all.push({
                ...act,
                sectionId: null,
                sectionName: '(No Section)',
                swimlaneId: sl.id,
                swimlaneName: sl.name
            }));
        }
        // Add section activities
        if (sl.sections) {
            sl.sections.forEach(sec => {
                sec.activities.forEach(act => all.push({
                    ...act,
                    sectionId: sec.id,
                    sectionName: sec.name,
                    swimlaneId: sl.id,
                    swimlaneName: sl.name
                }));
            });
        }
    });
    return all;
}

let allActivitiesCache = [];
let currentExcludeId = null;
let selectedPredecessors = [];
let selectedSuccessors = [];

function buildActivityCache(excludeId = null) {
    currentExcludeId = excludeId;
    allActivitiesCache = getAllActivities().filter(act => act.id !== excludeId);
}

function filterPredecessorList() {
    const search = document.getElementById('activity-predecessor-search').value.toLowerCase();
    const dropdown = document.getElementById('predecessor-dropdown');
    renderActivityDropdown(dropdown, search, 'predecessor');
}

function filterSuccessorList() {
    const search = document.getElementById('activity-successor-search').value.toLowerCase();
    const dropdown = document.getElementById('successor-dropdown');
    renderActivityDropdown(dropdown, search, 'successor');
}

function renderActivityDropdown(dropdown, search, type) {
    const selectedIds = type === 'predecessor' ? selectedPredecessors : selectedSuccessors;
    const filtered = allActivitiesCache.filter(act => 
        !selectedIds.includes(act.id) &&
        (act.name.toLowerCase().includes(search) || 
        act.swimlaneName.toLowerCase().includes(search) ||
        act.sectionName.toLowerCase().includes(search))
    );
    
    let html = '';
    
    filtered.slice(0, 20).forEach(act => {
        html += `<div class="searchable-dropdown-item" onclick="addSelectedActivity('${act.id}', '${type}')">
            <div class="item-name">${act.name}</div>
            <div class="item-meta">${act.swimlaneName} / ${act.sectionName}</div>
        </div>`;
    });
    
    if (filtered.length > 20) {
        html += `<div class="searchable-dropdown-item none-option">... ${filtered.length - 20} more results</div>`;
    }
    
    if (filtered.length === 0 && search) {
        html += `<div class="searchable-dropdown-item none-option">No matching activities</div>`;
    }
    
    if (filtered.length === 0 && !search) {
        html += `<div class="searchable-dropdown-item none-option">No activities available</div>`;
    }
    
    dropdown.innerHTML = html;
}

function showPredecessorDropdown() {
    const dropdown = document.getElementById('predecessor-dropdown');
    dropdown.classList.add('visible');
    filterPredecessorList();
    
    setTimeout(() => {
        document.addEventListener('click', closePredecessorDropdownOnOutsideClick);
    }, 0);
}

function showSuccessorDropdown() {
    const dropdown = document.getElementById('successor-dropdown');
    dropdown.classList.add('visible');
    filterSuccessorList();
    
    setTimeout(() => {
        document.addEventListener('click', closeSuccessorDropdownOnOutsideClick);
    }, 0);
}

function closePredecessorDropdownOnOutsideClick(e) {
    const container = document.querySelector('#activity-predecessor-search').closest('.searchable-select');
    if (!container.contains(e.target)) {
        document.getElementById('predecessor-dropdown').classList.remove('visible');
        document.removeEventListener('click', closePredecessorDropdownOnOutsideClick);
    }
}

function closeSuccessorDropdownOnOutsideClick(e) {
    const container = document.querySelector('#activity-successor-search').closest('.searchable-select');
    if (!container.contains(e.target)) {
        document.getElementById('successor-dropdown').classList.remove('visible');
        document.removeEventListener('click', closeSuccessorDropdownOnOutsideClick);
    }
}

function addSelectedActivity(actId, type) {
    if (type === 'predecessor') {
        if (!selectedPredecessors.includes(actId)) {
            selectedPredecessors.push(actId);
        }
        document.getElementById('activity-predecessor-search').value = '';
        document.getElementById('predecessor-dropdown').classList.remove('visible');
        renderSelectedPredecessors();
    } else {
        if (!selectedSuccessors.includes(actId)) {
            selectedSuccessors.push(actId);
        }
        document.getElementById('activity-successor-search').value = '';
        document.getElementById('successor-dropdown').classList.remove('visible');
        renderSelectedSuccessors();
    }
}

function renderSelectedPredecessors() {
    const container = document.getElementById('selected-predecessors');
    if (selectedPredecessors.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = selectedPredecessors.map(actId => {
        const act = allActivitiesCache.find(a => a.id === actId);
        if (!act) return '';
        return `<div class="selected-tag">
            <span class="tag-name">${act.name}</span>
            <span class="tag-remove" onclick="removePredecessor('${actId}')">×</span>
        </div>`;
    }).join('');
}

function renderSelectedSuccessors() {
    const container = document.getElementById('selected-successors');
    if (selectedSuccessors.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = selectedSuccessors.map(actId => {
        const act = allActivitiesCache.find(a => a.id === actId);
        if (!act) return '';
        return `<div class="selected-tag">
            <span class="tag-name">${act.name}</span>
            <span class="tag-remove" onclick="removeSuccessor('${actId}')">×</span>
        </div>`;
    }).join('');
}

function removePredecessor(actId) {
    selectedPredecessors = selectedPredecessors.filter(id => id !== actId);
    renderSelectedPredecessors();
}

function removeSuccessor(actId) {
    selectedSuccessors = selectedSuccessors.filter(id => id !== actId);
    renderSelectedSuccessors();
}

function clearPredecessors() {
    selectedPredecessors = [];
    renderSelectedPredecessors();
}

function clearSuccessors() {
    selectedSuccessors = [];
    renderSelectedSuccessors();
}

function toggleGateNote() { document.getElementById('gate-note').style.display = document.getElementById('activity-gate').checked ? 'block' : 'none'; }

// Swimlane management
let editingSwimlaneId = null;
let selectedSwimlaneColor = null;

function toggleSwimlaneCollapse(slId) {
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (sl) {
        sl.collapsed = !sl.collapsed;
        markAsChanged();
        render();
    }
}

function renderSwimlaneColorPicker() {
    const container = document.getElementById('swimlane-color-picker');
    // Use pastel colors for swimlanes
    container.innerHTML = SWIMLANE_COLORS.map(color => `
        <div class="color-option ${selectedSwimlaneColor === color ? 'selected' : ''}"
             style="background:${color};"
             onclick="selectSwimlaneColor('${color}')"></div>
    `).join('');

    // Sync color input
    const colorInput = document.getElementById('swimlane-color-input');
    if (colorInput && selectedSwimlaneColor) {
        colorInput.value = selectedSwimlaneColor;
    }
}

function selectSwimlaneColor(color) {
    selectedSwimlaneColor = color;
    renderSwimlaneColorPicker();
}

function openAddSwimlaneModal() {
    editingSwimlaneId = null;
    document.getElementById('swimlane-modal-title').textContent = 'Add Swimlane';
    document.getElementById('swimlane-name').value = '';
    selectedSwimlaneColor = SWIMLANE_COLORS[0];
    renderSwimlaneColorPicker();
    document.getElementById('swimlane-modal').classList.add('visible');
}

function openEditSwimlaneModal(slId) {
    editingSwimlaneId = slId;
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return;
    document.getElementById('swimlane-modal-title').textContent = 'Edit Swimlane';
    document.getElementById('swimlane-name').value = sl.name;
    selectedSwimlaneColor = sl.color || SWIMLANE_COLORS[0];
    renderSwimlaneColorPicker();
    document.getElementById('swimlane-modal').classList.add('visible');
}

function closeSwimlaneModal() {
    document.getElementById('swimlane-modal').classList.remove('visible');
    editingSwimlaneId = null;
}

function confirmSwimlane() {
    const name = document.getElementById('swimlane-name').value || 'New Swimlane';
    
    if (editingSwimlaneId) {
        const sl = ganttData.swimlanes.find(s => s.id === editingSwimlaneId);
        if (sl) {
            sl.name = name;
            sl.color = selectedSwimlaneColor;
        }
    } else {
        const newId = `sl_${Date.now()}`;
        ganttData.swimlanes.push({
            id: newId,
            name: name,
            color: selectedSwimlaneColor,
            collapsed: false,
            sections: [{ id: `${newId}_sec_1`, name: 'General', collapsed: false, activities: [] }]
        });
    }
    markAsChanged();
    closeSwimlaneModal();
    render();
}

function deleteSwimlane(slId) {
    if (ganttData.swimlanes.length <= 1) return;
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    const actCount = sl ? sl.sections.reduce((sum, sec) => sum + sec.activities.length, 0) : 0;
    const msg = actCount > 0 
        ? `Delete "${sl.name}" and all ${actCount} activities inside?` 
        : `Delete "${sl.name}"?`;
    if (!confirm(msg)) return;
    
    // Clear predecessor references to activities in this swimlane
    const actIds = [];
    sl.sections.forEach(sec => sec.activities.forEach(a => actIds.push(a.id)));
    ganttData.swimlanes.forEach(s => s.sections.forEach(sec => sec.activities.forEach(a => {
        if (actIds.includes(a.predecessor)) a.predecessor = null;
    })));
    
    ganttData.swimlanes = ganttData.swimlanes.filter(s => s.id !== slId);
    markAsChanged();
    render();
}

// Section Modal
function openSectionModal(slId) {
    currentSwimlane = slId; editSectionMode = false; currentEditSection = null;
    document.getElementById('section-modal-title').textContent = 'Add Section';
    document.getElementById('section-name').value = '';
    document.getElementById('section-modal').classList.add('visible');
}

function openEditSectionModal(slId, secId) {
    currentSwimlane = slId; editSectionMode = true; currentEditSection = secId;
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    const sec = sl?.sections.find(s => s.id === secId);
    if (!sec) return;
    document.getElementById('section-modal-title').textContent = 'Edit Section';
    document.getElementById('section-name').value = sec.name;
    document.getElementById('section-modal').classList.add('visible');
}

function closeSectionModal() { document.getElementById('section-modal').classList.remove('visible'); }

function confirmSection() {
    const name = document.getElementById('section-name').value || 'New Section';
    const sl = ganttData.swimlanes.find(s => s.id === currentSwimlane);
    if (!sl) return;
    if (editSectionMode && currentEditSection) {
        const sec = sl.sections.find(s => s.id === currentEditSection);
        if (sec) sec.name = name;
    } else {
        sl.sections.push({ id: `${currentSwimlane}_sec_${Date.now()}`, name, collapsed: false, activities: [] });
    }
    markAsChanged();
    closeSectionModal();
    render();
}

// Activity Modal - now using slide panel
function openAddActivityModal(slId) {
    const sl = ganttData.swimlanes.find(s => s.id === slId);
    if (!sl) return;

    // Create activity directly in swimlane (no section)
    const newActId = `act_temp_${Date.now()}`;

    // Ensure swimlane has activities array
    if (!sl.activities) {
        sl.activities = [];
    }

    // Create new activity with defaults
    const newActivity = {
        id: newActId,
        name: 'New Activity',
        start: 10,
        end: 30,
        isGate: false,
        isDeliverable: false,
        accountable: null,  // Don't set default - let user choose
        responsible: [],
        consulted: [],
        informed: [],
        predecessor: null,
        predecessors: [],
        friction: '',
        resolution: '',
        deliverableDetails: '',
        notes: ''
    };

    // Add directly to swimlane
    sl.activities.push(newActivity);
    render();

    // Open slide panel for editing (pass null for section)
    openSlidePanel(slId, null, newActId);

    // Mark as new
    const slidePanel = document.getElementById('slide-panel');
    slidePanel.dataset.isNew = 'true';
}

function openAddActivityToSectionModal(slId, secId) {
    // Create a new temporary activity
    const newActId = `act_temp_${Date.now()}`;
    const sec = ganttData.swimlanes.find(s => s.id === slId)?.sections.find(s => s.id === secId);
    if (!sec) return;

    // Create new activity with defaults
    const newActivity = {
        id: newActId,
        name: 'New Activity',
        start: 10,
        end: 30,
        isGate: false,
        isDeliverable: false,
        accountable: null,  // Don't set default - let user choose
        responsible: [],
        consulted: [],
        informed: [],
        predecessor: null,
        predecessors: [],
        friction: '',
        resolution: '',
        deliverableDetails: '',
        notes: ''
    };

    // Add to section
    sec.activities.push(newActivity);
    render();

    // Open slide panel for editing
    openSlidePanel(slId, secId, newActId);

    // Override the save button to handle first-time save
    const slidePanel = document.getElementById('slide-panel');
    slidePanel.dataset.isNew = 'true';
}

function openEditActivityModal(slId, secId, actId) {
    currentSwimlane = slId; currentSection = secId; currentActivity = actId; editMode = true;
    const act = getActivity(slId, secId, actId);
    if (!act) return;
    document.getElementById('modal-title').textContent = 'Edit Activity';
    document.getElementById('modal-confirm-btn').textContent = 'Save';
    document.getElementById('activity-name').value = act.name;
    document.getElementById('activity-gate').checked = act.isGate || false;
    document.getElementById('activity-deliverable').checked = act.isDeliverable || false;
    document.getElementById('activity-shared').checked = act.isShared || false;
    document.getElementById('gate-note').style.display = act.isGate ? 'block' : 'none';
    populateSharedWithCheckboxes(slId);
    setSharedWithCheckboxes(act.sharedWith || []);
    document.getElementById('shared-with-section').classList.toggle('hidden', !act.isShared);
    document.getElementById('activity-friction').value = act.friction || '';
    document.getElementById('activity-resolution').value = act.resolution || '';
    document.getElementById('activity-deliverable-details').value = act.deliverableDetails || '';
    document.getElementById('activity-notes').value = act.notes || '';
    
    // Multi-select predecessor/successor
    buildActivityCache(actId);
    
    // Load predecessors (support both old single value and new array)
    if (Array.isArray(act.predecessors)) {
        selectedPredecessors = [...act.predecessors];
    } else if (act.predecessor) {
        selectedPredecessors = [act.predecessor];
    } else {
        selectedPredecessors = [];
    }
    document.getElementById('activity-predecessor-search').value = '';
    renderSelectedPredecessors();
    
    // Find current successors (activities that have this activity as predecessor)
    const successors = getSuccessors(actId);
    selectedSuccessors = successors.map(s => s.activity.id);
    document.getElementById('activity-successor-search').value = '';
    renderSelectedSuccessors();
    
    document.getElementById('activity-modal').classList.add('visible');
}

function closeActivityModal() { document.getElementById('activity-modal').classList.remove('visible'); }

// Slide Panel Functions
let slidePanelActivity = null;
let slidePredecessors = [];
let slideSuccessors = [];
let slideAccountable = null;
let slideResponsible = [];
let slideConsulted = [];
let slideInformed = [];
let slideGateOwner = null;

// Helper functions for RACI actor selection
function populateActorDropdown(selectId, excludeIds = []) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Keep first option (placeholder)
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    if (!ganttData.actors) return;

    ganttData.actors.forEach(actor => {
        if (!excludeIds.includes(actor.id)) {
            const option = document.createElement('option');
            option.value = actor.id;
            option.textContent = actor.name;
            option.style.color = actor.color;
            select.appendChild(option);
        }
    });
}

function renderActorBadge(actorId, role, onRemove) {
    const actor = ganttData.actors?.find(a => a.id === actorId);
    if (!actor) return '';
    return `<div class="selected-tag" style="background:${actor.color};color:white;padding:4px 8px;border-radius:4px;font-size:12px;">
        <span>${actor.name}</span>
        <span class="tag-remove" onclick="${onRemove}" style="margin-left:6px;cursor:pointer;font-weight:bold;">×</span>
    </div>`;
}

function populateActivityTypeDropdown(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;

    // Clear existing options except the first "None" option
    select.innerHTML = '<option value="">None (White bar)</option>';

    // Add activity types
    if (ganttData.activityTypes) {
        ganttData.activityTypes.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type.id;
            opt.textContent = type.name;
            select.appendChild(opt);
        });
    }
}

function onSlideActivityTypeChange() {
    // Just store the value - will be saved when panel is saved
}

function onSlideAccountableChange() {
    const select = document.getElementById('slide-accountable');
    slideAccountable = select.value || null;
}

function onSlideResponsibleChange() {
    const select = document.getElementById('slide-responsible');
    if (select.value && !slideResponsible.includes(select.value)) {
        slideResponsible.push(select.value);
        renderSlideResponsibleList();
        // Repopulate all R/C/I dropdowns to reflect the new selection
        updateRACIDropdowns();
    }
    select.value = '';
}

function onSlideConsultedChange() {
    const select = document.getElementById('slide-consulted');
    if (select.value && !slideConsulted.includes(select.value)) {
        slideConsulted.push(select.value);
        renderSlideConsultedList();
        // Repopulate all R/C/I dropdowns to reflect the new selection
        updateRACIDropdowns();
    }
    select.value = '';
}

function onSlideInformedChange() {
    const select = document.getElementById('slide-informed');
    if (select.value && !slideInformed.includes(select.value)) {
        slideInformed.push(select.value);
        renderSlideInformedList();
        // Repopulate all R/C/I dropdowns to reflect the new selection
        updateRACIDropdowns();
    }
    select.value = '';
}

function onSlideGateOwnerChange() {
    const select = document.getElementById('slide-gate-owner');
    slideGateOwner = select.value || null;
}

function removeSlideResponsible(actorId) {
    slideResponsible = slideResponsible.filter(id => id !== actorId);
    renderSlideResponsibleList();
    // Repopulate all R/C/I dropdowns to reflect the removal
    updateRACIDropdowns();
}

function removeSlideConsulted(actorId) {
    slideConsulted = slideConsulted.filter(id => id !== actorId);
    renderSlideConsultedList();
    // Repopulate all R/C/I dropdowns to reflect the removal
    updateRACIDropdowns();
}

function removeSlideInformed(actorId) {
    slideInformed = slideInformed.filter(id => id !== actorId);
    renderSlideInformedList();
    // Repopulate all R/C/I dropdowns to reflect the removal
    updateRACIDropdowns();
}

// Update all R/C/I dropdowns with proper filtering
// Rule: An actor can be in ONLY ONE of R, C, or I (mutually exclusive)
// Exception: An actor CAN be both Accountable AND in R, C, or I
function updateRACIDropdowns() {
    // For Responsible dropdown: exclude actors already in R, C, or I
    const excludeFromR = [...slideResponsible, ...slideConsulted, ...slideInformed];
    populateActorDropdown('slide-responsible', excludeFromR);

    // For Consulted dropdown: exclude actors already in C, R, or I
    const excludeFromC = [...slideConsulted, ...slideResponsible, ...slideInformed];
    populateActorDropdown('slide-consulted', excludeFromC);

    // For Informed dropdown: exclude actors already in I, R, or C
    const excludeFromI = [...slideInformed, ...slideResponsible, ...slideConsulted];
    populateActorDropdown('slide-informed', excludeFromI);
}

function renderSlideResponsibleList() {
    const container = document.getElementById('slide-responsible-list');
    if (!container) return;
    container.innerHTML = slideResponsible.map(actorId =>
        renderActorBadge(actorId, 'R', `removeSlideResponsible('${actorId}')`)
    ).join('');
}

function renderSlideConsultedList() {
    const container = document.getElementById('slide-consulted-list');
    if (!container) return;
    container.innerHTML = slideConsulted.map(actorId =>
        renderActorBadge(actorId, 'C', `removeSlideConsulted('${actorId}')`)
    ).join('');
}

function renderSlideInformedList() {
    const container = document.getElementById('slide-informed-list');
    if (!container) return;
    container.innerHTML = slideInformed.map(actorId =>
        renderActorBadge(actorId, 'I', `removeSlideInformed('${actorId}')`)
    ).join('');
}

function toggleSlideDeliverable() {
    const badge = document.getElementById('slide-deliverable-badge');
    const detailsSection = document.getElementById('slide-deliverable-details-section');

    // Toggle the inactive class
    badge.classList.toggle('inactive');

    // Show/hide deliverable details section
    const isActive = !badge.classList.contains('inactive');
    if (detailsSection) {
        detailsSection.style.display = isActive ? '' : 'none';
    }
}

function toggleSlideGate() {
    const badge = document.getElementById('slide-gate-badge');

    // Toggle the inactive class
    badge.classList.toggle('inactive');

    // Update RACI/Gate Owner sections
    toggleSlideGateMode();
}

function toggleFormSection(titleElement) {
    const content = titleElement.nextElementSibling;
    const isCollapsed = titleElement.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand
        titleElement.classList.remove('collapsed');
        content.classList.remove('collapsed');
        content.style.maxHeight = content.scrollHeight + 'px';
    } else {
        // Collapse
        titleElement.classList.add('collapsed');
        content.classList.add('collapsed');
        content.style.maxHeight = '0';
    }
}

function toggleSlideGateMode() {
    const gateBadge = document.getElementById('slide-gate-badge');
    const isGate = gateBadge && !gateBadge.classList.contains('inactive');

    const raciSection = document.getElementById('slide-raci-section');
    const gateOwnerSection = document.getElementById('slide-gate-owner-section');

    raciSection.style.display = isGate ? 'none' : '';
    gateOwnerSection.style.display = isGate ? '' : 'none';

    // Ensure dropdowns are populated when switching modes
    if (isGate) {
        populateActorDropdown('slide-gate-owner');
        const gateOwnerSelect = document.getElementById('slide-gate-owner');
        if (slideGateOwner) {
            gateOwnerSelect.value = slideGateOwner;
        } else {
            gateOwnerSelect.selectedIndex = 0; // Select placeholder
        }

        // Update max-height for the gate owner section content if not collapsed
        const gateOwnerContent = gateOwnerSection.querySelector('.form-section-content');
        const gateOwnerTitle = gateOwnerSection.querySelector('.form-section-title');
        if (gateOwnerContent && gateOwnerTitle && !gateOwnerTitle.classList.contains('collapsed')) {
            gateOwnerContent.style.maxHeight = gateOwnerContent.scrollHeight + 'px';
        }
    } else {
        populateActorDropdown('slide-accountable');
        populateActorDropdown('slide-responsible');
        populateActorDropdown('slide-consulted');
        populateActorDropdown('slide-informed');
        const accountableSelect = document.getElementById('slide-accountable');
        if (slideAccountable) {
            accountableSelect.value = slideAccountable;
        } else {
            accountableSelect.selectedIndex = 0; // Select placeholder
        }

        // Update max-height for the RACI section content if not collapsed
        const raciContent = raciSection.querySelector('.form-section-content');
        const raciTitle = raciSection.querySelector('.form-section-title');
        if (raciContent && raciTitle && !raciTitle.classList.contains('collapsed')) {
            raciContent.style.maxHeight = raciContent.scrollHeight + 'px';
        }
    }
}

function openSlidePanel(slId, secId, actId) {
    // Auto-save previous activity if panel was already open
    if (slidePanelActivity && slidePanelActivity.actId !== actId) {
        isAutoSaving = true; // Set flag to prevent change detection during auto-save
        saveSlidePanel(false); // Save without closing
        isAutoSaving = false; // Reset flag
    }

    const act = getActivity(slId, secId, actId);
    if (!act) return;

    slidePanelActivity = { slId, secId, actId };

    // Populate fields
    document.getElementById('slide-panel-title').textContent = `Edit: ${act.name}`;
    document.getElementById('slide-name').value = act.name;

    // Populate activity type dropdown
    populateActivityTypeDropdown('slide-activity-type');
    document.getElementById('slide-activity-type').value = act.activityType || '';

    // Set badge states instead of checkboxes
    const gateBadge = document.getElementById('slide-gate-badge');
    const deliverableBadge = document.getElementById('slide-deliverable-badge');
    if (act.isGate) {
        gateBadge.classList.remove('inactive');
    } else {
        gateBadge.classList.add('inactive');
    }
    if (act.isDeliverable) {
        deliverableBadge.classList.remove('inactive');
    } else {
        deliverableBadge.classList.add('inactive');
    }

    document.getElementById('slide-friction').value = act.friction || '';
    document.getElementById('slide-resolution').value = act.resolution || '';
    document.getElementById('slide-deliverable-details').value = act.deliverableDetails || '';
    document.getElementById('slide-notes').value = act.notes || '';

    // Populate RACI actors for both gates and regular activities
    if (act.isGate) {
        slideGateOwner = act.gateOwner || null;
    } else {
        slideAccountable = act.accountable || null;
        slideResponsible = [...(act.responsible || [])];
        slideConsulted = [...(act.consulted || [])];
        slideInformed = [...(act.informed || [])];
    }

    // Always populate all dropdowns (they'll be shown/hidden based on gate status)
    populateActorDropdown('slide-accountable');
    populateActorDropdown('slide-gate-owner');

    if (act.isGate) {
        const gateOwnerSelect = document.getElementById('slide-gate-owner');
        if (slideGateOwner) {
            gateOwnerSelect.value = slideGateOwner;
        } else {
            gateOwnerSelect.selectedIndex = 0; // Select placeholder
        }
    } else {
        const accountableSelect = document.getElementById('slide-accountable');
        if (slideAccountable) {
            accountableSelect.value = slideAccountable;
        } else {
            accountableSelect.selectedIndex = 0; // Select placeholder
        }
        renderSlideResponsibleList();
        renderSlideConsultedList();
        renderSlideInformedList();
        // Apply filtering to R/C/I dropdowns based on current selections
        updateRACIDropdowns();
    }

    // Show/hide RACI vs Gate Owner sections
    toggleSlideGateMode();

    // Show/hide Deliverable Details section based on badge state
    const deliverableDetailsSection = document.getElementById('slide-deliverable-details-section');
    if (deliverableDetailsSection) {
        deliverableDetailsSection.style.display = (deliverableBadge && !deliverableBadge.classList.contains('inactive')) ? '' : 'none';
    }

    // Initialize max-height for all form section contents (for collapse animation)
    document.querySelectorAll('.form-section-content').forEach(content => {
        if (!content.classList.contains('collapsed')) {
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    });

    // Initialize predecessors
    if (Array.isArray(act.predecessors) && act.predecessors.length > 0) {
        slidePredecessors = [...act.predecessors];
    } else if (act.predecessor) {
        slidePredecessors = [act.predecessor];
    } else {
        slidePredecessors = [];
    }
    
    // Initialize successors
    const succs = getSuccessors(actId);
    slideSuccessors = succs.map(s => s.activity.id);
    
    renderSlideSelectedPredecessors();
    renderSlideSelectedSuccessors();
    
    // Set delete button
    document.getElementById('slide-delete-btn').onclick = () => {
        if (confirm('Delete this activity?')) {
            deleteActivity(slId, secId, actId);
            closeSlidePanel();
        }
    };
    
    // Open panel and shrink chart
    document.body.classList.add('panel-open');
    document.getElementById('slide-panel').classList.add('open');

    // Highlight the activity being edited
    document.querySelectorAll('.activity-row').forEach(row => row.classList.remove('editing'));
    const editingRow = document.querySelector(`.activity-row[data-activity-id="${actId}"]`);
    if (editingRow) {
        editingRow.classList.add('editing');
        // Scroll the activity into view if needed
        editingRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function closeSlidePanel() {
    document.body.classList.remove('panel-open');
    const panel = document.getElementById('slide-panel');
    panel.classList.remove('open');

    // Remove editing highlight from all activities
    document.querySelectorAll('.activity-row').forEach(row => row.classList.remove('editing'));

    // Reset panel width to default after transition
    setTimeout(() => {
        if (!panel.classList.contains('open')) {
            document.documentElement.style.setProperty('--panel-width', '380px');
            panel.style.width = '';
        }
    }, 300);
    slidePanelActivity = null;
    slidePredecessors = [];
    slideSuccessors = [];
    slideAccountable = null;
    slideResponsible = [];
    slideConsulted = [];
    slideInformed = [];
    slideGateOwner = null;
}

// Escape key to close panel without saving
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && slidePanelActivity) {
        closeSlidePanel();
    }
});

// Panel resize functionality
(function() {
    const panel = document.getElementById('slide-panel');
    const resizeHandle = document.getElementById('slide-panel-resize');
    let isResizing = false;
    let startX, startWidth;
    
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        resizeHandle.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const diff = startX - e.clientX;
        const newWidth = Math.max(300, Math.min(800, startWidth + diff));
        document.documentElement.style.setProperty('--panel-width', newWidth + 'px');
        panel.style.width = newWidth + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
})();

// RACI functions removed - now using actor-based RACI model

function saveSlidePanel(shouldClose = true) {
    if (!slidePanelActivity) return;
    
    const { slId, secId, actId } = slidePanelActivity;
    const act = getActivity(slId, secId, actId);
    if (!act) return;
    
    // Store original values for comparison
    const originalState = {
        name: act.name,
        activityType: act.activityType || null,
        isGate: act.isGate,
        isDeliverable: act.isDeliverable,
        accountable: act.accountable || null,
        responsible: [...(act.responsible || [])],
        consulted: [...(act.consulted || [])],
        informed: [...(act.informed || [])],
        gateOwner: act.gateOwner || null,
        friction: act.friction || '',
        resolution: act.resolution || '',
        deliverableDetails: act.deliverableDetails || '',
        notes: act.notes || '',
        predecessors: [...(act.predecessors || [])],
        start: act.start,
        end: act.end
    };

    // Get new values
    const newName = document.getElementById('slide-name').value || 'Activity';
    const newActivityType = document.getElementById('slide-activity-type').value || null;

    // Read badge states instead of checkboxes
    const gateBadge = document.getElementById('slide-gate-badge');
    const deliverableBadge = document.getElementById('slide-deliverable-badge');
    const newIsGate = gateBadge && !gateBadge.classList.contains('inactive');
    const newIsDeliverable = deliverableBadge && !deliverableBadge.classList.contains('inactive');

    const newFriction = document.getElementById('slide-friction').value || '';
    const newResolution = document.getElementById('slide-resolution').value || '';
    const newDeliverableDetails = document.getElementById('slide-deliverable-details').value || '';
    const newNotes = document.getElementById('slide-notes').value || '';
    
    // Calculate new position for gates
    let newStart = act.start;
    let newEnd = act.end;
    if (newIsGate) {
        const snapped = snapToStageEnd(act.end);
        newStart = snapped;
        newEnd = snapped;
    }
    
    // Save predecessors
    const oldPreds = Array.isArray(act.predecessors) ? [...act.predecessors] : (act.predecessor ? [act.predecessor] : []);
    const newPredecessors = [...slidePredecessors];
    
    // Save successors - update other activities
    const oldSuccs = getSuccessors(actId).map(s => s.activity.id);
    const newSuccessors = [...slideSuccessors];
    
    // Check if anything actually changed
    const hasChanges = (
        originalState.name !== newName ||
        originalState.activityType !== newActivityType ||
        originalState.isGate !== newIsGate ||
        originalState.isDeliverable !== newIsDeliverable ||
        originalState.accountable !== slideAccountable ||
        JSON.stringify(originalState.responsible.sort()) !== JSON.stringify(slideResponsible.sort()) ||
        JSON.stringify(originalState.consulted.sort()) !== JSON.stringify(slideConsulted.sort()) ||
        JSON.stringify(originalState.informed.sort()) !== JSON.stringify(slideInformed.sort()) ||
        originalState.gateOwner !== slideGateOwner ||
        originalState.friction !== newFriction ||
        originalState.resolution !== newResolution ||
        originalState.deliverableDetails !== newDeliverableDetails ||
        originalState.notes !== newNotes ||
        JSON.stringify(originalState.predecessors.sort()) !== JSON.stringify(newPredecessors.sort()) ||
        JSON.stringify(oldSuccs.sort()) !== JSON.stringify(newSuccessors.sort()) ||
        originalState.start !== newStart ||
        originalState.end !== newEnd
    );

    // Apply changes
    act.name = newName;
    act.activityType = newActivityType;
    act.isGate = newIsGate;
    act.isDeliverable = newIsDeliverable;
    act.friction = newFriction;
    act.resolution = newResolution;
    act.deliverableDetails = newDeliverableDetails;
    act.notes = newNotes;
    act.start = newStart;
    act.end = newEnd;
    act.startStage = percentToStage(newStart);
    act.endStage = percentToStage(newEnd);
    act.predecessors = newPredecessors;
    act.predecessor = newPredecessors.length > 0 ? newPredecessors[0] : null;

    // Apply RACI data
    if (newIsGate) {
        act.gateOwner = slideGateOwner;
        // Clear RACI fields for gates
        delete act.accountable;
        delete act.responsible;
        delete act.consulted;
        delete act.informed;
    } else {
        act.accountable = slideAccountable;
        act.responsible = [...slideResponsible];
        act.consulted = [...slideConsulted];
        act.informed = [...slideInformed];
        // Clear gate owner for regular activities
        delete act.gateOwner;
    }
    
    // Remove this activity from old successors that are no longer selected
    oldSuccs.forEach(oldSuccId => {
        if (!newSuccessors.includes(oldSuccId)) {
            const result = findActivityById(oldSuccId);
            if (result) {
                if (Array.isArray(result.activity.predecessors)) {
                    result.activity.predecessors = result.activity.predecessors.filter(p => p !== actId);
                }
                if (result.activity.predecessor === actId) {
                    result.activity.predecessor = result.activity.predecessors?.[0] || null;
                }
            }
        }
    });
    
    // Add this activity as predecessor to new successors
    newSuccessors.forEach(succId => {
        const result = findActivityById(succId);
        if (result) {
            if (!Array.isArray(result.activity.predecessors)) {
                result.activity.predecessors = result.activity.predecessor ? [result.activity.predecessor] : [];
            }
            if (!result.activity.predecessors.includes(actId)) {
                result.activity.predecessors.push(actId);
            }
            if (!result.activity.predecessor) {
                result.activity.predecessor = actId;
            }
        }
    });
    
    if (shouldClose) {
        closeSlidePanel();
    }
    
    // Only mark as changed if there were actual changes and this isn't an auto-save
    if (hasChanges && !isAutoSaving) {
        markAsChanged();
    }
    render();
}

// Slide Panel Predecessor/Successor Functions
function filterSlidePredecessorList() {
    const search = document.getElementById('slide-pred-search').value.toLowerCase();
    const dropdown = document.getElementById('slide-pred-dropdown');
    
    if (!slidePanelActivity) return;
    const allActs = getAllActivities().filter(a => a.id !== slidePanelActivity.actId);
    const filtered = allActs.filter(act => 
        !slidePredecessors.includes(act.id) &&
        (act.name.toLowerCase().includes(search) || 
        act.swimlaneName.toLowerCase().includes(search) ||
        act.sectionName.toLowerCase().includes(search))
    );
    
    let html = '';
    filtered.slice(0, 15).forEach(act => {
        html += `<div class="searchable-dropdown-item" onclick="addSlidePredecessor('${act.id}')">
            <div class="item-name">${act.name}</div>
            <div class="item-meta">${act.swimlaneName} / ${act.sectionName}</div>
        </div>`;
    });
    
    if (filtered.length === 0) {
        html = '<div class="searchable-dropdown-item none-option">No activities found</div>';
    }
    
    dropdown.innerHTML = html;
}

function filterSlideSuccessorList() {
    const search = document.getElementById('slide-succ-search').value.toLowerCase();
    const dropdown = document.getElementById('slide-succ-dropdown');
    
    if (!slidePanelActivity) return;
    const allActs = getAllActivities().filter(a => a.id !== slidePanelActivity.actId);
    const filtered = allActs.filter(act => 
        !slideSuccessors.includes(act.id) &&
        (act.name.toLowerCase().includes(search) || 
        act.swimlaneName.toLowerCase().includes(search) ||
        act.sectionName.toLowerCase().includes(search))
    );
    
    let html = '';
    filtered.slice(0, 15).forEach(act => {
        html += `<div class="searchable-dropdown-item" onclick="addSlideSuccessor('${act.id}')">
            <div class="item-name">${act.name}</div>
            <div class="item-meta">${act.swimlaneName} / ${act.sectionName}</div>
        </div>`;
    });
    
    if (filtered.length === 0) {
        html = '<div class="searchable-dropdown-item none-option">No activities found</div>';
    }
    
    dropdown.innerHTML = html;
}

function showSlidePredecessorDropdown() {
    const dropdown = document.getElementById('slide-pred-dropdown');
    dropdown.classList.add('visible');
    filterSlidePredecessorList();
    setTimeout(() => {
        document.addEventListener('click', function closeHandler(e) {
            const container = document.getElementById('slide-pred-search')?.closest('.searchable-select');
            if (container && !container.contains(e.target)) {
                dropdown.classList.remove('visible');
                document.removeEventListener('click', closeHandler);
            }
        });
    }, 0);
}

function showSlideSuccessorDropdown() {
    const dropdown = document.getElementById('slide-succ-dropdown');
    dropdown.classList.add('visible');
    filterSlideSuccessorList();
    setTimeout(() => {
        document.addEventListener('click', function closeHandler(e) {
            const container = document.getElementById('slide-succ-search')?.closest('.searchable-select');
            if (container && !container.contains(e.target)) {
                dropdown.classList.remove('visible');
                document.removeEventListener('click', closeHandler);
            }
        });
    }, 0);
}

function addSlidePredecessor(predId) {
    if (!slidePredecessors.includes(predId)) {
        slidePredecessors.push(predId);
    }
    document.getElementById('slide-pred-search').value = '';
    document.getElementById('slide-pred-dropdown').classList.remove('visible');
    renderSlideSelectedPredecessors();
}

function addSlideSuccessor(succId) {
    if (!slideSuccessors.includes(succId)) {
        slideSuccessors.push(succId);
    }
    document.getElementById('slide-succ-search').value = '';
    document.getElementById('slide-succ-dropdown').classList.remove('visible');
    renderSlideSelectedSuccessors();
}

function removeSlidePredecessor(predId) {
    slidePredecessors = slidePredecessors.filter(id => id !== predId);
    renderSlideSelectedPredecessors();
}

function removeSlideSuccessor(succId) {
    slideSuccessors = slideSuccessors.filter(id => id !== succId);
    renderSlideSelectedSuccessors();
}

function renderSlideSelectedPredecessors() {
    const container = document.getElementById('slide-selected-preds');
    if (slidePredecessors.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">None selected</span>';
        return;
    }
    
    const allActs = getAllActivities();
    container.innerHTML = slidePredecessors.map(predId => {
        const act = allActs.find(a => a.id === predId);
        if (!act) return '';
        return `<div class="selected-tag">
            <span class="tag-name">${act.name}</span>
            <span class="tag-remove" onclick="removeSlidePredecessor('${predId}')">×</span>
        </div>`;
    }).join('');
}

function renderSlideSelectedSuccessors() {
    const container = document.getElementById('slide-selected-succs');
    if (slideSuccessors.length === 0) {
        container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">None selected</span>';
        return;
    }
    
    const allActs = getAllActivities();
    container.innerHTML = slideSuccessors.map(succId => {
        const act = allActs.find(a => a.id === succId);
        if (!act) return '';
        return `<div class="selected-tag">
            <span class="tag-name">${act.name}</span>
            <span class="tag-remove" onclick="removeSlideSuccessor('${succId}')">×</span>
        </div>`;
    }).join('');
}

function confirmActivity() {
    const name = document.getElementById('activity-name').value || 'New Activity';
    const isGate = document.getElementById('activity-gate').checked;
    const isDeliverable = document.getElementById('activity-deliverable').checked;
    const isShared = document.getElementById('activity-shared').checked;
    const friction = document.getElementById('activity-friction').value || '';
    const resolution = document.getElementById('activity-resolution').value || '';
    const deliverableDetails = document.getElementById('activity-deliverable-details').value || '';
    const notes = document.getElementById('activity-notes').value || '';
    
    const sharedWith = isShared ? getSelectedSharedWith() : [];
    
    let activityId = currentActivity;
    
    // Track old successors for cleanup
    let oldSuccessorIds = [];
    if (editMode && currentActivity) {
        oldSuccessorIds = getSuccessors(currentActivity).map(s => s.activity.id);
    }
    
    if (editMode && currentActivity) {
        const act = getActivity(currentSwimlane, currentSection, currentActivity);
        if (act) {
            act.name = name;
            act.isGate = isGate;
            act.isDeliverable = isDeliverable;
            act.isShared = isShared;
            act.sharedWith = sharedWith;
            act.predecessors = [...selectedPredecessors];
            act.predecessor = selectedPredecessors.length > 0 ? selectedPredecessors[0] : null; // Keep for backward compat
            act.friction = friction;
            act.resolution = resolution;
            act.deliverableDetails = deliverableDetails;
            act.notes = notes;
            if (isGate) { 
                const snapped = snapToStageEnd(act.end); 
                act.start = snapped; 
                act.end = snapped; 
                act.startStage = percentToStage(snapped);
                act.endStage = percentToStage(snapped);
            }
            if (isShared && sharedWith.length) act.type = 'shared';
            else { const sl = ganttData.swimlanes.find(s => s.id === currentSwimlane); act.type = sl?.type || 'ae'; }
        }
    } else {
        const sl = ganttData.swimlanes.find(s => s.id === currentSwimlane);
        if (!sl) return;
        let sec = currentSection ? sl.sections.find(s => s.id === currentSection) : sl.sections[0];
        if (!sec) { sec = { id: `${sl.id}_sec_default`, name: 'General', collapsed: false, activities: [] }; sl.sections.push(sec); }
        const type = isShared && sharedWith.length ? 'shared' : sl.type;
        const firstStageEnd = getStageEnds()[0];
        activityId = `${sl.id}_${Date.now()}`;
        const stageCount = ganttData.stages.length;
        const startPercent = isGate ? firstStageEnd : 0;
        const endPercent = isGate ? firstStageEnd : firstStageEnd;
        
        sec.activities.push({
            id: activityId, name,
            start: startPercent, end: endPercent,
            startStage: percentToStage(startPercent, stageCount),
            endStage: percentToStage(endPercent, stageCount),
            _stageBasedPos: true,
            type, isGate, isDeliverable, isShared, sharedWith, 
            predecessors: [...selectedPredecessors],
            predecessor: selectedPredecessors.length > 0 ? selectedPredecessors[0] : null,
            friction, resolution, deliverableDetails, notes
        });
    }
    
    // Handle successors: set this activity as predecessor for selected successors
    // First, remove this activity from old successors that are no longer selected
    oldSuccessorIds.forEach(oldSuccId => {
        if (!selectedSuccessors.includes(oldSuccId)) {
            const result = findActivityById(oldSuccId);
            if (result) {
                if (Array.isArray(result.activity.predecessors)) {
                    result.activity.predecessors = result.activity.predecessors.filter(p => p !== activityId);
                }
                if (result.activity.predecessor === activityId) {
                    result.activity.predecessor = result.activity.predecessors?.[0] || null;
                }
            }
        }
    });
    
    // Then, add this activity as predecessor to new successors
    selectedSuccessors.forEach(succId => {
        const result = findActivityById(succId);
        if (result) {
            if (!Array.isArray(result.activity.predecessors)) {
                result.activity.predecessors = result.activity.predecessor ? [result.activity.predecessor] : [];
            }
            if (!result.activity.predecessors.includes(activityId)) {
                result.activity.predecessors.push(activityId);
            }
            if (!result.activity.predecessor) {
                result.activity.predecessor = activityId;
            }
        }
    });
    
    markAsChanged();
    closeActivityModal();
    render();
}

// Stages Modal
function openStagesModal() {
    renderStagesList();
    document.getElementById('stages-modal').classList.add('visible');
}

function closeStagesModal() { document.getElementById('stages-modal').classList.remove('visible'); }

function renderStagesList() {
    const container = document.getElementById('stages-list');
    container.innerHTML = ganttData.stages.map((stage, i) => {
        const stageNum = stage.num !== undefined ? stage.num : (i + 1);
        return `
        <div class="stage-list-item" draggable="true" data-stage-id="${stage.id}" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);cursor:grab;background:var(--bg-card);border-radius:6px;margin-bottom:6px;">
            <span class="stage-drag-handle" style="color:var(--text-muted);font-size:14px;">☰</span>
            <div style="width:20px;height:20px;border-radius:4px;background:${stage.color};flex-shrink:0;"></div>
            <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">Stage ${stageNum}: ${stage.name}</div>
            </div>
            <button class="btn small" onclick="openStageEditModal('${stage.id}')">Edit</button>
            <button class="btn small danger" onclick="deleteStage('${stage.id}')" ${ganttData.stages.length <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Delete</button>
        </div>
    `}).join('');
    attachStageDragListeners();
}

let draggedStage = null;

function attachStageDragListeners() {
    document.querySelectorAll('.stage-list-item[draggable="true"]').forEach(el => {
        el.addEventListener('dragstart', e => {
            draggedStage = el.dataset.stageId;
            el.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        el.addEventListener('dragend', e => {
            el.style.opacity = '1';
            document.querySelectorAll('.stage-list-item').forEach(x => x.style.borderTop = '');
            draggedStage = null;
        });
        el.addEventListener('dragover', e => {
            e.preventDefault();
            if (!draggedStage || el.dataset.stageId === draggedStage) return;
            el.style.borderTop = '2px solid var(--ss-color)';
        });
        el.addEventListener('dragleave', e => {
            el.style.borderTop = '';
        });
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.style.borderTop = '';
            if (!draggedStage || el.dataset.stageId === draggedStage) return;
            const fromIdx = ganttData.stages.findIndex(s => s.id === draggedStage);
            const toIdx = ganttData.stages.findIndex(s => s.id === el.dataset.stageId);
            if (fromIdx === -1 || toIdx === -1) return;
            const [moved] = ganttData.stages.splice(fromIdx, 1);
            ganttData.stages.splice(toIdx, 0, moved);
            markAsChanged();
            renderStagesList();
            render();
        });
    });
}

function addStage() {
    const newId = `s_${Date.now()}`;
    const colorIndex = ganttData.stages.length % STAGE_COLORS.length;
    const newNum = ganttData.stages.length + 1;
    ganttData.stages.push({ id: newId, num: String(newNum), name: `New Stage`, color: STAGE_COLORS[colorIndex] });
    
    // Recalculate all activity positions based on new stage count
    migrateActivityPositioning();
    
    markAsChanged();
    renderStagesList();
    render();
}

function deleteStage(stageId) {
    if (ganttData.stages.length <= 1) return;
    if (!confirm('Delete this stage? Activities will be redistributed.')) return;
    ganttData.stages = ganttData.stages.filter(s => s.id !== stageId);
    
    // Recalculate all activity positions based on new stage count
    migrateActivityPositioning();
    
    markAsChanged();
    renderStagesList();
    render();
}

function openStageEditModal(stageId) {
    editingStageId = stageId;
    const stage = ganttData.stages.find(s => s.id === stageId);
    if (!stage) return;
    const idx = ganttData.stages.findIndex(s => s.id === stageId);
    document.getElementById('stage-edit-num').value = stage.num !== undefined ? stage.num : (idx + 1);
    document.getElementById('stage-edit-name').value = stage.name;
    selectedStageColor = stage.color;
    renderColorPicker();
    document.getElementById('stage-edit-modal').classList.add('visible');
}

function closeStageEditModal() { document.getElementById('stage-edit-modal').classList.remove('visible'); editingStageId = null; }

function renderColorPicker() {
    const container = document.getElementById('stage-color-picker');
    container.innerHTML = STAGE_COLORS.map(color => `
        <div class="color-option ${selectedStageColor === color ? 'selected' : ''}"
             style="background:${color};"
             onclick="selectStageColor('${color}')"></div>
    `).join('');

    // Sync color input
    const colorInput = document.getElementById('stage-color-input');
    if (colorInput && selectedStageColor) {
        colorInput.value = selectedStageColor;
    }
}

function selectStageColor(color) {
    selectedStageColor = color;
    renderColorPicker();
}

function confirmStageEdit() {
    if (!editingStageId) return;
    const stage = ganttData.stages.find(s => s.id === editingStageId);
    if (stage) {
        stage.num = document.getElementById('stage-edit-num').value;
        stage.name = document.getElementById('stage-edit-name').value || stage.name;
        stage.color = selectedStageColor;
    }
    markAsChanged();
    closeStageEditModal();
    renderStagesList();
    render();
}

// Actors Modal
let editingActorId = null;
let selectedActorColor = null;

function openActorsModal() {
    renderActorsList();
    document.getElementById('actors-modal').classList.add('visible');
}

function closeActorsModal() {
    document.getElementById('actors-modal').classList.remove('visible');
}

function renderActorsList() {
    const container = document.getElementById('actors-list');
    if (!ganttData.actors) ganttData.actors = [];

    container.innerHTML = ganttData.actors.map((actor) => {
        return `
        <div class="stage-list-item" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);background:var(--bg-card);border-radius:6px;margin-bottom:6px;">
            <div style="width:24px;height:24px;border-radius:50%;background:${actor.color};flex-shrink:0;"></div>
            <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${actor.name}</div>
            </div>
            <button class="btn small" onclick="openActorEditModal('${actor.id}')">Edit</button>
            <button class="btn small danger" onclick="deleteActor('${actor.id}')" ${ganttData.actors.length <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Delete</button>
        </div>
    `}).join('');
}

function addActor() {
    const newId = `actor_${Date.now()}`;
    const colorIndex = ganttData.actors.length % ACTOR_COLORS.length;
    ganttData.actors.push({
        id: newId,
        name: 'New Actor',
        color: ACTOR_COLORS[colorIndex]
    });
    markAsChanged();
    renderActorsList();
    render();
}

function deleteActor(actorId) {
    if (ganttData.actors.length <= 1) return;

    // Check if actor is used in any activities
    let isUsed = false;
    ganttData.swimlanes.forEach(sl => {
        sl.sections.forEach(sec => {
            sec.activities.forEach(act => {
                if (act.accountable === actorId ||
                    act.gateOwner === actorId ||
                    (act.responsible && act.responsible.includes(actorId)) ||
                    (act.consulted && act.consulted.includes(actorId)) ||
                    (act.informed && act.informed.includes(actorId))) {
                    isUsed = true;
                }
            });
        });
    });

    if (isUsed && !confirm('This actor is assigned to activities. Delete anyway? (Activities will lose this assignment)')) {
        return;
    }

    // Remove actor from all activities
    ganttData.swimlanes.forEach(sl => {
        sl.sections.forEach(sec => {
            sec.activities.forEach(act => {
                if (act.accountable === actorId) act.accountable = null;
                if (act.gateOwner === actorId) act.gateOwner = null;
                if (act.responsible) act.responsible = act.responsible.filter(id => id !== actorId);
                if (act.consulted) act.consulted = act.consulted.filter(id => id !== actorId);
                if (act.informed) act.informed = act.informed.filter(id => id !== actorId);
            });
        });
    });

    ganttData.actors = ganttData.actors.filter(a => a.id !== actorId);
    markAsChanged();
    renderActorsList();
    render();
}

function openActorEditModal(actorId) {
    editingActorId = actorId;
    const actor = ganttData.actors.find(a => a.id === actorId);
    if (!actor) return;

    document.getElementById('actor-edit-title').textContent = 'Edit Actor';
    document.getElementById('actor-edit-name').value = actor.name;
    selectedActorColor = actor.color;
    renderActorColorPicker();
    document.getElementById('actor-edit-modal').classList.add('visible');
}

function closeActorEditModal() {
    document.getElementById('actor-edit-modal').classList.remove('visible');
    editingActorId = null;
}

function renderActorColorPicker() {
    const container = document.getElementById('actor-color-picker');
    container.innerHTML = ACTOR_COLORS.map(color => `
        <div class="color-option ${selectedActorColor === color ? 'selected' : ''}"
             style="background:${color};"
             onclick="selectActorColor('${color}')"></div>
    `).join('');

    // Sync color input
    const colorInput = document.getElementById('actor-color-input');
    if (colorInput && selectedActorColor) {
        colorInput.value = selectedActorColor;
    }
}

function selectActorColor(color) {
    selectedActorColor = color;
    renderActorColorPicker();
}

// Handle custom color inputs
document.addEventListener('DOMContentLoaded', function() {
    const actorColorInput = document.getElementById('actor-color-input');
    if (actorColorInput) {
        actorColorInput.addEventListener('input', function(e) {
            selectedActorColor = e.target.value.toUpperCase();
            renderActorColorPicker();
        });
    }

    const swimlaneColorInput = document.getElementById('swimlane-color-input');
    if (swimlaneColorInput) {
        swimlaneColorInput.addEventListener('input', function(e) {
            selectedSwimlaneColor = e.target.value.toUpperCase();
            renderSwimlaneColorPicker();
        });
    }

    const stageColorInput = document.getElementById('stage-color-input');
    if (stageColorInput) {
        stageColorInput.addEventListener('input', function(e) {
            selectedStageColor = e.target.value.toUpperCase();
            renderColorPicker();
        });
    }

    const activityTypeColorInput = document.getElementById('activity-type-color-input');
    if (activityTypeColorInput) {
        activityTypeColorInput.addEventListener('input', function(e) {
            selectedActivityTypeColor = e.target.value.toUpperCase();
            renderActivityTypeColorPicker();
        });
    }
});

function confirmActorEdit() {
    if (!editingActorId) return;
    const actor = ganttData.actors.find(a => a.id === editingActorId);
    if (actor) {
        actor.name = document.getElementById('actor-edit-name').value || actor.name;
        actor.color = selectedActorColor;
    }
    markAsChanged();
    closeActorEditModal();
    renderActorsList();
    render();
}

// Activity Types Modal
let editingActivityTypeId = null;
let selectedActivityTypeColor = null;

function openActivityTypesModal() {
    renderActivityTypesList();
    document.getElementById('activity-types-modal').classList.add('visible');
}

function closeActivityTypesModal() {
    document.getElementById('activity-types-modal').classList.remove('visible');
}

function renderActivityTypesList() {
    const container = document.getElementById('activity-types-list');
    if (!ganttData.activityTypes) ganttData.activityTypes = [];

    container.innerHTML = ganttData.activityTypes.map((type) => {
        return `
        <div class="stage-list-item" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);background:var(--bg-card);border-radius:6px;margin-bottom:6px;">
            <div style="width:24px;height:24px;border-radius:4px;background:${type.color};flex-shrink:0;"></div>
            <div style="flex:1;">
                <div style="font-weight:500;font-size:13px;">${type.name}</div>
            </div>
            <button class="btn small" onclick="openActivityTypeEditModal('${type.id}')">Edit</button>
            <button class="btn small danger" onclick="deleteActivityType('${type.id}')" ${ganttData.activityTypes.length <= 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>Delete</button>
        </div>
    `}).join('');
}

function addActivityType() {
    const newId = `type_${Date.now()}`;
    const colorIndex = ganttData.activityTypes.length % ACTIVITY_TYPE_COLORS.length;
    ganttData.activityTypes.push({
        id: newId,
        name: 'New Type',
        color: ACTIVITY_TYPE_COLORS[colorIndex]
    });
    markAsChanged();
    renderActivityTypesList();
    render();
}

function deleteActivityType(typeId) {
    if (ganttData.activityTypes.length <= 1) return;

    // Check if type is used in any activities
    let isUsed = false;
    ganttData.swimlanes.forEach(sl => {
        if (sl.activities) {
            sl.activities.forEach(act => {
                if (act.activityType === typeId) isUsed = true;
            });
        }
        if (sl.sections) {
            sl.sections.forEach(sec => {
                if (sec.activities) {
                    sec.activities.forEach(act => {
                        if (act.activityType === typeId) isUsed = true;
                    });
                }
            });
        }
    });

    if (isUsed && !confirm('This activity type is assigned to activities. Delete anyway? (Activities will lose this type assignment)')) {
        return;
    }

    // Remove type from all activities
    ganttData.swimlanes.forEach(sl => {
        if (sl.activities) {
            sl.activities.forEach(act => {
                if (act.activityType === typeId) act.activityType = null;
            });
        }
        if (sl.sections) {
            sl.sections.forEach(sec => {
                if (sec.activities) {
                    sec.activities.forEach(act => {
                        if (act.activityType === typeId) act.activityType = null;
                    });
                }
            });
        }
    });

    ganttData.activityTypes = ganttData.activityTypes.filter(t => t.id !== typeId);
    markAsChanged();
    renderActivityTypesList();
    render();
}

function openActivityTypeEditModal(typeId) {
    editingActivityTypeId = typeId;
    const type = ganttData.activityTypes.find(t => t.id === typeId);
    if (!type) return;

    document.getElementById('activity-type-edit-title').textContent = 'Edit Activity Type';
    document.getElementById('activity-type-edit-name').value = type.name;
    selectedActivityTypeColor = type.color;
    renderActivityTypeColorPicker();
    document.getElementById('activity-type-edit-modal').classList.add('visible');
}

function closeActivityTypeEditModal() {
    document.getElementById('activity-type-edit-modal').classList.remove('visible');
    editingActivityTypeId = null;
}

function renderActivityTypeColorPicker() {
    const container = document.getElementById('activity-type-color-picker');
    container.innerHTML = ACTIVITY_TYPE_COLORS.map(color => `
        <div class="color-option ${selectedActivityTypeColor === color ? 'selected' : ''}"
             style="background:${color};"
             onclick="selectActivityTypeColor('${color}')"></div>
    `).join('');

    // Sync color input
    const colorInput = document.getElementById('activity-type-color-input');
    if (colorInput && selectedActivityTypeColor) {
        colorInput.value = selectedActivityTypeColor;
    }
}

function selectActivityTypeColor(color) {
    selectedActivityTypeColor = color;
    renderActivityTypeColorPicker();
}

function confirmActivityTypeEdit() {
    if (!editingActivityTypeId) return;
    const type = ganttData.activityTypes.find(t => t.id === editingActivityTypeId);
    if (type) {
        type.name = document.getElementById('activity-type-edit-name').value || type.name;
        type.color = selectedActivityTypeColor;
    }
    markAsChanged();
    closeActivityTypeEditModal();
    renderActivityTypesList();
    render();
}

// Import/Export
function exportJSON() {
    // Get current filename without extension for the prompt
    const currentFilename = document.getElementById('project-filename').textContent.trim();
    const baseFilename = currentFilename.replace('.json', '');
    
    const filename = prompt('Enter filename:', baseFilename);
    if (filename === null) return; // User cancelled
    
    const json = JSON.stringify(ganttData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Ensure .json extension
    let finalFilename = filename.trim() || 'Editor Tutorial';
    if (!finalFilename.endsWith('.json')) {
        finalFilename += '.json';
    }
    
    // Update the displayed filename
    document.getElementById('project-filename').textContent = finalFilename;
    
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    markAsSaved(); // Mark as saved since we just saved with new name
}

function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.swimlanes && Array.isArray(data.swimlanes)) {
                if (!data.stages) {
                    data.stages = [
                        { id: 's1', name: 'Stage 1', color: '#58a6ff' },
                        { id: 's2', name: 'Stage 2', color: '#a371f7' },
                        { id: 's3', name: 'Stage 3', color: '#f778ba' },
                        { id: 's4', name: 'Stage 4', color: '#56d364' }
                    ];
                }
                ganttData = data;
                lastImportedData = JSON.parse(JSON.stringify(data)); // Store deep copy of imported data
                
                // Update displayed filename to imported file name
                let importedFilename = file.name;
                if (!importedFilename.endsWith('.json')) {
                    importedFilename += '.json';
                }
                document.getElementById('project-filename').textContent = importedFilename;
                
                markAsSaved(); // Mark as saved since we just loaded new data
                render();
                alert('Imported successfully!');
            } else {
                alert('Invalid file format.');
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function saveToLocalStorage() {
    const json = JSON.stringify(ganttData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Get current filename from display
    const filenameSpan = document.getElementById('project-filename');
    let currentFilename = filenameSpan.textContent.trim() || 'Editor Tutorial.json';
    
    // Remove .json extension for processing
    if (currentFilename.endsWith('.json')) {
        currentFilename = currentFilename.replace('.json', '');
    }
    
    // Extract version number and base name
    const versionMatch = currentFilename.match(/^(.+?)(?:_v(\d+))?$/);
    const baseName = versionMatch[1];
    const currentVersion = versionMatch[2] ? parseInt(versionMatch[2]) : 0;
    const newVersion = currentVersion + 1;
    
    // Create new filename with incremented version
    const filename = `${baseName}_v${newVersion}.json`;
    
    // Update the displayed filename to match what was actually saved
    filenameSpan.textContent = filename;
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    markAsSaved();
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('pricefx-gantt-v6');
    if (saved) {
        try { ganttData = JSON.parse(saved); } catch (e) { console.error('Load failed'); }
    }
}

function createNew() {
    if (hasUnsavedChanges) {
        if (!confirm('Create new project? All unsaved changes will be lost.')) {
            return;
        }
    }

    // Create empty gantt data with minimal structure
    ganttData = {
        stages: [
            { id: 's1', num: '1', name: 'Stage 1', color: '#58a6ff' },
            { id: 's2', num: '2', name: 'Stage 2', color: '#a371f7' },
            { id: 's3', num: '3', name: 'Stage 3', color: '#f778ba' },
            { id: 's4', num: '4', name: 'Stage 4', color: '#56d364' }
        ],
        actors: [
            { id: 'actor1', name: 'Actor 1', color: '#FF6B6B' },
            { id: 'actor2', name: 'Actor 2', color: '#4ECDC4' }
        ],
        swimlanes: []
    };

    // Clear filename
    document.getElementById('project-filename').textContent = 'Untitled.json';

    // Clear last imported data
    lastImportedData = null;

    // Clear local storage
    localStorage.removeItem('pricefx-gantt-v6');

    markAsSaved();
    render();
}

function resetToDefault() {
    const message = lastImportedData ?
        'Reset to last uploaded file? All unsaved changes will be lost.' :
        'Reset to tutorial data? All unsaved changes will be lost.';

    if (confirm(message)) {
        if (lastImportedData) {
            // Reload the last imported data
            ganttData = JSON.parse(JSON.stringify(lastImportedData));
        } else {
            // Reload tutorial data by refreshing the page
            localStorage.removeItem('pricefx-gantt-v6');
            location.reload();
            return;
        }
        markAsSaved();
        render();
    }
}

// Initialize beforeunload warning
window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

loadTheme();
loadTextSize();
loadFromLocalStorage();
markAsSaved(); // Initialize as saved on load
render();
