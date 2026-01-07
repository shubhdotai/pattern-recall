/* ========================================
   PATTERN RECALL — GAME LOGIC
   ======================================== */

// Responsive grid dimensions
let GRID_WIDTH = 12;
let GRID_HEIGHT = 8;
const PATH_LENGTH = 36;

// Game State
let gameState = {
    pattern: [],           // Array of tile indices that form the path
    userSelected: [],      // Tiles user has selected in recall mode
    mode: 'IDLE',          // IDLE, MEMORIZE, RECALL
    timerInterval: null,
    startTime: null,
    peekCount: 0
};

// DOM Elements
const grid = document.getElementById('grid');
const overlay = document.getElementById('overlay');
const timerDisplay = document.getElementById('timer');
const progressDisplay = document.getElementById('progress');
const statusDisplay = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const peekBtn = document.getElementById('peekBtn');
const recallBtn = document.getElementById('recallBtn');
const gameOverModal = document.getElementById('gameOverModal');
const winModal = document.getElementById('winModal');
const retryBtn = document.getElementById('retryBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const failTimeDisplay = document.getElementById('failTime');
const winTimeDisplay = document.getElementById('winTime');
const peekCountDisplay = document.getElementById('peekCount');
const gridGlow = document.querySelector('.grid-glow');

/* ========================================
   INITIALIZATION
   ======================================== */

function init() {
    setGridDimensions();
    createGrid();
    bindEvents();
    
    // Handle resize
    window.addEventListener('resize', debounce(handleResize, 250));
}

function isMobileView() {
    // Use matchMedia for consistency with CSS media queries
    return window.matchMedia('(max-width: 600px)').matches;
}

function setGridDimensions() {
    if (isMobileView()) {
        GRID_WIDTH = 8;
        GRID_HEIGHT = 12;
    } else {
        GRID_WIDTH = 12;
        GRID_HEIGHT = 8;
    }
    
    // Update CSS grid columns explicitly
    grid.style.gridTemplateColumns = `repeat(${GRID_WIDTH}, 1fr)`;
}

function handleResize() {
    const currentlyMobile = GRID_WIDTH === 8;
    const shouldBeMobile = isMobileView();
    
    // Only rebuild if orientation changed and game is idle
    if (currentlyMobile !== shouldBeMobile && gameState.mode === 'IDLE') {
        setGridDimensions();
        createGrid();
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function createGrid() {
    grid.innerHTML = '';
    const totalTiles = GRID_WIDTH * GRID_HEIGHT;
    for (let i = 0; i < totalTiles; i++) {
        const tile = document.createElement('div');
        tile.className = 'tile disabled';
        tile.dataset.index = i;
        grid.appendChild(tile);
    }
}

function bindEvents() {
    startBtn.addEventListener('click', startGame);
    peekBtn.addEventListener('click', showPattern);
    recallBtn.addEventListener('click', startRecall);
    retryBtn.addEventListener('click', resetGame);
    playAgainBtn.addEventListener('click', resetGame);
    
    // Use pointerdown for better mobile response
    grid.addEventListener('pointerdown', handleTileClick);
    
    // Prevent double-tap zoom on mobile
    grid.addEventListener('touchstart', function(e) {
        if (e.target.classList.contains('tile')) {
            e.preventDefault();
        }
    }, { passive: false });
}

/* ========================================
   PATH GENERATION (Continuous, No Loops)
   ======================================== */

function generatePath() {
    let attempts = 0;
    const maxAttempts = 200;
    
    while (attempts < maxAttempts) {
        const path = attemptPathGeneration();
        if (path && path.length === PATH_LENGTH) {
            return path;
        }
        attempts++;
    }
    
    // Fallback: generate a simpler snake-like path
    console.log('Using fallback snake path');
    return generateSnakePath();
}

function attemptPathGeneration() {
    const visited = new Set();
    const path = [];
    
    // Start from a random position, avoiding edges for better path options
    const startX = 1 + Math.floor(Math.random() * (GRID_WIDTH - 2));
    const startY = 1 + Math.floor(Math.random() * (GRID_HEIGHT - 2));
    const startIndex = startY * GRID_WIDTH + startX;
    
    path.push(startIndex);
    visited.add(startIndex);
    
    let backtrackCount = 0;
    const maxBacktracks = 1000;
    
    while (path.length < PATH_LENGTH && backtrackCount < maxBacktracks) {
        const current = path[path.length - 1];
        const neighbors = getValidNeighbors(current, visited, path);
        
        if (neighbors.length === 0) {
            // Dead end - backtrack
            if (path.length <= 1) return null;
            const removed = path.pop();
            visited.delete(removed);
            backtrackCount++;
            continue;
        }
        
        // Choose next tile strategically
        const next = chooseNextTile(neighbors, visited, path);
        path.push(next);
        visited.add(next);
    }
    
    return path.length === PATH_LENGTH ? path : null;
}

function getValidNeighbors(index, visited, path) {
    const x = index % GRID_WIDTH;
    const y = Math.floor(index / GRID_WIDTH);
    const neighbors = [];
    
    // Up, Down, Left, Right
    const directions = [
        { dx: 0, dy: -1 },  // Up
        { dx: 0, dy: 1 },   // Down
        { dx: -1, dy: 0 },  // Left
        { dx: 1, dy: 0 }    // Right
    ];
    
    for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        // Check bounds
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
            const neighborIndex = ny * GRID_WIDTH + nx;
            
            // Check if not already visited
            if (!visited.has(neighborIndex)) {
                // Check if adding this tile would create a loop
                if (!wouldCreateLoop(neighborIndex, x, y, path)) {
                    neighbors.push(neighborIndex);
                }
            }
        }
    }
    
    return neighbors;
}

function wouldCreateLoop(newIndex, currentX, currentY, path) {
    if (path.length < 3) return false;
    
    const newX = newIndex % GRID_WIDTH;
    const newY = Math.floor(newIndex / GRID_WIDTH);
    
    // Check if the new tile is adjacent to any tile in the path 
    // EXCEPT the current last tile (which it should be adjacent to)
    for (let i = 0; i < path.length - 1; i++) {
        const pathIndex = path[i];
        const pathX = pathIndex % GRID_WIDTH;
        const pathY = Math.floor(pathIndex / GRID_WIDTH);
        
        // Check if adjacent (Manhattan distance of 1)
        const dx = Math.abs(newX - pathX);
        const dy = Math.abs(newY - pathY);
        
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            return true; // Would create a loop
        }
    }
    
    return false;
}

