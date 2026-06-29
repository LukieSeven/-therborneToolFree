import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  storage,
  Character,
  Equipment,
  Currency,
  InventoryItem,
  Essence,
  Ability,
  Skill,
  Roll,
  Note,
  getAdjustedStats,
  SessionRecap,
} from "../lib/storage";

// ── Query Keys ────────────────────────────────────────────
export const getGetCharacterQueryKey = (id: number) => ["characters", id];
export const getListCharacterRollsQueryKey = (charId: number) => ["rolls", charId];
export const getListNotesQueryKey = (charId?: number) => ["notes", charId];
export const getListRecentRollsQueryKey = () => ["recent_rolls"];
export const getListEquipmentQueryKey = (charId: number) => ["equipment", charId];
export const getListCurrenciesQueryKey = (charId: number) => ["currencies", charId];
export const getListInventoryQueryKey = (charId: number) => ["inventory", charId];
export const getListEssencesQueryKey = (charId: number) => ["essences", charId];
export const getListAbilitiesQueryKey = (charId: number) => ["abilities", charId];
export const getListSkillsQueryKey = (charId: number) => ["skills", charId];
export const getListRecapsQueryKey = () => ["recaps"];

// ── Characters ────────────────────────────────────────────

export function useListCharacters() {
  return useQuery<Character[]>({
    queryKey: ["characters"],
    queryFn: () => storage.getCharacters(),
  });
}

export function useGetCharacter(id: number, options?: any) {
  return useQuery<Character | null>({
    queryKey: getGetCharacterQueryKey(id),
    queryFn: () => storage.getCharacter(id),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Character, "id" | "createdAt" | "updatedAt">) => {
      return Promise.resolve(storage.createCharacter(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">> }) => {
      return Promise.resolve(storage.updateCharacter(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.id) });
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => {
      storage.deleteCharacter(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useApplyDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { amount: number } }) => {
      const char = storage.getCharacter(id);
      if (!char) throw new Error("Character not found");
      
      const eq = storage.getEquipment(id);
      const ab = storage.getAbilities(id);
      const { maxDt } = getAdjustedStats(char, eq, ab);
      
      const { amount } = data;
      const dt = char.currentDt;
      
      let newDt = dt;
      let hpLost = 0;
      let dtDropped = false;
      let absorbed = false;
      
      if (amount >= dt) {
        newDt = Math.max(0, dt - 1);
        dtDropped = true;
        const overflow = amount - dt;
        hpLost = overflow;
      } else {
        absorbed = true;
      }
      
      // Calculate current HP (depletes temp/buff HP pool first naturally)
      const newHp = Math.max(0, char.currentHp - hpLost);
      
      const updated = storage.updateCharacter(id, {
        currentDt: newDt,
        currentHp: newHp,
      });

      // Write roll logs for historical reference
      storage.addRoll({
        characterId: id,
        diceType: "dt-log",
        result: absorbed ? 0 : -1,
        modifier: 0,
        total: absorbed ? 0 : -1,
        label: absorbed ? "DT: Damage Absorbed" : "DT Lost (Hit)",
        isCrit: false,
        critBonus: null,
      });

      if (hpLost > 0) {
        storage.addRoll({
          characterId: id,
          diceType: "hp-log",
          result: -hpLost,
          modifier: 0,
          total: -hpLost,
          label: "Health Lost (Hit)",
          isCrit: false,
          critBonus: null,
        });
      }
      
      return {
        dtDropped,
        hpLost,
        newDt,
        newHp,
        absorbed,
        maxDt,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: getListRecentRollsQueryKey() });
    },
  });
}

// ── Equipment ─────────────────────────────────────────────

export function useListEquipment(charId: number) {
  return useQuery<Equipment[]>({
    queryKey: getListEquipmentQueryKey(charId),
    queryFn: () => storage.getEquipment(charId),
    enabled: !!charId,
  });
}

