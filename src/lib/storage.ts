// AEtherborne Standalone Browser Storage Engine

export interface FavoriteSlot {
  type: "weapon" | "ability" | "skill" | "familiar-ability" | "attribute" | "familiar-attribute";
  targetId: string | number;
  label: string;
}

export interface FamiliarAbility {
  id: number;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  range: string;
  speed: string;
  rollFormula: string;
  linkedStat: string;
  assignedToQuickRolls: boolean;
}

export interface Familiar {
  name: string;
  className: string;
  race: string;
  level: number;
  speed: number;
  power: number;
  vitality: number;
  spirit: number;
  agility: number;
  endurance: number;
  precision: number;
  willpower: number;
  charisma: number;
  currentHp: number;
  currentMana: number;
  currentDt: number;
  dtBonus: number;
  hpFormula: string;
  manaFormula: string;
  dtFormula: string;
  abilities: FamiliarAbility[];
}

export interface Character {
  id: number;
  name: string;
  className: string;
  race: string;
  level: number;
  maxHp: number;
  currentHp: number;
  dtBonus: number;
  currentDt: number;
  speed: number;
  power: number;
  vitality: number;
  spirit: number;
  agility: number;
  endurance: number;
  precision: number;
  willpower: number;
  charisma: number;
  currentMana: number;
  background: string | null;
  backstory: string | null;
  hpFormula: string;
  manaFormula: string;
  dtFormula: string;
  // Stat training values
  powerTraining: number;
  vitalityTraining: number;
  spiritTraining: number;
  agilityTraining: number;
  enduranceTraining: number;
  precisionTraining: number;
  willpowerTraining: number;
  charismaTraining: number;
  favorites?: (FavoriteSlot | null)[];
  familiar?: Familiar | null;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: number;
  characterId: number;
  name: string;
  description: string;
  equipped: boolean;
  assignedToQuickRolls: boolean;
  dtBonus: number;
  statModifiers: Record<string, number>;
  diceType?: string;
  modifier?: number;
}

export interface Currency {
  id: number;
  characterId: number;
  name: string;
  amount: number;
}

export interface InventoryItem {
  id: number;
  characterId: number;
  name: string;
  description: string;
  quantity: number;
}

export interface Essence {
  id: number;
  characterId: number;
  name: string;
  description: string;
  slot: number; // 1-4
}

export interface Ability {
  id: number;
  characterId: number;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  range: string;
  speed: string;
  rollFormula: string;
  linkedStat: string;
  assignedToQuickRolls: boolean;
}

export interface Skill {
  id: number;
  characterId: number;
  name: string;
  value: number;
  training: number;
}

export interface Roll {
  id: number;
  characterId: number;
  diceType: string;
  result: number;
  modifier: number | null;
  total: number;
  label: string | null;
  isCrit: boolean | null;
  critBonus: number | null;
  rolledAt: string;
}

export interface Note {
  id: number;
  characterId: number;
  title: string;
  content: string;
  category: string; // 'general', 'location', 'npc', 'item', 'lore'
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Math Formula Parser ───────────────────────────────────

export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  try {
    let expression = formula.replace(/\s+/g, "").toLowerCase();

    // Substitute variables, sorting descending by length to prevent partial matches
    const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = variables[key];
      const escapedKey = key.toLowerCase();
      expression = expression.split(escapedKey).join(String(val));
    }

    // Security: Only allow mathematical operators, parentheses, digits, and decimals
    if (!/^[0-9+\-*/().]+$/.test(expression)) {
      return 0;
    }

    const result = new Function(`return (${expression})`)();
    return typeof result === "number" && !isNaN(result) ? Math.floor(result) : 0;
  } catch (err) {
    console.error("Formula parsing error:", formula, err);
    return 0;
  }
}

// ── Safe Storage Wrapper ───────────────────────────────────
class MemoryStorage {
  private data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] || null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
  clear(): void {
    this.data = {};
  }
}

let safeStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

try {
  const testKey = "__test_localstorage_access__";
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
  safeStorage = window.localStorage;
} catch (e) {
  console.warn("localStorage is blocked or unavailable (often due to iframe sandbox security). Falling back to memory storage.", e);
  safeStorage = new MemoryStorage();
}

