import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { LayoutDashboard, Zap, CheckSquare, BarChart2, MessageSquare, Trophy } from 'lucide-react';
import Sidebar from './components/Sidebar';
import CommandCenter from './components/CommandCenter';
import SendSuite from './components/SendSuite';
import ActivityTracker from './components/ActivityTracker';
import MyStats from './components/MyStats';
import CoachsCorner from './components/CoachsCorner';
import TrophyCase from './components/TrophyCase';
import LoginScreen from './components/LoginScreen';
import { getLocalDateString } from './utils/folio';
import './App.css';

const MOBILE_NAV = [
  { id: 'command',  label: 'Home',     Icon: LayoutDashboard },
  { id: 'send',     label: 'Send',     Icon: Zap             },
  { id: 'activity', label: 'Activity', Icon: CheckSquare     },
  { id: 'stats',    label: 'Stats',    Icon: BarChart2       },
  { id: 'coach',    label: 'Coach',    Icon: MessageSquare   },
  { id: 'trophy',   label: 'Trophy',   Icon: Trophy          },
];

function MobileNav({ activeTab, onNavigate }) {
  return (
    <nav className="mobile-bottom-nav">
      {MOBILE_NAV.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`mobile-nav-btn${activeTab === id ? ' active' : ''}`}
          onClick={() => onNavigate(id)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

const socket = io();

const PEOPLE = [
  { id: 'jayce',  name: 'Jayce',  role: 'Producer', photo: '/jayce.png',  racePhoto: '/race-jayce.png'  },
  { id: 'alissa', name: 'Alissa', role: 'Producer', photo: '/alissa.png', racePhoto: '/race-alissa.png' },
  { id: 'dan',    name: 'Dan',    role: 'CSR',      photo: '/dan.png',    racePhoto: '/race-dan.png'    },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const [activeTab, setActiveTab] = useState('command');
  const [weekData, setWeekData]   = useState(null);
  const [kpiData,  setKpiData]    = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('transitioning');
    setTimeout(() => document.documentElement.classList.remove('transitioning'), 350);
    setTheme(next);
  }

  function handleLogin(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
  }

  function handleLogout() {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  }

  const today = getLocalDateString();

  const fetchData = useCallback(async () => {
    try {
      const [weekRes, kpiRes] = await Promise.all([
        fetch(`/api/week?date=${today}`),
        fetch(`/api/kpi?date=${today}`),
      ]);
      const [week, kpi] = await Promise.all([weekRes.json(), kpiRes.json()]);
      setWeekData(week);
      setKpiData(kpi);
      setRefreshTick(t => t + 1);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    fetchData();
    socket.on('refresh', fetchData);
    return () => socket.off('refresh', fetchData);
  }, [fetchData, currentUser]);

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Loading Agency Tracker...</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {activeTab === 'command'  && <CommandCenter weekData={weekData} kpiData={kpiData} people={PEOPLE} theme={theme} />}
        {activeTab === 'send'     && <SendSuite people={PEOPLE} currentUser={currentUser} />}
        {activeTab === 'activity' && <ActivityTracker people={PEOPLE} currentUser={currentUser} today={today} onRefresh={fetchData} kpiData={kpiData} refreshTick={refreshTick} weekData={weekData} />}
        {activeTab === 'stats'    && <MyStats kpiData={kpiData} people={PEOPLE} />}
        {activeTab === 'coach'    && <CoachsCorner people={PEOPLE} />}
        {activeTab === 'trophy'   && <TrophyCase weekData={weekData} kpiData={kpiData} people={PEOPLE} />}
      </main>
      <MobileNav activeTab={activeTab} onNavigate={setActiveTab} />
    </div>
  );
}