export function useAddEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Equipment, "id">) => {
      return Promise.resolve(storage.addEquipment(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Equipment, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateEquipment(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteEquipment(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

// ── Currencies ────────────────────────────────────────────

export function useListCurrencies(charId: number) {
  return useQuery<Currency[]>({
    queryKey: getListCurrenciesQueryKey(charId),
    queryFn: () => storage.getCurrencies(charId),
    enabled: !!charId,
  });
}

export function useAddCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Currency, "id">) => {
      return Promise.resolve(storage.addCurrency(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(data.characterId) });
    },
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => {
      return Promise.resolve(storage.updateCurrency(id, amount));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteCurrency(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(charId) });
    },
  });
}

// ── General Inventory ─────────────────────────────────────

export function useListInventory(charId: number) {
  return useQuery<InventoryItem[]>({
    queryKey: getListInventoryQueryKey(charId),
    queryFn: () => storage.getInventory(charId),
    enabled: !!charId,
  });
}

export function useAddInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InventoryItem, "id">) => {
      return Promise.resolve(storage.addInventoryItem(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(data.characterId) });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<InventoryItem, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateInventoryItem(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(data.characterId) });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteInventoryItem(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(charId) });
    },
  });
}

// ── Essences ──────────────────────────────────────────────

export function useListEssences(charId: number) {
  return useQuery<Essence[]>({
    queryKey: getListEssencesQueryKey(charId),
    queryFn: () => storage.getEssences(charId),
    enabled: !!charId,
  });
}

export function useAddEssence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Essence, "id">) => {
      return Promise.resolve(storage.addEssence(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEssencesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteEssence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteEssence(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListEssencesQueryKey(charId) });
    },
  });
}

// ── Shaped Abilities ──────────────────────────────────────

export function useListAbilities(charId: number) {
  return useQuery<Ability[]>({
    queryKey: getListAbilitiesQueryKey(charId),
    queryFn: () => storage.getAbilities(charId),
    enabled: !!charId,
  });
}

export function useAddAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Ability, "id">) => {
      return Promise.resolve(storage.addAbility(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(data.characterId) });
    },
  });
}

export function useUpdateAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Ability, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateAbility(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteAbility(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(charId) });
    },
  });
}

// ── Skills ────────────────────────────────────────────────

export function useListSkills(charId: number) {
  return useQuery<Skill[]>({
    queryKey: getListSkillsQueryKey(charId),
    queryFn: () => storage.getSkills(charId),
    enabled: !!charId,
  });
}

export function useAddSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Skill, "id">) => {
      return Promise.resolve(storage.addSkill(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(data.characterId) });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Skill, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateSkill(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(data.characterId) });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteSkill(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(charId) });
    },
  });
}

// ── Notes ─────────────────────────────────────────────────

export function useListNotes(charId?: number) {
  return useQuery<Note[]>({
    queryKey: getListNotesQueryKey(charId),
    queryFn: () => storage.getNotes(charId),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Note, "id" | "createdAt" | "updatedAt">) => {
      return Promise.resolve(storage.addNote(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(data.characterId) });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Note, "id" | "characterId" | "createdAt" | "updatedAt">> }) => {
      return Promise.resolve(storage.updateNote(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId?: number }) => {
      storage.deleteNote(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(charId) });
    },
  });
}

// ── Rolls ─────────────────────────────────────────────────

export function useListCharacterRolls(charId: number, options?: any) {
  return useQuery<Roll[]>({
    queryKey: getListCharacterRollsQueryKey(charId),
    queryFn: () => storage.getRolls(charId),
    enabled: !!charId,
    ...options?.query,
  });
}

export function useListRecentRolls() {
  return useQuery<(Roll & { characterName: string })[]>({
    queryKey: getListRecentRollsQueryKey(),
    queryFn: () => storage.getRecentRolls(),
  });
}

