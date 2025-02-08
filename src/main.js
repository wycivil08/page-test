import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { Howl } from 'howler';

class KittenGame {
    constructor() {
        this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
        this.running = true;
        this.init();
        this.setupSound();
        this.setupFullscreen();  // <-- Ensure fullscreen is set up
        this.initializeGame();

        window.addEventListener('beforeunload', () => this.cleanup());
    }

    // Add this method to the KittenGame class
    setupFullscreen() {
        const fullscreenBtn = document.getElementById('fullscreen-btn');

        // Only show button if fullscreen is available
        if (!document.fullscreenEnabled &&
            !document.webkitFullscreenEnabled &&
            !document.mozFullScreenEnabled &&
            !document.msFullscreenEnabled) {
            fullscreenBtn.style.display = 'none';
            return;
        }

        fullscreenBtn.addEventListener('click', () => {
            const container = document.getElementById('game-container');

            try {
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                } else if (container.webkitRequestFullscreen) { // Safari
                    container.webkitRequestFullscreen();
                } else if (container.msRequestFullscreen) { // IE11
                    container.msRequestFullscreen();
                } else if (container.mozRequestFullScreen) { // Firefox
                    container.mozRequestFullScreen();
                }
            } catch (error) {
                console.error('Fullscreen request failed:', error);
            }
        });

        // Handle fullscreen change events
        const fullscreenChangeHandler = () => {
            const isFullscreen = document.fullscreenElement ||
                document.webkitFullscreenElement ||
                document.mozFullScreenElement ||
                document.msFullscreenElement;

            fullscreenBtn.style.display = isFullscreen ? 'none' : 'block';

            // Trigger resize event to update game bounds
            window.dispatchEvent(new Event('resize'));
        };

        // Add listeners for all browser variants
        document.addEventListener('fullscreenchange', fullscreenChangeHandler);
        document.addEventListener('webkitfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('mozfullscreenchange', fullscreenChangeHandler);
        document.addEventListener('MSFullscreenChange', fullscreenChangeHandler);
    }

    updateCameraBounds() {
        const aspect = window.innerWidth / window.innerHeight;
        const verticalSize = 5;
        const horizontalSize = verticalSize * aspect;

        this.bounds = {
            left: -horizontalSize,
            right: horizontalSize,
            top: verticalSize,
            bottom: -verticalSize
        };
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.updateCameraBounds();

        // Camera setup
        this.camera = new THREE.OrthographicCamera(
            this.bounds.left, this.bounds.right,
            this.bounds.top, this.bounds.bottom,
            1, 1000
        );
        this.camera.position.set(0, 10, 0);
        this.camera.lookAt(0, 0, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Post-processing setup
        const renderScene = new RenderPass(this.scene, this.camera);
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.8,    // strength (reduced from 1.5)
            0.2,    // radius (reduced from 0.4)
            0.5    // threshold (increased from 0.85)
        );
        const outputPass = new OutputPass();

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(renderScene);
        this.composer.addPass(bloomPass);
        this.composer.addPass(outputPass);

        // Basic setup
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.animals = [];
        this.maxAnimals = 1;
        this.movementStates = {
            MOVING: 'moving',
            PAUSED: 'paused',
            TURNING: 'turning'
        };
        this.mixers = [];
        this.clock = new THREE.Clock();

        // Minimal lighting setup (reduced redundant lights)
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(5, 10, 5);
        this.scene.add(mainLight);

        // Event listeners
        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.renderer.domElement.addEventListener('pointerdown', (event) => this.onPointerDown(event), false);
    }

    setupSound() {
        const useCDN = import.meta.env.MODE === 'production';
        const baseURL = useCDN
            ? 'https://cdn.jsdelivr.net/gh/wycivil08/page-test@gh-pages/sounds/'
            : `${import.meta.env.BASE_URL}sounds/`;

        return new Promise((resolve) => {
            let loadedCount = 0;
            const totalSounds = 2; // Number of sounds to load

            this.sounds = {
                movement: new Howl({
                    src: [`${baseURL}movement.mp3`],
                    loop: true,
                    volume: 0.5,
                    onload: () => {
                        loadedCount++;
                        if (loadedCount === totalSounds) resolve();
                    },
                    onend: () => {
                        this.sounds.movement.isPlaying = false;
                    }
                }),
                pop: new Howl({
                    src: [`${baseURL}pop.wav`],
                    volume: 0.8,
                    onload: () => {
                        loadedCount++;
                        if (loadedCount === totalSounds) resolve();
                    }
                })
            };

            this.sounds.movement.isPlaying = false;
        });
    }

