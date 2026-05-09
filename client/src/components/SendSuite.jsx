import { useState } from 'react';
import { Zap, FileText, Mail, MessageCircle, Copy, Edit2, Check } from 'lucide-react';

const CALL_TYPES = ['New Quote', 'Follow Up', 'Referral'];
const PRODUCTS   = ['Auto Only', 'Home Only', 'Auto + Home Bundle', 'Life', 'Bundle + Life'];
const TONES      = ['Warm & Friendly', 'Professional', 'Direct'];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }
  return (
    <button className="output-action-btn" onClick={handleCopy} title="Copy to clipboard">
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function OutputCard({ title, icon: Icon, content, subContent, copyText }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(content || '');

  const textToCopy = copyText || (subContent ? `${subContent}\n\n${content}` : content) || '';

  return (
    <div className="output-card">
      <div className="output-card-header">
        <div className="output-card-title">
          <Icon size={14} />
          {title}
        </div>
        <div className="output-card-actions">
          <CopyButton text={editing ? editVal : textToCopy} />
          <button
            className="output-action-btn"
            onClick={() => { setEditing(e => !e); setEditVal(content || ''); }}
          >
            <Edit2 size={12} />
            {editing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      <div className="output-card-body">
        {subContent && (
          <div className="output-email-subject">
            Subject: <span>{subContent}</span>
          </div>
        )}
        {editing ? (
          <textarea
            className="output-card-body editable"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            style={{ width: '100%', minHeight: 120, background: 'transparent', border: '1px dashed #FFB800', borderRadius: 6, padding: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.65, resize: 'vertical' }}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{content}</div>
        )}
      </div>
    </div>
  );
}

export default function SendSuite({ people }) {
  const producers = people.filter(p => p.role === 'Producer');

  const [form, setForm] = useState({
    producer:   producers[0]?.name || 'Jayce',
    clientName: '',
    callType:   CALL_TYPES[0],
    product:    PRODUCTS[0],
    premium:    '',
    notes:      '',
    tone:       TONES[0],
  });

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleGenerate() {
    if (!form.clientName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="send-page">
      <div className="send-page-header">
        <div className="page-title">
          <Zap size={20} />
          Send Suite
        </div>
        <div className="page-subtitle">AI-powered post-call follow-up generator</div>
      </div>

      <div className="send-layout">
        {/* Left: Input form */}
        <div className="send-left">
          <div className="form-group">
            <label className="form-label">Producer</label>
            <select className="form-select" value={form.producer} onChange={e => set('producer', e.target.value)}>
              {producers.map(p => <option key={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Client First Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Sarah"
              value={form.clientName}
              onChange={e => set('clientName', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Call Type</label>
            <select className="form-select" value={form.callType} onChange={e => set('callType', e.target.value)}>
              {CALL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Product Discussed</label>
            <select className="form-select" value={form.product} onChange={e => set('product', e.target.value)}>
              {PRODUCTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Quote Premium ($)</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. 1,450"
              value={form.premium}
              onChange={e => set('premium', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Key Notes from Call</label>
            <textarea
              className="form-textarea"
              placeholder="Paste Krisp notes or key details here..."
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tone</label>
            <select className="form-select" value={form.tone} onChange={e => set('tone', e.target.value)}>
              {TONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading || !form.clientName.trim()}
          >
            <Zap size={16} />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Right: Outputs */}
        <div className="send-right">
          {error && (
            <div className="send-error">
              Error: {error}
            </div>
          )}

          {loading && (
            <div className="send-empty">
              <div className="loading-spinner" style={{ width: 32, height: 32, borderTopColor: '#FFB800' }} />
              <p>Generating your follow-up content...</p>
            </div>
          )}

          {!loading && !result && !error && (
            <div className="send-empty">
              <Zap size={48} />
              <p>
                Fill out the form and click <strong>Generate</strong> to create<br />
                AgencyZoom notes, a follow-up email, and text message.
              </p>
            </div>
          )}

          {result && (
            <>
              {result.az_notes && (
                <OutputCard
                  title="AgencyZoom Notes"
                  icon={FileText}
                  content={result.az_notes}
                />
              )}
              {result.email && (
                <OutputCard
                  title="Follow-Up Email"
                  icon={Mail}
                  content={result.email.body}
                  subContent={result.email.subject}
                  copyText={`Subject: ${result.email.subject}\n\n${result.email.body}`}
                />
              )}
              {result.text_message && (
                <OutputCard
                  title="Follow-Up Text"
                  icon={MessageCircle}
                  content={result.text_message}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
