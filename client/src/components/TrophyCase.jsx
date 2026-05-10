import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import SpinWheel from './SpinWheel';

const socket = io();

const ALL_BADGES = [
  { emoji: '🔥', name: 'Hot Streak',       desc: '3 consecutive days with a sale',        key: 'hotStreak'       },
  { emoji: '💰', name: '$20k Club',         desc: '$20,000+ premium in a folio',           key: 'club20k'         },
  { emoji: '💰', name: '$25k Club',         desc: '$25,000+ premium in a folio',           key: 'club25k'         },
  { emoji: '🏆', name: '$30k Club',         desc: '$30,000+ premium in a folio',           key: 'club30k'         },
  { emoji: '🎯', name: 'Life Pro',          desc: '3+ life policies in a folio',           key: 'lifePro'         },
  { emoji: '⚡', name: 'Speed Demon',       desc: '5+ conversations in one day',           key: 'speedDemon'      },
  { emoji: '🤝', name: 'Bundle King',       desc: '5+ bundles in a folio',                 key: 'bundleKing'      },
  { emoji: '🌟', name: 'Perfect Week',      desc: '3+ convos every working day in a week', key: 'perfectWeek'     },
  { emoji: '👑', name: 'Top Producer',      desc: 'Highest premium on team for a folio',  key: 'topProducer'     },
  { emoji: '🎪', name: 'Referral Machine',  desc: '5+ referrals in a folio',               key: 'referralMachine' },
];

function getMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() + diff);
  return m.toISOString().split('T')[0];
}

