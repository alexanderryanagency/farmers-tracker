import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Trophy } from 'lucide-react';
import SpinWheel from './SpinWheel';

const socket = io();

const PEOPLE = {
  jayce:  { name: 'Jayce',  photo: '/jayce.png'  },
  alissa: { name: 'Alissa', photo: '/alissa.png' },
  dan:    { name: 'Dan',    photo: '/dan.png'    },
};

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TrophyCase({ weekData, people }) {
  const [showWheel, setShowWheel] = useState(false);
  const [log,       setLog]       = useState([]);
  const [editEntry, setEditEntry] = useState(null);
  const [editClient,   setEditClient]   = useState('');
  const [editPremium,  setEditPremium]  = useState('');
  const [editPolicies, setEditPolicies] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch('/api/log');
      setLog(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchLog();
    socket.on('refresh', fetchLog);
    return () => socket.off('refresh', fetchLog);
  }, [fetchLog]);

  // Weekly leader for spin wheel chip
  const leader = weekData
    ? [...people]
        .map(p => ({ ...p, points: weekData.data[p.id]?.points || 0 }))
        .sort((a, b) => b.points - a.points)[0]
    : null;

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
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await fetch(`/api/log/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
  }

  return (
    <div className="trophy-page">
      <div className="trophy-split">
        {/* Left: Spin wheel */}
        <div className="trophy-left">
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
            <div style={{ textAlign: 'center', color: '#8B9BC1', fontSize: 12, lineHeight: 1.6 }}>
              Spin the wheel to reveal this week's prize for the top performer.
            </div>
            <button className="spin-go-btn" onClick={() => setShowWheel(true)}>
              <Trophy size={16} />
              Spin The Winner
            </button>
          </div>
        </div>

        {/* Right: Sales Log */}
        <div className="trophy-right">
          <div className="trophy-right-header">
            <div className="trophy-right-title">Sales Log</div>
            <div className="trophy-right-count">{log.length} {log.length === 1 ? 'entry' : 'entries'}</div>
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
                    <th>Producer</th>
                    <th>Task</th>
                    <th>Client</th>
                    <th>Premium</th>
                    <th>Pol</th>
                    <th>HH</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(entry => {
                    const person = PEOPLE[entry.person];
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
        <div className="overlay log-edit-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="modal">
            <div className="modal-tag">{editEntry.taskLabel} · {formatDate(editEntry.date)}</div>
            <div className="modal-title">Edit Entry</div>
            <input
              className="modal-input"
              type="text"
              placeholder="Client name"
              value={editClient}
              onChange={e => setEditClient(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              autoFocus
            />
            <input
              className="modal-input"
              type="text"
              placeholder="Premium amount"
              value={editPremium}
              onChange={e => setEditPremium(e.target.value)}
            />
            <input
              className="modal-input"
              type="number"
              placeholder="Number of policies"
              value={editPolicies}
              onChange={e => setEditPolicies(e.target.value)}
              min="1"
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="modal-confirm" onClick={saveEdit} disabled={!editClient.trim()}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showWheel && <SpinWheel onClose={() => setShowWheel(false)} />}
    </div>
  );
}
