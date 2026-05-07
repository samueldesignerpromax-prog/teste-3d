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
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
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
const WALK_SPEED = 3;
const RUN_SPEED = 6;
const JUMP_FORCE = 8;
const GRAVITY = 20;
const ROTATION_LERP_SPEED = 0.15;

// Chão
let ground;

// ============================================
// INICIALIZAÇÃO DA CENA
// ============================================
function init() {
    // Criar cena com fundo gradiente
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a2a);
    scene.fog = new THREE.FogExp2(0x0a0a2a, 0.008); // Névoa suave
    
    // Criar câmera em terceira pessoa
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 3, 8);
    
    // Criar renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Ativar sombras
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);
    
    // Configurar controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Suavidade
    controls.dampingFactor = 0.05;
    controls.zoomSpeed = 1.2;
    controls.rotateSpeed = 1;
    controls.target.set(0, 1, 0);
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    
    // Configurar iluminação
    setupLights();
    
    // Criar chão
    createGround();
    
    // Adicionar elementos decorativos
    addEnvironmentDetails();
    
    // Carregar personagem
    loadCharacter();
    
    // Configurar eventos de teclado
    setupKeyboardEvents();
    
    // Iniciar loop de animação
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
    
    // Luz de fundo
    const backLight = new THREE.PointLight(0xff8866, 0.3);
    backLight.position.set(0, 2, -5);
    scene.add(backLight);
}

// ============================================
// CRIAÇÃO DO CHÃO
// ============================================
function createGround() {
    // Grid helper para referência
    const gridHelper = new THREE.GridHelper(30, 20, 0x88aaff, 0x335588);
    gridHelper.position.y = -0.05;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);
    
    // Chão visível estilo grade
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2a2a4a,
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.6
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Adicionar círculo de sombra embaixo do personagem
    const shadowCircleGeometry = new THREE.CircleGeometry(1.2, 16);
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
// ELEMENTOS DECORATIVOS
// ============================================
function addEnvironmentDetails() {
    // Adicionar algumas esferas flutuantes decorativas
    const particleCount = 200;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesPositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        particlesPositions[i * 3] = (Math.random() - 0.5) * 60;
        particlesPositions[i * 3 + 1] = Math.random() * 8;
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
// CARREGAMENTO DO PERSONAGEM
// ============================================
function loadCharacter() {
    const loader = new GLTFLoader();
    
    loader.load('personagem.glb', 
        (gltf) => {
            character = gltf.scene;
            
            // Ajustar escala automaticamente
            const box = new THREE.Box3().setFromObject(character);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.5 / maxDim; // Altura alvo de 2.5 unidades
            character.scale.set(scale, scale, scale);
            
            // Centralizar personagem
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
            
            // Configurar animações
            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(character);
                
                // Mapear animações
                gltf.animations.forEach((anim) => {
                    const name = anim.name.toLowerCase();
                    if (name.includes('idle') || name.includes('parado')) {
                        animations.idle = mixer.clipAction(anim);
                    } else if (name.includes('walk') || name.includes('andar')) {
                        animations.walk = mixer.clipAction(anim);
                    } else if (name.includes('run') || name.includes('correr')) {
                        animations.run = mixer.clipAction(anim);
                    } else if (name.includes('jump') || name.includes('pular')) {
                        animations.jump = mixer.clipAction(anim);
                    }
                });
                
                // Se não encontrou animações específicas, usar a primeira como idle
                if (!animations.idle && gltf.animations[0]) {
                    animations.idle = mixer.clipAction(gltf.animations[0]);
                }
                if (!animations.walk && gltf.animations[1]) {
                    animations.walk = mixer.clipAction(gltf.animations[1]);
                }
                if (!animations.run && gltf.animations[2]) {
                    animations.run = mixer.clipAction(gltf.animations[2]);
                }
                
                // Iniciar animação idle
                if (animations.idle) {
                    currentAction = animations.idle;
                    currentAction.play();
                    document.getElementById('animation-status').textContent = 'Idle';
                }
            }
            
            // Esconder loading screen
            const loadingScreen = document.getElementById('loading-screen');
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
            
            console.log('Personagem carregado com sucesso!');
        },
        (progress) => {
            // Progresso do carregamento
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            const loadingText = document.querySelector('#loading-screen p');
            if (loadingText) {
                loadingText.textContent = `Carregando personagem... ${percent}%`;
            }
        },
        (error) => {
            console.error('Erro ao carregar personagem:', error);
            // Mostrar mensagem de erro
            const loadingScreen = document.getElementById('loading-screen');
            const errorMessage = document.getElementById('error-message');
            loadingScreen.style.display = 'none';
            errorMessage.style.display = 'block';
        }
    );
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
        
        // Prevenir scroll com espaço
        if (code === 'Space') {
            e.preventDefault();
            if (isGrounded) {
                jumpVelocity = JUMP_FORCE;
                isGrounded = false;
                
                // Tocar animação de pulo se disponível
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
        }
    });
    
    window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (keyState.hasOwnProperty(code)) {
            keyState[code] = false;
        }
    });
    
    // Prevenir comportamento padrão das teclas
    window.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================
