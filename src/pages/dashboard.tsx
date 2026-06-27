import { useListCharacters, useListRecentRolls } from "@/hooks/useStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dice5, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: characters, isLoading: loadingChars } = useListCharacters();
  const { data: recentRolls, isLoading: loadingRolls } = useListRecentRolls();

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-4xl font-serif text-primary mb-2">Campaign Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to the table. Here is what's happening.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Active Characters */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-foreground">Active Roster</h2>
            <Link href="/characters" className="text-sm text-primary hover:underline">
              View All
            </Link>
          </div>
          
          {loadingChars ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
          ) : characters && characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {characters.slice(0, 4).map(char => (
                <Link key={char.id} href={`/characters/${char.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group bg-card/80 backdrop-blur">
                    <CardContent className="p-5 flex items-start justify-between">
                      <div>
                        <h3 className="font-serif text-lg text-foreground group-hover:text-primary transition-colors">
                          {char.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Lvl {char.level} {char.race} {char.className}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold font-mono text-foreground">
                          {char.currentHp}<span className="text-sm text-muted-foreground">/{char.maxHp}</span>
                        </div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">HP</div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No heroes have joined the party yet.</p>
                <Link href="/characters">
                  <Button variant="outline" className="border-primary/50 text-primary">Roll a Character</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Rolls */}
        <div className="space-y-6">
          <h2 className="text-2xl font-serif text-foreground">Recent Fate</h2>
          
          <Card className="bg-card/80 backdrop-blur border-border/50">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Dice5 className="w-4 h-4 mr-2" /> 
                Table History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingRolls ? (
                <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary/50" /></div>
              ) : recentRolls && recentRolls.length > 0 ? (
                <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
                  {recentRolls.map(roll => (
                    <div key={roll.id} className="p-4 hover:bg-accent/20 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-foreground">{roll.characterName}</span>
                        <span className="text-2xl font-serif font-bold text-primary">{roll.total}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>
                          {roll.label ? `${roll.label} ` : ''}({roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ''})
                        </span>
                        <span>{format(new Date(roll.rolledAt), "HH:mm")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
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