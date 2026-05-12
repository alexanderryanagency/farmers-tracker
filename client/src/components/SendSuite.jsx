import { useState, useEffect, useRef } from 'react';
import { Zap, FileText, Mail, MessageCircle, Copy, Edit2, Check, Send, X } from 'lucide-react';

const PRODUCTS = ['Auto Only', 'Home Only', 'Auto + Home Bundle', 'Life', 'Bundle + Life'];
const TONES    = ['Warm & Friendly', 'Professional', 'Direct'];

// ── Toast system ──────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  function addToast(message, type = 'success') {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }
  return { toasts, addToast };
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

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

// ── Output card ───────────────────────────────────────────────────────────────

function OutputCard({ title, icon: Icon, content, subContent, copyText, onApprove, approveLabel, approving, approved, bodyStyle, editMinHeight }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState('');

  useEffect(() => { setEditVal(content || ''); }, [content]);

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
            onClick={() => { setEditing(e => !e); if (!editing) setEditVal(content || ''); }}
          >
            <Edit2 size={12} />
            {editing ? 'Done' : 'Edit'}
          </button>
          {onApprove && (
            <button
              className="approve-send-btn"
              onClick={() => onApprove(editing ? editVal : content, subContent)}
              disabled={approving || approved}
            >
              {approved ? <><Check size={12} /> Sent</> : approving ? 'Sending…' : <><Send size={12} /> {approveLabel || 'Approve & Send'}</>}
            </button>
          )}
        </div>
      </div>
      <div className="output-card-body" style={bodyStyle}>
        {subContent && (
          <div className="output-email-subject">
            Subject: <span>{subContent}</span>
          </div>
        )}
        {editing ? (
          <textarea
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            style={{
              width: '100%', minHeight: editMinHeight || 120, background: 'transparent',
              border: '1px dashed #FFB800', borderRadius: 6, padding: 8,
              color: 'var(--text)', fontFamily: 'inherit', fontSize: 13,
              lineHeight: 1.65, resize: 'vertical',
            }}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{editing ? editVal : content}</div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SendSuite({ people, currentUser }) {
  const producers = people.filter(p => p.role === 'Producer');
  const isAdmin   = currentUser?.role === 'admin';

  const defaultProducer = isAdmin
    ? producers[0]?.name || ''
    : producers.find(p => p.id === currentUser?.producer)?.name || producers[0]?.name || '';

  const [producerName, setProducerName] = useState(defaultProducer);

  // Client search state
  const [clientName,    setClientName]    = useState('');
  const [clientEmail,   setClientEmail]   = useState('');
  const [selectedLead,  setSelectedLead]  = useState(null);  // { id, customerName, customerPhone }
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchTimerRef = useRef(null);
  const dropdownRef    = useRef(null);

  // Form state
  const [product,     setProduct]     = useState(PRODUCTS[2]);
  const [autoPremium, setAutoPremium] = useState('');
  const [homePremium, setHomePremium] = useState('');
  const [notes,       setNotes]       = useState('');
  const [tone,        setTone]        = useState(TONES[0]);

  // Output state
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  // AZ send state
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);
  const [textSending,  setTextSending]  = useState(false);
  const [textSent,     setTextSent]     = useState(false);

  const { toasts, addToast } = useToasts();

  const hasAuto = ['Auto Only', 'Auto + Home Bundle', 'Bundle + Life'].includes(product);
  const hasHome = ['Home Only', 'Auto + Home Bundle', 'Bundle + Life'].includes(product);

  const firstName = clientName.trim().split(' ')[0];

  useEffect(() => {
    setEmailSent(false);
    setTextSent(false);
  }, [result]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleClientNameChange(e) {
    const val = e.target.value;
    setClientName(val);
    setSelectedLead(null);
    clearTimeout(searchTimerRef.current);
    if (val.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/az/leads?search=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Lead search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function selectLead(lead) {
    setSelectedLead(lead);
    setClientName(lead.customerName);
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearLead() {
    setSelectedLead(null);
    setClientName('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  async function handleGenerate() {
    if (!clientName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res  = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer:    producerName,
          clientName:  firstName,
          clientEmail,
          product,
          autoPremium: hasAuto ? autoPremium : '',
          homePremium: hasHome ? homePremium : '',
          notes,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate');
      setResult(data);

      if (selectedLead?.id) {
        postToAZ(selectedLead.id, data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function isEmailTextTask(title) {
    return /send.*(email|text|sms)|email.*follow|follow.*email|text.*follow|follow.*text/i.test(title || '');
  }

  async function postToAZ(leadId, data) {
    const results = await Promise.allSettled([
      fetch(`/api/az/leads/${leadId}/notes`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: data.az_notes }),
      }).then(r => r.json()),

      ...(data.tasks || [])
        .filter(t => !isEmailTextTask(t.title))
        .map(t =>
          fetch(`/api/az/leads/${leadId}/tasks`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: t.title, due_date: t.due_date }),
          }).then(r => r.json())
        ),
    ]);

    const noteOk = results[0].status === 'fulfilled' && !results[0].value?.error;
    noteOk
      ? addToast('✅ Notes posted to AgencyZoom')
      : addToast('⚠️ Notes failed to post — copy manually', 'error');

    const taskResults = results.slice(1);
    if (taskResults.length > 0) {
      const allOk = taskResults.every(r => r.status === 'fulfilled' && !r.value?.error);
      allOk
        ? addToast('✅ Tasks created in AgencyZoom')
        : addToast('⚠️ Some tasks failed to create', 'error');
    }
  }

  async function handleApproveEmail(body, subject) {
    setEmailSending(true);
    try {
      const requests = [
        fetch('/api/send-email', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName:   clientName,
            clientEmail:  clientEmail,
            producer:     producerName,
            emailSubject: subject,
            emailBody:    body,
          }),
        }),
      ];
      if (selectedLead?.id) {
        requests.push(fetch(`/api/az/leads/${selectedLead.id}/email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        }));
      }
      await Promise.all(requests);
      setEmailSent(true);
      addToast('✅ Email sent');
    } catch (err) {
      addToast(`⚠️ Email send failed: ${err.message}`, 'error');
    } finally {
      setEmailSending(false);
    }
  }

  async function handleApproveText(message) {
    setTextSending(true);
    try {
      const requests = [
        fetch('/api/send-text', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName:  clientName,
            clientEmail: clientEmail,
            producer:    producerName,
            textMessage: message,
          }),
        }),
      ];
      if (selectedLead?.id) {
        requests.push(fetch(`/api/az/leads/${selectedLead.id}/text`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        }));
      }
      await Promise.all(requests);
      setTextSent(true);
      addToast('✅ Text sent');
    } catch (err) {
      addToast(`⚠️ Text send failed: ${err.message}`, 'error');
    } finally {
      setTextSending(false);
    }
  }

  return (
    <div className="send-page">
      <ToastContainer toasts={toasts} />

      <div className="send-page-header">
        <div className="page-title">
          <Zap size={20} />
          Send Suite
        </div>
        <div className="page-subtitle">AI-powered post-call follow-up generator</div>
      </div>

      <div className="send-layout">
        {/* ── Left panel ───────────────────────────────────────────────── */}
        <div className="send-left">

          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Producer</label>
              <select className="form-select" value={producerName} onChange={e => setProducerName(e.target.value)}>
                {producers.map(p => <option key={p.id}>{p.name}</option>)}
                <option key="arb">Alexander (ARB)</option>
              </select>
            </div>
          )}

          <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
            <label className="form-label">Client Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type="text"
                placeholder="Type to search AgencyZoom…"
                value={clientName}
                onChange={handleClientNameChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                autoComplete="off"
              />
              {(selectedLead || clientName) && (
                <button
                  onClick={clearLead}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2,
                  }}
                  title="Clear"
                ><X size={14} /></button>
              )}
            </div>
            {selectedLead && (
              <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>
                ✓ Linked: {selectedLead.customerName}{selectedLead.customerPhone ? ` · ${selectedLead.customerPhone}` : ''}
              </div>
            )}
            {searching && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Searching…</div>
            )}
            {showDropdown && searchResults.length > 0 && (
              <div className="lead-search-dropdown">
                {searchResults.map(lead => (
                  <button key={lead.id} className="lead-result-item" onMouseDown={() => selectLead(lead)}>
                    <span className="lead-result-name">{lead.customerName}</span>
                    {lead.customerPhone && <span className="lead-result-phone">{lead.customerPhone}</span>}
                  </button>
                ))}
              </div>
            )}
            {showDropdown && !searching && searchResults.length === 0 && clientName.trim().length >= 3 && (
              <div className="lead-search-dropdown">
                <div className="lead-no-results">No leads found</div>
              </div>
            )}
          </div>


          <div className="form-group">
            <label className="form-label">Client Email <span style={{ color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
            <input
              className="form-input"
              type="email"
              placeholder="client@email.com"
              value={clientEmail}
              onChange={e => setClientEmail(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Product Discussed</label>
            <select className="form-select" value={product} onChange={e => setProduct(e.target.value)}>
              {PRODUCTS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>

          {hasAuto && (
            <div className="form-group">
              <label className="form-label">Auto Premium ($)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 142"
                value={autoPremium}
                onChange={e => setAutoPremium(e.target.value)}
              />
            </div>
          )}

          {hasHome && (
            <div className="form-group">
              <label className="form-label">Home Premium ($)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 1450"
                value={homePremium}
                onChange={e => setHomePremium(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Key Notes from Call</label>
            <textarea
              className="form-textarea"
              placeholder="Paste Krisp notes here…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ minHeight: 150 }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tone</label>
            <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
              {TONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={loading || !clientName.trim()}
          >
            <Zap size={16} />
            {loading ? 'Generating…' : 'Generate & Update AgencyZoom'}
          </button>

          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: -6 }}>
              Generating your follow-ups…
            </div>
          )}
        </div>

        {/* ── Right panel ──────────────────────────────────────────────── */}
        <div className="send-right">
          {error && <div className="send-error">Error: {error}</div>}

          {loading && (
            <div className="send-empty">
              <div className="loading-spinner" style={{ width: 36, height: 36, borderTopColor: '#FFB800' }} />
              <p>Generating your follow-ups…<br /><span style={{ fontSize: 11 }}>This takes 3–8 seconds</span></p>
            </div>
          )}

          {!loading && !result && !error && (
            <div className="send-empty">
              <Zap size={48} />
              <p>
                Fill in the form and click <strong>Generate & Update AgencyZoom</strong><br />
                to create call notes, a follow-up email, and text message.
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              {result.az_notes && (
                <OutputCard
                  title="AgencyZoom Notes"
                  icon={FileText}
                  content={result.az_notes}
                  bodyStyle={{}}
                />
              )}
              {result.email && (
                <OutputCard
                  title="Follow-Up Email"
                  icon={Mail}
                  content={result.email.body}
                  subContent={result.email.subject}
                  copyText={`Subject: ${result.email.subject}\n\n${result.email.body}`}
                  onApprove={handleApproveEmail}
                  approveLabel="Approve & Send"
                  approving={emailSending}
                  approved={emailSent}
                  bodyStyle={{ minHeight: 300 }}
                  editMinHeight={300}
                />
              )}
              {result.text && (
                <OutputCard
                  title="Follow-Up Text"
                  icon={MessageCircle}
                  content={result.text}
                  onApprove={(msg) => handleApproveText(msg)}
                  approveLabel="Approve & Send"
                  approving={textSending}
                  approved={textSent}
                  bodyStyle={{ minHeight: 120 }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
