import React, { useState, useEffect } from "react";
import {
  useAddEquipment, useUpdateEquipment,
  useAddCurrency, useUpdateCurrency,
  useAddInventoryItem, useUpdateInventoryItem
} from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  characterId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  type: "currency" | "equipment" | "item";
  initialData?: any;
}

const STATS_LIST = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditInventoryDialog({ characterId, isOpen, onOpenChange, mode, type, initialData }: Props) {
  // Mutations
  const addEquipment = useAddEquipment();
  const updateEquipment = useUpdateEquipment();
  const addCurrency = useAddCurrency();
  const updateCurrency = useUpdateCurrency();
  const addInventoryItem = useAddInventoryItem();
  const updateInventoryItem = useUpdateInventoryItem();

  // General Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Currency State
  const [amount, setAmount] = useState(0);

  // Item State
  const [quantity, setQuantity] = useState(1);

  // Equipment State
  const [dtBonus, setDtBonus] = useState(0);
  const [diceType, setDiceType] = useState("");
  const [modifier, setModifier] = useState("");
  const [equipped, setEquipped] = useState(false);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  
  // Stat Modifiers for equipment: key-value map
  const [statModifiers, setStatModifiers] = useState<Record<string, number>>({});

  // Sync state when dialog opens or edits
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setAmount(initialData.amount || 0);
        setQuantity(initialData.quantity || 1);
        setDtBonus(initialData.dtBonus || 0);
        setDiceType(initialData.diceType || "");
        setModifier(initialData.modifier !== undefined ? String(initialData.modifier) : "");
        setEquipped(!!initialData.equipped);
        setAssignedToQuickRolls(!!initialData.assignedToQuickRolls);
        setStatModifiers(initialData.statModifiers || {});
      } else {
        // Reset to defaults for add mode
        setName("");
        setDescription("");
        setAmount(0);
        setQuantity(1);
        setDtBonus(0);
        setDiceType("");
        setModifier("");
        setEquipped(false);
        setAssignedToQuickRolls(false);
        setStatModifiers({});
      }
    }
  }, [isOpen, mode, type, initialData]);

  const handleStatModifierChange = (stat: string, val: number) => {
    setStatModifiers(prev => {
      const next = { ...prev };
      if (val === 0) {
        delete next[stat];
      } else {
        next[stat] = val;
      }
      return next;
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (type === "currency") {
      if (mode === "add") {
        addCurrency.mutate({ characterId, name, amount }, { onSuccess: () => onOpenChange(false) });
      } else if (mode === "edit" && initialData) {
        updateCurrency.mutate({ id: initialData.id, amount }, { onSuccess: () => onOpenChange(false) });
      }
    } else if (type === "item") {
      if (mode === "add") {
        addInventoryItem.mutate({ characterId, name, description, quantity }, { onSuccess: () => onOpenChange(false) });
      } else if (mode === "edit" && initialData) {
        updateInventoryItem.mutate({ id: initialData.id, data: { name, description, quantity } }, { onSuccess: () => onOpenChange(false) });
      }
    } else if (type === "equipment") {
      if (mode === "add") {
        addEquipment.mutate({
          characterId,
          name,
          description,
          equipped,
          assignedToQuickRolls,
          dtBonus,
          statModifiers,
          diceType: diceType || undefined,
          modifier: diceType ? modifier : "",
        }, { onSuccess: () => onOpenChange(false) });
      } else if (mode === "edit" && initialData) {
        updateEquipment.mutate({
          id: initialData.id,
          data: {
            name,
            description,
            equipped,
            assignedToQuickRolls,
            dtBonus,
            statModifiers,
            diceType: diceType || undefined,
            modifier: diceType ? modifier : "",
          },
        }, { onSuccess: () => onOpenChange(false) });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader className="border-b border-border/30 pb-2">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {mode === "add" ? `Add ${type.toUpperCase()}` : `Edit ${type.toUpperCase()}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-4 text-sm font-sans">
          
          {/* Common name input */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={type === "currency" ? "Gold, Silver, etc." : "Item name"}
              required 
              disabled={mode === "edit" && type === "currency"} // Block renaming currency on edit
              className="bg-background" 
            />
          </div>

          {/* Currency specific fields */}
          {type === "currency" && (
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Amount</label>
              <Input type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
          )}

          {/* General item specific fields */}
          {type === "item" && (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Quantity</label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} required className="bg-background font-mono" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Item details..." className="bg-background font-serif" />
              </div>
            </>
          )}

          {/* Equipment specific fields */}
          {type === "equipment" && (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Armor, weapon, or accessory details..." className="bg-background font-serif" />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">DT Bonus (Armor protection)</label>
                  <Input type="number" min={0} value={dtBonus} onChange={e => setDtBonus(Number(e.target.value))} required className="bg-background font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Weapon Damage Die (e.g. d8)</label>
                  <Input value={diceType} onChange={e => setDiceType(e.target.value)} placeholder="e.g. d8, d10 (optional)" className="bg-background font-mono" />
                </div>
              </div>

              {diceType && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Weapon Modifier (e.g. +2, POWr+6, prer+2)</label>
                  <Input value={modifier} onChange={e => setModifier(e.target.value)} required className="bg-background font-mono" />
                </div>
              )}

              {/* Stat Modifiers section */}
              <div className="border-t border-border/30 pt-3">
                <label className="text-xs font-bold text-primary uppercase tracking-widest block mb-2">Stat Modifiers (Adds to character stats)</label>
                <div className="grid grid-cols-4 gap-2">
                  {STATS_LIST.map((stat) => {
                    const currentVal = statModifiers[stat] || 0;
                    return (
                      <div key={stat} className="bg-background/40 p-1.5 rounded border border-border/40 text-center">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{stat.substring(0,3)}</label>
                        <Input 
                          type="number" 
                          value={currentVal} 
                          onChange={(e) => handleStatModifierChange(stat, Number(e.target.value))} 
                          className="h-7 text-center font-mono bg-background text-xs" 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif">
              Save changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
