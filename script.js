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

// Controles de movimento
const keyState = {
    KeyW: false, KeyS: false, KeyA: false, KeyD: false,
    Space: false, ShiftLeft: false
};

let moveDirection = new THREE.Vector3();
let isGrounded = true;
let jumpVelocity = 0;
let currentSpeed = 0;
let characterRotation = 0;
let targetRotation = 0;

// Configurações
const WALK_SPEED = 3.5;
const RUN_SPEED = 7;
const JUMP_FORCE = 8;
const GRAVITY = 20;
const ROTATION_LERP_SPEED = 0.15;

// ============================================
// INICIALIZAÇÃO
// ============================================
function init() {
    // Cena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.008);
    
    // Câmera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 4, 8);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 1.2;
    controls.rotateSpeed = 1;
    controls.target.set(0, 1, 0);
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    
    // Luzes
    setupLights();
    
    // Chão
    createGround();
    
    // Ambiente
    addEnvironment();
    
    // Carregar personagem
    loadCharacter();
    
    // Eventos
    setupKeyboardEvents();
    
    // Animação
    animate();
}

// ============================================
// LUZES
// ============================================
function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x88aaff, 0x442200, 0.7);
    scene.add(hemisphereLight);
    
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
    
    const fillLight = new THREE.PointLight(0x4466cc, 0.4);
    fillLight.position.set(-3, 2, 4);
    scene.add(fillLight);
    
    const backLight = new THREE.PointLight(0xff8866, 0.2);
    backLight.position.set(0, 2, -5);
    scene.add(backLight);
}

// ============================================
// CHÃO
// ============================================
function createGround() {
    const gridHelper = new THREE.GridHelper(30, 20, 0x88aaff, 0x335588);
    gridHelper.position.y = -0.05;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);
    
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
    
    // Círculo de sombra
    const shadowCircleGeometry = new THREE.CircleGeometry(1.5, 16);
    const shadowCircleMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const shadowCircle = new THREE.Mesh(shadowCircleGeometry, shadowCircleMaterial);
    shadowCircle.rotation.x = -Math.PI / 2;
    shadowCircle.position.y = -0.08;
    shadowCircle.receiveShadow = true;
    scene.add(shadowCircle);
}

// ============================================
// AMBIENTE
// ============================================
function addEnvironment() {
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
}

// ============================================
// CARREGAR PERSONAGEM (suporte a JSON/GLB)
// ============================================
function loadCharacter() {
    const loader = new GLTFLoader();
    
    // Primeiro tenta carregar como JSON (que contém o GLB em base64)
    fetch('personagem.glb.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Arquivo JSON não encontrado');
            }
            return response.json();
        })
        .then(data => {
            console.log('📦 JSON carregado, procurando dados do GLB...');
            
            // Procura pelo campo que contém os dados base64 do GLB
            let glbBase64 = null;
            
            // Tenta encontrar em campos comuns
            if (data.glb) {
                glbBase64 = data.glb;
            } else if (data.data) {
                glbBase64 = data.data;
            } else if (data.buffer) {
                glbBase64 = data.buffer;
            } else if (data.gltf) {
                glbBase64 = data.gltf;
            } else if (typeof data === 'string') {
                glbBase64 = data;
            } else {
                // Procura recursivamente por qualquer propriedade que contenha base64
                const findBase64 = (obj, depth = 0) => {
                    if (depth > 5) return null;
                    for (let key in obj) {
                        if (typeof obj[key] === 'string') {
                            const str = obj[key];
                            if (str.includes('data:application/octet-stream;base64') || 
                                str.match(/^[A-Za-z0-9+/]+={0,2}$/) && str.length > 100) {
                                return str;
                            }
                        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                            const result = findBase64(obj[key], depth + 1);
                            if (result) return result;
                        }
                    }
                    return null;
                };
                glbBase64 = findBase64(data);
            }
            
            if (glbBase64) {
                console.log('✅ Dados base64 encontrados, convertendo para GLB...');
                
                // Remove o prefixo se existir
                let base64String = glbBase64;
                if (base64String.includes('base64,')) {
                    base64String = base64String.split('base64,')[1];
                }
                
                // Converte base64 para ArrayBuffer
                const binaryString = atob(base64String);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const glbBuffer = bytes.buffer;
                
                // Carrega o GLB a partir do ArrayBuffer
                loader.parse(glbBuffer, '', (gltf) => {
                    processLoadedModel(gltf);
                }, (error) => {
                    console.error('❌ Erro ao parsear GLB:', error);
                    createPlaceholderCharacter();
                });
            } else {
                console.warn('⚠️ Nenhum dado base64 encontrado no JSON');
                createPlaceholderCharacter();
            }
        })
        .catch(error => {
            console.warn('❌ Não foi possível carregar personagem.glb.json:', error);
            // Tenta carregar como GLB normal
            loader.load('personagem.glb', 
                (gltf) => processLoadedModel(gltf),
                undefined,
                () => {
                    console.warn('⚠️ Também não encontrou personagem.glb');
                    createPlaceholderCharacter();
                }
            );
        });
}

