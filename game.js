/* ========================================
   PATTERN RECALL — GAME LOGIC
   ======================================== */

const GRID_WIDTH = 12;
const GRID_HEIGHT = 8;
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
    createGrid();
    bindEvents();
}

function createGrid() {
    grid.innerHTML = '';
    for (let i = 0; i < GRID_WIDTH * GRID_HEIGHT; i++) {
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
    
    grid.addEventListener('click', handleTileClick);
}

/* ========================================
   PATH GENERATION (Continuous, No Loops)
   ======================================== */

function generatePath() {
    let attempts = 0;
    const maxAttempts = 100;
    
    while (attempts < maxAttempts) {
        const path = attemptPathGeneration();
        if (path && path.length === PATH_LENGTH) {
            return path;
        }
        attempts++;
    }
    
    // Fallback: generate a simpler snake-like path
    return generateSnakePath();
}

function attemptPathGeneration() {
    const visited = new Set();
    const path = [];
    
    // Start from a random position
    const startX = Math.floor(Math.random() * GRID_WIDTH);
    const startY = Math.floor(Math.random() * GRID_HEIGHT);
    const startIndex = startY * GRID_WIDTH + startX;
    
    path.push(startIndex);
    visited.add(startIndex);
    
    while (path.length < PATH_LENGTH) {
        const current = path[path.length - 1];
        const neighbors = getUnvisitedNeighbors(current, visited, path);
        
        if (neighbors.length === 0) {
            // Dead end - backtrack
            if (path.length <= 1) return null;
            path.pop();
            continue;
        }
        
        // Choose a random neighbor, preferring those with more open neighbors
        const next = chooseNextTile(neighbors, visited, path);
        path.push(next);
        visited.add(next);
    }
    
    return path;
}

function getUnvisitedNeighbors(index, visited, path) {
    const x = index % GRID_WIDTH;
    const y = Math.floor(index / GRID_WIDTH);
    const neighbors = [];
    
    // Up, Down, Left, Right
    const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 }
    ];
    
    for (const { dx, dy } of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
            const neighborIndex = ny * GRID_WIDTH + nx;
            
            if (!visited.has(neighborIndex)) {
                // Check if adding this tile would create a loop
                if (!wouldCreateLoop(neighborIndex, path)) {
                    neighbors.push(neighborIndex);
                }
            }
        }
    }
    
    return neighbors;
}

function wouldCreateLoop(newIndex, path) {
    if (path.length < 3) return false;
    
    const newX = newIndex % GRID_WIDTH;
    const newY = Math.floor(newIndex / GRID_WIDTH);
    
    // Check if the new tile is adjacent to any tile in the path except the last one
    for (let i = 0; i < path.length - 1; i++) {
        const pathX = path[i] % GRID_WIDTH;
        const pathY = Math.floor(path[i] / GRID_WIDTH);
        
        const dx = Math.abs(newX - pathX);
        const dy = Math.abs(newY - pathY);
        
        // If adjacent (Manhattan distance of 1)
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            return true;
        }
    }
    
    return false;
}

function chooseNextTile(neighbors, visited, path) {
    // Score each neighbor by how many open neighbors it has
    const scored = neighbors.map(n => ({
        index: n,
        score: getUnvisitedNeighbors(n, new Set([...visited, n]), path).length
    }));
    
    // Prefer tiles with more options (less likely to dead-end)
    // But add some randomness
    scored.sort((a, b) => b.score - a.score);
    
    // Take from top half with some randomness
    const topHalf = scored.slice(0, Math.ceil(scored.length / 2));
    return topHalf[Math.floor(Math.random() * topHalf.length)].index;
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
    if (!e.target.classList.contains('tile')) return;
    if (gameState.mode !== 'RECALL') return;
    if (e.target.classList.contains('disabled')) return;
    
    const index = parseInt(e.target.dataset.index);
    
    // Check if already selected
    if (gameState.userSelected.includes(index)) return;
    
    // Check if this is a correct tile
    if (gameState.pattern.includes(index)) {
        // Correct!
        gameState.userSelected.push(index);
        e.target.classList.add('user-selected');
        updateProgress();
        
        // Check for win
        if (gameState.userSelected.length === PATH_LENGTH) {
            winGame();
        }
    } else {
        // Wrong tile - game over
        e.target.classList.add('wrong');
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