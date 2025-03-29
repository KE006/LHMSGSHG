import * as THREE from 'three';

// Game state
let scene, camera, renderer, player, monster;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let gameOver = false;
let isHiding = false;
let nearLocker = null;
let isPointerLocked = false;

// Remove all other movement-related state variables
let flashlight, globalLight;
let health = 100;
let batteries = 3;
let glassShards = 0;
let requiredShards = 250;
let flashlightEnergy = 100;
let lastJumpScare = 0;
let walls = [];
let doors = [];
let lockers = [];
let miniMapCamera, miniMapRenderer;
let isFlashlightOn = true;
let flashlightBattery = 100;
let monsters = [];
let lastFlickerTime = 0;
let sanity = 100;
let lastWhisperTime = 0;
let lastEventTime = 0;
let gameStartTime = 0;
let monstersSpawned = false;
let currentLevel = 1;
let maxLevels = 5;

// Add keyboard state tracking
let keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    f: false,
    e: false
};

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.015);
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    // Create player model and add it to camera
    player = createPlayerModel();
    camera.add(player);

    // Create mini-map
    setupMiniMap();

    // Add lights
    setupLighting();

    // Create environment
    createEnvironment();

    // Create collectibles
    createCollectibles();

    // Set initial game state
    health = 100;
    sanity = 100;
    flashlightEnergy = 100;
    batteries = 4;
    glassShards = 0;
    gameOver = false;
    isHiding = false;
    monstersSpawned = false;
    currentLevel = 1;
    
    // Start with flashlight on
    flashlight.intensity = 2;
    globalLight.intensity = 1;

    // Set game start time
    gameStartTime = Date.now();

    // Add event listeners
    setupEventListeners();

    // Update UI
    updateUI();

    // Start game loop
    animate();
}

function setupMiniMap() {
    // Create mini-map camera with adjusted settings
    miniMapCamera = new THREE.OrthographicCamera(
        -25, 25, // left, right
        25, -25, // top, bottom
        0.1, 1000 // near, far
    );
    miniMapCamera.position.set(0, 30, 0); // Lower height for better visibility
    miniMapCamera.lookAt(0, 0, 0);

    // Create mini-map renderer with improved visibility
    miniMapRenderer = new THREE.WebGLRenderer({ 
        alpha: true,
        antialias: true
    });
    miniMapRenderer.setSize(250, 250); // Increased size
    miniMapRenderer.domElement.style.position = 'fixed';
    miniMapRenderer.domElement.style.bottom = '20px';
    miniMapRenderer.domElement.style.right = '20px';
    miniMapRenderer.domElement.style.border = '3px solid #ff0000';
    miniMapRenderer.domElement.style.borderRadius = '50%';
    miniMapRenderer.domElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    document.body.appendChild(miniMapRenderer.domElement);
}

function setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x111111, 0.2);
    scene.add(ambientLight);

    // Global light (for start time)
    globalLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 1);
    scene.add(globalLight);

    // Create flashlight with improved properties
    flashlight = new THREE.SpotLight(0xffffaa, 2, 20, Math.PI / 8, 0.4, 1);
    flashlight.castShadow = true;
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    
    // Create and add flashlight target
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -1);
    camera.add(flashlightTarget);
    flashlight.target = flashlightTarget;

    // Position flashlight at camera center
    flashlight.position.set(0, 0, 0.1);
    camera.add(flashlight);
    scene.add(camera);
}

function createEnvironment() {
    // Create textured floor with larger dimensions
    const floorTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/hardwood2_diffuse.jpg');
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(50, 50); // Increased texture repeat for larger floor
    
    const floorGeometry = new THREE.PlaneGeometry(200, 200); // Much larger floor
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        map: floorTexture,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create procedural maze
    createProceduralMaze();

    // Add doors in a more spread out pattern
    for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const radius = 45; // Increased radius for larger area
        const position = new THREE.Vector3(
            Math.cos(angle) * radius,
            2,
            Math.sin(angle) * radius
        );
        createDoor(position, angle + Math.PI);
    }

    // Add lockers in a more spread out pattern
    for (let i = 0; i < 15; i++) {
        const angle = (i / 15) * Math.PI * 2;
        const radius = 35; // Increased radius for larger area
        const position = new THREE.Vector3(
            Math.cos(angle) * radius,
            2,
            Math.sin(angle) * radius
        );
        createLocker(position, angle + Math.PI);
    }
}

