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

// Race track positions around an ellipse
function getCarPos(pct, cx, cy, rx, ry) {
  const angle = -Math.PI / 2 + 2 * Math.PI * Math.min(pct, 0.98);
  return {
    x: cx + rx * Math.cos(angle),
    y: cy + ry * Math.sin(angle),
  };
}

const MEDALS = ['🥇', '🥈', '🥉'];
const CAR_COLORS = ['#FFB800', '#8B9BC1', '#CC0000'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1A2540', border: '1px solid #2A3558',
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 11, color: '#8B9BC1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
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

  // Race track dimensions
  const CX = 270, CY = 152;
  const ORX = 245, ORY = 118;
  const IRX = 170, IRY = 52;
  const MRX = (ORX + IRX) / 2;
  const MRY = (ORY + IRY) / 2;

  const finishY = CY - ORY;

  // KPI cards data
  const kpiCards = [
    {
      label: 'New Conversations',
      value: teamKpi?.totalConversations ?? 0,
      display: String(teamKpi?.totalConversations ?? 0),
      goal: 'goal: 60 / folio',
      good: (teamKpi?.totalConversations ?? 0) >= 40,
    },
    {
      label: 'Close Rate',
      value: teamKpi?.closeRate ?? 0,
      display: `${(teamKpi?.closeRate ?? 0).toFixed(1)}%`,
      goal: 'goal: 25%',
      good: (teamKpi?.closeRate ?? 0) >= 25,
    },
    {
      label: 'Policies / HH',
      value: teamKpi?.policiesPerHH ?? 0,
      display: teamKpi?.totalHouseholds ? (teamKpi.policiesPerHH).toFixed(2) : '—',
      goal: 'goal: 1.5',
      good: (teamKpi?.policiesPerHH ?? 0) >= 1.5,
    },
    {
      label: 'Premium Written',
      value: teamKpi?.totalPremium ?? 0,
      display: fmt$(teamKpi?.totalPremium ?? 0),
      goal: 'goal: $60k combined',
      good: (teamKpi?.totalPremium ?? 0) >= 60000,
    },
  ];

  return (
    <div className="command-page">
      {/* KPI Cards */}
      <div className="kpi-row">
        {kpiCards.map(card => (
          <div key={card.label} className={`kpi-card ${card.good ? 'good' : 'bad'}`}>
            <div className="kpi-card-label">{card.label}</div>
            <div className={`kpi-card-value ${card.good ? 'good' : 'bad'}`}>{card.display}</div>
            <div className="kpi-card-goal">{card.goal}</div>
          </div>
        ))}
      </div>

      {/* Race Track */}
      <div className="race-section">
        <div className="section-title">Weekly Leaderboard — Race to 50 pts</div>
        <svg
          viewBox="0 0 540 304"
          className="race-track-svg"
          style={{ maxHeight: 260 }}
        >
          <defs>
            {ranked.map(p => (
              <clipPath key={p.id} id={`car-clip-${p.id}`}>
                <circle cx="0" cy="0" r="18" />
              </clipPath>
            ))}
          </defs>

          {/* Track surface */}
          <ellipse cx={CX} cy={CY} rx={ORX} ry={ORY} fill="#141E35" stroke="#2A3558" strokeWidth="2" />
          <ellipse cx={CX} cy={CY} rx={IRX} ry={IRY} fill="#0F1729" />

          {/* Inner rim */}
          <ellipse cx={CX} cy={CY} rx={IRX + 4} ry={IRY + 4} fill="none" stroke="#2A3558" strokeWidth="1" />

          {/* Lane dashes */}
          <ellipse
            cx={CX} cy={CY} rx={MRX} ry={MRY}
            fill="none" stroke="#FFB800" strokeWidth="0.75"
            strokeDasharray="12 10" opacity="0.25"
          />

          {/* 25 / 50 / 75 markers */}
          {[0.25, 0.5, 0.75].map(pct => {
            const angle = -Math.PI / 2 + 2 * Math.PI * pct;
            const x1 = CX + (IRX + 6) * Math.cos(angle);
            const y1 = CY + (IRY + 6) * Math.sin(angle);
            const x2 = CX + (ORX - 6) * Math.cos(angle);
            const y2 = CY + (ORY - 6) * Math.sin(angle);
            const lx = CX + (ORX + 18) * Math.cos(angle);
            const ly = CY + (ORY + 18) * Math.sin(angle);
            return (
              <g key={pct}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A3558" strokeWidth="1.5" strokeDasharray="4 3" />
                <text x={lx} y={ly} fill="#8B9BC1" fontSize="9" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                  {Math.round(pct * 100)}%
                </text>
              </g>
            );
          })}

          {/* Finish line at top */}
          <line
            x1={CX - 28} y1={finishY}
            x2={CX + 28} y2={finishY}
            stroke="#FFB800" strokeWidth="3"
          />
          <text x={CX} y={finishY - 8} fill="#FFB800" fontSize="9" textAnchor="middle" fontWeight="800" letterSpacing="1">
            FINISH
          </text>

          {/* Cars */}
          {ranked.map((person, i) => {
            const pct = Math.min(person.points / WEEKLY_GOAL, 0.98);
            const { x, y } = getCarPos(pct, CX, CY, MRX, MRY);
            const color = CAR_COLORS[i] || '#8B9BC1';
            return (
              <g key={person.id} transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}>
                <circle r={22} fill={color} opacity="0.2" />
                <circle r={20} fill={color} opacity="0.9" />
                <image
                  href={person.photo}
                  x={-17} y={-17} width={34} height={34}
                  clipPath={`url(#car-clip-${person.id})`}
                />
                <circle r={20} fill="none" stroke={color} strokeWidth="2" />
              </g>
            );
          })}

          {/* 0% start dot */}
          <circle cx={CX} cy={CY + ORY} r={4} fill="#2A3558" stroke="#8B9BC1" strokeWidth="1" />
          <text x={CX} y={CY + ORY + 14} fill="#8B9BC1" fontSize="9" textAnchor="middle" fontWeight="700">
            START
          </text>
        </svg>

        {/* Legend */}
        <div className="race-legend">
          {ranked.map((person, i) => (
            <div key={person.id} className="race-legend-item">
              <span className="race-legend-medal">{MEDALS[i]}</span>
              <img src={person.photo} alt={person.name} className="race-legend-photo" style={{ borderColor: CAR_COLORS[i] }} />
              <span className="race-legend-name">{person.name}</span>
              <span className="race-legend-pts">{person.points} / {WEEKLY_GOAL} pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Premium Chart */}
      <div className="chart-section">
        <div className="section-title">Monthly Premium — Producer Comparison</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={CHART_DATA} margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A3558" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#8B9BC1', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#8B9BC1', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8B9BC1', paddingTop: 8 }} />
            <Bar dataKey="Jayce"  fill="#FFB800" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="Alissa" fill="#CC0000" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
