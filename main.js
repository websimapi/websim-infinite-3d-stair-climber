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
// const helper = new THREE.CameraHelper( directionalLight.shadow.camera );
// scene.add( helper ); // Optional: Visualize shadow camera

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
    return { x: xOffset * 1.5 * STAIR_WIDTH, z: zOffset * 1.5 * STAIR_DEPTH }; // Scale offsets
}

// Initialize my climb data or get existing
async function initMyClimbData() {
    try {
        const currentUser = await room.getCurrentUser();
        myUsername = currentUser.username;
        console.log("Current user:", myUsername);

        const existingData = room.collection(USER_STAIRS_COLLECTION).filter({ username: myUsername }).getList();

        if (existingData.length > 0) {
            myClimbData = existingData[0];
            console.log("Existing data found:", myClimbData);
        } else {
            console.log("Creating new climb data for", myUsername);
            myClimbData = await room.collection(USER_STAIRS_COLLECTION).create({ score: 0 });
            console.log("New data created:", myClimbData);
        }

        if (myClimbData) {
            myPlayerObject = await ensurePlayerObjects(myClimbData.username, myClimbData.score, true, myClimbData.id);
            updateMyScoreDisplay();
            updateCameraTarget(true); // Initial camera positioning
        } else {
            console.error("Failed to initialize or create user climb data.");
            // Display an error message to the user?
        }

    } catch (error) {
        console.error("Error initializing user data:", error);
    }
}

// Subscribe to all climb data for leaderboard and other players
room.collection(USER_STAIRS_COLLECTION).subscribe((allClimbData) => {
    const leaderboardList = document.getElementById('leaderboard-list');
    leaderboardList.innerHTML = ''; // Clear previous entries

    // Sort by score descending
    allClimbData.sort((a, b) => b.score - a.score);

    const currentPlayersUsernames = new Set();

    // Process updates and add to leaderboard
    allClimbData.forEach(data => {
        currentPlayersUsernames.add(data.username);

        // Update Leaderboard UI
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

        // Update or create 3D representation for other players
        if (data.username !== myUsername) {
            ensurePlayerObjects(data.username, data.score, false, data.id).then(playerData => {
                if (playerData && playerData.score !== data.score) { // Only update if score changed
                    updatePlayerPosition(playerData, data.score); // Update position smoothly later if needed
                    ensureStairs(playerData); // Update stairs
                    playerData.score = data.score; // Update local score cache
                }
                if (playerData) playerData.lastUpdate = Date.now();
            });
        } else {
            // Update my own score if it changed unexpectedly (e.g., concurrent sessions)
            if (myClimbData && myPlayerObject && myClimbData.id === data.id && myClimbData.score !== data.score) {
                console.log("My score changed externally:", myClimbData.score, "->", data.score);
                myClimbData.score = data.score;
                myPlayerObject.score = data.score;
                updatePlayerPosition(myPlayerObject, myClimbData.score); // Update my position
                ensureStairs(myPlayerObject); // Update my stairs
                updateMyScoreDisplay();
            }
            if (myPlayerObject) myPlayerObject.lastUpdate = Date.now();
        }
    });

    // Remove players who are no longer in the data
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
    // Generate a color with decent saturation and brightness
    const hue = (hash % 360 + 360) % 360; // Ensure positive hue
    const saturation = 0.6 + (hash % 40) / 100; // 0.6 - 1.0
    const lightness = 0.5 + (hash % 20) / 100; // 0.5 - 0.7
    const color = new THREE.Color();
    color.setHSL(hue / 360, saturation, lightness);
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 });
}

async function ensurePlayerObjects(username, score, isMe = false, recordId) {
    if (!otherPlayersData[username]) {
        const playerMaterial = createPlayerMaterial(username);
        const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
        playerMesh.castShadow = true;
        playerMesh.receiveShadow = false; // Players usually don't receive shadows on themselves

        const offset = getPlayerOffset(username);
        const initialY = score * STAIR_HEIGHT;

        playerMesh.position.set(offset.x, initialY, offset.z);
        scene.add(playerMesh);

        // Create a group for this player's stairs
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
            isBouncing: false, // Add bounce state per player
            lastUpdate: Date.now()
        };
        console.log(`Created objects for ${username}`, otherPlayersData[username]);
        ensureStairs(otherPlayersData[username]); // Create initial stairs
        return otherPlayersData[username];
    } else {
        // Ensure existing data is up-to-date, especially if score changed before subscribe update
        const playerData = otherPlayersData[username];
        if (playerData.score !== score) {
            updatePlayerPosition(playerData, score);
            ensureStairs(playerData);
            playerData.score = score;
        }
        playerData.lastUpdate = Date.now(); // Mark as recently updated
        return playerData;
    }
}

function removePlayer(username) {
    const playerData = otherPlayersData[username];
    if (playerData) {
        console.log(`Removing player ${username}`);
        if (playerData.mesh) scene.remove(playerData.mesh);
        if (playerData.stairsGroup) scene.remove(playerData.stairsGroup); // Remove all stairs at once
        delete otherPlayersData[username];
    }
}

function updatePlayerPosition(playerData, newScore) {
    if (!playerData || !playerData.mesh) return;

    const targetY = newScore * STAIR_HEIGHT;
    const currentY = playerData.mesh.position.y;

    // If it's not me and the change is significant, maybe add a small animation?
    // For now, directly set position for others, animate for self via climb()
    if (!playerData.isMe) {
        playerData.mesh.position.y = targetY;
    }
    // Ensure X/Z are correct (shouldn't change, but good practice)
    playerData.mesh.position.x = playerData.offset.x;
    playerData.mesh.position.z = playerData.offset.z;

    // Update score in the local cache
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
    } else {
        // Smoothly interpolate controls target
        controls.target.lerp(targetPosition, 0.1); // Adjust lerp factor for desired smoothness
    }
}

