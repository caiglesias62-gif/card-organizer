const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const cors = require('cors');

const PORT = process.env.PORT || 8765;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'cards.db');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

// Initialize DB
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.prepare(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    text TEXT,
    tags TEXT,
    cost INTEGER,
    power INTEGER,
    health INTEGER,
    color TEXT,
    type TEXT,
    dice TEXT,
    flipCondition TEXT,
    flipText TEXT,
    spellSpeed TEXT,
    updated INTEGER
  )
`).run();

// Helper to convert row to object with parsed tags
function rowToCard(row){
  if(!row) return null;
  return {
    id: row.id,
    name: row.name,
    text: row.text,
    tags: row.tags ? row.tags.split('|').filter(Boolean) : [],
    cost: row.cost === null ? null : row.cost,
    power: row.power === null ? null : row.power,
    health: row.health === null ? null : row.health,
    color: row.color,
    type: row.type,
    dice: row.dice,
    flipCondition: row.flipCondition,
    flipText: row.flipText,
    spellSpeed: row.spellSpeed,
    updated: row.updated
  };
}

// API: list cards
app.get('/api/cards', (req, res) => {
  const rows = db.prepare('SELECT * FROM cards ORDER BY updated DESC').all();
  res.json(rows.map(rowToCard));
});

// API: get single card
app.get('/api/cards/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  if(!row) return res.status(404).json({ error: 'Not found' });
  res.json(rowToCard(row));
});

// API: create card
app.post('/api/cards', (req, res) => {
  const c = req.body || {};
  if(!c.name) return res.status(400).json({ error: 'Name required' });

  const id = c.id || ('c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8));
  const now = Date.now();

  const tags = Array.isArray(c.tags) ? c.tags.join('|') : (typeof c.tags === 'string' ? c.tags : '');
  db.prepare(`
    INSERT INTO cards (id,name,text,tags,cost,power,health,color,type,dice,flipCondition,flipText,spellSpeed,updated)
    VALUES (@id,@name,@text,@tags,@cost,@power,@health,@color,@type,@dice,@flipCondition,@flipText,@spellSpeed,@updated)
  `).run({
    id,
    name: c.name,
    text: c.text || '',
    tags,
    cost: c.cost == null ? null : c.cost,
    power: c.power == null ? null : c.power,
    health: c.health == null ? null : c.health,
    color: c.color || 'Colorless',
    type: c.type || 'Unit',
    dice: c.dice || null,
    flipCondition: c.flipCondition || null,
    flipText: c.flipText || null,
    spellSpeed: c.spellSpeed || null,
    updated: now
  });

  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.status(201).json(rowToCard(row));
});

// API: update card
app.put('/api/cards/:id', (req, res) => {
  const id = req.params.id;
  const c = req.body || {};
  if(!c.name) return res.status(400).json({ error: 'Name required' });
  const now = Date.now();
  const tags = Array.isArray(c.tags) ? c.tags.join('|') : (typeof c.tags === 'string' ? c.tags : '');
  const stmt = db.prepare(`
    UPDATE cards SET
      name=@name, text=@text, tags=@tags,
      cost=@cost, power=@power, health=@health,
      color=@color, type=@type, dice=@dice,
      flipCondition=@flipCondition, flipText=@flipText,
      spellSpeed=@spellSpeed, updated=@updated
    WHERE id=@id
  `);
  const info = stmt.run({
    id,
    name: c.name,
    text: c.text || '',
    tags,
    cost: c.cost == null ? null : c.cost,
    power: c.power == null ? null : c.power,
    health: c.health == null ? null : c.health,
    color: c.color || 'Colorless',
    type: c.type || 'Unit',
    dice: c.dice || null,
    flipCondition: c.flipCondition || null,
    flipText: c.flipText || null,
    spellSpeed: c.spellSpeed || null,
    updated: now
  });
  if(info.changes === 0) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
  res.json(rowToCard(row));
});

// API: delete card
app.delete('/api/cards/:id', (req, res) => {
  const id = req.params.id;
  const info = db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  if(info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// Serve static client if placed in "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Health
app.get('/_health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`TCG card server listening on ${PORT}`);
});