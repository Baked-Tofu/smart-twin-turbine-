import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function init3D() {
    // 1. SELECT THE CONTAINER
    const container = document.getElementById('turbine-3d-placeholder');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 2. SETUP SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5); // Matches your dashboard background

    // 3. SETUP CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(2, 2, 5);

    // 4. SETUP RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Physical correctness settings (makes light behave more naturally)
    renderer.useLegacyLights = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; 
    
    container.innerHTML = ""; 
    container.appendChild(renderer.domElement);

    // 5. IMPROVED LIGHTING SETUP (The Fix for Dark Models)
    
    // Light A: Hemisphere Light (Sky vs Ground color) - great for overall visibility
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Light B: Main Directional Light (The "Sun")
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Light C: Front Light (Fill light to remove shadows)
    const frontLight = new THREE.DirectionalLight(0xffffff, 2);
    frontLight.position.set(0, 0, 10); // Directly in front
    scene.add(frontLight);

    // 6. CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 7. LOAD MODEL
    const loader = new GLTFLoader();
    loader.load(
        './model.glb', 
        (gltf) => {
            const model = gltf.scene;
            
            // --- MATERIAL FIX --- 
            // This traverses every part of the model and makes it easier to see
            model.traverse((child) => {
                if (child.isMesh) {
                    // If the model is too dark/metallic, this lowers the metalness
                    // so it reflects the white lights we added above.
                    child.material.metalness = 0.2; 
                    child.material.roughness = 0.5;
                }
            });
            // --------------------

            // Auto-Scaling
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.5 / maxDim;
            model.scale.set(scale, scale, scale);

            // Auto-Centering
            box.setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center); 

            scene.add(model);
        },
        undefined,
        (error) => {
            console.error('Error loading model:', error);
        }
    );

    // 8. ANIMATION LOOP
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    // 9. RESIZE HANDLER
    window.addEventListener('resize', () => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
}

init3D();