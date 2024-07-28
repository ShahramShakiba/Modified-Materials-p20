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

//=== Handle the Drop-shadow
const depthMaterial = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
});

const customUniform = {
  uTime: { value: 0 },
};

//== Hook the Material & Core-Shadow compilation | GLSL Code
material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = customUniform.uTime;

  // handling rotation calculation ↓01
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
        #include <common>

        uniform float uTime;

        mat2 get2dRotateMatrix(float _angle) {
            return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
        }
    `
  );

  // handling core-shadow animation
  shader.vertexShader = shader.vertexShader.replace(
    '#include <beginnormal_vertex>',
    `
        #include <beginnormal_vertex>

        float angle = (position.y + uTime) * 0.9;
        mat2 rotateMatrix = get2dRotateMatrix(angle);

        objectNormal.xz = rotateMatrix * objectNormal.xz;
    `
  );

  // handling model rotation
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>

        transformed.xz = rotateMatrix * transformed.xz;
    `
  );
};

//== Hook the Drop-Shadow compilation 
depthMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = customUniform.uTime;

  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `
        #include <common>

        uniform float uTime;

        mat2 get2dRotateMatrix(float _angle) {
            return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
        }
    `
  );

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>

        float angle = (position.y + uTime) * 0.9;
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
  mesh.customDepthMaterial = depthMaterial;
  scene.add(mesh);

  updateAllMaterials();
});

//================= Plane ======================
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15, 15),
  new THREE.MeshStandardMaterial()
);
plane.rotation.y = Math.PI;
plane.position.y = -4;
plane.position.z = 6;
scene.add(plane);

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
camera.position.set(10, 1, -8);
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

  customUniform.uTime.value = elapsedTime;

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
- it's like we write our code inside the " void main" function

- this part of code is located in "meshPhysical.glsl.js" inside of "main" fn and also it has dedicated file with this name as well

- we are going to inject our code here
- is handling the position first by creating a variable named "transformed"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


* #include <common> - 01
- it's like we define outside "void main" function
- we can inject the "get2dRotateMatrix" function here
- mat2 is a function to help calculate the rotation
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


* Create a matrix to calculate the rotation, helping "get2dRotateMatrix" in <common> file
    float angle = 0.3;
    mat2 rotateMatrix = get2dRotateMatrix(angle);

    - matrices(plural of matrix) can be used to apply transformation on vertices
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~



* Transform or rotate the Obj
    transformed.xz = rotateMatrix * transformed.xz;
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~



* change the "angle" depend on "elevation" | just change :
        float angle = position.y * 0.9;
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


* Shadow map 
    to handle shadows, Three.js do renders from the lights point of view called shadow maps. 
    ? let's say when we have directionalLight, before each render three.js wil put camera at the place of directionalLight and do a render of our scene in order to know what the light can see and it'll create a render called "Shadow map" which it'll be used either to put shadows on the materials or not 

    when those renders occur, all the materials are replaced by another set of materials called "depthMaterial"

    That kind of material doesn't twist

    - and so far as you can see our material is twisting but the shadow map material is not


we have two type of shadows: 
1. Core Shadow | Normals
2. Drop Shadow | DepthMaterial

- to fix the shadow of the model it's the "Normal" problem to fix
    * Normals are data associated with the vertices that tell in which direction is the outside to be used for lights, shadows, reflection and stuff like that 


1. Core Shadow :
? node_modules-three-src-renderers-shaders-shaderChunk = beginnormal_vertex.glsl.js

    - there's an objectNormal variable
    - and we can animation on that to fix the shadow

*/
