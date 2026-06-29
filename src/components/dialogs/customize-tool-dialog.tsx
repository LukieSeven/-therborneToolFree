import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";

const THEMES = [
  { id: "theme-obsidian", name: "Obsidian", bg: "bg-[#0c0f12]", primary: "bg-[#10b981]", label: "Default Dark & Green" },
  { id: "theme-sea", name: "Deep Sea", bg: "bg-[#070b13]", primary: "bg-[#00b0ff]", label: "Midnight Blue & Cyan" },
  { id: "theme-emerald", name: "Emerald Vault", bg: "bg-[#05110d]", primary: "bg-[#10b981]", label: "Deep Forest & Mint" },
  { id: "theme-alchemist", name: "Alchemist", bg: "bg-[#0e0714]", primary: "bg-[#ab47bc]", label: "Royal Violet & Amethyst" },
  { id: "theme-bloodstone", name: "Bloodstone", bg: "bg-[#12070c]", primary: "bg-[#e53935]", label: "Dark Crimson & Coral" },
  { id: "theme-abyss", name: "Abyss", bg: "bg-[#050607]", primary: "bg-[#d4af37]", label: "Charcoal Black & Gold" },
  { id: "theme-chaos", name: "Chaos", bg: "bg-[#0a0512]", primary: "bg-[#ffd700]", label: "Golds & Purples in Unison" },
  { id: "theme-rot", name: "Rot & Decay", bg: "bg-[#080906]", primary: "bg-[#8ebd43]", label: "Putrid Green & Moss" },
  { id: "theme-structure", name: "Structure", bg: "bg-[#05080c]", primary: "bg-[#00e5ff]", label: "Cyber Teals & Purples" },
  { id: "theme-emberborn", name: "Emberborn", bg: "bg-[#0a0605]", primary: "bg-[#ff6d00]", label: "ITS ON FIRE" },
];

export function CustomizeToolDialog() {
  const [activeTheme, setActiveTheme] = useState("theme-obsidian");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("aetherborne_theme") || "theme-obsidian";
    setActiveTheme(saved);
    document.documentElement.className = saved;
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem("aetherborne_theme", themeId);
    document.documentElement.className = themeId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer font-bold font-serif">
          <Palette className="w-3.5 h-3.5 mr-1.5" /> Customize Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary font-bold flex items-center gap-2 border-b border-border/30 pb-2">
            <Palette className="w-5 h-5" /> Customize Tool Theme
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4 font-serif">
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            Select a custom color scheme to theme the tool's cards, buttons, backgrounds, and glow effects.
          </p>
          <div className="space-y-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTheme(t.id)}
                className={`w-full flex items-center justify-between p-3 border transition-all cursor-pointer rounded-md ${
                  activeTheme === t.id 
                    ? "border-primary bg-primary/10" 
                    : "border-border/50 bg-background/30 hover:bg-accent/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Theme swatch */}
                  <div className={`w-8 h-8 rounded border border-border/50 flex items-center justify-center ${t.bg}`}>
                    <div className={`w-3 h-3 rounded-full ${t.primary}`} />
                  </div>
                  <div className="text-left font-sans">
                    <div className="text-xs font-bold text-foreground">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground">{t.label}</div>
                  </div>
                </div>
                {activeTheme === t.id && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end pt-3 border-t border-border/30">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="rounded-md font-bold text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
