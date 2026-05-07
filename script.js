import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let scene, camera, renderer, controls;
let character = null;
let mixer = null;
let animations = {};
let currentAction = null;
let isModelLoaded = false;

// Controles de movimento
const keyState = {
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    Space: false, ShiftLeft: false
};

let moveDirection = new THREE.Vector3();
let velocity = new THREE.Vector3();
let isGrounded = true;
let jumpVelocity = 0;
let currentSpeed = 0;
let characterRotation = 0;
let targetRotation = 0;

// Configurações de movimento
const WALK_SPEED = 3.5;
const RUN_SPEED = 7;
const JUMP_FORCE = 8;
const GRAVITY = 20;
const ROTATION_LERP_SPEED = 0.15;

// Objeto substituto (caso o modelo não carregue)
let placeholderCube = null;

// ============================================
// INICIALIZAÇÃO DA CENA
// ============================================
function init() {
    // Criar cena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.008);
    
    // Criar câmera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 4, 8);
    
    // Criar renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    // Configurar controles
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 1.2;
    controls.rotateSpeed = 1;
    controls.target.set(0, 1, 0);
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    
    // Configurar iluminação
    setupLights();
    
    // Criar chão e ambiente
    createGround();
    addEnvironmentDetails();
    
    // Tentar carregar personagem
    loadCharacter();
    
    // Configurar eventos
    setupKeyboardEvents();
    
    // Iniciar animação
    animate();
}

// ============================================
// CONFIGURAÇÃO DE LUZES
// ============================================
function setupLights() {
    // Luz ambiente
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);
    
    // Luz hemisphere
    const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x442200, 0.7);
    scene.add(hemisphereLight);
    
    // Luz direcional principal
    const directionalLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.receiveShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 20;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
    
    // Luz de preenchimento
    const fillLight = new THREE.PointLight(0x4466cc, 0.4);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);
    
    // Luz de chão
    const groundLight = new THREE.PointLight(0xffaa66, 0.3);
    groundLight.position.set(0, 1, 0);
    scene.add(groundLight);
}

// ============================================
// CRIAÇÃO DO CHÃO
// ============================================
function createGround() {
    // Grid helper
    const gridHelper = new THREE.GridHelper(30, 20, 0x88aaff, 0x335588);
    gridHelper.position.y = -0.05;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);
    
    // Chão visível
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a4a,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.5
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
}

// ============================================
// ELEMENTOS DECORATIVOS
// ============================================
function addEnvironmentDetails() {
    // Partículas decorativas
    const particleCount = 300;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        particlesPositions[i * 3] = (Math.random() - 0.5) * 50;
        particlesPositions[i * 3 + 1] = Math.random() * 6;
        particlesPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(particlesPositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({
        color: 0x88aaff,
        size: 0.05,
        transparent: true,
        opacity: 0.5
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
    
    // Adicionar alguns cubos decorativos
    const colors = [0xff3366, 0x33ff66, 0x3366ff];
    for (let i = 0; i < 20; i++) {
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.3, 0.3),
            new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: 0x221133 })
        );
        box.position.x = (Math.random() - 0.5) * 20;
        box.position.z = (Math.random() - 0.5) * 20;
        box.position.y = -0.1;
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
    }
}

// ============================================
// CRIAÇÃO DE PERSONAGEM SUBSTITUTO
// ============================================
function createPlaceholderCharacter() {
    const group = new THREE.Group();
    
    // Corpo
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, metalness: 0.3, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    
    // Cabeça
    const headGeo = new THREE.SphereGeometry(0.45, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa, metalness: 0.1, roughness: 0.3 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);
    
    // Olhos
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
    leftEye.position.set(-0.18, 1.35, 0.45);
    leftEye.castShadow = true;
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
    rightEye.position.set(0.18, 1.35, 0.45);
    rightEye.castShadow = true;
    group.add(rightEye);
    
    // Pupilas
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pupilMat);
    leftPupil.position.set(-0.18, 1.33, 0.52);
    group.add(leftPupil);
    
    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pupilMat);
    rightPupil.position.set(0.18, 1.33, 0.52);
    group.add(rightPupil);
    
    // Braços
    const armMat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), armMat);
    leftArm.position.set(-0.55, 0.9, 0);
    leftArm.castShadow = true;
    group.add(leftArm);
    
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), armMat);
    rightArm.position.set(0.55, 0.9, 0);
    rightArm.castShadow = true;
    group.add(rightArm);
    
    // Pernas
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3388cc });
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), legMat);
    leftLeg.position.set(-0.25, 0.35, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.4), legMat);
    rightLeg.position.set(0.25, 0.35, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);
    
    group.position.y = 0;
    group.castShadow = true;
    
    return group;
}

