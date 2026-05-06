import { useState } from 'react';
import SpinWheel from './SpinWheel';

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Scoreboard({ weekData, people }) {
  const [showWheel, setShowWheel] = useState(false);

  if (!weekData) return null;

  const ranked = [...people]
    .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
    .sort((a, b) => b.points - a.points);

  const maxPoints = Math.max(...ranked.map(p => p.points), 1);
  const totalPoints = ranked.reduce((s, p) => s + p.points, 0);

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