// --- Stairs ---
const stairGeometry = new THREE.BoxGeometry(STAIR_WIDTH, STAIR_HEIGHT, STAIR_DEPTH);
const stairMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });

function ensureStairs(playerData) {
    if (!playerData || !playerData.stairsGroup) return;

    const { score, offset, stairsGroup, renderedStairIndices } = playerData;
    const targetStairCount = score + 1; // Need stair 0 up to stair 'score'

    // Add missing stairs
    for (let i = 0; i < targetStairCount; i++) {
        // Optimization: Only render stairs 'near' the player's current score
        if (i < score - MAX_STAIRS_PER_PLAYER_VISIBLE) continue;

        if (!renderedStairIndices.has(i)) {
            const stair = new THREE.Mesh(stairGeometry, stairMaterial.clone()); // Clone material if changing properties per stair
            stair.position.set(offset.x, i * STAIR_HEIGHT - (STAIR_HEIGHT / 2), offset.z); // Center stair vertically
            stair.castShadow = true;
            stair.receiveShadow = true;
            stairsGroup.add(stair);
            renderedStairIndices.add(i);
            stair.userData.stairIndex = i; // Store index for potential removal
        }
    }

    // Optimization: Remove stairs far below the player
    const stairsToRemove = [];
    for (const stair of stairsGroup.children) {
        if (stair.userData.stairIndex < score - MAX_STAIRS_PER_PLAYER_VISIBLE - 10) { // Add buffer before removing
            stairsToRemove.push(stair);
            renderedStairIndices.delete(stair.userData.stairIndex);
        }
    }
    stairsToRemove.forEach(stair => stairsGroup.remove(stair));

}

// --- Game Logic ---
async function climb() {
    if (!myClimbData || !myPlayerObject || myPlayerObject.isBouncing) return;

    myPlayerObject.isBouncing = true;
    const previousScore = myClimbData.score;
    const newScore = previousScore + 1;

    // Optimistic UI update
    myClimbData.score = newScore; // Update local authoritative state
    myPlayerObject.score = newScore; // Update local display/cache state
    ensureStairs(myPlayerObject); // Add the new stair immediately
    updateMyScoreDisplay();

    // Bounce animation
    const playerMesh = myPlayerObject.mesh;
    const startY = previousScore * STAIR_HEIGHT;
    const peakY = newScore * STAIR_HEIGHT + BOUNCE_HEIGHT;
    const endY = newScore * STAIR_HEIGHT;
    const startTime = Date.now();

    function bounceStep() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / BOUNCE_DURATION, 1);
        let currentY;

        // Ease-out for up, ease-in for down (quadratic easing)
        if (progress < 0.5) {
            const t = progress * 2; // Normalize to 0-1 for ascent
            currentY = startY + (peakY - startY) * (1 - (1 - t) * (1 - t));
        } else {
            const t = (progress - 0.5) * 2; // Normalize to 0-1 for descent
            currentY = peakY - (peakY - endY) * t * t;
        }

        playerMesh.position.y = currentY;

        if (progress < 1) {
            requestAnimationFrame(bounceStep);
        } else {
            playerMesh.position.y = endY; // Ensure final position
            myPlayerObject.isBouncing = false;
        }
    }
    requestAnimationFrame(bounceStep);

    // Persist the change to the database
    try {
        // console.log("Updating score to:", newScore, "for ID:", myClimbData.id);
        await room.collection(USER_STAIRS_COLLECTION).update(myClimbData.id, { score: newScore });
        // console.log("Score updated successfully");
    } catch (error) {
        console.error("Error updating score:", error);
        // Revert optimistic update
        myClimbData.score = previousScore;
        myPlayerObject.score = previousScore;
        updatePlayerPosition(myPlayerObject, previousScore); // Revert position visually (snap back)
        updateMyScoreDisplay();
        myPlayerObject.isBouncing = false; // Allow trying again
        // Maybe remove the optimistically added stair? Or leave it for simplicity.
    }
}

function updateMyScoreDisplay() {
    if (myClimbData) {
        document.getElementById('my-score').textContent = `My Score: ${myClimbData.score}`;
    }
}

// Event Listener for climbing
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat) { // Prevent holding space
        event.preventDefault(); // Prevent page scrolling
        climb();
    }
});

// --- Animation Loop ---
const clock = new THREE.Clock(); // For timing if needed
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); // Get time delta for smooth animations if needed later

    controls.update(); // Required for damping

    // Update camera to follow player smoothly
    updateCameraTarget();

    renderer.render(scene, camera);
}

// --- Initialization ---
initMyClimbData().then(() => {
    console.log("Initialization complete.");
    animate(); // Start the rendering loop only after user data is ready
}).catch(err => {
    console.error("Initialization failed:", err);
    // Show error to user? Fallback?
});

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Optional: Cleanup inactive players periodically (e.g., if they haven't updated in 5 minutes)
setInterval(() => {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    for (const username in otherPlayersData) {
        if (!otherPlayersData[username].isMe && now - otherPlayersData[username].lastUpdate > timeout) {
            console.log(`Removing inactive player ${username}`);
            removePlayer(username);
        }
    }
}, 60 * 1000); // Check every minute