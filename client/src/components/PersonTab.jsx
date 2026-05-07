import { useState, useEffect, useCallback, useRef } from 'react';
import KPIStrip from './KPIStrip';

function fmt$(n) {
  if (!n) return '$0';
  const num = parseFloat(String(n).replace(/[$,\s]/g, ''));
  if (isNaN(num) || num === 0) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${Math.round(num)}`;
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

const TASKS = [
  { id: 'new_conv',  label: 'New Conversations', type: 'dropdown', verified: false },
  { id: 'ghost_5',   label: '5 Ghost Quotes',    points: 3,  verified: false },
  { id: 'ghost_10',  label: '10 Ghost Quotes',   points: 5,  verified: false },
  { id: 'referral',  label: 'Referral Received', points: 10, verified: true  },
  { id: 'life_app',  label: 'Life App Sent',     points: 5,  verified: true  },
  { id: 'life_sale', label: 'Life Sale',         points: 20, verified: true  },
];

function getNewConvPoints(count) {
  const n = Number(count) || 0;
  if (n >= 5) return 15;
  if (n >= 4) return 10;
  if (n >= 3) return 5;
  return 0;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function PersonTab({ person, today, onRefresh, kpiData, refreshTick }) {
  const [viewDate, setViewDate]   = useState(today);
  const [weekData, setWeekData]   = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [winValue, setWinValue]   = useState('');
  const [challengeValue, setChallengeValue] = useState('');
  const [pendingTask, setPendingTask] = useState(null);
  const [clientInput, setClientInput] = useState('');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [salePremium, setSalePremium]     = useState('');
  const [salePolicies, setSalePolicies]   = useState('');
  const [saleHouseholds, setSaleHouseholds] = useState('');
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
  }, [selectedDate, personData?.wins, personData?.challenges]);

  if (!weekData || !personData) return null;

  const { weekDates } = weekData;
  const todayTasks = personData.tasks[selectedDate] || {};
  const convCount  = Number(todayTasks['new_conv']) || 0;
  const dayPoints  = TASKS.reduce((s, t) => {
    if (t.id === 'new_conv') return s + getNewConvPoints(convCount);
    return s + (todayTasks[t.id] ? t.points : 0);
  }, 0);

  const salesDay = personData.salesDay?.[selectedDate] || null;
  const isCurrentWeek = getMonday(viewDate) >= getMonday(today);
  const dateLabel = selectedDate === today ? "Today's Sales" : `Sales · ${fmtDate(selectedDate)}`;

  function navigateWeek(direction) {
    const newView = shiftDate(viewDate, direction * 7);
    if (direction > 0 && getMonday(newView) >= getMonday(today)) {
      setViewDate(today);
      setSelectedDate(today);
    } else {
      setViewDate(newView);
      setSelectedDate(shiftDate(selectedDate, direction * 7));
    }
  }

  async function save(url, body) {
    await fetch(url, {
      method: 'POST',
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
    const done = todayTasks[task.id] || false;
    if (!done && task.verified) {
      setPendingTask(task);
      setClientInput('');
    } else {
      save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: !done, clientName: null });
    }
  }

  async function confirmVerification() {
    if (!clientInput.trim() || !pendingTask) return;
    await save('/api/task', { person: person.id, taskId: pendingTask.id, date: selectedDate, completed: true, clientName: clientInput.trim() });
    setPendingTask(null);
    setClientInput('');
  }

  function openSalesModal() {
    setSalePremium(salesDay?.premium ?? '');
    setSalePolicies(salesDay?.policies != null ? String(salesDay.policies) : '');
    setSaleHouseholds(salesDay?.households != null ? String(salesDay.households) : '');
    setShowSalesModal(true);
  }

  async function saveSalesDay() {
    await save('/api/sales-day', {
      person: person.id,
      date: selectedDate,
      premium:    salePremium.trim()    || null,
      policies:   salePolicies.trim()   ? Number(salePolicies)   : null,
      households: saleHouseholds.trim() ? Number(saleHouseholds) : null,
    });
    setShowSalesModal(false);
  }

  function handleWinChange(e) {
    const val = e.target.value;
    setWinValue(val);
    clearTimeout(winTimer.current);
    winTimer.current = setTimeout(() => {
      save('/api/daily', { person: person.id, date: selectedDate, win: val });
    }, 600);
  }

  function handleChallengeChange(e) {
    const val = e.target.value;
    setChallengeValue(val);
    clearTimeout(challengeTimer.current);
    challengeTimer.current = setTimeout(() => {
      save('/api/daily', { person: person.id, date: selectedDate, challenge: val });
    }, 600);
  }

  return (
    <div className="person-tab">
      {/* Header */}
      <div className="person-header">
        <img src={person.photo} alt={person.name} className="person-avatar-photo" />
        <div className="person-info">
          <div className="person-name">{person.name.toUpperCase()}</div>
          <div className="person-role">{person.role}</div>
        </div>
        <div className="person-pts-block">
          <span className="person-pts-num">{personData.points}</span>
          <span className="person-pts-label">pts / week</span>
        </div>
      </div>

      {/* KPI strip — producers only */}
      {person.role === 'Producer' && (
        <KPIStrip kpi={kpiData?.data?.[person.id]} hero />
      )}

      {/* Date strip with week navigation */}
      <div className="date-strip-wrap">
        <button className="week-nav-btn" onClick={() => navigateWeek(-1)}>‹</button>
        <div className="date-selector">
          {weekDates.map((date, i) => {
            const dayNum = new Date(date + 'T12:00:00').getDate();
            return (
              <button
                key={date}
                className={`date-btn ${date === selectedDate ? 'selected' : ''} ${date === today ? 'today' : ''}`}
                onClick={() => setSelectedDate(date)}
              >
                <span className="day-name">{DAYS[i]}</span>
                <span className="day-num">{dayNum}</span>
              </button>
            );
          })}
        </div>
        <button className="week-nav-btn week-nav-right" onClick={() => navigateWeek(1)} disabled={isCurrentWeek}>›</button>
      </div>

      {/* Today's Sales card — producers only */}
      {person.role === 'Producer' && (
        <div className={`sales-day-card ${salesDay ? 'has-data' : ''}`} onClick={openSalesModal}>
          <div className="sdc-top">
            <span className="sdc-label">{dateLabel}</span>
            <span className="sdc-edit-hint">{salesDay ? 'Edit' : 'Log →'}</span>
          </div>
          {salesDay ? (
            <div className="sdc-values">
              <div className="sdc-stat">
                <span className="sdc-num">{fmt$(salesDay.premium)}</span>
                <span className="sdc-unit">premium</span>
              </div>
              <div className="sdc-divider" />
              <div className="sdc-stat">
                <span className="sdc-num">{salesDay.policies ?? 0}</span>
                <span className="sdc-unit">policies</span>
              </div>
              <div className="sdc-divider" />
              <div className="sdc-stat">
                <span className="sdc-num">{salesDay.households ?? 0}</span>
                <span className="sdc-unit">households</span>
              </div>
            </div>
          ) : (
            <div className="sdc-empty">Tap to log premium, policies &amp; households</div>
          )}
        </div>
      )}

      {/* Two-column content */}
      <div className="tab-content">

        {/* Left: Tasks */}
        <div className="col-left">
          <div className="col-label">
            Tasks
            {dayPoints > 0 && (
              <span style={{ float: 'right', color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                +{dayPoints} pts
              </span>
            )}
          </div>
          {TASKS.map(task => {
            if (task.id === 'new_conv') {
              return (
                <div key={task.id} className={`task-item task-conv ${convCount > 0 ? 'done' : ''}`}>
                  <div className="task-label-wrap">
                    <span className="task-label">{task.label}</span>
                    {convCount > 0 && <span className="task-client">{convCount} recorded</span>}
                  </div>
                  <select
                    className="conv-select"
                    value={convCount || ''}
                    onChange={e => handleConvChange(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                  <span className="task-pts">+{getNewConvPoints(convCount)}</span>
                </div>
              );
            }

            const done = todayTasks[task.id] || false;
            const clientName = personData.clients?.[selectedDate]?.[task.id];
            return (
              <button
                key={task.id}
                className={`task-item ${done ? 'done' : ''} ${task.verified ? 'verified' : ''}`}
                onClick={() => handleTaskClick(task)}
              >
                <div className="task-check-box">
                  <span className="check-mark" />
                </div>
                <div className="task-label-wrap">
                  <span className="task-label">{task.label}</span>
                  {done && clientName && <span className="task-client">{clientName}</span>}
                </div>
                <span className="task-pts">+{task.points}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Win + Challenge */}
        <div className="col-right">
          <div className="daily-field win-field">
            <div className="daily-label win-label">Win</div>
            <textarea
              className="daily-input"
              placeholder="Biggest win today?"
              value={winValue}
              onChange={handleWinChange}
            />
          </div>
          <div className="daily-field challenge-field">
            <div className="daily-label challenge-label">Challenge</div>
            <textarea
              className="daily-input"
              placeholder="Struggling with?"
              value={challengeValue}
              onChange={handleChallengeChange}
            />
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {pendingTask && (
        <div className="verify-overlay" onClick={e => e.target === e.currentTarget && setPendingTask(null)}>
          <div className="verify-modal">
            <div className="verify-task-name">{pendingTask.label}</div>
            <div className="verify-title">Who was this for?</div>
            <input
              className="verify-input"
              type="text"
              placeholder="Client name (required)"
              value={clientInput}
              onChange={e => setClientInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmVerification()}
              autoFocus
            />
            <div className="verify-actions">
              <button className="verify-cancel" onClick={() => setPendingTask(null)}>Cancel</button>
              <button className="verify-confirm" onClick={confirmVerification} disabled={!clientInput.trim()}>
                Confirm +{pendingTask.points} pts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Sales Modal */}
      {showSalesModal && (
        <div className="verify-overlay" onClick={e => e.target === e.currentTarget && setShowSalesModal(false)}>
          <div className="verify-modal">
            <div className="verify-task-name">{fmtDate(selectedDate)}</div>
            <div className="verify-title">{dateLabel}</div>
            <input
              className="verify-input"
              type="text"
              placeholder="Premium amount (e.g. $1,200)"
              value={salePremium}
              onChange={e => setSalePremium(e.target.value)}
              autoFocus
            />
            <input
              className="verify-input"
              type="number"
              placeholder="Number of policies"
              value={salePolicies}
              onChange={e => setSalePolicies(e.target.value)}
              min="0"
            />
            <input
              className="verify-input"
              type="number"
              placeholder="Number of households"
              value={saleHouseholds}
              onChange={e => setSaleHouseholds(e.target.value)}
              min="0"
            />
            <div className="verify-actions">
              <button className="verify-cancel" onClick={() => setShowSalesModal(false)}>Cancel</button>
              <button className="verify-confirm" onClick={saveSalesDay}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