function createProceduralMaze() {
    const mazeSize = 30;
    const wallHeight = 4;
    const wallWidth = 2;
    
    // Create wall geometries of different lengths
    const wallGeometries = {
        short: new THREE.BoxGeometry(wallWidth, wallHeight, wallWidth * 2),
        medium: new THREE.BoxGeometry(wallWidth, wallHeight, wallWidth * 4),
        long: new THREE.BoxGeometry(wallWidth, wallHeight, wallWidth * 6),
        extraLong: new THREE.BoxGeometry(wallWidth, wallHeight, wallWidth * 8)
    };

    const wallTexture = new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/brick_diffuse.jpg');
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(1, 2); // Adjust texture repeat for better appearance
    
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        map: wallTexture,
        roughness: 0.9,
        metalness: 0.1,
        normalScale: new THREE.Vector2(1, 1)
    });

    // Generate maze layout
    const mazeLayout = generateMaze(mazeSize);
    walls = []; // Clear walls array

    // Create boundary walls first
    const boundaryWallGeometry = new THREE.BoxGeometry(mazeSize * wallWidth * 3, wallHeight, wallWidth);
    const boundaryWallMaterial = wallMaterial.clone();
    boundaryWallMaterial.color.setHex(0x8B4513); // Different color for boundary

    // North and South boundaries
    const northWall = new THREE.Mesh(boundaryWallGeometry, boundaryWallMaterial);
    northWall.position.set(0, wallHeight/2, -mazeSize * wallWidth * 1.5);
    scene.add(northWall);
    walls.push(northWall);

    const southWall = new THREE.Mesh(boundaryWallGeometry, boundaryWallMaterial);
    southWall.position.set(0, wallHeight/2, mazeSize * wallWidth * 1.5);
    scene.add(southWall);
    walls.push(southWall);

    // East and West boundaries
    const sideWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, mazeSize * wallWidth * 3);
    const eastWall = new THREE.Mesh(sideWallGeometry, boundaryWallMaterial);
    eastWall.position.set(mazeSize * wallWidth * 1.5, wallHeight/2, 0);
    scene.add(eastWall);
    walls.push(eastWall);

    const westWall = new THREE.Mesh(sideWallGeometry, boundaryWallMaterial);
    westWall.position.set(-mazeSize * wallWidth * 1.5, wallHeight/2, 0);
    scene.add(westWall);
    walls.push(westWall);

    // Create internal maze walls
    for (let x = 0; x < mazeSize; x++) {
        for (let z = 0; z < mazeSize; z++) {
            if (mazeLayout[x][z].walls.north) {
                const wall = new THREE.Mesh(wallGeometries.medium, wallMaterial);
                wall.position.set(
                    (x - mazeSize/2) * wallWidth * 3,
                    wallHeight/2,
                    (z - mazeSize/2) * wallWidth * 3 - wallWidth
                );
                scene.add(wall);
                walls.push(wall);
            }
            if (mazeLayout[x][z].walls.east) {
                const wall = new THREE.Mesh(wallGeometries.medium, wallMaterial);
                wall.rotation.y = Math.PI / 2;
                wall.position.set(
                    (x - mazeSize/2) * wallWidth * 3 + wallWidth,
                    wallHeight/2,
                    (z - mazeSize/2) * wallWidth * 3
                );
                scene.add(wall);
                walls.push(wall);
            }
        }
    }
}

