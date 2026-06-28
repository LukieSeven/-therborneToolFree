import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Shield, ArrowLeft, Loader2, Trash2, Heart, Dice5,
  RotateCcw, Swords, Sparkles, Plus, Edit2, Upload, Download,
  Coins, Package, Hammer, Layers, Flame, BookText, UserCheck, X
} from "lucide-react";
import { format } from "date-fns";

// Storage Hooks & Helpers
import {
  useGetCharacter, useUpdateCharacter, useDeleteCharacter, useApplyDamage,
  useCreateRoll, useListCharacterRolls,
  useListEquipment, useUpdateEquipment, useDeleteEquipment,
  useListCurrencies, useUpdateCurrency, useDeleteCurrency,
  useListInventory, useDeleteInventoryItem,
  useListEssences, useAddEssence, useDeleteEssence,
  useListAbilities, useUpdateAbility,
  useListSkills, useUpdateSkill,
  useListNotes, useCreateNote, useDeleteNote,
  getGetCharacterQueryKey, getListCharacterRollsQueryKey, getListNotesQueryKey
} from "@/hooks/useStorage";
import { 
  getAdjustedStats, getDiceLabel, exportCharacterJSON, importCharacterJSON, 
  Ability, Equipment, Skill, FavoriteSlot, Familiar, FamiliarAbility, evaluateFormula 
} from "@/lib/storage";

// Dialog Modals
import { EditCharacterDialog } from "@/components/dialogs/edit-character-dialog";
import { EditAbilitiesDialog } from "@/components/dialogs/edit-abilities-dialog";
import { EditSkillsDialog } from "@/components/dialogs/edit-skills-dialog";
import { EditInventoryDialog } from "@/components/dialogs/edit-inventory-dialog";

const STATS = [
  { key: "power",     label: "POW", desc: "Physical strength & raw force" },
  { key: "vitality",  label: "VIT", desc: "Durability & stamina" },
  { key: "agility",   label: "AGI", desc: "Speed & reflexes" },
  { key: "endurance", label: "END", desc: "Resistance to pain & fatigue" },
  { key: "spirit",    label: "SPI", desc: "Magical energy & mana" },
  { key: "precision", label: "PRE", desc: "Accuracy & critical hits" },
  { key: "willpower", label: "WIL", desc: "Mental toughness & focus" },
  { key: "charisma",  label: "CHA", desc: "Presence & social ability" },
];

const CRIT_TIERS = [
  { name: "Common",    color: "#e8e8e8" },
  { name: "Uncommon",  color: "#1eff00" },
  { name: "Rare",      color: "#0070ff" },
  { name: "Epic",      color: "#a335ee" },
  { name: "Legendary", color: "#ffd700" },
  { name: "Artifact",  color: "#ff8000" },
  { name: "Heirloom",  color: "#ff3030" },
];

// Helper to parse Markdown description cards
function parseMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.*?)$/gm, '<h4 class="font-serif text-sm font-bold text-primary mt-2 mb-0.5">$1</h4>');
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');
  html = html.split("\n").join("<br />");
  return html;
}

