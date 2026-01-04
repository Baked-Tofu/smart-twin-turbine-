import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Global variable that script.js will update
window.turbineRotationSpeed = 0; 
let rotorParts = [];

function init3D() {
    const container = document.getElementById('turbine-3d-placeholder');
    if (!container) return;

    const scene = new THREE.Scene();
    
    const getThemeBg = () => {
        const style = getComputedStyle(document.body);
        return style.getPropertyValue('--log-bg').trim() || '#151624';
    };
    scene.background = new THREE.Color(getThemeBg());

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(3, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = ""; 
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- LOAD MODEL ---
    const loader = new GLTFLoader(); 
    loader.load('./model.glb', (gltf) => {
        const model = gltf.scene;
        rotorParts = [];

        model.traverse((child) => {
            if (child.isMesh) {
                child.material.metalness = 0.5;
                child.material.roughness = 0.4;

                // 1. FREEZE OBJECT_19: Keeps it from moving with the rotor
                if (child.name === 'Object_19') {
                    scene.attach(child); 
                }

                // 2. ROTATE 13 AND 33: Adds both to the spinning group
                if (child.name === 'Object_33' || child.name === 'Object_13') {
                    rotorParts.push(child);
                }
            }
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const scale = 3.5 / Math.max(size.x, size.y, size.z);
        model.scale.set(scale, scale, scale);
        model.position.sub(center); 

        scene.add(model);
    });

    function animate() {
        requestAnimationFrame(animate);

        rotorParts.forEach(part => {
            // If .z feels odd, remember you can try .x here
            part.rotation.x += window.turbineRotationSpeed; 
        });

        controls.update(); 
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    const observer = new MutationObserver(() => {
        scene.background.set(new THREE.Color(getThemeBg()));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

init3D();