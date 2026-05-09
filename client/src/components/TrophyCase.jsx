import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import SpinWheel from './SpinWheel';

const socket = io();

const PEOPLE_MAP = {
  jayce:  { name: 'Jayce',  photo: '/jayce.png'  },
  alissa: { name: 'Alissa', photo: '/alissa.png' },
  dan:    { name: 'Dan',    photo: '/dan.png'    },
};

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function hasConsecutiveActiveDays(taskData, n = 3) {
  const activeDates = Object.entries(taskData)
    .filter(([, tasks]) => Object.values(tasks).some(v => v))
    .map(([date]) => date)
    .sort();

  for (let i = 0; i <= activeDates.length - n; i++) {
    let ok = true;
    for (let j = 0; j < n - 1; j++) {
      const d1 = new Date(activeDates[i + j] + 'T12:00:00Z');
      const d2 = new Date(activeDates[i + j + 1] + 'T12:00:00Z');
      if ((d2 - d1) / 86400000 !== 1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function computeBadges(log, kpiData, weekData, folioTasks) {
  // Premium totals from kpiData
  const totalPremium = ['jayce', 'alissa'].reduce((s, id) => {
    return s + (kpiData?.data?.[id]?.totalPremium || 0);
  }, 0);

  // Log-based counts
  const bundleCount   = log.filter(e => e.taskId === 'bundle').length;
  const referralCount = log.filter(e => e.taskId === 'referral' || e.taskId === 'referral_collected').length;
  const lifeCount     = log.filter(e => e.taskId === 'life_app' || e.taskId === 'life_sale').length;

  // Speed Demon: 5+ convos in one day by any producer
  let speedDemonEarner = null;
  if (folioTasks) {
    outer: for (const personId of ['jayce', 'alissa']) {
      for (const tasks of Object.values(folioTasks[personId] || {})) {
        if (Number(tasks.new_conv) >= 5) { speedDemonEarner = personId; break outer; }
      }
    }
  }

  // Hot Streak: 3+ consecutive active days
  let hotStreakEarner = null;
  if (folioTasks) {
    for (const personId of Object.keys(PEOPLE_MAP)) {
      if (hasConsecutiveActiveDays(folioTasks[personId] || {}, 3)) {
        hotStreakEarner = personId;
        break;
      }
    }
  }

  // Top Producer: any person with 30+ pts this week
  let topProducerEarner = null;
  if (weekData) {
    const best = Object.entries(PEOPLE_MAP)
      .map(([id]) => ({ id, pts: weekData.data[id]?.points || 0 }))
      .sort((a, b) => b.pts - a.pts)[0];
    if (best?.pts >= 30) topProducerEarner = best.id;
  }

  // Perfect Week: any producer earns 40+ pts in current week
  let perfectWeekEarner = null;
  if (weekData) {
    for (const id of Object.keys(PEOPLE_MAP)) {
      if ((weekData.data[id]?.points || 0) >= 40) { perfectWeekEarner = id; break; }
    }
  }

  const p = id => PEOPLE_MAP[id] || null;
  const away = (goal, val) => `$${Math.max(0, goal - val).toLocaleString()} away`;

  return [
    {
      emoji: '🔥',
      name: 'Hot Streak',
      desc: '3+ active days in a row',
      earned: !!hotStreakEarner,
      earner: p(hotStreakEarner),
      lockLabel: 'Complete tasks 3 consecutive days',
    },
    {
      emoji: '💰',
      name: '$20k Club',
      desc: 'Team writes $20,000+ in premium',
      earned: totalPremium >= 20000,
      earner: totalPremium >= 20000 ? { name: 'Team' } : null,
      lockLabel: away(20000, totalPremium),
    },
    {
      emoji: '💰',
      name: '$25k Club',
      desc: 'Team writes $25,000+ in premium',
      earned: totalPremium >= 25000,
      earner: totalPremium >= 25000 ? { name: 'Team' } : null,
      lockLabel: away(25000, totalPremium),
    },
    {
      emoji: '💰',
      name: '$30k Club',
      desc: 'Team writes $30,000+ in premium',
      earned: totalPremium >= 30000,
      earner: totalPremium >= 30000 ? { name: 'Team' } : null,
      lockLabel: away(30000, totalPremium),
    },
    {
      emoji: '🎯',
      name: 'Life Pro',
      desc: '1+ life application submitted',
      earned: lifeCount >= 1,
      earner: lifeCount >= 1 ? { name: 'Team' } : null,
      lockLabel: 'Submit a life application',
    },
    {
      emoji: '⚡',
      name: 'Speed Demon',
      desc: '5+ conversations in a single day',
      earned: !!speedDemonEarner,
      earner: p(speedDemonEarner),
      lockLabel: 'Hit 5 conversations in one day',
    },
    {
      emoji: '🤝',
      name: 'Bundle King',
      desc: '3+ bundle sales this folio',
      earned: bundleCount >= 3,
      earner: bundleCount >= 3 ? { name: 'Team' } : null,
      lockLabel: `${Math.max(0, 3 - bundleCount)} more bundle${3 - bundleCount !== 1 ? 's' : ''} needed`,
    },
    {
      emoji: '🌟',
      name: 'Perfect Week',
      desc: '40+ points earned in a single week',
      earned: !!perfectWeekEarner,
      earner: p(perfectWeekEarner),
      lockLabel: 'Earn 40+ points in one week',
    },
    {
      emoji: '👑',
      name: 'Top Producer',
      desc: 'Weekly leader with 30+ points',
      earned: !!topProducerEarner,
      earner: p(topProducerEarner),
      lockLabel: 'Lead the week with 30+ points',
    },
    {
      emoji: '🎪',
      name: 'Referral Machine',
      desc: '3+ referrals collected this folio',
      earned: referralCount >= 3,
      earner: referralCount >= 3 ? { name: 'Team' } : null,
      lockLabel: `${Math.max(0, 3 - referralCount)} more referral${3 - referralCount !== 1 ? 's' : ''} needed`,
    },
  ];
}

export default function TrophyCase({ weekData, kpiData, people }) {
  const [showWheel,   setShowWheel]   = useState(false);
  const [log,         setLog]         = useState([]);
  const [folioTasks,  setFolioTasks]  = useState(null);
  const [editEntry,   setEditEntry]   = useState(null);
  const [editClient,  setEditClient]  = useState('');
  const [editPremium, setEditPremium] = useState('');
  const [editPolicies,setEditPolicies]= useState('');
  const [deleteId,    setDeleteId]    = useState(null);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch('/api/log');
      setLog(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchLog();
    fetch('/api/folio-tasks').then(r => r.json()).then(setFolioTasks).catch(() => {});
    socket.on('refresh', fetchLog);
    return () => socket.off('refresh', fetchLog);
  }, [fetchLog]);

  const leader = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)[0]
    : null;

  const badges = computeBadges(log, kpiData, weekData, folioTasks);

  function openEdit(entry) {
    setEditEntry(entry);
    setEditClient(entry.clientName || '');
    setEditPremium(entry.premium || '');
    setEditPolicies(entry.numPolicies != null ? String(entry.numPolicies) : '');
  }

  async function saveEdit() {
    if (!editEntry || !editClient.trim()) return;
    await fetch(`/api/log/${editEntry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName:  editClient.trim(),
        premium:     editPremium.trim() || null,
        numPolicies: editPolicies.trim() ? Number(editPolicies) : null,
      }),
    });
    setEditEntry(null);
    fetchLog();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/log/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    fetchLog();
  }

  return (
    <div className="trophy-page">
      <div className="trophy-inner">
        {/* ─── Section 1: Spin Wheel ─── */}
        <div>
          <div className="page-title" style={{ marginBottom: 16 }}>
            <Trophy size={20} />
            Trophy Case
          </div>
          <div className="spin-section">
            {leader && (
              <div className="spin-leader-chip">
                <img src={leader.photo} alt={leader.name} />
                <span>Week leader: <strong>{leader.name}</strong> — {leader.points} pts</span>
              </div>
            )}
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
              Spin the wheel to reveal this week's prize for the top performer.
            </div>
            <button className="spin-go-btn" onClick={() => setShowWheel(true)}>
              <Trophy size={16} />
              Spin The Winner
            </button>
          </div>
        </div>

        {/* ─── Section 2: Badge Grid ─── */}
        <div>
          <div className="section-title">Achievement Badges</div>
          <div className="badge-grid">
            {badges.map(badge => (
              <div key={badge.name} className={`badge-card ${badge.earned ? 'earned' : 'locked'}`}>
                <div className="badge-emoji">{badge.emoji}</div>
                <div className="badge-name">{badge.name}</div>
                <div className="badge-desc">{badge.desc}</div>
                {badge.earned && badge.earner ? (
                  <div className="badge-earner">
                    {badge.earner.photo && (
                      <img src={badge.earner.photo} alt={badge.earner.name} />
                    )}
                    <span className="badge-earner-name">
                      {badge.earner.name === 'Team' ? '🏆 Team' : badge.earner.name}
                    </span>
                  </div>
                ) : !badge.earned ? (
                  <div className="badge-lock-label">{badge.lockLabel}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* ─── Section 3: Sales Log ─── */}
        <div className="trophy-log-section">
          <div className="trophy-log-header">
            <div className="trophy-log-title">Sales Log</div>
            <div className="trophy-log-count">{log.length} {log.length === 1 ? 'entry' : 'entries'}</div>
          </div>

          {log.length === 0 ? (
            <div className="log-empty" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No verified entries yet.<br />
              Completing tasks like Sales and Referrals will appear here.
            </div>
          ) : (
            <div className="log-table-wrap">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Producer</th>
                    <th>Task</th>
                    <th>Client</th>
                    <th>Premium</th>
                    <th>Pol</th>
                    <th>HH</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(entry => {
                    const person = PEOPLE_MAP[entry.person];
                    const confirmingDelete = deleteId === entry.id;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <div className="log-person-cell">
                            {person && <img src={person.photo} alt={person.name} className="log-person-photo" />}
                            <span>{entry.personName || entry.person}</span>
                          </div>
                        </td>
                        <td><span className="log-task-badge">{entry.taskLabel}</span></td>
                        <td className="log-client">{entry.clientName}</td>
                        <td className="log-premium">{entry.premium ?? '—'}</td>
                        <td className="log-pol">{entry.numPolicies != null ? entry.numPolicies : '—'}</td>
                        <td className="log-hh">{entry.numHouseholds != null ? entry.numHouseholds : (entry.newHousehold ? 1 : '—')}</td>
                        <td className="log-date">{formatDate(entry.date)}</td>
                        <td className="log-time">{entry.time}</td>
                        <td className="log-actions">
                          {confirmingDelete ? (
                            <div className="log-confirm-row">
                              <span className="log-sure">Sure?</span>
                              <button className="log-action-yes" onClick={confirmDelete}>Yes</button>
                              <button className="log-action-no" onClick={() => setDeleteId(null)}>No</button>
                            </div>
                          ) : (
                            <div className="log-action-row">
                              <button className="log-edit-btn" onClick={() => openEdit(entry)}>Edit</button>
                              <button className="log-del-btn" onClick={() => setDeleteId(entry.id)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit log entry modal */}
      {editEntry && (
        <div className="overlay log-edit-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="modal">
            <div className="modal-tag">{editEntry.taskLabel} · {formatDate(editEntry.date)}</div>
            <div className="modal-title">Edit Entry</div>
            <input
              className="modal-input"
              type="text"
              placeholder="Client name"
              value={editClient}
              onChange={e => setEditClient(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              autoFocus
            />
            <input
              className="modal-input"
              type="text"
              placeholder="Premium amount"
              value={editPremium}
              onChange={e => setEditPremium(e.target.value)}
            />
            <input
              className="modal-input"
              type="number"
              placeholder="Number of policies"
              value={editPolicies}
              onChange={e => setEditPolicies(e.target.value)}
              min="1"
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="modal-confirm" onClick={saveEdit} disabled={!editClient.trim()}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showWheel && <SpinWheel onClose={() => setShowWheel(false)} />}
    </div>
  );
}
