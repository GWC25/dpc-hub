// DPC Hub · homepage.js · v1.0 · July 2026

export function initHomepage(container) {
  try {
    container.innerHTML = '';

    const calendarData = window.DPC_DATA?.calendar || [];
    const afiData = window.DPC_DATA?.afi || [];

    const openAfiCount = afiData.filter(afi => afi.status === 'open' || afi.status === 're-opened').length;
    const closedThisMonthCount = afiData.filter(afi => {
      if (afi.status !== 'closed' || !afi.closedAt) return false;
      const closedDate = new Date(afi.closedAt);
      const now = new Date();
      return closedDate.getMonth() === now.getMonth() && closedDate.getFullYear() === now.getFullYear();
    }).length;

    const now = new Date();
    const tasks = calendarData.filter(entry => entry.entryType === 'task' || entry.entryType === 'micro-task');
    const sortedTasks = tasks.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const deadlines14Days = calendarData.filter(entry => {
      if (entry.entryType !== 'deadline') return false;
      const entryDate = new Date(entry.date);
      const diffTime = entryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 14;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    const meetings7Days = calendarData.filter(entry => {
      if (entry.entryType !== 'meeting') return false;
      const entryDate = new Date(entry.date);
      const diffTime = entryDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Top Strip (VIEW 3)
    const topStrip = document.createElement('div');
    topStrip.style.width = '100%';
    topStrip.style.height = '80px';
    topStrip.style.display = 'flex';
    topStrip.style.gap = 'var(--space-lg)';
    topStrip.style.marginBottom = 'var(--space-xl)';
    
    topStrip.innerHTML = `
      <div style="flex: 1; background: var(--color-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: center; padding: 0 var(--space-lg);">
        <span style="font-size: var(--text-sm); color: var(--color-muted);">Open AFI Loops</span>
        <span style="font-size: var(--text-3xl); font-weight: var(--font-bold); color: var(--color-amber);">${openAfiCount}</span>
      </div>
      <div style="flex: 1; background: var(--color-white); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: center; padding: 0 var(--space-lg);">
        <span style="font-size: var(--text-sm); color: var(--color-muted);">Closed this month</span>
        <span style="font-size: var(--text-3xl); font-weight: var(--font-bold); color: var(--color-green);">${closedThisMonthCount}</span>
      </div>
    `;

    // Main Area
    const mainArea = document.createElement('div');
    mainArea.style.display = 'flex';
    mainArea.style.width = '100%';

    // Left Column (62%)
    const leftCol = document.createElement('div');
    leftCol.style.width = '62%';
    leftCol.style.display = 'flex';
    leftCol.style.flexDirection = 'column';

    const jobsHeader = document.createElement('h2');
    jobsHeader.textContent = 'Jobs Board';
    jobsHeader.style.fontSize = 'var(--text-2xl)';
    jobsHeader.style.color = 'var(--color-navy)';
    jobsHeader.style.marginBottom = 'var(--space-md)';
    leftCol.appendChild(jobsHeader);

    const jobsGrid = document.createElement('div');
    jobsGrid.style.display = 'grid';
    jobsGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    jobsGrid.style.gap = 'var(--space-md)';
    jobsGrid.style.marginBottom = 'var(--space-md)';

    sortedTasks.forEach(task => {
      const card = document.createElement('div');
      card.style.backgroundColor = 'var(--color-white)';
      card.style.borderRadius = 'var(--radius-lg)';
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.padding = 'var(--space-lg)';
      card.style.minHeight = '120px';
      card.style.cursor = 'pointer';
      card.tabIndex = 0;

      let dotColor = 'var(--color-blue)'; 
      let ariaStatus = 'Upcoming';
      if (task.status === 'in-progress') { dotColor = 'var(--color-amber)'; ariaStatus = 'In Progress'; }
      else if (task.status === 'overdue') { dotColor = 'var(--color-red)'; ariaStatus = 'Overdue'; }
      else if (task.status === 'complete') { dotColor = 'var(--color-green)'; ariaStatus = 'Complete'; }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${dotColor};" aria-label="Status: ${ariaStatus}"></span>
          <span style="font-size: var(--text-xs); color: var(--color-muted);">${task.date || ''}</span>
        </div>
        <div style="font-size: var(--text-md); font-weight: var(--font-bold); color: var(--color-navy); margin-top: var(--space-sm); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${task.title}
        </div>
        <div style="margin-top: var(--space-sm); display: flex; justify-content: space-between; align-items: flex-end; height: 100%;">
          ${task.areaCode || task.personRefs?.length ? `<span style="font-size: var(--text-xs); background-color: var(--color-teal-lt); color: var(--color-teal); padding: 2px 6px; border-radius: var(--radius-sm);">${task.areaCode || task.personRefs[0]}</span>` : '<span></span>'}
          ${task.projectRef ? `<span style="font-size: var(--text-xs); color: var(--color-muted);">${task.projectRef}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        import('./calendar.js').then(module => module.openEntryModal(task));
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          import('./calendar.js').then(module => module.openEntryModal(task));
        }
      });
      jobsGrid.appendChild(card);
    });
    leftCol.appendChild(jobsGrid);

    const addTaskBtn = document.createElement('button');
    addTaskBtn.textContent = '+ Add task';
    addTaskBtn.style.backgroundColor = 'var(--color-teal)';
    addTaskBtn.style.color = 'var(--color-white)';
    addTaskBtn.style.padding = 'var(--space-sm) var(--space-md)';
    addTaskBtn.style.border = 'none';
    addTaskBtn.style.borderRadius = 'var(--radius-sm)';
    addTaskBtn.style.cursor = 'pointer';
    addTaskBtn.style.alignSelf = 'flex-start';
    addTaskBtn.addEventListener('click', () => {
      import('./calendar.js').then(module => module.openEntryModal({ entryType: 'task' }));
    });
    leftCol.appendChild(addTaskBtn);

    // Right Column (38%)
    const rightCol = document.createElement('div');
    rightCol.style.width = '38%';
    rightCol.style.paddingLeft = 'var(--space-lg)';
    rightCol.style.display = 'flex';
    rightCol.style.flexDirection = 'column';
    rightCol.style.gap = 'var(--space-lg)';

    // Deadlines Panel
    const deadlinesPanel = document.createElement('div');
    deadlinesPanel.style.backgroundColor = 'var(--color-white)';
    deadlinesPanel.style.borderRadius = 'var(--radius-lg)';
    deadlinesPanel.style.boxShadow = 'var(--shadow-sm)';
    deadlinesPanel.style.padding = 'var(--space-lg)';
    deadlinesPanel.style.maxHeight = '300px';
    deadlinesPanel.style.overflowY = 'auto';
    
    let deadlinesHtml = `<h3 style="font-size: var(--text-lg); color: var(--color-navy); margin-bottom: var(--space-md);">Next 14 days — Deadlines</h3><ul style="list-style: none; padding: 0; margin: 0;">`;
    if (deadlines14Days.length === 0) deadlinesHtml += `<li style="color: var(--color-muted); font-size: var(--text-sm);">No upcoming deadlines.</li>`;
    deadlines14Days.forEach(d => {
      const isSoon = (new Date(d.date) - now) / (1000 * 60 * 60 * 24) <= 3;
      const statusColor = isSoon ? 'var(--color-amber)' : 'var(--color-green)';
      deadlinesHtml += `<li style="margin-bottom: var(--space-sm); font-size: var(--text-base); display: flex; align-items: center; gap: var(--space-sm);"><span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColor};" aria-label="Deadline status"></span> ${d.title} <span style="color: var(--color-muted); font-size: var(--text-sm); margin-left: auto;">${d.date}</span></li>`;
    });
    deadlinesHtml += `</ul>`;
    deadlinesPanel.innerHTML = deadlinesHtml;

    // Meetings Panel
    const meetingsPanel = document.createElement('div');
    meetingsPanel.style.backgroundColor = 'var(--color-white)';
    meetingsPanel.style.borderRadius = 'var(--radius-lg)';
    meetingsPanel.style.boxShadow = 'var(--shadow-sm)';
    meetingsPanel.style.padding = 'var(--space-lg)';
    meetingsPanel.style.maxHeight = '300px';
    meetingsPanel.style.overflowY = 'auto';

    let meetingsHtml = `<h3 style="font-size: var(--text-lg); color: var(--color-navy); margin-bottom: var(--space-md);">This week — Meetings</h3><ul style="list-style: none; padding: 0; margin: 0;">`;
    if (meetings7Days.length === 0) meetingsHtml += `<li style="color: var(--color-muted); font-size: var(--text-sm);">No upcoming meetings.</li>`;
    meetings7Days.forEach(m => {
      const dayStr = new Date(m.date).toLocaleDateString('en-GB', { weekday: 'short' });
      meetingsHtml += `<li style="margin-bottom: var(--space-sm); font-size: var(--text-base); display: flex; flex-direction: column; border-left: 2px solid var(--color-blue); padding-left: var(--space-sm);">
        <span style="font-weight: var(--font-bold); color: var(--color-navy);">${dayStr}, ${m.startTime || 'TBD'}</span>
        <span>${m.personRefs?.join(', ') || 'Unnamed'} — ${m.title}</span>
      </li>`;
    });
    meetingsHtml += `</ul>`;
    meetingsPanel.innerHTML = meetingsHtml;

    rightCol.appendChild(deadlinesPanel);
    rightCol.appendChild(meetingsPanel);

    mainArea.appendChild(leftCol);
    mainArea.appendChild(rightCol);

    container.appendChild(topStrip);
    container.appendChild(mainArea);
  } catch (error) {
    console.error("Homepage Init Error:", error);
  }
}