export function useCreateRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: number;
      data: {
        diceType: string;
        modifier?: number;
        label?: string;
        statValue?: number;
        familiarId?: string | number;
      };
    }) => {
      const charId = data.id;
      const { diceType, modifier = 0, label, statValue, familiarId } = data.data;
      
      const char = storage.getCharacter(charId);
      if (!char) throw new Error("Character not found");

      let rollingEntity: any = char;
      let finalStats: Record<string, number> = {};

      if (familiarId !== undefined) {
        const fam = char.familiars?.find(f => f.id === familiarId);
        if (fam) {
          rollingEntity = fam;
          finalStats = {
            power: fam.power,
            vitality: fam.vitality,
            spirit: fam.spirit,
            agility: fam.agility,
            endurance: fam.endurance,
            precision: fam.precision,
            willpower: fam.willpower,
            charisma: fam.charisma
          };
        }
      } else {
        const equipment = storage.getEquipment(charId);
        const abilities = storage.getAbilities(charId);
        const adjusted = getAdjustedStats(char, equipment, abilities);
        rollingEntity = char;
        finalStats = adjusted.stats;
      }

      function dieForValue(v: number): number {
        if (v <= 4) return 4;
        if (v <= 6) return 6;
        if (v <= 8) return 8;
        if (v <= 10) return 10;
        if (v <= 12) return 12;
        return 20;
      }

      function getStatDiceSides(s: number): number[] {
        if (s <= 20) return [dieForValue(s)];
        return [20, ...getStatDiceSides(s - 20)];
      }

      function rollOnce(sides: number): { result: number; isCrit: boolean } {
        const rolled = Math.floor(Math.pow(Math.random(), 0.8) * sides) + 1;
        return { result: rolled, isCrit: rolled === sides };
      }

      const rollStatDice = (statVal: number): { total: number; desc: string; isCrit: boolean } => {
        const diceSides = getStatDiceSides(statVal);
        let sum = 0;
        const rolls: number[] = [];
        let crit = false;
        let remainingStat = statVal;
        for (const sides of diceSides) {
          const r = rollOnce(sides);
          const cappedResult = Math.min(r.result, remainingStat);
          sum += cappedResult;
          rolls.push(cappedResult);
          if (r.isCrit) crit = true;
          remainingStat -= sides;
        }
        const desc = diceSides.map((sides, i) => `d${sides}(${rolls[i]})`).join("+");
        return { total: sum, desc, isCrit: crit };
      };

      if (diceType === "hp-log" || diceType === "dt-log" || diceType === "mana-log") {
        const roll = storage.addRoll({
          characterId: charId,
          diceType,
          result: modifier,
          modifier: 0,
          total: modifier,
          label: label || "Vitals Update",
          isCrit: false,
          critBonus: null,
        });
        return Promise.resolve(roll);
      }

      let result = 0;
      let total = 0;
      let isCrit = false;
      let diceTypeStr = diceType;

      const hasStatPrefix = ["pow", "vit", "spi", "agi", "end", "pre", "wil", "cha"].some(p => diceType.toLowerCase().includes(p));
      const hasOperators = /[+\-*/]/.test(diceType);

      if (statValue === undefined && (hasStatPrefix || hasOperators)) {
        // Advanced Math/Stat-Based formula parser
        let expression = diceType.replace(/\s+/g, "").toLowerCase();
        let breakdown = diceType;

        // 1. If formula contains '=', strip any description on the left-hand side
        if (expression.includes("=")) {
          expression = expression.split("=").pop() || expression;
        }

        // 2. Replace multiplication symbols '×' and 'x' with standard asterisk '*'
        expression = expression.replace(/×/g, "*").replace(/x/g, "*");

        const statsKeys = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];
        const statPrefixes = ["pow", "vit", "spi", "agi", "end", "pre", "wil", "cha"];



        // A. Resolve rolled stats (e.g., wilr, willpowerr)
        for (let i = 0; i < statPrefixes.length; i++) {
          const prefix = statPrefixes[i];
          const statKey = statsKeys[i];
          
          const rolledFullPattern = `${statKey}r`;
          const rolledPrefixPattern = `${prefix}r`;
          
          const regexFull = new RegExp(rolledFullPattern, "g");
          const regexPrefix = new RegExp(rolledPrefixPattern, "g");
          
          if (regexFull.test(expression) || regexPrefix.test(expression)) {
            const statVal = (finalStats[statKey] !== undefined ? finalStats[statKey] : 10) as number;
            const statMod = Math.floor(statVal / 3);
            const { total: rolledSum, desc, isCrit: crit } = rollStatDice(statVal);
            if (crit) isCrit = true;
            
            const totalRolled = rolledSum + statMod;
            expression = expression.split(rolledFullPattern).join(String(totalRolled));
            expression = expression.split(rolledPrefixPattern).join(String(totalRolled));
            
            const critSuffix = crit ? "!" : "";
            const breakdownText = statMod !== 0 
              ? `${rolledSum}${critSuffix}+${statMod}`
              : `${rolledSum}${critSuffix}`;
            const regexFullInsensitive = new RegExp(rolledFullPattern, "gi");
            const regexPrefixInsensitive = new RegExp(rolledPrefixPattern, "gi");
            breakdown = breakdown.replace(regexFullInsensitive, breakdownText);
            breakdown = breakdown.replace(regexPrefixInsensitive, breakdownText);
          }
        }

        // B. Resolve base stats (e.g., wil, willpower)
        for (let i = 0; i < statPrefixes.length; i++) {
          const prefix = statPrefixes[i];
          const statKey = statsKeys[i];
          
          const regexFull = new RegExp(statKey, "g");
          const regexPrefix = new RegExp(prefix, "g");
          
          if (regexFull.test(expression) || regexPrefix.test(expression)) {
            const statVal = (finalStats[statKey] !== undefined ? finalStats[statKey] : 10) as number;
            
            expression = expression.split(statKey).join(String(statVal));
            expression = expression.split(prefix).join(String(statVal));
            
            const regexFullInsensitive = new RegExp(statKey, "gi");
            const regexPrefixInsensitive = new RegExp(prefix, "gi");
            breakdown = breakdown.replace(regexFullInsensitive, String(statVal));
            breakdown = breakdown.replace(regexPrefixInsensitive, String(statVal));
          }
        }

        // C. Resolve standard dice
        const diceRegex = /d(\d+)/gi;
        let match;
        while ((match = diceRegex.exec(expression)) !== null) {
          const sides = parseInt(match[1], 10);
          const r = rollOnce(sides);
          if (r.isCrit) isCrit = true;
          
          const critSuffix = r.isCrit ? "!" : "";
          const matchStr = match[0];
          expression = expression.replace(new RegExp(matchStr, "i"), String(r.result));
          breakdown = breakdown.replace(new RegExp(matchStr, "i"), `${r.result}${critSuffix}`);
        }

        // D. Evaluate expression
        let evaluated = 0;
        if (/^[0-9+\-*/().]+$/.test(expression)) {
          try {
            evaluated = new Function(`return (${expression})`)();
          } catch {
            evaluated = 0;
          }
        }
        result = Math.floor(evaluated);
        total = result + modifier;
        diceTypeStr = breakdown;
      } else if (statValue !== undefined) {
        const { total: rolledSum, desc, isCrit: crit } = rollStatDice(statValue);
        result = rolledSum;
        total = rolledSum + modifier;
        isCrit = crit;
        diceTypeStr = desc;
      } else {
        const sides = parseInt(diceTypeStr.replace("d", ""), 10) || 20;
        const r = rollOnce(sides);
        result = r.result;
        isCrit = r.isCrit;
        total = result + modifier;
      }

      const roll = storage.addRoll({
        characterId: charId,
        diceType: diceTypeStr,
        result,
        modifier,
        total,
        label: label || null,
        isCrit,
        critBonus: null,
      });

      return Promise.resolve(roll);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getListRecentRollsQueryKey() });
    },
  });
}

// ── Session Recaps ────────────────────────────────────────

export function useListRecaps() {
  return useQuery<SessionRecap[]>({
    queryKey: getListRecapsQueryKey(),
    queryFn: () => storage.getRecaps(),
  });
}

export function useCreateRecap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string }) => {
      return Promise.resolve(storage.createRecap(data.title, data.content));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRecapsQueryKey() });
    },
  });
}

export function useDeleteRecap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => {
      storage.deleteRecap(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRecapsQueryKey() });
    },
  });
}
