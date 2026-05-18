import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEDALS = ['🥇', '🥈', '🥉'];
const WEEKLY_GOAL = 300;
const MINI_COLORS = ['#FFB800', '#CC0000', '#8B9BC1'];

const PRODUCER_TASK_GROUPS = [
  {
    id: 'activity',
    label: 'Activity',
    tasks: [
      { id: 'new_conv', label: 'New Conversations', points: 0, readOnly: true },
      { id: 'followup_dials', label: '30 Follow-Up Dials', points: 10 },
    ],
  },
  {
    id: 'life',
    label: 'Life',
    tasks: [
      { baseId: 'life_app_out', label: 'Life App Out', points: 10, slots: 3 },
      { baseId: 'life_app_back', label: 'Life App Back', points: 20, slots: 3, revenueType: 'life_app_back' },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    tasks: [
      { baseId: 'sale', label: 'Sale', points: 20, slots: 3, revenueType: 'sale' },
      { baseId: 'onboarding_scheduled', label: 'Onboarding Scheduled', points: 5, slots: 3 },
      { baseId: 'referral_received', label: 'Referral Received', points: 20, slots: 3 },
    ],
  },
];

const DAN_TASKS = [
  { id: 'check_vm', label: 'Check VM', points: 2 },
  { id: 'ffq_morning', label: 'FFQ Morning Check', points: 1 },
  { id: 'ffq_afternoon', label: 'FFQ Afternoon Check', points: 1 },
  { id: 'birthday_texts', label: 'Birthday Texts', points: 2 },
  { id: 'farmers_alerts_cleaned', label: 'Farmers Alerts Cleaned Up', points: 5 },
  { id: 'bw_alerts_cleaned', label: 'BW Alerts Checked and Cleaned Up', points: 5 },
  { id: 'returns_completed', label: 'Returns Completed', points: 5 },
  { id: 'add_sales_to_onboard', label: 'Add New Sales to Onboard Tab', points: 5 },
  { id: 'got_past_due_payment', label: 'Got Payment from Past Due Policy', points: 10 },
  { id: 'completed_onboarding', label: 'Completed an Onboarding', points: 5 },
  { id: 'dan_referral_received', label: 'Referral Received', points: 20 },
  { id: 'cross_sell_opportunity', label: 'Cross-Sell Opportunity', points: 20 },
];

const MISSED_CALL_OPTIONS = [
  { value: 'two', label: 'Missed 2 calls', points: 3 },
  { value: 'one', label: 'Missed 1 call', points: 5 },
  { value: 'zero', label: 'Missed zero calls', points: 10 },
];

function MiniRaceTrack({ weekData, allPeople }) {
  const ranked = [...allPeople]
    .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
    .sort((a, b) => b.points - a.points);

  return (
    <div className="mini-race">
      <div className="mini-race-title">Weekly Race — {WEEKLY_GOAL} pt goal</div>
      {ranked.map((person, i) => {
        const pct = Math.min(person.points / WEEKLY_GOAL, 1);
        const color = MINI_COLORS[i] || '#8B9BC1';
        const carLeft = Math.max(2, Math.min(pct * 100, 97));
        return (
          <div key={person.id} className="mini-race-lane">
            <div className="mini-race-person">
              <img src={person.racePhoto || person.photo} alt={person.name} />
              {person.name}
            </div>
            <div className="mini-race-track-wrap">
              <div className="mini-race-track-bg">
                <div className="mini-race-fill" style={{ width: `${pct * 100}%`, background: color, opacity: 0.3 }} />
              </div>
              <div className="mini-race-car" style={{ left: `${carLeft}%` }}>
                <img src={person.racePhoto || person.photo} alt="" className="mini-car-bobble" />
                <div className="mini-car-body" style={{ background: color }}>
                  <div className="mini-car-wheel left" />
                  <div className="mini-car-wheel right" />
                </div>
              </div>
            </div>
            <div className="mini-race-pts" style={{ color }}>
              {person.points} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getNewConvPoints(count) {
  const n = Number(count) || 0;
  if (n >= 4) return 20;
  if (n >= 3) return 10;
  if (n >= 2) return 5;
  return 0;
}

function getMissedCallsPoints(value) {
  return MISSED_CALL_OPTIONS.find(o => o.value === value)?.points || 0;
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

function RevenueModal({ task, onCancel, onSave }) {
  const [clientName, setClientName] = useState('');
  const [premium, setPremium] = useState('');
  const [policies, setPolicies] = useState('');
  const [saleType, setSaleType] = useState('new_household');
  const isSale = task.revenueType === 'sale';
  const needsClient = task.revenueType === 'life_app_back';

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-tag">{task.label}</div>
        <div className="modal-title">Production Details</div>
        {needsClient && (
          <>
            <div className="modal-field-label">Client Name</div>
            <input className="modal-input" type="text" placeholder="Client full name" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus />
          </>
        )}
        <div className="modal-field-label">Premium Sold ($)</div>
        <input className="modal-input" type="text" placeholder="e.g. 1200" value={premium} onChange={e => setPremium(e.target.value)} autoFocus={!needsClient} />
        <div className="modal-field-label">Policies Sold</div>
        <input className="modal-input" type="number" min="0" placeholder="0" value={policies} onChange={e => setPolicies(e.target.value)} />
        {isSale && (
          <>
            <div className="modal-field-label">Sale Type</div>
            <select className="modal-input" value={saleType} onChange={e => setSaleType(e.target.value)}>
              <option value="new_household">New Household</option>
              <option value="cross_sell">Cross-Sell</option>
            </select>
          </>
        )}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="modal-confirm"
            onClick={() => onSave({ clientName, premium, numPolicies: policies ? Number(policies) : 0, saleType })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientNameModal({ task, onCancel, onSave }) {
  const [clientName, setClientName] = useState('');

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-tag">{task.label}</div>
        <div className="modal-title">Client Details</div>
        <div className="modal-field-label">Client Name</div>
        <input
          className="modal-input"
          type="text"
          placeholder="Client full name"
          value={clientName}
          onChange={e => setClientName(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-confirm" onClick={() => onSave({ clientName })}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function slotId(task, slot) {
  return `${task.baseId}_${slot}`;
}

function expandProducerTasks() {
  return PRODUCER_TASK_GROUPS.flatMap(group => group.tasks.flatMap(task => {
    if (!task.slots) return [task];
    return Array.from({ length: task.slots }, (_, index) => ({ ...task, id: slotId(task, index + 1) }));
  }));
}

function PersonView({ person, currentUser, today, onRefresh, kpiData, refreshTick, allPeople }) {
  const [viewDate, setViewDate] = useState(today);
  const [weekData, setWeekData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [winValue, setWinValue] = useState('');
  const [challengeValue, setChallengeValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [revenueTask, setRevenueTask] = useState(null);
  const [clientTask, setClientTask] = useState(null);

  const winTimer = useRef(null);
  const challengeTimer = useRef(null);
  const feedbackTimer = useRef(null);

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
    setFeedbackValue(personData?.feedback?.[selectedDate] || '');
  }, [selectedDate, personData]);

  if (!weekData || !personData) return null;

  const isDan = person.id === 'dan';
  const canEdit = currentUser?.role === 'admin' || currentUser?.producer === person.id;
  const { weekDates } = weekData;
  const todayTasks = personData.tasks[selectedDate] || {};
  const dayLog = weekData.activityLog?.[selectedDate] || [];
  const convCount = Number(todayTasks.new_conv) || 0;
  const kpi = kpiData?.data?.[person.id];
  const missedCallsValue = todayTasks.missed_calls || '';

  const producerTasks = expandProducerTasks();
  const dayPoints = isDan
    ? DAN_TASKS.reduce((sum, task) => sum + (todayTasks[task.id] ? task.points : 0), 0) + getMissedCallsPoints(missedCallsValue)
    : producerTasks.reduce((sum, task) => {
        if (task.id === 'new_conv') return sum + getNewConvPoints(convCount);
        return sum + (todayTasks[task.id] ? task.points : 0);
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
    if (!canEdit) return;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    onRefresh();
    fetchWeekData();
  }

  function handleTaskToggle(task) {
    if (!canEdit) return;
    if (task.readOnly) return;
    const done = !!todayTasks[task.id];
    if (done) {
      save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: false, clientName: null });
      return;
    }
    if (task.revenueType) {
      setRevenueTask(task);
      return;
    }
    if (/^life_app_out_\d+$/.test(task.id) || /^referral_received_\d+$/.test(task.id)) {
      setClientTask(task);
      return;
    }
    save('/api/task', { person: person.id, taskId: task.id, date: selectedDate, completed: true, clientName: null });
  }

  function handleRevenueSave(details) {
    if (!canEdit) return;
    if (!revenueTask) return;
    const saleType = revenueTask.revenueType === 'sale' ? details.saleType || 'new_household' : null;
    save('/api/task', {
      person: person.id,
      taskId: revenueTask.id,
      date: selectedDate,
      completed: true,
      clientName: details.clientName || null,
      premium: details.premium,
      numPolicies: details.numPolicies,
      saleType,
    });
    setRevenueTask(null);
  }

  function handleClientTaskSave(details) {
    if (!canEdit) return;
    if (!clientTask) return;
    save('/api/task', {
      person: person.id,
      taskId: clientTask.id,
      date: selectedDate,
      completed: true,
      clientName: details.clientName || '',
    });
    setClientTask(null);
  }

  function handleMissedCallsChange(value) {
    if (!canEdit) return;
    save('/api/task', { person: person.id, taskId: 'missed_calls', date: selectedDate, completed: value, clientName: null });
  }

  function handleWinChange(e) {
    if (!canEdit) return;
    const val = e.target.value;
    setWinValue(val);
    clearTimeout(winTimer.current);
    winTimer.current = setTimeout(() => save('/api/daily', { person: person.id, date: selectedDate, win: val }), 600);
  }

  function handleChallengeChange(e) {
    if (!canEdit) return;
    const val = e.target.value;
    setChallengeValue(val);
    clearTimeout(challengeTimer.current);
    challengeTimer.current = setTimeout(() => save('/api/daily', { person: person.id, date: selectedDate, challenge: val }), 600);
  }

  function handleFeedbackChange(e) {
    if (!canEdit) return;
    const val = e.target.value;
    setFeedbackValue(val);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => save('/api/daily', {
      person: person.id,
      date: selectedDate,
      feedback: val,
    }), 600);
  }

  const convGood = (kpi?.avgConvPerDay ?? 0) >= 3;
  const closeGood = (kpi?.closeRate ?? 0) >= 25;
  const polGood = kpi?.totalHouseholds > 0 && (kpi?.policiesPerHH ?? 0) >= 1.5;
  const premGood = (kpi?.premiumPace ?? 0) >= 30000;

  return (
    <div className="activity-body">
      <div className="week-pts-badge">
        <span>{person.name} - Week total:</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{personData.points} pts</span>
        <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>/ {WEEKLY_GOAL} visual goal</span>
        {!canEdit && <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontWeight: 600 }}>View only</span>}
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
              {kpi.totalHouseholds > 0 ? (kpi.policiesPerHH).toFixed(2) : '--'}
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

      {weekData && allPeople && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <MiniRaceTrack weekData={weekData} allPeople={allPeople} />
        </div>
      )}

      <div className="activity-content">
        <div className="tasks-col">
          <div className="tasks-col-header">
            <span>{isDan ? 'CSR Tasks' : 'Producer Tasks'}</span>
            {dayPoints > 0 && <span className="tasks-pts-today">+{dayPoints} pts today</span>}
          </div>

          {isDan ? (
            <>
              {DAN_TASKS.map(task => {
                const done = !!todayTasks[task.id];
                return (
                  <button key={task.id} className={`task-item${done ? ' done' : ''}`} onClick={() => handleTaskToggle(task)} disabled={!canEdit}>
                    <div className="task-check"><span className="task-check-mark" /></div>
                    <div className="task-info"><div className="task-label">{task.label}</div></div>
                    <span className="task-pts">+{task.points}</span>
                  </button>
                );
              })}
              <div className="task-group">
                <div className="task-group-title">
                  <span>Missed Calls</span>
                  <small className="missed-call-helper">Goal: no more than 2 missed calls per day.</small>
                </div>
                <div className="missed-call-options">
                  {MISSED_CALL_OPTIONS.map(option => (
                    <label key={option.value} className={`missed-call-option${missedCallsValue === option.value ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name={`missed-calls-${person.id}-${selectedDate}`}
                        value={option.value}
                        checked={missedCallsValue === option.value}
                        onChange={() => handleMissedCallsChange(option.value)}
                        disabled={!canEdit}
                      />
                      <span>{option.label}</span>
                      <strong>+{option.points}</strong>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            PRODUCER_TASK_GROUPS.map(group => (
              <div className="task-group" key={group.id}>
                <div className="task-group-title">
                  <span>{group.label}</span>
                  {group.id === 'activity' && <small>Send Suite controls conversations</small>}
                </div>
                {group.tasks.map(task => {
                  if (task.id === 'new_conv') {
                    return (
                      <div key={task.id} className={`task-item conv-task${convCount > 0 ? ' done' : ''}`}>
                        <div className="task-info">
                          <div className="task-label">{task.label}</div>
                          <div className="task-client">Auto-counted from 8+ minute Send Suite calls</div>
                        </div>
                        <span className="readonly-count">{convCount}</span>
                        <span className="task-pts">+{getNewConvPoints(convCount)}</span>
                      </div>
                    );
                  }

                  if (task.slots) {
                    const checkedCount = Array.from({ length: task.slots }, (_, index) => slotId(task, index + 1))
                      .filter(id => todayTasks[id]).length;
                    return (
                      <div key={task.baseId} className={`task-item compact-task${checkedCount ? ' done' : ''}`}>
                        <div className="task-info">
                          <div className="task-label">{task.label}</div>
                          {checkedCount > 0 && <div className="task-client">{checkedCount} of {task.slots} completed</div>}
                        </div>
                        <div className="compact-checks">
                          {Array.from({ length: task.slots }, (_, index) => {
                            const id = slotId(task, index + 1);
                            const done = !!todayTasks[id];
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`compact-check${done ? ' done' : ''}`}
                                onClick={() => handleTaskToggle({ ...task, id })}
                                disabled={!canEdit}
                                title={`${task.label} ${index + 1}`}
                              >
                                <span className="task-check-mark" />
                              </button>
                            );
                          })}
                        </div>
                        <span className="task-pts">+{task.points} ea</span>
                      </div>
                    );
                  }

                  const done = !!todayTasks[task.id];
                  const details = personData.saleDetails?.[selectedDate]?.[task.id];
                  return (
                    <button key={task.id} className={`task-item${done ? ' done' : ''}`} onClick={() => handleTaskToggle(task)} disabled={!canEdit}>
                      <div className="task-check"><span className="task-check-mark" /></div>
                      <div className="task-info">
                        <div className="task-label">{task.label}</div>
                        {details && (
                          <div className="task-client">
                            ${details.premium || 0} premium | {details.numPolicies || 0} policies
                            {details.saleType ? ` | ${details.saleType === 'new_household' ? 'New Household' : 'Cross-Sell'}` : ''}
                          </div>
                        )}
                      </div>
                      <span className="task-pts">+{task.points}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="daily-col">
          <div className="daily-field">
            <div className="daily-field-label win-label">Win of the Day</div>
            <textarea className="daily-textarea" placeholder="Biggest win today?" value={winValue} onChange={handleWinChange} disabled={!canEdit} />
          </div>
          <div className="daily-field">
            <div className="daily-field-label challenge-label">Challenge of the Day</div>
            <textarea className="daily-textarea" placeholder="Struggling with something?" value={challengeValue} onChange={handleChallengeChange} disabled={!canEdit} />
          </div>
          <div className="daily-field">
            <div className="daily-field-label feedback-label">Feedback, Tip, or Agency Improvement</div>
            <textarea className="daily-textarea" placeholder="What would make the agency better?" value={feedbackValue} onChange={handleFeedbackChange} disabled={!canEdit} />
          </div>
        </div>
      </div>

      <div className="daily-activity-log">
        <div className="activity-log-header">
          <div>
            <div className="activity-log-title">Daily Activity Log</div>
            <div className="activity-log-subtitle">Key activity entries for {selectedDate}</div>
          </div>
          <span>{dayLog.length} entries</span>
        </div>
        {dayLog.length === 0 ? (
          <div className="activity-log-empty">No tracked activity has been logged for this date yet.</div>
        ) : (
          <div className="activity-log-table">
            <div className="activity-log-row activity-log-head">
              <span>Time</span>
              <span>Producer</span>
              <span>Activity Type</span>
              <span>Client</span>
              <span>Details</span>
              <span>Points</span>
            </div>
            {dayLog.map(entry => (
              <div className="activity-log-row" key={entry.id || `${entry.timestamp}-${entry.person}-${entry.activityType}`}>
                <span>{entry.time || '--'}</span>
                <span>{entry.producer || '--'}</span>
                <span>{entry.activityType}</span>
                <span>{entry.clientName || '--'}</span>
                <span>{entry.details || '--'}</span>
                <span>{entry.points ? `+${entry.points}` : '0'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {revenueTask && (
        <RevenueModal task={revenueTask} onCancel={() => setRevenueTask(null)} onSave={handleRevenueSave} />
      )}
      {clientTask && (
        <ClientNameModal task={clientTask} onCancel={() => setClientTask(null)} onSave={handleClientTaskSave} />
      )}
    </div>
  );
}

export default function ActivityTracker({ people, currentUser, today, onRefresh, kpiData, refreshTick, weekData }) {
  const ranked = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)
    : people;

  const defaultPersonId = currentUser?.producer || ranked[0]?.id || people[0].id;
  const [activePerson, setActivePerson] = useState(defaultPersonId);
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
            {weekData && <span className="tab-pts-badge">{p.points} pts</span>}
          </button>
        ))}
      </div>

      <PersonView
        key={person.id}
        person={person}
        today={today}
        currentUser={currentUser}
        onRefresh={onRefresh}
        kpiData={kpiData}
        refreshTick={refreshTick}
        allPeople={people}
      />
    </div>
  );
}