    async createAnimalInstance() {
        const animal = await this.createAnimalWithShader();
        animal.scale.set(0.02, 0.02, 0.02);

        // Choose a random side (0: top, 1: right, 2: bottom, 3: left)
        const side = Math.floor(Math.random() * 4);
        let x, z, directionX, directionY;

        switch (side) {
            case 0: // Top
                x = THREE.MathUtils.randFloat(this.bounds.left * 0.8, this.bounds.right * 0.8);
                z = this.bounds.top;
                directionX = Math.random() - 0.5;
                directionY = -1;
                break;
            case 1: // Right
                x = this.bounds.right;
                z = THREE.MathUtils.randFloat(this.bounds.bottom * 0.8, this.bounds.top * 0.8);
                directionX = -1;
                directionY = Math.random() - 0.5;
                break;
            case 2: // Bottom
                x = THREE.MathUtils.randFloat(this.bounds.left * 0.8, this.bounds.right * 0.8);
                z = this.bounds.bottom;
                directionX = Math.random() - 0.5;
                directionY = 1;
                break;
            case 3: // Left
                x = this.bounds.left;
                z = THREE.MathUtils.randFloat(this.bounds.bottom * 0.8, this.bounds.top * 0.8);
                directionX = 1;
                directionY = Math.random() - 0.5;
                break;
        }

        animal.position.set(x, 0, z);
        this.scene.add(animal);

        // Create animal object with movement state
        const animalObj = {
            mesh: animal,
            direction: new THREE.Vector2(directionX, directionY).normalize(),
            speed: 0.01 + Math.random() * 0.01,
            baseSpeed: 0.01 + Math.random() * 0.01,
            state: this.movementStates.MOVING,
            stateTimer: Math.random() * 4 + 1,
            lastPosition: new THREE.Vector3(x, 0, z)
        };

        // Initialize sound when spawning since we're in MOVING state
        if (!this.sounds.movement.isPlaying) {
            this.sounds.movement.play();
            this.sounds.movement.isPlaying = true;
        }

        return animalObj;
    }

