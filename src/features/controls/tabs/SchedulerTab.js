/**
 * SchedulerTab — Team task scheduler for camp staff.
 * Manages sessions with time-stamped tasks, assignments, and statuses.
 */
export function renderScheduler(container) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('campSchedule')) } catch { return null }
  })()

  const schedule = saved || {
    date: '',
    sessionName: 'Evening Service',
    tasks: [
      { id: '1', time: '18:00', task: 'Sound check', person: 'Sound Team', status: 'pending', notes: '' },
      { id: '2', time: '18:30', task: 'Slide setup', person: 'Media Team', status: 'pending', notes: '' },
      { id: '3', time: '19:00', task: 'Worship starts', person: 'Worship Team', status: 'pending', notes: '' },
      { id: '4', time: '19:30', task: 'Announcements', person: 'MC', status: 'pending', notes: '' },
      { id: '5', time: '19:45', task: 'Message', person: 'Speaker', status: 'pending', notes: '' },
      { id: '6', time: '20:30', task: 'Dismissal', person: 'All', status: 'pending', notes: '' },
    ]
  }

  function save() {
    try { localStorage.setItem('campSchedule', JSON.stringify(schedule)) } catch { /* quota */ }
  }

  function statusColor(status) {
    return { pending: '#6b7280', 'in-progress': '#f59e0b', done: '#22c55e', skipped: '#ef4444' }[status] || '#6b7280'
  }

  function borderColor(status) {
    return status === 'done' ? '#22c55e' : status === 'in-progress' ? '#f59e0b' : 'var(--border-color)'
  }

  function esc(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  }

  function render() {
    const taskRows = schedule.tasks.map((task, i) => {
      const statusOpts = ['pending', 'in-progress', 'done', 'skipped']
        .map(s => `<option ${task.status === s ? 'selected' : ''} value="${s}">${s}</option>`)
        .join('')

      return `
        <div class="sched-task" data-idx="${i}" style="background:var(--bg-active);border-radius:6px;padding:8px;border-left:3px solid ${borderColor(task.status)};">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
            <input data-time="${i}" value="${esc(task.time)}" type="time" style="background:transparent;border:none;color:var(--text-secondary);font-size:12px;width:70px;outline:none;" />
            <span style="font-size:12px;padding:2px 6px;border-radius:10px;background:${statusColor(task.status)}33;color:${statusColor(task.status)};font-weight:600;">${task.status}</span>
            <button data-delete="${i}" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;" title="Remove task">&#x2715;</button>
          </div>
          <input data-task="${i}" value="${esc(task.task)}" class="input" style="font-size:12px;font-weight:600;margin-bottom:5px;" placeholder="Task description" />
          <div style="display:flex;gap:4px;align-items:center;">
            <input data-person="${i}" value="${esc(task.person)}" class="input" style="font-size:12px;flex:1;" placeholder="Assigned to" />
            <select data-status="${i}" style="font-size:12px;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:4px;color:var(--text-primary);padding:3px;cursor:pointer;">
              ${statusOpts}
            </select>
          </div>
          <input data-notes="${i}" value="${esc(task.notes)}" class="input" style="font-size:12px;margin-top:5px;" placeholder="Notes (optional)" />
        </div>
      `
    }).join('')

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;padding:2px;">

        <div style="display:flex;gap:6px;align-items:center;">
          <input id="sched-session" value="${esc(schedule.sessionName)}" class="input" style="flex:1;font-size:12px;font-weight:600;" placeholder="Session name" />
          <input id="sched-date" type="date" value="${esc(schedule.date)}" class="input" style="font-size:12px;width:110px;" />
        </div>

        <div id="task-list" style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;">
          ${taskRows || '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:20px;">No tasks yet</div>'}
        </div>

        <button id="add-task" class="btn" style="font-size:12px;width:100%;">+ Add Task</button>

        <div style="display:flex;gap:6px;">
          <button id="sched-reset-all" class="btn" style="flex:1;font-size:12px;">Reset Status</button>
          <button id="sched-export" class="btn btn--primary" style="flex:1;font-size:12px;">Copy Schedule</button>
        </div>
      </div>
    `

    container.querySelector('#sched-session').addEventListener('input', e => {
      schedule.sessionName = e.target.value; save()
    })
    container.querySelector('#sched-date').addEventListener('input', e => {
      schedule.date = e.target.value; save()
    })

    container.querySelectorAll('[data-time]').forEach(el => {
      el.addEventListener('change', () => { schedule.tasks[+el.dataset.time].time = el.value; save(); render() })
    })
    container.querySelectorAll('[data-task]').forEach(el => {
      el.addEventListener('input', () => { schedule.tasks[+el.dataset.task].task = el.value; save() })
    })
    container.querySelectorAll('[data-person]').forEach(el => {
      el.addEventListener('input', () => { schedule.tasks[+el.dataset.person].person = el.value; save() })
    })
    container.querySelectorAll('[data-status]').forEach(el => {
      el.addEventListener('change', () => { schedule.tasks[+el.dataset.status].status = el.value; save(); render() })
    })
    container.querySelectorAll('[data-notes]').forEach(el => {
      el.addEventListener('input', () => { schedule.tasks[+el.dataset.notes].notes = el.value; save() })
    })
    container.querySelectorAll('[data-delete]').forEach(el => {
      el.addEventListener('click', () => {
        schedule.tasks.splice(+el.dataset.delete, 1)
        save(); render()
      })
    })

    container.querySelector('#add-task').addEventListener('click', () => {
      schedule.tasks.push({ id: crypto.randomUUID(), time: '', task: 'New task', person: '', status: 'pending', notes: '' })
      save(); render()
      const list = container.querySelector('#task-list')
      if (list) list.scrollTop = list.scrollHeight
    })

    container.querySelector('#sched-reset-all').addEventListener('click', () => {
      schedule.tasks.forEach(t => { t.status = 'pending' })
      save(); render()
    })

    container.querySelector('#sched-export').addEventListener('click', () => {
      const lines = [`${schedule.sessionName} — ${schedule.date}`, '']
        .concat(schedule.tasks.map(t => `${t.time}  ${t.task}  [${t.person}]  (${t.status})${t.notes ? '  — ' + t.notes : ''}`))
      navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
      const btn = container.querySelector('#sched-export')
      if (btn) {
        btn.textContent = 'Copied!'
        setTimeout(() => { btn.textContent = 'Copy Schedule' }, 2000)
      }
    })
  }

  render()
}
