import { useState } from "react";
import { useListCharacters, useListRecentRolls, useCreateCharacter } from "@/hooks/useStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Dice5, AlertCircle, Loader2, Plus, Sparkles, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: characters, isLoading: loadingChars } = useListCharacters();
  const { data: recentRolls, isLoading: loadingRolls } = useListRecentRolls();
  const createCharacter = useCreateCharacter();
  const [, setLocation] = useLocation();

  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [race, setRace] = useState("Human");
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(30);
  
  // Base Stats (Default: 10)
  const [power, setPower] = useState(10);
  const [vitality, setVitality] = useState(10);
  const [spirit, setSpirit] = useState(10);
  const [agility, setAgility] = useState(10);
  const [endurance, setEndurance] = useState(10);
  const [precision, setPrecision] = useState(10);
  const [willpower, setWillpower] = useState(10);
  const [charisma, setCharisma] = useState(10);

  const [background, setBackground] = useState("");
  const [backstory, setBackstory] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Derived max values calculated automatically by parser formulas
    createCharacter.mutate(
      {
        name,
        className,
        race,
        level,
        speed,
        power,
        vitality,
        spirit,
        agility,
        endurance,
        precision,
        willpower,
        charisma,
        maxHp: vitality * 10 + endurance * 5,
        currentHp: vitality * 10 + endurance * 5,
        currentMana: spirit * 10 + willpower * 5,
        currentDt: endurance * 2,
        dtBonus: 0,
        background: background || null,
        backstory: backstory || null,
        hpFormula: "Vitality * 10 + Endurance * 5",
        manaFormula: "Spirit * 10 + Willpower * 5",
        dtFormula: "Endurance * 2 + dtBonus",
        powerTraining: 0,
        vitalityTraining: 0,
        spiritTraining: 0,
        agilityTraining: 0,
        enduranceTraining: 0,
        precisionTraining: 0,
        willpowerTraining: 0,
        charismaTraining: 0,
      },
      {
        onSuccess: (char) => {
          setIsOpen(false);
          // Reset form fields
          setName("");
          setClassName("");
          setRace("Human");
          setLevel(1);
          setSpeed(30);
          setPower(10);
          setVitality(10);
          setSpirit(10);
          setAgility(10);
          setEndurance(10);
          setPrecision(10);
          setWillpower(10);
          setCharisma(10);
          setBackground("");
          setBackstory("");
          // Navigate to character sheet
          setLocation(`/characters/${char.id}`);
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <style>{`
        @keyframes ethereal-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
            transform: scale(1);
          }
          50% {
            transform: scale(1.015);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            transform: scale(1);
          }
        }
        .animate-ethereal-pulse {
          animation: ethereal-pulse 2.2s infinite ease-in-out;
        }
      `}</style>

      {/* Main Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-5xl font-serif font-extrabold tracking-wider bg-gradient-to-r from-primary via-blue-200 to-primary bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(59,130,246,0.15)] mb-2">
            AEtherborne RPG Tool
          </h1>
          <p className="text-muted-foreground font-serif italic text-base">
            Forge and manage your legends of the campfire.
          </p>
        </div>

        {/* Ethereal New Character Dialog Trigger */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-base font-serif font-bold tracking-wide px-6 py-5 rounded-none border border-primary/60 animate-ethereal-pulse shadow-lg transition-transform cursor-pointer">
              <Plus className="w-5 h-5 mr-2" /> New Character
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none">
            <DialogHeader>
              <DialogTitle className="font-serif text-3xl text-primary font-bold tracking-wide border-b border-border/30 pb-2">
                Forge a Hero
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-6 mt-4 font-sans text-sm">
              
              {/* Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Garrick the Bold" 
                    required 
                    className="bg-background border-border/60 rounded-none h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Class</label>
                  <Input 
                    value={className} 
                    onChange={e => setClassName(e.target.value)} 
                    placeholder="e.g. Defender, Mage, Rogue" 
                    required 
                    className="bg-background border-border/60 rounded-none h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Race</label>
                  <select 
                    value={race} 
                    onChange={e => setRace(e.target.value)} 
                    className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Human">Human</option>
                    <option value="Elf">Elf</option>
                    <option value="Dwarf">Dwarf</option>
                    <option value="Halfling">Halfling</option>
                    <option value="Dragonborn">Dragonborn</option>
                    <option value="Orc">Orc</option>
                  </select>
                </div>
              </div>

              {/* Levels & Speed */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Starting Level</label>
                  <Input 
                    type="number" 
                    min={1} 
                    value={level} 
                    onChange={e => setLevel(Number(e.target.value))} 
                    required 
                    className="bg-background border-border/60 rounded-none font-mono h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                  <Input 
                    type="number" 
                    min={5} 
                    step={5} 
                    value={speed} 
                    onChange={e => setSpeed(Number(e.target.value))} 
                    required 
                    className="bg-background border-border/60 rounded-none font-mono h-9 text-sm" 
                  />
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="border-t border-border/20 pt-4">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Attributes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Power (POW)", val: power, set: setPower },
                    { label: "Vitality (VIT)", val: vitality, set: setVitality },
                    { label: "Spirit (SPI)", val: spirit, set: setSpirit },
                    { label: "Agility (AGI)", val: agility, set: setAgility },
                    { label: "Endurance (END)", val: endurance, set: setEndurance },
                    { label: "Precision (PRE)", val: precision, set: setPrecision },
                    { label: "Willpower (WIL)", val: willpower, set: setWillpower },
                    { label: "Charisma (CHA)", val: charisma, set: setCharisma },
                  ].map(stat => (
                    <div key={stat.label} className="bg-background/40 p-2.5 rounded-none border border-border/40 text-center">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">{stat.label}</label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30}
                        value={stat.val} 
                        onChange={e => stat.set(Math.min(30, Math.max(1, Number(e.target.value))))} 
                        className="text-center font-mono h-8 bg-background rounded-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Background and Lore */}
              <div className="border-t border-border/20 pt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Character Background / Title</label>
                  <Input 
                    value={background} 
                    onChange={e => setBackground(e.target.value)} 
                    placeholder="e.g. Captain of the Guard" 
                    className="bg-background border-border/60 rounded-none h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Hero Backstory</label>
                  <Textarea 
                    value={backstory} 
                    onChange={e => setBackstory(e.target.value)} 
                    placeholder="Describe their origin, motives, and path..." 
                    className="bg-background border-border/60 rounded-none min-h-[80px] text-sm" 
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-border/20 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-none font-serif text-sm">Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-serif text-sm rounded-none">Forge Hero</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {/* Two Column Layout: Roster (Left) & Recent Fate (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* Roster column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <h2 className="text-2xl font-serif font-bold text-foreground">Active Roster</h2>
          </div>
          
          {loadingChars ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : characters && characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {characters.map(char => (
                <button 
                  key={char.id} 
                  onClick={() => setLocation(`/characters/${char.id}`)}
                  className="w-full text-left rounded-none border border-border/50 bg-card/60 backdrop-blur hover:border-primary/60 transition-colors duration-250 cursor-pointer group"
                >
                  <div className="p-5 flex items-start justify-between">
                    <div>
                      <h3 className="font-serif text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                        {char.name}
                      </h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                        Lvl {char.level} · {char.race} · {char.className}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono text-foreground leading-tight">
                        {char.currentHp}<span className="text-xs text-muted-foreground font-normal">/{char.maxHp}</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Health (HP)</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Card className="bg-card/30 border-dashed border-border/50 rounded-none">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground/60 mb-3" />
                <p className="text-muted-foreground font-serif italic mb-4">No heroes have joined the party yet.</p>
                <Button 
                  variant="outline" 
                  className="border-primary/50 text-primary rounded-none font-serif text-sm"
                  onClick={() => setIsOpen(true)}
                >
                  Forge a Hero
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent fate columns (1/3 width) */}
        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-bold text-foreground border-b border-border/20 pb-2">Recent Fate</h2>
          
          <Card className="bg-card/60 backdrop-blur border-border/50 rounded-none">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle className="text-xs font-bold text-muted-foreground flex items-center uppercase tracking-widest">
                <Dice5 className="w-4 h-4 mr-2 text-primary" /> 
                Table History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRolls ? (
                <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : recentRolls && recentRolls.length > 0 ? (
                <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto pr-1">
                  {recentRolls.map(roll => (
                    <div key={roll.id} className="p-4 hover:bg-accent/10 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wide">{roll.characterName}</span>
                        <span className="text-xl font-serif font-bold text-primary leading-none">{roll.total}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                        <span>
                          {roll.label ? `${roll.label} ` : ''}({roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ''})
                        </span>
                        <span>{format(new Date(roll.rolledAt), "HH:mm")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground font-serif italic">
                  The dice have not been cast.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}