// ATUALIZAÇÃO DE MOVIMENTO
// ============================================
function updateMovement(deltaTime) {
    if (!character) return;
    
    // Calcular direção do movimento
    moveDirection.set(0, 0, 0);
    
    const isRunning = keyState.ShiftLeft;
    const currentMaxSpeed = isRunning ? RUN_SPEED : WALK_SPEED;
    
    // Movimento relativo à câmera
    const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
    const cameraRight = new THREE.Vector3().crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const cameraForward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    
    if (keyState.KeyW || keyState.ArrowUp) moveDirection.z -= 1;
    if (keyState.KeyS || keyState.ArrowDown) moveDirection.z += 1;
    if (keyState.KeyA || keyState.ArrowLeft) moveDirection.x -= 1;
    if (keyState.KeyD || keyState.ArrowRight) moveDirection.x += 1;
    
    if (moveDirection.length() > 0) {
        moveDirection.normalize();
        const moveVector = new THREE.Vector3()
            .addScaledVector(cameraForward, moveDirection.z)
            .addScaledVector(cameraRight, moveDirection.x)
            .normalize();
        
        character.position.x += moveVector.x * currentMaxSpeed * deltaTime;
        character.position.z += moveVector.z * currentMaxSpeed * deltaTime;
        
        // Calcular rotação do personagem
        targetRotation = Math.atan2(moveVector.x, moveVector.z);
        characterRotation = lerpAngle(characterRotation, targetRotation, ROTATION_LERP_SPEED);
        character.rotation.y = characterRotation;
        
        // Atualizar velocidade para animação
        currentSpeed = currentMaxSpeed;
    } else {
        currentSpeed = 0;
    }
    
    // Física de pulo e gravidade
    if (!isGrounded) {
        jumpVelocity -= GRAVITY * deltaTime;
        character.position.y += jumpVelocity * deltaTime;
        
        if (character.position.y <= 0) {
            character.position.y = 0;
            isGrounded = true;
            jumpVelocity = 0;
        }
    }
    
    // Limitar movimento dentro do chão
    const limit = 14;
    character.position.x = Math.max(-limit, Math.min(limit, character.position.x));
    character.position.z = Math.max(-limit, Math.min(limit, character.position.z));
    
    // Atualizar UI
    updateUI();
    
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
    } else if (currentSpeed > RUN_SPEED * 0.8) {
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
    
    // Trocar animação suavemente
    if (targetAnim && currentAction !== targetAnim) {
        if (currentAction) currentAction.fadeOut(0.2);
        currentAction = targetAnim;
        currentAction.reset().fadeIn(0.2).play();
    }
}

// ============================================
// ATUALIZAÇÃO DA UI
// ============================================
function updateUI() {
    if (character) {
        const pos = character.position;
        document.getElementById('position-status').textContent = 
            `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

// ============================================
// FUNÇÃO AUXILIAR: LERP ANGLE
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
    if (character && controls) {
        // OrbitControls segue o personagem automaticamente
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
    
    // Atualizar movimento
    updateMovement(deltaTime);
    
    // Atualizar câmera
    updateCamera();
    
    // Atualizar mixer de animação
    if (mixer) {
        mixer.update(deltaTime);
    }
    
    // Atualizar controles
    controls.update();
    
    // Renderizar cena
    renderer.render(scene, camera);
    
    // Próximo frame
    requestAnimationFrame(animate);
}

// ============================================
// RESPONSIVIDADE
// ============================================
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// INICIAR APLICAÇÃO
// ============================================
init();
