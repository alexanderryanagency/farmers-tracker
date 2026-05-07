import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const socket = io();

const PEOPLE = {
  jayce:  { name: 'Jayce',  photo: '/jayce.png'  },
  alissa: { name: 'Alissa', photo: '/alissa.png' },
  dan:    { name: 'Dan',    photo: '/dan.png'    },
};

function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function LogTab() {
  const [log, setLog]           = useState([]);
  const [editEntry, setEditEntry] = useState(null);
  const [editClient, setEditClient]   = useState('');
  const [editPremium, setEditPremium] = useState('');
  const [editPolicies, setEditPolicies] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const fetchLog = useCallback(async () => {
    const res = await fetch('/api/log');
    setLog(await res.json());
  }, []);

  useEffect(() => {
    fetchLog();
    socket.on('refresh', fetchLog);
    return () => socket.off('refresh', fetchLog);
  }, [fetchLog]);

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
    <div className="log-tab">
      <div className="log-header">
        <div className="log-header-row">
          <div>
            <div className="log-title">Manager Log</div>
            <div className="log-subtitle">Verified activity — {log.length} {log.length === 1 ? 'entry' : 'entries'}</div>
          </div>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="log-empty">
          No verified entries yet.<br />
          Completing tasks like Life Sales and Referrals will appear here.
        </div>
      ) : (
        <div className="log-table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Task</th>
                <th>Client</th>
                <th>Premium</th>
                <th># Pol</th>
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
                    <td className="log-policies">{entry.numPolicies != null ? entry.numPolicies : '—'}</td>
                    <td className="log-date">{formatDate(entry.date)}</td>
                    <td className="log-time">{entry.time}</td>
                    <td className="log-actions">
                      {confirmingDelete ? (
                        <div className="log-delete-confirm">
                          <span className="log-sure">Sure?</span>
                          <button className="log-action-yes" onClick={confirmDelete}>Yes</button>
                          <button className="log-action-no" onClick={() => setDeleteId(null)}>No</button>
                        </div>
                      ) : (
                        <div className="log-action-btns">
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

      {/* Edit modal */}
      {editEntry && (
        <div className="verify-overlay" onClick={e => e.target === e.currentTarget && setEditEntry(null)}>
          <div className="verify-modal">
            <div className="verify-task-name">{editEntry.taskLabel} · {formatDate(editEntry.date)}</div>
            <div className="verify-title">Edit Entry</div>
            <input
              className="verify-input"
              type="text"
              placeholder="Client name"
              value={editClient}
              onChange={e => setEditClient(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveEdit()}
              autoFocus
            />
            <input
              className="verify-input"
              type="text"
              placeholder="Premium amount"
              value={editPremium}
              onChange={e => setEditPremium(e.target.value)}
            />
            <input
              className="verify-input"
              type="number"
              placeholder="Number of policies"
              value={editPolicies}
              onChange={e => setEditPolicies(e.target.value)}
              min="1"
            />
            <div className="verify-actions">
              <button className="verify-cancel" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="verify-confirm" onClick={saveEdit} disabled={!editClient.trim()}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
