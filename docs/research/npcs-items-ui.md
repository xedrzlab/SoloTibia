# Tibia Design Research: NPCs, Items, UI
Research compiled from TibiaWiki (Fandom) and related public community sources, for design-inspiration purposes only (no code/art/text copied). Sourced via web search snippets on 2026-08-25.

---

## A. NPC System

### Dialogue model
- Conversations are keyword-driven, not branching-choice trees. Player types (or taps) a word; the NPC pattern-matches it against a keyword table and replies with scripted text.
- Starting a conversation: greet with `hi` or `hello` (some NPCs use a unique hail, e.g. "Hail Emperor"). Greeting near an NPC opens a dedicated **NPC channel/window** for that conversation (separate from local chat).
- Ending: `bye` or walking away closes/ends the conversation.
- **Universal keywords** across most NPCs: `hi`/`hello`, `bye`, `name`, `job`, `help`, `trade`, `mission`/quest keywords.
- **Highlighted keywords**: NPC responses render certain words in a distinct color (in-wiki transcripts mark these with `{curly braces}`) to hint at what the player can say next — a built-in discoverability affordance (e.g. an NPC says "...ask me about the {mission}").
- Many NPC chat windows also show clickable **quick-phrase buttons** for common actions (e.g. "trade", "deposit all", "sail") so the player doesn't have to type them.
- Quest dialogue uses the same keyword mechanism but with quest-specific keywords/state (NPC remembers quest progress per player and branches replies accordingly).

### NPC roles
- **Shopkeepers/Merchants** — each NPC buys/sells only a specific category of items (e.g. one NPC deals in armor, another in weapons, another in food/potions/runes). This creates a "visit the right specialist" shopping loop rather than one universal store.
- **Trainers/Skill Trainers** — dedicated NPCs (or training-dummy objects) let players grind specific skills (sword/axe/club/distance/magic/fist) in "Training Schools" found in major cities; some trainer types are skill-specific, some train "all".
- **Bankers** — manage the player's bank balance, convert between coin denominations (gold/platinum/crystal), typically stationed near a Depot.
- **Depot NPCs / Depot access** — separate from bankers; the Depot is the storage-locker system (often just an object/room rather than a talking NPC in modern Tibia, but historically depot management involved keyword commands too).
- **Quest-givers** — NPCs that hand out quests/missions via keyword (e.g. `mission`), track player quest state, and give rewards.

### Trading/shop UI
- Saying `trade` (or clicking a quick-phrase button) opens a **Trade window** with two tabs: **Buy** and **Sell**.
- Buy tab lists everything that NPC sells; Sell tab lists everything that NPC will buy from the player's inventory (only items that NPC accepts — matches their "specialist" category).
- Quantity is chosen via a **slider or direct numeric input** before confirming.
- List can be **sorted** (by name, price, or weight) via a small header menu.
- Clicking an item's icon lets the player "Look"/"Inspect" it (see stats/description) before buying.
- Transaction is typically resolved in-window (gold deducted/added), no separate confirm dialog beyond the trade window itself in modern client.

### Design takeaway for a solo game
The keyword system exists mainly to simulate a "real conversation" in a persistent multiplayer world with a chat log. For a single-player mobile game, the same *functional* structure (greet → role-specific menu → buy/sell/train/quest) can be delivered as a simple tap-driven dialogue/menu UI without needing free-text keyword parsing — but keeping the "specialist shopkeeper per category" pattern and quest-state-aware dialogue is worth preserving since it's core to Tibia's economy/flavor.

---

## B. Item System

### Weapon categories (5 melee/ranged skill types + magic)
- **Sword** weapons
- **Axe** weapons
- **Club** weapons
- **Distance** (ranged: bows/crossbows + ammo, or throwing weapons)
- **Fist Fighting** (unarmed)
- **Wands / Rods** — magic weapons for casters (sorcerer/druid equivalents), consume mana instead of requiring ammo
- Each weapon type trains a corresponding combat skill through use.
- Two-handed weapons occupy both weapon and shield slot; some weapons can be used one-handed alongside a shield.

