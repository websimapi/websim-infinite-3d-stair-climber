import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WebsimSocket } from 'websim';

// --- Constants ---
const USER_STAIRS_COLLECTION = 'user_stairs_v2'; // v2 for potential schema changes if needed
const STAIR_HEIGHT = 0.5;
const STAIR_WIDTH = 1.5;
const STAIR_DEPTH = 2.5;
const PLAYER_SIZE = 0.8;
const BOUNCE_HEIGHT = 0.6;
const BOUNCE_DURATION = 300; // ms
const CAMERA_OFFSET = new THREE.Vector3(7, 7, 7);
const MAX_STAIRS_PER_PLAYER_VISIBLE = 200; // Optimization: Limit visible stairs per player

// --- Setup ---
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // Add fog for depth perception

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x87CEEB); // Match body background
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// OrbitControls for camera interaction
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1; // Smoother damping
controls.screenSpacePanning = false;
controls.minDistance = 5;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 1.8; // Prevent looking straight down or from below ground
controls.target.set(0, 0, 0); // Initial target

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
scene.add(directionalLight);

// Ground (optional, but helps with shadows)
const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x77cc77, roughness: 1.0 }); // Grassy green
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -STAIR_HEIGHT; // Position below the first step's base
ground.receiveShadow = true;
scene.add(ground);

// --- Websim Database ---
const room = new WebsimSocket();
let myClimbData = null;
let myUsername = null;
let otherPlayersData = {}; // Store other players' data { username: { id, score, mesh?, stairsGroup?, lastUpdate: timestamp } }
let myPlayerObject = null; // Reference to my player data in otherPlayersData for easy access

// Generate a stable offset based on username hash
function getPlayerOffset(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // Convert to 32bit integer
    }
    // Use modulo to get somewhat distributed values within a range
    const xOffset = ((hash >> 16) % 21) - 10; // Range -10 to 10
    const zOffset = (hash % 21) - 10; // Range -10 to 10
    // Ensure offset isn't exactly (0,0) to avoid collision with potential central elements
    if (xOffset === 0 && zOffset === 0) {
        return { x: 1.5 * STAIR_WIDTH, z: 0 }; // Default offset if hash results in zero
    }
    return { x: xOffset * 1.5 * STAIR_WIDTH, z: zOffset * 1.5 * STAIR_DEPTH }; // Scale offsets
}

// Initialize my climb data or get existing
async function initMyClimbData() {
    try {
        const currentUser = await room.getCurrentUser();
        if (!currentUser || !currentUser.username) {
            console.error("Could not get current user info.");
            document.getElementById('my-score').textContent = "Error loading user data";
            return;
        }
        myUsername = currentUser.username;
        console.log("Current user:", myUsername);

        // Fetch existing data specifically for the user
        const existingData = room.collection(USER_STAIRS_COLLECTION).filter({ username: myUsername }).getList();

        if (existingData.length > 0) {
            myClimbData = existingData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            console.log("Existing data found:", myClimbData);
        } else {
            console.log("Creating new climb data for", myUsername);
            myClimbData = await room.collection(USER_STAIRS_COLLECTION).create({ score: 0 });
            if (!myClimbData) {
                throw new Error("Failed to create climb data in database.");
            }
            console.log("New data created:", myClimbData);
        }

        myPlayerObject = await ensurePlayerObjects(myClimbData.username, myClimbData.score, true, myClimbData.id);

        updateMyScoreDisplay();
        updateCameraTarget(true); // Initial camera positioning
    } catch (error) {
        console.error("Error initializing user data:", error);
        document.getElementById('my-score').textContent = "Error initializing";
    }
}

