import * as THREE from 'three';

const noiseGLSL = `
float random (in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0 = floor(P);
  vec3 Pi1 = Pi0 + vec3(1.0);
  Pi0 = mod(Pi0, 289.0);
  Pi1 = mod(Pi1, 289.0);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 / 7.0;
  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 / 7.0;
  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2 * n_xyz;
}
`;

function hexToRGB(hex) {
  const c = hex.replace('#', '');
  return [parseInt(c.substring(0, 2), 16) / 255, parseInt(c.substring(2, 4), 16) / 255, parseInt(c.substring(4, 6), 16) / 255];
}

function buildBeamMaterial({ diffuseColor, speed, noiseIntensity, scale }) {
  const physical = THREE.ShaderLib.physical;
  const uniforms = THREE.UniformsUtils.clone(physical.uniforms);
  const base = new THREE.MeshStandardMaterial({ color: new THREE.Color(...diffuseColor), roughness: 0.3, metalness: 0.3 });
  uniforms.diffuse.value = base.color;
  uniforms.roughness.value = base.roughness;
  uniforms.metalness.value = base.metalness;
  uniforms.envMapIntensity = { value: 10 };
  uniforms.time = { value: 0 };
  uniforms.uSpeed = { value: speed };
  uniforms.uNoiseIntensity = { value: noiseIntensity };
  uniforms.uScale = { value: scale };

  const header = `
  varying vec3 vEye;
  varying float vNoise;
  varying vec2 vUv;
  varying vec3 vPosition;
  uniform float time;
  uniform float uSpeed;
  uniform float uNoiseIntensity;
  uniform float uScale;
  ${noiseGLSL}`;

  const vertexHeader = `
  float getPos(vec3 pos) {
    vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;
    return cnoise(noisePos);
  }
  vec3 getCurrentPos(vec3 pos) {
    vec3 newpos = pos;
    newpos.z += getPos(pos);
    return newpos;
  }
  vec3 getNormal(vec3 pos) {
    vec3 curpos = getCurrentPos(pos);
    vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));
    vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));
    vec3 tangentX = normalize(nextposX - curpos);
    vec3 tangentZ = normalize(nextposZ - curpos);
    return normalize(cross(tangentZ, tangentX));
  }`;

  let vert = header + '\n' + vertexHeader + '\n' + physical.vertexShader;
  vert = vert.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed.z += getPos(transformed.xyz);');
  vert = vert.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal = getNormal(position.xyz);');

  let frag = header + '\n' + physical.fragmentShader;
  frag = frag.replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float randomNoise = random(gl_FragCoord.xy);
  gl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;`);

  return new THREE.ShaderMaterial({
    defines: { ...(physical.defines || {}), STANDARD: '' },
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    lights: true,
    fog: false
  });
}

function createStackedPlanesGeometry(n, width, height, spacing, heightSegments) {
  const geometry = new THREE.BufferGeometry();
  const numVertices = n * (heightSegments + 1) * 2;
  const numFaces = n * heightSegments * 2;
  const positions = new Float32Array(numVertices * 3);
  const indices = new Uint32Array(numFaces * 3);
  const uvs = new Float32Array(numVertices * 2);

  let vertexOffset = 0, indexOffset = 0, uvOffset = 0;
  const totalWidth = n * width + (n - 1) * spacing;
  const xOffsetBase = -totalWidth / 2;

  for (let i = 0; i < n; i++) {
    const xOffset = xOffsetBase + i * (width + spacing);
    const uvXOffset = Math.random() * 300;
    const uvYOffset = Math.random() * 300;
    for (let j = 0; j <= heightSegments; j++) {
      const y = height * (j / heightSegments - 0.5);
      positions.set([xOffset, y, 0, xOffset + width, y, 0], vertexOffset * 3);
      const uvY = j / heightSegments;
      uvs.set([uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset], uvOffset);
      if (j < heightSegments) {
        const a = vertexOffset, b = vertexOffset + 1, c = vertexOffset + 2, d = vertexOffset + 3;
        indices.set([a, b, c, c, b, d], indexOffset);
        indexOffset += 6;
      }
      vertexOffset += 2;
      uvOffset += 4;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function mountBeams(canvas, opts = {}) {
  const {
    beamWidth = 2.2,
    beamHeight = 16,
    beamNumber = 14,
    lightColor = '#1FAE7C',
    backgroundColor = '#0B1B33',
    diffuseColor = '#050B16',
    speed = 1.4,
    noiseIntensity = 1.6,
    scale = 0.18,
    rotation = -12
  } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(backgroundColor);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 20);

  const material = buildBeamMaterial({ diffuseColor: hexToRGB(diffuseColor), speed, noiseIntensity, scale });
  const geometry = createStackedPlanesGeometry(beamNumber, beamWidth, beamHeight, 0, 80);
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.rotation.z = THREE.MathUtils.degToRad(rotation);
  group.add(mesh);
  scene.add(group);

  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const dirLight = new THREE.DirectionalLight(new THREE.Color(lightColor), 2.2);
  dirLight.position.set(0, 3, 10);
  scene.add(dirLight);

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let raf = null;
  let last = performance.now();
  function tick(now) {
    const delta = (now - last) / 1000;
    last = now;
    material.uniforms.time.value += 0.1 * delta;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return function cleanup() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