function generateMaze(size) {
    // Initialize maze with all walls
    const maze = Array(size).fill().map(() => 
        Array(size).fill().map(() => ({
            visited: false,
            walls: { north: true, east: true, south: true, west: true }
        }))
    );

    // Create outer boundary
    for (let x = 0; x < size; x++) {
        maze[x][0].walls.north = true;
        maze[x][size-1].walls.south = true;
    }
    for (let z = 0; z < size; z++) {
        maze[0][z].walls.west = true;
        maze[size-1][z].walls.east = true;
    }

    // Recursive backtracking maze generation
    function carve(x, z) {
        maze[x][z].visited = true;

        // Define possible directions
        const directions = shuffle([
            { dx: 0, dz: -1, dir: 'north', opposite: 'south' },
            { dx: 1, dz: 0, dir: 'east', opposite: 'west' },
            { dx: 0, dz: 1, dir: 'south', opposite: 'north' },
            { dx: -1, dz: 0, dir: 'west', opposite: 'east' }
        ]);

        // Try each direction
        for (const direction of directions) {
            const newX = x + direction.dx * 2; // Move two cells for wider corridors
            const newZ = z + direction.dz * 2;

            if (newX >= 0 && newX < size && newZ >= 0 && newZ < size && !maze[newX][newZ].visited) {
                // Remove walls between current cell and next cell
                maze[x][z].walls[direction.dir] = false;
                maze[newX][newZ].walls[direction.opposite] = false;

                // Also remove walls in the cell between (for wider corridors)
                const midX = x + direction.dx;
                const midZ = z + direction.dz;
                if (midX >= 0 && midX < size && midZ >= 0 && midZ < size) {
                    maze[midX][midZ].walls[direction.dir] = false;
                    maze[midX][midZ].walls[direction.opposite] = false;
                    maze[midX][midZ].visited = true;
                }

                carve(newX, newZ);
            }
        }
    }

    // Start maze generation from multiple points for better connectivity
    const startPoints = [
        {x: 1, z: 1},
        {x: size-2, z: 1},
        {x: 1, z: size-2},
        {x: size-2, z: size-2},
        {x: Math.floor(size/2), z: Math.floor(size/2)},
        {x: Math.floor(size/4), z: Math.floor(size/4)},
        {x: Math.floor(3*size/4), z: Math.floor(size/4)},
        {x: Math.floor(size/4), z: Math.floor(3*size/4)},
        {x: Math.floor(3*size/4), z: Math.floor(3*size/4)}
    ];

    startPoints.forEach(point => {
        if (!maze[point.x][point.z].visited) {
            carve(point.x, point.z);
        }
    });

    // Create more loops and connections for better navigation
    const numLoops = Math.floor(size * 0.8); // Increased number of loops
    for (let i = 0; i < numLoops; i++) {
        const x = Math.floor(Math.random() * (size-2)) + 1;
        const z = Math.floor(Math.random() * (size-2)) + 1;
        
        // Try to create both horizontal and vertical connections
        if (Math.random() < 0.5 && z > 0) {
            maze[x][z].walls.north = false;
            maze[x][z-1].walls.south = false;
        }
        if (Math.random() < 0.5 && x < size-1) {
            maze[x][z].walls.east = false;
            maze[x+1][z].walls.west = false;
        }
    }

    // Create main pathways
    for (let x = Math.floor(size/4); x < Math.floor(3*size/4); x++) {
        const z = Math.floor(size/2);
        maze[x][z].walls.east = false;
        maze[x+1][z].walls.west = false;
    }
    for (let z = Math.floor(size/4); z < Math.floor(3*size/4); z++) {
        const x = Math.floor(size/2);
        maze[x][z].walls.south = false;
        maze[x][z+1].walls.north = false;
    }

    // Remove some random walls to create more shortcuts
    const numShortcuts = Math.floor(size * 0.4); // Add shortcuts
    for (let i = 0; i < numShortcuts; i++) {
        const x = Math.floor(Math.random() * (size-2)) + 1;
        const z = Math.floor(Math.random() * (size-2)) + 1;
        
        if (Math.random() < 0.5) {
            maze[x][z].walls.north = false;
            if (z > 0) maze[x][z-1].walls.south = false;
        } else {
            maze[x][z].walls.east = false;
            if (x < size-1) maze[x+1][z].walls.west = false;
        }
    }

    // Reduce dead ends by removing some walls
    for (let x = 1; x < size-1; x++) {
        for (let z = 1; z < size-1; z++) {
            // Count walls
            let wallCount = 0;
            if (maze[x][z].walls.north) wallCount++;
            if (maze[x][z].walls.east) wallCount++;
            if (maze[x][z].walls.south) wallCount++;
            if (maze[x][z].walls.west) wallCount++;

            // If it's a dead end (3 walls), remove one random wall
            if (wallCount === 3) {
                const directions = ['north', 'east', 'south', 'west'].filter(dir => maze[x][z].walls[dir]);
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                maze[x][z].walls[randomDir] = false;
                
                // Remove corresponding wall in adjacent cell
                switch(randomDir) {
                    case 'north': if (z > 0) maze[x][z-1].walls.south = false; break;
                    case 'east': if (x < size-1) maze[x+1][z].walls.west = false; break;
                    case 'south': if (z < size-1) maze[x][z+1].walls.north = false; break;
                    case 'west': if (x > 0) maze[x-1][z].walls.east = false; break;
                }
            }
        }
    }

    return maze;
}

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function createCollectibles() {
    // Create glass shards with better visibility
    const glassGeometry = new THREE.IcosahedronGeometry(0.3, 0);
    const glassMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ffff, // Bright cyan color
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x00ffff, // Matching emissive color
        emissiveIntensity: 0.8 // Increased glow
    });

    // Calculate maze bounds
    const mazeRadius = 45; // Based on the maze size in createEnvironment
    
    // Scatter shards throughout the maze
    for (let i = 0; i < requiredShards; i++) {
        const shard = new THREE.Mesh(glassGeometry, glassMaterial);
        
        // Generate random position within maze bounds
        let validPosition = false;
        while (!validPosition) {
            // Random position within maze bounds
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * mazeRadius;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Check if position is valid (not inside a wall)
            const testPosition = new THREE.Vector3(x, 1, z);
            if (!checkCollision(testPosition)) {
                shard.position.set(x, 1, z);
                validPosition = true;
            }
        }
        
        // Random rotation for visual variety
        shard.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        // Make shards slowly rotate to be more visible
        shard.userData.isGlassShard = true;
        shard.userData.rotationSpeed = {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        };
        scene.add(shard);
    }

    // Create batteries
    const batteryGeometry = new THREE.BoxGeometry(0.3, 0.6, 0.3);
    const batteryMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5
    });

    // Scatter batteries throughout the maze
    for (let i = 0; i < 5; i++) {
        const battery = new THREE.Mesh(batteryGeometry, batteryMaterial);
        
        // Generate random position within maze bounds
        let validPosition = false;
        while (!validPosition) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * mazeRadius;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Check if position is valid
            const testPosition = new THREE.Vector3(x, 1, z);
            if (!checkCollision(testPosition)) {
                battery.position.set(x, 1, z);
                validPosition = true;
            }
        }
        
        battery.userData.isBattery = true;
        scene.add(battery);
    }
}

