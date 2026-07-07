// DPC Hub · homepage.js · v1.0 · July 2026

/**
 * Initializes the Homepage module and mounts it to the provided container.
 * @param {HTMLElement} container - The DOM node to inject the homepage content.
 */
export function initHomepage(container) {
  try {
    container.innerHTML = ''; // Clear container

    // Retrieve data safely, falling back to empty arrays if missing [cite: 142]
    const calendarData = window.DPC_DATA?.calendar?.entries || [];
    const afiData = window.DPC_DATA?.afi || [];

    // Calculate Metrics
    const openAfiCount = afiData.filter(afi => afi.status === 'open' || afi.status === 'in-progress').length;
    const closedThisMonthCount = afiData.filter(afi => {
      if (afi.status !== 'closed' || !afi.closedAt) return false;
      const closedDate = new Date(afi.closedAt);
      const now = new Date();
      return closedDate.getMonth() === now.getMonth() && closedDate.getFullYear() === now.getFullYear();
    }).length;

    // Filter Calendar Data
    const now = new Date();
    const tasks = calendarData.filter(entry => entry.entryType === 'task' || entry.entryType === 'micro-task');
    const sortedTasks = tasks.sort((a, b) => new Date(a.date) - new Date(b.date)); [cite: 191]
    
    const deadlines14Days = calendarData.filter(entry => {
      if (entry.entryType !== 'deadline') return false;
      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(entryDate - now);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 14 && entryDate >= now;
    });

    const meetings7Days = calendarData.filter(entry => {
      if (entry.entryType !== 'meeting') return false;
      const entryDate = new Date(entry.date);
      const diffTime = Math.abs(entryDate - now);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && entryDate >= now;
    });

    // Build Layout [cite: 413-419]
    const topStrip = document.createElement('div');
    topStrip.className = 'homepage-top-strip';
    topStrip.innerHTML = `
      <div class="metric-panel">
        <span class="metric-label" style="color: var(--color-amber);">Open AFI Loops</span>
        <span class="metric-value" style="color: var(--color-amber);">${openAfiCount}</span>
      </div>
      <div class="metric-panel">
        <span class="metric-label" style="color: var(--color-green);">Closed this month</span>
        <span class="metric-value" style="color: var(--color-green);">${closedThisMonthCount}</span>
      </div>
    `;

    const mainArea = document.createElement('div');
    mainArea.className = 'homepage-main-area';

    // Left Column: Jobs Board [cite: 415]
    const leftCol = document.createElement('div');
    leftCol.className = 'homepage-left-col';
    leftCol.innerHTML = `<h2 style="font-size: var(--text-2xl); color: var(--color-navy);">Jobs Board</h2>`;
    
    const jobsGrid = document.createElement('div');
    jobsGrid.className = 'jobs-grid'; // Masonry style applied in CSS
    
    sortedTasks.forEach(task => {
      const postIt = createPostItCard(task);
      jobsGrid.appendChild(postIt);
    });
    
    leftCol.appendChild(jobsGrid);

    const addTaskBtn = document.createElement('button');
    addTaskBtn.className = 'btn-primary';
    addTaskBtn.style.backgroundColor = 'var(--color-teal)';
    addTaskBtn.style.color = 'var(--color-white)';
    addTaskBtn.style.borderRadius = 'var(--radius-sm)';
    addTaskBtn.textContent = '+ Add task';
    addTaskBtn.setAttribute('aria-label', 'Add a new task to the Jobs Board');
    addTaskBtn.addEventListener('click', () => openTaskModal()); [cite: 191]
    leftCol.appendChild(addTaskBtn);

    // Right Column: Deadlines and Meetings [cite: 416-418]
    const rightCol = document.createElement('div');
    rightCol.className = 'homepage-right-col';
    
    const deadlinesPanel = document.createElement('div');
    deadlinesPanel.className = 'panel-stacked';
    deadlinesPanel.innerHTML = `<h3 style="font-size: var(--text-lg); color: var(--color-navy);">Next 14 days — Deadlines</h3>`;
    const deadlineList = document.createElement('ul');
    deadlines14Days.forEach(d => {
      const li = document.createElement('li');
      const statusColor = new Date(d.date) < now ? 'var(--color-red)' : 'var(--color-green)';
      li.innerHTML = `<span class="status-dot" style="background-color: ${statusColor};" aria-label="Deadline status"></span> ${d.title} - ${d.date}`;
      deadlineList.appendChild(li);
    });
    deadlinesPanel.appendChild(deadlineList);

    const meetingsPanel = document.createElement('div');
    meetingsPanel.className = 'panel-stacked';
    meetingsPanel.innerHTML = `<h3 style="font-size: var(--text-lg); color: var(--color-navy);">This week — Meetings</h3>`;
    const meetingList = document.createElement('ul');
    meetings7Days.forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${new Date(m.date).toLocaleDateString('en-GB', {weekday: 'short'})} ${m.startTime || ''} - ${m.title}`;
      meetingList.appendChild(li);
    });
    meetingsPanel.appendChild(meetingList);

    rightCol.appendChild(deadlinesPanel);
    rightCol.appendChild(meetingsPanel);

    mainArea.appendChild(leftCol);
    mainArea.appendChild(rightCol);

    container.appendChild(topStrip);
    container.appendChild(mainArea);
  } catch (error) {
    console.error("Homepage Init Error:", error); [cite: 137]
    container.innerHTML = `<p style="color: var(--color-red);">Unable to load homepage data. Please try refreshing.</p>`; [cite: 138]
  }
}

/**
 * Creates a post-it card DOM element based on task data.
 * @param {Object} task - The task data object.
 * @returns {HTMLElement} - The constructed post-it card.
 */
function createPostItCard(task) {
  const card = document.createElement('div');
  card.className = 'post-it-card';
  // Style according to spec [cite: 421]
  card.style.backgroundColor = 'var(--color-white)';
  card.style.borderRadius = 'var(--radius-lg)';
  card.style.boxShadow = 'var(--shadow-sm)';
  card.style.padding = 'var(--space-lg)';
  card.style.minHeight = '120px';
  card.style.cursor = 'pointer';
  card.setAttribute('tabindex', '0'); // Accessibility [cite: 130]

  let dotColor = 'var(--color-blue)'; // Default upcoming
  let ariaStatus = 'Upcoming';
  if (task.status === 'in-progress') { dotColor = 'var(--color-amber)'; ariaStatus = 'In Progress'; } [cite: 421]
  else if (task.status === 'overdue') { dotColor = 'var(--color-red)'; ariaStatus = 'Overdue'; }
  else if (task.status === 'complete') { dotColor = 'var(--color-green)'; ariaStatus = 'Complete'; }

  card.innerHTML = `
    <div class="card-header" style="display: flex; justify-content: space-between;">
      <span class="status-dot" style="width: 12px; height: 12px; border-radius: 50%; background-color: ${dotColor};" aria-label="Status: ${ariaStatus}"></span>
      <span class="due-date" style="font-size: var(--text-xs); color: var(--color-muted);">${task.date || 'No Date'}</span>
    </div>
    <div class="card-title" style="font-size: var(--text-md); font-weight: var(--font-bold); color: var(--color-navy); margin-top: var(--space-sm); overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
      ${task.title}
    </div>
    <div class="card-footer" style="margin-top: var(--space-sm); display: flex; justify-content: space-between;">
      ${task.areaCode ? `<span class="tag" style="font-size: var(--text-xs); background-color: var(--color-teal-lt); color: var(--color-teal); padding: 2px 6px; border-radius: var(--radius-sm);">${task.areaCode}</span>` : '<span></span>'}
      ${task.projectRef ? `<span class="project-ref" style="font-size: var(--text-xs); color: var(--color-muted);">${task.projectRef}</span>` : ''}
    </div>
  `;

  // Interaction handlers [cite: 424]
  card.addEventListener('click', () => openTaskModal(task));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openTaskModal(task);
  });

  return card;
}

/**
 * Stub for opening the task detail modal.
 * ARCHITECT QUERY: Full modal implementation crosses into Tasks module scope, providing stub for Phase 2 Seam Test.
 * @param {Object} [task] - Task object if editing, undefined if new.
 */
function openTaskModal(task = null) {
  console.log('Opening task modal for:', task ? task.title : 'New Task');
  // Trigger DOM updates for modal injection here
}
