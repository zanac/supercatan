// ============================================================
//  CATAN GAME ENGINE
// ============================================================

const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];
const DESERT = 'desert';

const TILE_COUNTS = {
  wood: 4, brick: 3, sheep: 4, wheat: 4, ore: 3, desert: 1
};

const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const COSTS = {
  road:       { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city:       { wheat: 2, ore: 3 },
  devCard:    { sheep: 1, wheat: 1, ore: 1 }
};

const DEV_CARD_COUNTS = {
  knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2
};

const VP_SUBTYPES = ['library', 'chapel', 'market', 'university', 'palace'];

// Hex grid layout: 3-4-5-4-3 rows
const HEX_LAYOUT = [3, 4, 5, 4, 3];

class CatanGame {
  constructor(playerConfigs, options = {}) {
    this.desertCenter   = options.desertCenter  || false;
    this.zeroResources  = options.zeroResources !== false; // default true
    this.randomPorts    = options.randomPorts   || false;  // default: standard layout
    this.randomNumbers  = options.randomNumbers || false;  // default: standard spiral
    this.skinId         = options.skinId        || 'standard';
    this.debugDevCard   = options.debugDevCard  || null;
    this.unlimitedDev   = options.unlimitedDev !== false; // default true
    this.instantDev    = !!options.instantDev;            // default false
    this.winPoints      = options.quickGame ? 7 : 10;
    this.debugResources = options.debugResources || false; // give all players 10 of each
    this.debugForceDice = options.debugForceDice || null;
    this.hiddenResources = !!options.hiddenResources; // default false
    this.players = playerConfigs.map((p, i) => ({
      id: i,
      name: p.name,
      color: p.color,
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: [],
      playedDevCards: [],
      settlements: [],
      cities: [],
      roads: [],
      points: 0,
      hasLongestRoad: false,
      hasLargestArmy: false,
      knightsPlayed: 0
    }));

    this.board = this._generateBoard();
    this.devDeck = this._generateDevDeck();
    this.devCardBoughtThisTurn = false;
    this.currentPlayerIndex = 0;
    this.phase = 'setup1'; // setup1, setup2, main
    this.setupOrder = this._buildSetupOrder();
    this.setupStep = 0;
    this.waitingForRoad = false;
    this.pendingSetupEndTurn = false;
    this.lastSettlementPlaced = null;
    this.diceRolled = false;
    this.diceValues = [0, 0];
    this.robberHexId = this.board.hexes.find(h => h.resource === DESERT).id;
    this.longestRoadOwner = null;
    this.longestRoadLength = 0;
    this.largestArmyOwner = null;
    this.largestArmySize = 0;
    this.winner = null;
    this.log = [];
    this.pendingRobber = false;
    this.pendingDiscard = []; // player ids that must discard
    this.pendingSteal = false;
    this.robberCandidates = [];
    this.pendingYearOfPlenty = 0;
    this.pendingRoadBuilding = 0;
    this.pendingMonopoly = false;
    this.currentTradeOffer = null;
  }

  // ---- BOARD GENERATION ----

  _generateBoard() {
    // ── Build tile list ──────────────────────────────────────────────
    // Standard Catan tile order (clockwise spiral from top-left):
    // hex indices by row: row0=[0,1,2] row1=[3,4,5,6] row2=[7,8,9,10,11] row3=[12,13,14,15] row4=[16,17,18]
    // Center hex = index 9 (row2, col2)
    const CENTER_HEX_INDEX = 9;

    // Shuffle resource tiles
    const tiles = this._shuffleTiles();

    // If desertCenter: pull desert out, place it at center, fill rest randomly
    if (this.desertCenter) {
      const dIdx = tiles.indexOf(DESERT);
      if (dIdx !== CENTER_HEX_INDEX) {
        const tmp = tiles[CENTER_HEX_INDEX];
        tiles[CENTER_HEX_INDEX] = DESERT;
        tiles[dIdx] = tmp;
      }
    }

    // Number tokens: official Catan spiral order (A→R, skip desert)
    // Clockwise from top-left: official letter sequence
    // Hex visit order (clockwise spiral): 0,3,7,12,16,17,18,15,11,6,2,1,4,8,13,14,10,5,9(center)
    // but desert has no token, so we place tokens in spiral order skipping desert
    const SPIRAL_ORDER = [0,3,7,12,16,17,18,15,11,6,2,1,4,8,13,14,10,5,9];
    const OFFICIAL_NUMBERS = [5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11]; // 18 tokens (no 7, no desert)

    // Assign numbers: standard spiral or random
    const hexNumbers = new Array(19).fill(null);
    let numbers = [...OFFICIAL_NUMBERS];
    if (this.randomNumbers) {
      // Shuffle numbers
      for (let i = numbers.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [numbers[i],numbers[j]] = [numbers[j],numbers[i]];
      }
      // Assign to non-desert hexes in any order
      let ni = 0;
      for (const hexIdx of SPIRAL_ORDER) {
        if (tiles[hexIdx] !== DESERT) hexNumbers[hexIdx] = numbers[ni++];
      }
    } else {
      let numIdx = 0;
      for (const hexIdx of SPIRAL_ORDER) {
        if (tiles[hexIdx] !== DESERT) hexNumbers[hexIdx] = OFFICIAL_NUMBERS[numIdx++];
      }
    }

    const layout = HEX_LAYOUT;
    const hexes = [];
    let hexId = 0;
    for (let row = 0; row < layout.length; row++) {
      const count = layout[row];
      for (let col = 0; col < count; col++) {
        const idx = hexId;
        const resource = tiles[idx];
        hexes.push({
          id: hexId++,
          resource,
          number: hexNumbers[idx],
          row,
          col,
          hasRobber: resource === DESERT
        });
      }
    }

    // Generate vertices and edges
    const vertices = this._generateVertices(hexes, layout);
    const edges = this._generateEdges(vertices, hexes, layout);
    const ports = this._generatePorts(hexes, layout, vertices, edges);

    return { hexes, vertices, edges, ports };
  }

  _shuffleTiles() {
    const tiles = [];
    for (const [res, count] of Object.entries(TILE_COUNTS)) {
      for (let i = 0; i < count; i++) tiles.push(res);
    }
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  _generateVertices(hexes, layout) {
    // Each hex has 6 vertices, shared with neighbors
    // We'll compute pixel positions and deduplicate
    const SIZE = 1; // unit hex size
    const vertices = [];
    const vertexMap = new Map(); // "x,y" -> vertex id

    const getOrCreateVertex = (x, y) => {
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
      if (vertexMap.has(key)) return vertexMap.get(key);
      const id = vertices.length;
      const v = { id, x, y, building: null, owner: null, port: null, adjHexes: [], adjEdges: [] };
      vertices.push(v);
      vertexMap.set(key, id);
      return id;
    };

    for (const hex of hexes) {
      const { cx, cy } = this._hexCenter(hex.row, hex.col, layout);
      hex.cx = cx;
      hex.cy = cy;
      hex.vertices = [];

      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 180 * (60 * i - 30);
        const vx = cx + SIZE * Math.cos(angle);
        const vy = cy + SIZE * Math.sin(angle);
        const vid = getOrCreateVertex(vx, vy);
        hex.vertices.push(vid);
        if (!vertices[vid].adjHexes.includes(hex.id)) {
          vertices[vid].adjHexes.push(hex.id);
        }
      }
    }

    return vertices;
  }

  _hexCenter(row, col, layout) {
    const SIZE = 1;
    const W = Math.sqrt(3) * SIZE;
    const H = 2 * SIZE;
    const maxCols = Math.max(...layout);
    const offsetX = (maxCols - layout[row]) / 2;
    const cx = (col + offsetX + 0.5) * W;
    const cy = row * H * 0.75 + SIZE;
    return { cx, cy };
  }

  _generateEdges(vertices, hexes, layout) {
    const edges = [];
    const edgeMap = new Map();

    const getOrCreateEdge = (v1, v2) => {
      const key = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
      if (edgeMap.has(key)) return edgeMap.get(key);
      const id = edges.length;
      const e = { id, v1, v2, road: null, owner: null };
      edges.push(e);
      edgeMap.set(key, id);
      vertices[v1].adjEdges.push(id);
      vertices[v2].adjEdges.push(id);
      return id;
    };

    for (const hex of hexes) {
      hex.edges = [];
      const verts = hex.vertices;
      for (let i = 0; i < 6; i++) {
        const eid = getOrCreateEdge(verts[i], verts[(i + 1) % 6]);
        if (!hex.edges.includes(eid)) hex.edges.push(eid);
      }
    }

    return edges;
  }

  _generatePorts(hexes, layout, vertices, edges) {
    // ── Standard Catan port layout (clockwise from top-left) ────────
    // From the official board photo — 9 ports, exact positions:
    const STANDARD_PORT_TYPES = [
      'ore',    // top-left     (2:1 ore)
      'any',    // top          (3:1 generic)
      'brick',  // top-right    (2:1 brick)
      'any',    // right-upper  (3:1 generic)
      'any',    // right-lower  (3:1 generic)
      'wood',   // bottom-right (2:1 wood)
      'any',    // bottom       (3:1 generic)
      'wheat',  // bottom-left  (2:1 wheat)
      'sheep',  // left         (2:1 sheep)
    ];

    // Build border edges dynamically by sorting outer vertices clockwise
    // This avoids hardcoded vertex IDs that depend on board generation order
    const outerVids = new Set(
      vertices.flatMap((v,i) => v.adjHexes.length <= 2 ? [i] : [])
    );

    // Compute centroid of outer vertices
    const outerArr = [...outerVids].map(i => ({id:i, x:vertices[i].x, y:vertices[i].y}));
    const cx = outerArr.reduce((s,v)=>s+v.x,0) / outerArr.length;
    const cy = outerArr.reduce((s,v)=>s+v.y,0) / outerArr.length;

    // Sort outer vertices clockwise by angle from centroid
    outerArr.sort((a,b) => Math.atan2(a.y-cy, a.x-cx) - Math.atan2(b.y-cy, b.x-cx));

    // Find consecutive outer vertex pairs that share an edge (adjEdges in common)
    // Two outer vertices are adjacent if they share an edge in the graph
    const edgeSet = new Set();
    edges.forEach(e => edgeSet.add(`${Math.min(e.v1,e.v2)}-${Math.max(e.v1,e.v2)}`));

    const borderPairs = [];
    for (let i = 0; i < outerArr.length; i++) {
      const a = outerArr[i].id;
      const b = outerArr[(i+1) % outerArr.length].id;
      const key = `${Math.min(a,b)}-${Math.max(a,b)}`;
      if (edgeSet.has(key)) borderPairs.push([a, b]);
    }

    // Assign port types
    let portTypes;
    if (this.randomPorts) {
      // Random: shuffle types, assign to border edge slots
      const types = [...STANDARD_PORT_TYPES];
      for (let i=types.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[types[i],types[j]]=[types[j],types[i]];}
      portTypes = types;
    } else {
      portTypes = STANDARD_PORT_TYPES;
    }

    // Map 9 port types onto 9 evenly-spaced border edges
    const total = borderPairs.length;
    const step  = total / 9;
    const chosen = Array.from({length:9}, (_,i) => borderPairs[Math.round(i*step) % total]);

    const ports = [];
    for (let i = 0; i < 9; i++) {
      const [va, vb] = chosen[i];
      const type  = portTypes[i] || 'any';
      const ratio = type === 'any' ? 3 : 2;
      const port  = { id: i, type, ratio, vertices: [va, vb] };
      ports.push(port);
      [va, vb].forEach(vid => { vertices[vid].port = { type, ratio }; });
    }
    return ports;
  }

  _generateDevDeck() {
    const deck = [];
    let vpIndex = 0;
    for (const [type, count] of Object.entries(DEV_CARD_COUNTS)) {
      for (let i = 0; i < count; i++) {
        if (type === 'victoryPoint') {
          deck.push({ type, subtype: VP_SUBTYPES[vpIndex++ % VP_SUBTYPES.length] });
        } else {
          deck.push(type);
        }
      }
    }
    deck.sort(() => Math.random() - 0.5);
    // debugDevCard: force specific card to be drawn first (pop takes from end)
    if (this.debugDevCard) {
      // Cards can be strings or objects (VP cards are objects with subtype)
      const mi = deck.findIndex(c => (typeof c === 'object' ? c.type : c) === this.debugDevCard);
      if (mi >= 0) [deck[deck.length-1], deck[mi]] = [deck[mi], deck[deck.length-1]];
    }
    return deck;
  }

  _buildSetupOrder() {
    const n = this.players.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    for (let i = n - 1; i >= 0; i--) order.push(i);
    return order;
  }

  // ---- SETUP PHASE ----

  placeInitialSettlement(vertexId) {
    if (this.phase !== 'setup1' && this.phase !== 'setup2') return { error: 'Not in setup phase' };
    if (this.waitingForRoad) return { error: 'Place road first' };

    const player = this.players[this.setupOrder[this.setupStep]];
    const vertex = this.board.vertices[vertexId];

    if (vertex.owner !== null) return { error: 'Vertex occupied' };
    if (!this._isValidSettlementPlacement(vertexId, null)) return { error: 'Too close to another settlement' };

    vertex.building = 'settlement';
    vertex.owner = player.id;
    player.settlements.push(vertexId);
    player.points += 1;

    this.lastSettlementPlaced = vertexId;
    this.waitingForRoad = true;

    // In setup2, give resources for adjacent hexes (unless zeroResources rule)
    if (this.phase === 'setup2' && !this.zeroResources) {
      for (const hexId of vertex.adjHexes) {
        const hex = this.board.hexes[hexId];
        if (hex.resource !== DESERT) {
          player.resources[hex.resource] = (player.resources[hex.resource] || 0) + 1;
        }
      }
    }

    this._checkWin(player);
    this._log('log_place_sett', {name: player.name});
    return { ok: true };
  }

  placeInitialRoad(edgeId) {
    if (!this.waitingForRoad) return { error: 'Place settlement first' };
    const player = this.players[this.setupOrder[this.setupStep]];
    const edge = this.board.edges[edgeId];

    if (edge.owner !== null) return { error: 'Edge occupied' };
    
    // Must be adjacent to last placed settlement
    const lastV = this.lastSettlementPlaced;
    if (edge.v1 !== lastV && edge.v2 !== lastV) return { error: 'Road must connect to settlement' };

    edge.road = 'road';
    edge.owner = player.id;
    player.roads.push(edgeId);

    this._log('log_place_road', {name: player.name});
    this.waitingForRoad = false;
    this.lastSettlementPlaced = null;
    // Don't advance setupStep here — player must press END_TURN explicitly
    // This allows undo on both settlement and road before confirming
    this.pendingSetupEndTurn = true;

    this._updateLongestRoad();
    return { ok: true };
  }

  setupEndTurn() {
    if (!this.pendingSetupEndTurn) return { error: 'Not waiting for setup end turn' };
    this.pendingSetupEndTurn = false;
    this.setupStep++;

    if (this.setupStep >= this.setupOrder.length) {
      this.phase = 'main';
      this.currentPlayerIndex = 0;
      this._log('log_setup_done');
      if (this.debugResources) {
        for (const p of this.players) {
          p.resources = { wood:10, brick:10, sheep:10, wheat:10, ore:10 };
        }
      }
    } else {
      const half = this.players.length;
      if (this.setupStep === half) this.phase = 'setup2';
    }
    return { ok: true };
  }

  // ---- MAIN GAME ----

  rollDice() {
    this.lastDrawnCard = null; // clear on new action
    if (this.phase !== 'main') return { error: 'Not in main phase' };
    if (this.diceRolled) return { error: 'Already rolled' };

    let d1, d2;
    if (this.debugForceDice) {
      const target = parseInt(this.debugForceDice);
      d1 = Math.min(6, Math.max(2, Math.ceil(target/2)));
      d2 = target - d1;
      if (d2 < 1) { d1--; d2 = target-d1; }
      if (d2 > 6) { d2 = 6; d1 = target-6; }
    } else {
      d1 = Math.floor(Math.random() * 6) + 1;
      d2 = Math.floor(Math.random() * 6) + 1;
    }
    const total = d1 + d2;
    this.diceValues = [d1, d2];
    this.diceRolled = true;

    this._log('log_roll', {name: this.currentPlayer.name, d1, d2, total});

    if (total === 7) {
      // Check who must discard
      this.pendingDiscard = this.players
        .filter(p => this._totalResources(p) > 7)
        .map(p => p.id);
      
      if (this.pendingDiscard.length === 0) {
        this.pendingRobber = true;
      }
    } else {
      this._distributeResources(total);
    }

    return { ok: true, dice: [d1, d2], total };
  }

  _distributeResources(number) {
    for (const hex of this.board.hexes) {
      if (hex.number === number && hex.id !== this.robberHexId) {
        for (const vid of hex.vertices) {
          const vertex = this.board.vertices[vid];
          if (vertex.owner !== null) {
            const player = this.players[vertex.owner];
            const amount = vertex.building === 'city' ? 2 : 1;
            player.resources[hex.resource] = (player.resources[hex.resource] || 0) + amount;
          }
        }
      }
    }
  }

  discardResources(playerId, resources) {
    const player = this.players[playerId];
    const total = this._totalResources(player);
    const discard = Object.values(resources).reduce((a, b) => a + b, 0);
    
    if (discard !== Math.floor(total / 2)) return { error: 'Wrong discard amount' };

    for (const [res, amt] of Object.entries(resources)) {
      if ((player.resources[res] || 0) < amt) return { error: 'Not enough resources' };
      player.resources[res] -= amt;
    }

    this.pendingDiscard = this.pendingDiscard.filter(id => id !== playerId);
    
    if (this.pendingDiscard.length === 0) {
      this.pendingRobber = true;
    }

    return { ok: true };
  }

  moveRobber(hexId) {
    if (!this.pendingRobber) return { error: 'No robber action pending' };
    if (hexId === this.robberHexId) return { error: 'Must move robber to a different hex' };

    const oldHex = this.board.hexes[this.robberHexId];
    oldHex.hasRobber = false;
    
    this.robberHexId = hexId;
    const newHex = this.board.hexes[hexId];
    newHex.hasRobber = true;
    this.pendingRobber = false;

    // Find candidates to steal from
    const candidates = new Set();
    for (const vid of newHex.vertices) {
      const vertex = this.board.vertices[vid];
      if (vertex.owner !== null && vertex.owner !== this.currentPlayerIndex) {
        candidates.add(vertex.owner);
      }
    }
    
    this.robberCandidates = [...candidates];
    
    if (this.robberCandidates.length === 1) {
      // Auto-steal
      return this.stealResource(this.robberCandidates[0]);
    } else if (this.robberCandidates.length > 1) {
      this.pendingSteal = true;
    }

    return { ok: true, candidates: this.robberCandidates };
  }

  stealResource(targetPlayerId) {
    const target = this.players[targetPlayerId];
    const resources = Object.entries(target.resources)
      .filter(([, amt]) => amt > 0)
      .flatMap(([res, amt]) => Array(amt).fill(res));
    
    if (resources.length > 0) {
      const stolen = resources[Math.floor(Math.random() * resources.length)];
      target.resources[stolen]--;
      this.currentPlayer.resources[stolen] = (this.currentPlayer.resources[stolen] || 0) + 1;
      this._log('log_steal', {name: this.currentPlayer.name, from: target.name});
    }

    this.pendingSteal = false;
    this.robberCandidates = [];
    return { ok: true };
  }

  buildSettlement(vertexId) {
    if (!this.diceRolled) return { error: 'Roll dice first' };
    const player = this.currentPlayer;
    
    if (!this._canAfford(player, COSTS.settlement)) return { error: 'Not enough resources' };
    if (!this._isValidSettlementPlacement(vertexId, player.id)) return { error: 'Invalid placement' };
    
    const vertex = this.board.vertices[vertexId];
    vertex.building = 'settlement';
    vertex.owner = player.id;
    player.settlements.push(vertexId);
    player.points += 1;
    this._spend(player, COSTS.settlement);
    this._updateLongestRoad();
    this._checkWin(player);
    this._log('log_build_sett', {name: player.name});
    return { ok: true };
  }

  buildCity(vertexId) {
    if (!this.diceRolled) return { error: 'Roll dice first' };
    const player = this.currentPlayer;
    
    if (!this._canAfford(player, COSTS.city)) return { error: 'Not enough resources' };
    
    const vertex = this.board.vertices[vertexId];
    if (vertex.owner !== player.id || vertex.building !== 'settlement') return { error: 'No settlement here' };
    
    vertex.building = 'city';
    player.settlements = player.settlements.filter(id => id !== vertexId);
    player.cities.push(vertexId);
    player.points += 1; // +1 more (already had +1 from settlement)
    this._spend(player, COSTS.city);
    this._checkWin(player);
    this._log('log_build_city', {name: player.name});
    return { ok: true };
  }

  buildRoad(edgeId) {
    if (!this.diceRolled && this.pendingRoadBuilding === 0) return { error: 'Roll dice first' };
    const player = this.currentPlayer;
    
    if (this.pendingRoadBuilding === 0 && !this._canAfford(player, COSTS.road)) return { error: 'Not enough resources' };
    if (!this._isValidRoadPlacement(edgeId, player.id)) return { error: 'Invalid road placement' };
    
    const edge = this.board.edges[edgeId];
    edge.road = 'road';
    edge.owner = player.id;
    player.roads.push(edgeId);
    
    if (this.pendingRoadBuilding > 0) {
      this.pendingRoadBuilding--;
    } else {
      this._spend(player, COSTS.road);
    }
    
    this._updateLongestRoad();
    this._log('log_build_road', {name: player.name});
    return { ok: true };
  }

  buyDevCard() {
    if (!this.diceRolled) return { error: 'Roll dice first' };
    const player = this.currentPlayer;
    
    if (this.devDeck.length === 0) return { error: 'No dev cards left' };
    if (!this.unlimitedDev && this.devCardBoughtThisTurn) return { error: 'One dev card per turn' };
    if (!this._canAfford(player, COSTS.devCard)) return { error: 'Not enough resources' };
    
    const drawn = this.devDeck.pop();
    const card = typeof drawn === 'object' ? drawn.type : drawn;
    const cardSubtype = typeof drawn === 'object' ? drawn.subtype : null;
    player.devCards.push({ type: card, subtype: cardSubtype, new: !this.instantDev }); // new = can't play this turn (unless instantDev)
    if (card === 'victoryPoint') { player.points += 1; this._checkWin(player); }
    this._spend(player, COSTS.devCard);
    this.devCardBoughtThisTurn = true;
    this._log('log_buy_dev', {name: player.name});
    this.lastDrawnCard = { playerId: player.id, card, subtype: cardSubtype }; // cleared on next action
    return { ok: true, card };
  }

  playDevCard(cardType, params = {}) {
    if (!this.diceRolled && cardType !== 'knight') return { error: 'Roll dice first (except knight)' };
    const player = this.currentPlayer;
    
    const cardIdx = player.devCards.findIndex(c => c.type === cardType && !c.new);
    if (cardIdx === -1) return { error: 'Card not available' };
    
    player.devCards.splice(cardIdx, 1);
    player.playedDevCards.push(cardType);

    switch (cardType) {
      case 'knight':
        player.knightsPlayed++;
        this.pendingRobber = true;
        this._updateLargestArmy();
        break;
      case 'victoryPoint': break; // points assigned at buy
      case 'roadBuilding':
        this.pendingRoadBuilding = 2;
        break;
      case 'yearOfPlenty':
        if (params.resources) {
          for (const res of params.resources) {
            player.resources[res] = (player.resources[res] || 0) + 1;
          }
        } else {
          this.pendingYearOfPlenty = 2;
        }
        break;
      case 'monopoly':
        if (params.resource) {
          for (const p of this.players) {
            if (p.id !== player.id) {
              const amt = p.resources[params.resource] || 0;
              p.resources[params.resource] = 0;
              player.resources[params.resource] = (player.resources[params.resource] || 0) + amt;
            }
          }
        } else {
          this.pendingMonopoly = true;
        }
        break;
    }

    this._log('log_play_card', {name: player.name, card: cardType});
    return { ok: true };
  }

  tradeOffer(msg) {
    if (!msg.accepted) return { ok: true, pending: true };

    const from = this.players[msg.fromId];
    const to   = this.players[msg.toId];
    if (!from || !to) return { error: 'Invalid players' };

    // Validate both sides before executing
    for (const [r, a] of Object.entries(msg.offer || {})) {
      const amt = parseInt(a) || 0;
      if (amt <= 0) continue;
      if ((from.resources[r] || 0) < amt)
        return { error: `${from.name} non ha abbastanza ${r} (serve ${amt}, ha ${from.resources[r]||0})` };
    }
    for (const [r, a] of Object.entries(msg.want || {})) {
      const amt = parseInt(a) || 0;
      if (amt <= 0) continue;
      if ((to.resources[r] || 0) < amt)
        return { error: `${to.name} non ha abbastanza ${r} (serve ${amt}, ha ${to.resources[r]||0})` };
    }

    // Execute
    for (const [r, a] of Object.entries(msg.offer || {})) {
      const amt = parseInt(a) || 0; if (amt <= 0) continue;
      from.resources[r] -= amt;
      to.resources[r] = (to.resources[r] || 0) + amt;
    }
    for (const [r, a] of Object.entries(msg.want || {})) {
      const amt = parseInt(a) || 0; if (amt <= 0) continue;
      to.resources[r] -= amt;
      from.resources[r] = (from.resources[r] || 0) + amt;
    }

    const offerStr = Object.entries(msg.offer||{}).filter(([,v])=>v>0).map(([r,v])=>`${v}×${r}`).join('+');
    const wantStr  = Object.entries(msg.want ||{}).filter(([,v])=>v>0).map(([r,v])=>`${v}×${r}`).join('+');
    this._log('log_player_trade', {from: from.name, to: to.name, offer: offerStr, want: wantStr});
    return { ok: true };
  }

  tradeWithBank(give, receive) {
    if (!this.diceRolled) return { error: 'Roll dice first' };
    if (give === receive) return { error: 'Cannot trade same resource' };
    const player = this.currentPlayer;
    const ratio = this._getTradeRatio(player, give);
    if ((player.resources[give] || 0) < ratio) {
      return { error: `Servono ${ratio} ${give} (hai ${player.resources[give]||0})` };
    }
    player.resources[give] -= ratio;
    player.resources[receive] = (player.resources[receive] || 0) + 1;
    this._log('log_bank_trade', {name: player.name, ratio, give, receive});
    return { ok: true, ratio };
  }

  endTurn() {
    this.lastDrawnCard = null;
    if (!this.diceRolled && this.phase === 'main') return { error: 'Roll dice first' };
    if (this.pendingRobber || this.pendingSteal) return { error: 'Resolve robber first' };
    if (this.pendingTrade) return { error: 'Resolve pending trade first' };
    if (this.pendingDiscard.length > 0) return { error: 'Players must discard first' };

    // Mark dev cards as playable next turn
    for (const card of this.currentPlayer.devCards) {
      card.new = false;
    }
    this.devCardBoughtThisTurn = false;

    this.diceRolled = false;
    this.diceValues = [0, 0];
    this.pendingRoadBuilding = 0;
    this.pendingYearOfPlenty = 0;
    this.pendingMonopoly = false;

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this._log('log_turn', {name: this.currentPlayer.name});
    return { ok: true };
  }

  // ---- HELPERS ----

  get currentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  _totalResources(player) {
    return Object.values(player.resources).reduce((a, b) => a + b, 0);
  }

  _canAfford(player, cost) {
    for (const [res, amt] of Object.entries(cost)) {
      if ((player.resources[res] || 0) < amt) return false;
    }
    return true;
  }

  _spend(player, cost) {
    for (const [res, amt] of Object.entries(cost)) {
      player.resources[res] -= amt;
    }
  }

  _isValidSettlementPlacement(vertexId, playerId) {
    const vertex = this.board.vertices[vertexId];
    if (vertex.owner !== null) return false;
    
    // Distance rule: no adjacent settlements
    for (const eid of vertex.adjEdges) {
      const edge = this.board.edges[eid];
      const neighborId = edge.v1 === vertexId ? edge.v2 : edge.v1;
      if (this.board.vertices[neighborId].owner !== null) return false;
    }

    // In main phase, must connect to own road
    if (playerId !== null && this.phase === 'main') {
      const connectedRoad = vertex.adjEdges.some(eid => this.board.edges[eid].owner === playerId);
      if (!connectedRoad) return false;
    }

    return true;
  }

  _isValidRoadPlacement(edgeId, playerId) {
    const edge = this.board.edges[edgeId];
    if (edge.owner !== null) return false;

    // Must connect to own settlement/city or existing road
    for (const vid of [edge.v1, edge.v2]) {
      const vertex = this.board.vertices[vid];
      if (vertex.owner === playerId) return true;
      // Check if connected to own road at this vertex
      if (vertex.owner === null || vertex.owner === playerId) {
        for (const adjEid of vertex.adjEdges) {
          if (adjEid !== edgeId && this.board.edges[adjEid].owner === playerId) return true;
        }
      }
    }
    return false;
  }

  _getTradeRatio(player, resource) {
    let best = 4;
    for (const v of [...player.settlements, ...player.cities]) {
      const port = this.board.vertices[v].port;
      if (!port) continue;
      if (port.type === resource) best = Math.min(best, port.ratio); // specific port wins
      else if (port.type === 'any') best = Math.min(best, port.ratio); // generic port
    }
    return best;
  }

  _updateLongestRoad() {
    // Compute road length for every player
    const lengths = this.players.map(p => this._computeLongestRoad(p.id));
    const maxLen  = Math.max(...lengths);

    const currentHolder = this.longestRoadOwner;
    const currentLen    = this.longestRoadLength || 0;

    if (maxLen < 5) {
      // Nobody qualifies — clear badge if it was held
      if (currentHolder !== null) {
        this.players[currentHolder].points -= 2;
        this.players[currentHolder].hasLongestRoad = false;
        this.longestRoadOwner  = null;
        this.longestRoadLength = 0;
      }
      return;
    }

    // Always keep lengths updated
    this.longestRoadLength = maxLen;

    // Find who has the longest road.
    // Tie-breaking: current holder keeps badge if they are still tied for max
    let newHolder = null;
    if (currentHolder !== null && lengths[currentHolder] === maxLen) {
      // Current holder still matches the max — badge stays
      newHolder = currentHolder;
    } else {
      // Find first player who strictly has the max
      newHolder = lengths.findIndex(l => l === maxLen);
    }

    if (newHolder !== currentHolder) {
      // Transfer badge
      if (currentHolder !== null) {
        this.players[currentHolder].points -= 2;
        this.players[currentHolder].hasLongestRoad = false;
      }
      this.players[newHolder].points += 2;
      this.players[newHolder].hasLongestRoad = true;
      this.longestRoadOwner  = newHolder;
      this._log('log_longest_road', {name: this.players[newHolder].name, len: maxLen});
    }
  }

  _computeLongestRoad(playerId) {
    const playerEdges = this.board.edges.filter(e => e.owner === playerId);
    if (playerEdges.length === 0) return 0;
    
    let maxLen = 0;
    
    const dfs = (edgeId, visitedEdges, lastVertex) => {
      if (visitedEdges.has(edgeId)) return 0;
      visitedEdges.add(edgeId);
      
      const edge = this.board.edges[edgeId];
      const nextV = edge.v1 === lastVertex ? edge.v2 : edge.v1;
      
      // Check if interrupted by opponent's settlement
      const nextVertex = this.board.vertices[nextV];
      if (nextVertex.owner !== null && nextVertex.owner !== playerId) {
        visitedEdges.delete(edgeId);
        return 1;
      }
      
      let maxBranch = 0;
      for (const adjEid of nextVertex.adjEdges) {
        if (this.board.edges[adjEid].owner === playerId) {
          const len = dfs(adjEid, visitedEdges, nextV);
          maxBranch = Math.max(maxBranch, len);
        }
      }
      
      visitedEdges.delete(edgeId);
      return 1 + maxBranch;
    };

    for (const edge of playerEdges) {
      const len1 = dfs(edge.id, new Set(), edge.v1);
      const len2 = dfs(edge.id, new Set(), edge.v2);
      maxLen = Math.max(maxLen, len1, len2);
    }

    return maxLen;
  }

  _updateLargestArmy() {
    const player = this.currentPlayer;
    if (player.knightsPlayed >= 3 && player.knightsPlayed > this.largestArmySize) {
      if (this.largestArmyOwner !== null && this.largestArmyOwner !== player.id) {
        const old = this.players[this.largestArmyOwner];
        old.points -= 2;
        old.hasLargestArmy = false;
      }
      if (this.largestArmyOwner !== player.id) {
        player.points += 2;
        player.hasLargestArmy = true;
        this.largestArmyOwner = player.id;
        this._log('log_largest_army', {name: player.name});
      }
      this.largestArmySize = player.knightsPlayed;
    }
  }

  _checkWin(player) {
    if (player.points >= this.winPoints) {
      this.winner = player.id;
    }
  }

  _log(key, params = {}) {
    this.log.unshift({ time: Date.now(), key, params });
    if (this.log.length > 50) this.log.pop();
  }

  getState() {
    return {
      players: this.players,
      board: this.board,
      phase: this.phase,
      currentPlayerIndex: this.currentPlayerIndex,
      setupStep: this.setupStep,
      setupOrder: this.setupOrder,
      waitingForRoad: this.waitingForRoad,
      pendingSetupEndTurn: this.pendingSetupEndTurn,
      diceRolled: this.diceRolled,
      diceValues: this.diceValues,
      robberHexId: this.robberHexId,
      pendingRobber: this.pendingRobber,
      pendingDiscard: this.pendingDiscard,
      pendingSteal: this.pendingSteal,
      robberCandidates: this.robberCandidates,
      pendingRoadBuilding: this.pendingRoadBuilding,
      pendingYearOfPlenty: this.pendingYearOfPlenty,
      pendingMonopoly: this.pendingMonopoly,
      longestRoadOwner: this.longestRoadOwner,
      longestRoadLength: this.longestRoadLength,
      largestArmyOwner: this.largestArmyOwner,
      devDeckSize: this.devDeck.length,
      devCardBoughtThisTurn: this.devCardBoughtThisTurn,
      unlimitedDev: this.unlimitedDev,
      instantDev: this.instantDev,
      winner: this.winner,
      log: this.log.slice(0, 10),
      tradeOffer: this.currentTradeOffer,
      lastDrawnCard: this.lastDrawnCard || null,
      skinId:        this.skinId,
      debugDevCard:   this.debugDevCard  || null,
      winPoints:      this.winPoints || 10,
      debugResources: this.debugResources || false,
      debugForceDice: this.debugForceDice || null
    };
  }

  // ── Undo support: deep serialize / restore ─────────────────────
  getSerializableState() {
    return JSON.parse(JSON.stringify({
      players:            this.players,
      board:              this.board,
      devDeck:            this.devDeck,
      currentPlayerIndex: this.currentPlayerIndex,
      phase:              this.phase,
      setupOrder:         this.setupOrder,
      setupStep:          this.setupStep,
      waitingForRoad:     this.waitingForRoad,
      lastSettlementPlaced: this.lastSettlementPlaced,
      diceRolled:         this.diceRolled,
      diceValues:         this.diceValues,
      robberHexId:        this.robberHexId,
      longestRoadOwner:   this.longestRoadOwner,
      longestRoadLength:  this.longestRoadLength,
      largestArmyOwner:   this.largestArmyOwner,
      largestArmySize:    this.largestArmySize,
      winner:             this.winner,
      log:                this.log,
      pendingRobber:      this.pendingRobber,
      pendingDiscard:     this.pendingDiscard,
      pendingSteal:       this.pendingSteal,
      robberCandidates:   this.robberCandidates,
      pendingRoadBuilding:this.pendingRoadBuilding,
      pendingYearOfPlenty:this.pendingYearOfPlenty,
      pendingMonopoly:    this.pendingMonopoly,
      currentTradeOffer:  this.currentTradeOffer,
      skinId:             this.skinId,
      unlimitedDev:       this.unlimitedDev,
      instantDev:         this.instantDev,
      devCardBoughtThisTurn: this.devCardBoughtThisTurn,
      pendingSetupEndTurn:this.pendingSetupEndTurn,
      hiddenResources:    this.hiddenResources,
    }));
  }

  restoreFromState(s) {
    this.players             = s.players;
    this.board               = s.board;
    this.devDeck             = s.devDeck;
    this.currentPlayerIndex  = s.currentPlayerIndex;
    this.phase               = s.phase;
    this.setupOrder          = s.setupOrder;
    this.setupStep           = s.setupStep;
    this.waitingForRoad      = s.waitingForRoad;
    this.pendingSetupEndTurn = s.pendingSetupEndTurn || false;
    this.lastSettlementPlaced= s.lastSettlementPlaced;
    this.diceRolled          = s.diceRolled;
    this.diceValues          = s.diceValues;
    this.robberHexId         = s.robberHexId;
    this.longestRoadOwner    = s.longestRoadOwner;
    this.longestRoadLength   = s.longestRoadLength;
    this.largestArmyOwner    = s.largestArmyOwner;
    this.largestArmySize     = s.largestArmySize;
    this.winner              = s.winner;
    this.log                 = s.log;
    this.pendingRobber       = s.pendingRobber;
    this.pendingDiscard      = s.pendingDiscard;
    this.skinId              = s.skinId || 'standard';
    this.unlimitedDev        = s.unlimitedDev !== false;
    this.instantDev          = !!s.instantDev;
    this.devCardBoughtThisTurn = s.devCardBoughtThisTurn || false;
    this.hiddenResources     = !!s.hiddenResources;
    this.pendingSteal        = s.pendingSteal;
    this.robberCandidates    = s.robberCandidates;
    this.pendingRoadBuilding = s.pendingRoadBuilding;
    this.pendingYearOfPlenty = s.pendingYearOfPlenty;
    this.pendingMonopoly     = s.pendingMonopoly;
    this.currentTradeOffer   = s.currentTradeOffer;
    for (const h of this.board.hexes) h.hasRobber = (h.id === this.robberHexId);
  }

}
module.exports = { CatanGame };