function createMonsters() {
    // Create main monster
    const mainMonster = createMonster();
    scene.add(mainMonster);
    mainMonster.position.set(15, 2, 15);
    monsters.push(mainMonster);

    // Create additional monsters with different appearances
    const positions = [
        [-15, 2, -15],
        [-15, 2, 15],
        [15, 2, -15]
    ];

    positions.forEach(pos => {
        const monster = createMonsterVariant();
        scene.add(monster);
        monster.position.set(...pos);
        monsters.push(monster);
    });
}

function createMonsterVariant() {
    const monsterGroup = new THREE.Group();
    
    // Random color variations
    const hue = Math.random() * 0.1;
    const bodyColor = new THREE.Color().setHSL(hue, 1, 0.2);
    const emissiveColor = new THREE.Color().setHSL(hue, 1, 0.5);

    // Randomize monster size
    const scale = 0.8 + Math.random() * 0.4;
    
    // Create more detailed body using merged geometries
    const bodyGeometry = new THREE.SphereGeometry(1.5 * scale, 32, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: bodyColor,
        roughness: 0.7,
        metalness: 0.3,
        emissive: emissiveColor,
        emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    monsterGroup.add(body);

    // Add spikes
    const spikeCount = Math.floor(Math.random() * 8) + 8;
    const spikeGeometry = new THREE.ConeGeometry(0.2 * scale, 1 * scale, 8);
    const spikeMaterial = new THREE.MeshStandardMaterial({
        color: bodyColor,
        roughness: 0.6,
        metalness: 0.4,
        emissive: emissiveColor,
        emissiveIntensity: 0.3
    });

    for (let i = 0; i < spikeCount; i++) {
        const spike = new THREE.Mesh(spikeGeometry, spikeMaterial);
        const theta = (i / spikeCount) * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        spike.position.setFromSpherical(new THREE.Spherical(1.5 * scale, phi, theta));
        spike.lookAt(0, 0, 0);
        monsterGroup.add(spike);
    }

    // Add glowing eyes
    const eyeCount = Math.floor(Math.random() * 4) + 3;
    const eyeGeometry = new THREE.SphereGeometry(0.2 * scale, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
    });

    for (let i = 0; i < eyeCount; i++) {
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        const theta = (i / eyeCount) * Math.PI * 2;
        eye.position.set(
            Math.cos(theta) * scale,
            0.5 * scale,
            Math.sin(theta) * scale + 0.5
        );
        
        // Add pulsing glow effect
        eye.userData.pulseOffset = Math.random() * Math.PI * 2;
        monsterGroup.add(eye);
    }

    return monsterGroup;
}

function createMonster() {
    const monsterGroup = new THREE.Group();
    
    // Create more organic-looking body
    const bodyGeometry = new THREE.SphereGeometry(2, 32, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x330000,
        roughness: 0.7,
        metalness: 0.3,
        emissive: 0xff0000,
        emissiveIntensity: 0.5
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.y = 1.5;
    monsterGroup.add(body);

    // Add multiple eyes in a pattern
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 1
    });
    
    // Create a pattern of 6 eyes
    for (let i = 0; i < 6; i++) {
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.8;
        eye.position.set(
            Math.cos(angle) * radius,
            0.5,
            Math.sin(angle) * radius + 0.5
        );
        monsterGroup.add(eye);
    }

    // Add tentacles with segments
    const tentacleCount = 8;
    for (let i = 0; i < tentacleCount; i++) {
        const tentacle = createSegmentedTentacle(3, 0.2, 0.1);
        const angle = (i / tentacleCount) * Math.PI * 2;
        tentacle.position.set(
            Math.cos(angle) * 1.2,
            -1,
            Math.sin(angle) * 1.2
        );
        monsterGroup.add(tentacle);
    }

    return monsterGroup;
}