function checkConsecutiveDates(dates, n) {
  const unique = [...new Set(dates)].sort();
  for (let i = 0; i <= unique.length - n; i++) {
    let ok = true;
    for (let j = 0; j < n - 1; j++) {
      const d1 = new Date(unique[i + j] + 'T12:00:00Z');
      const d2 = new Date(unique[i + j + 1] + 'T12:00:00Z');
      if ((d2 - d1) / 86400000 !== 1) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function hasPerfectWeek(personFolio) {
  const weeks = {};
  for (const [date, tasks] of Object.entries(personFolio)) {
    const d = new Date(date + 'T12:00:00Z');
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const monday = getMonday(date);
    if (!weeks[monday]) weeks[monday] = {};
    weeks[monday][date] = Number(tasks.new_conv) || 0;
  }
  for (const weekDays of Object.values(weeks)) {
    const days = Object.values(weekDays);
    if (days.length >= 5 && days.every(c => c >= 3)) return true;
  }
  return false;
}

function computePersonBadges(personId, log, kpiData, folioTasks, maxPremium) {
  const isProducer = personId !== 'dan';
  const personLog = log.filter(e => e.person === personId);
  const personFolio = folioTasks?.[personId] || {};
  const kpi = kpiData?.data?.[personId] || {};
  const premium = kpi.totalPremium || 0;

  // Hot Streak: 3 consecutive sale days
  const saleDates = personLog
    .filter(e => ['monoline', 'bundle', 'life_app', 'life_sale'].includes(e.taskId))
    .map(e => e.date);
  const hotStreak = isProducer && checkConsecutiveDates(saleDates, 3);

  // Premium clubs (producer only)
  const club20k = isProducer && premium >= 20000;
  const club25k = isProducer && premium >= 25000;
  const club30k = isProducer && premium >= 30000;

  // Life Pro: 3+ life policies (producer only)
  const lifePro = isProducer && personLog.filter(e => e.taskId === 'life_app' || e.taskId === 'life_sale').length >= 3;

  // Speed Demon: 5+ convos in one day (producer only)
  const speedDemon = isProducer && Object.values(personFolio).some(t => Number(t.new_conv) >= 5);

  // Bundle King: 5+ bundles (producer only)
  const bundleKing = isProducer && personLog.filter(e => e.taskId === 'bundle').length >= 5;

  // Perfect Week: 3+ convos every working day in a week (producer only)
  const perfectWeek = isProducer && hasPerfectWeek(personFolio);

  // Top Producer: highest premium on team (producer only, no ties)
  const topProducer = isProducer && premium > 0 && premium >= maxPremium;

  // Referral Machine: 5+ referrals (all people)
  const referralMachine = personLog.filter(e =>
    e.taskId === 'referral' || e.taskId === 'referral_collected'
  ).length >= 5;

  const result = {};
  ALL_BADGES.forEach(b => { result[b.key] = false; });
  if (hotStreak)       result.hotStreak       = true;
  if (club20k)         result.club20k         = true;
  if (club25k)         result.club25k         = true;
  if (club30k)         result.club30k         = true;
  if (lifePro)         result.lifePro         = true;
  if (speedDemon)      result.speedDemon      = true;
  if (bundleKing)      result.bundleKing      = true;
  if (perfectWeek)     result.perfectWeek     = true;
  if (topProducer)     result.topProducer     = true;
  if (referralMachine) result.referralMachine = true;

  return result;
}

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PEOPLE_MAP = {
  jayce:  { name: 'Jayce',  photo: '/jayce.png'  },
  alissa: { name: 'Alissa', photo: '/alissa.png' },
  dan:    { name: 'Dan',    photo: '/dan.png'    },
};

export default function TrophyCase({ weekData, kpiData, people }) {
  const [showWheel,    setShowWheel]    = useState(false);
  const [log,          setLog]          = useState([]);
  const [folioTasks,   setFolioTasks]   = useState(null);
  const [editEntry,    setEditEntry]    = useState(null);
  const [editClient,   setEditClient]   = useState('');
  const [editPremium,  setEditPremium]  = useState('');
  const [editPolicies, setEditPolicies] = useState('');
  const [deleteId,     setDeleteId]     = useState(null);

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

  // Max premium across producers (for Top Producer badge)
  const maxPremium = Math.max(
    kpiData?.data?.jayce?.totalPremium || 0,
    kpiData?.data?.alissa?.totalPremium || 0,
  );

  // Compute badges per person
  const personBadges = {};
  for (const p of people) {
    personBadges[p.id] = computePersonBadges(p.id, log, kpiData, folioTasks, maxPremium);
  }

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

        {/* ── Spin Wheel ── */}
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

        {/* ── 3-Column Producer Trophies ── */}
        <div>
          <div className="section-title">Producer Trophies</div>
          <div className="trophy-3col">
            {people.map(person => {
              const badges = personBadges[person.id] || {};
              const earnedBadges = ALL_BADGES.filter(b => badges[b.key]);
              const pts = weekData?.data?.[person.id]?.points || 0;

              return (
                <div key={person.id} className="trophy-col">
                  <img src={person.photo} alt={person.name} className="trophy-col-photo" />
                  <div className="trophy-col-name">{person.name}</div>
                  <div className="trophy-col-pts">{pts} pts this week</div>
                  <div className="trophy-shelf">
                    {earnedBadges.length === 0 ? (
                      <div className="trophy-shelf-empty">No trophies yet — keep grinding! 💪</div>
                    ) : (
                      earnedBadges.map(badge => (
                        <div key={badge.key} className="shelf-badge">
                          <span className="shelf-badge-emoji">{badge.emoji}</span>
                          <span className="shelf-badge-name">{badge.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Available Trophies ── */}
        <div>
          <div className="section-title">Available Trophies</div>
          <div className="avail-badge-grid">
            {ALL_BADGES.map(badge => {
              const earners = people
                .filter(p => personBadges[p.id]?.[badge.key])
                .map(p => p.name);
              const earned = earners.length > 0;

              return (
                <div key={badge.key} className={`avail-badge-card ${earned ? 'earned' : 'locked'}`}>
                  <div className="avail-badge-emoji">{badge.emoji}</div>
                  <div className="avail-badge-name">{badge.name}</div>
                  <div className="avail-badge-desc">{badge.desc}</div>
                  {earned && (
                    <div className="avail-badge-earners">{earners.join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sales Log ── */}
        <div className="trophy-log-section">
          <div className="trophy-log-header">
            <div className="trophy-log-title">Sales Log</div>
            <div className="trophy-log-count">{log.length} {log.length === 1 ? 'entry' : 'entries'}</div>
          </div>

          {log.length === 0 ? (
            <div className="log-empty">
              No verified entries yet.<br />
              Completing tasks like Sales and Referrals will appear here.
            </div>
          ) : (
            <div className="log-table-wrap">
              <table className="log-table">
                <thead>
                  <tr>
                    <th>Producer</th><th>Task</th><th>Client</th>
                    <th>Premium</th><th>Pol</th><th>HH</th>
                    <th>Date</th><th>Time</th><th></th>
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

      {/* Edit modal */}
      {editEntry && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="modal">
            <div className="modal-tag">{editEntry.taskLabel} · {formatDate(editEntry.date)}</div>
            <div className="modal-title">Edit Entry</div>
            <input className="modal-input" type="text" placeholder="Client name" value={editClient} onChange={e => setEditClient(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} autoFocus />
            <input className="modal-input" type="text" placeholder="Premium amount" value={editPremium} onChange={e => setEditPremium(e.target.value)} />
            <input className="modal-input" type="number" placeholder="Number of policies" value={editPolicies} onChange={e => setEditPolicies(e.target.value)} min="1" />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="modal-confirm" onClick={saveEdit} disabled={!editClient.trim()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {showWheel && <SpinWheel onClose={() => setShowWheel(false)} />}
    </div>
  );
}
