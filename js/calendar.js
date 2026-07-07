// DPC Hub · calendar.js · v1.0 · July 2026

let currentView = 'week';
let currentDate = new Date();

export function initCalendar(container) {
  try {
    container.innerHTML = '';
    
    // Top Bar (VIEW 4)
    const topBar = document.createElement('div');
    topBar.style.width = '100%';
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.marginBottom = 'var(--space-lg)';

    const navGroup = document.createElement('div');
    navGroup.style.display = 'flex';
    navGroup.style.gap = 'var(--space-sm)';
    
    const btnPrev = document.createElement('button');
    btnPrev.textContent = '<';
    btnPrev.style.border = '1px solid var(--color-border)';
    btnPrev.style.padding = 'var(--space-sm) var(--space-md)';
    btnPrev.style.background = 'var(--color-white)';
    btnPrev.style.borderRadius = 'var(--radius-sm)';
    btnPrev.style.cursor = 'pointer';
    btnPrev.addEventListener('click', () => navigateCalendar(-1, gridContainer));

    const btnToday = document.createElement('button');
    btnToday.textContent = 'Today';
    btnToday.style.border = '1px solid var(--color-border)';
    btnToday.style.padding = 'var(--space-sm) var(--space-md)';
    btnToday.style.background = 'var(--color-white)';
    btnToday.style.borderRadius = 'var(--radius-sm)';
    btnToday.style.cursor = 'pointer';
    btnToday.addEventListener('click', () => {
      currentDate = new Date();
      renderCurrentView(gridContainer);
    });

    const btnNext = document.createElement('button');
    btnNext.textContent = '>';
    btnNext.style.border = '1px solid var(--color-border)';
    btnNext.style.padding = 'var(--space-sm) var(--space-md)';
    btnNext.style.background = 'var(--color-white)';
    btnNext.style.borderRadius = 'var(--radius-sm)';
    btnNext.style.cursor = 'pointer';
    btnNext.addEventListener('click', () => navigateCalendar(1, gridContainer));

    navGroup.appendChild(btnPrev);
    navGroup.appendChild(btnToday);
    navGroup.appendChild(btnNext);

    const viewToggles = document.createElement('div');
    viewToggles.style.display = 'flex';
    ['Week', 'Month', 'Year'].forEach(view => {
      const btn = document.createElement('button');
      btn.textContent = view;
      btn.style.padding = 'var(--space-sm) var(--space-md)';
      btn.style.border = '1px solid var(--color-border)';
      btn.style.cursor = 'pointer';
      
      if (view.toLowerCase() === currentView) {
        btn.style.backgroundColor = 'var(--color-teal)';
        btn.style.color = 'var(--color-white)';
      } else {
        btn.style.backgroundColor = 'var(--color-white)';
        btn.style.color = 'var(--color-navy)';
      }
      
      btn.addEventListener('click', () => {
        currentView = view.toLowerCase();
        initCalendar(container);
      });
      viewToggles.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add entry';
    addBtn.style.backgroundColor = 'var(--color-teal)';
    addBtn.style.color = 'var(--color-white)';
    addBtn.style.padding = 'var(--space-sm) var(--space-md)';
    addBtn.style.border = 'none';
    addBtn.style.borderRadius = 'var(--radius-sm)';
    addBtn.style.cursor = 'pointer';
    addBtn.addEventListener('click', () => openEntryModal());

    topBar.appendChild(navGroup);
    topBar.appendChild(viewToggles);
    topBar.appendChild(addBtn);

    const gridContainer = document.createElement('div');
    gridContainer.style.width = '100%';

    container.appendChild(topBar);
    container.appendChild(gridContainer);

    renderCurrentView(gridContainer);

  } catch (error) {
    console.error("Calendar Init Error:", error);
  }
}

function navigateCalendar(direction, container) {
  if (currentView === 'week') currentDate.setDate(currentDate.getDate() + (direction * 7));
  if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + direction);
  if (currentView === 'year') currentDate.setFullYear(currentDate.getFullYear() + direction);
  renderCurrentView(container);
}

function renderCurrentView(container) {
  container.innerHTML = '';
  const entries = window.DPC_DATA?.calendar || [];

  if (currentView === 'week') renderWeekView(container, entries);
  else if (currentView === 'month') renderMonthView(container, entries);
  else if (currentView === 'year') renderYearView(container, entries);
}

function renderWeekView(container, entries) {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(7, 1fr)';
  container.style.gap = 'var(--space-sm)';

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

    col.innerHTML = `<div style="font-weight: var(--font-bold); text-align: center; margin-bottom: var(--space-md); color: var(--color-navy); padding-bottom: var(--space-sm); border-bottom: 1px solid var(--color-border);">${colDate.toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric'})}</div>`;

    const dayEntries = entries.filter(e => e.date === dateString);
    dayEntries.forEach(entry => {
      col.appendChild(createEventChip(entry));
    });

    container.appendChild(col);
  }
}