// ============================================
// CARREGAMENTO DO PERSONAGEM
// ============================================
function loadCharacter() {
    const loader = new GLTFLoader();
    
    // Tentar vários nomes de arquivo possíveis
    const possibleFiles = [
        'personagem.glb',
        'personagem.glb',
        'personagem.glb',
        'model.glb',
        'character.glb'
    ];
    
    let attemptIndex = 0;
    
    function tryLoad() {
        if (attemptIndex >= possibleFiles.length) {
            console.warn('Nenhum modelo 3D encontrado. Usando personagem substituto.');
            character = createPlaceholderCharacter();
            scene.add(character);
            isModelLoaded = true;
            
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
            
            document.getElementById('animation-status').textContent = 'Demo (placeholder)';
            return;
        }
        
        const fileToTry = possibleFiles[attemptIndex];
        console.log(`Tentando carregar: ${fileToTry}`);
        
        loader.load(fileToTry,
            (gltf) => {
                character = gltf.scene;
                
                // Ajustar escala
                const box = new THREE.Box3().setFromObject(character);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = 2.2 / maxDim;
                character.scale.set(scale, scale, scale);
                
                // Centralizar
                box.setFromObject(character);
                const center = box.getCenter(new THREE.Vector3());
                character.position.x = -center.x;
                character.position.z = -center.z;
                character.position.y = -box.min.y;
                
                // Configurar sombras
                character.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                
                scene.add(character);
                isModelLoaded = true;
                
                // Configurar animações
                if (gltf.animations && gltf.animations.length > 0) {
                    mixer = new THREE.AnimationMixer(character);
                    gltf.animations.forEach((anim) => {
                        const name = anim.name.toLowerCase();
                        if (name.includes('idle')) animations.idle = mixer.clipAction(anim);
                        else if (name.includes('walk')) animations.walk = mixer.clipAction(anim);
                        else if (name.includes('run')) animations.run = mixer.clipAction(anim);
                    });
                    
                    if (animations.idle) {
                        currentAction = animations.idle;
                        currentAction.play();
                    }
                }
                
                // Esconder loading
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen) {
                    loadingScreen.classList.add('fade-out');
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }
                
                console.log(`Modelo carregado com sucesso: ${fileToTry}`);
                document.getElementById('animation-status').textContent = 'Modelo 3D Carregado';
            },
            (progress) => {
                // Progresso
                if (progress.lengthComputable) {
                    const percent = (progress.loaded / progress.total * 100).toFixed(0);
                    const loadingText = document.querySelector('#loading-screen p');
                    if (loadingText) {
                        loadingText.textContent = `Carregando ${fileToTry}... ${percent}%`;
                    }
                }
            },
            (error) => {
                console.warn(`Falha ao carregar ${fileToTry}:`, error);
                attemptIndex++;
                tryLoad();
            }
        );
    }
    
    tryLoad();
}

// ============================================
// EVENTOS DE TECLADO
// ============================================
function setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (keyState.hasOwnProperty(code)) {
            keyState[code] = true;
        }
        
        if (code === 'Space' && isGrounded && isModelLoaded) {
            e.preventDefault();
            jumpVelocity = JUMP_FORCE;
            isGrounded = false;
            
            if (animations.jump && currentAction !== animations.jump) {
                if (currentAction) currentAction.fadeOut(0.2);
                currentAction = animations.jump;
                currentAction.reset().fadeIn(0.2).play();
            }
        }
    });
    
    window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (keyState.hasOwnProperty(code)) {
            keyState[code] = false;
        }
    });
}

