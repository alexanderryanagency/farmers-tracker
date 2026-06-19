import { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { getActiveFolio, getFolioDisplay } from '../utils/folio';

const GOALS = {
  conversations: 60,
  premium:       30000,
  closeRate:     25,
  polPerHH:      1.5,
  lifeApps:      1,
};

const ZERO_STATS = {
  alissa: {
    conversations: 0,
    closeRate: 0,
    polPerHH: 0,
    premium: 0,
    households: 0,
    policies: 0,
    lifeApps: 0,
    referralsClosed: 0,
    referralsQuoted: 0,
    dials: 0,
    talkTime: '0h 0m',
    talkTimeAvg: '0h 0m',
  },
};

function trendFor(current) { return current; }
function stillNeedPerDay(goal, current) {
  const remaining = goal - current;
  if (remaining <= 0) return 0;
  const { daysRemaining } = getFolioDisplay(getActiveFolio());
  return daysRemaining > 0 ? (remaining / daysRemaining).toFixed(1) : '0.0';
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

export default function MyStats({ kpiData, people = [] }) {
  const producers = people.filter(p => p.role === 'Producer');
  const defaultProducerId = producers[0]?.id || 'alissa';
  const [producerId, setProducerId] = useState(defaultProducerId);
  const kpi = kpiData?.data?.[producerId];
  const fallbackStats = ZERO_STATS[producerId] || ZERO_STATS[defaultProducerId];
  if (!fallbackStats) return null;
  const data = {
    ...fallbackStats,
    conversations: kpi?.totalConversations ?? fallbackStats.conversations,
    closeRate: kpi?.closeRate ?? fallbackStats.closeRate,
    polPerHH: kpi?.policiesPerHH ?? fallbackStats.polPerHH,
    premium: kpi?.totalPremium ?? fallbackStats.premium,
    households: kpi?.totalHouseholds ?? fallbackStats.households,
    policies: kpi?.totalPolicies ?? fallbackStats.policies,
    lifeApps: kpi?.totalLifeAppsBack ?? fallbackStats.lifeApps,
  };
  const folioDisplay = getFolioDisplay(getActiveFolio());

  const premiumGood = data.premium >= GOALS.premium;
  const convGood    = data.conversations >= GOALS.conversations;
  const closeGood   = data.closeRate >= GOALS.closeRate;
  const polGood     = data.polPerHH >= GOALS.polPerHH;
  const lifeGood    = data.lifeApps >= GOALS.lifeApps;

  const premiumNeedToday = stillNeedPerDay(GOALS.premium, data.premium);
  const convNeedToday    = stillNeedPerDay(GOALS.conversations, data.conversations);

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo tab bar */}
      <div className="photo-tab-bar">
        {producers.map(p => (
          <button
            key={p.id}
            className={`photo-tab-btn${producerId === p.id ? ' active' : ''}`}
            onClick={() => setProducerId(p.id)}
          >
            <img src={p.photo} alt={p.name} />
            {p.name}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="stats-page">
        {/* Header */}
        <div className="stats-header">
          <div>
            <div className="page-title" style={{ marginBottom: 4 }}>
              <BarChart2 size={20} />
              My Stats
            </div>
            <div className="stats-period">
              Folio Period: <strong>{folioDisplay.label.replace('Folio: ', '')}</strong>
              <span style={{ marginLeft: 14, color: 'var(--red)', fontWeight: 700 }}>{folioDisplay.daysRemaining} days remaining</span>
            </div>
          </div>
        </div>

        {/* Results section */}
        <div>
          <div className="section-title">Results Metrics</div>
          <div className="stats-grid">
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

            <div className="stat-card">
              <div className="stat-card-label">Policies / Households</div>
              <div className="stat-card-value" style={{ color: 'var(--text)' }}>
                {data.policies} <span style={{ fontSize: 16, color: 'var(--muted)' }}>pol</span>
              </div>
              <div className="stat-card-meta">
                <MetaRow label="Households closed" value={data.households} />
                <MetaRow label="Policies / HH" value={data.polPerHH.toFixed(2)} />
                <MetaRow label="HH Goal" value="—" />
              </div>
            </div>

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

            <div className="stat-card">
              <div className="stat-card-label">Referrals</div>
              <div className="stat-card-value" style={{ color: 'var(--text)' }}>
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

            <div className="stat-card">
              <div className="stat-card-label">Policies / HH</div>
              <div className={`stat-card-value ${polGood ? 'good' : 'bad'}`}>
                {data.polPerHH.toFixed(2)}
              </div>
              <div className="stat-card-meta">
                <MetaRow label="Target" value={GOALS.polPerHH.toFixed(1)} />
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-label">Dials</div>
              <div className="stat-card-value neutral">
                {data.dials}
              </div>
              <div className="stat-card-meta">
                <MetaRow label="Avg / day" value="0.0" />
              </div>
            </div>

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
    </div>
  );
}