// ============================================
// PROCESSAR MODELO CARREGADO
// ============================================
function processLoadedModel(gltf) {
    character = gltf.scene;
    
    // Ajusta escala e posição automaticamente
    const box = new THREE.Box3().setFromObject(character);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Altura alvo de 2 unidades
    const targetHeight = 2;
    const scale = targetHeight / size.y;
    character.scale.set(scale, scale, scale);
    
    // Centraliza o personagem
    character.position.x = -center.x * scale;
    character.position.z = -center.z * scale;
    character.position.y = -box.min.y * scale;
    
    // Configura sombras e materiais
    character.traverse((node) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material.forEach(mat => {
                        mat.roughness = Math.max(0.3, mat.roughness || 0.3);
                        mat.metalness = Math.min(0.7, mat.metalness || 0.5);
                    });
                } else {
                    node.material.roughness = Math.max(0.3, node.material.roughness || 0.3);
                    node.material.metalness = Math.min(0.7, node.material.metalness || 0.5);
                }
            }
        }
    });
    
    scene.add(character);
    
    // Configura animações
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(character);
        
        gltf.animations.forEach((anim) => {
            const name = anim.name.toLowerCase();
            console.log('📽️ Animação encontrada:', anim.name);
            
            if (name.includes('idle') || name.includes('stand') || name.includes('parado')) {
                animations.idle = mixer.clipAction(anim);
            } else if (name.includes('walk') || name.includes('andar')) {
                animations.walk = mixer.clipAction(anim);
            } else if (name.includes('run') || name.includes('correr') || name.includes('sprint')) {
                animations.run = mixer.clipAction(anim);
            } else if (name.includes('jump') || name.includes('pular')) {
                animations.jump = mixer.clipAction(anim);
            }
        });
        
        if (!animations.idle && gltf.animations[0]) {
            animations.idle = mixer.clipAction(gltf.animations[0]);
        }
        
        if (animations.idle) {
            currentAction = animations.idle;
            currentAction.play();
        }
    }
    
    // Remove loading screen
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
    
    console.log('✅ Personagem carregado com sucesso!');
    document.getElementById('animation-status').textContent = 'Modelo Carregado ✓';
}