function renderMonthView(container, entries) {
  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(7, 1fr)';
  container.style.gap = '1px';
  container.style.backgroundColor = 'var(--color-border)';
  container.style.border = '1px solid var(--color-border)';

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  let startDay = startOfMonth.getDay() || 7; 
  let currentGridDate = new Date(startOfMonth);
  currentGridDate.setDate(currentGridDate.getDate() - (startDay - 1));

  // Render headers
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
    const header = document.createElement('div');
    header.style.backgroundColor = 'var(--color-light)';
    header.style.padding = 'var(--space-sm)';
    header.style.textAlign = 'center';
    header.style.fontWeight = 'var(--font-bold)';
    header.style.fontSize = 'var(--text-sm)';
    header.textContent = day;
    container.appendChild(header);
  });

  for (let i = 0; i < 35; i++) {
    const dateString = currentGridDate.toISOString().split('T')[0];
    const cell = document.createElement('div');
    cell.style.backgroundColor = 'var(--color-white)';
    cell.style.padding = 'var(--space-sm)';
    cell.style.minHeight = '100px';
    
    if (currentGridDate.getMonth() !== currentDate.getMonth()) {
      cell.style.color = 'var(--color-muted)';
      cell.style.backgroundColor = 'var(--color-light)';
    }

    cell.innerHTML = `<div style="text-align: right; font-size: var(--text-sm); margin-bottom: var(--space-sm);">${currentGridDate.getDate()}</div>`;

    const dayEntries = entries.filter(e => e.date === dateString);
    dayEntries.slice(0, 3).forEach(entry => cell.appendChild(createEventChip(entry)));
    
    if (dayEntries.length > 3) {
      const overflow = document.createElement('div');
      overflow.textContent = `+ ${dayEntries.length - 3} more`;
      overflow.style.fontSize = 'var(--text-xs)';
      overflow.style.color = 'var(--color-teal)';
      overflow.style.cursor = 'pointer';
      overflow.style.marginTop = '2px';
      cell.appendChild(overflow);
    }

    container.appendChild(cell);
    currentGridDate.setDate(currentGridDate.getDate() + 1);
  }
}

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
    monthBox.style.backgroundColor = 'var(--color-white)';
    
    const monthName = new Date(year, i, 1).toLocaleDateString('en-GB', {month: 'long'});
    monthBox.innerHTML = `<h4 style="color: var(--color-navy); margin-bottom: var(--space-sm);">${monthName}</h4>`;
    
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
      currentView = 'month';
      initCalendar(document.querySelector('#calendar-grid-container').parentElement);
    });
    
    container.appendChild(monthBox);
  }
}

function createEventChip(entry) {
  const chip = document.createElement('div');
  chip.style.padding = '4px 6px';
  chip.style.marginBottom = '4px';
  chip.style.borderRadius = 'var(--radius-sm)';
  chip.style.fontSize = 'var(--text-xs)';
  chip.style.color = 'var(--color-white)';
  chip.style.cursor = 'pointer';
  chip.style.whiteSpace = 'nowrap';
  chip.style.overflow = 'hidden';
  chip.style.textOverflow = 'ellipsis';
  chip.tabIndex = 0;

  let bg = 'var(--color-blue)'; 
  if (entry.entryType === 'task') bg = 'var(--color-amber)';
  if (entry.entryType === 'deadline') bg = 'var(--color-red)';
  if (entry.entryType === 'work-block') bg = 'var(--color-teal)';
  chip.style.backgroundColor = bg;

  chip.textContent = `${entry.startTime || ''} ${entry.title || 'Untitled'}`.trim();
  
  chip.addEventListener('click', (e) => {
    e.stopPropagation(); 
    openEntryModal(entry);
  });
  
  return chip;
}

