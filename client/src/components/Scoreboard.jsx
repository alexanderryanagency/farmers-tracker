import { useState } from 'react';
import SpinWheel from './SpinWheel';
import KPIStrip from './KPIStrip';

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildTeamKpi(people, kpiData) {
  if (!kpiData) return null;
  const producers = people.filter(p => p.role === 'Producer');
  const pkpis = producers.map(p => kpiData.data?.[p.id]).filter(Boolean);
  if (pkpis.length === 0) return null;

  const totalConv    = pkpis.reduce((s, k) => s + k.totalConversations, 0);
  const totalPol     = pkpis.reduce((s, k) => s + k.totalPolicies, 0);
  const totalHH      = pkpis.reduce((s, k) => s + k.totalHouseholds, 0);
  const totalPremium = pkpis.reduce((s, k) => s + k.totalPremium, 0);
  const totalActive  = pkpis.reduce((s, k) => s + (k.activeDays || 0), 0);
  const { workingDaysElapsed, workingDaysTotal } = pkpis[0];

  return {
    totalConversations: totalConv,
    totalPolicies: totalPol,
    totalHouseholds: totalHH,
    totalPremium,
    workingDaysElapsed,
    workingDaysTotal,
    avgConvPerDay: totalActive > 0 ? totalConv / totalActive : 0,
    closeRate:     totalConv > 0 ? (totalHH / totalConv) * 100 : 0,
    policiesPerHH: totalHH > 0 ? totalPol / totalHH : 0,
    premiumPace:   pkpis.reduce((s, k) => s + k.premiumPace, 0),
  };
}

export default function Scoreboard({ weekData, people, kpiData }) {
  const [showWheel, setShowWheel] = useState(false);

  if (!weekData) return null;

  const ranked = [...people]
    .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...ranked.map(p => p.points), 1);
  const totalPoints = ranked.reduce((s, p) => s + p.points, 0);
  const teamKpi = buildTeamKpi(people, kpiData);

  return (
    <div className="scoreboard">
      <div className="week-header">
        <h2>Weekly Standings</h2>
        <span className="week-range">
          {formatDate(weekData.weekDates[0])} – {formatDate(weekData.weekDates[6])}
        </span>
      </div>

      <div className="rankings">
        {ranked.map((person, i) => (
          <div key={person.id} className={`rank-card rank-${i + 1}`}>
            <div className="rank-num">0{i + 1}</div>
            <img src={person.photo} alt={person.name} className="rank-avatar-photo" />
            <div className="rank-info">
              <div className="rank-name">{person.name}</div>
              <div className="rank-role">{person.role}</div>
              <div className="rank-bar-wrap">
                <div
                  className="rank-bar"
                  style={{ width: `${(person.points / maxPoints) * 100}%` }}
                />
              </div>
            </div>
            <div className="rank-points">
              <span className="points-num">{person.points}</span>
              <span className="points-label">pts</span>
            </div>
          </div>
        ))}
      </div>

      {teamKpi && (
        <div className="team-kpi-section">
          <div className="team-kpi-header">
            <span className="team-kpi-title">Team KPIs</span>
            <span className="team-kpi-sub">Monthly · Producers</span>
          </div>
          <KPIStrip kpi={teamKpi} premiumGoal={60000} />
        </div>
      )}

      {totalPoints === 0 && (
        <p className="no-points-hint">No points logged yet — tap a name above to start.</p>
      )}

      <button className="spin-btn" onClick={() => setShowWheel(true)}>
        Spin the Winner Wheel
      </button>

      {showWheel && (
        <SpinWheel onClose={() => setShowWheel(false)} />
      )}
    </div>
  );
}