function createSegmentedTentacle(segments, startRadius, endRadius) {
    const tentacleGroup = new THREE.Group();
    const segmentLength = 0.5;
    
    for (let i = 0; i < segments; i++) {
        const radius = startRadius - ((startRadius - endRadius) * (i / segments));
        const geometry = new THREE.CylinderGeometry(radius, radius * 0.8, segmentLength, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x660000,
            roughness: 0.9,
            metalness: 0.1,
            emissive: 0x330000,
            emissiveIntensity: 0.3
        });
        
        const segment = new THREE.Mesh(geometry, material);
        segment.position.y = -i * segmentLength;
        segment.userData.segmentIndex = i;
        tentacleGroup.add(segment);
    }
    
    return tentacleGroup;
}

function checkCollision(position) {
    const playerRadius = 0.5;
    const wallMargin = 1.2;
    const maxDistance = 100; // Maximum distance from center

    // Check if player is too far from center
    if (position.length() > maxDistance) {
        return true;
    }

    for (const wall of walls) {
        const wallBox = new THREE.Box3().setFromObject(wall);
        const playerBox = new THREE.Box3();
        playerBox.min.set(
            position.x - playerRadius,
            position.y - 1.6,
            position.z - playerRadius
        );
        playerBox.max.set(
            position.x + playerRadius,
            position.y + 1.6,
            position.z + playerRadius
        );

        if (playerBox.intersectsBox(wallBox)) {
            return true;
        }
    }
    return false;
}

function update() {
    const currentTime = Date.now();
    
    // Check if it's time to spawn monsters and turn off lights
    if (!monstersSpawned && currentTime - gameStartTime >= 60000) {
        createMonsters();
        monstersSpawned = true;
        showWhisperMessage("They're here...");
        globalLight.intensity = 0;
        flashlight.intensity = 2;
    }

    // Update flashlight energy
    if (flashlight.intensity > 0) {
        flashlightEnergy = Math.max(0, flashlightEnergy - (0.001 / 3));
        if (flashlightEnergy === 0) {
            toggleFlashlight();
        }
    }

    // Handle movement
    if (!isHiding && !gameOver && isPointerLocked) {
        const speed = 0.2;
        const direction = new THREE.Vector3();

        // Calculate forward/backward movement
        if (moveForward) direction.z -= 1;
        if (moveBackward) direction.z += 1;
        if (moveLeft) direction.x -= 1;
        if (moveRight) direction.x += 1;

        // If there's any movement
        if (direction.length() > 0) {
            // Normalize the direction vector
            direction.normalize();
            
            // Get forward and right vectors from camera
            const forward = new THREE.Vector3(0, 0, -1);
            const right = new THREE.Vector3(1, 0, 0);
            
            // Apply camera rotation to vectors
            forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
            right.applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
            
            // Calculate movement vector
            const moveVector = new THREE.Vector3();
            moveVector.addScaledVector(forward, -direction.z * speed);
            moveVector.addScaledVector(right, direction.x * speed);

            // Calculate new position
            const newPosition = camera.position.clone();
            newPosition.add(moveVector);

            // Check collision and update position
            if (!checkCollision(newPosition)) {
                camera.position.copy(newPosition);
            }
        }
    }

    // Only update monsters if spawned and player not hiding
    if (monstersSpawned && !isHiding && !gameOver) {
        updateMonsters();
    }

    checkCollectibles();
    updateMiniMap();
    updateUI();
}

function updateMiniMap() {
    if (!miniMapCamera || !miniMapRenderer) return;

    // Update mini-map camera position to follow player
    miniMapCamera.position.set(camera.position.x, 30, camera.position.z);
    
    // Update mini-map camera rotation to match player orientation
    const lookAtPoint = new THREE.Vector3(
        camera.position.x + Math.sin(camera.rotation.y) * 10,
        0,
        camera.position.z + Math.cos(camera.rotation.y) * 10
    );
    
    miniMapCamera.lookAt(lookAtPoint);
    
    // Ensure proper rendering
    miniMapRenderer.clear();
    miniMapRenderer.render(scene, miniMapCamera);
}