// Subscribe to all climb data for leaderboard and other players
room.collection(USER_STAIRS_COLLECTION).subscribe((allClimbData) => {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = ''; // Clear previous entries

    allClimbData.sort((a, b) => b.score - a.score);

    const currentPlayersUsernames = new Set();

    allClimbData.forEach(data => {
        if (!data || typeof data.username !== 'string' || typeof data.score !== 'number') {
            console.warn("Received invalid climb data:", data);
            return;
        }

        currentPlayersUsernames.add(data.username);

        const li = document.createElement('li');
        const avatar = document.createElement('img');
        avatar.src = `https://images.websim.ai/avatar/${data.username}`;
        avatar.alt = data.username;
        avatar.onerror = () => { avatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="40px" fill="%23333">?</text></svg>'; }; // Fallback avatar
        li.appendChild(avatar);
        li.appendChild(document.createTextNode(data.username));
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'score';
        scoreSpan.textContent = data.score;
        li.appendChild(scoreSpan);
        leaderboardList.appendChild(li);

        if (data.username === myUsername) {
            if (myPlayerObject && myClimbData && myClimbData.id === data.id && myClimbData.score !== data.score) {
                console.log("My score changed externally:", myClimbData.score, "->", data.score);
                if (!myPlayerObject.isBouncing) {
                    myClimbData.score = data.score;
                    myPlayerObject.score = data.score;
                    updatePlayerPosition(myPlayerObject, myClimbData.score); // Update my position
                    ensureStairs(myPlayerObject); // Update my stairs
                    updateMyScoreDisplay();
                } else {
                    console.log("Skipping external update during bounce animation.");
                }
            }
            if (myPlayerObject && myPlayerObject.username !== myUsername) {
                console.warn("myPlayerObject reference mismatch!");
                myPlayerObject = otherPlayersData[myUsername]; // Try to re-assign
            }
            if (myPlayerObject) myPlayerObject.lastUpdate = Date.now();
        } else {
            ensurePlayerObjects(data.username, data.score, false, data.id).then(playerData => {
                if (playerData && playerData.score !== data.score) {
                    updatePlayerPosition(playerData, data.score); // Update position
                    ensureStairs(playerData); // Update stairs
                }
                if (playerData) playerData.lastUpdate = Date.now();
            }).catch(err => console.error(`Error ensuring objects for ${data.username}:`, err));
        }
    });

    for (const username in otherPlayersData) {
        if (!currentPlayersUsernames.has(username) && username !== myUsername) {
            removePlayer(username);
        }
    }
});

// --- Player Representation ---
const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE);

function createPlayerMaterial(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        const char = username.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    const hue = (hash % 360 + 360) % 360; // Ensure positive hue
    const saturation = 0.6 + (hash % 40) / 100; // 0.6 - 1.0
    const lightness = 0.5 + (hash % 20) / 100; // 0.5 - 0.7
    const color = new THREE.Color();
    color.setHSL(hue / 360, saturation, lightness);
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
}

async function ensurePlayerObjects(username, score, isMe = false, recordId) {
    if (!otherPlayersData[username]) {
        console.log(`Creating objects for ${isMe ? 'myself' : 'other player'}: ${username}`);
        const playerMaterial = createPlayerMaterial(username);
        const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.castShadow = true;
        playerMesh.receiveShadow = false; // Players usually don't receive shadows on themselves

        const offset = getPlayerOffset(username);
        const initialY = score * STAIR_HEIGHT;

        playerMesh.position.set(offset.x, initialY, offset.z);
        scene.add(playerMesh);

        const stairsGroup = new THREE.Group();
        scene.add(stairsGroup);

        otherPlayersData[username] = {
            id: recordId,
            username: username,
            score: score,
            mesh: playerMesh,
            offset: offset,
            isMe: isMe,
            stairsGroup: stairsGroup,
            renderedStairIndices: new Set(),
            isBouncing: false,
            lastUpdate: Date.now()
        };
        ensureStairs(otherPlayersData[username]); // Create initial stairs
        return otherPlayersData[username];
    } else {
        const playerData = otherPlayersData[username];
        if (playerData.id !== recordId) {
            console.warn(`Record ID changed for ${username}: ${playerData.id} -> ${recordId}`);
            playerData.id = recordId;
        }
        playerData.lastUpdate = Date.now(); // Mark as recently updated/seen
        return playerData;
    }
}