    async createAnimalWithShader() {
        const group = new THREE.Group();
        const loader = new GLTFLoader();

        // const modelUrl = `${import.meta.env.BASE_URL}models/fish_animated.glb`;
        // use cdn for mainland china users
        const useCDN = import.meta.env.MODE === 'production';
        const modelUrl = useCDN
            ? 'https://cdn.jsdelivr.net/gh/wycivil08/page-test@gh-pages/models/fish_animated.glb'
            : `${import.meta.env.BASE_URL}models/fish_animated.glb`;

        const model = await loader.loadAsync(modelUrl);

        try {

            // const model = await loader.loadAsync('/models/fish_animated.glb');
            const model = await loader.loadAsync(modelUrl);

            // Enhanced emissive material for the entire fish
            model.scene.traverse((child) => {
                if (child.isMesh) {
                    // Create an emissive material for a golden glow
                    child.material = new THREE.MeshPhongMaterial({
                        color: 0xffd700,          // Base golden color
                        emissive: 0xffb300,       // Slightly darker golden for the emissive
                        emissiveIntensity: 1.0,   // Intensity of the emission
                        shininess: 80,            // High shininess for a metallic look
                        specular: 0xffe87c        // Lighter golden for specular highlights
                    });
                }
            });

            // Create outer glow effect with simpler shader
            const glowMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    glowColor: { value: new THREE.Color(0xffe87c) }
                },
                vertexShader: `
                    varying float intensity;
                    void main() {
                        intensity = pow(0.6 - dot(normalize(normalMatrix * normal), vec3(0, 0, 1.0)), 4.0);  // Sharper falloff
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 glowColor;
                    varying float intensity;
                    void main() {
                        vec3 glow = glowColor * intensity;
                        gl_FragColor = vec4(glow, intensity * 0.3);  // Reduced transparency
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            });

            // Create two layers of glow for more intense effect
            const glowMesh1 = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 32, 32),  // Reduced from 1.2
                glowMaterial
            );
            const glowMesh2 = new THREE.Mesh(
                new THREE.SphereGeometry(0.8, 32, 32),  // Reduced from 1.4
                glowMaterial.clone()
            );
            group.add(glowMesh1);
            group.add(glowMesh2);

            model.scene.position.set(0, 0, 0);
            const mixer = new THREE.AnimationMixer(model.scene);
            model.animations.forEach((clip) => {
                mixer.clipAction(clip).play();
            });

            group.add(model.scene);
            group.userData.mixer = mixer;
            this.mixers.push(mixer);

        } catch (error) {
            console.error('Error loading model:', error);
            // Fallback object
            const geometry = new THREE.SphereGeometry(0.3, 32, 32);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4477ff,
                emissive: 0x112233,
                emissiveIntensity: 2.0
            });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
        }

        return group;
    }

    // Replace the updateAnimalState method with this improved version:
    updateAnimalState(animal) {
        animal.stateTimer -= 0.016;

        // Store last position
        animal.lastPosition.copy(animal.mesh.position);

        if (animal.stateTimer <= 0) {
            switch (animal.state) {
                case this.movementStates.MOVING:
                    animal.state = Math.random() < 0.3 ?
                        this.movementStates.PAUSED :
                        this.movementStates.TURNING;
                    animal.stateTimer = Math.random() * 2 + 1;

                    if (animal.state === this.movementStates.PAUSED) {
                        // Animation handling
                        if (animal.mesh.userData.mixer) {
                            animal.mesh.userData.mixer.timeScale = 0;
                        }
                    }
                    break;

                case this.movementStates.PAUSED:
                    animal.state = this.movementStates.MOVING;
                    animal.stateTimer = Math.random() * 2 + 1;
                    // Resume animation
                    if (animal.mesh.userData.mixer) {
                        animal.mesh.userData.mixer.timeScale = 1;
                    }
                    break;

                case this.movementStates.TURNING:
                    animal.state = this.movementStates.MOVING;
                    animal.stateTimer = Math.random() * 4 + 1;
                    const angle = (Math.random() - 0.5) * Math.PI;
                    const currentAngle = Math.atan2(animal.direction.x, animal.direction.y);
                    const newAngle = currentAngle + angle;
                    animal.direction.set(
                        Math.sin(newAngle),
                        Math.cos(newAngle)
                    ).normalize();
                    break;
            }
        }

        // Update speed based on state
        switch (animal.state) {
            case this.movementStates.MOVING:
                animal.speed = animal.baseSpeed;
                break;
            case this.movementStates.PAUSED:
                animal.speed = 0;
                break;
            case this.movementStates.TURNING:
                animal.speed = animal.baseSpeed * 0.5;
                break;
        }

        // Sound management based on actual movement
        if (animal.speed > 0) {
            if (!this.sounds.movement.isPlaying) {
                this.sounds.movement.play();
                this.sounds.movement.isPlaying = true;
            }
        } else {
            if (this.sounds.movement.isPlaying) {
                this.sounds.movement.pause();
                this.sounds.movement.isPlaying = false;
            }
        }

        // Update position
        const newX = animal.mesh.position.x + animal.direction.x * animal.speed;
        const newZ = animal.mesh.position.z + animal.direction.y * animal.speed;

        // Boundary checks with smooth transition
        const boundaryMargin = 0.1;
        let directionChanged = false;

        if (newX > this.bounds.right * (1 - boundaryMargin)) {
            animal.direction.x = -Math.abs(animal.direction.x);
            directionChanged = true;
        } else if (newX < this.bounds.left * (1 - boundaryMargin)) {
            animal.direction.x = Math.abs(animal.direction.x);
            directionChanged = true;
        }

        if (newZ > this.bounds.top * (1 - boundaryMargin)) {
            animal.direction.y = -Math.abs(animal.direction.y);
            directionChanged = true;
        } else if (newZ < this.bounds.bottom * (1 - boundaryMargin)) {
            animal.direction.y = Math.abs(animal.direction.y);
            directionChanged = true;
        }

        // Apply movement
        animal.mesh.position.x += animal.direction.x * animal.speed;
        animal.mesh.position.z += animal.direction.y * animal.speed;

        // Update rotation
        animal.mesh.rotation.y = Math.atan2(animal.direction.x, animal.direction.y);

        // Additional check: If no actual movement occurred but sound is playing, stop it
        if (Math.abs(animal.mesh.position.x - animal.lastPosition.x) < 0.0001 &&
            Math.abs(animal.mesh.position.z - animal.lastPosition.z) < 0.0001) {
            if (this.sounds.movement.isPlaying) {
                this.sounds.movement.pause();
                this.sounds.movement.isPlaying = false;
            }
        }

        // Update glow intensity for the glowing meshes
        if (animal.mesh.children) {
            animal.mesh.children.forEach(child => {
                if (child.material && child.material.type === 'ShaderMaterial') {
                    if (child.material.uniforms && child.material.uniforms.glowColor) {
                        const pulseIntensity = 0.2 * Math.sin(performance.now() * 0.002) + 1;
                        child.material.uniforms.glowColor.value.multiplyScalar(pulseIntensity);
                    }
                }
            });
        }
    }

    updateAnimals() {
        this.animals.forEach(animal => {
            this.updateAnimalState(animal);
        });
    }

    async initializeGame() {
        await this.setupSound();  // Ensure sounds are ready
        await this.createAnimals(); // Ensure models are ready
        this.animate();
    }

    async createAnimals() {
        // Stop any existing movement sound before creating new animals
        if (this.sounds.movement.isPlaying) {
            this.sounds.movement.stop();
            this.sounds.movement.isPlaying = false;
        }

        while (this.animals.length < this.maxAnimals) {
            const animal = await this.createAnimalInstance();
            this.animals.push(animal);
        }
    }

    onWindowResize() {
        this.updateCameraBounds();
        this.camera.left = this.bounds.left;
        this.camera.right = this.bounds.right;
        this.camera.top = this.bounds.top;
        this.camera.bottom = this.bounds.bottom;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    onPointerDown(event) {
        event.preventDefault();

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const meshesToCheck = this.animals.reduce((acc, animal) => {
            acc.push(animal.mesh);
            animal.mesh.traverse((child) => {
                if (child.isMesh) {
                    acc.push(child);
                }
            });
            return acc;
        }, []);

        const intersects = this.raycaster.intersectObjects(meshesToCheck, false);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;
            let currentObject = hitObject;
            let foundAnimal = null;

            while (currentObject && !foundAnimal) {
                const animal = this.animals.find(a => a.mesh === currentObject);
                if (animal) {
                    foundAnimal = animal;
                    break;
                }
                currentObject = currentObject.parent;
            }

            if (foundAnimal) {
                this.sounds.pop.play();
                this.sounds.movement.pause();

                new TWEEN.Tween(foundAnimal.mesh.scale)
                    .to({ x: 0, y: 0, z: 0 }, 500)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onComplete(() => {
                        this.scene.remove(foundAnimal.mesh);
                        this.animals = this.animals.filter(a => a !== foundAnimal);
                        setTimeout(() => this.createAnimals(), 1000);
                    })
                    .start();

                // Add explosion effect with glow
                const explosionGeometry = new THREE.SphereGeometry(0.1, 32, 32);
                const explosionMaterial = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0 },
                        color: { value: new THREE.Color(0x88aaff) }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform float time;
                        uniform vec3 color;
                        varying vec3 vNormal;
                        void main() {
                            float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                            vec3 glow = color * intensity;
                            gl_FragColor = vec4(glow, intensity);
                        }
                    `,
                    transparent: true,
                    blending: THREE.AdditiveBlending
                });

                const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
                explosion.position.copy(foundAnimal.mesh.position);
                this.scene.add(explosion);

                new TWEEN.Tween(explosion.scale)
                    .to({ x: 2, y: 2, z: 2 }, 500)
                    .easing(TWEEN.Easing.Quadratic.Out)
                    .onComplete(() => {
                        this.scene.remove(explosion);
                    })
                    .start();
            }
        }
    }

    animate() {
        if (!this.running) return;

        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update TWEEN
        TWEEN.update();

        // Update animation mixers
        this.mixers.forEach(mixer => mixer.update(delta));

        // Update animals
        this.updateAnimals();

        // Use composer instead of renderer for post-processing effects
        this.composer.render();
    }

    cleanup() {
        this.running = false;
        if (this.sounds.movement.isPlaying) {
            this.sounds.movement.stop();
            this.sounds.movement.isPlaying = false;
        }
        this.animals.forEach(animal => {
            this.scene.remove(animal.mesh);
        });
        this.animals = [];
        this.mixers = [];
        this.composer.dispose();
        this.renderer.dispose();
    }
}

// Helper functions
function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function smoothstep(x) {
    return x * x * (3 - 2 * x);
}


// Start the game
new KittenGame();