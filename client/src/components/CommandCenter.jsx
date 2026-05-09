import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const WEEKLY_GOAL = 50;

const CHART_DATA = [
  { month: 'Feb', Jayce: 6800, Alissa: 5900 },
  { month: 'Mar', Jayce: 7400, Alissa: 8200 },
  { month: 'Apr', Jayce: 9100, Alissa: 8900 },
  { month: 'May', Jayce: 8055, Alissa: 8478 },
];

function fmt$(n) {
  if (!n) return '$0';
  const num = parseFloat(String(n).replace(/[$,\s]/g, ''));
  if (isNaN(num)) return '$0';
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}k`;
  return `$${Math.round(num)}`;
}

function buildTeamKpi(people, kpiData) {
  if (!kpiData) return null;
  const producers = people.filter(p => p.role === 'Producer');
  const pkpis = producers.map(p => kpiData.data?.[p.id]).filter(Boolean);
  if (!pkpis.length) return null;

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
    closeRate: totalConv > 0 ? (totalHH / totalConv) * 100 : 0,
    policiesPerHH: totalHH > 0 ? totalPol / totalHH : 0,
    premiumPace: pkpis.reduce((s, k) => s + k.premiumPace, 0),
    avgConvPerDay: totalActive > 0 ? totalConv / totalActive : 0,
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];
const CAR_COLORS = ['#FFB800', '#CC0000', '#8B9BC1'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 2 }}>
          {p.name}: ${p.value.toLocaleString()}
        </div>
      ))}
    </div>
  );
};

export default function CommandCenter({ weekData, kpiData, people }) {
  const teamKpi = buildTeamKpi(people, kpiData);

  const ranked = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)
    : people.map(p => ({ ...p, points: 0 }));

  const kpiCards = [
    {
      label: 'New Conversations',
      display: String(teamKpi?.totalConversations ?? 0),
      goal: 'goal: 60 / folio',
      good: (teamKpi?.totalConversations ?? 0) >= 40,
    },
    {
      label: 'Close Rate',
      display: `${(teamKpi?.closeRate ?? 0).toFixed(1)}%`,
      goal: 'goal: 25%',
      good: (teamKpi?.closeRate ?? 0) >= 25,
    },
    {
      label: 'Policies / HH',
      display: teamKpi?.totalHouseholds ? (teamKpi.policiesPerHH).toFixed(2) : '—',
      goal: 'goal: 1.5',
      good: (teamKpi?.policiesPerHH ?? 0) >= 1.5,
    },
    {
      label: 'Premium Written',
      display: fmt$(teamKpi?.totalPremium ?? 0),
      goal: 'goal: $60k combined',
      good: (teamKpi?.totalPremium ?? 0) >= 60000,
    },
  ];

  const kpiCards2 = [
    {
      label: 'Total Premium',
      display: fmt$(teamKpi?.totalPremium ?? 0),
      sub: `projected: ${fmt$(teamKpi?.premiumPace ?? 0)}`,
    },
    {
      label: 'Total Conversations',
      display: String(teamKpi?.totalConversations ?? 0),
      sub: `${(teamKpi?.avgConvPerDay ?? 0).toFixed(1)} avg / day`,
    },
    {
      label: 'Close Rate',
      display: `${(teamKpi?.closeRate ?? 0).toFixed(1)}%`,
      sub: `${teamKpi?.totalHouseholds ?? 0} HH closed`,
    },
    {
      label: 'Policies / HH',
      display: teamKpi?.totalHouseholds ? (teamKpi.policiesPerHH).toFixed(2) : '—',
      sub: `${teamKpi?.totalPolicies ?? 0} policies total`,
    },
  ];

  return (
    <div className="command-page">
      {/* Row 1: Goal-tracking KPI cards */}
      <div className="kpi-row">
        {kpiCards.map(card => (
          <div key={card.label} className={`kpi-card ${card.good ? 'good' : 'bad'}`}>
            <div className="kpi-card-label">{card.label}</div>
            <div className={`kpi-card-value ${card.good ? 'good' : 'bad'}`}>{card.display}</div>
            <div className="kpi-card-goal">{card.goal}</div>
          </div>
        ))}
      </div>

      {/* Horizontal Race Track */}
      <div className="race-section">
        <div className="section-title">Weekly Leaderboard — Race to 50 pts</div>
        <div className="horiz-race">
          <div className="race-pct-header">
            <div className="race-pct-spacer" />
            <div className="race-pct-labels">
              {[25, 50, 75].map(pct => (
                <span key={pct} className="race-pct-label" style={{ left: `${pct}%` }}>{pct}%</span>
              ))}
            </div>
            <div className="race-pct-end" />
          </div>

          {ranked.map((person, i) => {
            const pct = Math.min(person.points / WEEKLY_GOAL, 1);
            const color = CAR_COLORS[i] || '#8B9BC1';
            const carLeft = Math.max(2, Math.min(pct * 100, 97));

            return (
              <div key={person.id} className="race-lane">
                <div className="lane-person-info">
                  <span className="lane-medal">{MEDALS[i]}</span>
                  <img src={person.photo} alt={person.name} className="lane-photo" style={{ borderColor: color }} />
                  <span className="lane-name">{person.name}</span>
                </div>

                <div className="lane-track-wrap">
                  <div className="lane-track-bg">
                    <div
                      className="lane-track-fill"
                      style={{ width: `${pct * 100}%`, background: color, opacity: 0.28 }}
                    />
                    {[25, 50, 75].map(m => (
                      <div key={m} className="lane-marker" style={{ left: `${m}%` }} />
                    ))}
                    <div className="lane-finish-line" />
                  </div>
                  <div className="lane-car" style={{ left: `${carLeft}%` }}>
                    <img src={person.photo} alt={person.name} className="lane-car-photo" style={{ borderColor: color }} />
                  </div>
                </div>

                <span className="lane-flag">🏁</span>
                <div className="lane-pts-col">
                  <div style={{ color, fontWeight: 800 }}>{person.points} pts</div>
                  <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--muted)' }}>/ {WEEKLY_GOAL} goal</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 2: Raw folio metrics */}
      <div className="kpi-row">
        {kpiCards2.map(card => (
          <div key={card.label} className="kpi-card">
            <div className="kpi-card-label">{card.label}</div>
            <div className="kpi-card-value" style={{ color: 'var(--text)' }}>{card.display}</div>
            <div className="kpi-card-goal">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Premium Chart */}
      <div className="chart-section">
        <div className="section-title">Monthly Premium — Producer Comparison</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={CHART_DATA} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: 'var(--muted)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)', paddingTop: 8 }} />
            <Bar dataKey="Jayce"  fill="#FFB800" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Alissa" fill="#CC0000" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
