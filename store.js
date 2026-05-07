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
};

if (fs.existsSync(FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = { ...state, ...loaded };
  } catch {}
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

module.exports = {
  // Tasks
  setTask(person, taskId, date, completed) {
    if (!state.tasks[person]) state.tasks[person] = {};
    if (!state.tasks[person][date]) state.tasks[person][date] = {};
    state.tasks[person][date][taskId] = completed;
    save();
  },
  getTasks(person, date) {
    return state.tasks[person]?.[date] || {};
  },

  // Client names for verified tasks
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

  // Verified task log
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

  // Win of the day
  setWin(person, date, content) {
    if (!state.wins[person]) state.wins[person] = {};
    state.wins[person][date] = content;
    save();
  },
  getWin(person, date) {
    return state.wins[person]?.[date] || '';
  },

  // Challenge of the day
  setChallenge(person, date, content) {
    if (!state.challenges[person]) state.challenges[person] = {};
    state.challenges[person][date] = content;
    save();
  },
  getChallenge(person, date) {
    return state.challenges[person]?.[date] || '';
  },

  // Legacy habits/notes (kept for data compat, unused in UI)
  setHabit() {},
  getHabits() { return {}; },
  setNotes() {},
  getNotes() { return ''; },
};
