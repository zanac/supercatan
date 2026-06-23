# 🎲 Settlers of Catan

A full web-based multiplayer implementation of Settlers of Catan, playable from any browser — no app required.

Two skins are included out of the box: **Classic Catan** (standard hex graphics) and **Pulp Fiction (IT)** (Italian-language skin inspired by the Pulp Fiction universe, with custom resource names, card art and VP card images).

![SuperCatan — Desktop](screenshot.png)

<img src="screenshot_mobile.jpg" width="360" alt="SuperCatan — Mobile">

## Features

- **2–4 players** — each player joins from their own device
- **Admin view** — full board on desktop, manages the game
- **📱 Mobile player** — each player scans a QR code and plays from their phone
- **💻 Web player** — join via link on PC or tablet, with full turn management
- **📺 Spectator mode** — watch the game on any device via `/spectator?pin=XXXXX`
- **📱 Phone-only mode** — run the entire game without a desktop; all players join via QR
- **Skin system** — fully customizable visuals: hex tiles, buildings, roads, robber, resource names, dev card names and images, VP card names and images
- **Undo** — available during setup and main game phases
- **Languages** — EN, IT, FR, DE (auto-detected from browser)
- **PWA** — installable on mobile as a full-screen app

---

## How to play

### Standard mode (admin on desktop)

1. Open the game on a desktop browser — this is the **Admin** view
2. Set player names and colors, choose skin and rules
3. Click **Start Game** — a PIN is generated
4. Each player scans the **QR code** (phone → mobile interface) or copies the **Web link** (PC/tablet)
5. Play!

### Phone-only mode (mobile admin)

1. Open the game on a phone
2. Configure players and rules as usual
3. Tap **📱 Play from phone** — a compact host screen appears
4. Each player taps **QR** to scan their personal link, or **🔗** to open it directly
5. Everyone plays from their own phone — no desktop board needed

### Rejoin after reload

If the admin closes or refreshes the page, navigate to `/?pin=XXXXX` to rejoin. The PIN is always visible in the top bar during a game.

---

## Game rules options

| Option | Default | Description |
|--------|---------|-------------|
| Start without resources | ✅ On | Players begin with no resources from initial settlements |
| Random ports | Off | Port positions are randomized each game |
| Random numbers | Off | Number tokens are placed randomly instead of the standard spiral |
| Desert center | ✅ On | Desert is always placed at the center hex |
| Quick Game | Off | Win at 7 points instead of 10 |
| Unlimited dev cards | ✅ On | Players can buy multiple dev cards per turn (house rule); turn off for standard Catan rules (1 per turn) |
| Instant Cards | Off | Newly bought dev cards can be played immediately in the same turn, without waiting for the next |

---

## Dev cards

| Card | Effect |
|------|--------|
| ⚔️ Knight | Move the robber and steal a resource from an adjacent player |
| 👑 Monopoly | Choose a resource — all other players give you all their cards of that type |
| 🌻 Year of Plenty | Take any 2 resources from the bank |
| 🛤 Road Building | Place 2 roads for free |
| ⭐ Victory Point | +1 secret point, revealed only when winning |

Victory Point cards each have a unique subtype (Library, Chapel, Market, University, Great Hall) with individual name and description — customizable per skin.

Stealing a resource after moving the robber (via dice 7 or Knight card) triggers the same resource-change popup as dice rolls, showing gains/losses for all affected players.

---

## Skin system

Place skin folders inside `skins/` — each with a `skin.json` manifest. Skins are loaded automatically and appear in the setup screen.

### Folder structure

```
skins/
└── myskin/
    ├── skin.json
    ├── preview.png          ← thumbnail shown in skin selector
    ├── hex/
    │   └── wood.png  brick.png  sheep.png  wheat.png  ore.png  desert.png
    ├── buildings/
    │   └── settlement_red.png  city_red.png  (+ blue, green, yellow)
    ├── roads/
    │   └── road_red.png  (+ blue, green, yellow)
    ├── vp/
    │   └── chapel.jpg  library.jpg  market.jpg  university.jpg  palace.jpg
    └── dev/
        └── knight.jpg  monopoly.jpg  year_of_plenty.jpg  road_building.jpg
```

### skin.json reference