// Animation loop with proper timing
function animate() {
    requestAnimationFrame(animate);
    
    // Ensure game state is updated
    if (!gameOver) {
        update();
    }
    
    // Render the scene
    renderer.render(scene, camera);
    
    // Update mini-map if available
    if (miniMapRenderer && miniMapCamera) {
        miniMapRenderer.render(scene, miniMapCamera);
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle keyboard input
function onKeyDown(event) {
    switch(event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'KeyF': toggleFlashlight(); break;
        case 'KeyE': 
            if (nearLocker) toggleHiding();
            break;
    }
}

function onKeyUp(event) {
    switch(event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
    }
}

function onMouseMove(event) {
    if (isPointerLocked) {
        camera.rotation.y -= event.movementX * 0.002;
    }
}

function requestPointerLock() {
    document.body.requestPointerLock();
}

function onPointerLockChange() {
    isPointerLocked = document.pointerLockElement === document.body;
    console.log('Pointer lock changed:', isPointerLocked);
}

function setupEventListeners() {
    // Remove any existing event listeners
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', requestPointerLock);
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    
    // Add fresh event listeners
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('click', requestPointerLock);
    document.addEventListener('pointerlockchange', onPointerLockChange);
}

function updateUI() {
    document.getElementById('health').textContent = 
        `Health: ${Math.ceil(health)} | Sanity: ${Math.ceil(sanity)}% | Level: ${currentLevel}`;
    document.getElementById('flashlight').innerHTML = 
        `Flashlight: ${flashlight.intensity === 0 ? 'OFF' : 'ON'} (${Math.round(flashlightEnergy)}%) | Batteries: ${batteries} | Shards: ${glassShards}/${requiredShards}`;
}

function checkCollectibles() {
    const playerPosition = camera.position;
    
    scene.children.forEach(object => {
        if (object.userData.isGlassShard && object.position.distanceTo(playerPosition) < 2) {
            scene.remove(object);
            glassShards++;
            if (glassShards === requiredShards) {
                alert('You found all the glass shards! Now escape!');
            }
        } else if (object.userData.isBattery && object.position.distanceTo(playerPosition) < 2) {
            scene.remove(object);
            batteries++;
            updateUI();
        }
    });
}

function triggerJumpScare() {
    const now = Date.now();
    if (now - lastJumpScare > 30000 && Math.random() < 0.001) {
        flashlight.intensity = 5;
        setTimeout(() => flashlight.intensity = 2, 100);
        lastJumpScare = now;
    }
}

function toggleFlashlight() {
    if (flashlightEnergy <= 0 && batteries > 0) {
        flashlight.intensity = 2;
        flashlightEnergy = 100;
        batteries--;
        updateUI();
    } else if (flashlightEnergy <= 0) {
        flashlight.intensity = 0;
        updateUI();
    } else {
        // Toggle flashlight if we have energy
        flashlight.intensity = flashlight.intensity === 0 ? 2 : 0;
        updateUI();
    }
}

function handleRandomEvents() {
    const now = Date.now();
    
    // Random flickering
    if (now - lastFlickerTime > 10000 && Math.random() < 0.01) {
        flashlight.intensity = flashlight.intensity > 0 ? 0 : 2;
        setTimeout(() => {
            if (!gameOver) flashlight.intensity = flashlight.intensity > 0 ? 0 : 2;
        }, 100);
        lastFlickerTime = now;
    }

    // Random whispers
    if (now - lastWhisperTime > 15000 && Math.random() < 0.005) {
        const whisperMessages = [
            "Behind you...",
            "Run...",
            "They're coming...",
            "Can't escape..."
        ];
        const message = whisperMessages[Math.floor(Math.random() * whisperMessages.length)];
        showWhisperMessage(message);
        lastWhisperTime = now;
        decreaseSanity(5);
    }

    // Random events
    if (now - lastEventTime > 20000 && Math.random() < 0.01) {
        const randomEvent = Math.random();
        if (randomEvent < 0.3) {
            // Temporary monster spawn
            const tempMonster = createMonsterVariant();
            const angle = Math.random() * Math.PI * 2;
            const distance = 10;
            tempMonster.position.set(
                camera.position.x + Math.cos(angle) * distance,
                2,
                camera.position.z + Math.sin(angle) * distance
            );
            monsters.push(tempMonster);
            scene.add(tempMonster);
            setTimeout(() => {
                scene.remove(tempMonster);
                monsters = monsters.filter(m => m !== tempMonster);
            }, 5000);
        } else if (randomEvent < 0.6) {
            // Sanity effect
            camera.rotation.z = (Math.random() - 0.5) * 0.1;
            setTimeout(() => {
                camera.rotation.z = 0;
            }, 2000);
        }
        lastEventTime = now;
    }
}

function updateMonsters() {
    monsters.forEach((monster, index) => {
        if (!monster) return;

        // Animate monster parts
        monster.children.forEach((child, partIndex) => {
            if (partIndex > 0) { // Skip body
                child.rotation.x = Math.sin(Date.now() * 0.005 + partIndex) * 0.3;
                child.rotation.z = Math.cos(Date.now() * 0.005 + partIndex) * 0.3;
            }
        });

        // Different behavior for different monsters
        let speed = 0.05;
        if (index === 0) { // Main monster - direct chase
            speed = 0.06;
        } else { // Other monsters - flanking behavior
            const angle = Date.now() * 0.001 + index * Math.PI / 2;
            const circleRadius = 10;
            const targetX = camera.position.x + Math.cos(angle) * circleRadius;
            const targetZ = camera.position.z + Math.sin(angle) * circleRadius;
            const tempTarget = new THREE.Vector3(targetX, 2, targetZ);
            monster.lookAt(tempTarget);
        }

        const monsterDirection = new THREE.Vector3();
        monsterDirection.subVectors(camera.position, monster.position).normalize();
        
        const newMonsterPosition = monster.position.clone();
        newMonsterPosition.add(monsterDirection.multiplyScalar(speed));
        
        if (!checkCollision(newMonsterPosition)) {
            monster.position.copy(newMonsterPosition);
        }

        // Check if monster caught player
        const distanceToMonster = monster.position.distanceTo(camera.position);
        if (distanceToMonster < 2) {
            health -= 0.5; // Reduced damage per monster
            decreaseSanity(1);
            
            if (health <= 0) {
                gameOver = true;
                alert('Game Over! The monsters caught you!');
            }
        }
    });
}

function showWhisperMessage(message) {
    const whisper = document.createElement('div');
    whisper.style.position = 'fixed';
    whisper.style.color = '#ff0000';
    whisper.style.fontSize = '24px';
    whisper.style.fontFamily = 'Arial';
    whisper.style.opacity = '0';
    whisper.style.transition = 'opacity 2s';
    whisper.style.pointerEvents = 'none';
    whisper.style.textShadow = '2px 2px 4px #000';
    whisper.style.left = Math.random() * 60 + 20 + '%';
    whisper.style.top = Math.random() * 60 + 20 + '%';
    whisper.textContent = message;
    
    document.body.appendChild(whisper);
    
    setTimeout(() => whisper.style.opacity = '0.7', 100);
    setTimeout(() => {
        whisper.style.opacity = '0';
        setTimeout(() => document.body.removeChild(whisper), 2000);
    }, 3000);
}

function decreaseSanity(amount) {
    sanity = Math.max(0, sanity - amount);
    if (sanity < 30) {
        // Visual effects for low sanity
        camera.rotation.z = (Math.random() - 0.5) * 0.1;
        setTimeout(() => {
            camera.rotation.z = 0;
        }, 1000);
    }
}

function checkInteractables() {
    const playerPosition = camera.position;
    let foundInteractable = false;

    // Check doors
    doors.forEach(door => {
        if (door.position.distanceTo(playerPosition) < 2) {
            showInteractPrompt('Press E to use door');
            foundInteractable = true;
            if (keys.e) {
                changeLevel(door.userData.targetLevel);
            }
        }
    });

    // Check lockers
    nearLocker = null;
    lockers.forEach(locker => {
        if (locker.position.distanceTo(playerPosition) < 2) {
            showInteractPrompt(isHiding ? 'Press E to exit locker' : 'Press E to hide in locker');
            foundInteractable = true;
            nearLocker = locker;
            if (keys.e) {
                toggleHiding();
            }
        }
    });

    if (!foundInteractable) {
        hideInteractPrompt();
    }
}

function toggleHiding() {
    if (nearLocker) {
        isHiding = !isHiding;
        if (isHiding) {
            // Store player's position and move camera to locker view
            camera.userData.previousPosition = camera.position.clone();
            camera.position.copy(nearLocker.position);
            camera.rotation.y = nearLocker.rotation.y;
        } else {
            // Restore player's position
            camera.position.copy(camera.userData.previousPosition);
        }
    }
}

function changeLevel(level) {
    currentLevel = level;
    // Reset player position
    camera.position.set(0, 1.6, 5);
    // Clear existing maze and create new one
    clearLevel();
    createEnvironment();
    showWhisperMessage(`Level ${currentLevel}`);
}

function clearLevel() {
    // Remove all walls, doors, and lockers
    [...walls, ...doors, ...lockers].forEach(object => {
        scene.remove(object);
    });
    walls = [];
    doors = [];
    lockers = [];
}

function showInteractPrompt(text) {
    let prompt = document.getElementById('interactPrompt');
    if (!prompt) {
        prompt = document.createElement('div');
        prompt.id = 'interactPrompt';
        prompt.style.position = 'fixed';
        prompt.style.bottom = '20%';
        prompt.style.left = '50%';
        prompt.style.transform = 'translateX(-50%)';
        prompt.style.color = '#ffffff';
        prompt.style.fontSize = '20px';
        prompt.style.fontFamily = 'Arial';
        prompt.style.textShadow = '2px 2px 4px #000';
        document.body.appendChild(prompt);
    }
    prompt.textContent = text;
    prompt.style.display = 'block';
}

function hideInteractPrompt() {
    const prompt = document.getElementById('interactPrompt');
    if (prompt) {
        prompt.style.display = 'none';
    }
}

function createDoor(position, rotation) {
    const doorGroup = new THREE.Group();
    
    // Door frame
    const frameGeometry = new THREE.BoxGeometry(2.2, 4, 0.3);
    const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x8B4513,
        emissiveIntensity: 0.3
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    doorGroup.add(frame);

    // Door
    const doorGeometry = new THREE.BoxGeometry(2, 3.8, 0.2);
    const doorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x8B4513,
        emissiveIntensity: 0.2
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.z = 0.15;
    doorGroup.add(door);

    // Door handle
    const handleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xC0C0C0,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xC0C0C0,
        emissiveIntensity: 0.5
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.5, 0, 0.3);
    doorGroup.add(handle);

    // Add some details
    // Door hinges
    const hingeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8);
    const hingeMaterial = handleMaterial;
    
    const topHinge = new THREE.Mesh(hingeGeometry, hingeMaterial);
    topHinge.position.set(-0.9, 1.5, 0.15);
    doorGroup.add(topHinge);
    
    const bottomHinge = new THREE.Mesh(hingeGeometry, hingeMaterial);
    bottomHinge.position.set(-0.9, -1.5, 0.15);
    doorGroup.add(bottomHinge);

    // Add a bright glow around the door frame
    const glowGeometry = new THREE.BoxGeometry(2.4, 4.2, 0.1);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x8B4513,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.2;
    doorGroup.add(glow);

    // Position and rotate the door
    doorGroup.position.copy(position);
    doorGroup.rotation.y = rotation;

    // Add metadata
    doorGroup.userData.isDoor = true;
    doorGroup.userData.isInteractable = true;
    doorGroup.userData.targetLevel = Math.floor(Math.random() * maxLevels) + 1;

    // Add to tracking arrays
    doors.push(doorGroup);
    
    return doorGroup;
}