### Equipment slots (paperdoll)
Standard slot layout on the character paperdoll:
| Slot | Holds |
|---|---|
| Head | Helmets |
| Neck/Amulet | Necklaces, amulets |
| Backpack/Container | Bags, backpacks (the "inventory root" container) |
| Armor/Torso (Body) | Body armor |
| Right Hand (Weapon) | Melee/ranged weapon, wand/rod |
| Left Hand (Shield) | Shield, or spellbook (casters), or quiver (ranged) |
| Legs | Leg armor |
| Feet | Boots |
| Ring | Rings (buffs/resistances) |
| Ammo/Belt | Ammunition (arrows/bolts) or light source |
| Extra slot | Trinkets/light sources (in some client versions) |

A "full set" = helmet + armor + legs + boots + shield (+ amulet + ring completes it). Only one item per slot.

### Consumables
- **Food** — restores HP/mana regeneration over time (a "well-fed" timer, up to a cap, e.g. 20 minutes); doesn't heal instantly.
- **Potions** — instant-ish HP or mana restoration, tiered by strength (Health/Strong Health/Great Health/Ultimate/Supreme...), each tier gated by player level.
- **Runes** — single-use consumable spells "charged" into an item (crafted by casters), used by any class regardless of magic skill, level-gated per rune type (e.g. Ultimate Healing Rune needs level 24 + magic level 4). Functions like a bridge between the item economy and the spell system — lets non-casters use magic effects.
- Other consumables: blessings (death-penalty mitigation), exercise weapons (skill training dummies-in-a-bag).

### Currency & conversion
- Three coin denominations: **Gold Coin → Platinum Coin → Crystal Coin**.
- Conversion: **100 gold = 1 platinum; 100 platinum = 1 crystal** (so 1 crystal = 10,000 gold).
- Bankers (NPCs) convert between denominations; a "Gold Converter" object also exists in-world.
- Coins stack and have weight, so higher denominations exist purely to reduce carried weight/slot usage for large sums — a practical inventory-management mechanic, not just flavor.

### Containers & weight/capacity
- **Capacity** is an oz-based carry-weight stat (grows with level/vocation, e.g. Knights +25oz/level).
- Every item has a weight; total carried weight must stay under capacity or the player can't pick up more / becomes overloaded.
- **Backpacks/bags** are containers with a fixed slot count (commonly ~20 slots) and their own weight; nested containers are allowed (bag-in-a-bag) up to a limit.
- Special containers (quest rewards) can have bonus capacity or slot count (e.g. "Backpack of Holding").
- Depot = free, safe, capacity-exempt long-term storage located in cities, accessed by talking to a depot or via a depot box object.

