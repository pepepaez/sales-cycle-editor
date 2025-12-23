# RACI Model Implementation - Change Summary

This document outlines the significant redesign of the Sales Cycle Editor to use a RACI (Responsible, Accountable, Consulted, Informed) model with actors.

## Overview of Changes

### Conceptual Model Shift
- **Before**: Swimlanes represented participants, activities could be shared
- **After**: Swimlanes represent major sections of work (e.g., "PoC Work", "SI Selection"), actors are assigned RACI roles on activities

### Key Features
1. **Actors**: Defined individuals/roles with bright colors
2. **RACI Roles**: Each activity must have one Accountable actor, can have multiple Responsible, Consulted, and Informed actors
3. **Exit Gates**: Have a single owner actor (the approver)
4. **Section-Based Swimlanes**: Represent phases of work rather than people
5. **Color Coding**: Actor colors (bright) show on activity bars, swimlane colors (pastel) provide visual separation

## Files Modified

### 1. `js/data.js`
**Changes:**
- Added `ACTOR_COLORS` array (bright colors for actors)
- Added `SWIMLANE_COLORS` array (pastel colors for sections)
- Added `actors` array to ganttData with predefined actors:
  - Account Executive
  - Sales Engineer
  - Solution Architect
  - Sales Manager
- Updated all activities to use RACI model:
  - `accountable`: single actor ID (required for activities)
  - `responsible`: array of actor IDs
  - `consulted`: array of actor IDs
  - `informed`: array of actor IDs
  - `gateOwner`: single actor ID (for exit gates only)
- Removed `isShared` and `sharedWith` properties
- Changed swimlane names to represent work phases instead of participants
- Updated swimlane colors to use pastel shades

### 2. `js/app.js`
**Major Changes:**

#### Legend System
- `renderLegend()`: Now displays actors instead of swimlanes
- Shows actor names with their bright colors
- Removed "Shared" indicator

#### Activity Rendering
- `renderActivityRow()`:
  - Uses accountable actor's color for activity bars (or gateOwner for gates)
  - Displays accountable actor badge ("A") with actor color
  - Removed all shared activity logic and badges
  - Gate bars now use gate owner's color

#### Tooltips
- `showTooltip()`:
  - Shows "Section" and "Subsection" instead of "Owner" and "Section"
  - Displays full RACI breakdown for regular activities
  - Shows gate owner for exit gates
  - Actor names displayed in their respective colors

#### Slide Panel (Edit Interface)
- Added RACI state variables:
  - `slideAccountable`
  - `slideResponsible`
  - `slideConsulted`
  - `slideInformed`
  - `slideGateOwner`
- Added helper functions:
  - `populateActorDropdown()`: Populates select dropdowns with actors
  - `renderActorBadge()`: Creates colored badges for selected actors
  - `onSlideAccountableChange()`: Handles accountable selection
  - `onSlideResponsibleChange()`, `onSlideConsultedChange()`, `onSlideInformedChange()`: Handle multi-select RACI roles
  - `onSlideGateOwnerChange()`: Handles gate owner selection
  - `toggleSlideGateMode()`: Shows RACI section for activities, gate owner section for gates
  - Remove functions for each RACI list
- Updated `openSlidePanel()`:
  - Populates RACI dropdowns and lists based on activity data
  - Switches between RACI and gate owner sections based on isGate
- Updated `saveSlidePanel()`:
  - Saves RACI data to activity
  - Clears RACI fields for gates, clears gate owner for activities
  - Proper change detection for RACI fields
- Updated `closeSlidePanel()`: Resets all RACI state variables
- Removed all shared activity functions:
  - `toggleSharedWith()`
  - `populateSharedWithCheckboxes()`
  - `getSelectedSharedWith()`
  - `setSharedWithCheckboxes()`

### 3. `index.html`
**Changes:**

#### Slide Panel HTML
- Removed "Shared" checkbox and "Shared With" section
- Added RACI section with:
  - Accountable dropdown (single select)
  - Responsible multi-select with badge display
  - Consulted multi-select with badge display
  - Informed multi-select with badge display
- Added Gate Owner section (shown only for exit gates):
  - Single select dropdown for gate owner
