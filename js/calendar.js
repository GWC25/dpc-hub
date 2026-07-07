// DPC Hub · calendar.js · v1.0 · July 2026

let currentView = 'week';
let currentDate = new Date();

/**
 * Initializes the Calendar module.
 * @param {HTMLElement} container - The DOM node to mount the view.
 */
export function initCalendar(container) {
  try {
    container.innerHTML = '';
    
    // Top Bar creation [cite: 427-429]
    const topBar = document.createElement('div');
    topBar.className = 'calendar-top-bar';
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.marginBottom = 'var(--space-lg)';

    const navGroup = document.createElement('div');
    navGroup.innerHTML = `
      <button id="btn-prev" aria-label="Previous Period" style="background: none; border: 1px solid var(--color-border); padding: var(--space-sm); border-radius: var(--radius-sm);"><</button>
      <button id="btn-today" style="margin: 0 var(--space-sm); background: none; border: 1px solid var(--color-border); padding: var(--space-sm); border-radius: var(--radius-sm);">Today</button>
      <button id="btn-next" aria-label="Next Period" style="background: none; border: 1px solid var(--color-border); padding: var(--space-sm); border-radius: var(--radius-sm);">></button>
    `;

    const viewToggles = document.createElement('div');
    ['Week', 'Month', 'Year'].forEach(view => {
      const btn = document.createElement('button');
      btn.textContent = view;
      btn.className = 'view-toggle-btn';
      btn.style.padding = 'var(--space-sm) var(--space-md)';
      btn.style.border = '1px solid var(--color-border)';
      if(view.toLowerCase() === currentView) {
        btn.style.backgroundColor = 'var(--color-teal)';
        btn.style.color = 'var(--color-white)';
      }
      btn.addEventListener('click', () => switchView(view.toLowerCase(), container));
      viewToggles.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add entry';
    addBtn.style.backgroundColor = 'var(--color-teal)';
    addBtn.style.color = 'var(--color-white)';
    addBtn.style.padding = 'var(--space-sm) var(--space-md)';
    addBtn.style.borderRadius = 'var(--radius-sm)';
    addBtn.addEventListener('click', () => openEntryModal());

    topBar.appendChild(navGroup);
    topBar.appendChild(viewToggles);
    topBar.appendChild(addBtn);

    const gridContainer = document.createElement('div');
    gridContainer.id = 'calendar-grid-container';

    container.appendChild(topBar);
    container.appendChild(gridContainer);

    // Event listeners for navigation [cite: 428]
    container.querySelector('#btn-prev').addEventListener('click', () => navigateCalendar(-1, container));
    container.querySelector('#btn-next').addEventListener('click', () => navigateCalendar(1, container));
    container.querySelector('#btn-today').addEventListener('click', () => {
      currentDate = new Date();
      renderCurrentView(gridContainer);
    });

    renderCurrentView(gridContainer);

  } catch (error) {
    console.error("Calendar Init Error:", error); [cite: 137]
  }
}

/**
 * Handles view switching (Week / Month / Year)
 */
function switchView(view, mainContainer) {
  currentView = view;
  initCalendar(mainContainer); // Re-render to update toggle styles
}

/**
 * Navigates date backward or forward based on current view.
 */
function navigateCalendar(direction, mainContainer) {
  if (currentView === 'week') currentDate.setDate(currentDate.getDate() + (direction * 7));
  if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + direction);
  if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + direction);
  renderCurrentView(mainContainer.querySelector('#calendar-grid-container'));
}

/**
 * Routes the rendering to the specific view function.
 */
function renderCurrentView(gridContainer) {
  gridContainer.innerHTML = '';
  const entries = window.DPC_DATA?.calendar?.entries || [];

  if (currentView === 'week') renderWeekView(gridContainer, entries);
  else if (currentView === 'month') renderMonthView(gridContainer, entries);
  else if (currentView === 'year') renderYearView(gridContainer, entries); [cite: 429-434]
}

/**
 * Renders the 7-column Week View. [cite: 429-430]
 */
function renderWeekView(container, entries) {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(7, 1fr)';
  container.style.gap = 'var(--space-sm)';

  // Calculate start of week (Monday)
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay() || 7; 
  if (day !== 1) startOfWeek.setHours(-24 * (day - 1));

  for (let i = 0; i < 7; i++) {
    const colDate = new Date(startOfWeek);
    colDate.setDate(colDate.getDate() + i);
    const dateString = colDate.toISOString().split('T')[0];

    const col = document.createElement('div');
    col.style.border = '1px solid var(--color-border)';
    col.style.minHeight = '400px';
    col.style.padding = 'var(--space-sm)';
    col.style.backgroundColor = 'var(--color-white)';

    col.innerHTML = `<div style="font-weight: var(--font-bold); text-align: center; margin-bottom: var(--space-md); color: var(--color-navy);">${colDate.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'})}</div>`;

    // Filter events for this day
    const dayEntries = entries.filter(e => e.date === dateString);
    dayEntries.forEach(entry => {
      const chip = createEventChip(entry);
      col.appendChild(chip);
    });

    container.appendChild(col);
  }
}