function removePlayer(username) {
    const playerData = otherPlayersData[username];
    if (playerData && !playerData.isMe) {
        console.log(`Removing player ${username}`);
        if (playerData.mesh) {
            scene.remove(playerData.mesh);
            playerData.mesh.geometry.dispose(); // Cleanup geometry
            playerData.mesh.material.dispose(); // Cleanup material
        }
        if (playerData.stairsGroup) {
            playerData.stairsGroup.children.forEach(stair => {
                if (stair instanceof THREE.Mesh) {
                    if (stair.geometry) stair.geometry.dispose();
                    if (stair.material) stair.material.dispose();
                }
            });
            scene.remove(playerData.stairsGroup); // Remove all stairs at once
        }
        delete otherPlayersData[username];
    } else if (playerData && playerData.isMe) {
        console.warn("Attempted to remove own player object:", username);
    }
}

function updatePlayerPosition(playerData, newScore) {
    if (!playerData || !playerData.mesh) {
        console.warn("Attempted to update position for invalid player data:", playerData);
        return;
    }

    const targetY = newScore * STAIR_HEIGHT;

    if (!playerData.isMe) {
        playerData.mesh.position.y = targetY;
    } else if (!playerData.isBouncing) {
        playerData.mesh.position.y = targetY;
    }

    playerData.mesh.position.x = playerData.offset.x;
    playerData.mesh.position.z = playerData.offset.z;

    playerData.score = newScore;
}

function updateCameraTarget(immediate = false) {
    if (!myPlayerObject || !myPlayerObject.mesh) return;

    const targetPosition = new THREE.Vector3(
        myPlayerObject.offset.x,
        myPlayerObject.score * STAIR_HEIGHT,
        myPlayerObject.offset.z
    );

    if (immediate) {
        controls.target.copy(targetPosition);
        camera.position.copy(targetPosition).add(CAMERA_OFFSET);
        controls.update(); // Update controls immediately after setting target/position
    } else {
        controls.target.lerp(targetPosition, 0.1); // Adjust lerp factor for desired smoothness
    }
}

// --- Stairs ---
const stairGeometry = new THREE.BoxGeometry(STAIR_WIDTH, STAIR_HEIGHT, STAIR_DEPTH);
const stairMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });

function ensureStairs(playerData) {
    if (!playerData || !playerData.stairsGroup || !playerData.offset) {
        console.warn("ensureStairs called with invalid playerData:", playerData);
        return;
    }

    const { score, offset, stairsGroup, renderedStairIndices } = playerData;
    const currentScore = Math.max(0, Math.floor(score));
    const targetStairCount = currentScore + 1; // Need stair 0 up to stair 'currentScore'

    for (let i = Math.max(0, currentScore - MAX_STAIRS_PER_PLAYER_VISIBLE - 1); i < targetStairCount; i++) {
        if (!renderedStairIndices.has(i)) {
            const stair = new THREE.Mesh(stairGeometry, stairMaterial); // Use shared material
            stair.position.set(offset.x, i * STAIR_HEIGHT - (STAIR_HEIGHT / 2), offset.z); // Center stair vertically
            stair.castShadow = true;
            stair.receiveShadow = true;
            stair.userData.stairIndex = i; // Store index for potential removal
            stairsGroup.add(stair);
            renderedStairIndices.add(i);
        }
    }

    const stairsToRemove = [];
    stairsGroup.children.forEach(stair => {
        if (stair.userData.stairIndex === undefined || stair.userData.stairIndex < currentScore - MAX_STAIRS_PER_PLAYER_VISIBLE - 10) {
            stairsToRemove.push(stair);
            if (stair.userData.stairIndex !== undefined) {
                renderedStairIndices.delete(stair.userData.stairIndex);
            }
        }
    });

    stairsToRemove.forEach(stair => {
        stairsGroup.remove(stair);
    });
}

// --- Game Logic ---
let isClimbing = false;

