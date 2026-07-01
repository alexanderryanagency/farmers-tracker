import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowRight, Edit3, Plus, Search, X } from 'lucide-react';

const DEFAULT_STAGES = [
  'Sold',
  'Onboarding',
  'Needs Signature',
  'Docs Mailed',
  'Signed',
  'Waiting on Payment',
  'Archived',
];

const DEFAULT_FINAL_STATUSES = [
  'Active',
  'Cancelled',
  'Non-Pay',
  'Never Signed',
  'Rewritten',
  'Transferred',
  'UW Declined',
  'Other',
];

const EMPTY_CARD = {
  clientName: '',
  producer: '',
  policyType: '',
  carrier: '',
  effectiveDate: '',
  stage: 'Sold',
  finalStatus: '',
};

const POLICY_TYPES = ['Auto', 'Home', 'Life', 'Umbrella', 'Renters', 'Condo', 'Landlord', 'Business', 'Other'];
const CARRIERS = ['Farmers', 'Bristol West', 'Foremost', 'Other'];

function uniqueValues(cards, key, fallbacks = []) {
  return [...new Set([...fallbacks, ...cards.map(card => card[key]).filter(Boolean)])].sort();
}

function prettyDate(date) {
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PipelineModal({ title, form, setForm, people, stages, finalStatuses, onSave, onCancel, error }) {
  const archived = form.stage === 'Archived';
  return (
    <div className="overlay" onClick={event => event.target === event.currentTarget && onCancel()}>
      <div className="modal operations-modal">
        <div className="modal-tag">Operations Pipeline</div>
        <div className="modal-title">{title}</div>
        {error && <div className="operations-error">{error}</div>}

        <div className="operations-form-grid">
          <label>
            <span>Client Name</span>
            <input className="modal-input" value={form.clientName} onChange={event => setForm({ ...form, clientName: event.target.value })} autoFocus />
          </label>
          <label>
            <span>Producer</span>
            <select className="modal-input" value={form.producer} onChange={event => setForm({ ...form, producer: event.target.value })}>
              <option value="">Select producer</option>
              {people.map(person => <option key={person.id} value={person.name}>{person.name}</option>)}
              <option value="ARB">ARB</option>
            </select>
          </label>
          <label>
            <span>Policy Type</span>
            <select className="modal-input" value={form.policyType} onChange={event => setForm({ ...form, policyType: event.target.value })}>
              <option value="">Select type</option>
              {POLICY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Carrier</span>
            <select className="modal-input" value={form.carrier} onChange={event => setForm({ ...form, carrier: event.target.value })}>
              <option value="">Select carrier</option>
              {CARRIERS.map(carrier => <option key={carrier} value={carrier}>{carrier}</option>)}
            </select>
          </label>
          <label>
            <span>Effective Date</span>
            <input className="modal-input" type="date" value={form.effectiveDate} onChange={event => setForm({ ...form, effectiveDate: event.target.value })} />
          </label>
          <label>
            <span>Current Stage</span>
            <select className="modal-input" value={form.stage} onChange={event => setForm({ ...form, stage: event.target.value, finalStatus: event.target.value === 'Archived' ? form.finalStatus : '' })}>
              {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          {archived && (
            <label className="operations-full-field">
              <span>Final Status</span>
              <select className="modal-input" value={form.finalStatus} onChange={event => setForm({ ...form, finalStatus: event.target.value })}>
                <option value="">Select final status</option>
                {finalStatuses.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-confirm" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function OperationsCard({ card, stages, finalStatuses, onMove, onEdit }) {
  const stageIndex = stages.indexOf(card.stage);
  const nextStage = stageIndex >= 0 ? stages[stageIndex + 1] : null;

  return (
    <article className={`operations-card stage-${stageIndex}`}>
      <div className="operations-card-top">
        <strong>{card.clientName}</strong>
        <button className="operations-icon-btn" onClick={() => onEdit(card)} title="Edit card">
          <Edit3 size={14} />
        </button>
      </div>
      <div className="operations-badges">
        <span>{card.producer}</span>
        <span>{card.policyType}</span>
        <span>{card.carrier}</span>
      </div>
      <div className="operations-card-meta">
        <span>Effective</span>
        <strong>{prettyDate(card.effectiveDate)}</strong>
      </div>
      <div className="operations-card-meta">
        <span>Stage</span>
        <strong>{card.stage}</strong>
      </div>
      {card.stage === 'Archived' && (
        <div className="operations-final-status">
          <Archive size={13} />
          {card.finalStatus || 'Needs status'}
        </div>
      )}
      <div className="operations-card-actions">
        {stages.map(stage => (
          <button
            key={stage}
            className={card.stage === stage ? 'selected' : ''}
            onClick={() => onMove(card, stage)}
            title={`Move to ${stage}`}
          >
            {stage}
          </button>
        ))}
      </div>
      {nextStage && (
        <button className="operations-next-btn" onClick={() => onMove(card, nextStage)}>
          Move to {nextStage} <ArrowRight size={14} />
        </button>
      )}
      {card.stage === 'Archived' && (
        <select className="operations-status-select" value={card.finalStatus || ''} onChange={event => onMove(card, 'Archived', event.target.value)}>
          <option value="">Final Status</option>
          {finalStatuses.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
      )}
    </article>
  );
}

export default function OperationsPipeline({ people = [] }) {
  const [cards, setCards] = useState([]);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [finalStatuses, setFinalStatuses] = useState(DEFAULT_FINAL_STATUSES);
  const [filters, setFilters] = useState({ query: '', producer: '', carrier: '', policyType: '', finalStatus: '' });
  const [modalMode, setModalMode] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [form, setForm] = useState(EMPTY_CARD);
  const [error, setError] = useState('');

  async function loadCards() {
    const response = await fetch('/api/operations-pipeline');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load pipeline');
    setCards(Array.isArray(data.cards) ? data.cards : []);
    setStages(Array.isArray(data.stages) ? data.stages : DEFAULT_STAGES);
    setFinalStatuses(Array.isArray(data.finalStatuses) ? data.finalStatuses : DEFAULT_FINAL_STATUSES);
  }

  useEffect(() => {
    loadCards().catch(err => setError(err.message));
  }, []);

  const producerOptions = useMemo(() => uniqueValues(cards, 'producer', people.map(person => person.name).concat('ARB')), [cards, people]);
  const carrierOptions = useMemo(() => uniqueValues(cards, 'carrier', CARRIERS), [cards]);
  const policyTypeOptions = useMemo(() => uniqueValues(cards, 'policyType', POLICY_TYPES), [cards]);

  const filteredCards = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return cards.filter(card => {
      if (filters.producer && card.producer !== filters.producer) return false;
      if (filters.carrier && card.carrier !== filters.carrier) return false;
      if (filters.policyType && card.policyType !== filters.policyType) return false;
      if (filters.finalStatus && card.finalStatus !== filters.finalStatus) return false;
      if (!q) return true;
      return [card.clientName, card.producer, card.policyType, card.carrier, card.stage, card.finalStatus]
        .some(value => String(value || '').toLowerCase().includes(q));
    });
  }, [cards, filters]);

  function openCreate() {
    setForm(EMPTY_CARD);
    setEditingCard(null);
    setModalMode('create');
    setError('');
  }

  function openEdit(card) {
    setForm({ ...EMPTY_CARD, ...card });
    setEditingCard(card);
    setModalMode('edit');
    setError('');
  }

  async function saveForm() {
    setError('');
    const method = editingCard ? 'PATCH' : 'POST';
    const url = editingCard ? `/api/operations-pipeline/${editingCard.id}` : '/api/operations-pipeline';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Unable to save card');
      return;
    }
    setModalMode(null);
    setEditingCard(null);
    await loadCards();
  }

  async function moveCard(card, stage, finalStatus) {
    if (stage === 'Archived' && !finalStatus && card.stage !== 'Archived') {
      openEdit({ ...card, stage: 'Archived', finalStatus: '' });
      setError('Final Status is required when archiving.');
      return;
    }
    const response = await fetch(`/api/operations-pipeline/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage,
        finalStatus: stage === 'Archived' ? (finalStatus || card.finalStatus) : '',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Unable to move card');
      return;
    }
    await loadCards();
  }

  function updateFilter(key, value) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  return (
    <div className="operations-page page">
      <div className="operations-header">
        <div>
          <div className="page-title">Operations Pipeline</div>
          <div className="page-subtitle">Post-sale visibility for sold households after AgencyZoom.</div>
        </div>
        <button className="operations-primary-btn" onClick={openCreate}>
          <Plus size={17} />
          New Card
        </button>
      </div>

      <div className="operations-filters">
        <label className="operations-search">
          <Search size={16} />
          <input value={filters.query} onChange={event => updateFilter('query', event.target.value)} placeholder="Search active or archived cards" />
        </label>
        <select value={filters.producer} onChange={event => updateFilter('producer', event.target.value)}>
          <option value="">All producers</option>
          {producerOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={filters.carrier} onChange={event => updateFilter('carrier', event.target.value)}>
          <option value="">All carriers</option>
          {carrierOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={filters.policyType} onChange={event => updateFilter('policyType', event.target.value)}>
          <option value="">All policy types</option>
          {policyTypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={filters.finalStatus} onChange={event => updateFilter('finalStatus', event.target.value)}>
          <option value="">All final statuses</option>
          {finalStatuses.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
        {(filters.query || filters.producer || filters.carrier || filters.policyType || filters.finalStatus) && (
          <button className="operations-clear-btn" onClick={() => setFilters({ query: '', producer: '', carrier: '', policyType: '', finalStatus: '' })}>
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {error && !modalMode && <div className="operations-error">{error}</div>}

      <div className="operations-board">
        {stages.map((stage, index) => {
          const stageCards = filteredCards.filter(card => card.stage === stage);
          return (
            <section key={stage} className={`operations-column column-${index}`}>
              <div className="operations-column-header">
                <span>{stage}</span>
                <strong>{stageCards.length}</strong>
              </div>
              <div className="operations-column-body">
                {stageCards.map(card => (
                  <OperationsCard
                    key={card.id}
                    card={card}
                    stages={stages}
                    finalStatuses={finalStatuses}
                    onMove={moveCard}
                    onEdit={openEdit}
                  />
                ))}
                {stageCards.length === 0 && <div className="operations-empty">No cards</div>}
              </div>
            </section>
          );
        })}
      </div>

      {modalMode && (
        <PipelineModal
          title={modalMode === 'create' ? 'Create Card' : 'Edit Card'}
          form={form}
          setForm={setForm}
          people={people}
          stages={stages}
          finalStatuses={finalStatuses}
          onSave={saveForm}
          onCancel={() => {
            setModalMode(null);
            setEditingCard(null);
            setError('');
          }}
          error={error}
        />
      )}
    </div>
  );
}
