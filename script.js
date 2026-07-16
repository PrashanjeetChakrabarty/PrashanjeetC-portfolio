// ==========================================
// 3D PORTFOLIO GAME ENGINE (THREE.JS)
// ==========================================

// --- Globals & State ---
let scene, camera, renderer, clock;
let car, carChassis, wheels = [];
let collidables = [];
let particles = [];
let keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, a: false, s: false, d: false };
let isGameActive = false;

// Physics / Movement Config
const MAX_SPEED = 0.9;
const ACCELERATION = 0.03;
const FRICTION = 0.94;
const TURN_SPEED = 0.06;
const GRAVITY = 0.05;

let speed = 0;
let angle = 0;
let carVelocity = new THREE.Vector3();

// Setup Audio
const engineAudio = new AudioContext();
let oscillator = null;
let gainNode = null;

// DOM Elements
const loadingOverlay = document.getElementById('loader-screen');
const startBtn = document.getElementById('startBtn');
const hud = document.getElementById('hud');
const instructionToast = document.getElementById('instructionToast');

// Sections Data
const sections = [
    { id: 'about', color: 0x38bdf8, label: 'ABOUT', position: { x: -30, z: -30 } },
    { id: 'experience', color: 0xa855f7, label: 'EXPERIENCE', position: { x: 30, z: -30 } },
    { id: 'education', color: 0xf43f5e, label: 'EDUCATION', position: { x: -30, z: 30 } },
    { id: 'projects', color: 0xfacc15, label: 'PROJECTS', position: { x: 30, z: 30 } },
    { id: 'contact', color: 0x22c55e, label: 'CONTACT', position: { x: 0, z: 50 } }
];

let activeModal = null;

// --- Initialize Engine ---
function init() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a24);
    scene.fog = new THREE.FogExp2(0x1a1a24, 0.015);

    // Camera setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 20);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    // Build World
    createEnvironment();
    createCar();
    createInteractiveZones();
    createScatteredBlocks();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    // Mobile controls
    setupMobileControls();

    // UI Buttons
    document.getElementById('closeModal').addEventListener('click', closeModal);
    
    startBtn.addEventListener('click', startGame);

    // Loading complete
    setTimeout(() => {
        startBtn.textContent = "START ENGINE";
        startBtn.style.opacity = 1;
        startBtn.style.pointerEvents = "auto";
    }, 1000);

    // Render loop
    renderer.setAnimationLoop(animate);
}

// --- Audio ---
function initAudio() {
    if (oscillator) return;
    
    oscillator = engineAudio.createOscillator();
    gainNode = engineAudio.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 50; // Idle sound
    
    gainNode.gain.value = 0; // Muted initially
    
    oscillator.connect(gainNode);
    gainNode.connect(engineAudio.destination);
    
    oscillator.start();
}

function updateAudio() {
    if (!oscillator || !isGameActive) return;
    
    const absSpeed = Math.abs(speed);
    const targetFreq = 50 + (absSpeed * 200);
    const targetVolume = 0.05 + (absSpeed * 0.1);
    
    oscillator.frequency.setTargetAtTime(targetFreq, engineAudio.currentTime, 0.1);
    gainNode.gain.setTargetAtTime(targetVolume, engineAudio.currentTime, 0.1);
}

