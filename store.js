const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data.json');

let state = {
  tasks: {},
  habits: {},
  notes: {},
  wins: {},
  challenges: {},
  clients: {},
  log: [],
  salesDays: {},
  saleDetails: {},
  coachingNotes: [],
};

if (fs.existsSync(FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = { ...state, ...loaded };
    if (!state.coachingNotes) state.coachingNotes = [];
  } catch {}
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

module.exports = {
  setTask(person, taskId, date, completed) {
    if (!state.tasks[person]) state.tasks[person] = {};
    if (!state.tasks[person][date]) state.tasks[person][date] = {};
    state.tasks[person][date][taskId] = completed;
    save();
  },
  getTasks(person, date) {
    return state.tasks[person]?.[date] || {};
  },

  setClientName(person, taskId, date, clientName) {
    if (!state.clients[person]) state.clients[person] = {};
    if (!state.clients[person][date]) state.clients[person][date] = {};
    if (clientName) {
      state.clients[person][date][taskId] = clientName;
    } else {
      delete state.clients[person]?.[date]?.[taskId];
    }
    save();
  },
  getClients(person, date) {
    return state.clients[person]?.[date] || {};
  },

  addLogEntry(entry) {
    state.log.unshift({ ...entry, id: Date.now() + Math.random() });
    save();
  },
  getLog() {
    return state.log;
  },
  updateLogEntry(id, updates) {
    const entry = state.log.find(e => String(e.id) === String(id));
    if (!entry) return false;
    Object.assign(entry, updates);
    save();
    return true;
  },
  deleteLogEntry(id) {
    const idx = state.log.findIndex(e => String(e.id) === String(id));
    if (idx === -1) return false;
    state.log.splice(idx, 1);
    save();
    return true;
  },

  setWin(person, date, content) {
    if (!state.wins[person]) state.wins[person] = {};
    state.wins[person][date] = content;
    save();
  },
  getWin(person, date) {
    return state.wins[person]?.[date] || '';
  },

  setChallenge(person, date, content) {
    if (!state.challenges[person]) state.challenges[person] = {};
    state.challenges[person][date] = content;
    save();
  },
  getChallenge(person, date) {
    return state.challenges[person]?.[date] || '';
  },

  setSaleDetails(person, taskId, date, details) {
    if (!state.saleDetails[person]) state.saleDetails[person] = {};
    if (!state.saleDetails[person][date]) state.saleDetails[person][date] = {};
    if (details) {
      state.saleDetails[person][date][taskId] = details;
    } else {
      delete state.saleDetails?.[person]?.[date]?.[taskId];
    }
    save();
  },
  getSaleDetails(person, date) {
    return state.saleDetails?.[person]?.[date] || {};
  },

  setSalesDay(person, date, data) {
    if (!state.salesDays[person]) state.salesDays[person] = {};
    state.salesDays[person][date] = data;
    save();
  },
  getSalesDay(person, date) {
    return state.salesDays?.[person]?.[date] || null;
  },

  addCoachingNote(note) {
    if (!state.coachingNotes) state.coachingNotes = [];
    state.coachingNotes.unshift({ ...note, id: Date.now() + Math.random() });
    save();
  },
  getCoachingNotes() {
    return state.coachingNotes || [];
  },
  updateCoachingNote(id, updates) {
    if (!state.coachingNotes) return false;
    const note = state.coachingNotes.find(n => String(n.id) === String(id));
    if (!note) return false;
    Object.assign(note, updates);
    save();
    return true;
  },
  deleteCoachingNote(id) {
    if (!state.coachingNotes) return false;
    const idx = state.coachingNotes.findIndex(n => String(n.id) === String(id));
    if (idx === -1) return false;
    state.coachingNotes.splice(idx, 1);
    save();
    return true;
  },

  setHabit() {},
  getHabits() { return {}; },
  setNotes() {},
  getNotes() { return ''; },
};
