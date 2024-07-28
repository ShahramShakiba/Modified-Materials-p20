//===================================================
/* "It is not an actual project; therefore,
I rely on comments to assess the code." */
//===================================================
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import GUI from 'lil-gui';
import * as THREE from 'three';

const canvas = document.querySelector('canvas.webgl');
const gui = new GUI();
const scene = new THREE.Scene();

let width = window.innerWidth;
let height = window.innerHeight;
const clock = new THREE.Clock();

//================ Loaders ======================
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const cubeTextureLoader = new THREE.CubeTextureLoader();

//========== Update all materials
const updateAllMaterials = () => {
  scene.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial
    ) {
      child.material.envMapIntensity = 1;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

//============= Environment Map =================
const environmentMap = cubeTextureLoader.load([
  '/textures/environmentMaps/0/px.jpg',
  '/textures/environmentMaps/0/nx.jpg',
  '/textures/environmentMaps/0/py.jpg',
  '/textures/environmentMaps/0/ny.jpg',
  '/textures/environmentMaps/0/pz.jpg',
  '/textures/environmentMaps/0/nz.jpg',
]);

scene.background = environmentMap;
scene.environment = environmentMap;

//================ Material =====================
//=== Textures
const mapTexture = textureLoader.load('/models/LeePerrySmith/color.jpg');
mapTexture.colorSpace = THREE.SRGBColorSpace;
const normalTexture = textureLoader.load('/models/LeePerrySmith/normal.jpg');

//=== Material
const material = new THREE.MeshStandardMaterial({
  map: mapTexture,
  normalMap: normalTexture,
});

//== Hook the material compilation
material.onBeforeCompile = (shader) => {
  // define mat2 outside "main" fn ↓
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
        #include <common>

        mat2 get2dRotateMatrix(float _angle) {
            return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
        }
    `
  );

  // it's like we write our code inside the "main" fn
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>

        float angle = position.y * 0.9;
        mat2 rotateMatrix = get2dRotateMatrix(angle);

        transformed.xz = rotateMatrix * transformed.xz;
    `
  );
};

//=== Models
gltfLoader.load('/models/LeePerrySmith/LeePerrySmith.glb', (gltf) => {
  const mesh = gltf.scene.children[0];

  mesh.rotation.y = Math.PI * 0.5;
  mesh.material = material;
  scene.add(mesh);

  updateAllMaterials();
});

//================ Lights ======================
const directionalLight = new THREE.DirectionalLight('#ffffff', 3);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.normalBias = 0.05;
directionalLight.position.set(0.25, 2, -2.25);
scene.add(directionalLight);

//================ Camera ======================
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 100);
camera.position.set(4, 1, -4);
scene.add(camera);

//============ Orbit Controls ==================
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

//=============== Renderer =====================
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//============== Resize Listener ===================
let resizeTimeout;

const onWindowResize = () => {
  clearTimeout(resizeTimeout);

  resizeTimeout = setTimeout(() => {
    width = window.innerWidth;
    height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }, 200);
};

window.addEventListener('resize', onWindowResize);

//================= Animate ======================
const tick = () => {
  const elapsedTime = clock.getElapsedTime();

  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();

/* ************ onBeforeCompile
- it'll be call automatically by Three.js before the material gets compiled.

? node_modules-three-src-renderers-shaders-shaderLib = meshPhysical.glsl.js
? node_modules-three-src-renderers-shaders-shaderChunk = begin_vertex.glsl.js

* begin_vertex.glsl.js
- this part of code is located in "meshPhysical.glsl.js" inside of "main" fn and also it has dedicated file with this name as well

- we are going to inject our code here
- is handling the position first by creating a variable named "transformed"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


* #include <common>
- we can inject the "get2dRotateMatrix" function here
- mat2 is a function to help calculate the rotation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


* Create a matrix to calculate the rotation, helping "get2dRotateMatrix" in <common> file
    float angle = 0.3;
    mat2 rotateMatrix = get2dRotateMatrix(angle);
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~



* Transform or rotate the Obj
    transformed.xz = rotateMatrix * transformed.xz;
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~



* change the "angle" depend on "elevation" | just change :
        float angle = position.y * 0.9;
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

*/