function createLocker(position, rotation) {
    const lockerGroup = new THREE.Group();
    
    // Locker frame
    const frameGeometry = new THREE.BoxGeometry(1.2, 2.5, 0.8);
    const frameMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4a4a4a,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0x4a4a4a,
        emissiveIntensity: 0.3
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    lockerGroup.add(frame);

    // Locker door
    const doorGeometry = new THREE.BoxGeometry(1.1, 2.4, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a3a3a,
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x3a3a3a,
        emissiveIntensity: 0.2
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.z = 0.35;
    lockerGroup.add(door);

    // Locker handle
    const handleGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8);
    const handleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x808080,
        emissiveIntensity: 0.5
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.4, 0, 0.4);
    lockerGroup.add(handle);

    // Locker vents
    const ventGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.1);
    const ventMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a2a,
        roughness: 0.7,
        metalness: 0.3,
        emissive: 0x2a2a2a,
        emissiveIntensity: 0.2
    });
    
    // Top vent
    const topVent = new THREE.Mesh(ventGeometry, ventMaterial);
    topVent.position.set(0, 1, 0.4);
    lockerGroup.add(topVent);
    
    // Bottom vent
    const bottomVent = new THREE.Mesh(ventGeometry, ventMaterial);
    bottomVent.position.set(0, -1, 0.4);
    lockerGroup.add(bottomVent);

    // Add a bright glow around the locker
    const glowGeometry = new THREE.BoxGeometry(1.4, 2.7, 0.1);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x4a4a4a,
        transparent: true,
        opacity: 0.5
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.4;
    lockerGroup.add(glow);

    // Position and rotate the locker
    lockerGroup.position.copy(position);
    lockerGroup.rotation.y = rotation;

    // Add metadata
    lockerGroup.userData.isLocker = true;
    lockerGroup.userData.isInteractable = true;

    // Add to tracking arrays
    lockers.push(lockerGroup);
    
    return lockerGroup;
}

function createPlayerModel() {
    const playerGroup = new THREE.Group();

    // Create player body
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.8,
        metalness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -0.9; // Position below camera
    body.castShadow = true;
    playerGroup.add(body);

    // Add arms
    const armGeometry = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
    const armMaterial = bodyMaterial.clone();

    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.5, -0.7, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.5, -0.7, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    playerGroup.add(rightArm);

    return playerGroup;
}

// Start the game (only once)
init(); 