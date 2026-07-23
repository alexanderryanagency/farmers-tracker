import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import SpinWheel from './SpinWheel';
import { PRODUCER_PREMIUM_GOAL } from '../utils/folio';

const socket = io();
const PRODUCER_PREMIUM_GOAL_LABEL = PRODUCER_PREMIUM_GOAL >= 1000
  ? `$${(PRODUCER_PREMIUM_GOAL / 1000).toFixed(0)}k`
  : `$${PRODUCER_PREMIUM_GOAL}`;
const PRODUCER_PREMIUM_GOAL_FULL = `$${PRODUCER_PREMIUM_GOAL.toLocaleString()}`;

const ALL_BADGES = [
  { emoji: '🔥', name: 'Hot Streak',       desc: '3 consecutive days with a sale',        key: 'hotStreak'       },
  { emoji: '💰', name: '$20k Club',         desc: '$20,000+ premium in a folio',           key: 'club20k'         },
  { emoji: '💰', name: '$25k Club',         desc: '$25,000+ premium in a folio',           key: 'club25k'         },
  { emoji: '🏆', name: `${PRODUCER_PREMIUM_GOAL_LABEL} Club`, desc: `${PRODUCER_PREMIUM_GOAL_FULL}+ premium in a folio`, key: 'club30k' },
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
  const club30k = isProducer && premium >= PRODUCER_PREMIUM_GOAL;

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

export default function TrophyCase({ weekData, kpiData, people }) {
  const [showWheel,    setShowWheel]    = useState(false);
  const [log,          setLog]          = useState([]);
  const [folioTasks,   setFolioTasks]   = useState(null);

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
    0,
    ...people
      .filter(p => p.role === 'Producer')
      .map(p => kpiData?.data?.[p.id]?.totalPremium || 0),
  );

  // Compute badges per person
  const personBadges = {};
  for (const p of people) {
    personBadges[p.id] = computePersonBadges(p.id, log, kpiData, folioTasks, maxPremium);
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

      </div>

      {showWheel && <SpinWheel onClose={() => setShowWheel(false)} />}
    </div>
  );
}