// ============================================
// ATUALIZAÇÃO DE MOVIMENTO
// ============================================
function updateMovement(deltaTime) {
    if (!character || !isModelLoaded) return;
    
    moveDirection.set(0, 0, 0);
    
    const isRunning = keyState.ShiftLeft;
    const currentMaxSpeed = isRunning ? RUN_SPEED : WALK_SPEED;
    
    // Movimento relativo à câmera
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const cameraForward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    
    if (keyState.KeyW) moveDirection.z -= 1;
    if (keyState.KeyS) moveDirection.z += 1;
    if (keyState.KeyA) moveDirection.x -= 1;
    if (keyState.KeyD) moveDirection.x += 1;
    
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        const moveVector = new THREE.Vector3()
            .addScaledVector(cameraForward, moveDirection.z)
            .addScaledVector(cameraRight, moveDirection.x)
            .normalize();
        
        character.position.x += moveVector.x * currentMaxSpeed * deltaTime;
        character.position.z += moveVector.z * currentMaxSpeed * deltaTime;
        
        // Rotação
        targetRotation = Math.atan2(moveVector.x, moveVector.z);
        characterRotation = lerpAngle(characterRotation, targetRotation, ROTATION_LERP_SPEED);
        character.rotation.y = characterRotation;
        
        currentSpeed = currentMaxSpeed;
    } else {
        currentSpeed = 0;
    }
    
    // Pulo e gravidade
    if (!isGrounded) {
        jumpVelocity -= GRAVITY * deltaTime;
        character.position.y += jumpVelocity * deltaTime;
        
        if (character.position.y <= 0) {
            character.position.y = 0;
            isGrounded = true;
            jumpVelocity = 0;
        }
    }
    
    // Limites
    const limit = 13;
    character.position.x = Math.max(-limit, Math.min(limit, character.position.x));
    character.position.z = Math.max(-limit, Math.min(limit, character.position.z));
    
    // Atualizar UI
    if (character) {
        const pos = character.position;
        document.getElementById('position-status').textContent = 
            `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
    
    // Atualizar animação
    updateAnimation();
}

// ============================================
// ATUALIZAÇÃO DE ANIMAÇÃO
// ============================================
function updateAnimation() {
    if (!mixer || !animations.idle) return;
    
    let targetAnim = null;
    let animStatus = 'Idle';
    
    if (!isGrounded) {
        targetAnim = animations.jump || animations.idle;
        animStatus = 'Pulando';
    } else if (currentSpeed > RUN_SPEED * 0.7) {
        targetAnim = animations.run || animations.walk || animations.idle;
        animStatus = 'Correndo';
    } else if (currentSpeed > 0.1) {
        targetAnim = animations.walk || animations.idle;
        animStatus = 'Andando';
    } else {
        targetAnim = animations.idle;
        animStatus = 'Parado';
    }
    
    document.getElementById('animation-status').textContent = animStatus;
    
    if (targetAnim && currentAction !== targetAnim) {
        if (currentAction) currentAction.fadeOut(0.2);
        currentAction = targetAnim;
        currentAction.reset().fadeIn(0.2).play();
    }
}

// ============================================
// FUNÇÃO AUXILIAR
// ============================================
function lerpAngle(a, b, t) {
    const delta = ((b - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    if (delta > Math.PI) {
        return a - (Math.PI * 2 - delta) * t;
    }
    return a + delta * t;
}

// ============================================
// ATUALIZAÇÃO DA CÂMERA
// ============================================
function updateCamera() {
    if (character && isModelLoaded && controls) {
        controls.target.lerp(character.position, 0.1);
    }
}

// ============================================
// LOOP DE ANIMAÇÃO
// ============================================
let lastTime = performance.now();

function animate() {
    const currentTime = performance.now();
    let deltaTime = Math.min(0.033, (currentTime - lastTime) / 1000);
    lastTime = currentTime;
    
    updateMovement(deltaTime);
    updateCamera();
    
    if (mixer) {
        mixer.update(deltaTime);
    }
    
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

// ============================================
// RESPONSIVIDADE
// ============================================
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Iniciar
init();