### Quest items
- Non-tradeable (or NPC-won't-buy) items tied to a specific quest; often key items, reward-only equipment, or story artifacts. Usually can't be sold to generic shopkeepers, reinforcing that quests are the only source.

### Design takeaway for a solo game
The weight/capacity + coin-denomination system is really an inventory-pressure mechanic that makes trips back to town meaningful. For a simplified solo/mobile game, a lighter version (e.g. just capacity in "slots" instead of oz math, and 1-2 currency tiers instead of 3) preserves the feel without the bookkeeping overhead. The 5-weapon-type + slot-based paperdoll is a clean, well-tested equipment model worth keeping close to as-is.

---

## C. UI / HUD

### Classic desktop client layout (for reference)
- **Game window** (center) — the actual world view, isometric/top-down tile view.
- **Character HUD overlay** — name, health bar, mana bar, and status icons rendered above the player's sprite and above nearby creatures/NPCs (each element can be toggled: bar-style vs arc-style health/mana).
- **Status bars panel** — HP/mana as numeric + bar, plus optional level, magic level, and skill readouts, configurable via Options → Interface → HUD.
- **Experience bar** — shows progress to next level (often paired with an XP-per-hour tracker in modern client).
- **Battle List** — scrollable list of all creatures/players/NPCs currently in view, each row showing name, mini health bar, and skull/party/guild marks; filterable by group (players, monsters, party, guild, non-skulled, etc.); used for target-selection (click a row to target, especially for aimed spells/runes). Premium allows multiple simultaneous battle lists.
- **VIP list** — a persistent friends-list-style panel showing named characters and whether they're online/offline (opened via a dedicated hotkey, e.g. Ctrl+P in desktop client).
- **Inventory/Paperdoll window** — the equipped-item slots described in section B, usually a separate draggable window from the main backpack contents view.
- **Container windows** — each open backpack/bag is its own small window/grid of item icons.
- **Minimap** — small corner map showing explored terrain, points of interest markers, and player position; can pop out to full map view.
- **Chat window** — tabbed text log (local, NPC, trade, guild, party, private messages, server messages) with an input line; the NPC keyword conversations happen here (or in a dedicated NPC tab).
- **Skills window** — separate panel (opened via a "Skills" button or hotkey) listing all trainable skills (magic level, melee skills, distance, shielding, fist fighting) each with a progress bar toward the next skill point.
- **Action bar(s)** — one or two hotbars along the bottom with numbered slots; each slot can be assigned an item (use/equip), a spell, or a text macro; supports drag-and-drop assignment and separate keyboard hotkey binding independent of the bar's visual slot position.

### What matters for a mobile/touch adaptation
Essential (keep, but simplified):
- **HP/Mana bars** — always-visible, compact, top of screen; combine level/XP into the same header strip instead of a separate large element.
- **A single combined "target/creature" indicator** — replace the full scrollable Battle List with either (a) tap-to-target directly on the creature sprite (natural on touch, removes need for a list at all for a solo game with few simultaneous enemies) or (b) a minimized 1-3 row nearby-enemies strip only when there are multiple targets.
- **Inventory/paperdoll** — keep as a single modal/panel triggered by a button, combining paperdoll + backpack contents into one scrollable sheet (avoid multiple floating windows — touch screens don't support many overlapping draggable windows well).
- **Action bar** — very touch-appropriate as-is; keep a single row of large tappable slots (potions/runes/spells/equip-shortcuts) rather than two rows, since screen width is limited; skip separate keyboard-hotkey binding (no keyboard).
- **Minimap** — keep as a small corner toggle, expandable to full-screen on tap; important for a Tibia-style open-map exploration game.
- **Chat window** — largely droppable for single-player (no other players to talk to); repurpose only as a **combat/event log** (damage numbers, loot messages, quest updates) — a much smaller, auto-scrolling strip, not a full chat UI.
- **Skills window** — keep as a secondary modal screen (not on the main HUD), since it's checked infrequently.
- **NPC trade window** — keep this UI pattern close to original (list + buy/sell tabs + qty) since it maps naturally to touch (tap item → tap qty +/- or slider → confirm).

Droppable/mergeable for solo mobile:
- **VIP list** — irrelevant in solo play, drop entirely (or repurpose as a "bestiary/NPC met" log if desired).
- **Party list / guild windows** — irrelevant, drop.
- **Multiple battle lists** — irrelevant, drop.
- **Draggable/resizable floating windows** — replace with fixed-position modal panels/sheets (bottom-sheet or full-screen overlays) since window management is a desktop-mouse pattern, not a touch one.

### Design takeaway for a solo game
Tibia's HUD is built for simultaneous multiplayer awareness (who's near me, are they hostile, is my party ok) and mouse-driven window management. A solo mobile version should collapse this into: (1) a persistent top status strip (HP/mana/XP), (2) direct-tap targeting on the world instead of a battle list, (3) one consolidated inventory sheet, (4) a bottom action bar, (5) a small toggleable minimap, and (6) a lightweight event log instead of chat. Everything else (VIP, party, guild, multi-battle-list) is safely cut.