// --- World Building ---
function createEnvironment() {
    // Ground (Grass)
    const gridHelper = new THREE.GridHelper(200, 100, 0xd97706, 0x112211);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a3a1f, // Dark grass green
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cross Roads
    const roadGeo = new THREE.PlaneGeometry(16, 200);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    
    const roadZ = new THREE.Mesh(roadGeo, roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.y = 0.02;
    roadZ.receiveShadow = true;
    scene.add(roadZ);

    const roadXGeo = new THREE.PlaneGeometry(200, 16);
    const roadX = new THREE.Mesh(roadXGeo, roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.y = 0.02;
    roadX.receiveShadow = true;
    scene.add(roadX);

    // Add Trees/Forest
    const treeGeo = new THREE.ConeGeometry(2, 5, 5);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, flatShading: true });
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.4, 1);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723 });

    for(let i=0; i<80; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;
        if(Math.abs(x) < 20 || Math.abs(z) < 20) continue; // Keep roads clear
        
        const tree = new THREE.Group();
        const foliage = new THREE.Mesh(treeGeo, treeMat);
        foliage.position.y = 3;
        foliage.castShadow = true;
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.5;
        trunk.castShadow = true;
        
        tree.add(foliage);
        tree.add(trunk);
        tree.position.set(x, 0, z);
        scene.add(tree);
        
        collidables.push({ mesh: trunk, type: 'static', isTree: true });
    }

    // Borders
    const wallGeo = new THREE.BoxGeometry(200, 10, 2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x059669, wireframe: true });
    
    const wallN = new THREE.Mesh(wallGeo, wallMat);
    wallN.position.set(0, 5, -100);
    scene.add(wallN);
    collidables.push({ mesh: wallN, type: 'static' });

    const wallS = new THREE.Mesh(wallGeo, wallMat);
    wallS.position.set(0, 5, 100);
    scene.add(wallS);
    collidables.push({ mesh: wallS, type: 'static' });

    const wallEGeo = new THREE.BoxGeometry(2, 10, 200);
    const wallE = new THREE.Mesh(wallEGeo, wallMat);
    wallE.position.set(100, 5, 0);
    scene.add(wallE);
    collidables.push({ mesh: wallE, type: 'static' });

    const wallW = new THREE.Mesh(wallEGeo, wallMat);
    wallW.position.set(-100, 5, 0);
    scene.add(wallW);
    collidables.push({ mesh: wallW, type: 'static' });
}

function createCar() {
    car = new THREE.Group();
    
    // Chassis
    const chassisGeo = new THREE.BoxGeometry(2, 1, 4);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.4 });
    carChassis = new THREE.Mesh(chassisGeo, chassisMat);
    carChassis.position.y = 1;
    carChassis.castShadow = true;
    car.add(carChassis);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.8, 2);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.9, -0.5);
    cabin.castShadow = true;
    car.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelPositions = [
        [-1.1, 0.5, 1.2],  // Front Left
        [1.1, 0.5, 1.2],   // Front Right
        [-1.1, 0.5, -1.2], // Back Left
        [1.1, 0.5, -1.2]   // Back Right
    ];

    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        wheel.castShadow = true;
        car.add(wheel);
        wheels.push(wheel);
    });

    // Headlights
    const lightL = new THREE.PointLight(0xfffaed, 2, 20);
    lightL.position.set(-0.8, 1.2, 2.1);
    car.add(lightL);

    const lightR = new THREE.PointLight(0xfffaed, 2, 20);
    lightR.position.set(0.8, 1.2, 2.1);
    car.add(lightR);

    scene.add(car);
}

function createInteractiveZones() {
    const loader = new THREE.FontLoader();
    
    sections.forEach(sec => {
        // Platform
        const platGeo = new THREE.CylinderGeometry(4, 4, 0.5, 32);
        const platMat = new THREE.MeshStandardMaterial({ 
            color: sec.color, 
            emissive: sec.color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8
        });
        const platform = new THREE.Mesh(platGeo, platMat);
        platform.position.set(sec.position.x, 0.25, sec.position.z);
        platform.receiveShadow = true;
        scene.add(platform);

        // Ring indicator
        const ringGeo = new THREE.TorusGeometry(4.5, 0.1, 16, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: sec.color });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(platform.position);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);

        // Light
        const pLight = new THREE.PointLight(sec.color, 2, 15);
        pLight.position.set(sec.position.x, 3, sec.position.z);
        scene.add(pLight);

        // Register zone
        sec.mesh = platform;
        sec.ring = ring;
    });
}

function createScatteredBlocks() {
    const boxGeo = new THREE.BoxGeometry(2, 2, 2);
    
    for(let i=0; i<30; i++) {
        const color = Math.random() > 0.5 ? 0x059669 : 0xd97706;
        const boxMat = new THREE.MeshStandardMaterial({ color: color });
        const box = new THREE.Mesh(boxGeo, boxMat);
        
        box.position.set(
            (Math.random() - 0.5) * 150,
            1,
            (Math.random() - 0.5) * 150
        );
        
        // Avoid center spawn
        if (box.position.length() < 15) {
            box.position.x += 20;
        }

        box.rotation.y = Math.random() * Math.PI;
        box.castShadow = true;
        box.receiveShadow = true;
        
        scene.add(box);
        collidables.push({ 
            mesh: box, 
            type: 'dynamic', 
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Vector3()
        });
    }
}

