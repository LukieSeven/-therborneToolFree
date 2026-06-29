import React, { useState, useEffect, useRef } from "react";
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
  Coins, Package, Hammer, Layers, Flame, BookText, UserCheck, X,
  Palette, Clock
} from "lucide-react";
import { format } from "date-fns";

// Storage Hooks & Helpers
import {
  useGetCharacter, useUpdateCharacter, useDeleteCharacter, useApplyDamage,
  useCreateRoll, useListCharacterRolls,
  useListEquipment, useUpdateEquipment, useDeleteEquipment,
  useListCurrencies, useUpdateCurrency, useDeleteCurrency,
  useListInventory, useUpdateInventoryItem, useDeleteInventoryItem,
  useListEssences, useAddEssence, useDeleteEssence,
  useListAbilities, useUpdateAbility, useDeleteAbility,
  useListSkills, useUpdateSkill,
  useListNotes, useCreateNote, useUpdateNote, useDeleteNote,
  getGetCharacterQueryKey, getListCharacterRollsQueryKey, getListNotesQueryKey
} from "@/hooks/useStorage";
import { 
  getAdjustedStats, getDiceLabel, exportCharacterJSON, importCharacterJSON, 
  Ability, Equipment, Skill, FavoriteSlot, Familiar, FamiliarAbility, evaluateFormula 
} from "@/lib/storage";

import { RollGuideDialog } from "@/components/dialogs/roll-guide-dialog";
import { EditFamiliarDialog } from "@/components/dialogs/edit-familiar-dialog";

// Dialog Modals
import { EditCharacterDialog } from "@/components/dialogs/edit-character-dialog";
import { EditAbilitiesDialog } from "@/components/dialogs/edit-abilities-dialog";
import { EditSkillsDialog } from "@/components/dialogs/edit-skills-dialog";
import { EditInventoryDialog } from "@/components/dialogs/edit-inventory-dialog";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { EditItemAbilityDialog } from "@/components/dialogs/edit-item-ability-dialog";

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
  if (char && char.favorites && Array.isArray(char.favorites)) {
    if (char.favorites.length === 20) {
      return char.favorites;
    }
    if (char.favorites.length === 10) {
      return [...char.favorites, ...Array(10).fill(null)];
    }
  }
  const slots: (FavoriteSlot | null)[] = Array(20).fill(null);
  let idx = 0;
  eq.filter(e => e.equipped && e.assignedToQuickRolls).forEach(e => {
    if (idx < 20) slots[idx++] = { type: "weapon", targetId: e.id, label: e.name };
  });
  ab.filter(a => a.assignedToQuickRolls).forEach(a => {
    if (idx < 20) slots[idx++] = { type: "ability", targetId: a.id, label: a.name };
  });
  return slots;
};

// Crit Chain Die Resolution Helper
const getChainDie = (formula: string): string => {
  const parts = formula.split(/[+\-*/()]/).map(p => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const dieMatch = part.match(/d\d+/i);
    if (dieMatch) {
      return dieMatch[0].toLowerCase();
    }
    if (/^[a-z]+$/i.test(part)) {
      return part;
    }
  }
  return "d8";
};

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  statuses: string[];
}

function compressImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height *= maxW / width;
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width *= maxH / height;
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

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
  const deleteAbility = useDeleteAbility();
  const updateChar = useUpdateCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();
  
  // Equipment mutators for toggling equipped/quick status
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  // Inventory mutators
  const updateInvItem = useUpdateInventoryItem();
  const deleteInvItem = useDeleteInventoryItem();

  // Notes mutators
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();

  // Essences mutators
  const addEssence = useAddEssence();
  const deleteEssence = useDeleteEssence();

  // Skills mutator
  const updateSkillMut = useUpdateSkill();

  // Abilities mutator
  const updateAbilityMut = useUpdateAbility();

  // ── Tab State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"stats" | "skills" | "inventory" | "essences" | "abilities" | "notes" | "familiar" | "combat">("stats");

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

  // ── Combat Tracker State ──────────────────────────────────
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [recentCombatants, setRecentCombatants] = useState<Omit<Combatant, "id">[]>([]);

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

  // ── Combat Tracker LocalStorage Persistence ───────────────
  useEffect(() => {
    if (id) {
      try {
        const savedCombatants = localStorage.getItem(`aetherborne_combatants_${id}`);
        if (savedCombatants) setCombatants(JSON.parse(savedCombatants));
        const savedTurnIdx = localStorage.getItem(`aetherborne_combatants_turn_${id}`);
        if (savedTurnIdx) setCurrentTurnIdx(Number(savedTurnIdx));
        const savedRecents = localStorage.getItem(`aetherborne_combatants_recents_${id}`);
        if (savedRecents) setRecentCombatants(JSON.parse(savedRecents));
      } catch (e) {
        console.error("Failed to load combat tracker state", e);
      }
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      localStorage.setItem(`aetherborne_combatants_${id}`, JSON.stringify(combatants));
      localStorage.setItem(`aetherborne_combatants_turn_${id}`, String(currentTurnIdx));
      localStorage.setItem(`aetherborne_combatants_recents_${id}`, JSON.stringify(recentCombatants));
    }
  }, [id, combatants, currentTurnIdx, recentCombatants]);

  // ── Familiar Release States ──────────────────────────────
  const [releasingFamId, setReleasingFamId] = useState<number | string | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [isReleaseDoubleConfirmOpen, setIsReleaseDoubleConfirmOpen] = useState(false);

  // ── Long Rest State & Action ───────────────────────────────
  const [isLongRestConfirmOpen, setIsLongRestConfirmOpen] = useState(false);

  const handleLongRest = () => {
    const targetHp = maxHp + abilityHpBonus;
    const targetDt = maxDt + abilityDtBonus;
    const targetMana = maxMana + abilityManaBonus;

    updateChar.mutate({
      id,
      data: {
        currentHp: targetHp,
        currentDt: targetDt,
        currentMana: targetMana
      }
    }, {
      onSuccess: () => {
        const curHp = hp ?? character.currentHp;
        const curDt = currentDt ?? character.currentDt;
        const curMana = mana ?? character.currentMana;

        setHp(targetHp);
        setCurrentDt(targetDt);
        setMana(targetMana);

        createRoll.mutate({ id, data: { diceType: "hp-log", modifier: targetHp - curHp, label: "Long Rest (HP)" } });
        createRoll.mutate({ id, data: { diceType: "dt-log", modifier: targetDt - curDt, label: "Long Rest (DT)" } });
        createRoll.mutate({ id, data: { diceType: "mana-log", modifier: targetMana - curMana, label: "Long Rest (Mana)" } });
        
        toast.success("Long Rest completed. Vitals restored.");
        setIsLongRestConfirmOpen(false);
      }
    });
  };

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
  const [famClassName, setFamClassName] = useState("Iron"); // Used for Rank select dropdown!
  const [famRace, setFamRace] = useState("");
  const [famSpeed, setFamSpeed] = useState(25);
  const [famPower, setFamPower] = useState(10);
  const [famVitality, setFamVitality] = useState(10);
  const [famSpirit, setFamSpirit] = useState(10);
  const [famAgility, setFamAgility] = useState(10);
  const [famEndurance, setFamEndurance] = useState(10);
  const [famPrecision, setFamPrecision] = useState(10);
  const [famWillpower, setFamWillpower] = useState(10);
  const [famCharisma, setFamCharisma] = useState(10);
  const [famHpFormula, setFamHpFormula] = useState("Vitality * 8");
  const [famManaFormula, setFamManaFormula] = useState("Spirit * 5");
  const [famDtFormula, setFamDtFormula] = useState("Endurance * 1");
  const [famResistances, setFamResistances] = useState("");
  const [famImmunities, setFamImmunities] = useState("");
  const [isAddingFamiliar, setIsAddingFamiliar] = useState(false);

  // ── Multiple Familiars HUD & Expansion State ───────────────
  const [expandedFamiliars, setExpandedFamiliars] = useState<Record<string | number, boolean>>({});
  const [expandedAbilities, setExpandedAbilities] = useState<Record<number, boolean>>({});
  const [famDtFlashes, setFamDtFlashes] = useState<Record<string | number, "hit" | "restore" | null>>({});
  const [famDamageResults, setFamDamageResults] = useState<Record<string | number, { hpLost: number; absorbed: boolean } | null>>({});
  const [famInputs, setFamInputs] = useState<Record<string | number, {
    hpAdd?: string;
    hpRemove?: string;
    hpBuff?: string;
    dtAdd?: string;
    dtRemove?: string;
    dtBuff?: string;
    manaAdd?: string;
    manaRemove?: string;
    manaBuff?: string;
  }>>({});

  const updateFamInput = (famId: string | number, field: string, value: string) => {
    setFamInputs(prev => ({
      ...prev,
      [famId]: {
        ...(prev[famId] || {}),
        [field]: value
      }
    }));
  };

  // ── Familiar Ability Creator ───────────────────────────────
  const [isAddingFamAbility, setIsAddingFamAbility] = useState<Record<string | number, boolean>>({});
  const [famAbilityName, setFamAbilityName] = useState("");
  const [famAbilityDesc, setFamAbilityDesc] = useState("");
  const [famAbilityCost, setFamAbilityCost] = useState(0);
  const [famAbilityFormula, setFamAbilityFormula] = useState("");
  const [editingFamAbilityId, setEditingFamAbilityId] = useState<{ famId: string | number; abilityId: number } | null>(null);
  const [famAbilityType, setFamAbilityType] = useState("");
  const [famAbilityCooldown, setFamAbilityCooldown] = useState(0);
  const [famAbilityRange, setFamAbilityRange] = useState("Melee");
  const [famAbilitySpeed, setFamAbilitySpeed] = useState("Standard");
  const [famAbilityLinkedStats, setFamAbilityLinkedStats] = useState<string[]>([]);
  const [famAbilityAssignedToQuickRolls, setFamAbilityAssignedToQuickRolls] = useState(false);
  const [famAbilityResistances, setFamAbilityResistances] = useState("");
  const [famAbilityImmunities, setFamAbilityImmunities] = useState("");

  const [famAbilityBonusPower, setFamAbilityBonusPower] = useState(0);
  const [famAbilityBonusVitality, setFamAbilityBonusVitality] = useState(0);
  const [famAbilityBonusSpirit, setFamAbilityBonusSpirit] = useState(0);
  const [famAbilityBonusAgility, setFamAbilityBonusAgility] = useState(0);
  const [famAbilityBonusEndurance, setFamAbilityBonusEndurance] = useState(0);
  const [famAbilityBonusPrecision, setFamAbilityBonusPrecision] = useState(0);
  const [famAbilityBonusWillpower, setFamAbilityBonusWillpower] = useState(0);
  const [famAbilityBonusCharisma, setFamAbilityBonusCharisma] = useState(0);

  const [famAbilityBonusHp, setFamAbilityBonusHp] = useState("");
  const [famAbilityBonusMana, setFamAbilityBonusMana] = useState("");
  const [famAbilityBonusDt, setFamAbilityBonusDt] = useState("");

  // ── Notes Import Ref ──
  const notesFileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Drag and Drop States ──
  const [draggedAbilityId, setDraggedAbilityId] = useState<number | null>(null);
  const [draggedFamAbIdx, setDraggedFamAbIdx] = useState<number | null>(null);

  // ── Notes Filter & Search ──────────────────────────────────
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteCategoryFilter, setNoteCategoryFilter] = useState("all");

  // ── Favorites Hotbar State ─────────────────────────────────
  const [assigningSlotIndex, setAssigningSlotIndex] = useState<number | null>(null);

  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [famDtFlash, setFamDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);
  const [famDamageResult, setFamDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);

  // ── New Features State ──
  const [recentRollActions, setRecentRollActions] = useState<{ diceType: string; label: string; modifier: number }[]>([]);
  const [discardItem, setDiscardItem] = useState<any | null>(null);
  const [discardCount, setDiscardCount] = useState<number>(1);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [noteImages, setNoteImages] = useState<string[]>([]);

  // ── Inventory Dialog Trigger State ────────────────────────
  const [isInvOpen, setIsInvOpen] = useState(false);
  const [invMode, setInvMode] = useState<"add" | "edit">("add");
  const [invType, setInvType] = useState<"currency" | "equipment" | "item">("item");
  const [invInitialData, setInvInitialData] = useState<any>(null);

  // ── Item Ability Dialog State ──
  const [isItemAbOpen, setIsItemAbOpen] = useState(false);
  const [itemAbEquipmentId, setItemAbEquipmentId] = useState<number | null>(null);
  const [itemAbInitialData, setItemAbInitialData] = useState<any>(null);

  // ── Essence input State ───────────────────────────────────
  const [essenceSlotInput, setEssenceSlotInput] = useState<number | null>(null);
  const [essenceName, setEssenceName] = useState("");
  const [essenceDesc, setEssenceDesc] = useState("");

  // ── Campaign Notes input State ────────────────────────────
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCat, setNoteCat] = useState<string>("general");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── Roll state ────────────────────────────────────────────
  const [rollTab, setRollTab] = useState<"stats" | "dice" | "history">("stats");
  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [customFormula, setCustomFormula] = useState("");
  
  const [critChain, setCritChain] = useState<{
    chainCount: number;
    chainDie: string;
    runningDiceTotal: number;
    modifier: number;
    label: string;
    lastRolledValue: number;
    rolls: { label: string; breakdown: string; total: number }[];
  } | null>(null);

  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    hadCrit: boolean;
    maxChainCount: number;
    diceType: string;
    label: string;
    rolls?: { label: string; breakdown: string; total: number }[];
  } | null>(null);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!character) return <div className="p-8 text-center text-muted-foreground">Character not found</div>;

  // ── Recalculate adjusted stats from equipment ─────────────
  const { 
    stats: finalStats, 
    modifiers: autoModifiers, 
    diceLabels, 
    maxHp, 
    maxMana, 
    maxDt, 
    abilityHpBonus, 
    abilityManaBonus, 
    abilityDtBonus 
  } = getAdjustedStats(character, equipment, abilities);

  // Compute base maximums (without active ability bonuses) to identify temporary boosts
  const baseMaxes = getAdjustedStats(character, equipment, []);
  const baseMaxHp = baseMaxes.maxHp;
  const baseMaxMana = baseMaxes.maxMana;
  const baseMaxDt = baseMaxes.maxDt;

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

  const getSlotDetails = (slot: FavoriteSlot) => {
    let name = slot.label;
    let costStr = "";
    let statStr = "";

    if (slot.type === "attribute") {
      name = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      statStr = `${finalStats[slot.targetId as string] || 0} (${autoModifiers[slot.targetId as string] >= 0 ? "+" : ""}${autoModifiers[slot.targetId as string]})`;
    } else if (slot.type === "weapon") {
      const item = equipment.find(e => e.id === Number(slot.targetId));
      if (item) {
        name = item.name;
        costStr = item.modifier !== undefined ? (typeof item.modifier === "number" ? `${item.modifier >= 0 ? "+" : ""}${item.modifier} Mod` : `${item.modifier} Mod`) : "";
        statStr = item.diceType || "d8";
      }
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) {
        const eq = ability.equipmentId ? equipment.find(e => e.id === ability.equipmentId) : null;
        name = eq ? `${eq.name}: ${ability.name}` : ability.name;
        costStr = `${ability.cost} MP`;
        statStr = ability.linkedStat ? String(ability.linkedStat).toUpperCase().substring(0, 3) : "SPI";
      }
    } else if (slot.type === "skill") {
      const skill = skills.find(s => s.id === Number(slot.targetId));
      if (skill) {
        name = skill.name;
        costStr = `Val: ${skill.value}`;
        statStr = `+${Math.floor((Number(skill.value) || 0) / 3) + (Number(skill.training) || 0)}`;
      }
    } else if (slot.type === "familiar-attribute") {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const val = (fam as any)[slot.targetId] as number;
        name = `${fam.name}: ${String(slot.targetId).toUpperCase().substring(0, 3)}`;
        statStr = `${val} (+${Math.floor(val/3)})`;
      }
    } else if (slot.type === "familiar-ability") {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const ab = fam.abilities.find(a => a.id === Number(slot.targetId));
        if (ab) {
          name = `${fam.name}: ${ab.name}`;
          costStr = `${ab.cost} MP`;
          statStr = ab.rollFormula ? "Formula" : "";
        }
      }
    }

    return { name, costStr, statStr };
  };

  // famMax is calculated dynamically per-familiar

  // ── HP Adjustments ────────────────────────────────────────
  const handleHpAdd = () => {
    const amount = parseInt(hpAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const limit = maxHp + abilityHpBonus;
    const next = Math.min(limit, cur + amount);
    setHp(next);
    setHpAdd("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - cur, label: "Healed HP" } });
  };

  const handleHpRemove = () => {
    const amount = parseInt(hpRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = Math.max(0, cur - amount);
    setHp(next);
    setHpRemove("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - cur, label: "Direct DMG (HP)" } });
  };

  const handleHpBuff = () => {
    const amount = parseInt(hpBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = cur + amount;
    setHp(next);
    setHpBuff("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: amount, label: "Buffed HP" } });
  };

  const handleFullRestoreHp = () => {
    const cur = hp ?? character.currentHp;
    const limit = maxHp + abilityHpBonus;
    setHp(limit);
    updateChar.mutate({ id, data: { currentHp: limit } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: limit - cur, label: "Full Restore HP" } });
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
    const limit = maxDt + abilityDtBonus;
    const next = Math.min(limit, cur + amount);
    setCurrentDt(next);
    setDtAdd("");
    updateChar.mutate({ id, data: { currentDt: next } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: next - cur, label: "Added DT" } });
  };

  const handleDtBuff = () => {
    const amount = parseInt(dtBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = currentDt ?? character.currentDt;
    const next = cur + amount;
    setCurrentDt(next);
    setDtBuff("");
    updateChar.mutate({ id, data: { currentDt: next } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: amount, label: "Buffed DT" } });
  };

  const handleRestoreDt = () => {
    const cur = currentDt ?? character.currentDt;
    const limit = maxDt + abilityDtBonus;
    setCurrentDt(limit);
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: limit } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: limit - cur, label: "Restore DT" } });
  };

  // ── Mana Adjustments ──────────────────────────────────────
  const handleManaAdd = () => {
    const amount = parseInt(manaAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const limit = maxMana + abilityManaBonus;
    const next = Math.min(limit, cur + amount);
    setMana(next);
    setManaAdd("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - cur, label: "Restored Mana" } });
  };

  const handleManaRemove = () => {
    const amount = parseInt(manaRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = Math.max(0, cur - amount);
    setMana(next);
    setManaRemove("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - cur, label: "Spent Mana" } });
  };

  const handleManaBuff = () => {
    const amount = parseInt(manaBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = cur + amount;
    setMana(next);
    setManaBuff("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: amount, label: "Buffed Mana" } });
  };

  const handleFullRestoreMana = () => {
    const cur = mana ?? character.currentMana;
    const limit = maxMana + abilityManaBonus;
    setMana(limit);
    updateChar.mutate({ id, data: { currentMana: limit } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: limit - cur, label: "Full Restore Mana" } });
  };

  // ── Multiple Familiars Adjustments Mutator Helper ───────────
  const updateFamiliarData = (famId: string | number, updatedFam: Familiar | null) => {
    const list = character.familiars ? [...character.familiars] : [];
    if (updatedFam === null) {
      // Release familiar
      const filtered = list.filter(f => f.id !== famId);
      updateChar.mutate({ id, data: { familiars: filtered } });
      toast.success("Familiar released.");
    } else {
      // Save familiar modifications
      const idx = list.findIndex(f => f.id === famId);
      if (idx !== -1) {
        list[idx] = updatedFam;
        updateChar.mutate({ id, data: { familiars: list } });
      }
    }
  };

  // ── Familiar HP Adjustments ───────────────────────────────
  const handleFamHpAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxHp, fam.currentHp + amount);
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpAdd", "");
  };

  const handleFamHpRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, fam.currentHp - amount);
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpRemove", "");
  };

  const handleFamHpBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentHp + amount;
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpBuff", "");
  };

  const handleFamFullRestoreHp = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    updateFamiliarData(fam.id, { ...fam, currentHp: fMax.maxHp });
  };

  // ── Familiar DT Adjustments ───────────────────────────────
  const handleFamDtAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxDt, fam.currentDt + amount);
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    updateFamInput(fam.id, "dtAdd", "");
  };

  const handleFamDtRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;

    let dtVal = fam.currentDt;
    let hpVal = fam.currentHp;
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

    setFamDamageResults(prev => ({
      ...prev,
      [fam.id]: { hpLost, absorbed }
    }));
    
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "hit"
    }));

    updateFamiliarData(fam.id, { ...fam, currentHp: hpVal, currentDt: dtVal });
    updateFamInput(fam.id, "dtRemove", "");
    
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  const handleFamDtBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentDt + amount;
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    updateFamInput(fam.id, "dtBuff", "");
  };

  const handleFamRestoreDt = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "restore"
    }));
    setFamDamageResults(prev => {
      const copy = { ...prev };
      delete copy[fam.id];
      return copy;
    });
    updateFamiliarData(fam.id, { ...fam, currentDt: fMax.maxDt });
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  // ── Familiar Mana Adjustments ─────────────────────────────
  const handleFamManaAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxMana, fam.currentMana + amount);
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaAdd", "");
  };

  const handleFamManaRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, fam.currentMana - amount);
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaRemove", "");
  };

  const handleFamManaBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentMana + amount;
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaBuff", "");
  };

  const handleFamFullRestoreMana = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    updateFamiliarData(fam.id, { ...fam, currentMana: fMax.maxMana });
  };

  // ── Delete character (Styled Trigger) ─────────────────────
  const handleDelete = () => {
    setIsDeleteOpen(true);
  };

  // ── Dice rolling handlers ─────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const varsForMod = {
      power: finalStats.power, pow: finalStats.power,
      vitality: finalStats.vitality, vit: finalStats.vitality,
      spirit: finalStats.spirit, spi: finalStats.spirit,
      agility: finalStats.agility, agi: finalStats.agility,
      endurance: finalStats.endurance, end: finalStats.endurance,
      precision: finalStats.precision, pre: finalStats.precision,
      willpower: finalStats.willpower, wil: finalStats.willpower,
      charisma: finalStats.charisma, cha: finalStats.charisma,
      powr: autoModifiers.power,
      vitr: autoModifiers.vitality,
      spir: autoModifiers.spirit,
      agir: autoModifiers.agility,
      endr: autoModifiers.endurance,
      prer: autoModifiers.precision,
      wilr: autoModifiers.willpower,
      char: autoModifiers.charisma,
    };
    const modifier = autoModifier !== undefined 
      ? autoModifier 
      : (/[a-zA-Z]/.test(rollMod) ? evaluateFormula(rollMod, varsForMod) : (parseInt(rollMod, 10) || 0));
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
            const chainDie = getChainDie(diceType);
            const lbl = label || rollLabel || diceType;
            
            setRecentRollActions(prev => {
              const next = { diceType, label: lbl, modifier };
              const filtered = prev.filter(a => !(a.label === next.label && a.diceType === next.diceType && a.modifier === next.modifier));
              return [next, ...filtered].slice(0, 10);
            });

            const isCustomFormula = !statValue && (/[a-zA-Z]/.test(diceType) || /[+\-*/]/.test(diceType));

            if (isCustomFormula) {
              setLastRoll({
                rawRoll: rolled,
                modifier: 0,
                total: rolled,
                hadCrit: wasCrit,
                maxChainCount: -1,
                diceType: data.diceType,
                label: lbl
              });
            } else {
              if (wasCrit) {
                const breakdownStr = `${rolled}!`;
                setCritChain({
                  chainCount: 0,
                  chainDie,
                  runningDiceTotal: rolled,
                  modifier,
                  label: lbl,
                  lastRolledValue: rolled,
                  rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }]
                });
              } else {
                setLastRoll({
                  rawRoll: rolled,
                  modifier,
                  total: rolled + modifier,
                  hadCrit: false,
                  maxChainCount: -1,
                  diceType: data.diceType,
                  label: lbl,
                  rolls: [{ label: "Roll 1", breakdown: String(rolled), total: rolled }]
                });
              }
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleCustomFormulaRoll = () => {
    if (!customFormula.trim()) return;
    handleRoll(customFormula.trim(), rollLabel || "Custom Roll");
  };


  const handleChainRoll = () => {
    if (!critChain) return;
    const { chainDie, runningDiceTotal, modifier, label, chainCount, rolls: prevRolls } = critChain;
    setRollingDice("chain");
    
    createRoll.mutate(
      { id, data: { diceType: chainDie, modifier: 0, label } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const newTotal = runningDiceTotal + rolled;
            
            const breakdownStr = rolled + (wasCrit ? "!" : "");
            const rollTotal = rolled;
            const newRolls = [...prevRolls, { label: `Roll ${chainCount + 2}`, breakdown: breakdownStr, total: rollTotal }];

            if (wasCrit) {
              setCritChain({ chainCount: chainCount + 1, chainDie, runningDiceTotal: newTotal, modifier, label, lastRolledValue: rolled, rolls: newRolls });
            } else {
              setLastRoll({ rawRoll: newTotal, modifier, total: newTotal + modifier, hadCrit: true, maxChainCount: chainCount, diceType: chainDie, label, rolls: newRolls });
              setCritChain(null);
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
    const val = Number(skill.value) || 0;
    const train = Number(skill.training) || 0;
    const modifier = Math.floor(val / 3) + train;
    handleRoll(getDiceLabel(val), `${skill.name} Skill Roll`, val, modifier);
  };

  const handleWeaponRoll = (item: Equipment) => {
    const dice = item.diceType || "d8";
    let formula = dice;
    let flatMod = 0;
    
    if (item.modifier !== undefined && String(item.modifier).trim() !== "") {
      const modStr = String(item.modifier).trim();
      const hasLetters = /[a-zA-Z]/.test(modStr);
      if (hasLetters) {
        formula = `${dice} + ${modStr}`;
      } else {
        flatMod = parseInt(modStr, 10) || 0;
      }
    } else {
      formula = `${dice} + powr`;
    }

    handleRoll(formula, `${item.name} Strike`, undefined, flatMod);
  };

  const handleAbilityRoll = (ability: Ability, chosenStat?: string) => {
    const curMana = mana ?? character.currentMana;
    if (curMana < ability.cost) {
      toast.error(`Not enough Mana! Requires ${ability.cost} MP (Have ${curMana} MP)`);
      return;
    }

    const nextMana = curMana - ability.cost;
    setMana(nextMana);
    updateChar.mutate({ id, data: { currentMana: nextMana } });

    if (ability.rollFormula) {
      let rollFormulaToUse = ability.rollFormula;
      let statMod = 0;

      if (chosenStat) {
        // Substitute shorthand "STAT" and "STATr" with the selected stat (e.g., "pow" / "powr")
        const prefix = chosenStat.substring(0, 3).toLowerCase();
        rollFormulaToUse = rollFormulaToUse
          .replace(/STATr/g, `${prefix}r`)
          .replace(/statr/g, `${prefix}r`)
          .replace(/STAT/g, prefix)
          .replace(/stat/g, prefix);

        statMod = autoModifiers[chosenStat] || 0;
      }

      // Sum all equipped equipment flat modifiers (e.g. +6 Mace)
      const vars: Record<string, number> = {
        power: finalStats.power,
        vitality: finalStats.vitality,
        spirit: finalStats.spirit,
        agility: finalStats.agility,
        endurance: finalStats.endurance,
        precision: finalStats.precision,
        willpower: finalStats.willpower,
        charisma: finalStats.charisma,
        pow: finalStats.power,
        vit: finalStats.vitality,
        spi: finalStats.spirit,
        agi: finalStats.agility,
        end: finalStats.endurance,
        pre: finalStats.precision,
        wil: finalStats.willpower,
        cha: finalStats.charisma,
        powr: autoModifiers.power,
        vitr: autoModifiers.vitality,
        spir: autoModifiers.spirit,
        agir: autoModifiers.agility,
        endr: autoModifiers.endurance,
        prer: autoModifiers.precision,
        wilr: autoModifiers.willpower,
        char: autoModifiers.charisma,
      };

      const eqMod = equipment
        .filter(e => e.equipped)
        .reduce((sum, item) => {
          let modVal = 0;
          if (item.modifier !== undefined && String(item.modifier).trim() !== "") {
            const modStr = String(item.modifier).trim();
            const hasLetters = /[a-zA-Z]/.test(modStr);
            if (hasLetters) {
              modVal = evaluateFormula(modStr, vars);
            } else {
              modVal = parseInt(modStr, 10) || 0;
            }
          }
          return sum + modVal;
        }, 0);

      const totalMod = statMod + eqMod;
      handleRoll(rollFormulaToUse, `${ability.name} Cast`, undefined, totalMod);
    } else {
      toast.success(`${ability.name} activated! (-${ability.cost} MP)`);
    }
  };

  const handleAbilityLevelChange = (abilityId: number, direction: "up" | "down") => {
    const targetAb = abilities.find(a => a.id === abilityId);
    if (!targetAb) return;
    const curLevel = targetAb.level || 1;
    const nextLevel = direction === "up" ? curLevel + 1 : Math.max(1, curLevel - 1);
    updateAbilityMut.mutate({
      id: abilityId,
      data: { level: nextLevel }
    });
  };

  const toggleAbilityActive = (ability: Ability) => {
    const nextActive = !ability.active;
    const oldStats = getAdjustedStats(character, equipment, abilities);
    const updatedAbilities = abilities.map(a => a.id === ability.id ? { ...a, active: nextActive } : a);
    const newStats = getAdjustedStats(character, equipment, updatedAbilities);

    const hpDiff = (newStats.maxHp + newStats.abilityHpBonus) - (oldStats.maxHp + oldStats.abilityHpBonus);
    const manaDiff = (newStats.maxMana + newStats.abilityManaBonus) - (oldStats.maxMana + oldStats.abilityManaBonus);
    const dtDiff = (newStats.maxDt + newStats.abilityDtBonus) - (oldStats.maxDt + oldStats.abilityDtBonus);

    const newHp = Math.max(0, (hp ?? character.currentHp) + hpDiff);
    const newMana = Math.max(0, (mana ?? character.currentMana) + manaDiff);
    const newDt = Math.max(0, (currentDt ?? character.currentDt) + dtDiff);

    updateAbilityMut.mutate({
      id: ability.id,
      data: { active: nextActive }
    }, {
      onSuccess: () => {
        updateChar.mutate({
          id,
          data: {
            currentHp: newHp,
            currentMana: newMana,
            currentDt: newDt
          }
        }, {
          onSuccess: () => {
            setHp(newHp);
            setMana(newMana);
            setCurrentDt(newDt);
            toast.success(`${ability.name} ${nextActive ? "activated" : "deactivated"}`);
          }
        });
      }
    });
  };

  // ── Familiar Rolls ────────────────────────────────────────
  const handleFamiliarStatRoll = (famId: string | number, statKey: string, statLabel: string, val: number) => {
    const numericVal = Number(val) || 0;
    const mod = Math.floor(numericVal / 3);
    const dice = getDiceLabel(numericVal);
    setRollingDice(`fam-${famId}-${statLabel}`);
    setLastRoll(null);
    setCritChain(null);

    createRoll.mutate(
      { 
        id, 
        data: { 
          diceType: dice, 
          modifier: mod, 
          label: `Fam: ${statLabel} Roll`, 
          familiarId: famId,
          statValue: numericVal
        } 
      },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie: dice, runningDiceTotal: rolled, modifier: mod, label: `Fam: ${statLabel} Roll`, lastRolledValue: rolled, rolls: [{ label: "Roll 1", breakdown: `${rolled}!`, total: rolled }] });
            } else {
              setLastRoll({ rawRoll: rolled, modifier: mod, total: rolled + mod, hadCrit: false, maxChainCount: -1, diceType: dice, label: `Fam: ${statLabel} Roll`, rolls: [{ label: "Roll 1", breakdown: String(rolled), total: rolled }] });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null)
      }
    );
  };

  const handleFamiliarAbilityRoll = (fam: Familiar, ability: FamiliarAbility) => {
    const curMana = fam.currentMana;
    if (curMana < ability.cost) {
      toast.error(`${fam.name} not enough Mana! Requires ${ability.cost} MP`);
      return;
    }
    const nextMana = curMana - ability.cost;
    updateFamiliarData(fam.id, { ...fam, currentMana: nextMana });

    if (ability.rollFormula) {
      setRollingDice(`fam-ability-${ability.id}`);
      setLastRoll(null);
      setCritChain(null);

      createRoll.mutate(
        { 
          id, 
          data: { 
            diceType: ability.rollFormula, 
            modifier: 0, 
            label: `Fam: ${ability.name} Cast`, 
            familiarId: fam.id 
          } 
        },
        {
          onSuccess: (data) => {
            setTimeout(() => {
              const rolled = data.result ?? 0;
              const wasCrit = (data as any).isCrit ?? false;
              const chainDie = ability.rollFormula.split("+").pop() ?? ability.rollFormula;
              if (wasCrit) {
                setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier: 0, label: `Fam: ${ability.name} Cast`, lastRolledValue: rolled, rolls: [{ label: "Roll 1", breakdown: `${rolled}!`, total: rolled }] });
              } else {
                setLastRoll({ rawRoll: rolled, modifier: 0, total: rolled, hadCrit: false, maxChainCount: -1, diceType: data.diceType, label: `Fam: ${ability.name} Cast`, rolls: [{ label: "Roll 1", breakdown: String(rolled), total: rolled }] });
              }
              setRollingDice(null);
            }, 600);
          },
          onError: () => setRollingDice(null)
        }
      );
    } else {
      toast.success(`${fam.name} used ${ability.name}!`);
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
    } else if (slot.type === "familiar-attribute" && slot.familiarId !== undefined) {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const statVal = (fam as any)[slot.targetId] as number;
        handleFamiliarStatRoll(fam.id, slot.targetId as string, String(slot.targetId).toUpperCase(), statVal);
      } else toast.error("Familiar not found");
    } else if (slot.type === "familiar-ability" && slot.familiarId !== undefined) {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const ability = fam.abilities.find(a => a.id === Number(slot.targetId));
        if (ability) handleFamiliarAbilityRoll(fam, ability);
        else toast.error("Familiar ability not found");
      } else toast.error("Familiar not found");
    }
  };

  const handleAssignFavorite = (slotIdx: number, type: FavoriteSlot["type"], targetId: string | number, label: string, familiarId?: string | number) => {
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = { type, targetId, label, familiarId };
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

  const triggerAddItemAbility = (eqId: number) => {
    setItemAbEquipmentId(eqId);
    setItemAbInitialData(null);
    setIsItemAbOpen(true);
  };

  const triggerEditItemAbility = (ability: Ability) => {
    setItemAbEquipmentId(ability.equipmentId || null);
    setItemAbInitialData(ability);
    setIsItemAbOpen(true);
  };

  const triggerDiscardItem = (item: any) => {
    setDiscardItem(item);
    setDiscardCount(1);
    setIsDiscardOpen(true);
  };

  const handleConfirmDiscard = () => {
    if (!discardItem) return;
    const amountToDiscard = discardCount;
    const item = discardItem;

    if (amountToDiscard >= item.quantity) {
      deleteInvItem.mutate({ id: item.id, charId: id }, {
        onSuccess: () => {
          setIsDiscardOpen(false);
          setDiscardItem(null);
          toast.success(`Discarded all ${item.name}.`);
        }
      });
    } else {
      const nextQuantity = item.quantity - amountToDiscard;
      updateInvItem.mutate({
        id: item.id,
        data: { quantity: nextQuantity }
      }, {
        onSuccess: () => {
          setIsDiscardOpen(false);
          setDiscardItem(null);
          toast.success(`Discarded ${amountToDiscard} ${item.name}.`);
        }
      });
    }
  };

  const handleDiscardAll = () => {
    if (!discardItem) return;
    deleteInvItem.mutate({ id: discardItem.id, charId: id }, {
      onSuccess: () => {
        setIsDiscardOpen(false);
        setDiscardItem(null);
        toast.success(`Discarded all ${discardItem.name}.`);
      }
    });
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
        images: noteImages,
      },
      {
        onSuccess: () => {
          setNoteTitle("");
          setNoteContent("");
          setNoteCat("general");
          setNoteImages([]);
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

  // ── Familiar Binder (Multiple Companions) ─────────────────
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
      id: Date.now(),
      name: famName,
      className: famClassName || "Companion",
      race: famRace || "Beast",
      level: 1,
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
      resistances: famResistances,
      immunities: famImmunities,
      abilities: []
    };

    const list = character.familiars ? [...character.familiars] : [];
    list.push(newFam);
    updateChar.mutate({ id, data: { familiars: list } }, {
      onSuccess: () => {
        setFamName("");
        setFamClassName("Iron");
        setFamRace("");
        setFamSpeed(25);
        setFamPower(10);
        setFamVitality(10);
        setFamSpirit(10);
        setFamAgility(10);
        setFamEndurance(10);
        setFamPrecision(10);
        setFamWillpower(10);
        setFamCharisma(10);
        setFamHpFormula("Vitality * 8");
        setFamManaFormula("Spirit * 5");
        setFamDtFormula("Endurance * 1");
        setFamResistances("");
        setFamImmunities("");
        setIsAddingFamiliar(false);
        toast.success(`Familiar ${newFam.name} bound successfully!`);
      }
    });
  };

  const handleReleaseFamiliarClick = (famId: string | number) => {
    setReleasingFamId(famId);
    setIsReleaseConfirmOpen(true);
  };

  const handleConfirmFirstRelease = () => {
    setIsReleaseConfirmOpen(false);
    setIsReleaseDoubleConfirmOpen(true);
  };

  const handleConfirmSecondRelease = () => {
    if (releasingFamId !== null) {
      updateFamiliarData(releasingFamId, null);
    }
    setIsReleaseDoubleConfirmOpen(false);
    setReleasingFamId(null);
  };

  const handleCreateFamAbility = (famId: string | number, e: React.FormEvent) => {
    e.preventDefault();
    const list = character.familiars ? [...character.familiars] : [];
    const fam = list.find(f => f.id === famId);
    if (!fam || !famAbilityName.trim()) return;

    const newAb: FamiliarAbility = {
      id: Date.now(),
      name: famAbilityName,
      description: famAbilityDesc,
      cost: famAbilityCost,
      cooldown: famAbilityCooldown,
      range: famAbilityRange,
      speed: famAbilitySpeed,
      rollFormula: famAbilityFormula,
      linkedStats: famAbilityLinkedStats,
      assignedToQuickRolls: famAbilityAssignedToQuickRolls,
      type: famAbilityType,
      resistances: famAbilityResistances,
      immunities: famAbilityImmunities,
      bonusPower: famAbilityBonusPower,
      bonusVitality: famAbilityBonusVitality,
      bonusSpirit: famAbilityBonusSpirit,
      bonusAgility: famAbilityBonusAgility,
      bonusEndurance: famAbilityBonusEndurance,
      bonusPrecision: famAbilityBonusPrecision,
      bonusWillpower: famAbilityBonusWillpower,
      bonusCharisma: famAbilityBonusCharisma,
      bonusHp: famAbilityBonusHp,
      bonusMana: famAbilityBonusMana,
      bonusDt: famAbilityBonusDt,
      level: 1,
      active: false
    };

    const updated = {
      ...fam,
      abilities: [...(fam.abilities || []), newAb]
    };
    updateFamiliarData(famId, updated);
    resetFamAbilityForm(famId);
    toast.success("Familiar ability added.");
  };

  const handleEditFamAbilityStart = (famId: string | number, ab: FamiliarAbility) => {
    setEditingFamAbilityId({ famId, abilityId: ab.id });
    setFamAbilityName(ab.name);
    setFamAbilityDesc(ab.description);
    setFamAbilityCost(ab.cost);
    setFamAbilityCooldown(ab.cooldown || 0);
    setFamAbilityRange(ab.range || "Melee");
    setFamAbilitySpeed(ab.speed || "Standard");
    setFamAbilityFormula(ab.rollFormula || "");
    setFamAbilityType(ab.type || "");
    setFamAbilityLinkedStats(ab.linkedStats || []);
    setFamAbilityAssignedToQuickRolls(!!ab.assignedToQuickRolls);
    setFamAbilityResistances(ab.resistances || "");
    setFamAbilityImmunities(ab.immunities || "");
    setFamAbilityBonusPower(ab.bonusPower || 0);
    setFamAbilityBonusVitality(ab.bonusVitality || 0);
    setFamAbilityBonusSpirit(ab.bonusSpirit || 0);
    setFamAbilityBonusAgility(ab.bonusAgility || 0);
    setFamAbilityBonusEndurance(ab.bonusEndurance || 0);
    setFamAbilityBonusPrecision(ab.bonusPrecision || 0);
    setFamAbilityBonusWillpower(ab.bonusWillpower || 0);
    setFamAbilityBonusCharisma(ab.bonusCharisma || 0);
    setFamAbilityBonusHp(ab.bonusHp !== undefined ? String(ab.bonusHp) : "");
    setFamAbilityBonusMana(ab.bonusMana !== undefined ? String(ab.bonusMana) : "");
    setFamAbilityBonusDt(ab.bonusDt !== undefined ? String(ab.bonusDt) : "");
    
    setIsAddingFamAbility(prev => ({ ...prev, [famId]: true }));
  };

  const handleUpdateFamAbility = (famId: string | number, abId: number) => {
    const list = character.familiars ? [...character.familiars] : [];
    const fam = list.find(f => f.id === famId);
    if (!fam || !famAbilityName.trim()) return;

    const updatedAbilities = fam.abilities.map(a => {
      if (a.id === abId) {
        return {
          ...a,
          name: famAbilityName,
          description: famAbilityDesc,
          cost: famAbilityCost,
          cooldown: famAbilityCooldown,
          range: famAbilityRange,
          speed: famAbilitySpeed,
          rollFormula: famAbilityFormula,
          type: famAbilityType,
          linkedStats: famAbilityLinkedStats,
          assignedToQuickRolls: famAbilityAssignedToQuickRolls,
          resistances: famAbilityResistances,
          immunities: famAbilityImmunities,
          bonusPower: famAbilityBonusPower,
          bonusVitality: famAbilityBonusVitality,
          bonusSpirit: famAbilityBonusSpirit,
          bonusAgility: famAbilityBonusAgility,
          bonusEndurance: famAbilityBonusEndurance,
          bonusPrecision: famAbilityBonusPrecision,
          bonusWillpower: famAbilityBonusWillpower,
          bonusCharisma: famAbilityBonusCharisma,
          bonusHp: famAbilityBonusHp,
          bonusMana: famAbilityBonusMana,
          bonusDt: famAbilityBonusDt
        };
      }
      return a;
    });

    updateFamiliarData(famId, { ...fam, abilities: updatedAbilities });
    resetFamAbilityForm(famId);
    toast.success("Familiar ability updated.");
  };

  const resetFamAbilityForm = (famId: string | number) => {
    setFamAbilityName("");
    setFamAbilityDesc("");
    setFamAbilityCost(0);
    setFamAbilityCooldown(0);
    setFamAbilityRange("Melee");
    setFamAbilitySpeed("Standard");
    setFamAbilityFormula("");
    setFamAbilityType("");
    setFamAbilityLinkedStats([]);
    setFamAbilityAssignedToQuickRolls(false);
    setFamAbilityResistances("");
    setFamAbilityImmunities("");
    setFamAbilityBonusPower(0);
    setFamAbilityBonusVitality(0);
    setFamAbilityBonusSpirit(0);
    setFamAbilityBonusAgility(0);
    setFamAbilityBonusEndurance(0);
    setFamAbilityBonusPrecision(0);
    setFamAbilityBonusWillpower(0);
    setFamAbilityBonusCharisma(0);
    setFamAbilityBonusHp("");
    setFamAbilityBonusMana("");
    setFamAbilityBonusDt("");
    setEditingFamAbilityId(null);
    setIsAddingFamAbility(prev => ({ ...prev, [famId]: false }));
  };

  const handleDeleteFamAbility = (famId: string | number, abId: number) => {
    const list = character.familiars ? [...character.familiars] : [];
    const fam = list.find(f => f.id === famId);
    if (!fam) return;

    const filtered = fam.abilities.filter(a => a.id !== abId);
    updateFamiliarData(famId, { ...fam, abilities: filtered });
    toast.success("Familiar ability removed.");
  };

  // ── Notes Backup & Restore ──
  const handleExportNotes = () => {
    if (!notes || notes.length === 0) {
      toast.error("No notes to export!");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${character.name.toLowerCase().replace(/\s+/g, "_")}_campaign_notes.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Notes exported successfully!");
  };

  const handleImportNotesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        const importedNotes = JSON.parse(text);
        if (!Array.isArray(importedNotes)) {
          throw new Error("Invalid format. Expected an array of notes.");
        }
        
        let importCount = 0;
        const existingNotes = notes || [];
        for (const note of importedNotes) {
          if (note.title && note.content) {
            let titleToUse = note.title;
            const exists = existingNotes.some(n => n.title.toLowerCase() === note.title.toLowerCase());
            if (exists) {
              titleToUse = `${note.title} (Copy)`;
            }
            createNote.mutate({
              characterId: Number(id),
              title: titleToUse,
              content: note.content,
              category: note.category || "general",
              tags: Array.isArray(note.tags) ? note.tags : [],
              images: Array.isArray(note.images) ? note.images : []
            });
            importCount++;
          }
        }
        toast.success(`Successfully imported ${importCount} notes!`);
      } catch (err) {
        toast.error("Failed to parse notes file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Familiar Full Rest ──
  const handleFamFullRest = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "restore"
    }));
    setFamDamageResults(prev => {
      const copy = { ...prev };
      delete copy[fam.id];
      return copy;
    });
    updateFamiliarData(fam.id, { 
      ...fam, 
      currentHp: fMax.maxHp,
      currentDt: fMax.maxDt,
      currentMana: fMax.maxMana
    });
    toast.success(`${fam.name} completed a Full Rest. Vitals restored.`);
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  // ── Drag and Drop Handlers ──
  const handleAbilityDragStart = (e: React.DragEvent, abilityId: number) => {
    setDraggedAbilityId(abilityId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleAbilityDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAbilityDrop = (e: React.DragEvent, targetAbilityId: number, groupAbilities: Ability[]) => {
    e.preventDefault();
    if (draggedAbilityId === null || draggedAbilityId === targetAbilityId) return;

    const draggedAbility = abilities.find(a => a.id === draggedAbilityId);
    const targetAbility = abilities.find(a => a.id === targetAbilityId);
    if (!draggedAbility || !targetAbility) return;

    if (draggedAbility.essenceId !== targetAbility.essenceId) {
      toast.error("Abilities must be kept within their assigned essence.");
      return;
    }

    const draggedIndex = groupAbilities.findIndex(a => a.id === draggedAbilityId);
    const targetIndex = groupAbilities.findIndex(a => a.id === targetAbilityId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...groupAbilities];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedItem);

    // Update sortOrder for all items in this group
    reordered.forEach((ab, idx) => {
      updateAbility.mutate({
        id: ab.id,
        data: { sortOrder: idx }
      });
    });

    setDraggedAbilityId(null);
    toast.success("Abilities reordered.");
  };

  const handleFamAbDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedFamAbIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFamAbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFamAbDrop = (e: React.DragEvent, fam: Familiar, targetIdx: number) => {
    e.preventDefault();
    if (draggedFamAbIdx === null || draggedFamAbIdx === targetIdx) return;
    const items = [...fam.abilities];
    const [draggedItem] = items.splice(draggedFamAbIdx, 1);
    items.splice(targetIdx, 0, draggedItem);
    
    updateFamiliarData(fam.id, { ...fam, abilities: items });
    setDraggedFamAbIdx(null);
    toast.success("Familiar abilities reordered.");
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

  const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const sortAbilities = (list: Ability[]) => {
    return [...list].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : a.id;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : b.id;
      return orderA - orderB;
    });
  };

  const activeFavorites = getFavorites(character, equipment, abilities);

  const preparedAbilities = abilities?.filter(a => a.level && a.level > 0) || [];
  const abilityResistances = preparedAbilities.map(a => a.resistances).filter(Boolean).join(", ");
  const abilityImmunities = preparedAbilities.map(a => a.immunities).filter(Boolean).join(", ");

  const totalResistances = [character.resistances, abilityResistances].filter(Boolean).join(", ");
  const totalImmunities = [character.immunities, abilityImmunities].filter(Boolean).join(", ");

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
    <div className="p-4 max-w-7xl mx-auto animate-in fade-in duration-500 space-y-4">
      
      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground rounded-none cursor-pointer pl-0">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="h-4 w-px bg-border/40" />
          <div className="flex items-center gap-2">
            <img 
              src={`${import.meta.env.BASE_URL}logo.jpg`} 
              alt="Logo" 
              className="w-6 h-6 rounded-md object-cover border border-primary/25 shadow-sm" 
            />
            <span className="font-serif text-xs font-bold text-primary tracking-wider uppercase">The Grimoire</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CustomizeToolDialog />
          <RollGuideDialog />
          <Button variant="outline" size="sm" onClick={() => exportCharacterJSON(id)} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Download className="w-3.5 h-3.5 mr-1" /> Export Character
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Upload className="w-3.5 h-3.5 mr-1" /> Import Character
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
              <div className="flex justify-between items-center flex-wrap gap-4 border-b border-border/30 pb-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Portrait Avatar File Upload */}
                  <div className="relative group w-16 h-16 rounded-full overflow-hidden border-2 border-primary/55 bg-background flex-shrink-0 flex items-center justify-center cursor-pointer">
                    {character.avatar ? (
                      <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground text-sm font-bold uppercase">{character.name.substring(0, 2)}</span>
                    )}
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold cursor-pointer">
                      Change
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const dataUrl = await compressImage(file, 200, 200);
                              updateChar.mutate({ id, data: { avatar: dataUrl } }, {
                                onSuccess: () => toast.success("Character portrait updated!")
                              });
                            } catch (err) {
                              toast.error("Failed to upload/compress image.");
                            }
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-3xl font-serif text-primary font-bold leading-tight truncate">
                      {character.name}
                    </h1>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                      {character.race} · {character.rank}
                    </p>
                  {(totalResistances || totalImmunities) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans mt-2">
                      {totalResistances && (
                        <span>
                          <strong className="text-foreground uppercase tracking-wider text-[10px]">Resistances:</strong> {totalResistances}
                        </span>
                      )}
                      {totalImmunities && (
                        <span>
                          <strong className="text-foreground uppercase tracking-wider text-[10px]">Immunities:</strong> {totalImmunities}
                        </span>
                      )}
                    </div>
                  )}
                  </div>
                </div>

                {/* Long Rest Confirmation Trigger */}
                <div className="flex items-center gap-3">
                  <Dialog open={isLongRestConfirmOpen} onOpenChange={setIsLongRestConfirmOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold font-serif rounded-md cursor-pointer text-xs">
                        Long Rest
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px] bg-card border border-border shadow-2xl rounded-md p-6">
                      <DialogHeader>
                        <DialogTitle className="font-serif text-xl text-amber-500 font-bold flex items-center gap-2">
                          <RotateCcw className="w-5 h-5" /> Confirm Long Rest?
                        </DialogTitle>
                      </DialogHeader>
                      <div className="py-3 text-xs text-muted-foreground leading-relaxed font-sans">
                        Are you sure you want to take a Long Rest? This will fully restore your HP, DT, and Mana pools to their maximum values and record the logs.
                      </div>
                      <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
                        <Button variant="ghost" size="sm" onClick={() => setIsLongRestConfirmOpen(false)} className="rounded-md font-bold text-xs">
                          Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleLongRest} className="bg-amber-500 hover:bg-amber-600 text-black rounded-md font-bold text-xs">
                          Confirm Rest
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Speed</div>
                  <div className="text-2xl font-serif text-foreground font-bold">{character.speed} ft</div>
                </div>
              </div>

              {/* Resource Management HUD grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. DT (Damage Threshold) - Ordered First */}
                <div className={`rounded-md border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/40 bg-background/30"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-yellow-500" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${
                      dtFlash === "hit" ? "text-destructive" 
                      : (currentDt ?? character.currentDt) > maxDt ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" 
                      : "text-foreground"
                    }`}>
                      {currentDt ?? character.currentDt}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span className={maxDt > baseMaxDt ? "text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]" : ""}>
                        {maxDt}
                      </span>
                      {maxDt > baseMaxDt && <span className="text-[9px] text-cyan-400/80 ml-0.5" title={`Stat Boosted Max: +${maxDt - baseMaxDt}`}>(+{maxDt - baseMaxDt})</span>}
                      {abilityDtBonus > 0 && <span className="text-[9px] text-amber-400/80 ml-0.5" title={`Flat Buff: +${abilityDtBonus}`}>[+{abilityDtBonus} Buff]</span>}
                    </span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt + abilityDtBonus} color="#eab308" />
                  
                  {/* dt quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtAdd} placeholder="Add val"
                        onChange={e => setDtAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleDtAdd} disabled={!dtAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtRemove} placeholder="DMG Val"
                        onChange={e => { setDtRemove(e.target.value); setDamageResult(null); }}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleApplyDamage} disabled={!dtRemove || applyDamageMut.isPending}>
                        Hit
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtBuff} placeholder="Buff val"
                        onChange={e => setDtBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleDtBuff} disabled={!dtBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleRestoreDt}>
                      Full Restore DT
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 flex items-center justify-center mt-1">
                      {damageResult && (
                        <p className="text-[10px] font-mono text-center text-destructive">
                          {damageResult.absorbed ? "✦ Absorbed" : "−1 DT"}
                        </p>
                      )}
                    </div>
                    {/* DT History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> DT Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "dt-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "dt-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "DT Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No DT history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* 2. HP (Health) - Ordered Second */}
                <div className="rounded-md border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-4 h-4 text-destructive" /> Health (HP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${hp && hp > maxHp ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {hp ?? character.currentHp}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span className={maxHp > baseMaxHp ? "text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]" : ""}>
                        {maxHp}
                      </span>
                      {maxHp > baseMaxHp && <span className="text-[9px] text-cyan-400/80 ml-0.5" title={`Stat Boosted Max: +${maxHp - baseMaxHp}`}>(+{maxHp - baseMaxHp})</span>}
                      {abilityHpBonus > 0 && <span className="text-[9px] text-amber-400/80 ml-0.5" title={`Flat Buff: +${abilityHpBonus}`}>[+{abilityHpBonus} Buff]</span>}
                    </span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={maxHp + abilityHpBonus} color={hp && hp > maxHp ? "#f59e0b" : "hsl(var(--destructive))"} />
                  
                  {/* hp quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpAdd} placeholder="Heal val"
                        onChange={e => setHpAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpAdd} disabled={!hpAdd}>
                        Heal
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpRemove} placeholder="Dmg val"
                        onChange={e => setHpRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpRemove} disabled={!hpRemove}>
                        Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpBuff} placeholder="Buff val"
                        onChange={e => setHpBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpBuff} disabled={!hpBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleFullRestoreHp}>
                      Full Restore HP
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 flex items-center justify-center mt-1">
                      {damageResult && damageResult.hpLost > 0 && (
                        <p className="text-[10px] font-mono text-center text-destructive">
                          −{damageResult.hpLost} HP
                        </p>
                      )}
                    </div>
                    {/* HP History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> Health Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "hp-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "hp-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "HP Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No Health history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* 3. Mana (MP) - Ordered Third */}
                <div className="rounded-md border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Mana (MP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${mana && mana > maxMana ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {mana ?? character.currentMana}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span className={maxMana > baseMaxMana ? "text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]" : ""}>
                        {maxMana}
                      </span>
                      {maxMana > baseMaxMana && <span className="text-[9px] text-cyan-400/80 ml-0.5" title={`Stat Boosted Max: +${maxMana - baseMaxMana}`}>(+{maxMana - baseMaxMana})</span>}
                      {abilityManaBonus > 0 && <span className="text-[9px] text-amber-400/80 ml-0.5" title={`Flat Buff: +${abilityManaBonus}`}>[+{abilityManaBonus} Buff]</span>}
                    </span>
                  </div>
                  <ResourceBar current={mana ?? character.currentMana} max={maxMana + abilityManaBonus} color={mana && mana > maxMana ? "#f59e0b" : "#3b82f6"} />
                  
                  {/* mana quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaAdd} placeholder="Add val"
                        onChange={e => setManaAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaAdd} disabled={!manaAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaRemove} placeholder="Use val"
                        onChange={e => setManaRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaRemove} disabled={!manaRemove}>
                        Use
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaBuff} placeholder="Buff val"
                        onChange={e => setManaBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaBuff} disabled={!manaBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleFullRestoreMana}>
                      Full Restore Mana
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 mt-1" />
                    {/* Mana History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> Mana Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "mana-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "mana-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "Mana Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No Mana history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

              </div>
            </CardContent>
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
                        type="text"
                        value={rollMod}
                        onChange={e => setRollMod(e.target.value)}
                        placeholder="Mod / Formula (e.g. POWr*3)"
                        className="bg-background/50 border-border/50 text-center font-mono text-xs h-7 w-48 flex-shrink-0 rounded-none text-ellipsis overflow-hidden"
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

                    <div className="space-y-1.5 border-t border-border/10 pt-2.5">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-left">Custom Formula</div>
                      <div className="flex gap-2">
                        <Input
                          value={customFormula}
                          onChange={e => setCustomFormula(e.target.value)}
                          placeholder="e.g. 2d6 + POWr*3"
                          className="bg-background/50 border-border/50 text-xs h-7 flex-1 rounded-none font-mono"
                        />
                        <Button
                          size="sm"
                          onClick={handleCustomFormulaRoll}
                          disabled={!customFormula.trim() || !!rollingDice}
                          className="h-7 text-xs font-serif rounded-none px-3 bg-primary text-primary-foreground cursor-pointer"
                        >
                          Roll
                        </Button>
                      </div>
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

              {/* Recent Actions Section */}
              <div className="space-y-1.5 border-t border-border/30 pt-3">
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3 text-primary animate-pulse" /> Recent Actions
                </h5>
                {recentRollActions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto pr-1">
                    {recentRollActions.map((action, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleRoll(action.diceType, action.label, undefined, action.modifier)}
                        className="text-[9px] font-mono border border-border/40 bg-background/40 hover:border-primary/50 px-2 py-1 flex items-center gap-1.5 rounded transition-all cursor-pointer text-foreground hover:bg-primary/5"
                        title={`Roll again: ${action.label} (${action.diceType}${action.modifier ? (action.modifier > 0 ? `+${action.modifier}` : action.modifier) : ""})`}
                      >
                        <Dice5 className="w-2.5 h-2.5 text-primary" />
                        <span className="truncate max-w-[80px] font-sans font-semibold">{action.label}</span>
                        <span className="text-muted-foreground/80">
                          {action.diceType}{action.modifier ? (action.modifier > 0 ? `+${action.modifier}` : action.modifier) : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-muted-foreground/60 italic font-serif">No recent actions.</p>
                )}
              </div>

              {/* LCD-Style Dice HUD Roll Screen */}
              <div
                className="p-4 border-2 border-slate-700/60 rounded-md text-center flex flex-col items-center justify-center transition-all duration-500 min-h-[150px] mt-4 bg-[#0c100e] shadow-[inset_0_0_15px_rgba(0,0,0,0.95)] relative overflow-hidden group"
                style={
                  tier
                    ? { borderColor: tier.color + "88", boxShadow: `inset 0 0 15px rgba(0,0,0,0.95), 0 0 20px ${tier.color}33`, background: `${tier.color}05` }
                    : finalTier
                      ? { borderColor: finalTier.color + "55", boxShadow: `inset 0 0 15px rgba(0,0,0,0.95), 0 0 15px ${finalTier.color}22`, background: `${finalTier.color}03` }
                      : {}
                }
              >
                {/* LCD backlight overlay */}
                <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />
                
                {rollingDice ? (
                  <Dice5 className="w-10 h-10 animate-spin text-emerald-400 opacity-75 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                ) : critChain ? (
                  <div className="animate-in zoom-in duration-200 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)] space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] mb-2 font-bold animate-pulse text-center" style={{ color: tier!.color }}>
                      ✦ {tier!.name} — Crit! ✦
                    </p>
                    
                    <div className="text-sm font-semibold text-emerald-300/80 font-mono tracking-wide text-center">
                      {critChain.rolls.map(r => r.breakdown).join(" + ")}
                      {critChain.modifier !== 0 && (critChain.modifier > 0 ? ` + ${critChain.modifier}` : ` - ${Math.abs(critChain.modifier)}`)}
                    </div>

                    <div className="text-5xl font-bold font-serif my-1 text-center" style={{ color: tier!.color }}>
                      {critChain.runningDiceTotal + critChain.modifier}
                    </div>

                    <div className="mt-3 text-center">
                      <button
                        onClick={handleChainRoll}
                        disabled={!!rollingDice}
                        className="px-5 py-1.5 rounded font-bold text-xs uppercase tracking-widest animate-pulse disabled:opacity-50 hover:scale-105 hover:animate-none transition-all cursor-pointer font-serif"
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
                  <div className="animate-in zoom-in duration-300 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)]">
                    {lastRoll.hadCrit ? (
                      <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: finalTier?.color ?? "#ffd700" }}>
                        ✦ {finalTier ? `${finalTier.name} Critical` : "Critical"} Hit! ✦
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/60 mb-2 font-semibold">{lastRoll.label}</p>
                    )}
                    {lastRoll.rolls && lastRoll.rolls.length > 0 ? (
                      <div className="space-y-2 my-2 text-center">
                        <div className="text-sm font-semibold text-emerald-300/80 font-mono tracking-wide">
                          {lastRoll.rolls.map(r => r.breakdown).join(" + ")}
                          {lastRoll.modifier !== 0 && (lastRoll.modifier > 0 ? ` + ${lastRoll.modifier}` : ` - ${Math.abs(lastRoll.modifier)}`)}
                        </div>
                      </div>
                    ) : lastRoll.diceType && (lastRoll.diceType.includes("(") || lastRoll.diceType.includes("+") || lastRoll.diceType.includes("-") || lastRoll.diceType.includes("*")) ? (
                      <div className="text-sm font-semibold text-emerald-300/90 mb-3 font-mono bg-emerald-950/30 py-1.5 px-3 border border-emerald-500/10 rounded inline-block max-w-[90%] mx-auto leading-normal">
                        {lastRoll.diceType}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                        <div className="text-center">
                          <span className="text-[10px] text-emerald-500/50 block uppercase tracking-wider">Roll</span>
                          <span className="text-2xl font-semibold text-emerald-300">{lastRoll.rawRoll}</span>
                        </div>
                        {lastRoll.modifier !== 0 && (
                          <>
                            <span className="text-lg text-emerald-500/40 font-light mt-2">+</span>
                            <div className="text-center">
                              <span className="text-[10px] text-emerald-500/50 block uppercase tracking-wider">Mod</span>
                              <span className="text-2xl font-semibold text-emerald-400">{lastRoll.modifier}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="h-px w-24 mx-auto my-2"
                      style={{ background: finalTier ? finalTier.color + "60" : "rgba(16,185,129,0.2)" }} />
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/50 block">Total</span>
                      <span className="text-6xl font-bold leading-none"
                        style={{ color: finalTier?.color ?? "rgb(52,211,153)" }}>
                        {lastRoll.total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-emerald-500/70 text-xs font-mono tracking-widest animate-pulse uppercase">
                    THE DICE AWAIT...
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── Custom Favorites Hotbar ── */}
      <div className="mt-6">
        <Card className="bg-card/75 border-border/40 p-4 rounded-none shadow-md">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" /> Favorites Hotbar
          </h3>
          
          {/* 20 Card Grid (10-on-10 on desktop, 5-on-4 on mobile) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-3">
            {activeFavorites.map((fav, index) => {
              if (fav) {
                const details = getSlotDetails(fav);
                return (
                  <div 
                    key={index} 
                    onClick={() => handleExecuteFavorite(fav)}
                    className="min-h-[72px] bg-background/60 hover:bg-accent/40 border border-primary/45 hover:border-primary transition-all relative flex flex-col justify-between cursor-pointer p-2 rounded-md group shadow-sm"
                    title={`Favorite #${index + 1}: ${fav.label}`}
                  >
                    {/* Delete Slot Button */}
                    <button
                      onClick={(e) => handleClearFavorite(index, e)}
                      className="absolute top-1 right-1 h-4 w-4 bg-destructive hover:bg-destructive/95 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded border border-border cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>

                    {/* Header slot ID + Type badge */}
                    <div className="flex justify-between items-center w-full">
                      <span className="text-[8px] font-mono text-muted-foreground/75 font-semibold">#{index + 1}</span>
                      <span className="text-[7px] font-mono font-bold uppercase tracking-wider text-primary border border-primary/20 px-1 py-0.25 rounded bg-primary/5">
                        {fav.type === "weapon" ? "Weapon" : fav.type === "ability" ? "Spell" : fav.type === "skill" ? "Skill" : fav.type === "familiar-ability" ? "Fam Ab" : fav.type === "familiar-attribute" ? "Fam Stat" : "Stat"}
                      </span>
                    </div>

                    {/* Name Row */}
                    <div className="text-[10px] font-bold text-foreground truncate max-w-full leading-tight font-serif text-left mt-1">
                      {details.name}
                    </div>

                    {/* Footer Cost + Stat */}
                    <div className="flex justify-between items-center w-full mt-1 border-t border-border/20 pt-1 text-[8px] font-mono">
                      <span className="text-muted-foreground">{details.costStr || "-"}</span>
                      <span className="text-primary font-bold">{details.statStr || "-"}</span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <button
                    key={index}
                    onClick={() => setAssigningSlotIndex(index)}
                    className="min-h-[72px] bg-background/20 hover:bg-accent/30 border border-dashed border-border/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-primary rounded-md p-2 text-center text-xs gap-1 shadow-sm"
                    title={`Click to assign Favorite #${index + 1}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-mono">Assign #{index + 1}</span>
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
                {abilities.filter(ab => !ab.equipmentId).length > 0 && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Shaped Spells</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {abilities.filter(ab => !ab.equipmentId).map(ab => (
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

                {/* Item Abilities */}
                {abilities.filter(ab => ab.equipmentId).length > 0 && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Item Abilities</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {abilities.filter(ab => ab.equipmentId).map(ab => {
                        const eq = equipment.find(e => e.id === ab.equipmentId);
                        const displayName = eq ? `${eq.name}: ${ab.name}` : ab.name;
                        return (
                          <Button 
                            key={ab.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "ability", ab.id, displayName)}
                          >
                            {displayName}
                          </Button>
                        );
                      })}
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

                {/* Familiar Options (Multiple Companions) */}
                {character.familiars && character.familiars.length > 0 && (
                  <div className="space-y-4 pt-2 border-t border-border/20">
                    <h4 className="font-bold text-primary uppercase tracking-widest text-[10px]">Companion Familiars</h4>
                    {character.familiars.map(fam => (
                      <div key={fam.id} className="space-y-3 bg-background/40 p-2.5 rounded-md border border-border/30">
                        <h5 className="font-serif font-bold text-xs text-primary">{fam.name} ({fam.race})</h5>
                        <div>
                          <h6 className="font-bold text-[9px] text-muted-foreground uppercase block mb-1">Attributes</h6>
                          <div className="flex flex-wrap gap-1">
                            {STATS.map(stat => {
                              const val = (fam as any)[stat.key] as number;
                              return (
                                <Button 
                                  key={stat.key} variant="outline" size="sm" className="h-6 text-[9px] rounded-md font-mono"
                                  onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-attribute", stat.key, `${fam.name}:${stat.label}`, fam.id)}
                                >
                                  {stat.label} (+{Math.floor(val/3)})
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        {fam.abilities && fam.abilities.length > 0 && (
                          <div>
                            <h6 className="font-bold text-[9px] text-muted-foreground uppercase block mb-1">Abilities</h6>
                            <div className="flex flex-wrap gap-1">
                              {fam.abilities.map(ab => (
                                <Button 
                                  key={ab.id} variant="outline" size="sm" className="h-6 text-[9px] rounded-md font-serif"
                                  onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-ability", ab.id, `${fam.name}:${ab.name}`, fam.id)}
                                >
                                  {ab.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </div>

      {/* ── TABBED TOOL SCREEN BAR ── */}
      <div className="flex gap-1 border-b border-border/40 mt-6 overflow-x-auto pb-1 flex-wrap">
        {[
          { key: "stats", label: "Base & Training", icon: Hammer },
          { key: "skills", label: "Skills Log", icon: BookText },
          { key: "inventory", label: "Bag / Gear", icon: Coins },
          { key: "essences", label: "Essence Confluence", icon: Layers },
          { key: "abilities", label: "Abilities", icon: Flame },
          { key: "notes", label: "Campaign Notes", icon: BookText },
          { key: "familiar", label: "Familiars", icon: UserCheck },
          { key: "combat", label: "Combat Tracker", icon: Swords }
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
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Hammer className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Attributes & Training</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage base stats and track training progress</p>
                </div>
              </div>
            </div>
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
        </div>
        )}

        {/* TAB 2: SKILLS (Card click rolls) */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <BookText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Skills Log</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Roll skills and train modifiers</p>
                </div>
              </div>
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
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Bag / Gear</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage inventory, currency, and equipped gear</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            
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

                          {/* Item Linked Abilities list */}
                          <div className="border-t border-border/20 pt-2 mt-2 space-y-2">
                            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-primary tracking-wider">
                              <span>Item Abilities</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-5 text-[9px] text-primary hover:bg-primary/10 px-1.5 py-0 cursor-pointer rounded-none"
                                onClick={() => triggerAddItemAbility(eq.id)}
                              >
                                <Plus className="w-2.5 h-2.5 mr-0.5" /> Add Ability
                              </Button>
                            </div>
                            {abilities.filter(a => a.equipmentId === eq.id).length > 0 ? (
                              <div className="space-y-1.5">
                                {abilities.filter(a => a.equipmentId === eq.id).map(ab => (
                                  <div key={ab.id} className="flex justify-between items-center bg-background/30 p-2 border border-border/10 group/ab">
                                    <div className="min-w-0 flex-1">
                                      <div className="font-serif text-xs font-bold text-foreground flex items-center gap-1.5">
                                        {ab.name}
                                        {ab.cost > 0 && <span className="text-[9px] text-blue-400 font-mono">({ab.cost} MP)</span>}
                                      </div>
                                      {ab.description && <p className="text-[10px] text-muted-foreground/80 font-serif line-clamp-1">{ab.description}</p>}
                                      {ab.rollFormula && <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">Formula: {ab.rollFormula}</p>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {ab.rollFormula && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[9px] font-serif border-primary/20 text-primary hover:bg-primary/15 px-2 rounded-none cursor-pointer"
                                          onClick={() => handleAbilityRoll(ab)}
                                        >
                                          Roll
                                        </Button>
                                      )}
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 text-primary opacity-0 group-hover/ab:opacity-100 transition-opacity rounded-none cursor-pointer" 
                                        onClick={() => triggerEditItemAbility(ab)}
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 text-destructive opacity-0 group-hover/ab:opacity-100 transition-opacity rounded-none cursor-pointer" 
                                        onClick={() => deleteAbility.mutate({ id: ab.id })}
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-muted-foreground/50 italic">No abilities attached.</p>
                            )}
                          </div>

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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive rounded-none cursor-pointer" 
                            onClick={() => {
                              if (item.quantity > 1) {
                                triggerDiscardItem(item);
                              } else {
                                deleteInvItem.mutate({ id: item.id, charId: id }, {
                                  onSuccess: () => toast.success(`Discarded ${item.name}.`)
                                });
                              }
                            }}
                          >
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

            <EditItemAbilityDialog
              isOpen={isItemAbOpen}
              onOpenChange={setIsItemAbOpen}
              characterId={id}
              equipmentId={itemAbEquipmentId}
              initialData={itemAbInitialData}
            />
          </div>
        </div>
        )}

        {/* TAB 4: ESSENCE CONFLUENCE */}
        {activeTab === "essences" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Essence Confluence</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bind and align essence crystals to unlock attributes</p>
                </div>
              </div>
            </div>
            
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
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:bg-amber-500/30 h-7 text-xs font-serif rounded-none cursor-pointer font-bold transition-all"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Unleash Confluence
                          </Button>
                        </div>
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
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:bg-amber-500/30 h-7 text-xs font-serif rounded-none cursor-pointer font-bold transition-all"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Unleash Confluence
                          </Button>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-primary/20 border border-primary/30 text-primary hover:bg        {/* TAB 5: ABILITIES */}
        {activeTab === "abilities" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Shaped Abilities</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Activate and cast abilities using mana</p>
                </div>
              </div>
              <EditAbilitiesDialog characterId={id} abilities={abilities} />
            </div>

            {(() => {
              // Helper to render ability card
              const renderAbilityCard = (ability: Ability, currentGroupList: Ability[], forceExpand?: boolean) => {
                const isExpanded = forceExpand !== undefined ? forceExpand : !!expandedAbilities[ability.id];
                
                // Collect and format flat bonuses to display
                const bonuses: string[] = [];
                if (ability.bonusPower) bonuses.push(`+${ability.bonusPower} POW`);
                if (ability.bonusVitality) bonuses.push(`+${ability.bonusVitality} VIT`);
                if (ability.bonusSpirit) bonuses.push(`+${ability.bonusSpirit} SPI`);
                if (ability.bonusAgility) bonuses.push(`+${ability.bonusAgility} AGI`);
                if (ability.bonusEndurance) bonuses.push(`+${ability.bonusEndurance} END`);
                if (ability.bonusPrecision) bonuses.push(`+${ability.bonusPrecision} PRE`);
                if (ability.bonusWillpower) bonuses.push(`+${ability.bonusWillpower} WIL`);
                if (ability.bonusCharisma) bonuses.push(`+${ability.bonusCharisma} CHA`);
                if (ability.bonusHp) bonuses.push(`+${ability.bonusHp} Max HP`);
                if (ability.bonusMana) bonuses.push(`+${ability.bonusMana} Max Mana`);
                if (ability.bonusDt) bonuses.push(`+${ability.bonusDt} Max DT`);
                if (ability.resistances) bonuses.push(`Resistances: ${ability.resistances}`);
                if (ability.immunities) bonuses.push(`Immunities: ${ability.immunities}`);

                return (
                  <Card 
                    key={ability.id} 
                    draggable={true}
                    onDragStart={(e) => handleAbilityDragStart(e, ability.id)}
                    onDragOver={handleAbilityDragOver}
                    onDrop={(e) => handleAbilityDrop(e, ability.id, currentGroupList)}
                    className="bg-card border border-border/40 hover:border-primary/20 transition-all rounded-none overflow-hidden cursor-grab active:cursor-grabbing relative"
                  >
                    <CardContent className="p-3.5 space-y-2">
                      {/* Header row (Clickable card body toggles expansion except buttons) */}
                      <div 
                        className="flex justify-between items-start cursor-pointer select-none"
                        onClick={() => setExpandedAbilities(prev => ({ ...prev, [ability.id]: !isExpanded }))}
                      >
                        <div className="space-y-1.5 flex-1 pr-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Level Incrementer moved here (top left) */}
                            <div className="flex items-center gap-1 border border-border/40 px-1.5 py-0.5 rounded-none bg-background/50 text-[10px] font-semibold text-muted-foreground font-mono" onClick={e => e.stopPropagation()}>
                              <span>Lvl: {ability.level || 1}</span>
                              <button 
                                type="button"
                                onClick={() => handleAbilityLevelChange(ability.id, "down")} 
                                className="w-3.5 h-3.5 flex items-center justify-center bg-accent hover:bg-accent/80 text-foreground rounded-none text-[9px] font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleAbilityLevelChange(ability.id, "up")} 
                                className="w-3.5 h-3.5 flex items-center justify-center bg-accent hover:bg-accent/80 text-foreground rounded-none text-[9px] font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <h4 className="font-serif text-lg font-bold text-primary leading-tight hover:text-primary/80 transition-colors flex items-center gap-1.5 flex-wrap">
                              {ability.name}
                              {ability.type && (
                                <Badge className="bg-primary/10 border border-primary/30 text-primary text-[8px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5">
                                  {ability.type}
                                </Badge>
                              )}
                            </h4>
                            <svg className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{ability.cost} MP</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{ability.range}</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{ability.speed}</Badge>
                            
                            {/* Active Toggle Switch */}
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleAbilityActive(ability)}
                                className={`px-2 py-0.5 rounded-none text-[9px] font-bold uppercase transition-all border cursor-pointer ${
                                  ability.active 
                                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" 
                                    : "bg-background/40 border-border/80 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                }`}
                              >
                                {ability.active ? "Active" : "Inactive"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Roll Buttons (Prevent Card Click Toggle) */}
                        <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                          {ability.linkedStats && ability.linkedStats.length > 0 ? (
                            ability.linkedStats.map(statKey => (
                              <Button
                                key={statKey}
                                size="sm"
                                onClick={() => handleAbilityRoll(ability, statKey)}
                                className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer whitespace-nowrap"
                              >
                                <Dice5 className="w-3 h-3 mr-1" /> Roll ({statKey.substring(0, 3).toUpperCase()})
                              </Button>
                            ))
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleAbilityRoll(ability)}
                              className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer"
                            >
                              <Dice5 className="w-3 h-3 mr-1" /> Use Ability
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Content (Markdown + Stats + Formulas) */}
                      {isExpanded && (
                        <div className="border-t border-border/20 pt-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                          {ability.rollFormula && (
                            <div className="text-[10px] font-mono text-muted-foreground bg-background/50 border border-border/30 px-2.5 py-1.5 rounded-none flex items-center justify-between">
                              <span>Formula: <code className="text-primary font-bold">{ability.rollFormula}</code></span>
                            </div>
                          )}

                          {bonuses.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 text-[9px]">
                              {bonuses.map((b, idx) => (
                                <Badge key={idx} variant="outline" className="border-emerald-500/20 text-emerald-500 rounded bg-emerald-500/[0.03] uppercase tracking-wider font-bold">
                                  {b}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div
                            className="text-xs text-muted-foreground font-serif leading-relaxed whitespace-pre-wrap pl-1"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(ability.description || "*No description.*") }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              };

              const renderAbilityGrid = (abilitiesList: Ability[]) => {
                const chunks = chunkArray(abilitiesList, 2);
                return (
                  <div className="space-y-4">
                    {chunks.map((row, rowIdx) => {
                      const isRowExpanded = row.some(ab => expandedAbilities[ab.id]);
                      return (
                        <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {row.map(ab => renderAbilityCard(ab, abilitiesList, isRowExpanded))}
                        </div>
                      );
                    })}
                  </div>
                );
              };

              // Group abilities by Essence Slot
              const slots = [1, 2, 3, 4];
              const grouped = slots.map(slotNum => {
                const ess = essences?.find(e => e.slot === slotNum);
                const label = slotNum === 1 ? "First Essence" : slotNum === 2 ? "Second Essence" : slotNum === 3 ? "Third Essence" : "Confluence";
                const attachedAbilities = sortAbilities(abilities?.filter(a => ess && a.essenceId === ess.id && !a.equipmentId) || []);
                return { slotNum, ess, label, abilities: attachedAbilities };
              });

              const unassignedAbilities = sortAbilities(abilities?.filter(a => (!a.essenceId || !essences?.some(e => e.id === a.essenceId)) && !a.equipmentId) || []);

              return (
                <div className="space-y-6">
                  {/* Essence Groups */}
                  {grouped.map(({ slotNum, ess, label, abilities: attached }) => {
                    if (!ess) return null; // Only show attuned Essence slots
                    return (
                      <div key={slotNum} className="space-y-3 border-l-2 border-primary/20 pl-4 py-1">
                        <div className="flex justify-between items-baseline border-b border-border/20 pb-1.5 flex-wrap gap-2">
                          <h4 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                            <span>{label}: {ess.name}</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                            Shaped Abilities: {attached.length} / 5
                          </span>
                        </div>

                        {attached.length > 0 ? (
                          renderAbilityGrid(attached)
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic font-serif py-2">
                            No abilities shaped to this Essence. (Max 5)
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned Group */}
                  {unassignedAbilities.length > 0 && (
                    <div className="space-y-3 border-l-2 border-border/20 pl-4 py-1">
                      <div className="flex justify-between items-baseline border-b border-border/20 pb-1.5">
                        <h4 className="font-serif text-lg font-bold text-muted-foreground">Unassigned Abilities</h4>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          Total: {unassignedAbilities.length}
                        </span>
                      </div>
                      {renderAbilityGrid(unassignedAbilities)}
                    </div>
                  )}

                  {/* Empty State when no abilities exist at all */}
                  {(!abilities || abilities.length === 0) && (
                    <div className="text-center py-12 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                      No abilities registered yet. Click "Edit Abilities" to manage your spellbook.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}                   <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                            Shaped Abilities: {attached.length} / 5
                          </span>
                        </div>

                        {attached.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {attached.map(renderAbilityCard)}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic font-serif py-2">
                            No abilities shaped to this Essence. (Max 5)
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Unassigned Group */}
                  {unassignedAbilities.length > 0 && (
                    <div className="space-y-3 border-l-2 border-border/20 pl-4 py-1">
                      <div className="flex justify-between items-baseline border-b border-border/20 pb-1.5">
                        <h4 className="font-serif text-lg font-bold text-muted-foreground">Unassigned Abilities</h4>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          Total: {unassignedAbilities.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {unassignedAbilities.map(renderAbilityCard)}
                      </div>
                    </div>
                  )}

                  {/* Empty State when no abilities exist at all */}
                  {(!abilities || abilities.length === 0) && (
                    <div className="text-center py-12 bg-card/30 border border-dashed border-border-border/40 rounded-md text-sm text-muted-foreground/60 italic font-serif">
                      No abilities registered yet. Click "Edit Abilities" to manage your spellbook.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB 6: CAMPAIGN NOTES (Search and Thematic Filter) */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px] flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <BookText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Campaign Notes</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Record adventure logs, fact entries, and journals</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={notesFileInputRef} 
                  onChange={handleImportNotesFile} 
                  accept=".json" 
                  className="hidden" 
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => notesFileInputRef.current?.click()} 
                  className="rounded-none border-primary/40 text-primary hover:bg-primary/10 cursor-pointer text-xs uppercase tracking-wider font-mono h-8"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Import Notes
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportNotes} 
                  className="rounded-none border-primary/40 text-primary hover:bg-primary/10 cursor-pointer text-xs uppercase tracking-wider font-mono h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export Notes
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              
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
                          <option value="organization">ORGANIZATION</option>
                          <option value="item">THING / ITEM</option>
                          <option value="lore">FACT / LORE</option>
                          <option value="bestiary">BESTIARY</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Content</label>
                        <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write thoughts..." className="bg-background min-h-[100px] text-sm font-serif rounded-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Attach Images</label>
                        <Input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            try {
                              const compressed = await Promise.all(files.map(f => compressImage(f, 600, 600)));
                              setNoteImages(prev => [...prev, ...compressed]);
                            } catch (err) {
                              toast.error("Failed to load/compress note images.");
                            }
                          }}
                          className="bg-background text-sm rounded-none h-8 text-xs file:bg-primary file:text-primary-foreground file:border-0 file:px-2 file:py-1 file:cursor-pointer"
                        />
                        {noteImages.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {noteImages.map((img, idx) => (
                              <div key={idx} className="relative w-10 h-10 border border-border rounded overflow-hidden group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setNoteImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] hover:bg-destructive/80"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
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
                    {["all", "general", "npc", "organization", "location", "item", "lore", "bestiary"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border transition-all rounded-none cursor-pointer ${
                          noteCategoryFilter === cat 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        {cat === "all" ? "All" : cat === "npc" ? "People" : cat === "organization" ? "Orgs" : cat === "location" ? "Places" : cat === "item" ? "Things" : cat === "lore" ? "Facts" : cat === "bestiary" ? "Bestiary" : "Gen"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[460px]">
                  {filteredNotes && filteredNotes.length > 0 ? (
                    filteredNotes.map(note => (
                      <Card key={note.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all relative group rounded-md">
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer" onClick={() => deleteNote.mutate({ id: note.id, charId: id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-serif text-lg font-bold text-primary">{note.title}</h4>
                              <Badge variant="outline" className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1 border-border/50 rounded-md bg-background/50">
                                {note.category === "npc" ? "👤 Person / NPC" : note.category === "location" ? "📍 Place / Location" : note.category === "item" ? "📦 Thing / Item" : note.category === "lore" ? "📜 Fact / Lore" : note.category === "bestiary" ? "🐉 Bestiary" : "📝 General"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          {note.images && note.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 border-t border-border/20 pt-3">
                              {note.images.map((imgUrl, imgIdx) => (
                                <div 
                                  key={imgIdx} 
                                  onClick={() => {
                                    setLightboxImage(imgUrl);
                                    setIsLightboxOpen(true);
                                  }}
                                  className="relative w-16 h-16 border border-border/40 rounded overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-background"
                                >
                                  <img src={imgUrl} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
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
            
            {/* If no familiar exists or user clicked 'Add', render binding creation card */}
            {isAddingFamiliar || !character.familiars || character.familiars.length === 0 ? (
              <Card className="bg-card border-border/50 rounded-md max-w-3xl mx-auto shadow-md">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-border/30 pb-3">
                    <div>
                      <h3 className="font-serif text-2xl text-primary font-bold">Add Familiar</h3>
                      <p className="text-xs text-muted-foreground mt-1">Familiars share your adventure and can execute actions and attacks directly from your Hotbar.</p>
                    </div>
                    {character.familiars && character.familiars.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingFamiliar(false)} className="rounded-md">Cancel</Button>
                    )}
                  </div>

                  <form onSubmit={handleBindFamiliar} className="space-y-4 text-xs">
                    
                    {/* Basic specs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Familiar Name</label>
                        <Input value={famName} onChange={e => setFamName(e.target.value)} required placeholder="e.g. Rocky, Hedwig" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Species / Race</label>
                        <Input value={famRace} onChange={e => setFamRace(e.target.value)} placeholder="e.g. Golem, Aviary" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Rank</label>
                        <select 
                          value={famClassName} 
                          onChange={e => setFamClassName(e.target.value)} 
                          className="w-full h-8 bg-background border border-input rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="Iron">Iron</option>
                          <option value="Bronze">Bronze</option>
                          <option value="Silver">Silver</option>
                          <option value="Gold">Gold</option>
                          <option value="Diamond">Diamond</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                        <Input type="number" min={5} step={5} value={famSpeed} onChange={e => setFamSpeed(Number(e.target.value))} required className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                    </div>

                    {/* Resistances & Immunities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/20 pt-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Resistances</label>
                        <Input value={famResistances} onChange={e => setFamResistances(e.target.value)} placeholder="e.g. Fire, Slashing" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Immunities</label>
                        <Input value={famImmunities} onChange={e => setFamImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                    </div>

                    {/* Derived Formulas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/20 pt-4">
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">HP Math Formula</label>
                        <Input value={famHpFormula} onChange={e => setFamHpFormula(e.target.value)} placeholder="e.g. Vitality * 8" className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">Mana Math Formula</label>
                        <Input value={famManaFormula} onChange={e => setFamManaFormula(e.target.value)} placeholder="e.g. Spirit * 5" className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">DT Math Formula</label>
                        <Input value={famDtFormula} onChange={e => setFamDtFormula(e.target.value)} placeholder="e.g. Endurance * 1" className="bg-background rounded-md h-8 text-sm font-mono" />
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
                          <div key={stat.label} className="bg-background/40 p-2 border border-border/30 text-center rounded-md">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{stat.label}</label>
                            <Input 
                              type="number" min={0} max={30} value={stat.val} 
                              onChange={e => stat.set(Math.min(30, Math.max(0, Number(e.target.value))))} 
                              className="text-center font-mono h-7 bg-background rounded-md text-xs" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/20">
                      <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-md cursor-pointer">Add Familiar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (
              
              // Familiar display sheets
              <div className="space-y-6">
                
                {/* Toolbar */}
                <div className="flex justify-between items-center border-b border-border/20 pb-3">
                  <h3 className="font-serif text-2xl text-primary font-bold">Familiars ({character.familiars.length})</h3>
                  <Button onClick={() => setIsAddingFamiliar(true)} className="bg-primary text-primary-foreground font-serif rounded-md cursor-pointer">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Familiar
                  </Button>
                </div>

                {/* Grid List of Familiars */}
                <div className="grid grid-cols-1 gap-6">
                  {character.familiars.map(fam => {
                    const fMax = getFamiliarMaxValues(fam);
                    const isExpanded = expandedFamiliars[fam.id] ?? false;
                    const flash = famDtFlashes[fam.id] ?? null;
                    const dmgRes = famDamageResults[fam.id] ?? null;
                    const inputs = famInputs[fam.id] || {};
                    const isAddingAb = isAddingFamAbility[fam.id] ?? false;

                    return (
                      <Card key={fam.id} className="bg-card border border-border/40 shadow-md rounded-md p-5 space-y-4">
                        
                        {/* Title Banner */}
                        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/20 pb-3">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Familiar Avatar Portrait Upload */}
                            <div className="relative group w-14 h-14 rounded-full overflow-hidden border border-border/60 bg-background flex-shrink-0 flex items-center justify-center cursor-pointer">
                              {fam.avatar ? (
                                <img src={fam.avatar} alt={fam.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-muted-foreground text-xs font-bold uppercase">{fam.name.substring(0, 2)}</span>
                              )}
                              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold cursor-pointer">
                                Change
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const dataUrl = await compressImage(file, 200, 200);
                                        updateFamiliarData(fam.id, { ...fam, avatar: dataUrl });
                                        toast.success("Familiar portrait updated!");
                                      } catch (err) {
                                        toast.error("Failed to upload/compress image.");
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-serif text-xl text-primary font-bold truncate">{fam.name}</h4>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1 truncate">
                                {fam.race} · {fam.className} · {fam.speed} ft
                              </p>
                            {(fam.resistances || fam.immunities) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans mt-2">
                                {fam.resistances && (
                                  <span>
                                    <strong className="text-foreground uppercase tracking-wider text-[10px]">Resistances:</strong> {fam.resistances}
                                  </span>
                                )}
                                {fam.immunities && (
                                  <span>
                                    <strong className="text-foreground uppercase tracking-wider text-[10px]">Immunities:</strong> {fam.immunities}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                          
                          <div className="flex items-center gap-2">
                            <EditFamiliarDialog familiar={fam} onSave={(updated) => updateFamiliarData(fam.id, updated)} />
                            <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer h-8 text-xs font-bold" 
                              onClick={() => handleReleaseFamiliarClick(fam.id)}>
                              Release Familiar
                            </Button>
                          </div>
                        </div>

                        {/* Resource HUD Columns (DT, HP, Mana) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* 1. DT (Damage Threshold) */}
                          <div className={`rounded-md border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 bg-background/20 ${
                            flash === "hit" ? "border-destructive/70 bg-destructive/10"
                            : flash === "restore" ? "border-primary/70 bg-primary/10"
                            : "border-border/40"
                          }`}>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Shield className="w-4 h-4 text-yellow-500" /> Familiar DT
                            </div>
                            <div className="text-center py-1">
                              <span className={`text-4xl font-mono font-bold ${flash === "hit" ? "text-destructive" : "text-foreground"}`}>
                                {fam.currentDt}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxDt}</span>
                            </div>
                            <ResourceBar current={fam.currentDt} max={fMax.maxDt} color="#eab308" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtAdd || ""} placeholder="Add val"
                                  onChange={e => updateFamInput(fam.id, "dtAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtAdd(fam)} disabled={!inputs.dtAdd}>
                                  Add
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtRemove || ""} placeholder="DMG Val"
                                  onChange={e => { updateFamInput(fam.id, "dtRemove", e.target.value); setFamDamageResults(prev => ({ ...prev, [fam.id]: null })); }}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtRemove(fam)} disabled={!inputs.dtRemove}>
                                  Hit
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "dtBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtBuff(fam)} disabled={!inputs.dtBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamRestoreDt(fam)}>
                                Full Restore DT
                              </Button>
                              {/* Fixed Height Container to prevent layout shifts */}
                              <div className="h-4 flex items-center justify-center mt-1">
                                {dmgRes && (
                                  <p className={`text-[10px] font-mono text-center ${dmgRes.absorbed ? "text-primary" : "text-destructive"}`}>
                                    {dmgRes.absorbed ? "✦ Absorbed" : dmgRes.hpLost > 0 ? `−${dmgRes.hpLost} HP` : "DT hit"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. HP (Health) */}
                          <div className="rounded-md border border-border/40 p-3 flex flex-col justify-between gap-3 bg-background/20">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Heart className="w-4 h-4 text-destructive" /> Familiar HP
                            </div>
                            <div className="text-center py-1">
                              <span className="text-4xl font-mono font-bold text-foreground">
                                {fam.currentHp}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxHp}</span>
                            </div>
                            <ResourceBar current={fam.currentHp} max={fMax.maxHp} color="hsl(var(--destructive))" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpAdd || ""} placeholder="Heal val"
                                  onChange={e => updateFamInput(fam.id, "hpAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpAdd(fam)} disabled={!inputs.hpAdd}>
                                  Heal
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpRemove || ""} placeholder="Dmg val"
                                  onChange={e => updateFamInput(fam.id, "hpRemove", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpRemove(fam)} disabled={!inputs.hpRemove}>
                                  Dmg
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "hpBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpBuff(fam)} disabled={!inputs.hpBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamFullRestoreHp(fam)}>
                                Full Restore HP
                              </Button>
                              {/* Fixed Height placeholder to match DT layout height */}
                              <div className="h-4 mt-1" />
                            </div>
                          </div>

                          {/* 3. Mana (MP) */}
                          <div className="rounded-md border border-border/40 p-3 flex flex-col justify-between gap-3 bg-background/20">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Sparkles className="w-4 h-4 text-blue-400" /> Familiar Mana
                            </div>
                            <div className="text-center py-1">
                              <span className="text-4xl font-mono font-bold text-foreground">
                                {fam.currentMana}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxMana}</span>
                            </div>
                            <ResourceBar current={fam.currentMana} max={fMax.maxMana} color="#3b82f6" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaAdd || ""} placeholder="Add val"
                                  onChange={e => updateFamInput(fam.id, "manaAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaAdd(fam)} disabled={!inputs.manaAdd}>
                                  Add
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaRemove || ""} placeholder="Use val"
                                  onChange={e => updateFamInput(fam.id, "manaRemove", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaRemove(fam)} disabled={!inputs.manaRemove}>
                                  Use
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "manaBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaBuff(fam)} disabled={!inputs.manaBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamFullRestoreMana(fam)}>
                                Full Restore Mana
                              </Button>
                              {/* Fixed Height placeholder to match DT layout height */}
                              <div className="h-4 mt-1" />
                            </div>
                          </div>

                        </div>

                        {/* Companion Attributes */}
                        <div className="space-y-2 pt-2 border-t border-border/20">
                          <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Attributes (Click to Roll)</h5>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {STATS.map(stat => {
                              const val = (fam as any)[stat.key] as number;
                              const mod = Math.floor((Number(val) || 0) / 3);
                              return (
                                <button
                                  type="button"
                                  key={stat.key}
                                  onClick={() => handleFamiliarStatRoll(fam.id, stat.key, stat.label, val)}
                                  className="rounded-md border border-border/30 bg-card/60 p-2 text-center hover:border-primary transition-all cursor-pointer"
                                >
                                  <div className="text-[9px] font-bold text-muted-foreground uppercase">{stat.label}</div>
                                  <div className="text-xl font-serif text-foreground font-bold mt-0.5">{val}</div>
                                  <div className="text-[10px] font-mono text-primary">+{mod}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Collapsible Abilities Drawer */}
                        <div className="pt-2 border-t border-border/20 space-y-3">
                          <div className="flex justify-between items-center">
                            <button
                              type="button"
                              onClick={() => setExpandedFamiliars(prev => ({ ...prev, [fam.id]: !isExpanded }))}
                              className="text-[11px] font-bold text-primary hover:text-primary-foreground hover:bg-primary/10 border border-primary/20 px-3 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              {isExpanded ? "Hide Abilities & Actions" : "Show Abilities & Actions"}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                              
                              <div className="flex justify-between items-center border-b border-border/20 pb-1">
                                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Attacks & Actions</h5>
                                <Button 
                                  size="sm" 
                                  className="bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 h-6 text-[10px] rounded-none cursor-pointer"
                                  onClick={() => setIsAddingFamAbility(prev => ({ ...prev, [fam.id]: !isAddingAb }))}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Add Action
                                </Button>
                              </div>

                              {/* Add/Edit Action Form inside expansion */}
                              {isAddingAb && (
                                <Card className="bg-background border border-primary/20 rounded-none">
                                  <CardContent className="p-4 space-y-4">
                                    <h5 className="font-serif text-sm text-primary font-bold">
                                      {editingFamAbilityId ? `Edit Action for ${fam.name}` : `Shape Action / Spell for ${fam.name}`}
                                    </h5>
                                    <form 
                                      onSubmit={(e) => {
                                        if (editingFamAbilityId) {
                                          handleUpdateFamAbility(fam.id, editingFamAbilityId.abilityId);
                                        } else {
                                          handleCreateFamAbility(fam.id, e);
                                        }
                                      }} 
                                      className="space-y-4 text-xs font-sans"
                                    >
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                                          <Input value={famAbilityName} onChange={e => setFamAbilityName(e.target.value)} required placeholder="e.g. Bite, Fire Spit" className="bg-background rounded-none h-8 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Type</label>
                                          <select 
                                            value={famAbilityType} 
                                            onChange={e => setFamAbilityType(e.target.value)} 
                                            className="w-full h-8 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                          >
                                            <option value="">None</option>
                                            <option value="Attack">Attack</option>
                                            <option value="Buff">Buff</option>
                                            <option value="Debuff">Debuff</option>
                                            <option value="Defense">Defense</option>
                                            <option value="Movement">Movement</option>
                                            <option value="Utility">Utility</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Linked Attributes checkboxes */}
                                      <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
                                        <div className="grid grid-cols-4 gap-2">
                                          {["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"].map(stat => {
                                            const isChecked = famAbilityLinkedStats.includes(stat);
                                            return (
                                              <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                                                <Checkbox 
                                                  id={`fam_link_${stat}`} 
                                                  checked={isChecked} 
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      setFamAbilityLinkedStats([...famAbilityLinkedStats, stat]);
                                                    } else {
                                                      setFamAbilityLinkedStats(famAbilityLinkedStats.filter(s => s !== stat));
                                                    }
                                                  }} 
                                                />
                                                <label htmlFor={`fam_link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
                                                  {stat.substring(0, 3)}
                                                </label>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-4 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost</label>
                                          <Input type="number" min={0} value={famAbilityCost} onChange={e => setFamAbilityCost(Number(e.target.value))} required className="bg-background font-mono rounded-none h-8 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown (sec)</label>
                                          <Input type="number" min={0} value={famAbilityCooldown} onChange={e => setFamAbilityCooldown(Number(e.target.value))} required className="bg-background font-mono rounded-none h-8 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                                          <Input value={famAbilityRange} onChange={e => setFamAbilityRange(e.target.value)} placeholder="e.g. Melee, 30ft" className="bg-background rounded-none h-8 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                                          <Input value={famAbilitySpeed} onChange={e => setFamAbilitySpeed(e.target.value)} placeholder="e.g. Standard, Instant" className="bg-background rounded-none h-8 text-xs" />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Modifier (Optional)</label>
                                        <Input value={famAbilityFormula} onChange={e => setFamAbilityFormula(e.target.value)} placeholder="e.g. d20+powr+6, 2d6+prer" className="bg-background font-mono rounded-none h-8 text-xs" />
                                      </div>

                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances (Granted while active)</label>
                                          <Input value={famAbilityResistances} onChange={e => setFamAbilityResistances(e.target.value)} placeholder="e.g. Fire, Piercing" className="bg-background rounded-none h-8 text-xs" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities (Granted while active)</label>
                                          <Input value={famAbilityImmunities} onChange={e => setFamAbilityImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-none h-8 text-xs" />
                                        </div>
                                      </div>

                                      {/* Description textarea */}
                                      <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Effects</label>
                                        <Textarea value={famAbilityDesc} onChange={e => setFamAbilityDesc(e.target.value)} placeholder="Describe the effects..." className="bg-background rounded-none font-serif text-sm min-h-[60px]" />
                                      </div>

                                      {/* Stat Modifiers */}
                                      <div className="border-t border-border/20 pt-3 space-y-2">
                                        <h5 className="font-serif font-bold text-primary text-xs">Stat Modifiers (Granted while active)</h5>
                                        <div className="grid grid-cols-4 gap-2">
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Power</label>
                                            <Input type="number" value={famAbilityBonusPower} onChange={e => setFamAbilityBonusPower(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Vitality</label>
                                            <Input type="number" value={famAbilityBonusVitality} onChange={e => setFamAbilityBonusVitality(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Spirit</label>
                                            <Input type="number" value={famAbilityBonusSpirit} onChange={e => setFamAbilityBonusSpirit(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Agility</label>
                                            <Input type="number" value={famAbilityBonusAgility} onChange={e => setFamAbilityBonusAgility(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Endurance</label>
                                            <Input type="number" value={famAbilityBonusEndurance} onChange={e => setFamAbilityBonusEndurance(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Precision</label>
                                            <Input type="number" value={famAbilityBonusPrecision} onChange={e => setFamAbilityBonusPrecision(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Willpower</label>
                                            <Input type="number" value={famAbilityBonusWillpower} onChange={e => setFamAbilityBonusWillpower(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                          <div>
                                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Charisma</label>
                                            <Input type="number" value={famAbilityBonusCharisma} onChange={e => setFamAbilityBonusCharisma(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none" />
                                          </div>
                                        </div>
                                      </div>

                                      {/* Vitals Modifiers Grid */}
                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">HP Mod</label>
                                          <Input value={famAbilityBonusHp} onChange={e => setFamAbilityBonusHp(e.target.value)} placeholder="e.g. +5" className="bg-background font-mono h-7 text-xs rounded-none" />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Mana Mod</label>
                                          <Input value={famAbilityBonusMana} onChange={e => setFamAbilityBonusMana(e.target.value)} placeholder="e.g. +10" className="bg-background font-mono h-7 text-xs rounded-none" />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">DT Mod</label>
                                          <Input value={famAbilityBonusDt} onChange={e => setFamAbilityBonusDt(e.target.value)} placeholder="e.g. +1" className="bg-background font-mono h-7 text-xs rounded-none" />
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 pt-1">
                                        <Checkbox 
                                          id="fam_quick_roll" 
                                          checked={famAbilityAssignedToQuickRolls} 
                                          onCheckedChange={(checked) => setFamAbilityAssignedToQuickRolls(!!checked)} 
                                        />
                                        <label htmlFor="fam_quick_roll" className="font-bold text-[10px] text-muted-foreground uppercase cursor-pointer">
                                          Assign to Quick Rolls HUD
                                        </label>
                                      </div>

                                      <div className="flex justify-end gap-2 border-t border-border/30 pt-3">
                                        <Button type="button" variant="ghost" onClick={() => resetFamAbilityForm(fam.id)} className="rounded-none">Cancel</Button>
                                        <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                                          {editingFamAbilityId ? "Save Action" : "Shape Action"}
                                        </Button>
                                      </div>
                                    </form>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Action items list */}
                              {fam.abilities && fam.abilities.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {fam.abilities.map((ab, idx) => (
                                    <Card 
                                      key={ab.id} 
                                      draggable={true}
                                      onDragStart={(e) => handleFamAbDragStart(e, idx)}
                                      onDragOver={handleFamAbDragOver}
                                      onDrop={(e) => handleFamAbDrop(e, fam, idx)}
                                      className="bg-background border border-border/30 rounded-none relative group cursor-grab active:cursor-grabbing"
                                    >
                                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 rounded-none cursor-pointer" onClick={() => handleEditFamAbilityStart(fam.id, ab)}>
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer" onClick={() => handleDeleteFamAbility(fam.id, ab.id)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      <CardContent className="p-3.5 space-y-2">
                                        <div className="flex justify-between items-start pr-12 flex-wrap gap-2">
                                          <div>
                                            <h6 className="font-serif text-sm font-bold text-primary flex items-center gap-1.5 flex-wrap">
                                              {ab.name}
                                              {ab.type && (
                                                <Badge className="bg-primary/10 border border-primary/30 text-primary text-[8px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5">
                                                  {ab.type}
                                                </Badge>
                                              )}
                                            </h6>
                                            <div className="flex gap-1.5 mt-1 flex-wrap">
                                              <Badge variant="outline" className="text-[8px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{ab.cost} MP</Badge>
                                              {ab.cooldown ? <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.cooldown}s CD</Badge> : null}
                                              <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.range}</Badge>
                                              <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.speed}</Badge>
                                              {ab.rollFormula && <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">Formula: {ab.rollFormula}</Badge>}
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => handleFamiliarAbilityRoll(fam, ab)}
                                            className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 h-6 font-serif text-[10px] rounded-none cursor-pointer"
                                          >
                                            Execute
                                          </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground/80 font-serif leading-relaxed mt-1.5 whitespace-pre-wrap">{ab.description}</p>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/50 italic font-serif text-center py-2">No unique actions configured for {fam.name}.</p>
                              )}
                            </div>
                          )}
                        </div>

                      </Card>
                    );
                  })}
                </div>

              </div>
            )}

          </div>
        )}

        {/* TAB 8: COMBAT TRACKER */}
        {activeTab === "combat" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-border/20 pb-3 flex-wrap gap-4">
              <div>
                <h3 className="font-serif text-2xl text-primary font-bold">Combat Tracker</h3>
                <p className="text-xs text-muted-foreground mt-1">Track turn initiatives, active statuses, and order of combatants.</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setCombatants([]);
                    setCurrentTurnIdx(0);
                    toast.success("Combat cleared.");
                  }}
                  className="rounded-md border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Clear Tracker
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    if (combatants.length === 0) return;
                    setCurrentTurnIdx(prev => (prev + 1) % combatants.length);
                  }}
                  disabled={combatants.length === 0}
                  className="bg-primary text-primary-foreground font-serif rounded-md"
                >
                  Next Turn →
                </Button>
              </div>
            </div>

            {/* Import options & Form row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Form & Imports Column */}
              <div className="space-y-4 lg:col-span-1">
                <Card className="bg-card border-border/50 rounded-md p-4 space-y-4 shadow-sm">
                  <h4 className="font-serif text-sm font-bold text-primary uppercase tracking-widest border-b border-border/30 pb-2">Add Combatants</h4>
                  
                  {/* Quick Imports */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block">Quick Import</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          const existing = combatants.find(c => c.name === character.name);
                          if (existing) {
                            toast.error(`${character.name} already in combat.`);
                            return;
                          }
                          const newC: Combatant = {
                            id: `pc-${character.id}-${Date.now()}`,
                            name: character.name,
                            initiative: 10 + (autoModifiers.agility || 0),
                            statuses: []
                          };
                          setCombatants(prev => [...prev, newC].sort((a, b) => b.initiative - a.initiative));
                          toast.success(`Imported ${character.name}!`);
                        }}
                        className="text-[10px] py-1 h-7 border-primary/40 text-primary hover:bg-primary/5 rounded"
                      >
                        + Import {character.name} (PC)
                      </Button>

                      {character.familiars && character.familiars.map(fam => (
                        <Button
                          key={fam.id}
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            const newC: Combatant = {
                              id: `fam-${fam.id}-${Date.now()}`,
                              name: fam.name,
                              initiative: 10 + Math.floor((Number(fam.agility) || 0) / 3),
                              statuses: []
                            };
                            setCombatants(prev => [...prev, newC].sort((a, b) => b.initiative - a.initiative));
                            toast.success(`Imported familiar ${fam.name}!`);
                          }}
                          className="text-[10px] py-1 h-7 border-primary/40 text-primary hover:bg-primary/5 rounded"
                        >
                          + Import {fam.name}
                        </Button>
                      ))}
                    </div>

                    {/* Notes Bestiary Import Selector */}
                    {notes.filter(n => n.category === "bestiary").length > 0 && (
                      <div className="pt-2 border-t border-border/20 mt-2 space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block">Import from Bestiary</label>
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                          {notes.filter(n => n.category === "bestiary").map(note => (
                            <button
                              key={note.id}
                              type="button"
                              onClick={() => {
                                const newC: Combatant = {
                                  id: `bestiary-${note.id}-${Date.now()}`,
                                  name: note.title,
                                  initiative: 10,
                                  statuses: []
                                };
                                setCombatants(prev => [...prev, newC].sort((a, b) => b.initiative - a.initiative));
                                // Add to recents
                                setRecentCombatants(prev => {
                                  const filtered = prev.filter(r => r.name !== note.title);
                                  return [{ name: note.title, initiative: 10, statuses: [] }, ...filtered].slice(0, 10);
                                });
                                toast.success(`Imported ${note.title} from Bestiary!`);
                              }}
                              className="text-[9px] border border-border/60 bg-background/50 hover:border-primary/50 hover:bg-accent/40 px-2 py-1 rounded transition-all flex items-center gap-1 text-foreground"
                            >
                              🐉 {note.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Manual Creation Form */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const name = (form.elements.namedItem("cName") as HTMLInputElement).value.trim();
                      const init = parseInt((form.elements.namedItem("cInit") as HTMLInputElement).value) || 0;
                      if (!name) return;

                      const newC: Combatant = {
                        id: `manual-${Date.now()}`,
                        name,
                        initiative: init,
                        statuses: []
                      };
                      setCombatants(prev => [...prev, newC].sort((a, b) => b.initiative - a.initiative));
                      setRecentCombatants(prev => {
                        const filtered = prev.filter(r => r.name !== name);
                        return [{ name, initiative: init, statuses: [] }, ...filtered].slice(0, 10);
                      });
                      form.reset();
                      toast.success(`Added ${name} to combat.`);
                    }}
                    className="space-y-3 pt-3 border-t border-border/20 text-xs"
                  >
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-0.5">Manual Entry</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input name="cName" required placeholder="Name / Creature" className="bg-background h-8 text-xs rounded" />
                      </div>
                      <div>
                        <Input name="cInit" type="number" placeholder="Init" className="bg-background h-8 text-xs rounded text-center font-mono" />
                      </div>
                    </div>
                    <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-serif rounded h-8 text-xs">
                      + Add Combatant
                    </Button>
                  </form>
                </Card>

                {/* Recents Section */}
                {recentCombatants.length > 0 && (
                  <Card className="bg-card border-border/50 rounded-md p-4 space-y-2 shadow-sm">
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/20 pb-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" /> Recent Combatants
                    </h5>
                    <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                      {recentCombatants.map((recent, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            const newC: Combatant = {
                              id: `recent-${idx}-${Date.now()}`,
                              name: recent.name,
                              initiative: recent.initiative,
                              statuses: []
                            };
                            setCombatants(prev => [...prev, newC].sort((a, b) => b.initiative - a.initiative));
                            toast.success(`Added ${recent.name} from recents.`);
                          }}
                          className="text-[9px] border border-border/60 bg-background/50 hover:border-primary/50 px-2 py-1 rounded transition-all text-foreground"
                        >
                          {recent.name} ({recent.initiative})
                        </button>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              {/* Combat Timeline Column (2/3 width) */}
              <div className="lg:col-span-2 space-y-4">
                {combatants.length > 0 ? (
                  <div className="space-y-2.5">
                    {combatants.map((c, idx) => {
                      const isActive = idx === currentTurnIdx;
                      
                      const moveUp = (i: number) => {
                        if (i === 0) return;
                        setCombatants(prev => {
                          const copy = [...prev];
                          const temp = copy[i];
                          copy[i] = copy[i - 1];
                          copy[i - 1] = temp;
                          return copy;
                        });
                      };

                      const moveDown = (i: number) => {
                        if (i === combatants.length - 1) return;
                        setCombatants(prev => {
                          const copy = [...prev];
                          const temp = copy[i];
                          copy[i] = copy[i + 1];
                          copy[i + 1] = temp;
                          return copy;
                        });
                      };

                      const handleDragStart = (e: React.DragEvent) => {
                        e.dataTransfer.setData("text/plain", idx.toString());
                      };

                      const handleDrop = (e: React.DragEvent) => {
                        const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                        if (fromIdx !== idx) {
                          setCombatants(prev => {
                            const copy = [...prev];
                            const item = copy.splice(fromIdx, 1)[0];
                            copy.splice(idx, 0, item);
                            return copy;
                          });
                        }
                      };

                      return (
                        <Card 
                          key={c.id}
                          draggable
                          onDragStart={handleDragStart}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                          className={`bg-card border transition-all rounded-md overflow-hidden relative group cursor-grab active:cursor-grabbing ${
                            isActive 
                              ? "border-emerald-500 bg-emerald-500/[0.02] shadow-[0_0_12px_rgba(16,185,129,0.1)]" 
                              : "border-border/40 hover:border-primary/20"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 inset-y-0 w-1 bg-emerald-500" />
                          )}
                          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Turn indicator / index */}
                              <span className={`text-[10px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                                isActive ? "bg-emerald-500 text-black" : "bg-muted text-muted-foreground"
                              }`}>
                                {idx + 1}
                              </span>

                              {/* Drag Handle Icon for Desktop */}
                              <div className="hidden sm:flex flex-col gap-0.5 cursor-grab">
                                <span className="w-3.5 h-0.5 bg-muted-foreground/30" />
                                <span className="w-3.5 h-0.5 bg-muted-foreground/30" />
                                <span className="w-3.5 h-0.5 bg-muted-foreground/30" />
                              </div>

                              <div className="min-w-0">
                                <h5 className={`font-serif text-base font-bold ${isActive ? "text-emerald-400" : "text-foreground"}`}>
                                  {c.name}
                                </h5>
                                
                                {/* Statuses row */}
                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                  {c.statuses.map((status, sIdx) => (
                                    <Badge 
                                      key={sIdx} 
                                      variant="secondary" 
                                      onClick={() => {
                                        setCombatants(prev => prev.map(p => p.id === c.id ? { ...p, statuses: p.statuses.filter((_, i) => i !== sIdx) } : p));
                                        toast.success(`Removed status ${status}`);
                                      }}
                                      className="text-[9px] bg-destructive/10 text-destructive-foreground hover:bg-destructive/20 border-0 rounded cursor-pointer select-none flex items-center gap-1 font-semibold"
                                    >
                                      {status} <span className="text-[8px] opacity-60">&times;</span>
                                    </Badge>
                                  ))}
                                  
                                  {/* Add status form trigger */}
                                  <form 
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const input = e.currentTarget.elements.namedItem("newStatus") as HTMLInputElement;
                                      const val = input.value.trim();
                                      if (val) {
                                        setCombatants(prev => prev.map(p => p.id === c.id ? { ...p, statuses: [...p.statuses, val] } : p));
                                        input.value = "";
                                        toast.success(`Added status ${val} to ${c.name}`);
                                      }
                                    }}
                                    className="inline-flex items-center"
                                  >
                                    <Input
                                      name="newStatus"
                                      placeholder="+ status"
                                      className="h-5 text-[9px] w-14 bg-background/50 border-border/40 px-1 py-0.5 rounded font-medium focus-visible:w-20 transition-all focus-visible:outline-none"
                                    />
                                  </form>
                                </div>
                              </div>
                            </div>

                            {/* Initiative & Controls */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              <div className="text-right">
                                <div className="text-sm font-bold font-mono text-foreground leading-none">{c.initiative}</div>
                                <span className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Initiative</span>
                              </div>

                              {/* Mobile-friendly Up/Down sorting arrows */}
                              <div className="flex flex-col gap-0.5">
                                <button 
                                  onClick={() => moveUp(idx)} 
                                  disabled={idx === 0}
                                  className="p-0.5 bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed rounded cursor-pointer"
                                >
                                  <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
                                </button>
                                <button 
                                  onClick={() => moveDown(idx)} 
                                  disabled={idx === combatants.length - 1}
                                  className="p-0.5 bg-accent hover:bg-accent/80 disabled:opacity-40 disabled:cursor-not-allowed rounded cursor-pointer"
                                >
                                  <svg className="w-3 h-3 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                              </div>

                              {/* Remove button */}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setCombatants(prev => prev.filter(p => p.id !== c.id));
                                  toast.success(`Removed ${c.name} from combat.`);
                                }}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-card/30 border border-dashed border-border/40 rounded-md text-sm text-muted-foreground/60 italic font-serif">
                    No active combatants in timeline. Click Quick Import above or type a manual entry to start combat!
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Styled Delete Warning Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Permanently Delete Character?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Are you absolutely sure you want to delete <strong className="text-foreground">{character.name}</strong>? This action is irreversible and all stats, inventory, abilities, and bound companions will be permanently deleted.
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteOpen(false)} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => deleteChar.mutate({ id }, { onSuccess: () => setLocation("/") })} className="rounded-md font-bold">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Familiar Release Confirmation Dialog 1 */}
      <Dialog open={isReleaseConfirmOpen} onOpenChange={setIsReleaseConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Release Familiar?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to release this familiar from your service?
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => { setIsReleaseConfirmOpen(false); setReleasingFamId(null); }} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmFirstRelease} className="rounded-md font-bold">
              Yes, Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Familiar Release Confirmation Dialog 2 */}
      <Dialog open={isReleaseDoubleConfirmOpen} onOpenChange={setIsReleaseDoubleConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" /> Permanent Release Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Releasing this familiar is permanent and <strong className="text-foreground">cannot be undone</strong>. Are you absolutely certain you want to proceed?
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => { setIsReleaseDoubleConfirmOpen(false); setReleasingFamId(null); }} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmSecondRelease} className="rounded-md font-bold">
              Yes, Permanently Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Slider Dialog */}
      <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Discard {discardItem?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              How many of <strong className="text-foreground">{discardItem?.name}</strong> would you like to discard? (Current quantity: <span className="font-mono text-foreground font-bold">{discardItem?.quantity}</span>)
            </p>
            {discardItem && discardItem.quantity > 1 && (
              <div className="space-y-2">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span className="text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded">{discardCount}</span>
                  <span>{discardItem.quantity}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={discardItem.quantity}
                  value={discardCount}
                  onChange={(e) => setDiscardCount(Number(e.target.value))}
                  className="w-full accent-primary bg-background border border-border/60 rounded h-2 cursor-pointer"
                />
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-border/30 gap-3">
            <Button variant="destructive" size="sm" onClick={handleDiscardAll} className="rounded-md font-bold">
              Discard All Stack
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsDiscardOpen(false); setDiscardItem(null); }} className="rounded-md font-bold">
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmDiscard} className="rounded-md font-bold bg-primary text-primary-foreground">
                Discard {discardCount}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-4xl bg-black/95 border-none p-0 flex items-center justify-center overflow-hidden">
          {lightboxImage && (
            <img src={lightboxImage} className="max-h-[85vh] max-w-full object-contain" alt="Lightbox Preview" />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