// ── Raw Storage Getters/Setters ───────────────────────────

function getList<T>(key: string): T[] {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setList<T>(key: string, list: T[]): void {
  safeStorage.setItem(key, JSON.stringify(list));
}

// Keys
const KEYS = {
  characters: "aetherborne_characters",
  equipment: "aetherborne_equipment",
  currencies: "aetherborne_currencies",
  inventory: "aetherborne_inventory",
  essences: "aetherborne_essences",
  abilities: "aetherborne_abilities",
  skills: "aetherborne_skills",
  rolls: "aetherborne_rolls",
  notes: "aetherborne_notes",
};

// ── Computed Character Helper ─────────────────────────────

export function getAdjustedStats(char: Character, equipment: Equipment[]): {
  stats: Record<string, number>;
  modifiers: Record<string, number>;
  diceLabels: Record<string, string>;
  maxHp: number;
  maxMana: number;
  maxDt: number;
} {
  // Sum equipped modifiers
  const equippedList = equipment.filter(e => e.characterId === char.id && e.equipped);
  
  const stats: Record<string, number> = {
    power: char.power,
    vitality: char.vitality,
    spirit: char.spirit,
    agility: char.agility,
    endurance: char.endurance,
    precision: char.precision,
    willpower: char.willpower,
    charisma: char.charisma,
  };

  // Add equipment modifiers
  for (const item of equippedList) {
    if (item.statModifiers) {
      for (const [stat, bonus] of Object.entries(item.statModifiers)) {
        const lowerStat = stat.toLowerCase();
        if (lowerStat in stats) {
          stats[lowerStat] += bonus;
        }
      }
    }
  }

  // Calculate auto-modifiers floor(Stat / 3)
  const modifiers: Record<string, number> = {};
  for (const [stat, val] of Object.entries(stats)) {
    modifiers[stat] = Math.floor(val / 3);
  }

  // Calculate dice labels
  const diceLabels: Record<string, string> = {};
  for (const [stat, val] of Object.entries(stats)) {
    diceLabels[stat] = getDiceLabel(val);
  }

  // Calculate equipped armor DT bonus
  const armorDtBonus = equippedList.reduce((sum, item) => sum + (item.dtBonus || 0), 0);

  // Compute derived maximums using variables
  const variables: Record<string, number> = {
    power: stats.power,
    pow: stats.power,
    vitality: stats.vitality,
    vit: stats.vitality,
    spirit: stats.spirit,
    spi: stats.spirit,
    agility: stats.agility,
    agi: stats.agility,
    endurance: stats.endurance,
    end: stats.endurance,
    precision: stats.precision,
    pre: stats.precision,
    willpower: stats.willpower,
    wil: stats.willpower,
    charisma: stats.charisma,
    cha: stats.charisma,
    dtbonus: char.dtBonus + armorDtBonus,
  };

  const maxHp = evaluateFormula(char.hpFormula || "Vitality * 10 + Endurance * 5", variables);
  const maxMana = evaluateFormula(char.manaFormula || "Spirit * 10 + Willpower * 5", variables);
  const maxDt = evaluateFormula(char.dtFormula || "Endurance * 2 + dtBonus", variables);

  return {
    stats,
    modifiers,
    diceLabels,
    maxHp: Math.max(1, maxHp),
    maxMana: Math.max(0, maxMana),
    maxDt: Math.max(0, maxDt),
  };
}

function dieForValue(v: number): number {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  if (v <= 8) return 8;
  if (v <= 10) return 10;
  if (v <= 12) return 12;
  return 20;
}

function getStatDiceSizes(stat: number): number[] {
  if (stat <= 20) return [dieForValue(stat)];
  return [20, ...getStatDiceSizes(stat - 20)];
}

export function getDiceLabel(stat: number): string {
  return getStatDiceSizes(stat).map(d => `d${d}`).join("+");
}

// ── CRUD Methods ──────────────────────────────────────────

export const storage = {
  // Characters
  getCharacters(): Character[] {
    initializeDefaultSample();
    return getList<Character>(KEYS.characters);
  },

  getCharacter(id: number): Character | null {
    const chars = this.getCharacters();
    return chars.find(c => c.id === id) || null;
  },

  createCharacter(data: Omit<Character, "id" | "createdAt" | "updatedAt">): Character {
    const chars = this.getCharacters();
    const newId = chars.length > 0 ? Math.max(...chars.map(c => c.id)) + 1 : 1;
    const now = new Date().toISOString();
    const character: Character = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    chars.push(character);
    setList(KEYS.characters, chars);
    return character;
  },

  updateCharacter(id: number, data: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">>): Character {
    const chars = this.getCharacters();
    const idx = chars.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Character not found");

    const updated: Character = {
      ...chars[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    chars[idx] = updated;
    setList(KEYS.characters, chars);
    return updated;
  },

  deleteCharacter(id: number): void {
    let chars = this.getCharacters();
    chars = chars.filter(c => c.id !== id);
    setList(KEYS.characters, chars);

    // Delete cascade linked items
    setList(KEYS.equipment, getList<Equipment>(KEYS.equipment).filter(e => e.characterId !== id));
    setList(KEYS.currencies, getList<Currency>(KEYS.currencies).filter(c => c.characterId !== id));
    setList(KEYS.inventory, getList<InventoryItem>(KEYS.inventory).filter(i => i.characterId !== id));
    setList(KEYS.essences, getList<Essence>(KEYS.essences).filter(e => e.characterId !== id));
    setList(KEYS.abilities, getList<Ability>(KEYS.abilities).filter(a => a.characterId !== id));
    setList(KEYS.skills, getList<Skill>(KEYS.skills).filter(s => s.characterId !== id));
    setList(KEYS.rolls, getList<Roll>(KEYS.rolls).filter(r => r.characterId !== id));
    setList(KEYS.notes, getList<Note>(KEYS.notes).filter(n => n.characterId !== id));
  },

  // Equipment
  getEquipment(charId: number): Equipment[] {
    return getList<Equipment>(KEYS.equipment).filter(e => e.characterId === charId);
  },

  addEquipment(data: Omit<Equipment, "id">): Equipment {
    const list = getList<Equipment>(KEYS.equipment);
    const newId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    const item: Equipment = { ...data, id: newId };
    list.push(item);
    setList(KEYS.equipment, list);
    return item;
  },

  updateEquipment(id: number, data: Partial<Omit<Equipment, "id" | "characterId">>): Equipment {
    const list = getList<Equipment>(KEYS.equipment);
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) throw new Error("Equipment not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.equipment, list);
    return updated;
  },

  deleteEquipment(id: number): void {
    const list = getList<Equipment>(KEYS.equipment).filter(e => e.id !== id);
    setList(KEYS.equipment, list);
  },

  // Currencies
  getCurrencies(charId: number): Currency[] {
    return getList<Currency>(KEYS.currencies).filter(c => c.characterId === charId);
  },

  addCurrency(data: Omit<Currency, "id">): Currency {
    const list = getList<Currency>(KEYS.currencies);
    const newId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
    const item: Currency = { ...data, id: newId };
    list.push(item);
    setList(KEYS.currencies, list);
    return item;
  },

  updateCurrency(id: number, amount: number): Currency {
    const list = getList<Currency>(KEYS.currencies);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Currency not found");
    list[idx].amount = amount;
    setList(KEYS.currencies, list);
    return list[idx];
  },

  deleteCurrency(id: number): void {
    const list = getList<Currency>(KEYS.currencies).filter(c => c.id !== id);
    setList(KEYS.currencies, list);
  },

  // General Inventory
  getInventory(charId: number): InventoryItem[] {
    return getList<InventoryItem>(KEYS.inventory).filter(i => i.characterId === charId);
  },

  addInventoryItem(data: Omit<InventoryItem, "id">): InventoryItem {
    const list = getList<InventoryItem>(KEYS.inventory);
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    const item: InventoryItem = { ...data, id: newId };
    list.push(item);
    setList(KEYS.inventory, list);
    return item;
  },

  updateInventoryItem(id: number, data: Partial<Omit<InventoryItem, "id" | "characterId">>): InventoryItem {
    const list = getList<InventoryItem>(KEYS.inventory);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) throw new Error("Item not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.inventory, list);
    return updated;
  },

  deleteInventoryItem(id: number): void {
    const list = getList<InventoryItem>(KEYS.inventory).filter(i => i.id !== id);
    setList(KEYS.inventory, list);
  },

  // Essences
  getEssences(charId: number): Essence[] {
    return getList<Essence>(KEYS.essences).filter(e => e.characterId === charId).sort((a,b) => a.slot - b.slot);
  },

  addEssence(data: Omit<Essence, "id">): Essence {
    const list = getList<Essence>(KEYS.essences);
    // Remove if there's already an essence in this slot
    const filtered = list.filter(e => !(e.characterId === data.characterId && e.slot === data.slot));
    const newId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    const item: Essence = { ...data, id: newId };
    filtered.push(item);
    setList(KEYS.essences, filtered);
    return item;
  },

  deleteEssence(id: number): void {
    const list = getList<Essence>(KEYS.essences).filter(e => e.id !== id);
    setList(KEYS.essences, list);
  },

  // Shaped Abilities
  getAbilities(charId: number): Ability[] {
    return getList<Ability>(KEYS.abilities).filter(a => a.characterId === charId);
  },

  addAbility(data: Omit<Ability, "id">): Ability {
    const list = getList<Ability>(KEYS.abilities);
    const newId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
    const item: Ability = { ...data, id: newId };
    list.push(item);
    setList(KEYS.abilities, list);
    return item;
  },

  updateAbility(id: number, data: Partial<Omit<Ability, "id" | "characterId">>): Ability {
    const list = getList<Ability>(KEYS.abilities);
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error("Ability not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.abilities, list);
    return updated;
  },

  deleteAbility(id: number): void {
    const list = getList<Ability>(KEYS.abilities).filter(a => a.id !== id);
    setList(KEYS.abilities, list);
  },

  // Skills
  getSkills(charId: number): Skill[] {
    return getList<Skill>(KEYS.skills).filter(s => s.characterId === charId);
  },

  addSkill(data: Omit<Skill, "id">): Skill {
    const list = getList<Skill>(KEYS.skills);
    const newId = list.length > 0 ? Math.max(...list.map(s => s.id)) + 1 : 1;
    const item: Skill = { ...data, id: newId };
    list.push(item);
    setList(KEYS.skills, list);
    return item;
  },

  updateSkill(id: number, data: Partial<Omit<Skill, "id" | "characterId">>): Skill {
    const list = getList<Skill>(KEYS.skills);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Skill not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.skills, list);
    return updated;
  },

  deleteSkill(id: number): void {
    const list = getList<Skill>(KEYS.skills).filter(s => s.id !== id);
    setList(KEYS.skills, list);
  },

  // Notes
  getNotes(charId?: number): Note[] {
    const list = getList<Note>(KEYS.notes);
    if (charId !== undefined) {
      return list.filter(n => n.characterId === charId);
    }
    return list;
  },

  addNote(data: Omit<Note, "id" | "createdAt" | "updatedAt">): Note {
    const list = getList<Note>(KEYS.notes);
    const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    const now = new Date().toISOString();
    const note: Note = { ...data, id: newId, createdAt: now, updatedAt: now };
    list.push(note);
    setList(KEYS.notes, list);
    return note;
  },

  updateNote(id: number, data: Partial<Omit<Note, "id" | "characterId" | "createdAt" | "updatedAt">>): Note {
    const list = getList<Note>(KEYS.notes);
    const idx = list.findIndex(n => n.id === id);
    if (idx === -1) throw new Error("Note not found");
    const updated = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    setList(KEYS.notes, list);
    return updated;
  },

  deleteNote(id: number): void {
    const list = getList<Note>(KEYS.notes).filter(n => n.id !== id);
    setList(KEYS.notes, list);
  },

  // Rolls log
  getRolls(charId: number): Roll[] {
    return getList<Roll>(KEYS.rolls).filter(r => r.characterId === charId).sort((a,b) => new Date(b.rolledAt).getTime() - new Date(a.rolledAt).getTime());
  },

  getRecentRolls(): (Roll & { characterName: string })[] {
    const rolls = getList<Roll>(KEYS.rolls);
    const chars = getList<Character>(KEYS.characters);
    return rolls
      .map(r => {
        const char = chars.find(c => c.id === r.characterId);
        return {
          ...r,
          characterName: char ? char.name : "Unknown Hero",
        };
      })
      .sort((a,b) => new Date(b.rolledAt).getTime() - new Date(a.rolledAt).getTime())
      .slice(0, 20);
  },

  addRoll(data: Omit<Roll, "id" | "rolledAt">): Roll {
    const list = getList<Roll>(KEYS.rolls);
    const newId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
    const roll: Roll = { ...data, id: newId, rolledAt: new Date().toISOString() };
    list.push(roll);
    setList(KEYS.rolls, list);
    return roll;
  },
};

// ── JSON Import / Export Functions ─────────────────────────

export function exportCharacterJSON(charId: number): void {
  const char = storage.getCharacter(charId);
  if (!char) return;

  const data = {
    character: char,
    equipment: storage.getEquipment(charId),
    currencies: storage.getCurrencies(charId),
    inventory: storage.getInventory(charId),
    essences: storage.getEssences(charId),
    abilities: storage.getAbilities(charId),
    skills: storage.getSkills(charId),
    notes: storage.getNotes(charId),
  };

  const filename = `${char.name.toLowerCase().replace(/\s+/g, "_")}_sheet.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importCharacterJSON(jsonString: string): Character {
  const data = JSON.parse(jsonString);
  if (!data.character || !data.character.name) {
    throw new Error("Invalid character data structure");
  }

  const chars = storage.getCharacters();
  const nextCharId = chars.length > 0 ? Math.max(...chars.map(c => c.id)) + 1 : 1;

  // Insert character with new ID
  const importedChar: Character = {
    ...data.character,
    id: nextCharId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chars.push(importedChar);
  setList(KEYS.characters, chars);

  // Helper to remap IDs for nested lists
  if (Array.isArray(data.equipment)) {
    const list = getList<Equipment>(KEYS.equipment);
    let nextId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    data.equipment.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.equipment, list);
  }

  if (Array.isArray(data.currencies)) {
    const list = getList<Currency>(KEYS.currencies);
    let nextId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
    data.currencies.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.currencies, list);
  }

  if (Array.isArray(data.inventory)) {
    const list = getList<InventoryItem>(KEYS.inventory);
    let nextId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    data.inventory.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.inventory, list);
  }

  if (Array.isArray(data.essences)) {
    const list = getList<Essence>(KEYS.essences);
    let nextId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    data.essences.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.essences, list);
  }

  if (Array.isArray(data.abilities)) {
    const list = getList<Ability>(KEYS.abilities);
    let nextId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
    data.abilities.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.abilities, list);
  }

  if (Array.isArray(data.skills)) {
    const list = getList<Skill>(KEYS.skills);
    let nextId = list.length > 0 ? Math.max(...list.map(s => s.id)) + 1 : 1;
    data.skills.forEach((item: any) => {
      list.push({ ...item, id: nextId++, characterId: nextCharId });
    });
    setList(KEYS.skills, list);
  }

  if (Array.isArray(data.notes)) {
    const list = getList<Note>(KEYS.notes);
    let nextId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    data.notes.forEach((item: any) => {
      list.push({
        ...item,
        id: nextId++,
        characterId: nextCharId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });
    setList(KEYS.notes, list);
  }

  return importedChar;
}

// ── Default Mock Database Initialization ──────────────────

function initializeDefaultSample(): void {
  const initialized = safeStorage.getItem("aetherborne_initialized");
  if (initialized === "true") return;

  // Insert Garrick
  const char: Character = {
    id: 1,
    name: "Garrick the Shieldbearer",
    className: "Defender",
    race: "Human",
    level: 5,
    maxHp: 150,
    currentHp: 150,
    dtBonus: 0,
    currentDt: 14,
    speed: 30,
    power: 14,
    vitality: 15,
    spirit: 8,
    agility: 10,
    endurance: 14,
    precision: 11,
    willpower: 12,
    charisma: 10,
    currentMana: 50,
    background: "Captain of the Outer Walls",
    backstory: "Garrick stood guard during the Siege of Blackwood Forest, single-handedly holding the eastern gate shield line against a horde of wild mythical beasts. He lives by a simple code: shields high, protectors firm.",
    hpFormula: "Vitality * 10 + Endurance * 5",
    manaFormula: "Spirit * 10 + Willpower * 5",
    dtFormula: "Endurance * 2 + dtBonus",
    powerTraining: 4,
    vitalityTraining: 2,
    spiritTraining: 0,
    agilityTraining: 1,
    enduranceTraining: 8,
    precisionTraining: 0,
    willpowerTraining: 3,
    charismaTraining: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  setList(KEYS.characters, [char]);

  // Equipment
  const equipment: Equipment[] = [
    {
      id: 1,
      characterId: 1,
      name: "Iron Longsword",
      description: "A standard-issue military blade, heavy but reliable.",
      equipped: true,
      assignedToQuickRolls: true,
      dtBonus: 0,
      statModifiers: { precision: 1 },
      diceType: "d8",
      modifier: 0,
    },
    {
      id: 2,
      characterId: 1,
      name: "Steel Tower Shield",
      description: "An enormous rectangular shield engraved with fortress walls. Absorbs massive impacts.",
      equipped: true,
      assignedToQuickRolls: false,
      dtBonus: 6,
      statModifiers: {},
    },
  ];
  setList(KEYS.equipment, equipment);

  // Currencies
  const currencies: Currency[] = [
    { id: 1, characterId: 1, name: "Gold", amount: 150 },
    { id: 2, characterId: 1, name: "Silver", amount: 30 },
  ];
  setList(KEYS.currencies, currencies);

  // Inventory Items
  const inventory: InventoryItem[] = [
    { id: 1, characterId: 1, name: "Hempen Rope (50ft)", description: "Coiled rope, tough and useful.", quantity: 1 },
    { id: 2, characterId: 1, name: "Iron Rations", description: "Hard tack and dried meat slices.", quantity: 5 },
  ];
  setList(KEYS.inventory, inventory);

  // Essences
  const essences: Essence[] = [
    { id: 1, characterId: 1, name: "Aegis", description: "Shielding energies of ancient steel.", slot: 1 },
    { id: 2, characterId: 1, name: "Earthguard", description: "Defensive solid earth attunement.", slot: 2 },
    { id: 3, characterId: 1, name: "Stoneform", description: "Hardening skin like heavy bedrock.", slot: 3 },
    { id: 4, characterId: 1, name: "Confluence: Bastion of Gaia", description: "Ultimate earth defense alignment.", slot: 4 },
  ];
  setList(KEYS.essences, essences);

  // Abilities
  const abilities: Ability[] = [
    {
      id: 1,
      characterId: 1,
      name: "Stone Aegis",
      description: "Shapes stone armor around yourself. Increases current DT by +6.",
      cost: 10,
      cooldown: 3,
      range: "Self",
      speed: "Instant",
      rollFormula: "d6",
      linkedStat: "willpower",
      assignedToQuickRolls: true,
    },
    {
      id: 2,
      characterId: 1,
      name: "Earthbreaker Strike",
      description: "Slams your heavy weapon down. Deals bonus earth damage and knocks the target back.",
      cost: 15,
      cooldown: 5,
      range: "Melee",
      speed: "Standard",
      rollFormula: "2d6",
      linkedStat: "power",
      assignedToQuickRolls: true,
    },
  ];
  setList(KEYS.abilities, abilities);

  // Skills
  const skills: Skill[] = [
    { id: 1, characterId: 1, name: "Beast Handling", value: 3, training: 0 },
    { id: 2, characterId: 1, name: "Basic Wilderness Knowledge", value: 3, training: 0 },
    { id: 3, characterId: 1, name: "Athletics", value: 6, training: 0 },
  ];
  setList(KEYS.skills, skills);

  // Notes
  const notes: Note[] = [
    {
      id: 1,
      characterId: 1,
      title: "The Blackwood Forest ruins",
      content: "Innkeepers speak of goblins gathering near the ruins in the eastern quadrant. They seem to be looking for shaped artifacts.",
      category: "lore",
      tags: ["Blackwood", "Goblin"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  setList(KEYS.notes, notes);

  safeStorage.setItem("aetherborne_initialized", "true");
}