async function climb() {
    if (isClimbing || !myClimbData || !myPlayerObject || myPlayerObject.isBouncing) {
        console.log("Climb blocked:", { isClimbing, myClimbData, myPlayerObject, isBouncing: myPlayerObject?.isBouncing });
        return;
    }

    if (!myPlayerObject.mesh || !myPlayerObject.stairsGroup) {
        console.error("Climb attempt with invalid player object references:", myPlayerObject);
        return;
    }

    isClimbing = true;

    const previousScore = myClimbData.score;
    const newScore = previousScore + 1;

    myClimbData.score = newScore;
    myPlayerObject.score = newScore;
    ensureStairs(myPlayerObject); // Add the new stair immediately
    updateMyScoreDisplay();
    myPlayerObject.isBouncing = true;

    const playerMesh = myPlayerObject.mesh;
    const startY = playerMesh.position.y; // Use current mesh Y as start, might not be exactly previousScore height if interrupted
    const peakY = newScore * STAIR_HEIGHT + BOUNCE_HEIGHT;
    const endY = newScore * STAIR_HEIGHT;
    const startTime = Date.now();

    function bounceStep() {
        if (!myPlayerObject || !myPlayerObject.isBouncing) {
            console.log("Bounce cancelled.");
            isClimbing = false;
            return;
        }
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / BOUNCE_DURATION, 1);
        let currentY;

        if (progress < 0.5) {
            const t = progress * 2; // Normalize to 0-1 for ascent phase
            currentY = startY + (peakY - startY) * (1 - (1 - t) * (1 - t)); // Ease out
        } else {
            const t = (progress - 0.5) * 2; // Normalize to 0-1 for descent phase
            currentY = peakY - (peakY - endY) * t * t; // Ease in
        }

        if (playerMesh && playerMesh.parent) {
            playerMesh.position.y = currentY;
        } else {
            console.warn("Player mesh removed during bounce animation.");
            myPlayerObject.isBouncing = false;
            isClimbing = false;
            return;
        }

        if (progress < 1) {
            requestAnimationFrame(bounceStep);
        } else {
            if (playerMesh && playerMesh.parent) {
                playerMesh.position.y = endY;
            }
            myPlayerObject.isBouncing = false;
        }
    }
    requestAnimationFrame(bounceStep);

    try {
        const updateResult = await room.collection(USER_STAIRS_COLLECTION).update(myClimbData.id, { score: newScore });
        if (!updateResult) {
            throw new Error("Database update failed or returned falsy.");
        }
    } catch (error) {
        console.error("Error updating score:", error);
        myClimbData.score = previousScore;
        if (myPlayerObject && myPlayerObject.score === newScore) {
            myPlayerObject.score = previousScore;
            if (!myPlayerObject.isBouncing && playerMesh && playerMesh.parent) {
                playerMesh.position.y = previousScore * STAIR_HEIGHT;
            }
            ensureStairs(myPlayerObject);
        }
        updateMyScoreDisplay();
        myPlayerObject.isBouncing = false;
    } finally {
        isClimbing = false;
    }
}

function updateMyScoreDisplay() {
    const scoreElement = document.getElementById('my-score');
    if (myClimbData) {
        scoreElement.textContent = `My Score: ${myClimbData.score}`;
    } else {
        scoreElement.textContent = `My Score: Loading...`;
    }
}

window.addEventListener('keydown', (event) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
    }

    if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        climb();
    }
});

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (myPlayerObject && (!controls.manualZoom || !controls.manualRotate || !controls.manualPan)) {
        updateCameraTarget();
    }

    controls.update();

    renderer.render(scene, camera);
}

initMyClimbData().then(() => {
    console.log("Initialization complete.");
    if (myUsername) {
        animate();
    } else {
        console.error("Initialization finished but user data is missing. Cannot start animation loop.");
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'absolute';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.padding = '20px';
        errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        errorDiv.style.color = 'white';
        errorDiv.style.borderRadius = '5px';
        errorDiv.textContent = 'Failed to load user data. Please refresh the page.';
        document.body.appendChild(errorDiv);
    }
}).catch(err => {
    console.error("Initialization failed:", err);
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'absolute';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translate(-50%, -50%)';
    errorDiv.style.padding = '20px';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    errorDiv.style.color = 'white';
    errorDiv.style.borderRadius = '5px';
    errorDiv.textContent = 'An error occurred during initialization. Please refresh.';
    document.body.appendChild(errorDiv);
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000;
    for (const username in otherPlayersData) {
        if (!otherPlayersData[username].isMe && now - (otherPlayersData[username].lastUpdate || 0) > timeout) {
            console.log(`Removing inactive player ${username} (last update: ${otherPlayersData[username].lastUpdate})`);
            removePlayer(username);
        }
    }
}, 60 * 1000);