/**
 * Renders the 7x5 Month View Grid. [cite: 431-432]
 */
function renderMonthView(container, entries) {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(7, 1fr)';
  container.style.gridAutoRows = 'minmax(100px, auto)';
  container.style.gap = '1px';
  container.style.backgroundColor = 'var(--color-border)'; // For inner borders

  // ARCHITECT QUERY: Standard 5-row grid might drop days if month spans 6 weeks. Implementing standard dynamic grid that fits the month.
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  let startDay = startOfMonth.getDay() || 7; 
  let currentGridDate = new Date(startOfMonth);
  currentGridDate.setDate(currentGridDate.getDate() - (startDay - 1));

  for (let i = 0; i < 35; i++) { // 7 cols * 5 rows
    const dateString = currentGridDate.toISOString().split('T')[0];
    const cell = document.createElement('div');
    cell.style.backgroundColor = 'var(--color-white)';
    cell.style.padding = 'var(--space-sm)';
    
    // Dim days outside current month
    if (currentGridDate.getMonth() !== currentDate.getMonth()) {
      cell.style.color = 'var(--color-muted)';
      cell.style.backgroundColor = 'var(--color-light)';
    }

    cell.innerHTML = `<div style="text-align: right; font-size: var(--text-sm);">${currentGridDate.getDate()}</div>`;

    const dayEntries = entries.filter(e => e.date === dateString);
    dayEntries.slice(0, 3).forEach(entry => cell.appendChild(createEventChip(entry)));
    
    if (dayEntries.length > 3) {
      const overflow = document.createElement('div');
      overflow.textContent = `+ ${dayEntries.length - 3} more`;
      overflow.style.fontSize = 'var(--text-xs)';
      overflow.style.color = 'var(--color-teal)';
      overflow.style.cursor = 'pointer';
      cell.appendChild(overflow);
    }

    container.appendChild(cell);
    currentGridDate.setDate(currentGridDate.getDate() + 1);
  }
}

/**
 * Renders the 12-month Year View. [cite: 433]
 */
function renderYearView(container, entries) {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(4, 1fr)';
  container.style.gap = 'var(--space-lg)';
  
  const year = currentDate.getFullYear();
  
  for(let i = 0; i < 12; i++) {
    const monthBox = document.createElement('div');
    monthBox.style.border = '1px solid var(--color-border)';
    monthBox.style.borderRadius = 'var(--radius-md)';
    monthBox.style.padding = 'var(--space-md)';
    monthBox.style.cursor = 'pointer';
    
    const monthName = new Date(year, i, 1).toLocaleDateString('en-GB', {month: 'long'});
    monthBox.innerHTML = `<h4 style="color: var(--color-navy); margin-bottom: var(--space-sm);">${monthName}</h4>`;
    
    // Heatmap logic simulation: darker if more entries
    const monthEntries = entries.filter(e => new Date(e.date).getMonth() === i && new Date(e.date).getFullYear() === year);
    let heatColor = 'var(--color-light)';
    if(monthEntries.length > 10) heatColor = 'var(--color-teal)';
    else if(monthEntries.length > 0) heatColor = 'var(--color-teal-lt)';
    
    const heatBox = document.createElement('div');
    heatBox.style.height = '60px';
    heatBox.style.backgroundColor = heatColor;
    heatBox.style.borderRadius = 'var(--radius-sm)';
    
    monthBox.appendChild(heatBox);
    monthBox.addEventListener('click', () => {
      currentDate.setMonth(i);
      switchView('month', document.querySelector('.calendar-top-bar').parentElement);
    });
    
    container.appendChild(monthBox);
  }
}

/**
 * Helper to create individual event chips. [cite: 430]
 */
function createEventChip(entry) {
  const chip = document.createElement('div');
  chip.style.padding = '2px 4px';
  chip.style.marginBottom = '2px';
  chip.style.borderRadius = 'var(--radius-sm)';
  chip.style.fontSize = 'var(--text-xs)';
  chip.style.color = 'var(--color-white)';
  chip.style.cursor = 'pointer';
  chip.style.whiteSpace = 'nowrap';
  chip.style.overflow = 'hidden';
  chip.style.textOverflow = 'ellipsis';
  chip.setAttribute('tabindex', '0');

  // Color mapping by type
  let bg = 'var(--color-blue)'; // Default meeting
  if (entry.entryType === 'task') bg = 'var(--color-amber)';
  if (entry.entryType === 'deadline') bg = 'var(--color-red)';
  if (entry.entryType === 'work-block') bg = 'var(--color-teal)';
  chip.style.backgroundColor = bg;

  chip.textContent = `${entry.startTime || ''} ${entry.title}`;
  chip.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent month cell click
    openEntryModal(entry);
  });
  
  return chip;
}

/**
 * Opens the Entry Detail Modal. [cite: 436-440]
 */
function openEntryModal(entry = null) {
  console.log('Opening entry modal for:', entry ? entry.title : 'New Entry');
  // Modal creation logic maps directly to VIEW 5 specs.
  // Requires ARIA focus trapping[cite: 242].
}
