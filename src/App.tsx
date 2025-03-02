import "./App.css";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import {
  shapeFour,
  shapeFourSize,
  shapeOne,
  shapeOneSize,
  shapeThree,
  shapeThreeSize,
  shapeTwo,
  shapeTwoSize,
} from "./data";

const GRID_SIZE = 100;
const GRID_DIVISIONS = 100;
const WALL_THICKNESS = 0.5;
const WALL_HEIGHT = 3;

// Wall Material
const wallMaterial = new THREE.MeshStandardMaterial({
  color: "#a3aab5",
  roughness: 0.7,
  metalness: 0.1,
});

// Floor Material
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load(
  "https://threejs.org/examples/textures/hardwood2_diffuse.jpg"
);
floorTexture.wrapS = THREE.RepeatWrapping;
floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.anisotropy = 16;
floorTexture.repeat.set(0.1, 0.1);
floorTexture.colorSpace = THREE.SRGBColorSpace;

const floorMaterial = new THREE.MeshStandardMaterial({
  map: floorTexture,
  roughness: 0.8,
});

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene>(null);

  const [numberOfWalls, setNumberOfWalls] = useState<number>(shapeOneSize);
  const [wallData, setWallData] = useState<number[][]>(shapeOne);

  const isEnclosedSpace = useCallback(
    (wallData: number[][]) => {
      if (numberOfWalls < 3) {
        return false;
      }

      const endpoints: { x: number; y: number }[] = [];
      wallData.forEach((coords) => {
        endpoints.push({
          x: coords[0],
          y: coords[1],
        });
        endpoints.push({
          x: coords[2],
          y: coords[3],
        });
      });

      const pointCounts = new Map();
      endpoints.forEach((point) => {
        const key = `${point.x},${point.y}`;
        pointCounts.set(key, (pointCounts.get(key) || 0) + 1);
      });

      for (const [, count] of pointCounts) {
        if (count !== 2) {
          return false;
        }
      }

      return true;
    },
    [numberOfWalls]
  );

  const createWall = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1);

      const geometry = new THREE.BoxGeometry(
        length,
        WALL_HEIGHT,
        WALL_THICKNESS
      );
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.position.set((x1 + x2) / 2, WALL_HEIGHT / 2, (y1 + y2) / 2);

      wall.rotation.y = -angle; // Negative because of Three.js coordinate system

      // Add a tiny offset to prevent Z-fighting where walls meet
      wall.position.y += Math.random() * 0.001;

      wall.castShadow = true;
      wall.receiveShadow = true;

      return wall;
    },
    []
  );

  // Create walls from input data
  const createWalls = useCallback(
    (wallData: number[][]) => {
      const scene = sceneRef.current;
      if (!scene) return;

      const walls = [];

      for (const coords of wallData) {
        const [x1, y1, x2, y2] = coords;
        const wall = createWall(x1, y1, x2, y2);
        scene.add(wall);
        walls.push(wall);
      }

      return walls;
    },
    [createWall]
  );

  const createFloor = useCallback(
    (wallData: number[][]) => {
      if (!isEnclosedSpace(wallData)) {
        console.log("Walls do not form an enclosed space");
        return null;
      }

      const vertices: THREE.Vector2[] = [];

      wallData.forEach((coords) => {
        vertices.push(new THREE.Vector2(coords[0], coords[1]));
      });

      const shape = new THREE.Shape(vertices);
      const geometry = new THREE.ShapeGeometry(shape);
      const floor = new THREE.Mesh(geometry, floorMaterial);

      floor.rotation.x = -Math.PI / 2;
      floor.scale.set(1, -1, 1);
      floor.position.y += Math.random() * 0.1;

      const uvAttribute = geometry.attributes.uv;

      const bbox = new THREE.Box3().setFromObject(floor);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      for (let i = 0; i < uvAttribute.count; i++) {
        const u = uvAttribute.getX(i);
        const v = uvAttribute.getY(i);
        uvAttribute.setXY(i, u * (size.x / 5), v * (size.z / 5));
      }

      floor.receiveShadow = true;

      return floor;
    },
    [isEnclosedSpace]
  );

  const updateScene = useCallback(() => {
    const view = mountRef.current;
    if (!view) return;

    const scene = sceneRef.current;
    if (!scene) return;

    createWalls(wallData);
    const floor = createFloor(wallData);
    if (floor) scene.add(floor);
  }, [createFloor, createWalls, wallData]);

  useEffect(() => {
    const view = mountRef.current;
    if (!view) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#ffffff");

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(4, 10, 4);

    const controls = new OrbitControls(camera, view);
    // controls.enablePan = false;
    controls.enableDamping = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    view.appendChild(renderer.domElement);

    // Grid
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS);
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    updateScene();

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      view.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [updateScene]);

  return (
    <>
      <div className="relative w-screen h-screen">
        <div ref={mountRef} className="w-full h-full" />
        <div className="absolute flex flex-col top-4 right-4 gap-y-2">
          <button
            className=" cursor-pointer border px-9"
            onClick={() => {
              setNumberOfWalls(shapeOneSize);
              setWallData(shapeOne);
            }}
          >
            Shape One
          </button>

          <button
            className=" cursor-pointer border px-9"
            onClick={() => {
              setNumberOfWalls(shapeTwoSize);
              setWallData(shapeTwo);
            }}
          >
            Shape Two
          </button>

          <button
            className=" cursor-pointer border px-9"
            onClick={() => {
              setNumberOfWalls(shapeThreeSize);
              setWallData(shapeThree);
            }}
          >
            Shape Three
          </button>

          <button
            className=" cursor-pointer border px-9"
            onClick={() => {
              setNumberOfWalls(shapeFourSize);
              setWallData(shapeFour);
            }}
          >
            Shape Four
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
