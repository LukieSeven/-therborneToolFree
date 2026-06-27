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
      const { maxDt } = getAdjustedStats(char, eq);
      
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
    mutationFn: (data: { id: number; data: { diceType: string; modifier?: number; label?: string; statValue?: number } }) => {
      const charId = data.id;
      const { diceType, modifier = 0, label, statValue } = data.data;
      
      const char = storage.getCharacter(charId);
      if (!char) throw new Error("Character not found");

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
        const rolled = Math.floor(Math.random() * sides) + 1;
        return { result: rolled, isCrit: rolled === sides };
      }

      let result = 0;
      let total = 0;
      let isCrit = false;
      let diceTypeStr = diceType;

      if (statValue !== undefined) {
        const diceSides = getStatDiceSides(statValue);
        diceTypeStr = diceSides.map(d => `d${d}`).join("+");
        let rollTotal = 0;
        for (const sides of diceSides) {
          const r = rollOnce(sides);
          rollTotal += r.result;
          if (r.isCrit) isCrit = true;
        }
        result = rollTotal;
        total = rollTotal + modifier;
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
