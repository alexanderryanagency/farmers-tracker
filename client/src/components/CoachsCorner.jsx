import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Zap, TrendingUp, Star, Phone, Trash2, Pencil } from 'lucide-react';

const FEATURES = [
  { icon: Phone,      label: 'Auto-detect objections from call transcripts' },
  { icon: MessageSquare, label: 'Personalized coaching tips per objection type' },
  { icon: TrendingUp, label: 'Weekly improvement trends' },
  { icon: Star,       label: 'Call score out of 100' },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CoachsCorner({ people }) {
  const today = new Date().toISOString().split('T')[0];

  const [selectedPerson, setSelectedPerson] = useState(people[0]?.name || '');
  const [date,     setDate]     = useState(today);
  const [notes,    setNotes]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [coachNotes, setCoachNotes] = useState([]);
  const [editNote, setEditNote] = useState(null);
  const [editText, setEditText] = useState('');

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/coaching');
      setCoachNotes(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function handleSave() {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producer: selectedPerson, date, notes }),
      });
      setNotes('');
      fetchNotes();
    } catch {}
    setSaving(false);
  }

  async function handleDelete(id) {
    await fetch(`/api/coaching/${id}`, { method: 'DELETE' });
    fetchNotes();
  }

  function openEdit(note) {
    setEditNote(note);
    setEditText(note.notes);
  }

  async function saveEdit() {
    if (!editNote || !editText.trim()) return;
    await fetch(`/api/coaching/${editNote.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: editText.trim() }),
    });
    setEditNote(null);
    fetchNotes();
  }

  const filteredNotes = coachNotes.filter(n => n.producer === selectedPerson);

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Photo tab bar — all 3 people */}
      <div className="photo-tab-bar">
        {people.map(p => (
          <button
            key={p.id}
            className={`photo-tab-btn${selectedPerson === p.name ? ' active' : ''}`}
            onClick={() => setSelectedPerson(p.name)}
          >
            <img src={p.photo} alt={p.name} />
            {p.name}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="coach-page">
        <div className="page-header" style={{ padding: 0 }}>
          <div className="page-title">
            <MessageSquare size={20} />
            Coach's Corner
          </div>
          <div className="page-subtitle">AI-powered call analysis and objection tracking</div>
        </div>

        {/* Coming soon */}
        <div className="coming-soon-card">
          <div>
            <div className="coming-soon-badge">
              <Zap size={11} />
              Coming Soon
            </div>
            <div className="coming-soon-title" style={{ marginTop: 12 }}>Full AI Coaching Platform</div>
            <div className="coming-soon-sub">
              We're building a powerful call analysis system that automatically identifies objection patterns and generates personalized coaching insights for each producer.
            </div>
          </div>
          <div className="features-list">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="feature-item">
                <Icon size={15} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Add note form */}
        <div className="coaching-form">
          <div className="coaching-form-title">Add Note for {selectedPerson}</div>
          <div className="coaching-form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Call Notes / Feedback</label>
            <textarea
              className="form-textarea"
              placeholder="Enter coaching notes, feedback, or observations from the call..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ minHeight: 100 }}
            />
          </div>
          <button
            className="coaching-save-btn"
            onClick={handleSave}
            disabled={saving || !notes.trim()}
          >
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>

        {/* Notes for selected person */}
        {filteredNotes.length > 0 ? (
          <div>
            <div className="section-title">Notes — {selectedPerson}</div>
            <div className="coaching-notes-list">
              {filteredNotes.map(note => (
                <div key={note.id} className="coaching-note-card">
                  <div className="coaching-note-meta">
                    <div className="coaching-note-producer">{note.producer}</div>
                    <div className="coaching-note-date">{formatDate(note.createdAt || note.date)}</div>
                  </div>
                  <div className="coaching-note-body">{note.notes}</div>
                  <div className="coaching-note-actions">
                    <button className="coaching-note-edit-btn" onClick={() => openEdit(note)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="coaching-note-delete" onClick={() => handleDelete(note.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 24 }}>
            <MessageSquare size={36} />
            <p>No coaching notes for {selectedPerson} yet.<br />Add your first note above.</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editNote && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setEditNote(null)}>
          <div className="modal">
            <div className="modal-tag">{editNote.producer} · {formatDate(editNote.createdAt || editNote.date)}</div>
            <div className="modal-title">Edit Coaching Note</div>
            <textarea
              className="modal-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              style={{ minHeight: 120, resize: 'vertical' }}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setEditNote(null)}>Cancel</button>
              <button className="modal-confirm" onClick={saveEdit} disabled={!editText.trim()}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
