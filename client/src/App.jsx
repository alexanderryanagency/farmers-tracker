import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import CommandCenter from './components/CommandCenter';
import SendSuite from './components/SendSuite';
import ActivityTracker from './components/ActivityTracker';
import MyStats from './components/MyStats';
import CoachsCorner from './components/CoachsCorner';
import TrophyCase from './components/TrophyCase';
import './App.css';

const socket = io();

const PEOPLE = [
  { id: 'jayce',  name: 'Jayce',  role: 'Producer', photo: '/jayce.png'  },
  { id: 'alissa', name: 'Alissa', role: 'Producer', photo: '/alissa.png' },
  { id: 'dan',    name: 'Dan',    role: 'CSR',      photo: '/dan.png'    },
];

export default function App() {
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

  const today = new Date().toISOString().split('T')[0];

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
    fetchData();
    socket.on('refresh', fetchData);
    return () => socket.off('refresh', fetchData);
  }, [fetchData]);

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
      />
      <main className="main-content">
        {activeTab === 'command'  && <CommandCenter weekData={weekData} kpiData={kpiData} people={PEOPLE} theme={theme} />}
        {activeTab === 'send'     && <SendSuite people={PEOPLE} />}
        {activeTab === 'activity' && <ActivityTracker people={PEOPLE} today={today} onRefresh={fetchData} kpiData={kpiData} refreshTick={refreshTick} weekData={weekData} />}
        {activeTab === 'stats'    && <MyStats kpiData={kpiData} people={PEOPLE} />}
        {activeTab === 'coach'    && <CoachsCorner people={PEOPLE} />}
        {activeTab === 'trophy'   && <TrophyCase weekData={weekData} kpiData={kpiData} people={PEOPLE} />}
      </main>
    </div>
  );
}