function ResourceBar({ current, max, color }: { current: number; max: number; color: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const isOverMax = current > max;
  return (
    <div className={`w-full bg-accent/50 h-2 rounded-none overflow-hidden relative ${isOverMax ? "ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : ""}`}>
      <div
        className={`h-full rounded-none transition-all duration-300 ${isOverMax ? "animate-pulse" : ""}`}
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

// Favorites Migration/Getter Helper
const getFavorites = (char: any, eq: any[], ab: any[]): (FavoriteSlot | null)[] => {
  if (char && char.favorites && Array.isArray(char.favorites) && char.favorites.length === 10) {
    return char.favorites;
  }
  const slots: (FavoriteSlot | null)[] = Array(10).fill(null);
  let idx = 0;
  eq.filter(e => e.equipped && e.assignedToQuickRolls).forEach(e => {
    if (idx < 10) slots[idx++] = { type: "weapon", targetId: e.id, label: e.name };
  });
  ab.filter(a => a.assignedToQuickRolls).forEach(a => {
    if (idx < 10) slots[idx++] = { type: "ability", targetId: a.id, label: a.name };
  });
  return slots;
};

export default function CharacterSheet() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: character, isLoading } = useGetCharacter(id);
  const { data: rolls, isLoading: loadingRolls } = useListCharacterRolls(id);
  const { data: equipment = [] } = useListEquipment(id);
  const { data: currencies = [] } = useListCurrencies(id);
  const { data: inventory = [] } = useListInventory(id);
  const { data: essences = [] } = useListEssences(id);
  const { data: abilities = [] } = useListAbilities(id);
  const { data: skills = [] } = useListSkills(id);
  const { data: notes = [] } = useListNotes(id);

  // Mutations
  const updateChar = useUpdateCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();
  
  // Equipment mutators for toggling equipped/quick status
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  // Notes mutators
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  // Essences mutators
  const addEssence = useAddEssence();
  const deleteEssence = useDeleteEssence();

  // Skills mutator
  const updateSkillMut = useUpdateSkill();

  // ── Tab State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"stats" | "skills" | "inventory" | "essences" | "abilities" | "notes" | "familiar">("stats");

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

  useEffect(() => {
    if (character) {
      if (hp === null) setHp(character.currentHp);
      if (mana === null) setMana(character.currentMana);
      if (currentDt === null) setCurrentDt(character.currentDt);
    }
  }, [character]);

  // Sync state changes from parent queries
  useEffect(() => {
    if (character) {
      setHp(character.currentHp);
      setMana(character.currentMana);
      setCurrentDt(character.currentDt);
    }
  }, [character?.currentHp, character?.currentMana, character?.currentDt]);

  // ── Dedicated HUD Inputs State ─────────────────────────────
  const [hpAdd, setHpAdd] = useState("");
  const [hpRemove, setHpRemove] = useState("");
  const [hpBuff, setHpBuff] = useState("");

  const [dtAdd, setDtAdd] = useState("");
  const [dtRemove, setDtRemove] = useState("");
  const [dtBuff, setDtBuff] = useState("");

  const [manaAdd, setManaAdd] = useState("");
  const [manaRemove, setManaRemove] = useState("");
  const [manaBuff, setManaBuff] = useState("");

  // ── Familiar Inputs State (Creation) ───────────────────────
  const [famName, setFamName] = useState("");
  const [famClassName, setFamClassName] = useState("");
  const [famRace, setFamRace] = useState("");
  const [famLevel, setFamLevel] = useState(1);
  const [famSpeed, setFamSpeed] = useState(25);
  const [famPower, setFamPower] = useState(8);
  const [famVitality, setFamVitality] = useState(8);
  const [famSpirit, setFamSpirit] = useState(6);
  const [famAgility, setFamAgility] = useState(8);
  const [famEndurance, setFamEndurance] = useState(8);
  const [famPrecision, setFamPrecision] = useState(8);
  const [famWillpower, setFamWillpower] = useState(8);
  const [famCharisma, setFamCharisma] = useState(6);
  const [famHpFormula, setFamHpFormula] = useState("Vitality * 8");
  const [famManaFormula, setFamManaFormula] = useState("Spirit * 5");
  const [famDtFormula, setFamDtFormula] = useState("Endurance * 1");

  // ── Familiar HUD Inputs State ──────────────────────────────
  const [famHpAdd, setFamHpAdd] = useState("");
  const [famHpRemove, setFamHpRemove] = useState("");
  const [famHpBuff, setFamHpBuff] = useState("");
  const [famDtAdd, setFamDtAdd] = useState("");
  const [famDtRemove, setFamDtRemove] = useState("");
  const [famDtBuff, setFamDtBuff] = useState("");
  const [famManaAdd, setFamManaAdd] = useState("");
  const [famManaRemove, setFamManaRemove] = useState("");
  const [famManaBuff, setFamManaBuff] = useState("");

  // ── Familiar Ability Creator ───────────────────────────────
  const [isAddingFamAbility, setIsAddingFamAbility] = useState(false);
  const [famAbilityName, setFamAbilityName] = useState("");
  const [famAbilityDesc, setFamAbilityDesc] = useState("");
  const [famAbilityCost, setFamAbilityCost] = useState(0);
  const [famAbilityFormula, setFamAbilityFormula] = useState("");

  // ── Notes Filter & Search ──────────────────────────────────
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteCategoryFilter, setNoteCategoryFilter] = useState("all");

  // ── Favorites Hotbar State ─────────────────────────────────
  const [assigningSlotIndex, setAssigningSlotIndex] = useState<number | null>(null);

  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [famDtFlash, setFamDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);
  const [famDamageResult, setFamDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);

  // ── Inventory Dialog Trigger State ────────────────────────
  const [isInvOpen, setIsInvOpen] = useState(false);
  const [invMode, setInvMode] = useState<"add" | "edit">("add");
  const [invType, setInvType] = useState<"currency" | "equipment" | "item">("item");
  const [invInitialData, setInvInitialData] = useState<any>(null);

  // ── Essence input State ───────────────────────────────────
  const [essenceSlotInput, setEssenceSlotInput] = useState<number | null>(null);
  const [essenceName, setEssenceName] = useState("");
  const [essenceDesc, setEssenceDesc] = useState("");

  // ── Campaign Notes input State ────────────────────────────
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCat, setNoteCat] = useState<string>("general");

  // ── Roll state ────────────────────────────────────────────
  const [rollTab, setRollTab] = useState<"stats" | "dice" | "history">("stats");
  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  
  const [critChain, setCritChain] = useState<{
    chainCount: number;
    chainDie: string;
    runningDiceTotal: number;
    modifier: number;
    label: string;
    lastRolledValue: number;
  } | null>(null);

  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    hadCrit: boolean;
    maxChainCount: number;
    diceType: string;
    label: string;
  } | null>(null);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!character) return <div className="p-8 text-center text-muted-foreground">Character not found</div>;

  // ── Recalculate adjusted stats from equipment ─────────────
  const { stats: finalStats, modifiers: autoModifiers, diceLabels, maxHp, maxMana, maxDt } = getAdjustedStats(character, equipment);

  // ── Derived max values for familiar ───────────────────────
  const getFamiliarMaxValues = (fam: Familiar) => {
    const vars = {
      power: fam.power, pow: fam.power,
      vitality: fam.vitality, vit: fam.vitality,
      spirit: fam.spirit, spi: fam.spirit,
      agility: fam.agility, agi: fam.agility,
      endurance: fam.endurance, end: fam.endurance,
      precision: fam.precision, pre: fam.precision,
      willpower: fam.willpower, wil: fam.willpower,
      charisma: fam.charisma, cha: fam.charisma,
      dtbonus: fam.dtBonus
    };
    return {
      maxHp: Math.max(1, evaluateFormula(fam.hpFormula || "Vitality * 8", vars)),
      maxMana: Math.max(0, evaluateFormula(fam.manaFormula || "Spirit * 5", vars)),
      maxDt: Math.max(0, evaluateFormula(fam.dtFormula || "Endurance * 1", vars)),
    };
  };

  const famMax = character.familiar ? getFamiliarMaxValues(character.familiar) : { maxHp: 1, maxMana: 0, maxDt: 0 };

  // ── HP Adjustments ────────────────────────────────────────
  const handleHpAdd = () => {
    const amount = parseInt(hpAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = Math.min(maxHp, cur + amount);
    setHp(next);
    setHpAdd("");
    updateChar.mutate({ id, data: { currentHp: next } });
  };

  const handleHpRemove = () => {
    const amount = parseInt(hpRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = Math.max(0, cur - amount);
    setHp(next);
    setHpRemove("");
    updateChar.mutate({ id, data: { currentHp: next } });
  };

  const handleHpBuff = () => {
    const amount = parseInt(hpBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = cur + amount;
    setHp(next);
    setHpBuff("");
    updateChar.mutate({ id, data: { currentHp: next } });
  };

  const handleFullRestoreHp = () => {
    setHp(maxHp);
    updateChar.mutate({ id, data: { currentHp: maxHp } });
  };

  // ── DT Adjustments ────────────────────────────────────────
  const handleApplyDamage = () => {
    const amount = parseInt(dtRemove);
    if (isNaN(amount) || amount <= 0) return;
    
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, absorbed: data.absorbed });
        setDtFlash("hit");
        setDtRemove("");
        setTimeout(() => setDtFlash(null), 600);
      }
    });
  };

  const handleDtAdd = () => {
    const amount = parseInt(dtAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = currentDt ?? character.currentDt;
    const next = Math.min(maxDt, cur + amount);
    setCurrentDt(next);
    setDtAdd("");
    updateChar.mutate({ id, data: { currentDt: next } });
  };

  const handleDtBuff = () => {
    const amount = parseInt(dtBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = currentDt ?? character.currentDt;
    const next = cur + amount;
    setCurrentDt(next);
    setDtBuff("");
    updateChar.mutate({ id, data: { currentDt: next } });
  };

  const handleRestoreDt = () => {
    setCurrentDt(maxDt);
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: maxDt } });
  };

  // ── Mana Adjustments ──────────────────────────────────────
  const handleManaAdd = () => {
    const amount = parseInt(manaAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = Math.min(maxMana, cur + amount);
    setMana(next);
    setManaAdd("");
    updateChar.mutate({ id, data: { currentMana: next } });
  };

  const handleManaRemove = () => {
    const amount = parseInt(manaRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = Math.max(0, cur - amount);
    setMana(next);
    setManaRemove("");
    updateChar.mutate({ id, data: { currentMana: next } });
  };

  const handleManaBuff = () => {
    const amount = parseInt(manaBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = cur + amount;
    setMana(next);
    setManaBuff("");
    updateChar.mutate({ id, data: { currentMana: next } });
  };

  const handleFullRestoreMana = () => {
    setMana(maxMana);
    updateChar.mutate({ id, data: { currentMana: maxMana } });
  };

  // ── Familiar Adjustments Mutator Helper ───────────────────
  const updateFamiliarData = (updatedFam: Familiar | null) => {
    updateChar.mutate({ id, data: { familiar: updatedFam } });
  };

  // ── Familiar HP Adjustments ───────────────────────────────
  const handleFamHpAdd = () => {
    if (!character.familiar) return;
    const amount = parseInt(famHpAdd);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.min(famMax.maxHp, character.familiar.currentHp + amount);
    updateFamiliarData({ ...character.familiar, currentHp: next });
    setFamHpAdd("");
  };

  const handleFamHpRemove = () => {
    if (!character.familiar) return;
    const amount = parseInt(famHpRemove);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, character.familiar.currentHp - amount);
    updateFamiliarData({ ...character.familiar, currentHp: next });
    setFamHpRemove("");
  };

  const handleFamHpBuff = () => {
    if (!character.familiar) return;
    const amount = parseInt(famHpBuff);
    if (isNaN(amount) || amount <= 0) return;
    const next = character.familiar.currentHp + amount;
    updateFamiliarData({ ...character.familiar, currentHp: next });
    setFamHpBuff("");
  };

  const handleFamFullRestoreHp = () => {
    if (!character.familiar) return;
    updateFamiliarData({ ...character.familiar, currentHp: famMax.maxHp });
  };

  // ── Familiar DT Adjustments ───────────────────────────────
  const handleFamDtAdd = () => {
    if (!character.familiar) return;
    const amount = parseInt(famDtAdd);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.min(famMax.maxDt, character.familiar.currentDt + amount);
    updateFamiliarData({ ...character.familiar, currentDt: next });
    setFamDtAdd("");
  };

  const handleFamDtRemove = () => {
    if (!character.familiar) return;
    const amount = parseInt(famDtRemove);
    if (isNaN(amount) || amount <= 0) return;

    let dtVal = character.familiar.currentDt;
    let hpVal = character.familiar.currentHp;
    let hpLost = 0;
    let absorbed = true;

    if (amount > dtVal) {
      hpLost = amount - dtVal;
      hpVal = Math.max(0, hpVal - hpLost);
      dtVal = 0;
      absorbed = false;
    } else {
      dtVal -= amount;
    }

    setFamDamageResult({ hpLost, absorbed });
    setFamDtFlash("hit");
    updateFamiliarData({ ...character.familiar, currentHp: hpVal, currentDt: dtVal });
    setFamDtRemove("");
    setTimeout(() => { setFamDtFlash(null); }, 600);
  };

  const handleFamDtBuff = () => {
    if (!character.familiar) return;
    const amount = parseInt(famDtBuff);
    if (isNaN(amount) || amount <= 0) return;
    const next = character.familiar.currentDt + amount;
    updateFamiliarData({ ...character.familiar, currentDt: next });
    setFamDtBuff("");
  };

  const handleFamRestoreDt = () => {
    if (!character.familiar) return;
    setFamDtFlash("restore");
    setFamDamageResult(null);
    updateFamiliarData({ ...character.familiar, currentDt: famMax.maxDt });
    setTimeout(() => { setFamDtFlash(null); }, 600);
  };

  // ── Familiar Mana Adjustments ─────────────────────────────
  const handleFamManaAdd = () => {
    if (!character.familiar) return;
    const amount = parseInt(famManaAdd);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.min(famMax.maxMana, character.familiar.currentMana + amount);
    updateFamiliarData({ ...character.familiar, currentMana: next });
    setFamManaAdd("");
  };

  const handleFamManaRemove = () => {
    if (!character.familiar) return;
    const amount = parseInt(famManaRemove);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, character.familiar.currentMana - amount);
    updateFamiliarData({ ...character.familiar, currentMana: next });
    setFamManaRemove("");
  };

  const handleFamManaBuff = () => {
    if (!character.familiar) return;
    const amount = parseInt(famManaBuff);
    if (isNaN(amount) || amount <= 0) return;
    const next = character.familiar.currentMana + amount;
    updateFamiliarData({ ...character.familiar, currentMana: next });
    setFamManaBuff("");
  };

  const handleFamFullRestoreMana = () => {
    if (!character.familiar) return;
    updateFamiliarData({ ...character.familiar, currentMana: famMax.maxMana });
  };

  // ── Delete character ──────────────────────────────────────
  const handleDelete = () => {
    if (confirm("Permanently delete this character?")) {
      deleteChar.mutate({ id }, { onSuccess: () => setLocation("/") });
    }
  };

  // ── Dice rolling handlers ─────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const modifier = autoModifier !== undefined ? autoModifier : (parseInt(rollMod) || 0);
    setRollingDice(rollKey);
    setLastRoll(null);
    setCritChain(null);
    
    createRoll.mutate(
      { id, data: { diceType, modifier, label: label || rollLabel || diceType, ...(statValue !== undefined ? { statValue } : {}) } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const chainDie = diceType.split("+").pop() ?? diceType;
            const lbl = label || rollLabel || diceType;
            
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier, label: lbl, lastRolledValue: rolled });
            } else {
              setLastRoll({ rawRoll: rolled, modifier, total: rolled + modifier, hadCrit: false, maxChainCount: -1, diceType, label: lbl });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleChainRoll = () => {
    if (!critChain) return;
    const { chainDie, runningDiceTotal, modifier, label, chainCount } = critChain;
    setRollingDice("chain");
    
    createRoll.mutate(
      { id, data: { diceType: chainDie, modifier: 0, label } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const newTotal = runningDiceTotal + rolled;
            
            if (wasCrit) {
              setCritChain({ chainCount: chainCount + 1, chainDie, runningDiceTotal: newTotal, modifier, label, lastRolledValue: rolled });
            } else {
              setCritChain(null);
              setLastRoll({ rawRoll: newTotal, modifier, total: newTotal + modifier, hadCrit: true, maxChainCount: chainCount, diceType: chainDie, label });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = finalStats[statKey];
    const modifier = autoModifiers[statKey];
    handleRoll(diceLabels[statKey], `${statLabel} Roll`, statValue, modifier);
  };

  const handleSkillRoll = (skill: Skill) => {
    const modifier = Math.floor(skill.value / 3) + skill.modifier;
    handleRoll(getDiceLabel(skill.value), `${skill.name} Skill Roll`, undefined, modifier);
  };

  const handleWeaponRoll = (item: Equipment) => {
    const dice = item.diceType || "d8";
    const statMod = autoModifiers.power || 0;
    const flatMod = item.modifier || 0;
    const totalMod = statMod + flatMod;
    handleRoll(dice, `${item.name} Strike`, border => {}, totalMod);
  };

  const handleAbilityRoll = (ability: Ability) => {
    const curMana = mana ?? character.currentMana;
    if (curMana < ability.cost) {
      toast.error(`Not enough Mana! Requires ${ability.cost} MP (Have ${curMana} MP)`);
      return;
    }

    const nextMana = curMana - ability.cost;
    setMana(nextMana);
    updateChar.mutate({ id, data: { currentMana: nextMana } });

    if (ability.rollFormula) {
      const statKey = ability.linkedStat || "spirit";
      const mod = autoModifiers[statKey] || 0;
      handleRoll(ability.rollFormula, `${ability.name} Cast`, undefined, mod);
    } else {
      toast.success(`${ability.name} activated! (-${ability.cost} MP)`);
    }
  };

  // ── Familiar Rolls ────────────────────────────────────────
  const handleFamiliarStatRoll = (statKey: string, statLabel: string, val: number) => {
    const mod = Math.floor(val / 3);
    const dice = getDiceLabel(val);
    handleRoll(dice, `Fam: ${statLabel} Roll`, undefined, mod);
  };

  const handleFamiliarAbilityRoll = (ability: FamiliarAbility) => {
    if (!character.familiar) return;
    const curMana = character.familiar.currentMana;
    if (curMana < ability.cost) {
      toast.error(`Familiar not enough mana! Requires ${ability.cost} MP`);
      return;
    }
    const nextMana = curMana - ability.cost;
    updateFamiliarData({ ...character.familiar, currentMana: nextMana });

    if (ability.rollFormula) {
      const mod = Math.floor((character.familiar as any)[ability.linkedStat || "power"] / 3) || 0;
      handleRoll(ability.rollFormula, `Fam: ${ability.name} Cast`, undefined, mod);
    } else {
      toast.success(`Familiar used ${ability.name}!`);
    }
  };

  // ── Favorites Hotbar Executer ─────────────────────────────
  const handleExecuteFavorite = (slot: FavoriteSlot) => {
    if (slot.type === "attribute") {
      const statLabel = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      handleStatRoll(slot.targetId as string, statLabel);
    } else if (slot.type === "weapon") {
      const item = equipment.find(e => e.id === Number(slot.targetId));
      if (item) handleWeaponRoll(item);
      else toast.error("Weapon no longer equipped or found");
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) handleAbilityRoll(ability);
      else toast.error("Ability not found");
    } else if (slot.type === "skill") {
      const skill = skills.find(s => s.id === Number(slot.targetId));
      if (skill) handleSkillRoll(skill);
      else toast.error("Skill not found");
    } else if (slot.type === "familiar-attribute" && character.familiar) {
      const statVal = (character.familiar as any)[slot.targetId] as number;
      handleFamiliarStatRoll(slot.targetId as string, String(slot.targetId).toUpperCase(), statVal);
    } else if (slot.type === "familiar-ability" && character.familiar) {
      const ability = character.familiar.abilities.find(a => a.id === Number(slot.targetId));
      if (ability) handleFamiliarAbilityRoll(ability);
      else toast.error("Familiar ability not found");
    }
  };

  const handleAssignFavorite = (slotIdx: number, type: FavoriteSlot["type"], targetId: string | number, label: string) => {
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = { type, targetId, label };
    updateChar.mutate({ id, data: { favorites: cur } });
    setAssigningSlotIndex(null);
    toast.success(`Slot #${slotIdx + 1} assigned successfully!`);
  };

  const handleClearFavorite = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = null;
    updateChar.mutate({ id, data: { favorites: cur } });
    toast.success(`Slot #${slotIdx + 1} cleared.`);
  };

  // ── Inventory Dialog Trigger Helpers ──────────────────────
  const triggerAddInventory = (category: "currency" | "equipment" | "item") => {
    setInvType(category);
    setInvMode("add");
    setInvInitialData(null);
    setIsInvOpen(true);
  };

  const triggerEditInventory = (category: "currency" | "equipment" | "item", item: any) => {
    setInvType(category);
    setInvMode("edit");
    setInvInitialData(item);
    setIsInvOpen(true);
  };

  // ── Essence Additions ─────────────────────────────────────
  const handleSaveEssence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!essenceName.trim() || essenceSlotInput === null) return;
    
    addEssence.mutate({
      characterId: id,
      name: essenceName,
      description: essenceDesc,
      slot: essenceSlotInput,
    }, {
      onSuccess: () => {
        setEssenceSlotInput(null);
        setEssenceName("");
        setEssenceDesc("");
      }
    });
  };

  // ── Campaign Notes Additions ──────────────────────────────
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    createNote.mutate(
      {
        characterId: id,
        title: noteTitle,
        content: noteContent,
        category: noteCat,
        tags: [],
      },
      {
        onSuccess: () => {
          setNoteTitle("");
          setNoteContent("");
          setNoteCat("general");
        }
      }
    );
  };

  // ── Stat & Skill Training (Direction Support) ──────────────
  const handleStatTrain = (statKey: string, direction: "up" | "down" = "up") => {
    const charStatValue = (character as any)[statKey] as number;
    const trainingKey = `${statKey}Training`;
    const curTraining = (character as any)[trainingKey] as number;

    if (direction === "up") {
      const nextTraining = curTraining + 1;
      if (nextTraining >= charStatValue) {
        updateChar.mutate({
          id,
          data: {
            [statKey]: charStatValue + 1,
            [trainingKey]: 0,
          }
        }, {
          onSuccess: () => toast.success(`${statKey.toUpperCase()} increased to ${charStatValue + 1}!`)
        });
      } else {
        updateChar.mutate({ id, data: { [trainingKey]: nextTraining } });
      }
    } else {
      const nextTraining = Math.max(0, curTraining - 1);
      updateChar.mutate({ id, data: { [trainingKey]: nextTraining } });
    }
  };

  const handleSkillTrain = (skill: Skill, direction: "up" | "down" = "up") => {
    if (direction === "up") {
      const nextTraining = skill.training + 1;
      if (nextTraining >= skill.value) {
        updateSkillMut.mutate({
          id: skill.id,
          data: {
            value: skill.value + 1,
            training: 0,
          }
        }, {
          onSuccess: () => toast.success(`${skill.name} increased to ${skill.value + 1}!`)
        });
      } else {
        updateSkillMut.mutate({ id: skill.id, data: { training: nextTraining } });
      }
    } else {
      const nextTraining = Math.max(0, skill.training - 1);
      updateSkillMut.mutate({ id: skill.id, data: { training: nextTraining } });
    }
  };

  // ── Familiar Binder ───────────────────────────────────────
  const handleBindFamiliar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!famName.trim()) return;

    const vars = {
      power: famPower, pow: famPower,
      vitality: famVitality, vit: famVitality,
      spirit: famSpirit, spi: famSpirit,
      agility: famAgility, agi: famAgility,
      endurance: famEndurance, end: famEndurance,
      precision: famPrecision, pre: famPrecision,
      willpower: famWillpower, wil: famWillpower,
      charisma: famCharisma, cha: famCharisma,
      dtbonus: 0
    };

    const calculatedHp = Math.max(1, evaluateFormula(famHpFormula || "Vitality * 8", vars));
    const calculatedMana = Math.max(0, evaluateFormula(famManaFormula || "Spirit * 5", vars));
    const calculatedDt = Math.max(0, evaluateFormula(famDtFormula || "Endurance * 1", vars));

    const newFam: Familiar = {
      name: famName,
      className: famClassName || "Companion",
      race: famRace || "Beast",
      level: famLevel,
      speed: famSpeed,
      power: famPower,
      vitality: famVitality,
      spirit: famSpirit,
      agility: famAgility,
      endurance: famEndurance,
      precision: famPrecision,
      willpower: famWillpower,
      charisma: famCharisma,
      currentHp: calculatedHp,
      currentMana: calculatedMana,
      currentDt: calculatedDt,
      dtBonus: 0,
      hpFormula: famHpFormula || "Vitality * 8",
      manaFormula: famManaFormula || "Spirit * 5",
      dtFormula: famDtFormula || "Endurance * 1",
      abilities: []
    };

    updateFamiliarData(newFam);
    toast.success(`Familiar ${newFam.name} bound successfully!`);
  };

  const handleReleaseFamiliar = () => {
    if (confirm("Release your familiar companion?")) {
      updateFamiliarData(null);
      toast.success("Familiar released.");
    }
  };

  const handleCreateFamAbility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!character.familiar || !famAbilityName.trim()) return;

    const newAb: FamiliarAbility = {
      id: Date.now(),
      name: famAbilityName,
      description: famAbilityDesc,
      cost: famAbilityCost,
      cooldown: 0,
      range: "Melee",
      speed: "Standard",
      rollFormula: famAbilityFormula,
      linkedStat: "power",
      assignedToQuickRolls: false
    };

    const updated = {
      ...character.familiar,
      abilities: [...(character.familiar.abilities || []), newAb]
    };
    updateFamiliarData(updated);
    setFamAbilityName("");
    setFamAbilityDesc("");
    setFamAbilityCost(0);
    setFamAbilityFormula("");
    setIsAddingFamAbility(false);
    toast.success("Familiar ability added.");
  };

  const handleDeleteFamAbility = (abId: number) => {
    if (!character.familiar) return;
    const filtered = character.familiar.abilities.filter(a => a.id !== abId);
    updateFamiliarData({ ...character.familiar, abilities: filtered });
    toast.success("Familiar ability removed.");
  };

  // Backup Imports
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importCharacterJSON(text);
        toast.success(`Character '${imported.name}' imported successfully!`);
        setLocation(`/characters/${imported.id}`);
      } catch (err) {
        toast.error("Invalid character sheet file format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const activeFavorites = getFavorites(character, equipment, abilities);

  // Notes Search filter computation
  const filteredNotes = notes.filter(n => {
    const matchSearch = noteSearchQuery.trim() === "" || 
      n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase());
    const matchCat = noteCategoryFilter === "all" || n.category === noteCategoryFilter;
    return matchSearch && matchCat;
  });

  const tier = critChain ? CRIT_TIERS[Math.min(critChain.chainCount, CRIT_TIERS.length - 1)] : null;
  const finalTier = lastRoll?.hadCrit ? CRIT_TIERS[Math.min(lastRoll.maxChainCount, CRIT_TIERS.length - 1)] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6">
      
      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground rounded-none cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCharacterJSON(id)} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Upload className="w-3.5 h-3.5 mr-1" /> Import JSON
          </Button>
          <EditCharacterDialog character={character} />
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-none cursor-pointer" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Double-Column Main Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

        {/* COLUMN 1: CHARACTER HUD (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="bg-card border-border/40 shadow-lg relative overflow-hidden rounded-none">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10" />
            
            <CardContent className="p-5 space-y-5">
              {/* Profile HUD Row */}
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/30 pb-3">
                <div>
                  <h1 className="text-3xl font-serif text-primary font-bold leading-tight">
                    {character.name}
                  </h1>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                    Level {character.level} · {character.race} · {character.className}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Speed</div>
                  <div className="text-2xl font-serif text-foreground font-bold">{character.speed} ft</div>
                </div>
              </div>

              {/* Resource Management HUD grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. HP (Health) */}
                <div className="rounded-none border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-4 h-4 text-destructive" /> Health (HP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${hp && hp > maxHp ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {hp ?? character.currentHp}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxHp}</span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={maxHp} color={hp && hp > maxHp ? "#f59e0b" : "hsl(var(--destructive))"} />
                  
                  {/* hp quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpAdd} placeholder="Heal val"
                        onChange={e => setHpAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleHpAdd} disabled={!hpAdd}>
                        Heal
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpRemove} placeholder="Dmg val"
                        onChange={e => setHpRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleHpRemove} disabled={!hpRemove}>
                        Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpBuff} placeholder="Buff val"
                        onChange={e => setHpBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleHpBuff} disabled={!hpBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                      onClick={handleFullRestoreHp}>
                      Full Restore HP
                    </Button>
                  </div>
                </div>

                {/* 2. DT (Damage Threshold) */}
                <div className={`rounded-none border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/40 bg-background/30"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-primary" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${
                      dtFlash === "hit" ? "text-destructive" 
                      : currentDt && currentDt > maxDt ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" 
                      : "text-foreground"
                    }`}>
                      {currentDt ?? character.currentDt}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxDt}</span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt} color={currentDt && currentDt > maxDt ? "#f59e0b" : "hsl(var(--primary))"} />
                  
                  {/* dt quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtAdd} placeholder="Add val"
                        onChange={e => setDtAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleDtAdd} disabled={!dtAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtRemove} placeholder="Hit val"
                        onChange={e => { setDtRemove(e.target.value); setDamageResult(null); }}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleApplyDamage} disabled={!dtRemove || applyDamageMut.isPending}>
                        Hit
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtBuff} placeholder="Buff val"
                        onChange={e => setDtBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleDtBuff} disabled={!dtBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                      onClick={handleRestoreDt}>
                      Full Restore DT
                    </Button>
                    {damageResult && (
                      <p className={`text-[10px] font-mono text-center mt-1 ${damageResult.absorbed ? "text-primary" : "text-destructive"}`}>
                        {damageResult.absorbed ? "✦ Absorbed" : damageResult.hpLost > 0 ? `−${damageResult.hpLost} HP` : "DT hit"}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Mana (MP) */}
                <div className="rounded-none border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Mana (MP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${mana && mana > maxMana ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {mana ?? character.currentMana}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxMana}</span>
                  </div>
                  <ResourceBar current={mana ?? character.currentMana} max={maxMana} color={mana && mana > maxMana ? "#f59e0b" : "#3b82f6"} />
                  
                  {/* mana quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaAdd} placeholder="Add val"
                        onChange={e => setManaAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleManaAdd} disabled={!manaAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaRemove} placeholder="Use val"
                        onChange={e => setManaRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleManaRemove} disabled={!manaRemove}>
                        Use
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaBuff} placeholder="Buff val"
                        onChange={e => setManaBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                        onClick={handleManaBuff} disabled={!manaBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                      onClick={handleFullRestoreMana}>
                      Full Restore Mana
                    </Button>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* ── Custom Favorites Hotbar ── */}
          <Card className="bg-card/75 border-border/40 p-4 rounded-none shadow-md">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Favorites Hotbar
            </h3>
            
            {/* 10 Square Uniform Grid */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
              {activeFavorites.map((fav, index) => {
                if (fav) {
                  return (
                    <div 
                      key={index} 
                      onClick={() => handleExecuteFavorite(fav)}
                      className="aspect-square bg-background/60 hover:bg-accent/50 border border-primary/50 hover:border-primary transition-all relative flex flex-col items-center justify-center cursor-pointer p-1 group"
                      title={`Favorite #${index + 1}: ${fav.label}`}
                    >
                      {/* Delete Slot Button */}
                      <button
                        onClick={(e) => handleClearFavorite(index, e)}
                        className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-destructive hover:bg-destructive/95 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-none border border-border"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                      <div className="text-[10px] font-bold text-primary text-center truncate max-w-full leading-tight font-serif px-0.5">
                        {fav.label.split(" ")[0]}
                      </div>
                      <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-tighter mt-1 font-semibold">
                        {fav.type === "weapon" ? "WP" : fav.type === "ability" ? "SP" : fav.type === "skill" ? "SK" : fav.type === "familiar-ability" ? "FA" : "AT"}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <button
                      key={index}
                      onClick={() => setAssigningSlotIndex(index)}
                      className="aspect-square bg-background/20 hover:bg-accent/30 border border-dashed border-border/50 hover:border-primary/50 transition-all flex items-center justify-center cursor-pointer text-muted-foreground hover:text-primary rounded-none"
                      title={`Click to assign Favorite #${index + 1}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  );
                }
              })}
            </div>

            {/* Favorite Assignment Selection Modal */}
            <Dialog open={assigningSlotIndex !== null} onOpenChange={(open) => { if(!open) setAssigningSlotIndex(null); }}>
              <DialogContent className="sm:max-w-[500px] max-h-[75vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none">
                <DialogHeader className="border-b border-border/30 pb-2">
                  <DialogTitle className="font-serif text-2xl text-primary font-bold">
                    Assign Favorite Slot #{assigningSlotIndex !== null ? assigningSlotIndex + 1 : ""}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4 text-xs font-sans">
                  
                  {/* Attributes */}
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Attributes</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {STATS.map(stat => (
                        <Button 
                          key={stat.key} variant="outline" size="sm" className="h-6 text-[10px] font-mono rounded-none"
                          onClick={() => handleAssignFavorite(assigningSlotIndex!, "attribute", stat.key, stat.label)}
                        >
                          {stat.label} (+{autoModifiers[stat.key]})
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Weapons */}
                  {equipment.filter(e => e.equipped).length > 0 && (
                    <div>
                      <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Equipped Weapons / Gear</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {equipment.filter(e => e.equipped).map(eq => (
                          <Button 
                            key={eq.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "weapon", eq.id, eq.name)}
                          >
                            {eq.name} {eq.diceType ? `(${eq.diceType})` : ""}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shaped Spells */}
                  {abilities.length > 0 && (
                    <div>
                      <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Shaped Spells</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {abilities.map(ab => (
                          <Button 
                            key={ab.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "ability", ab.id, ab.name)}
                          >
                            {ab.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Skills */}
                  {skills.length > 0 && (
                    <div>
                      <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Custom Skills</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map(sk => (
                          <Button 
                            key={sk.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "skill", sk.id, sk.name)}
                          >
                            {sk.name} (-{sk.value})
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Familiar Options (If present) */}
                  {character.familiar && (
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Familiar Attributes</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {STATS.map(stat => {
                            const val = (character.familiar as any)[stat.key] as number;
                            return (
                              <Button 
                                key={stat.key} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-mono"
                                onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-attribute", stat.key, `Fam-${stat.label}`)}
                              >
                                Fam-{stat.label} (+{Math.floor(val/3)})
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                      {character.familiar.abilities && character.familiar.abilities.length > 0 && (
                        <div>
                          <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Familiar Actions</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {character.familiar.abilities.map(ab => (
                              <Button 
                                key={ab.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                                onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-ability", ab.id, `Fam-${ab.name}`)}
                              >
                                Fam-{ab.name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </DialogContent>
            </Dialog>
          </Card>
        </div>

        {/* COLUMN 2: DICE HUD (1/3 width) */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border/40 shadow-lg relative overflow-hidden h-full rounded-none">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="p-4 flex flex-col gap-3 h-full justify-between">
              
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex gap-1 bg-background/50 rounded-none p-1 border border-border/30">
                  <button
                    onClick={() => setRollTab("stats")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "stats" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Stats
                  </button>
                  <button
                    onClick={() => setRollTab("dice")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "dice" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Dice
                  </button>
                  <button
                    onClick={() => setRollTab("history")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "history" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    History
                  </button>
                </div>

                {/* Stats tab */}
                {rollTab === "stats" && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {STATS.map(stat => {
                      const value = finalStats[stat.key];
                      const mod = autoModifiers[stat.key];
                      const dice = diceLabels[stat.key];
                      const isRolling = rollingDice === `${stat.label} Roll`;
                      return (
                        <button
                          key={stat.key}
                          onClick={() => handleStatRoll(stat.key, stat.label)}
                          disabled={!!rollingDice}
                          title={`${stat.desc} — ${dice}`}
                          className={`rounded-none p-1 text-center border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isRolling ? "border-primary bg-primary/10 animate-pulse"
                            : "border-border/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                          }`}
                        >
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                          <div className="text-xl font-serif text-foreground leading-tight">{value}</div>
                          <div className="text-[10px] font-mono text-primary">+{mod}</div>
                          <div className="text-[8px] font-mono text-muted-foreground/60">{dice}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Dice tab */}
                {rollTab === "dice" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={rollLabel}
                        onChange={e => setRollLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="bg-background/50 border-border/50 text-xs h-7 flex-1 rounded-none"
                      />
                      <Input
                        type="number"
                        value={rollMod}
                        onChange={e => setRollMod(e.target.value)}
                        className="bg-background/50 border-border/50 text-center font-mono text-xs h-7 w-14 flex-shrink-0 rounded-none"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["d4","d6","d8","d10","d12","d20","d100"] as const).map(d => (
                        <Button
                          key={d}
                          variant="outline"
                          size="sm"
                          className={`font-mono font-bold text-xs h-8 rounded-none cursor-pointer ${rollingDice === d ? "animate-pulse bg-primary/20 border-primary" : "bg-background/50 hover:border-primary/50"}`}
                          disabled={!!rollingDice}
                          onClick={() => handleRoll(d)}
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* History tab */}
                {rollTab === "history" && (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {loadingRolls ? (
                      <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : rolls && rolls.length > 0 ? (
                      <div className="divide-y divide-border/20">
                        {rolls.map(roll => (
                          <div key={roll.id} className="py-2 flex justify-between items-center hover:bg-accent/10 px-1 transition-colors">
                            <div>
                              <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                                {roll.label || "Roll"}
                                {roll.isCrit && <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest">crit</span>}
                              </div>
                              <div className="text-[9px] text-muted-foreground font-mono">
                                {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-base font-serif font-bold ${roll.isCrit ? "text-yellow-500 animate-pulse" : "text-primary"}`}>{roll.total}</div>
                              <div className="text-[8px] text-muted-foreground/45">{format(new Date(roll.rolledAt), "HH:mm")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground font-serif italic">No rolls recorded yet.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Roll result display */}
              <div
                className="p-4 border border-border/50 rounded-none text-center flex flex-col items-center justify-center transition-all duration-500 min-h-[140px] mt-4 bg-background/10"
                style={
                  tier
                    ? { borderColor: tier.color + "99", boxShadow: `0 0 20px 4px ${tier.color}44`, background: tier.color + "08" }
                    : finalTier
                      ? { borderColor: finalTier.color + "55", background: finalTier.color + "05" }
                      : {}
                }
              >
                {rollingDice ? (
                  <Dice5 className="w-10 h-10 animate-spin text-primary opacity-50" />
                ) : critChain ? (
                  <div className="animate-in zoom-in duration-200 w-full">
                    <p className="text-[10px] uppercase tracking-[0.25em] mb-2 font-bold animate-pulse" style={{ color: tier!.color }}>
                      ✦ {tier!.name} — Crit #{critChain.chainCount + 1} ✦
                    </p>
                    <div className="mb-1">
                      <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Rolled</span>
                      <span className="text-4xl font-mono font-bold" style={{ color: tier!.color }}>{critChain.lastRolledValue}</span>
                      <span className="text-[10px] uppercase tracking-wider block mt-0.5" style={{ color: tier!.color + "aa" }}>
                        {critChain.chainDie} — Max!
                      </span>
                    </div>
                    <div className="my-1 px-3 py-0.5 rounded-none inline-block text-xs font-mono text-muted-foreground border border-border/30 bg-background/40">
                      Running: {critChain.runningDiceTotal}
                      {critChain.modifier !== 0 && <span className="text-primary"> +{critChain.modifier}</span>}
                    </div>
                    <div className="mt-2">
                      <button
                        onClick={handleChainRoll}
                        disabled={!!rollingDice}
                        className="px-5 py-1.5 rounded-none font-bold text-xs uppercase tracking-widest animate-pulse disabled:opacity-50 hover:scale-105 hover:animate-none transition-transform cursor-pointer"
                        style={{
                          color: tier!.color,
                          border: `1px solid ${tier!.color}`,
                          boxShadow: `0 0 10px 2px ${tier!.color}22`,
                          background: tier!.color + "15",
                        }}
                      >
                        One More!
                      </button>
                    </div>
                  </div>
                ) : lastRoll ? (
                  <div className="animate-in zoom-in duration-300 w-full">
                    {lastRoll.hadCrit ? (
                      <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: finalTier?.color ?? "#ffd700" }}>
                        ✦ {finalTier?.name ?? "Critical"} Hit! ✦
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2 font-semibold">{lastRoll.label}</p>
                    )}
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      <div className="text-center">
                        <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Roll</span>
                        <span className="text-2xl font-mono font-semibold text-foreground">{lastRoll.rawRoll}</span>
                      </div>
                      {lastRoll.modifier !== 0 && (
                        <>
                          <span className="text-lg text-muted-foreground font-light mt-2">+</span>
                          <div className="text-center">
                            <span className="text-[10px] text-muted-foreground block uppercase tracking-wider">Mod</span>
                            <span className="text-2xl font-mono font-semibold text-primary">{lastRoll.modifier}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="h-px w-24 mx-auto my-2"
                      style={{ background: finalTier ? finalTier.color + "60" : "rgba(255,255,255,0.12)" }} />
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block">Total</span>
                      <span className="text-6xl font-serif font-bold leading-none"
                        style={{ color: finalTier?.color ?? "hsl(var(--primary))" }}>
                        {lastRoll.total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm font-serif italic">The dice await...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── TABBED TOOL SCREEN BAR ── */}
      <div className="flex gap-1 border-b border-border/40 mt-6 overflow-x-auto pb-1 flex-wrap">
        {[
          { key: "stats", label: "Base & Training", icon: Hammer },
          { key: "skills", label: "Skills Log", icon: BookText },
          { key: "inventory", label: "Bag / Gear", icon: Coins },
          { key: "essences", label: "Essence Confluence", icon: Layers },
          { key: "abilities", label: "Shaped Spells", icon: Flame },
          { key: "notes", label: "Campaign Notes", icon: BookText },
          { key: "familiar", label: "Companion Familiar", icon: UserCheck }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              onClick={() => setActiveTab(tab.key as any)}
              className={`rounded-none border-b-2 font-serif text-sm px-4 py-2 flex items-center gap-1.5 h-10 cursor-pointer ${
                isActive ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* ── ACTIVE TOOL SCREEN AREA ── */}
      <div className="mt-4 animate-in fade-in duration-300">

        {/* TAB 1: STATS & TRAINING (Base Stats Only) */}
        {activeTab === "stats" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(stat => {
              const baseValue = (character as any)[stat.key] as number;
              const trainingKey = `${stat.key}Training`;
              const curTraining = (character as any)[trainingKey] as number;

              return (
                <Card key={stat.key} className="bg-card border-border/50 shadow-sm flex flex-col justify-between rounded-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</h4>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">{stat.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between py-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-serif font-bold text-foreground">{baseValue}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground/60">{getDiceLabel(baseValue)}</span>
                    </div>

                    {/* Stat training tracker */}
                    <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground uppercase">Training Points</span>
                        <span className="text-primary font-bold">{curTraining}/{baseValue}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 bg-accent/40 h-1.5 rounded-none overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-none transition-all"
                            style={{ width: `${Math.min(100, (curTraining / baseValue) * 100)}%` }}
                          />
                        </div>
                        
                        {/* +/- Increment/Decrement group */}
                        <div className="flex border border-border/50">
                          <button
                            className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            onClick={() => handleStatTrain(stat.key, "down")}
                            disabled={curTraining === 0}
                          >
                            -
                          </button>
                          <div className="h-6 w-[1px] bg-border/50" />
                          <button
                            className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer"
                            onClick={() => handleStatTrain(stat.key, "up")}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* TAB 2: SKILLS (Card click rolls) */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <h3 className="text-lg font-serif text-primary font-bold">Skills Log</h3>
              <EditSkillsDialog characterId={id} />
            </div>

            {skills && skills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map((skill) => (
                  <Card 
                    key={skill.id} 
                    onClick={() => handleSkillRoll(skill)}
                    className="bg-card border-border/50 hover:border-primary/60 transition-all cursor-pointer rounded-none flex flex-col justify-between group"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif text-lg font-bold text-foreground group-hover:text-primary transition-colors">{skill.name}</h4>
                        <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-background/40 rounded-none">{getDiceLabel(skill.value)}</Badge>
                      </div>

                      <div className="flex items-baseline gap-1 py-1">
                        <span className="text-3xl font-serif text-foreground font-bold">{skill.value}</span>
                        <span className="text-xs font-mono text-primary font-bold">+{Math.floor(skill.value / 3)}</span>
                      </div>

                      {/* Skill training */}
                      <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Skill Training</span>
                          <span className="text-primary font-bold">{skill.training}/{skill.value}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 bg-accent/40 h-1.5 rounded-none overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-none transition-all"
                              style={{ width: `${Math.min(100, (skill.training / skill.value) * 100)}%` }}
                            />
                          </div>
                          
                          {/* +/- training buttons */}
                          <div className="flex border border-border/50">
                            <button
                              className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              onClick={() => handleSkillTrain(skill, "down")}
                              disabled={skill.training === 0}
                            >
                              -
                            </button>
                            <div className="h-6 w-[1px] bg-border/50" />
                            <button
                              className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer"
                              onClick={() => handleSkillTrain(skill, "up")}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                No custom skills added yet. Tap "Edit Skills" to register skills.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* Currencies */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" /> Currencies
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("currency")}>
                  [Add]
                </Button>
              </div>

              {currencies && currencies.length > 0 ? (
                <div className="space-y-2">
                  {currencies.map(c => (
                    <Card key={c.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="font-serif font-semibold text-foreground">{c.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-primary">{c.amount}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground rounded-none cursor-pointer" onClick={() => triggerEditInventory("currency", c)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No currencies tracked.</p>
              )}
            </div>

            {/* Equipment */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 text-primary" /> Equipment
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("equipment")}>
                  [Add]
                </Button>
              </div>

              {equipment && equipment.length > 0 ? (
                <div className="space-y-2">
                  {equipment.map(eq => {
                    const bonusList = Object.entries(eq.statModifiers || {}).map(([stat, val]) => `${stat.toUpperCase()}: +${val}`);
                    if (eq.dtBonus > 0) bonusList.push(`DT: +${eq.dtBonus}`);
                    
                    return (
                      <Card key={eq.id} className={`bg-card/50 border-border/40 transition-all rounded-none ${eq.equipped ? "border-primary/40 shadow-sm bg-primary/[0.01]" : ""}`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-serif font-bold text-foreground flex items-center gap-1.5">
                                {eq.name}
                                {eq.equipped && <span className="text-[8px] bg-primary/10 border border-primary/30 text-primary px-1 rounded-none uppercase font-semibold">Equipped</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground/80 font-serif line-clamp-1 mt-0.5">{eq.description}</p>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary rounded-none cursor-pointer" onClick={() => triggerEditInventory("equipment", eq)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEq.mutate({ id: eq.id, charId: id })}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {bonusList.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {bonusList.map(bonus => (
                                <Badge key={bonus} variant="outline" className="text-[9px] font-mono border-primary/20 text-primary/80 py-0.5 px-1.5 rounded-none">{bonus}</Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eq.equipped}
                                onChange={(e) => updateEq.mutate({ id: eq.id, data: { equipped: e.target.checked } })}
                                className="rounded-none border-border/50 h-3 w-3 accent-primary"
                              />
                              Equipped
                            </label>
                            {eq.diceType && (
                              <label className="flex items-center gap-1 cursor-pointer opacity-70">
                                <input
                                  type="checkbox"
                                  checked={eq.assignedToQuickRolls}
                                  onChange={(e) => updateEq.mutate({ id: eq.id, data: { assignedToQuickRolls: e.target.checked } })}
                                  className="rounded-none border-border/50 h-3 w-3 accent-primary"
                                />
                                Auto Hotbar
                              </label>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No equipment found.</p>
              )}
            </div>

            {/* General Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary" /> General Items
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("item")}>
                  [Add]
                </Button>
              </div>

              {inventory && inventory.length > 0 ? (
                <div className="space-y-2">
                  {inventory.map(item => (
                    <Card key={item.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-serif font-semibold text-foreground">
                            {item.name} <span className="font-mono text-muted-foreground/80 font-normal">x{item.quantity}</span>
                          </div>
                          {item.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary rounded-none cursor-pointer" onClick={() => triggerEditInventory("item", item)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEq.mutate({ id: item.id, charId: id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No general items.</p>
              )}
            </div>

            <EditInventoryDialog
              characterId={id}
              isOpen={isInvOpen}
              onOpenChange={setIsInvOpen}
              mode={invMode}
              type={invType}
              initialData={invInitialData}
            />
          </div>
        )}

        {/* TAB 4: ESSENCE CONFLUENCE */}
        {activeTab === "essences" && (
          <div className="space-y-4">
            <h3 className="text-lg font-serif text-primary font-bold border-b border-border/20 pb-2">Essence Confluence</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(slot => {
                const essence = essences.find(e => e.slot === slot);
                const label = slot === 1 ? "First Essence" : slot === 2 ? "Second Essence" : slot === 3 ? "Third Essence" : "Confluence";
                
                return (
                  <Card key={slot} className={`bg-card border-border/50 relative overflow-hidden flex flex-col justify-between rounded-none ${
                    slot === 4 ? "border-amber-500/30 bg-amber-500/[0.02]" : ""
                  }`}>
                    {slot === 4 && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                    )}
                    
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground font-bold">
                          {label}
                        </span>
                        {essence && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEssence.mutate({ id: essence.id, charId: id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {essence ? (
                        <div className="space-y-1">
                          <h4 className={`font-serif text-lg font-bold ${slot === 4 ? "text-amber-400" : "text-foreground"}`}>{essence.name}</h4>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed line-clamp-3">{essence.description}</p>
                        </div>
                      ) : slot === 4 ? (
                        <p className="text-xs text-muted-foreground/60 italic font-serif py-4">
                          Attune essences 1-3 to unleash Confluence.
                        </p>
                      ) : (
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 h-7 text-xs font-serif rounded-none cursor-pointer"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Add Essence
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {essenceSlotInput !== null && (
              <Card className="bg-card border-primary/20 mt-4 max-w-lg animate-in slide-in-from-top-4 duration-300 rounded-none">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-serif text-lg text-primary font-bold">Attune Essence ({essenceSlotInput === 4 ? "Confluence" : `Slot ${essenceSlotInput}`})</h4>
                  <form onSubmit={handleSaveEssence} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Essence Name</label>
                      <Input value={essenceName} onChange={e => setEssenceName(e.target.value)} required placeholder="e.g. Fire, Earth, Sky" className="bg-background text-sm rounded-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                      <Textarea value={essenceDesc} onChange={e => setEssenceDesc(e.target.value)} placeholder="Description of attunements..." className="bg-background text-sm font-serif rounded-none" />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEssenceSlotInput(null)} className="rounded-none">Cancel</Button>
                      <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-serif rounded-none">Apply Essence</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 5: SHAPED SPELLS */}
        {activeTab === "abilities" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <h3 className="text-lg font-serif text-primary font-bold">Shaped Spells</h3>
              <EditAbilitiesDialog characterId={id} />
            </div>

            {abilities && abilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {abilities.map((ability) => (
                  <Card key={ability.id} className="bg-card border-border/50 rounded-none">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif text-xl font-bold text-primary leading-tight">{ability.name}</h4>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{ability.cost} MP</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{ability.range}</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{ability.speed}</Badge>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleAbilityRoll(ability)}
                          className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-8 font-serif rounded-none cursor-pointer"
                        >
                          <Dice5 className="w-3.5 h-3.5 mr-1" /> Cast Spell
                        </Button>
                      </div>

                      <div
                        className="text-xs text-muted-foreground font-serif leading-relaxed border-t border-border/30 pt-3 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(ability.description) }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                No shaped abilities prepared. Click "Edit Spells" to register spells.
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CAMPAIGN NOTES (Search and Thematic Filter) */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              
              {/* Note creation column */}
              <div className="lg:col-span-1">
                <Card className="bg-card border-border/50 rounded-none">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-serif text-lg text-primary font-bold border-b border-border/30 pb-2">Pen Note entry</h4>
                    <form onSubmit={handleSaveNote} className="space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Title</label>
                        <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} required placeholder="Entry title" className="bg-background text-sm rounded-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Category</label>
                        <select 
                          value={noteCat} 
                          onChange={e => setNoteCat(e.target.value)} 
                          className="w-full h-8 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="general">GENERAL</option>
                          <option value="location">PLACE / LOCATION</option>
                          <option value="npc">PERSON / NPC</option>
                          <option value="item">THING / ITEM</option>
                          <option value="lore">FACT / LORE</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Content</label>
                        <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write thoughts..." className="bg-background min-h-[120px] text-sm font-serif rounded-none" />
                      </div>
                      <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-serif rounded-none cursor-pointer">Save Entry</Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Note listing/search column */}
              <div className="lg:col-span-2 space-y-4 flex flex-col min-h-[500px]">
                {/* Search and filter controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Search notes by keyword..."
                    value={noteSearchQuery}
                    onChange={e => setNoteSearchQuery(e.target.value)}
                    className="bg-background/50 border-border/50 text-xs rounded-none h-8 flex-1"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {["all", "general", "npc", "location", "item", "lore"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border transition-all rounded-none cursor-pointer ${
                          noteCategoryFilter === cat 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        {cat === "all" ? "All" : cat === "npc" ? "People" : cat === "location" ? "Places" : cat === "item" ? "Things" : cat === "lore" ? "Facts" : "Gen"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[460px]">
                  {filteredNotes && filteredNotes.length > 0 ? (
                    filteredNotes.map(note => (
                      <Card key={note.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all relative group rounded-none">
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer" onClick={() => deleteNote.mutate({ id: note.id, charId: id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-serif text-lg font-bold text-primary">{note.title}</h4>
                              <Badge variant="outline" className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1 border-border/50 rounded-none bg-background/50">
                                {note.category === "npc" ? "👤 Person / NPC" : note.category === "location" ? "📍 Place / Location" : note.category === "item" ? "📦 Thing / Item" : note.category === "lore" ? "📜 Fact / Lore" : "📝 General"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed whitespace-pre-wrap">{note.content}</p>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic font-serif text-center py-10">No campaign notes match this filter.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 7: COMPANION FAMILIAR */}
        {activeTab === "familiar" && (
          <div className="space-y-4">
            
            {/* If no familiar exists, render binder creation form */}
            {!character.familiar ? (
              <Card className="bg-card border-border/50 rounded-none max-w-3xl mx-auto">
                <CardContent className="p-6 space-y-6">
                  <div className="border-b border-border/30 pb-3">
                    <h3 className="font-serif text-2xl text-primary font-bold">Summon & Bind Familiar</h3>
                    <p className="text-xs text-muted-foreground mt-1">Bound companions share your adventure and can execute actions and attacks directly from your Hotbar.</p>
                  </div>

                  <form onSubmit={handleBindFamiliar} className="space-y-4 text-xs">
                    
                    {/* Basic specs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Companion Name</label>
                        <Input value={famName} onChange={e => setFamName(e.target.value)} required placeholder="e.g. Rocky, Hedwig" className="bg-background rounded-none h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Companion Type</label>
                        <Input value={famClassName} onChange={e => setFamClassName(e.target.value)} placeholder="e.g. Earth Elemental, Hawk" className="bg-background rounded-none h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Species / Race</label>
                        <Input value={famRace} onChange={e => setFamRace(e.target.value)} placeholder="e.g. Golem, Aviary" className="bg-background rounded-none h-8 text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Starting Level</label>
                        <Input type="number" min={1} value={famLevel} onChange={e => setFamLevel(Number(e.target.value))} required className="bg-background rounded-none h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                        <Input type="number" min={5} step={5} value={famSpeed} onChange={e => setFamSpeed(Number(e.target.value))} required className="bg-background rounded-none h-8 text-sm font-mono" />
                      </div>
                    </div>

                    {/* Derived Formulas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/20 pt-4">
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">HP Math Formula</label>
                        <Input value={famHpFormula} onChange={e => setFamHpFormula(e.target.value)} placeholder="e.g. Vitality * 8" className="bg-background rounded-none h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">Mana Math Formula</label>
                        <Input value={famManaFormula} onChange={e => setFamManaFormula(e.target.value)} placeholder="e.g. Spirit * 5" className="bg-background rounded-none h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">DT Math Formula</label>
                        <Input value={famDtFormula} onChange={e => setFamDtFormula(e.target.value)} placeholder="e.g. Endurance * 1" className="bg-background rounded-none h-8 text-sm font-mono" />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Attributes</h4>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "POW", val: famPower, set: setFamPower },
                          { label: "VIT", val: famVitality, set: setFamVitality },
                          { label: "SPI", val: famSpirit, set: setFamSpirit },
                          { label: "AGI", val: famAgility, set: setFamAgility },
                          { label: "END", val: famEndurance, set: setFamEndurance },
                          { label: "PRE", val: famPrecision, set: setFamPrecision },
                          { label: "WIL", val: famWillpower, set: setFamWillpower },
                          { label: "CHA", val: famCharisma, set: setFamCharisma },
                        ].map(stat => (
                          <div key={stat.label} className="bg-background/40 p-2 border border-border/30 text-center rounded-none">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{stat.label}</label>
                            <Input 
                              type="number" min={1} max={30} value={stat.val} 
                              onChange={e => stat.set(Math.min(30, Math.max(1, Number(e.target.value))))} 
                              className="text-center font-mono h-7 bg-background rounded-none text-xs" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/20">
                      <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none cursor-pointer">Summon & Bind</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              
              // Familiar display sheets
              <div className="space-y-6">
                
                {/* Companion info banner */}
                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/20 pb-4">
                  <div>
                    <h3 className="font-serif text-2xl text-primary font-bold">{character.familiar.name}</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                      Companion Level {character.familiar.level} · {character.familiar.race} · {character.familiar.className} · {character.familiar.speed} ft
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer" onClick={handleReleaseFamiliar}>
                    Release Companion
                  </Button>
                </div>

                {/* Familiar HUD stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Familiar HP */}
                  <div className="rounded-none border border-border/40 bg-card p-3 flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Heart className="w-4 h-4 text-destructive" /> Companion HP
                    </div>
                    <div className="text-center py-1">
                      <span className="text-4xl font-mono font-bold text-foreground">
                        {character.familiar.currentHp}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono"> /{famMax.maxHp}</span>
                    </div>
                    <ResourceBar current={character.familiar.currentHp} max={famMax.maxHp} color="hsl(var(--destructive))" />
                    
                    {/* inputs */}
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famHpAdd} placeholder="Heal val"
                          onChange={e => setFamHpAdd(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamHpAdd} disabled={!famHpAdd}>
                          Heal
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famHpRemove} placeholder="Dmg val"
                          onChange={e => setFamHpRemove(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamHpRemove} disabled={!famHpRemove}>
                          Dmg
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famHpBuff} placeholder="Buff val"
                          onChange={e => setFamHpBuff(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamHpBuff} disabled={!famHpBuff}>
                          Buff
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                        onClick={handleFamFullRestoreHp}>
                        Full Restore HP
                      </Button>
                    </div>
                  </div>

                  {/* Familiar DT */}
                  <div className={`rounded-none border p-3 flex flex-col justify-between gap-3 bg-card transition-colors duration-200 ${
                    famDtFlash === "hit" ? "border-destructive/70 bg-destructive/[0.03]"
                    : famDtFlash === "restore" ? "border-primary/70 bg-primary/[0.03]"
                    : "border-border/40"
                  }`}>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Shield className="w-4 h-4 text-primary" /> Companion DT
                    </div>
                    <div className="text-center py-1">
                      <span className={`text-4xl font-mono font-bold ${famDtFlash === "hit" ? "text-destructive" : "text-foreground"}`}>
                        {character.familiar.currentDt}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono"> /{famMax.maxDt}</span>
                    </div>
                    <ResourceBar current={character.familiar.currentDt} max={famMax.maxDt} color="hsl(var(--primary))" />
                    
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famDtAdd} placeholder="Add val"
                          onChange={e => setFamDtAdd(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamDtAdd} disabled={!famDtAdd}>
                          Add
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famDtRemove} placeholder="Hit val"
                          onChange={e => { setFamDtRemove(e.target.value); setFamDamageResult(null); }}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamDtRemove} disabled={!famDtRemove}>
                          Hit
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famDtBuff} placeholder="Buff val"
                          onChange={e => setFamDtBuff(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamDtBuff} disabled={!famDtBuff}>
                          Buff
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                        onClick={handleFamRestoreDt}>
                        Full Restore DT
                      </Button>
                      {famDamageResult && (
                        <p className={`text-[10px] font-mono text-center mt-1 ${famDamageResult.absorbed ? "text-primary" : "text-destructive"}`}>
                          {famDamageResult.absorbed ? "✦ Absorbed" : famDamageResult.hpLost > 0 ? `−${famDamageResult.hpLost} HP` : "DT hit"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Familiar Mana */}
                  <div className="rounded-none border border-border/40 bg-card p-3 flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-blue-400" /> Companion Mana
                    </div>
                    <div className="text-center py-1">
                      <span className="text-4xl font-mono font-bold text-foreground">
                        {character.familiar.currentMana}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono"> /{famMax.maxMana}</span>
                    </div>
                    <ResourceBar current={character.familiar.currentMana} max={famMax.maxMana} color="#3b82f6" />
                    
                    <div className="space-y-2 mt-1">
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famManaAdd} placeholder="Add val"
                          onChange={e => setFamManaAdd(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamManaAdd} disabled={!famManaAdd}>
                          Add
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famManaRemove} placeholder="Use val"
                          onChange={e => setFamManaRemove(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamManaRemove} disabled={!famManaRemove}>
                          Use
                        </Button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input
                          type="number" min="0" value={famManaBuff} placeholder="Buff val"
                          onChange={e => setFamManaBuff(e.target.value)}
                          className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-none"
                        />
                        <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-none cursor-pointer font-bold"
                          onClick={handleFamManaBuff} disabled={!famManaBuff}>
                          Buff
                        </Button>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-none cursor-pointer"
                        onClick={handleFamFullRestoreMana}>
                        Full Restore Mana
                      </Button>
                    </div>
                  </div>

                </div>

                {/* Familiar base stats grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20 pb-1">Companion Attributes (Click to Roll)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-8 gap-3">
                    {STATS.map(stat => {
                      const val = (character.familiar as any)[stat.key] as number;
                      const mod = Math.floor(val / 3);
                      return (
                        <button
                          key={stat.key}
                          onClick={() => handleFamiliarStatRoll(stat.key, stat.label, val)}
                          className="rounded-none border border-border/40 bg-card/50 p-2 text-center hover:border-primary transition-all cursor-pointer"
                        >
                          <div className="text-[9px] font-bold text-muted-foreground uppercase">{stat.label}</div>
                          <div className="text-2xl font-serif text-foreground font-bold mt-0.5">{val}</div>
                          <div className="text-[10px] font-mono text-primary">+{mod}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Familiar attacks & abilities */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border/20 pb-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Companion Attacks & Spells</h4>
                    <Button size="sm" className="bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 h-7 text-xs rounded-none cursor-pointer" onClick={() => setIsAddingFamAbility(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Action
                    </Button>
                  </div>

                  {/* Add action creator form */}
                  {isAddingFamAbility && (
                    <Card className="bg-card border-primary/20 max-w-xl animate-in slide-in-from-top-4 duration-300 rounded-none">
                      <CardContent className="p-4 space-y-4">
                        <h4 className="font-serif text-lg text-primary font-bold">New Companion Ability</h4>
                        <form onSubmit={handleCreateFamAbility} className="space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                              <Input value={famAbilityName} onChange={e => setFamAbilityName(e.target.value)} required placeholder="e.g. Claw Swipe, Fire Spit" className="bg-background text-sm rounded-none h-8" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost (MP)</label>
                              <Input type="number" min={0} value={famAbilityCost} onChange={e => setFamAbilityCost(Number(e.target.value))} required className="bg-background text-sm rounded-none h-8 font-mono" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                            <Textarea value={famAbilityDesc} onChange={e => setFamAbilityDesc(e.target.value)} placeholder="Ability effect descriptions..." className="bg-background text-sm font-serif rounded-none min-h-[60px]" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-primary uppercase block mb-1">Roll Formula (optional)</label>
                            <Input value={famAbilityFormula} onChange={e => setFamAbilityFormula(e.target.value)} placeholder="e.g. d6 + 2, d8 + power" className="bg-background text-sm rounded-none h-8 font-mono" />
                          </div>
                          <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingFamAbility(false)} className="rounded-none">Cancel</Button>
                            <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-serif rounded-none">Save Action</Button>
                          </div>
                        </form>
                      </CardContent>
                    </Card>
                  )}

                  {character.familiar.abilities && character.familiar.abilities.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {character.familiar.abilities.map(ab => (
                        <Card key={ab.id} className="bg-card border-border/50 rounded-none relative group">
                          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer" onClick={() => handleDeleteFamAbility(ab.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start pr-8">
                              <div>
                                <h5 className="font-serif text-lg font-bold text-primary">{ab.name}</h5>
                                <div className="flex gap-1.5 mt-1">
                                  <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{ab.cost} MP</Badge>
                                  {ab.rollFormula && <Badge variant="outline" className="text-[9px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">Formula: {ab.rollFormula}</Badge>}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleFamiliarAbilityRoll(ab)}
                                className="bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 h-7 font-serif text-xs rounded-none cursor-pointer"
                              >
                                Execute
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed mt-2 whitespace-pre-wrap">{ab.description}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No unique companion actions registered yet.</p>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </div>

    </div>
  );
}
