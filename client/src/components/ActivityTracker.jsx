import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Producer tasks
const PRODUCER_TASKS = [
  { id: 'new_conv',  label: 'New Conversations', type: 'dropdown' },
  { id: 'ghost_5',   label: '5 Ghost Quotes',    points: 3  },
  { id: 'ghost_10',  label: '10 Ghost Quotes',   points: 5  },
  { id: 'referral',  label: 'Referral Received', points: 10, verified: true },
  { id: 'monoline',  label: 'Monoline Sale',      points: 3,  verified: true, isSale: true },
  { id: 'bundle',    label: 'Bundle Sale',         points: 5,  verified: true, isSale: true },
  { id: 'life_app',  label: 'Life App Sent',       points: 5,  verified: true },
  { id: 'life_sale', label: 'Life Sale',            points: 20, verified: true },
];

// Dan's tasks
const DAN_TASKS = [
  { id: 'followup_5',        label: 'Follow-Up Calls (5)',       points: 5  },
  { id: 'followup_10',       label: 'Follow-Up Calls (10)',      points: 10 },
  { id: 'processed_5',       label: 'Policies Processed (5)',    points: 3  },
  { id: 'processed_10',      label: 'Policies Processed (10)',   points: 5  },
  { id: 'customer_review',   label: 'Customer Review Requested', points: 5,  verified: true },
  { id: 'cancellation_saved',label: 'Cancellation Saved',        points: 10, verified: true },
  { id: 'referral_collected',label: 'Referral Collected',        points: 10, verified: true },
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEDALS = ['🥇', '🥈', '🥉'];

function getNewConvPoints(count) {
  const n = Number(count) || 0;
  if (n >= 5) return 15;
  if (n >= 4) return 10;
  if (n >= 3) return 5;
  return 0;
}

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  return m.toISOString().split('T')[0];
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function PersonView({ person, today, onRefresh, kpiData, refreshTick }) {
  const [viewDate, setViewDate] = useState(today);
  const [weekData, setWeekData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [winValue, setWinValue] = useState('');
  const [challengeValue, setChallengeValue] = useState('');
  const [pendingTask, setPendingTask] = useState(null);
  const [clientInput, setClientInput] = useState('');
  const [saleModal, setSaleModal] = useState(null);
  const [premiumInput, setPremiumInput] = useState('');
  const [numPoliciesInput, setNumPoliciesInput] = useState('');
  const [numHouseholdsInput, setNumHouseholdsInput] = useState('');

  const winTimer       = useRef(null);
  const challengeTimer = useRef(null);

  const fetchWeekData = useCallback(async () => {
    try {
      const res = await fetch(`/api/week?date=${viewDate}`);
      setWeekData(await res.json());
    } catch {}
  }, [viewDate]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData, refreshTick]);

  const personData = weekData?.data[person.id];

  useEffect(() => {
    setWinValue(personData?.wins?.[selectedDate] || '');
    setChallengeValue(personData?.challenges?.[selectedDate] || '');
  }, [selectedDate, personData]);

  if (!weekData || !personData) return null;

  const isDan = person.id === 'dan';
  const tasks = isDan ? DAN_TASKS : PRODUCER_TASKS;
  const { weekDates } = weekData;
  const todayTasks = personData.tasks[selectedDate] || {};
  const convCount  = Number(todayTasks['new_conv']) || 0;
  const kpi = kpiData?.data?.[person.id];

  const dayPoints = tasks.reduce((s, t) => {
    if (t.id === 'new_conv') return s + getNewConvPoints(convCount);
    if (!t.points) return s;
    return s + (todayTasks[t.id] ? t.points : 0);
  }, 0);

  const isCurrentWeek = getMonday(viewDate) >= getMonday(today);

  function navigateWeek(dir) {
    const newView = shiftDate(viewDate, dir * 7);
    if (dir > 0 && getMonday(newView) >= getMonday(today)) {
      setViewDate(today);
      setSelectedDate(today);
    } else {
      setViewDate(newView);
      setSelectedDate(shiftDate(selectedDate, dir * 7));
    }
  }

  async function save(url, body, method = 'POST') {
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    onRefresh();
    fetchWeekData();
  }

  async function handleConvChange(value) {
    const count = value ? Number(value) : false;
    await save('/api/task', { person: person.id, taskId: 'new_conv', date: selectedDate, completed: count || false, clientName: null });
  }

  function handleTaskClick(task) {
    if (task.id === 'new_conv') return;
    const done = !!todayTasks[task.id];
    if (!done && task.verified) {
      setPendingTask(task);
      setClientInput('');
    } else if (done) {
      save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: false, clientName: null });
    } else {
      save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: true, clientName: null });
    }
  }

  function confirmVerification() {
    if (!clientInput.trim() || !pendingTask) return;
    if (pendingTask.isSale) {
      setSaleModal({ mode: 'new', task: pendingTask, clientName: clientInput.trim() });
      setPremiumInput(''); setNumPoliciesInput(''); setNumHouseholdsInput('');
      setPendingTask(null); setClientInput('');
    } else {
      save('/api/task', { person: person.id, taskId: pendingTask.id, date: selectedDate, completed: true, clientName: clientInput.trim() });
      setPendingTask(null); setClientInput('');
    }
  }

  function openSaleEdit(task) {
    const details = personData.saleDetails?.[selectedDate]?.[task.id] || {};
    setSaleModal({ mode: 'edit', task });
    setPremiumInput(details.premium ?? '');
    setNumPoliciesInput(details.numPolicies != null ? String(details.numPolicies) : '');
    setNumHouseholdsInput(details.numHouseholds != null ? String(details.numHouseholds) : '');
  }

  async function confirmSaleDetails() {
    if (!saleModal) return;
    const { mode, task, clientName } = saleModal;
    const premium      = premiumInput.trim() || null;
    const numPolicies  = numPoliciesInput.trim()  ? Number(numPoliciesInput)  : null;
    const numHouseholds = numHouseholdsInput.trim() ? Number(numHouseholdsInput) : null;

    if (mode === 'new') {
      await save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: true, clientName, premium, numPolicies, numHouseholds });
    } else {
      await save('/api/sale-details', { person: person.id, taskId: task.id, date: selectedDate, premium, numPolicies, numHouseholds }, 'PATCH');
    }
    setSaleModal(null);
  }

  function handleWinChange(e) {
    const val = e.target.value;
    setWinValue(val);
    clearTimeout(winTimer.current);
    winTimer.current = setTimeout(() => save('/api/daily', { person: person.id, date: selectedDate, win: val }), 600);
  }

  function handleChallengeChange(e) {
    const val = e.target.value;
    setChallengeValue(val);
    clearTimeout(challengeTimer.current);
    challengeTimer.current = setTimeout(() => save('/api/daily', { person: person.id, date: selectedDate, challenge: val }), 600);
  }

  const convGood  = (kpi?.avgConvPerDay ?? 0) >= 3;
  const closeGood = (kpi?.closeRate ?? 0) >= 25;
  const polGood   = kpi?.totalHouseholds > 0 && (kpi?.policiesPerHH ?? 0) >= 1.5;
  const premGood  = (kpi?.premiumPace ?? 0) >= 30000;

  return (
    <div className="activity-body">
      <div className="week-pts-badge">
        <span>{person.name} — Week total:</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{personData.points} pts</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>/ 50 goal</span>
      </div>

      <div className="week-bar">
        <button className="week-nav-btn left" onClick={() => navigateWeek(-1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="day-strip">
          {weekDates.map((date, i) => {
            const dayNum = new Date(date + 'T12:00:00').getDate();
            return (
              <button
                key={date}
                className={`day-btn${date === selectedDate ? ' selected' : ''}${date === today ? ' today' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="day-letter">{DAYS[i]}</span>
                <span className="day-num">{dayNum}</span>
              </button>
            );
          })}
        </div>
        <button className="week-nav-btn right" onClick={() => navigateWeek(1)} disabled={isCurrentWeek}>
          <ChevronRight size={18} />
        </button>
      </div>

      {!isDan && kpi && (
        <div className="producer-kpi-strip">
          <div className="pkpi-card">
            <span className="pkpi-label">Conv / Day</span>
            <span className={`pkpi-value ${convGood ? 'good' : 'bad'}`}>{(kpi.avgConvPerDay).toFixed(1)}</span>
            <span className="pkpi-goal">goal: 3</span>
          </div>
          <div className="pkpi-card">
            <span className="pkpi-label">Close Rate</span>
            <span className={`pkpi-value ${closeGood ? 'good' : 'bad'}`}>{(kpi.closeRate).toFixed(0)}%</span>
            <span className="pkpi-goal">goal: 25%</span>
          </div>
          <div className="pkpi-card">
            <span className="pkpi-label">Pol / HH</span>
            <span className={`pkpi-value ${kpi.totalHouseholds === 0 ? 'neutral' : polGood ? 'good' : 'bad'}`}>
              {kpi.totalHouseholds > 0 ? (kpi.policiesPerHH).toFixed(2) : '—'}
            </span>
            <span className="pkpi-goal">goal: 1.5</span>
          </div>
          <div className="pkpi-card">
            <span className="pkpi-label">Premium</span>
            <span className={`pkpi-value ${premGood ? 'good' : 'bad'}`}>
              ${kpi.totalPremium >= 1000 ? `${(kpi.totalPremium / 1000).toFixed(1)}k` : Math.round(kpi.totalPremium)}
            </span>
            <span className="pkpi-goal">pace ${kpi.premiumPace >= 1000 ? `${(kpi.premiumPace / 1000).toFixed(1)}k` : Math.round(kpi.premiumPace)}</span>
          </div>
        </div>
      )}

      <div className="activity-content">
        <div className="tasks-col">
          <div className="tasks-col-header">
            <span>Daily Tasks</span>
            {dayPoints > 0 && <span className="tasks-pts-today">+{dayPoints} pts today</span>}
          </div>

          {tasks.map(task => {
            if (task.id === 'new_conv') {
              return (
                <div key={task.id} className={`task-item conv-task${convCount > 0 ? ' done' : ''}`}>
                  <div className="task-info">
                    <div className="task-label">{task.label}</div>
                    {convCount > 0 && <div className="task-client">{convCount} recorded</div>}
                  </div>
                  <select className="conv-select" value={convCount || ''} onChange={e => handleConvChange(e.target.value)}>
                    <option value="">—</option>
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="task-pts">+{getNewConvPoints(convCount)}</span>
                </div>
              );
            }

            const done = !!todayTasks[task.id];
            const clientName = personData.clients?.[selectedDate]?.[task.id];
            const hasSaleDetails = done && task.isSale && personData.saleDetails?.[selectedDate]?.[task.id];

            return (
              <button
                key={task.id}
                className={`task-item${done ? ' done' : ''}`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="task-check">
                  <span className="task-check-mark" />
                </div>
                <div className="task-info">
                  <div className="task-label">{task.label}</div>
                  {done && clientName && <div className="task-client">{clientName}</div>}
                </div>
                {hasSaleDetails && (
                  <button
                    className="task-edit-btn"
                    onClick={e => { e.stopPropagation(); openSaleEdit(task); }}
                  >
                    Edit
                  </button>
                )}
                <span className="task-pts">+{task.points}</span>
              </button>
            );
          })}
        </div>

        <div className="daily-col">
          <div className="daily-field">
            <div className="daily-field-label win-label">Win of the Day</div>
            <textarea
              className="daily-textarea"
              placeholder="Biggest win today?"
              value={winValue}
              onChange={handleWinChange}
            />
          </div>
          <div className="daily-field">
            <div className="daily-field-label challenge-label">Challenge of the Day</div>
            <textarea
              className="daily-textarea"
              placeholder="Struggling with something?"
              value={challengeValue}
              onChange={handleChallengeChange}
            />
          </div>
        </div>
      </div>

      {pendingTask && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setPendingTask(null)}>
          <div className="modal">
            <div className="modal-tag">{pendingTask.label}</div>
            <div className="modal-title">Who was this for?</div>
            <input
              className="modal-input"
              type="text"
              placeholder="Client name (required)"
              value={clientInput}
              onChange={e => setClientInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmVerification()}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setPendingTask(null)}>Cancel</button>
              <button className="modal-confirm" onClick={confirmVerification} disabled={!clientInput.trim()}>
                {pendingTask.isSale ? 'Next →' : `Confirm +${pendingTask.points} pts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {saleModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setSaleModal(null)}>
          <div className="modal">
            <div className="modal-tag">
              {saleModal.task.label}{saleModal.mode === 'new' && ` · ${saleModal.clientName}`}
            </div>
            <div className="modal-title">
              {saleModal.mode === 'new' ? `+${saleModal.task.points} pts — Sale Details` : 'Edit Sale Details'}
            </div>
            <div className="modal-field-label">Premium ($)</div>
            <input className="modal-input" type="text" placeholder="e.g. 1,200" value={premiumInput} onChange={e => setPremiumInput(e.target.value)} autoFocus />
            <div className="modal-field-label"># of Policies</div>
            <input className="modal-input" type="number" placeholder="0" value={numPoliciesInput} onChange={e => setNumPoliciesInput(e.target.value)} min="1" />
            <div className="modal-field-label"># of Households</div>
            <input className="modal-input" type="number" placeholder="0" value={numHouseholdsInput} onChange={e => setNumHouseholdsInput(e.target.value)} min="1" />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSaleModal(null)}>Cancel</button>
              <button className="modal-confirm" onClick={confirmSaleDetails}>
                {saleModal.mode === 'new' ? 'Save Sale' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActivityTracker({ people, today, onRefresh, kpiData, refreshTick, weekData }) {
  const ranked = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)
    : people;

  const [activePerson, setActivePerson] = useState(ranked[0]?.id || people[0].id);
  const person = people.find(p => p.id === activePerson) || people[0];

  return (
    <div className="activity-page">
      <div className="activity-producer-tabs">
        {ranked.map((p, i) => (
          <button
            key={p.id}
            className={`producer-tab-btn${activePerson === p.id ? ' active' : ''}`}
            onClick={() => setActivePerson(p.id)}
          >
            <img src={p.photo} alt={p.name} />
            <span className="producer-tab-medal">{MEDALS[i]}</span>
            {p.name}
            {weekData && (
              <span className="tab-pts-badge">{p.points} pts</span>
            )}
          </button>
        ))}
      </div>

      <PersonView
        key={person.id}
        person={person}
        today={today}
        onRefresh={onRefresh}
        kpiData={kpiData}
        refreshTick={refreshTick}
      />
    </div>
  );
}