- Added `onchange` handlers for all RACI dropdowns
- Added `onchange="toggleSlideGateMode()"` to gate checkbox

## New Data Structure

### Actor Object
```javascript
{
  id: 'actor1',
  name: 'Account Executive',
  color: '#FF6B6B'  // Bright color
}
```

### Activity Object (Regular)
```javascript
{
  id: 't1',
  name: 'Activity Name',
  start: 5,
  end: 30,
  isGate: false,
  isDeliverable: false,
  accountable: 'actor1',           // Required
  responsible: ['actor2'],          // Optional array
  consulted: ['actor3'],           // Optional array
  informed: ['actor4'],            // Optional array
  predecessor: null,
  friction: '',
  resolution: '',
  deliverableDetails: '',
  notes: ''
}
```

### Exit Gate Object
```javascript
{
  id: 'g1',
  name: 'Gate Name',
  start: 25,
  end: 25,
  isGate: true,
  isDeliverable: false,
  gateOwner: 'actor4',             // Required for gates
  predecessor: 't1',
  friction: '',
  resolution: '',
  deliverableDetails: '',
  notes: ''
}
```

### Swimlane Object
```javascript
{
  id: 'poc',
  name: 'PoC Work',                // Phase name, not participant
  color: '#FFF0E5',                // Pastel color
  collapsed: false,
  sections: [...]
}
```

## Visual Changes

1. **Legend**: Shows actors with bright colors instead of swimlanes
2. **Activity Bars**: Colored by accountable actor (bright colors)
3. **Swimlanes**: Use pastel colors for visual separation
4. **Activity Badges**: Show "A" badge in accountable actor's color
5. **Exit Gates**: Diamond markers in gate owner's color
6. **Tooltips**: Display full RACI breakdown with color-coded actor names

## Removed Features

1. **Shared Activities**: No longer supported
2. **Shared With checkboxes**: Removed from all UIs
3. **Shared indicator in legend**: Removed
4. **Shared badges on activities**: Removed
5. **Swimlane-as-owner concept**: Replaced with section-as-phase

## Backward Compatibility

**Note**: This is a breaking change. Old JSON files with `isShared` and `sharedWith` properties will need to be manually migrated to the new RACI model.

## Testing Status

Basic implementation is complete. Key areas to test:
1. ✅ Activity bars display with actor colors
2. ✅ Tooltips show RACI information
3. ✅ Legend shows actors
4. ✅ Slide panel loads with RACI dropdowns
5. ⚠️ Slide panel save functionality (needs testing)
6. ⚠️ Creating new activities with RACI
7. ⚠️ Exit gate owner assignment
8. ⚠️ Import/Export with new data model

## Next Steps (Optional Enhancements)

1. **Actors Management UI**: Add interface to add/edit/delete actors
2. **Activity Modal Update**: Update the main activity modal (not just slide panel) to support RACI
3. **Validation**: Ensure every activity has an accountable actor
4. **Migration Tool**: Create tool to convert old JSON format to new RACI format
5. **Color Picker for Actors**: Allow customizing actor colors
6. **RACI Matrix View**: Add a view showing all activities in RACI matrix format

## Example Use Cases

### Creating a New Activity
1. Click "+ Activity" in a section
2. Enter activity name
3. Select accountable actor (required)
4. Optionally add responsible, consulted, informed actors
5. Activity bar will display in accountable actor's color

### Creating an Exit Gate
1. Click "+ Activity" in a section
2. Enter gate name
3. Check "Exit Gate" checkbox
4. Select gate owner (required)
5. Gate will snap to stage boundary in gate owner's color

### Understanding RACI Roles
- **Accountable (A)**: The person ultimately answerable for the correct completion of the task
- **Responsible (R)**: Those who do the work to complete the task
- **Consulted (C)**: Those whose opinions are sought (two-way communication)
- **Informed (I)**: Those who are kept up-to-date on progress (one-way communication)

## Known Issues / To Fix

1. Activity modal (the older modal UI) still has shared activity references - needs updating
2. Some functions still reference old shared logic - needs cleanup
3. Need to test create new activity flow
4. Need to test import/export with new format