function chooseNextTile(neighbors, visited, path) {
    if (neighbors.length === 1) {
        return neighbors[0];
    }
    
    // Score each neighbor by how many valid neighbors it would have
    const scored = neighbors.map(n => {
        const futureVisited = new Set(visited);
        futureVisited.add(n);
        const futurePath = [...path, n];
        const futureNeighbors = getValidNeighbors(n, futureVisited, futurePath);
        return {
            index: n,
            score: futureNeighbors.length
        };
    });
    
    // Filter out tiles that would dead-end us (unless we're near the end)
    const remainingTiles = PATH_LENGTH - path.length;
    const viable = scored.filter(s => s.score > 0 || remainingTiles <= 2);
    
    if (viable.length === 0) {
        // Just pick randomly if no good options
        return neighbors[Math.floor(Math.random() * neighbors.length)];
    }
    
    // Prefer tiles with more options but add randomness
    viable.sort((a, b) => b.score - a.score);
    
    // Pick from top options with some randomness
    const topCount = Math.min(3, viable.length);
    const topOptions = viable.slice(0, topCount);
    return topOptions[Math.floor(Math.random() * topOptions.length)].index;
}

function generateSnakePath() {
    const path = [];
    let x = 0;
    let y = 0;
    let direction = 1; // 1 = right, -1 = left
    
    while (path.length < PATH_LENGTH) {
        const index = y * GRID_WIDTH + x;
        path.push(index);
        
        // Try to continue in current direction
        const nextX = x + direction;
        
        if (nextX >= 0 && nextX < GRID_WIDTH && path.length < PATH_LENGTH) {
            x = nextX;
        } else {
            // Move down and reverse direction
            y++;
            if (y >= GRID_HEIGHT) break;
            direction *= -1;
        }
    }
    
    return path;
}

/* ========================================
   GAME FLOW
   ======================================== */

function startGame() {
    // Ensure grid dimensions are set for current screen
    setGridDimensions();
    createGrid();
    
    // Generate new pattern
    gameState.pattern = generatePath();
    gameState.userSelected = [];
    gameState.peekCount = 0;
    gameState.mode = 'MEMORIZE';
    
    // Reset timer
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    gameState.startTime = Date.now();
    startTimer();
    
    // Update UI
    overlay.classList.add('hidden');
    gridGlow.classList.add('active');
    updateStatus('MEMORIZE', 'memorize');
    updateProgress();
    
    // Show pattern
    displayPattern();
    
    // Enable buttons
    startBtn.disabled = true;
    peekBtn.disabled = false;
    recallBtn.disabled = false;
    
    // Enable tiles for clicking
    enableTiles();
}

