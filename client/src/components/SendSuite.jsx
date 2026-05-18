import { useState, useEffect, useRef } from 'react';
import { Zap, FileText, Mail, MessageCircle, Copy, Edit2, Check, Send, X } from 'lucide-react';

const TONES    = ['Warm & Friendly', 'Professional', 'Direct'];
const CARRIERS = ['Farmers', 'Bristol West'];
const POLICY_TYPES_BY_CARRIER = {
  Farmers: ['Home', 'Standard Auto', 'Life'],
  'Bristol West': ['Standard Auto'],
};

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
  const [selectedLead,  setSelectedLead]  = useState(null);  // { id, fullName, firstName, lastName, email, phone }
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchTimerRef = useRef(null);
  const dropdownRef    = useRef(null);

  // Form state
  const [notes,       setNotes]       = useState('');
  const [tone,        setTone]        = useState(TONES[0]);
  const [quotePolicies, setQuotePolicies] = useState([]);
  const [quotePdf, setQuotePdf] = useState(null);

  // Output state
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [quoteExport, setQuoteExport] = useState(null);

  // AZ send state
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent,    setEmailSent]    = useState(false);
  const [textSending,  setTextSending]  = useState(false);
  const [textSent,     setTextSent]     = useState(false);

  const { toasts, addToast } = useToasts();

  const firstName = clientName.trim().split(' ')[0];
  const quotePolicyCount = quotePolicies.length;
  const quoteTotalPremium = quotePolicies.reduce((sum, policy) => {
    const amount = parseFloat(String(policy.premium || '').replace(/[$,\s]/g, ''));
    return sum + (Number.isNaN(amount) ? 0 : amount);
  }, 0);

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
    if (selectedLead) setClientEmail('');
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
        setSearchResults(Array.isArray(data) ? data.map(normalizeLead).filter(lead => lead.fullName) : []);
        setShowDropdown(true);
      } catch (err) {
        console.error('Lead search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function normalizeLead(lead) {
    const firstName = lead.firstName || lead.firstname || lead.first_name || '';
    const lastName  = lead.lastName  || lead.lastname  || lead.last_name  || '';
    return {
      id:        lead.id,
      fullName:  lead.fullName || lead.customerName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email:     lead.email || lead.primaryEmail || '',
      phone:     lead.phone || lead.customerPhone || lead.mobile_phone || '',
    };
  }

  function selectLead(lead) {
    const normalizedLead = normalizeLead(lead);
    setSelectedLead(normalizedLead);
    setClientName(normalizedLead.fullName);
    setClientEmail(normalizedLead.email || '');
    setShowDropdown(false);
    setSearchResults([]);
  }

  function clearLead() {
    setSelectedLead(null);
    setClientName('');
    setClientEmail('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  function addQuotePolicy() {
    const carrier = CARRIERS[0];
    setQuotePolicies(policies => [
      ...policies,
      {
        id: Date.now() + Math.random(),
        carrier,
        policyType: POLICY_TYPES_BY_CARRIER[carrier][0],
        premium: '',
      },
    ]);
  }

  function updateQuotePolicy(id, updates) {
    setQuotePolicies(policies => policies.map(policy => {
      if (policy.id !== id) return policy;
      const next = { ...policy, ...updates };
      if (updates.carrier) {
        next.policyType = POLICY_TYPES_BY_CARRIER[updates.carrier][0];
      }
      return next;
    }));
  }

  function removeQuotePolicy(id) {
    setQuotePolicies(policies => policies.filter(policy => policy.id !== id));
  }

  function handleQuotePdfUpload(e) {
    const file = e.target.files?.[0] || null;
    // TODO: AgencyZoom quote PDF/file upload endpoint still needs separate diagnostic.
    setQuotePdf(file);
  }

  function formatMoney(value) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }

  async function handleGenerate() {
    if (!clientName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setQuoteExport(null);

    try {
      const res  = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producer:    producerName,
          clientName:  firstName,
          clientFullName: clientName.trim(),
          clientEmail,
          leadId:      selectedLead?.id || null,
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
    const azRequests = [
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
    ];

    if (quotePolicies.length > 0) {
      azRequests.push(
        fetch(`/api/az/leads/${leadId}/quotes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policies: quotePolicies }),
        }).then(r => r.json())
      );
    }

    const results = await Promise.allSettled(azRequests);

    const noteOk = results[0].status === 'fulfilled' && !results[0].value?.error;
    noteOk
      ? addToast('✅ Notes posted to AgencyZoom')
      : addToast('⚠️ Notes failed to post — copy manually', 'error');

    const quoteResultIndex = quotePolicies.length > 0 ? results.length - 1 : null;
    const taskResults = quoteResultIndex == null ? results.slice(1) : results.slice(1, quoteResultIndex);
    if (taskResults.length > 0) {
      const allOk = taskResults.every(r => r.status === 'fulfilled' && !r.value?.error);
      allOk
        ? addToast('✅ Tasks created in AgencyZoom')
        : addToast('⚠️ Some tasks failed to create', 'error');
    }

    if (quoteResultIndex != null) {
      const quoteResult = results[quoteResultIndex];
      const value = quoteResult.status === 'fulfilled' ? quoteResult.value : { error: quoteResult.reason?.message || 'Quote export failed' };
      setQuoteExport(value);
      if (quoteResult.status === 'fulfilled' && !value.error && (value.created?.length || value.skipped?.length || value.failed?.length)) {
        const skipped = value.skipped?.length || 0;
        const failed = value.failed?.length || 0;
        const created = value.created?.length || 0;
        if (failed > 0) {
          addToast(`⚠️ Quotes: ${created} created, ${skipped} skipped, ${failed} failed`, 'error');
        } else {
          addToast(`✅ Quotes: ${created} created${skipped ? `, ${skipped} skipped` : ''}`);
        }
      } else {
        addToast(`⚠️ Quote export failed: ${value.error || 'Unknown error'}`, 'error');
      }
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
                ✓ Linked: {selectedLead.fullName}{selectedLead.email || selectedLead.phone ? ` · ${selectedLead.email || selectedLead.phone}` : ''}
              </div>
            )}
            {searching && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Searching…</div>
            )}
            {showDropdown && searchResults.length > 0 && (
              <div className="lead-search-dropdown">
                {searchResults.map(lead => (
                  <button key={lead.id} className="lead-result-item" onMouseDown={() => selectLead(lead)}>
                    <span className="lead-result-name">{lead.fullName}</span>
                    {(lead.email || lead.phone) && <span className="lead-result-phone">{lead.email || lead.phone}</span>}
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


          {!selectedLead && (
            <div className="form-group">
              <label className="form-label">Manual Email Fallback</label>
              <input
                className="form-input"
                type="email"
                placeholder="client@email.com"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                autoComplete="off"
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Only use this if the AgencyZoom lead search cannot find the client.
              </div>
            </div>
          )}

          <div className="quote-builder">
            <div className="quote-builder-header">
              <div>
                <div className="quote-builder-title">Quote Builder</div>
                <div className="quote-builder-subtitle">Creates AgencyZoom quote rows for confirmed products</div>
              </div>
              <button type="button" className="quote-add-btn" onClick={addQuotePolicy}>
                + Add Policy
              </button>
            </div>

            <div className="quote-builder-helper">
              Coming soon — AgencyZoom product ID not confirmed yet: Foremost, Farmers Renters, and Farmers Second Home.
            </div>

            {quotePolicies.length === 0 ? (
              <div className="quote-empty">No quoted policies added yet.</div>
            ) : (
              <div className="quote-policy-list">
                {quotePolicies.map(policy => (
                  <div className="quote-policy-card" key={policy.id}>
                    <div className="quote-policy-grid">
                      <div className="quote-field">
                        <label className="quote-field-label">Carrier</label>
                        <select
                          className="form-select"
                          value={policy.carrier}
                          onChange={e => updateQuotePolicy(policy.id, { carrier: e.target.value })}
                        >
                          {CARRIERS.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
                        </select>
                      </div>
                      <div className="quote-field">
                        <label className="quote-field-label">Policy Type</label>
                        <select
                          className="form-select"
                          value={policy.policyType}
                          onChange={e => updateQuotePolicy(policy.id, { policyType: e.target.value })}
                        >
                          {POLICY_TYPES_BY_CARRIER[policy.carrier].map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <div className="quote-field">
                        <label className="quote-field-label">Premium ($)</label>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={policy.premium}
                          onChange={e => updateQuotePolicy(policy.id, { premium: e.target.value })}
                        />
                      </div>
                    </div>
                    <button type="button" className="quote-remove-btn" onClick={() => removeQuotePolicy(policy.id)}>
                      Remove policy
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="quote-summary">
              <div>
                <span>Total Quoted Premium</span>
                <strong>{formatMoney(quoteTotalPremium)}</strong>
              </div>
              <div>
                <span>Policy Count</span>
                <strong>{quotePolicyCount}</strong>
              </div>
            </div>

            <div className="quote-pdf-field">
              <label className="quote-field-label">Upload Quote PDF</label>
              <input className="form-input" type="file" accept="application/pdf,.pdf" onChange={handleQuotePdfUpload} />
              {quotePdf?.name && <div className="quote-pdf-name">{quotePdf.name}</div>}
              <div className="quote-builder-helper">PDF upload to AgencyZoom is not connected yet.</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Krisp Notes From Call</label>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginBottom: 8 }}>
              Paste the full Krisp notes from the call. This powers CRM notes, activity tracking, and future coaching.
            </div>
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
              {quoteExport && (
                <div className={`quote-export-status${quoteExport.failed?.length ? ' has-errors' : ''}`}>
                  <div className="quote-export-title">AgencyZoom Quote Export</div>
                  {quoteExport.error ? (
                    <div className="quote-export-line error">{quoteExport.error}</div>
                  ) : (
                    <>
                      <div className="quote-export-line">{quoteExport.created?.length || 0} quotes created</div>
                      {(quoteExport.skipped?.length || 0) > 0 && (
                        <div className="quote-export-line">{quoteExport.skipped.length} skipped: {quoteExport.skipped.map(p => `${p.carrier} ${p.policyType}`).join(', ')}</div>
                      )}
                      {(quoteExport.failed?.length || 0) > 0 && (
                        <div className="quote-export-line error">{quoteExport.failed.length} failed: {quoteExport.failed.map(p => `${p.carrier} ${p.policyType}`).join(', ')}</div>
                      )}
                    </>
                  )}
                </div>
              )}
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