// --- Game Logic ---
function startGame() {
    if(engineAudio.state === 'suspended') {
        engineAudio.resume();
    }
    initAudio();
    
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
        hud.style.display = 'block';
        instructionToast.style.opacity = '1';
        
        // Mobile controls check
        if (window.innerWidth <= 768) {
            document.querySelector('.mobile-controls').style.display = 'flex';
        }

        setTimeout(() => {
            instructionToast.style.opacity = '0';
        }, 5000);
        
        isGameActive = true;
    }, 1000);
}

function handleInput() {
    if (!isGameActive || activeModal) return;

    // Acceleration
    if (keys.ArrowUp || keys.w) {
        speed += ACCELERATION;
    } else if (keys.ArrowDown || keys.s) {
        speed -= ACCELERATION;
    } else {
        speed *= FRICTION;
    }

    // Steering (smoother, scale with speed)
    if (Math.abs(speed) > 0.01) {
        const direction = speed > 0 ? 1 : -1;
        const speedFactor = Math.min(Math.abs(speed) / MAX_SPEED, 1.0); // max steering at high speeds
        const activeTurnSpeed = TURN_SPEED * (0.3 + 0.7 * speedFactor); 

        if (keys.ArrowLeft || keys.a) {
            angle += activeTurnSpeed * direction;
            wheels[0].rotation.y = Math.min(wheels[0].rotation.y + 0.15, 0.6);
            wheels[1].rotation.y = Math.min(wheels[1].rotation.y + 0.15, 0.6);
        } else if (keys.ArrowRight || keys.d) {
            angle -= activeTurnSpeed * direction;
            wheels[0].rotation.y = Math.max(wheels[0].rotation.y - 0.15, -0.6);
            wheels[1].rotation.y = Math.max(wheels[1].rotation.y - 0.15, -0.6);
        } else {
            // Straighten wheels
            wheels[0].rotation.y *= 0.7;
            wheels[1].rotation.y *= 0.7;
        }
    }

    speed = Math.max(-MAX_SPEED / 2, Math.min(MAX_SPEED, speed));

    // Update car position
    car.rotation.y = angle;
    
    // Calculate movement vector
    const moveX = Math.sin(angle) * speed;
    const moveZ = Math.cos(angle) * speed;
    
    carVelocity.set(moveX, 0, moveZ);
    
    // Check collisions before moving
    if (!checkCollisions(carVelocity)) {
        car.position.add(carVelocity);
    } else {
        speed *= 0.5; // Bounce slow down
    }

    // Spin wheels
    wheels.forEach(w => w.rotation.x -= speed);

    updateAudio();
}

function checkCollisions(velocity) {
    const nextPos = car.position.clone().add(velocity);
    const carRadius = 2.5; // Approximate bounding radius

    let collided = false;

    for (let c of collidables) {
        const dist = nextPos.distanceTo(c.mesh.position);
        
        // Simple sphere collision for boxes and walls
        let collisionThreshold = c.type === 'static' ? 4 : 3;

        if (dist < collisionThreshold) {
            collided = true;
            
            if (c.type === 'dynamic') {
                // Transfer momentum to box
                const pushDir = c.mesh.position.clone().sub(car.position).normalize();
                const force = Math.abs(speed) * 1.5;
                
                c.velocity.add(pushDir.multiplyScalar(force));
                c.angularVelocity.set(
                    (Math.random() - 0.5) * force,
                    (Math.random() - 0.5) * force,
                    (Math.random() - 0.5) * force
                );
                
                createCrashParticles(c.mesh.position);
            }
        }
    }

    return collided;
}

