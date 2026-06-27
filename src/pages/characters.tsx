import { useState } from "react";
import { useListCharacters, useCreateCharacter } from "@/hooks/useStorage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Shield, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Characters() {
  const { data: characters, isLoading } = useListCharacters();
  const createCharacter = useCreateCharacter();
  const [, setLocation] = useLocation();

  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [race, setRace] = useState("Human"); // Default: Human
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(30);
  
  // Stats - Generic inputs (default: 10)
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

    // Derived max calculation values are handled automatically by parser formulas
    // We default HP/Mana/DT formulas here
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
          // Navigate to sheet
          setLocation(`/characters/${char.id}`);
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <style>{`
        @keyframes gold-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(197, 160, 89, 0.5);
            transform: scale(1);
          }
          50% {
            transform: scale(1.02);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(197, 160, 89, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(197, 160, 89, 0);
            transform: scale(1);
          }
        }
        .animate-gold-pulse {
          animation: gold-pulse 2.2s infinite ease-in-out;
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/40 pb-6">
        <div>
          {/* Stylized AEtherborne Tool Heading */}
          <h1 className="text-5xl font-serif font-extrabold tracking-wider bg-gradient-to-r from-primary via-amber-200 to-primary bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(197,160,89,0.15)] mb-2">
            AEtherborne RPG Tool
          </h1>
          <p className="text-muted-foreground font-serif italic text-base">
            Forge and manage your legends of the campfire.
          </p>
        </div>

        {/* Pulsing "New Character" Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/95 text-base font-serif font-bold tracking-wide px-6 py-5 rounded-lg border-2 border-primary-border/60 animate-gold-pulse shadow-lg transition-transform">
              <Plus className="w-5 h-5 mr-2" /> New Character
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-border shadow-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif text-3xl text-primary font-bold tracking-wide border-b border-border/30 pb-2">
                Forge a Hero
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-6 mt-4 font-sans">
              
              {/* Profile details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Character Name" required className="bg-background border-border/60" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Class</label>
                  <Input value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. Defender, Mage" required className="bg-background border-border/60" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Race</label>
                  <select 
                    value={race} 
                    onChange={e => setRace(e.target.value)} 
                    className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Human">Human (Standard defaults)</option>
                  </select>
                </div>
              </div>

              {/* Levels & Speed */}
              <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Starting Level</label>
                  <Input type="number" min={1} value={level} onChange={e => setLevel(Number(e.target.value))} required className="bg-background border-border/60 font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                  <Input type="number" min={5} step={5} value={speed} onChange={e => setSpeed(Number(e.target.value))} required className="bg-background border-border/60 font-mono" />
                </div>
              </div>

              {/* Stats - Direct generic entry */}
              <div className="border-t border-border/30 pt-4">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Attributes (Generic Stats Input)</h3>
                <div className="grid grid-cols-4 gap-3">
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
                    <div key={stat.label} className="bg-background/40 p-2.5 rounded-lg border border-border/40 text-center">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">{stat.label}</label>
                      <Input 
                        type="number" 
                        min={1} 
                        max={30}
                        value={stat.val} 
                        onChange={e => stat.set(Math.min(30, Math.max(1, Number(e.target.value))))} 
                        className="text-center font-mono h-8 bg-background"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Lore fields */}
              <div className="grid grid-cols-1 gap-4 border-t border-border/30 pt-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Background Summary</label>
                  <Input value={background} onChange={e => setBackground(e.target.value)} placeholder="e.g. Knight of the Realm, Forest Hermit" className="bg-background border-border/60" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Backstory (Markdown supported)</label>
                  <Textarea 
                    value={backstory} 
                    onChange={e => setBackstory(e.target.value)} 
                    placeholder="Brief history of your hero..." 
                    className="min-h-[100px] resize-none bg-background border-border/60 font-serif" 
                  />
                </div>
              </div>

              <div className="flex justify-end border-t border-border/30 pt-4 gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90 font-serif font-semibold">Forge Hero</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <Card key={i} className="animate-pulse bg-card/50 h-32 border-border/40"></Card>
          ))}
        </div>
      ) : characters && characters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map(char => (
            <Link key={char.id} href={`/characters/${char.id}`}>
              <Card className="hover:border-primary/50 transition-all cursor-pointer group bg-card border-border/50 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">
                        {char.name}
                      </h2>
                      <p className="text-sm text-muted-foreground uppercase tracking-widest text-[11px] mt-0.5">
                        Level {char.level} {char.race} {char.className}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border/50">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1 font-semibold">
                        HP
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.currentHp}/{char.maxHp}
                      </div>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1 font-semibold">
                        <Shield className="w-3 h-3 text-primary" /> DT
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.currentDt}
                      </div>
                    </div>
                    <div className="text-center border-l border-border/50">
                      <div className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1 mb-1 font-semibold">
                        <Zap className="w-3 h-3 text-amber-500" /> SPD
                      </div>
                      <div className="font-mono font-bold text-foreground">
                        {char.speed}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card/30 rounded-lg border border-dashed border-border/50">
          <Users className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
          <h3 className="text-xl font-serif text-foreground mb-2">No heroes found</h3>
          <p className="text-muted-foreground mb-6">Forge your first character to begin the adventure.</p>
          <Button onClick={() => setIsOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/95 animate-gold-pulse">
            <Plus className="w-4 h-4 mr-2" /> Forge a Hero
          </Button>
        </div>
      )}
    </div>
  );
}