```json
{
  "id": "myskin",
  "name": "My Skin",
  "version": "1.0",
  "preview": "preview.png",
  "provides": ["hex", "robber", "buildings", "roads"],

  "hex": {
    "wood":   "hex/wood.png",
    "brick":  "hex/brick.png",
    "sheep":  "hex/sheep.png",
    "wheat":  "hex/wheat.png",
    "ore":    "hex/ore.png",
    "desert": "hex/desert.png"
  },
  "robber": "robber.png",
  "buildings": {
    "settlement": { "red": "buildings/settlement_red.png", "blue": "...", "green": "...", "yellow": "..." },
    "city":       { "red": "buildings/city_red.png",       "blue": "...", "green": "...", "yellow": "..." }
  },
  "roads": {
    "red": "roads/road_red.png", "blue": "...", "green": "...", "yellow": "..."
  },

  "resource_names": {
    "ore": "Gold", "brick": "Weapons", "wheat": "Grain", "wood": "Timber", "sheep": "Wool"
  },
  "resource_emojis": {
    "ore": "💰", "brick": "🔫", "wheat": "🌾", "wood": "🪵", "sheep": "🐑"
  },

  "labels": {
    "road":           "Road",
    "settlement":     "Settlement",
    "city":           "City",
    "port":           "Port",
    "robber":         "Robber",
    "knight":         "Knight",
    "monopoly":       "Monopoly",
    "year_of_plenty": "Year of Plenty",
    "road_building":  "Road Building",
    "longest_road":   "Longest Road",
    "largest_army":   "Largest Army",
    "devcard_knight_desc":  "Move the robber and steal a resource",
    "devcard_road_desc":    "Place 2 free roads",
    "devcard_mono_desc":    "Claim all of one resource from everyone",
    "devcard_yop_desc":     "Take any 2 resources from the bank",
    "banner_robber":        "Move the robber! Tap a hex.",
    "phase_place_sett":     "Place a settlement",
    "phase_place_road":     "Place a road",
    "mob_build_label_road":       "Tap an edge for the road",
    "mob_build_label_settlement": "Tap a vertex for the settlement",
    "mob_build_label_city":       "Tap your settlement to upgrade",
    "mob_build_label_robber":     "Tap a hex for the robber"
  },

  "vp_cards": {
    "chapel":     { "name": "⛪ Chapel",     "emoji": "⛪", "desc": "A place of worship",       "image": "vp/chapel.jpg" },
    "library":    { "name": "📚 Library",    "emoji": "📚", "desc": "Knowledge is power",       "image": "vp/library.jpg" },
    "market":     { "name": "🏪 Market",     "emoji": "🏪", "desc": "The heart of trade",       "image": "vp/market.jpg" },
    "university": { "name": "🎓 University", "emoji": "🎓", "desc": "Brilliant minds prosper",  "image": "vp/university.jpg" },
    "palace":     { "name": "🏰 Palace",     "emoji": "🏰", "desc": "Symbol of your power",     "image": "vp/palace.jpg" }
  },

  "dev_cards": {
    "knight":        { "image": "dev/knight.jpg" },
    "monopoly":      { "image": "dev/monopoly.jpg" },
    "year_of_plenty":{ "image": "dev/year_of_plenty.jpg" },
    "road_building": { "image": "dev/road_building.jpg" }
  }
}
```

### Skin override rules

- All fields are **optional** — omit any section to fall back to the standard Classic behavior
- `resource_names` and `resource_emojis` override only the keys you provide; missing keys fall back to the current language translation
- `labels` keys override specific UI strings; any key not present falls back to the i18n translation
- `vp_cards` defines name, emoji and optional description for each Victory Point subtype; `image` is optional (falls back to emoji)
- `dev_cards` defines optional card images shown in the drawn-card popup (falls back to emoji)
- Languages other than the skin's native language automatically fall back to i18n translations — skins do not need to be multilingual

---

## Debug mode

Open `/?debug=1` to show a debug panel in the setup screen.

| Debug option | Description |
|---|---|
| Force dev card | Forces a specific card type as the next draw |
| 💰 10 resources | All players start the main phase with 10 of each resource |
| 🎲 Force dice | Forces a specific dice total (2–12) on every roll |

A red banner `🐛 DEBUG: ...` confirms active debug options. Debug mode is invisible in normal play.

---

## Setup

```bash
npm install
node server/index.js
```

Open `http://localhost:3000` in your browser.

## Deploy

Tested on [Render](https://render.com) — set start command to `node server/index.js`.

> **Note:** The server keeps all game state in memory. On free-tier hosting (e.g. Render free plan), the server sleeps after inactivity and loses all state on restart. Generate player QR codes and start the game in the same session to avoid token expiry.

## Demo

[https://supercatan.onrender.com/](https://supercatan.onrender.com/)

---

## About me

My real name is Vanni Brutto, for friends... just call me Zanac 👋

## Support

Hey dude! Help me out for a couple of 🍻 or a ☕!

[![Buy me a coffee](https://www.buymeacoffee.com/assets/img/custom_images/black_img.png)](https://bmc.link/zanac)
