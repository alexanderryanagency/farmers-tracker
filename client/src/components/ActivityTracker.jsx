import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MEDALS = ['🥇', '🥈', '🥉'];
const WEEKLY_GOAL = 300;
const MINI_COLORS = ['#FFB800', '#CC0000', '#8B9BC1'];

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

function ActivityCorrectionModal({ entry, onCancel, onSave }) {
  const [clientName, setClientName] = useState(entry.clientName || '');
  const [premium, setPremium] = useState(entry.premium || '');
  const [numPolicies, setNumPolicies] = useState(entry.numPolicies ?? '');
  const hasRevenue = entry.activityType === 'Sale' || entry.activityType === 'Life App Back';

  return (
    <div className="overlay" onClick={event => event.target === event.currentTarget && onCancel()}>
      <div className="modal correction-modal">
        <div className="modal-tag">Admin Correction</div>
        <div className="modal-title">Edit {entry.activityType}</div>
        <div className="modal-field-label">Client Name</div>
        <input className="modal-input" value={clientName} onChange={event => setClientName(event.target.value)} autoFocus />
        {hasRevenue && (
          <>
            <div className="modal-field-label">Premium</div>
            <input className="modal-input" inputMode="decimal" value={premium} onChange={event => setPremium(event.target.value)} />
            <div className="modal-field-label">Policies</div>
            <input className="modal-input" type="number" min="0" value={numPolicies} onChange={event => setNumPolicies(event.target.value)} />
          </>
        )}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-confirm" onClick={() => onSave({ clientName, premium, numPolicies })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function PersonView({ person, currentUser, today, onRefresh, kpiData, refreshTick, allPeople }) {
  const [viewDate, setViewDate] = useState(today);
  const [weekData, setWeekData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [winValue, setWinValue] = useState('');
  const [challengeValue, setChallengeValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [dailySaveStatus, setDailySaveStatus] = useState('saved');
  const [correctionEntry, setCorrectionEntry] = useState(null);
  const dailySaveStatusRef = useRef('saved');
  const dailySelectionRef = useRef(`${person.id}:${selectedDate}`);

  const fetchWeekData = useCallback(async () => {
    try {
      const res = await fetch(`/api/week?date=${viewDate}`);
      setWeekData(await res.json());
    } catch {}
  }, [viewDate]);

  useEffect(() => { fetchWeekData(); }, [fetchWeekData, refreshTick]);

  const personData = weekData?.data[person.id];

  function setDailyStatus(status) {
    dailySaveStatusRef.current = status;
    setDailySaveStatus(status);
  }

  useEffect(() => {
    const dailyKey = `${person.id}:${selectedDate}`;
    const selectionChanged = dailySelectionRef.current !== dailyKey;
    const hasLocalDraft = ['dirty', 'saving', 'error'].includes(dailySaveStatusRef.current);
    if (hasLocalDraft && !selectionChanged) return;
    dailySelectionRef.current = dailyKey;
    setWinValue(personData?.wins?.[selectedDate] || '');
    setChallengeValue(personData?.challenges?.[selectedDate] || '');
    setFeedbackValue(personData?.feedback?.[selectedDate] || '');
    setDailyStatus('saved');
  }, [selectedDate, person.id, personData]);

  if (!weekData || !personData) return null;

  const canEdit = currentUser?.role === 'admin' || currentUser?.producer === person.id;
  const { weekDates } = weekData;
  const dayLog = (weekData.activityLog?.[selectedDate] || []).filter(entry => entry.person === person.id);
  const kpi = kpiData?.data?.[person.id];

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

  async function saveActivityCorrection(values) {
    await save(`/api/log/${correctionEntry.id}`, { ...values, actor: currentUser }, 'PATCH');
    setCorrectionEntry(null);
  }

  async function deleteActivity(entry) {
    if (!window.confirm(`Delete this ${entry.activityType} entry?`)) return;
    await save(`/api/log/${entry.id}`, { actor: currentUser }, 'DELETE');
  }

  function handleWinChange(e) {
    if (!canEdit) return;
    setWinValue(e.target.value);
    setDailyStatus('dirty');
  }

  function handleChallengeChange(e) {
    if (!canEdit) return;
    setChallengeValue(e.target.value);
    setDailyStatus('dirty');
  }

  function handleFeedbackChange(e) {
    if (!canEdit) return;
    setFeedbackValue(e.target.value);
    setDailyStatus('dirty');
  }

  async function saveDailyNotes() {
    if (!canEdit || dailySaveStatus === 'saving') return;
    setDailyStatus('saving');
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: person.id,
          date: selectedDate,
          win: winValue,
          challenge: challengeValue,
          feedback: feedbackValue,
        }),
      });
      if (!res.ok) throw new Error('Daily note save failed');
      setDailyStatus('saved');
    } catch {
      setDailyStatus('error');
    }
  }

  const dailyStatusLabel = {
    dirty: 'Unsaved changes',
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Error saving',
  }[dailySaveStatus];

  /*
    Daily notes intentionally save through /api/daily only. They do not create
    task records or feed task payloads into pulse previews/emails.
  */
  const dailySaveDisabled = !canEdit || dailySaveStatus === 'saving' || dailySaveStatus === 'saved';

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

      {person.id !== 'dan' && kpi && (
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
        <div className="daily-col">
          <div className="daily-notes-actions">
            <span className={`daily-save-status ${dailySaveStatus}`}>{dailyStatusLabel}</span>
            <button className="daily-save-btn" onClick={saveDailyNotes} disabled={dailySaveDisabled}>
              Save
            </button>
          </div>
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
            <div className={`activity-log-row activity-log-head${currentUser?.role === 'admin' ? ' with-actions' : ''}`}>
              <span>Time</span>
              <span>Producer</span>
              <span>Activity Type</span>
              <span>Client</span>
              <span>Details</span>
              <span>Points</span>
              {currentUser?.role === 'admin' && <span>Actions</span>}
            </div>
            {dayLog.map(entry => (
              <div className={`activity-log-row${currentUser?.role === 'admin' ? ' with-actions' : ''}`} key={entry.id || `${entry.timestamp}-${entry.person}-${entry.activityType}`}>
                <span>{entry.time || '--'}</span>
                <span>{entry.producer || '--'}</span>
                <span>{entry.activityType}</span>
                <span>{entry.clientName || '--'}</span>
                <span>{entry.details || '--'}</span>
                <span>{entry.points ? `+${entry.points}` : '0'}</span>
                {currentUser?.role === 'admin' && (
                  <span className="activity-row-actions">
                    <button type="button" onClick={() => setCorrectionEntry(entry)} title="Edit activity"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteActivity(entry)} title="Delete activity"><Trash2 size={14} /></button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {correctionEntry && (
        <ActivityCorrectionModal entry={correctionEntry} onCancel={() => setCorrectionEntry(null)} onSave={saveActivityCorrection} />
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

  useEffect(() => {
    if (!people.some(p => p.id === activePerson) && people[0]) {
      setActivePerson(people[0].id);
    }
  }, [activePerson, people]);

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
