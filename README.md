# AEtherborne RPG Tool

[![Open in CodeSandbox](https://img.shields.io/badge/Open%20in-CodeSandbox-blue?style=for-the-badge&logo=codesandbox)](https://codesandbox.io/s/github/LukieSeven/AetherborneTool/tree/main)

A standalone, client-side digital character sheet and campaign journal built specifically for the **AEtherborne RPG** system. Designed to be run natively in any web browser without server setup.

---

## ⚡ Live Demo (CodeSandbox)

Click the **"Open in CodeSandbox"** badge above to launch the application instantly in your browser. CodeSandbox will build and run the development server automatically.

---

## 🛡️ Core Features

* **Browser LocalStorage Database**: Saves all your characters, stats, items, equipment, currencies, essences, abilities, and logs directly in your browser.
* **JSON Character Backup System**: Export your character sheet as a `.json` backup file or import existing sheets to share between players and devices.
* **Derived Math Formula Evaluation**: Custom mathematical expressions automatically compute derived stats (like HP, Mana, and DT) based on your attributes and gear.
* **HUD Resource Controls**: Manage HP, Mana, and DT with Add (+), Remove (-), and Buff controls. Buffs exceed maximum capacities and glow in gold highlights.
* **Attacks & Quick Actions Bar**: Equip weapons or assign abilities to your HUD to trigger quick dice rolls and automatically deduct Mana costs.
* **Crit Chain Dice Roller**: Explodes maximum rolls, tracking multipliers and crit tiers (Common, Rare, Epic, Legendary, etc.) dynamically.

---

## 🛠️ Local Development

To run this tool on your own machine:

1. **Install Node.js** (v20 or higher recommended).
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.