// VIEW 5 — Calendar Entry Detail (modal)
export function openEntryModal(entry = null) {
  const isNew = !entry || !entry.entryId;
  const currentEntry = entry || {
    entryId: crypto.randomUUID(),
    entryType: 'meeting',
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    personRefs: [],
    areaCode: '',
    projectRef: '',
    notes: ''
  };

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'var(--color-overlay)';
  overlay.style.zIndex = 'var(--z-modal)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  
  const modal = document.createElement('div');
  modal.style.width = '600px';
  modal.style.backgroundColor = 'var(--color-white)';
  modal.style.borderRadius = 'var(--radius-lg)';
  modal.style.boxShadow = 'var(--shadow-lg)';
  modal.style.padding = 'var(--space-xl)';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = 'var(--space-md)';
  
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  let typeBadgeColor = 'var(--color-blue)';
  if (currentEntry.entryType === 'task') typeBadgeColor = 'var(--color-amber)';
  if (currentEntry.entryType === 'deadline') typeBadgeColor = 'var(--color-red)';
  if (currentEntry.entryType === 'work-block') typeBadgeColor = 'var(--color-teal)';

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <span style="background-color: ${typeBadgeColor}; color: var(--color-white); padding: 2px 8px; border-radius: var(--radius-sm); font-size: var(--text-xs); text-transform: uppercase;">${currentEntry.entryType}</span>
        <input type="text" id="modal-title" value="${currentEntry.title}" placeholder="Entry Title" style="display: block; margin-top: var(--space-sm); font-size: var(--text-xl); font-weight: var(--font-bold); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: var(--space-sm); width: 100%;">
      </div>
      <button id="modal-close" style="background: none; border: none; font-size: var(--text-xl); cursor: pointer;" aria-label="Close modal">×</button>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md);">
      <div>
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Date</label>
        <input type="date" id="modal-date" value="${currentEntry.date}" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
      </div>
      <div>
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Time</label>
        <input type="time" id="modal-time" value="${currentEntry.startTime || ''}" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
      </div>
      <div>
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Person(s)</label>
        <input type="text" id="modal-person" value="${currentEntry.personRefs?.join(', ') || ''}" placeholder="Staff Name" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
      </div>
      <div>
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Area Code</label>
        <input type="text" id="modal-area" value="${currentEntry.areaCode || ''}" placeholder="e.g. BUI" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
      </div>
      <div style="grid-column: span 2;">
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Project / Reference</label>
        <input type="text" id="modal-project" value="${currentEntry.projectRef || ''}" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm);">
      </div>
      <div style="grid-column: span 2;">
        <label style="font-size: var(--text-sm); color: var(--color-muted);">Notes</label>
        <textarea id="modal-notes" rows="4" style="width: 100%; padding: var(--space-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-family); resize: vertical;">${currentEntry.notes || ''}</textarea>
      </div>
    </div>
    
    <div style="display: flex; justify-content: space-between; margin-top: var(--space-md);">
      ${!isNew ? `<button id="modal-delete" style="background-color: var(--color-red); color: var(--color-white); border: none; padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); cursor: pointer;">Delete</button>` : `<div></div>`}
      <div style="display: flex; gap: var(--space-sm);">
        ${currentEntry.entryType === 'meeting' ? `<button id="modal-open-meeting" style="background-color: var(--color-white); color: var(--color-teal); border: 1px solid var(--color-teal); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); cursor: pointer;">Open in Meetings tab</button>` : ''}
        <button id="modal-save" style="background-color: var(--color-teal); color: var(--color-white); border: none; padding: var(--space-sm) var(--space-md); border-radius: var(--radius-sm); cursor: pointer;">Save</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeModal = () => document.body.removeChild(overlay);

  overlay.querySelector('#modal-close').addEventListener('click', closeModal);
  
  if (currentEntry.entryType === 'meeting') {
    const meetingBtn = overlay.querySelector('#modal-open-meeting');
    if (meetingBtn) {
      meetingBtn.addEventListener('click', () => {
        closeModal();
        console.log("Opening Meetings Tab for:", currentEntry.entryId);
        // Dispatch event or call app router logic here in future phases
      });
    }
  }

  if (!isNew) {
    overlay.querySelector('#modal-delete').addEventListener('click', () => {
      window.DPC_DATA.calendar = window.DPC_DATA.calendar.filter(e => e.entryId !== currentEntry.entryId);
      closeModal();
      const currentAppView = document.querySelector('.calendar-top-bar') ? 'calendar' : 'home';
      if (currentAppView === 'calendar') initCalendar(document.querySelector('#calendar-grid-container').parentElement);
      else import('./homepage.js').then(m => m.initHomepage(document.querySelector('.homepage-main-area').parentElement));
    });
  }

  overlay.querySelector('#modal-save').addEventListener('click', () => {
    currentEntry.title = overlay.querySelector('#modal-title').value;
    currentEntry.date = overlay.querySelector('#modal-date').value;
    currentEntry.startTime = overlay.querySelector('#modal-time').value;
    currentEntry.personRefs = [overlay.querySelector('#modal-person').value].filter(Boolean);
    currentEntry.areaCode = overlay.querySelector('#modal-area').value;
    currentEntry.projectRef = overlay.querySelector('#modal-project').value;
    currentEntry.notes = overlay.querySelector('#modal-notes').value;

    if (!window.DPC_DATA.calendar) window.DPC_DATA.calendar = [];
    
    if (isNew) {
      window.DPC_DATA.calendar.push(currentEntry);
    } else {
      const idx = window.DPC_DATA.calendar.findIndex(e => e.entryId === currentEntry.entryId);
      if (idx > -1) window.DPC_DATA.calendar[idx] = currentEntry;
    }

    closeModal();
    
    const currentAppView = document.querySelector('.calendar-top-bar') ? 'calendar' : 'home';
    if (currentAppView === 'calendar') initCalendar(document.querySelector('#calendar-grid-container').parentElement);
    else import('./homepage.js').then(m => m.initHomepage(document.querySelector('.homepage-main-area').parentElement));
  });
}
