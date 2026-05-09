import { useState } from 'react';
import { BarChart2 } from 'lucide-react';

// Folio period constants
const FOLIO_START = 'April 18';
const FOLIO_END   = 'May 19, 2026';
const DAYS_ELAPSED   = 15;
const DAYS_REMAINING = 7;
const WORKING_DAYS   = 22;

// Goals
const GOALS = {
  conversations: 60,
  premium:       30000,
  closeRate:     25,
  polPerHH:      1.5,
  lifeApps:      1,
};

// Dummy data (display only — does not overwrite real stored data)
const DUMMY = {
  jayce: {
    conversations: 29,
    closeRate: 20.69,
    polPerHH: 1.17,
    premium: 8055,
    households: 6,
    policies: 7,
    lifeApps: 1,
    referralsClosed: 2,
    referralsQuoted: 4,
    dials: 195,
    talkTime: '11h 57m',
    talkTimeAvg: '3h 41m',
  },
  alissa: {
    conversations: 23,
    closeRate: 17.39,
    polPerHH: 1.25,
    premium: 8478,
    households: 4,
    policies: 5,
    lifeApps: 1,
    referralsClosed: 1,
    referralsQuoted: 3,
    dials: 208,
    talkTime: '12h 42m',
    talkTimeAvg: '3h 40m',
  },
};

function trendFor(current) {
  return Math.round((current / DAYS_ELAPSED) * WORKING_DAYS);
}
function stillNeedPerDay(goal, current) {
  const remaining = goal - current;
  if (remaining <= 0) return 0;
  return (remaining / DAYS_REMAINING).toFixed(1);
}
function fmt$(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function MetaRow({ label, value, highlight }) {
  return (
    <div className={`stat-meta-row${highlight ? ' highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MyStats({ kpiData }) {
  const [producer, setProducer] = useState('jayce');
  const data = DUMMY[producer];

  const premiumGood = data.premium >= GOALS.premium;
  const convGood    = data.conversations >= GOALS.conversations;
  const closeGood   = data.closeRate >= GOALS.closeRate;
  const polGood     = data.polPerHH >= GOALS.polPerHH;
  const lifeGood    = data.lifeApps >= GOALS.lifeApps;

  const premiumNeedToday = stillNeedPerDay(GOALS.premium, data.premium);
  const convNeedToday    = stillNeedPerDay(GOALS.conversations, data.conversations);

  return (
    <div className="stats-page">
      {/* Header */}
      <div className="stats-header">
        <div>
          <div className="page-title" style={{ marginBottom: 4 }}>
            <BarChart2 size={20} />
            My Stats
          </div>
          <div className="stats-period">
            Folio Period: <strong>{FOLIO_START} – {FOLIO_END}</strong>
            <span style={{ marginLeft: 14, color: '#CC0000', fontWeight: 700 }}>{DAYS_REMAINING} days remaining</span>
          </div>
        </div>
        <select
          className="stats-producer-select"
          value={producer}
          onChange={e => setProducer(e.target.value)}
        >
          <option value="jayce">Jayce</option>
          <option value="alissa">Alissa</option>
        </select>
      </div>

      {/* Results section */}
      <div>
        <div className="section-title">Results Metrics</div>
        <div className="stats-grid">
          {/* Premium */}
          <div className="stat-card">
            <div className="stat-card-label">Premium Written</div>
            <div className={`stat-card-value ${premiumGood ? 'good' : 'bad'}`}>
              {fmt$(data.premium)}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Target" value={fmt$(GOALS.premium)} />
              <MetaRow label="Trending for" value={fmt$(trendFor(data.premium))} />
              <MetaRow label="Still need / day" value={`${fmt$(Number(premiumNeedToday) * 1000 / 1000)}/day`} highlight={!premiumGood} />
            </div>
          </div>

          {/* Policies / HH */}
          <div className="stat-card">
            <div className="stat-card-label">Policies / Households</div>
            <div className="stat-card-value" style={{ color: '#FFFFFF' }}>
              {data.policies} <span style={{ fontSize: 16, color: '#8B9BC1' }}>pol</span>
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Households closed" value={data.households} />
              <MetaRow label="Policies / HH" value={data.polPerHH.toFixed(2)} />
              <MetaRow label="HH Goal" value="—" />
            </div>
          </div>

          {/* Life Apps */}
          <div className="stat-card">
            <div className="stat-card-label">Life Apps</div>
            <div className={`stat-card-value ${lifeGood ? 'good' : 'bad'}`}>
              {data.lifeApps}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Target" value={`${GOALS.lifeApps} / month`} />
              <MetaRow label="Still need" value={Math.max(0, GOALS.lifeApps - data.lifeApps)} />
            </div>
          </div>

          {/* Referrals */}
          <div className="stat-card">
            <div className="stat-card-label">Referrals</div>
            <div className="stat-card-value" style={{ color: '#FFFFFF' }}>
              {data.referralsClosed}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Closed" value={data.referralsClosed} />
              <MetaRow label="Quoted" value={data.referralsQuoted} />
            </div>
          </div>
        </div>
      </div>

      {/* Activity section */}
      <div>
        <div className="section-title">Activity Metrics</div>
        <div className="stats-grid-2">
          {/* Conversations */}
          <div className="stat-card">
            <div className="stat-card-label">New Conversations</div>
            <div className={`stat-card-value ${convGood ? 'good' : 'bad'}`}>
              {data.conversations}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Target" value={GOALS.conversations} />
              <MetaRow label="Trending for" value={trendFor(data.conversations)} />
              <MetaRow label="Still need / day" value={`${convNeedToday}/day`} highlight={!convGood} />
            </div>
          </div>

          {/* Close Rate */}
          <div className="stat-card">
            <div className="stat-card-label">Close Rate</div>
            <div className={`stat-card-value ${closeGood ? 'good' : 'bad'}`}>
              {data.closeRate.toFixed(1)}%
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Target" value={`${GOALS.closeRate}%`} />
              <MetaRow label="HH Closed" value={data.households} />
            </div>
          </div>

          {/* Policies / HH rate */}
          <div className="stat-card">
            <div className="stat-card-label">Policies / HH</div>
            <div className={`stat-card-value ${polGood ? 'good' : 'bad'}`}>
              {data.polPerHH.toFixed(2)}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Target" value={GOALS.polPerHH.toFixed(1)} />
            </div>
          </div>

          {/* Dials */}
          <div className="stat-card">
            <div className="stat-card-label">Dials</div>
            <div className="stat-card-value neutral">
              {data.dials}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Avg / day" value={(data.dials / DAYS_ELAPSED).toFixed(1)} />
            </div>
          </div>

          {/* Talk Time */}
          <div className="stat-card">
            <div className="stat-card-label">Talk Time</div>
            <div className="stat-card-value neutral" style={{ fontSize: 22 }}>
              {data.talkTime}
            </div>
            <div className="stat-card-meta">
              <MetaRow label="Avg / day" value={data.talkTimeAvg} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