// ============================================
// CRIAR PERSONAGEM SUBSTITUTO (caso falhe)
// ============================================
function createPlaceholderCharacter() {
    console.log('🎨 Criando personagem substituto...');
    const group = new THREE.Group();
    
    // Corpo
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.2, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, metalness: 0.3, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    
    // Cabeça
    const headGeo = new THREE.SphereGeometry(0.45, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.25;
    head.castShadow = true;
    group.add(head);
    
    // Olhos
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
    leftEye.position.set(-0.18, 1.35, 0.45);
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMat);
    rightEye.position.set(0.18, 1.35, 0.45);
    group.add(rightEye);
    
    // Pupilas
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pupilMat);
    leftPupil.position.set(-0.18, 1.33, 0.52);
    group.add(leftPupil);
    
    const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), pupilMat);
    rightPupil.position.set(0.18, 1.33, 0.52);
    group.add(rightPupil);
    
    group.position.y = 0;
    character = group;
    scene.add(character);
    
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 500);
    
    document.getElementById('animation-status').textContent = 'Modo Demo';
    console.log('✅ Personagem substituto criado!');
}

// ============================================
// CONTROLES DE TECLADO
// ============================================
function setupKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (keyState.hasOwnProperty(code)) {
            keyState[code] = true;
        }
        
        if (code === 'Space' && isGrounded && character) {
            e.preventDefault();
            jumpVelocity = JUMP_FORCE;
            isGrounded = false;
            
            if (animations.jump && currentAction !== animations.jump) {
                if (currentAction) currentAction.fadeOut(0.2);
                currentAction = animations.jump;
                currentAction.reset().fadeIn(0.2).play();
                setTimeout(() => {
                    if (currentAction === animations.jump && isGrounded) {
                        currentAction.fadeOut(0.2);
                        updateAnimation();
                    }
                }, 500);
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
// MOVIMENTO
// ============================================
function updateMovement(deltaTime) {
    if (!character) return;
    
    moveDirection.set(0, 0, 0);
    
    const isRunning = keyState.ShiftLeft;
    const currentMaxSpeed = isRunning ? RUN_SPEED : WALK_SPEED;
    
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
        
        targetRotation = Math.atan2(moveVector.x, moveVector.z);
        let diff = targetRotation - characterRotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        characterRotation += diff * ROTATION_LERP_SPEED;
        character.rotation.y = characterRotation;
        
        currentSpeed = currentMaxSpeed;
    } else {
        currentSpeed = 0;
    }
    
    if (!isGrounded) {
        jumpVelocity -= GRAVITY * deltaTime;
        character.position.y += jumpVelocity * deltaTime;
        
        if (character.position.y <= 0) {
            character.position.y = 0;
            isGrounded = true;
            jumpVelocity = 0;
        }
    }
    
    const limit = 13;
    character.position.x = Math.max(-limit, Math.min(limit, character.position.x));
    character.position.z = Math.max(-limit, Math.min(limit, character.position.z));
    
    updateUI();
    updateAnimation();
}

// ============================================
// ANIMAÇÕES
// ============================================
function updateAnimation() {
    if (!mixer || !animations.idle) return;
    
    let targetAnim = null;
    let statusText = 'Idle';
    
    if (!isGrounded) {
        targetAnim = animations.jump || animations.idle;
        statusText = 'Pulando';
    } else if (currentSpeed > RUN_SPEED * 0.7) {
        targetAnim = animations.run || animations.walk || animations.idle;
        statusText = 'Correndo 🏃';
    } else if (currentSpeed > 0.1) {
        targetAnim = animations.walk || animations.idle;
        statusText = 'Andando 🚶';
    } else {
        targetAnim = animations.idle;
        statusText = 'Parado';
    }
    
    document.getElementById('animation-status').textContent = statusText;
    
    if (targetAnim && currentAction !== targetAnim) {
        if (currentAction) currentAction.fadeOut(0.2);
        currentAction = targetAnim;
        currentAction.reset().fadeIn(0.2).play();
    }
}

// ============================================
// UI
// ============================================
function updateUI() {
    if (character) {
        const pos = character.position;
        document.getElementById('position-status').textContent = 
            `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

// ============================================
// CÂMERA
// ============================================
function updateCamera() {
    if (character && controls) {
        controls.target.lerp(character.position, 0.1);
    }
}

// ============================================
// LOOP PRINCIPAL
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
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// INICIAR
// ============================================
init();