function showPattern() {
    if (gameState.mode === 'RECALL') {
        gameState.peekCount++;
    }
    
    gameState.mode = 'MEMORIZE';
    gameState.userSelected = [];
    
    updateStatus('MEMORIZE', 'memorize');
    updateProgress();
    displayPattern();
}

function startRecall() {
    gameState.mode = 'RECALL';
    
    updateStatus('RECALL', 'recall');
    clearGrid();
    enableTiles();
}

function handleTileClick(e) {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    if (gameState.mode !== 'RECALL') return;
    if (tile.classList.contains('disabled')) return;
    
    const index = parseInt(tile.dataset.index);
    
    // Check if already selected
    if (gameState.userSelected.includes(index)) return;
    
    // Check if this is a correct tile
    if (gameState.pattern.includes(index)) {
        // Correct!
        gameState.userSelected.push(index);
        tile.classList.add('user-selected');
        updateProgress();
        
        // Check for win
        if (gameState.userSelected.length === PATH_LENGTH) {
            winGame();
        }
    } else {
        // Wrong tile - game over
        tile.classList.add('wrong');
        loseGame();
    }
}

function winGame() {
    gameState.mode = 'IDLE';
    clearInterval(gameState.timerInterval);
    
    const elapsed = getElapsedTime();
    winTimeDisplay.textContent = elapsed;
    peekCountDisplay.textContent = gameState.peekCount;
    
    setTimeout(() => {
        winModal.classList.add('active');
    }, 500);
}

function loseGame() {
    gameState.mode = 'IDLE';
    clearInterval(gameState.timerInterval);
    
    // Disable all tiles
    disableTiles();
    
    const elapsed = getElapsedTime();
    failTimeDisplay.textContent = elapsed;
    
    // Show the correct pattern briefly
    setTimeout(() => {
        displayPattern();
    }, 300);
    
    setTimeout(() => {
        gameOverModal.classList.add('active');
    }, 1000);
}

function resetGame() {
    gameState.mode = 'IDLE';
    gameState.pattern = [];
    gameState.userSelected = [];
    gameState.peekCount = 0;
    
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
    }
    
    // Hide modals
    gameOverModal.classList.remove('active');
    winModal.classList.remove('active');
    
    // Reset UI
    overlay.classList.remove('hidden');
    gridGlow.classList.remove('active');
    clearGrid();
    disableTiles();
    
    timerDisplay.textContent = '00:00';
    progressDisplay.textContent = '0 / 36';
    updateStatus('READY', '');
    
    // Reset buttons
    startBtn.disabled = false;
    peekBtn.disabled = true;
    recallBtn.disabled = true;
}

/* ========================================
   UI UPDATES
   ======================================== */

function displayPattern() {
    const tiles = grid.querySelectorAll('.tile');
    
    tiles.forEach((tile, index) => {
        tile.classList.remove('green', 'red', 'user-selected', 'wrong');
        
        if (gameState.pattern.includes(index)) {
            tile.classList.add('green');
        }
    });
}

function clearGrid() {
    const tiles = grid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.classList.remove('green', 'red', 'user-selected', 'wrong');
    });
}

function enableTiles() {
    const tiles = grid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.classList.remove('disabled');
    });
}

function disableTiles() {
    const tiles = grid.querySelectorAll('.tile');
    tiles.forEach(tile => {
        tile.classList.add('disabled');
    });
}

function updateStatus(text, className) {
    statusDisplay.textContent = text;
    statusDisplay.classList.remove('memorize', 'recall');
    if (className) {
        statusDisplay.classList.add(className);
    }
}

function updateProgress() {
    progressDisplay.textContent = `${gameState.userSelected.length} / ${PATH_LENGTH}`;
}

/* ========================================
   TIMER
   ======================================== */

function startTimer() {
    gameState.timerInterval = setInterval(() => {
        timerDisplay.textContent = getElapsedTime();
    }, 100);
}

function getElapsedTime() {
    if (!gameState.startTime) return '00:00';
    
    const elapsed = Date.now() - gameState.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/* ========================================
   START
   ======================================== */

document.addEventListener('DOMContentLoaded', init);