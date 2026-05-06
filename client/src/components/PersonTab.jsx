import { useState, useEffect, useRef } from 'react';

const TASKS = [
  { id: 'conv_3',   label: '3 Conversations',  points: 5,  verified: false },
  { id: 'conv_4',   label: '4 Conversations',  points: 10, verified: false },
  { id: 'ghost_5',  label: '5 Ghost Quotes',   points: 3,  verified: false },
  { id: 'ghost_10', label: '10 Ghost Quotes',  points: 5,  verified: false },
  { id: 'referral', label: 'Referral Received', points: 10, verified: true  },
  { id: 'monoline', label: 'Monoline Sale',    points: 3,  verified: true  },
  { id: 'bundle',   label: 'Bundle Sale',      points: 5,  verified: true  },
  { id: 'life_app', label: 'Life App Sent',    points: 5,  verified: true  },
  { id: 'life_sale',label: 'Life Sale',        points: 20, verified: true  },
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function PersonTab({ person, weekData, today, onRefresh }) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [winValue, setWinValue]           = useState('');
  const [challengeValue, setChallengeValue] = useState('');
  const [pendingTask, setPendingTask]     = useState(null);
  const [clientInput, setClientInput]     = useState('');
  const winTimer       = useRef(null);
  const challengeTimer = useRef(null);

  const personData = weekData?.data[person.id];

  // Sync win/challenge when date or remote data changes
  useEffect(() => {
    setWinValue(personData?.wins?.[selectedDate] || '');
    setChallengeValue(personData?.challenges?.[selectedDate] || '');
  }, [selectedDate, personData?.wins, personData?.challenges]);

  if (!weekData || !personData) return null;

  const { weekDates, weekKey } = weekData;
  const todayTasks = personData.tasks[selectedDate] || {};
  const dayPoints  = TASKS.reduce((s, t) => s + (todayTasks[t.id] ? t.points : 0), 0);

  // ── task toggle (with optional clientName for verified tasks) ──
  async function performToggle(taskId, completed, clientName) {
    await fetch('/api/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: person.id, taskId, date: selectedDate, completed, clientName }),
    });
    onRefresh();
  }

  function handleTaskClick(task) {
    const done = todayTasks[task.id] || false;
    if (!done && task.verified) {
      setPendingTask(task);
      setClientInput('');
    } else {
      performToggle(task.id, !done, null);
    }
  }

  async function confirmVerification() {
    if (!clientInput.trim() || !pendingTask) return;
    await performToggle(pendingTask.id, true, clientInput.trim());
    setPendingTask(null);
    setClientInput('');
  }

  // ── win / challenge auto-save ──
  function handleWinChange(e) {
    const val = e.target.value;
    setWinValue(val);
    clearTimeout(winTimer.current);
    winTimer.current = setTimeout(() => {
      fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: person.id, date: selectedDate, win: val }),
      }).then(() => onRefresh());
    }, 600);
  }

  function handleChallengeChange(e) {
    const val = e.target.value;
    setChallengeValue(val);
    clearTimeout(challengeTimer.current);
    challengeTimer.current = setTimeout(() => {
      fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: person.id, date: selectedDate, challenge: val }),
      }).then(() => onRefresh());
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

      {/* Date strip */}
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
                  {done && clientName && (
                    <span className="task-client">{clientName}</span>
                  )}
                </div>
                <span className="task-pts">+{task.points}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Win + Challenge */}
        <div className="col-right">
          <div className="daily-field win-field">
            <div className="daily-label win-label">Win of the Day</div>
            <textarea
              className="daily-input"
              placeholder="What was your biggest win today?"
              value={winValue}
              onChange={handleWinChange}
              rows={4}
            />
          </div>

          <div className="daily-field challenge-field">
            <div className="daily-label challenge-label">Challenge of the Day</div>
            <textarea
              className="daily-input"
              placeholder="What are you struggling with today?"
              value={challengeValue}
              onChange={handleChallengeChange}
              rows={4}
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
              <button
                className="verify-confirm"
                onClick={confirmVerification}
                disabled={!clientInput.trim()}
              >
                Confirm +{pendingTask.points} pts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