function updatePhysics() {
    collidables.forEach(c => {
        if (c.type === 'dynamic') {
            // Apply velocity
            c.mesh.position.add(c.velocity);
            
            // Apply rotation
            c.mesh.rotation.x += c.angularVelocity.x;
            c.mesh.rotation.y += c.angularVelocity.y;
            c.mesh.rotation.z += c.angularVelocity.z;
            
            // Friction and damping
            c.velocity.multiplyScalar(0.92);
            c.angularVelocity.multiplyScalar(0.95);
            
            // Keep on ground
            if (c.mesh.position.y > 1) {
                c.velocity.y -= GRAVITY;
            } else {
                c.mesh.position.y = 1;
                c.velocity.y = 0;
            }

            // Simple wall bounce for boxes
            if (Math.abs(c.mesh.position.x) > 98) {
                c.velocity.x *= -0.5;
                c.mesh.position.x = Math.sign(c.mesh.position.x) * 98;
            }
            if (Math.abs(c.mesh.position.z) > 98) {
                c.velocity.z *= -0.5;
                c.mesh.position.z = Math.sign(c.mesh.position.z) * 98;
            }
        }
    });

    // Update Particles
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.mesh.position.add(p.velocity);
        p.life--;
        p.mesh.scale.multiplyScalar(0.9);
        
        if(p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
}

function createCrashParticles(pos) {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd97706 });
    
    for(let i=0; i<5; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        
        particles.push({
            mesh: mesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                Math.random() * 0.5,
                (Math.random() - 0.5) * 0.5
            ),
            life: 30
        });
    }
}

function checkZones() {
    if (!isGameActive || activeModal) return;

    sections.forEach(sec => {
        // Animate ring
        sec.ring.rotation.z += 0.02;
        sec.ring.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.1);

        const dist = car.position.distanceTo(sec.mesh.position);
        
        if (dist < 4.5) {
            openModal(sec.id);
        }
    });
}

// --- UI / Modals ---
function openModal(sectionId) {
    activeModal = sectionId;
    speed = 0; // stop car
    
    // Hide HUD
    hud.style.display = 'none';
    
    // Show Modal Container
    const modal = document.getElementById('contentModal');
    modal.classList.add('active');
    
    // Hide all sections, show target
    document.querySelectorAll('.modal-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';

    // Lower engine sound
    if (gainNode) {
        gainNode.gain.setTargetAtTime(0.01, engineAudio.currentTime, 0.1);
    }
}

function closeModal() {
    document.getElementById('contentModal').classList.remove('active');
    hud.style.display = 'block';
    
    // Move car slightly away to prevent re-triggering instantly
    const pushBack = new THREE.Vector3(0, 0, -5).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);
    car.position.add(pushBack);
    
    setTimeout(() => {
        activeModal = null;
    }, 500);
}

// --- Camera & Render Loop ---
function updateCamera() {
    if (!car) return;

    // Follow camera logic
    const idealOffset = new THREE.Vector3(0, 15, -25);
    idealOffset.applyQuaternion(car.quaternion);
    idealOffset.add(car.position);

    const idealLookat = new THREE.Vector3(0, 0, 10);
    idealLookat.applyQuaternion(car.quaternion);
    idealLookat.add(car.position);

    camera.position.lerp(idealOffset, 0.1);
    
    // Temporary target to look at
    const currentLookat = new THREE.Vector3();
    camera.getWorldDirection(currentLookat);
    currentLookat.add(camera.position);
    currentLookat.lerp(idealLookat, 0.1);
    
    camera.lookAt(currentLookat);
}

function animate() {
    handleInput();
    updatePhysics();
    checkZones();
    updateCamera();
    
    // Update speedometer UI
    const speedDisplay = Math.abs(Math.floor(speed * 150));
    document.getElementById('speedCounter').innerText = speedDisplay.toString().padStart(3, '0');

    renderer.render(scene, camera);
}

// --- Input Handling ---
function onKeyDown(event) {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
    }
}

function onKeyUp(event) {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
    // Handle Escape to close modal
    if (event.key === 'Escape' && activeModal) {
        closeModal();
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Mobile Joystick Simulation
function setupMobileControls() {
    const up = document.getElementById('btnUp');
    const down = document.getElementById('btnDown');
    const left = document.getElementById('btnLeft');
    const right = document.getElementById('btnRight');

    if(!up) return; // Not on mobile view or elements missing

    const bindControl = (el, key) => {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    };

    bindControl(up, 'ArrowUp');
    bindControl(down, 'ArrowDown');
    bindControl(left, 'ArrowLeft');
    bindControl(right, 'ArrowRight');
}

// Bootstrap
window.onload = () => {
    // Basic ThreeJS Check
    if (typeof THREE === 'undefined') {
        console.error("Three.js not loaded.");
        document.getElementById('loadingOverlay').innerHTML = "<h1 style='color:red;'>ERROR: WebGL Engine failed to load.</h1>";
        return;
    }
    init();
};
