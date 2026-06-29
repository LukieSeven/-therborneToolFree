import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit2 } from "lucide-react";
import { Familiar, evaluateFormula } from "@/lib/storage";

interface EditFamiliarDialogProps {
  familiar: Familiar;
  onSave: (updated: Familiar) => void;
}

export function EditFamiliarDialog({ familiar, onSave }: EditFamiliarDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState(familiar.name);
  const [race, setRace] = useState(familiar.race);
  const [className, setClassName] = useState(familiar.className); // Rank
  const [speed, setSpeed] = useState(familiar.speed);
  const [level, setLevel] = useState(familiar.level || 1);

  // Attributes
  const [power, setPower] = useState(familiar.power);
  const [vitality, setVitality] = useState(familiar.vitality);
  const [spirit, setSpirit] = useState(familiar.spirit);
  const [agility, setAgility] = useState(familiar.agility);
  const [endurance, setEndurance] = useState(familiar.endurance);
  const [precision, setPrecision] = useState(familiar.precision);
  const [willpower, setWillpower] = useState(familiar.willpower);
  const [charisma, setCharisma] = useState(familiar.charisma);

  // Formulas
  const [hpFormula, setHpFormula] = useState(familiar.hpFormula || "Vitality * 8");
  const [manaFormula, setManaFormula] = useState(familiar.manaFormula || "Spirit * 5");
  const [dtFormula, setDtFormula] = useState(familiar.dtFormula || "Endurance * 1");

  // Resistances/Immunities
  const [resistances, setResistances] = useState(familiar.resistances || "");
  const [immunities, setImmunities] = useState(familiar.immunities || "");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Recalculate max resource values statically
    const vars = {
      power, pow: power,
      vitality, vit: vitality,
      spirit, spi: spirit,
      agility, agi: agility,
      endurance, end: endurance,
      precision, pre: precision,
      willpower, wil: willpower,
      charisma, cha: charisma,
      dtbonus: familiar.dtBonus || 0,
    };

    const calculatedMaxHp = Math.max(1, evaluateFormula(hpFormula, vars));
    const calculatedMaxMana = Math.max(0, evaluateFormula(manaFormula, vars));
    const calculatedMaxDt = Math.max(0, evaluateFormula(dtFormula, vars));

    // Clamp current values to new maximums
    const currentHp = Math.min(familiar.currentHp, calculatedMaxHp);
    const currentMana = Math.min(familiar.currentMana, calculatedMaxMana);
    const currentDt = Math.min(familiar.currentDt, calculatedMaxDt);

    const updated: Familiar = {
      ...familiar,
      name,
      race,
      className,
      speed,
      level,
      power,
      vitality,
      spirit,
      agility,
      endurance,
      precision,
      willpower,
      charisma,
      hpFormula,
      manaFormula,
      dtFormula,
      resistances,
      immunities,
      currentHp,
      currentMana,
      currentDt,
    };

    onSave(updated);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-primary/40 text-primary hover:bg-primary/10 rounded-md cursor-pointer text-xs font-bold font-serif">
          <Edit2 className="w-3 h-3 mr-1" /> Edit Stats
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
        <DialogHeader className="border-b border-border/20 pb-2">
          <DialogTitle className="font-serif text-lg text-primary font-bold">
            Edit Familiar Stats: {familiar.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans">
          {/* Base Info */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Familiar Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required className="bg-background" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Species / Race</label>
              <Input value={race} onChange={e => setRace(e.target.value)} required className="bg-background" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Familiar Rank</label>
              <select 
                value={className} 
                onChange={e => setClassName(e.target.value)} 
                className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Lesser">Lesser</option>
                <option value="Greater">Greater</option>
                <option value="Ascendant">Ascendant</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Level</label>
              <Input type="number" min={1} value={level} onChange={e => setLevel(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
              <Input type="number" min={0} value={speed} onChange={e => setSpeed(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
          </div>

          {/* Attributes Grid */}
          <div className="border-t border-border/20 pt-3">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 font-serif">Attributes</h4>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "POW", val: power, set: setPower },
                { label: "VIT", val: vitality, set: setVitality },
                { label: "SPI", val: spirit, set: setSpirit },
                { label: "AGI", val: agility, set: setAgility },
                { label: "END", val: endurance, set: setEndurance },
                { label: "PRE", val: precision, set: setPrecision },
                { label: "WIL", val: willpower, set: setWillpower },
                { label: "CHA", val: charisma, set: setCharisma },
              ].map(stat => (
                <div key={stat.label}>
                  <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">{stat.label}</label>
                  <Input 
                    type="number" 
                    min={0}
                    value={stat.val} 
                    onChange={e => stat.set(Number(e.target.value))} 
                    className="bg-background h-8 font-mono text-center" 
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Formulas Grid */}
          <div className="border-t border-border/20 pt-3 space-y-3">
            <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest font-serif">Resource Formulas</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">HP Formula</label>
                <Input value={hpFormula} onChange={e => setHpFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">Mana Formula</label>
                <Input value={manaFormula} onChange={e => setManaFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">DT Formula</label>
                <Input value={dtFormula} onChange={e => setDtFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
            </div>
          </div>

          {/* Resistances & Immunities */}
          <div className="border-t border-border/20 pt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances</label>
              <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Slashing" className="bg-background" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities</label>
              <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background" />
            </div>
          </div>

          {/* Save / Back */}
          <div className="flex justify-end gap-2 border-t border-border/20 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif">
              Save Stats
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
