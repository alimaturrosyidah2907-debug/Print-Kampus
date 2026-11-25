import * as THREE from 'three';
import {
  createBrushedMetalTexture,
  createHardcoverTexture,
  createOledScreenTexture,
  createPrintedPageTexture,
  createRadialShadowTexture,
} from './textures';

export type PrintFinishMode = 'bw' | 'color' | 'spiral' | 'hardcover';

export interface StudioRig {
  root: THREE.Group;
  printerGroup: THREE.Group;
  printerUpperLid: THREE.Mesh;
  exitingSheet: THREE.Mesh;
  docGroup: THREE.Group;
  docCoverMesh: THREE.Mesh;
  spiralRingsGroup: THREE.Group;
  hardcoverSpine: THREE.Mesh;
  mascotGroup: THREE.Group;
  mascotHead: THREE.Group;
  mascotTail: THREE.Mesh;
  floatingCards: THREE.Group;
  interactables: THREE.Object3D[];
  applyFinish: (mode: PrintFinishMode) => void;
  setExploded: (factor: number) => void;
  dispose: () => void;
}

function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const hw = width / 2 - radius;
  const hd = depth / 2 - radius;
  shape.moveTo(-hw, -depth / 2);
  shape.lineTo(hw, -depth / 2);
  shape.quadraticCurveTo(width / 2, -depth / 2, width / 2, -hd);
  shape.lineTo(width / 2, hd);
  shape.quadraticCurveTo(width / 2, depth / 2, hw, depth / 2);
  shape.lineTo(-hw, depth / 2);
  shape.quadraticCurveTo(-width / 2, depth / 2, -width / 2, hd);
  shape.lineTo(-width / 2, -hd);
  shape.quadraticCurveTo(-width / 2, -depth / 2, -hw, -depth / 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: Math.min(radius * 0.45, 0.04),
    bevelThickness: Math.min(radius * 0.45, 0.04),
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export function buildPrintStudioScene(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): StudioRig {
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTex: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMats.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposableTex.push(t);
    return t;
  };

  const brushedTex = trackTex(createBrushedMetalTexture(maxAnisotropy));
  const shadowTex = trackTex(createRadialShadowTexture());
  const oledBwTex = trackTex(createOledScreenTexture('MODE: B/W LASER', maxAnisotropy));
  const oledClrTex = trackTex(createOledScreenTexture('MODE: FULL COLOR', maxAnisotropy));
  const pageBwTex = trackTex(createPrintedPageTexture(false, maxAnisotropy));
  const pageClrTex = trackTex(createPrintedPageTexture(true, maxAnisotropy));
  const hardcoverTex = trackTex(createHardcoverTexture(maxAnisotropy));

  const root = new THREE.Group();

  // Shared materials with varied roughness/metalness >= 0.25 contrast
  const matteSlateMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.78,
      metalness: 0.1,
    }),
  );
  const chassisLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.48,
      metalness: 0.06,
    }),
  );
  const brushedAluminumMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd5e1,
      roughness: 0.22,
      metalness: 0.9,
      bumpMap: brushedTex,
      bumpScale: 0.008,
      anisotropy: 0.75,
    }),
  );
  const accentBlueMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      roughness: 0.28,
      metalness: 0.25,
    }),
  );
  const smokedGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      roughness: 0.12,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.4 : 0.9,
      ior: 1.5,
      thickness: 0.3,
      depthWrite: false,
    }),
  );

  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );

  // 1. COMPOSITE HERO: LASER PRINT STATION (10 distinct parts)
  const printerGroup = new THREE.Group();
  printerGroup.position.set(0, 0, 0);
  printerGroup.userData.subjectId = 'printer';

  const printerShadow = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(1.75, 32)), shadowMat);
  printerShadow.rotation.x = -Math.PI / 2;
  printerShadow.position.y = 0.015;
  printerGroup.add(printerShadow);

  // Part 1: Base rubberized plinth
  const basePlinth = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(2.4, 0.22, 1.85, 0.12)),
    matteSlateMat,
  );
  basePlinth.position.y = 0.12;
  basePlinth.castShadow = true;
  basePlinth.receiveShadow = true;
  basePlinth.userData.baseY = 0.12;
  printerGroup.add(basePlinth);

  // Part 2: Main lower paper drawer body
  const mainChassis = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(2.22, 0.76, 1.66, 0.1)),
    chassisLightMat,
  );
  mainChassis.position.y = 0.62;
  mainChassis.castShadow = true;
  mainChassis.receiveShadow = true;
  mainChassis.userData.baseY = 0.62;
  printerGroup.add(mainChassis);

  // Part 3: Brushed aluminum paper input drawer front
  const drawerFront = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(1.65, 0.34, 0.14, 0.04)),
    brushedAluminumMat,
  );
  drawerFront.position.set(0, 0.48, 0.84);
  drawerFront.castShadow = true;
  drawerFront.userData.baseY = 0.48;
  drawerFront.userData.explodeOffset = new THREE.Vector3(0, 0, 0.45);
  printerGroup.add(drawerFront);

  // Part 4: Upper scanner / fuser deck
  const upperDeck = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(2.28, 0.26, 1.72, 0.1)),
    matteSlateMat,
  );
  upperDeck.position.y = 1.18;
  upperDeck.castShadow = true;
  upperDeck.userData.baseY = 1.18;
  upperDeck.userData.explodeOffset = new THREE.Vector3(0, 0.45, 0);
  printerGroup.add(upperDeck);

  // Part 5: Smoked translucent top cover lid
  const printerUpperLid = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(2.12, 0.08, 1.56, 0.08)),
    smokedGlassMat,
  );
  printerUpperLid.position.set(0, 1.38, 0);
  printerUpperLid.renderOrder = 2;
  printerUpperLid.userData.baseY = 1.38;
  printerUpperLid.userData.explodeOffset = new THREE.Vector3(0, 0.9, 0);
  printerGroup.add(printerUpperLid);

  // Part 6: Tilted backlit OLED touch console
  const consoleHousing = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(0.86, 0.08, 0.44, 0.04)),
    matteSlateMat,
  );
  consoleHousing.position.set(0.62, 1.24, 0.88);
  consoleHousing.rotation.x = 0.48;
  consoleHousing.userData.baseY = 1.24;
  consoleHousing.userData.explodeOffset = new THREE.Vector3(0.25, 0.5, 0.35);
  printerGroup.add(consoleHousing);

  const oledMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: oledClrTex,
      emissive: 0x1e40af,
      emissiveMap: oledClrTex,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.1,
    }),
  );
  const oledScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.76, 0.36)), oledMat);
  oledScreen.position.set(0.62, 1.275, 0.905);
  oledScreen.rotation.x = -Math.PI / 2 + 0.48;
  oledScreen.userData.baseY = 1.275;
  oledScreen.userData.explodeOffset = new THREE.Vector3(0.25, 0.5, 0.35);
  printerGroup.add(oledScreen);

  // Part 7: CMYK toner indicator cartridges
  const cmykColors = [0x06b6d4, 0xec4899, 0xeab308, 0x0f172a];
  cmykColors.forEach((col, i) => {
    const tonerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.25,
        metalness: 0.3,
      }),
    );
    const cartridge = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.065, 0.065, 0.36, 16)),
      tonerMat,
    );
    cartridge.rotation.z = Math.PI / 2;
    cartridge.position.set(-0.62 + i * 0.22, 0.92, 0.82);
    cartridge.userData.baseY = 0.92;
    cartridge.userData.explodeOffset = new THREE.Vector3(0, 0.2, 0.6);
    printerGroup.add(cartridge);
  });

  // Part 8: Chrome output roller & guide bar
  const roller = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 1.38, 18)),
    brushedAluminumMat,
  );
  roller.rotation.z = Math.PI / 2;
  roller.position.set(-0.2, 0.94, 0.68);
  roller.userData.baseY = 0.94;
  printerGroup.add(roller);

  // Part 9: Paper tray extension wing
  const outputTray = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(1.15, 0.04, 0.68, 0.03)),
    accentBlueMat,
  );
  outputTray.position.set(-0.2, 0.78, 1.05);
  outputTray.rotation.x = -0.14;
  outputTray.userData.baseY = 0.78;
  outputTray.userData.explodeOffset = new THREE.Vector3(0, 0, 0.4);
  printerGroup.add(outputTray);

  // Part 10: Animated emerging A4 printed sheet
  const sheetMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pageClrTex,
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );
  const exitingSheet = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.74, 0.96)), sheetMat);
  exitingSheet.position.set(-0.2, 0.88, 1.08);
  exitingSheet.rotation.x = -Math.PI / 2 - 0.14;
  exitingSheet.castShadow = true;
  exitingSheet.userData.baseY = 0.88;
  printerGroup.add(exitingSheet);

  root.add(printerGroup);

  // 2. COMPOSITE SUBJECT: BOUND THESIS & DOCUMENT STACK (7 parts)
  const docGroup = new THREE.Group();
  docGroup.position.set(-2.55, 0, 0.55);
  docGroup.rotation.y = 0.38;
  docGroup.userData.subjectId = 'document';

  const docShadow = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(1.05, 28)), shadowMat);
  docShadow.rotation.x = -Math.PI / 2;
  docShadow.position.y = 0.015;
  docGroup.add(docShadow);

  const paperBlockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  const paperBlock1 = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(1.02, 0.22, 1.38, 0.03)),
    paperBlockMat,
  );
  paperBlock1.position.y = 0.12;
  paperBlock1.castShadow = true;
  paperBlock1.receiveShadow = true;
  paperBlock1.userData.baseY = 0.12;
  docGroup.add(paperBlock1);

  const paperBlock2 = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(1.0, 0.18, 1.36, 0.03)),
    paperBlockMat,
  );
  paperBlock2.position.set(0.03, 0.34, -0.02);
  paperBlock2.rotation.y = -0.08;
  paperBlock2.castShadow = true;
  paperBlock2.userData.baseY = 0.34;
  paperBlock2.userData.explodeOffset = new THREE.Vector3(0, 0.35, 0);
  docGroup.add(paperBlock2);

  // Dynamic top cover sheet / hardcover
  const docCoverMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pageClrTex,
      roughness: 0.65,
      metalness: 0.05,
    }),
  );
  const docCoverMesh = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(1.02, 0.035, 1.38, 0.02)),
    docCoverMat,
  );
  docCoverMesh.position.set(0.03, 0.455, -0.02);
  docCoverMesh.rotation.y = -0.08;
  docCoverMesh.castShadow = true;
  docCoverMesh.userData.baseY = 0.455;
  docCoverMesh.userData.explodeOffset = new THREE.Vector3(0, 0.72, 0);
  docGroup.add(docCoverMesh);

  // Hardcover gold spine
  const spineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.4,
      metalness: 0.35,
    }),
  );
  const hardcoverSpine = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(0.11, 0.25, 1.4, 0.03)),
    spineMat,
  );
  hardcoverSpine.position.set(-0.46, 0.34, -0.06);
  hardcoverSpine.rotation.y = -0.08;
  hardcoverSpine.visible = false;
  hardcoverSpine.userData.baseY = 0.34;
  hardcoverSpine.userData.explodeOffset = new THREE.Vector3(-0.3, 0.35, 0);
  docGroup.add(hardcoverSpine);

  // Spiral Kawat rings group (10 metallic rings along left edge)
  const spiralRingsGroup = new THREE.Group();
  const ringGeo = trackGeo(new THREE.TorusGeometry(0.075, 0.015, 10, 20));
  for (let i = 0; i < 10; i++) {
    const ring = new THREE.Mesh(ringGeo, brushedAluminumMat);
    ring.rotation.y = Math.PI / 2 - 0.08;
    ring.position.set(-0.49, 0.35, -0.58 + i * 0.125);
    spiralRingsGroup.add(ring);
  }
  spiralRingsGroup.userData.baseY = 0;
  spiralRingsGroup.userData.explodeOffset = new THREE.Vector3(-0.35, 0.45, 0);
  docGroup.add(spiralRingsGroup);

  // Bookmark ribbon accent
  const ribbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.45,
      metalness: 0.1,
    }),
  );
  const ribbon = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.09, 0.02, 0.32)),
    ribbonMat,
  );
  ribbon.position.set(0.28, 0.46, 0.65);
  ribbon.rotation.y = 0.12;
  ribbon.userData.baseY = 0.46;
  ribbon.userData.explodeOffset = new THREE.Vector3(0, 0.85, 0.2);
  docGroup.add(ribbon);

  root.add(docGroup);

  // 3. COMPOSITE SUBJECT: PRINTKAMPUS CAT MASCOT (9 parts, grounded bottom-center)
  const mascotGroup = new THREE.Group();
  mascotGroup.position.set(2.45, 0, 0.6);
  mascotGroup.rotation.y = -0.45;
  mascotGroup.userData.subjectId = 'mascot';

  const mascotShadow = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.82, 28)), shadowMat);
  mascotShadow.rotation.x = -Math.PI / 2;
  mascotShadow.position.y = 0.015;
  mascotGroup.add(mascotShadow);

  const catFurMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.68,
      metalness: 0.02,
    }),
  );
  const catEarPinkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      roughness: 0.55,
      metalness: 0.0,
    }),
  );
  const catEyeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
    }),
  );

  // Pedestal base
  const mascotPedestal = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.56, 0.62, 0.12, 28)),
    accentBlueMat,
  );
  mascotPedestal.position.y = 0.06;
  mascotPedestal.castShadow = true;
  mascotPedestal.receiveShadow = true;
  mascotPedestal.userData.baseY = 0.06;
  mascotGroup.add(mascotPedestal);

  // Torso (LatheGeometry silhouette)
  const torsoPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(0.36, 0.02),
    new THREE.Vector2(0.39, 0.22),
    new THREE.Vector2(0.31, 0.48),
    new THREE.Vector2(0.24, 0.62),
    new THREE.Vector2(0.01, 0.64),
  ];
  const catTorso = new THREE.Mesh(
    trackGeo(new THREE.LatheGeometry(torsoPts, 24)),
    catFurMat,
  );
  catTorso.position.y = 0.12;
  catTorso.castShadow = true;
  catTorso.userData.baseY = 0.12;
  mascotGroup.add(catTorso);

  // Collar + brass bell
  const collar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.245, 0.032, 12, 24)),
    accentBlueMat,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.72;
  collar.userData.baseY = 0.72;
  mascotGroup.add(collar);

  const bellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.9,
    }),
  );
  const bell = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 16, 16)), bellMat);
  bell.position.set(0, 0.69, 0.25);
  bell.userData.baseY = 0.69;
  mascotGroup.add(bell);

  // Head group (animated gentle nod/look)
  const mascotHead = new THREE.Group();
  mascotHead.position.y = 0.98;
  mascotHead.userData.baseY = 0.98;
  mascotHead.userData.explodeOffset = new THREE.Vector3(0, 0.45, 0);

  const headSphere = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.33, 24, 20)),
    catFurMat,
  );
  headSphere.scale.set(1.06, 0.94, 0.98);
  headSphere.castShadow = true;
  mascotHead.add(headSphere);

  // Ears
  const earGeo = trackGeo(new THREE.ConeGeometry(0.12, 0.26, 4));
  const innerEarGeo = trackGeo(new THREE.ConeGeometry(0.065, 0.16, 4));
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(earGeo, catFurMat);
    ear.position.set(side * 0.21, 0.28, 0.02);
    ear.rotation.z = -side * 0.34;
    ear.rotation.y = Math.PI / 4;
    ear.castShadow = true;
    mascotHead.add(ear);

    const inner = new THREE.Mesh(innerEarGeo, catEarPinkMat);
    inner.position.set(side * 0.21, 0.27, 0.065);
    inner.rotation.z = -side * 0.34;
    inner.rotation.y = Math.PI / 4;
    mascotHead.add(inner);

    const eye = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 14, 14)), catEyeMat);
    eye.position.set(side * 0.12, 0.04, 0.295);
    mascotHead.add(eye);
  });

  // Mini Campus Graduation Cap (Toga accent)
  const capBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.16, 0.18, 0.09, 16)),
    matteSlateMat,
  );
  capBase.position.set(0, 0.31, -0.02);
  mascotHead.add(capBase);

  const capBoard = new THREE.Mesh(
    trackGeo(createRoundedBoxGeometry(0.46, 0.03, 0.46, 0.02)),
    matteSlateMat,
  );
  capBoard.position.set(0, 0.37, -0.02);
  capBoard.rotation.y = Math.PI / 4;
  mascotHead.add(capBoard);

  mascotGroup.add(mascotHead);

  // Curved TubeGeometry tail
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.24, -0.32),
    new THREE.Vector3(0.24, 0.32, -0.48),
    new THREE.Vector3(0.38, 0.56, -0.44),
    new THREE.Vector3(0.32, 0.78, -0.3),
  ]);
  const mascotTail = new THREE.Mesh(
    trackGeo(new THREE.TubeGeometry(tailCurve, 18, 0.055, 10, false)),
    catFurMat,
  );
  mascotTail.castShadow = true;
  mascotTail.userData.baseY = 0;
  mascotGroup.add(mascotTail);

  // Mini paper scroll held at front
  const scroll = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.055, 0.055, 0.48, 16)),
    paperBlockMat,
  );
  scroll.rotation.z = Math.PI / 2 - 0.2;
  scroll.position.set(0, 0.42, 0.36);
  mascotGroup.add(scroll);

  root.add(mascotGroup);

  // 4. FLOATING WORKFLOW CARDS (PDF -> PRINT -> PICK UP)
  const floatingCards = new THREE.Group();
  const cardGeo = trackGeo(createRoundedBoxGeometry(0.55, 0.72, 0.03, 0.04));
  const cardColors = [0x38bdf8, 0x2563eb, 0x10b981];
  const cardPositions: [number, number, number][] = [
    [-1.5, 2.05, -0.6],
    [0.1, 2.35, -0.9],
    [1.6, 2.0, -0.55],
  ];
  cardColors.forEach((col, i) => {
    const cMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.35,
        metalness: 0.15,
      }),
    );
    const card = new THREE.Mesh(cardGeo, cMat);
    card.position.set(...cardPositions[i]);
    card.rotation.set(0.15, (i - 1) * 0.28, (i - 1) * -0.08);
    card.castShadow = true;
    card.userData.baseY = cardPositions[i][1];
    card.userData.phase = i * 1.4;
    floatingCards.add(card);
  });
  root.add(floatingCards);

  const interactables: THREE.Object3D[] = [printerGroup, docGroup, mascotGroup];

  const applyFinish = (mode: PrintFinishMode) => {
    if (mode === 'bw') {
      oledMat.map = oledBwTex;
      oledMat.emissiveMap = oledBwTex;
      sheetMat.map = pageBwTex;
      docCoverMat.map = pageBwTex;
      docCoverMat.color.setHex(0xffffff);
      spiralRingsGroup.visible = false;
      hardcoverSpine.visible = false;
    } else if (mode === 'color') {
      oledMat.map = oledClrTex;
      oledMat.emissiveMap = oledClrTex;
      sheetMat.map = pageClrTex;
      docCoverMat.map = pageClrTex;
      docCoverMat.color.setHex(0xffffff);
      spiralRingsGroup.visible = false;
      hardcoverSpine.visible = false;
    } else if (mode === 'spiral') {
      oledMat.map = oledClrTex;
      oledMat.emissiveMap = oledClrTex;
      sheetMat.map = pageClrTex;
      docCoverMat.map = pageClrTex;
      docCoverMat.color.setHex(0xffffff);
      spiralRingsGroup.visible = true;
      hardcoverSpine.visible = false;
    } else {
      oledMat.map = oledBwTex;
      oledMat.emissiveMap = oledBwTex;
      sheetMat.map = pageBwTex;
      docCoverMat.map = hardcoverTex;
      docCoverMat.color.setHex(0xffffff);
      spiralRingsGroup.visible = false;
      hardcoverSpine.visible = true;
    }
    oledMat.needsUpdate = true;
    sheetMat.needsUpdate = true;
    docCoverMat.needsUpdate = true;
  };

  const setExploded = (factor: number) => {
    const applyGroup = (grp: THREE.Group) => {
      grp.children.forEach((child) => {
        const offset = child.userData.explodeOffset as THREE.Vector3 | undefined;
        const baseY = child.userData.baseY as number | undefined;
        if (offset) {
          if (child.userData.origPos === undefined) {
            child.userData.origPos = child.position.clone();
          }
          const orig = child.userData.origPos as THREE.Vector3;
          child.position.set(
            orig.x + offset.x * factor,
            (baseY ?? orig.y) + offset.y * factor,
            orig.z + offset.z * factor,
          );
        }
      });
    };
    applyGroup(printerGroup);
    applyGroup(docGroup);
    applyGroup(mascotGroup);
  };

  applyFinish('spiral');

  const dispose = () => {
    disposableGeos.forEach((g) => g.dispose());
    disposableMats.forEach((m) => m.dispose());
    disposableTex.forEach((t) => t.dispose());
  };

  return {
    root,
    printerGroup,
    printerUpperLid,
    exitingSheet,
    docGroup,
    docCoverMesh,
    spiralRingsGroup,
    hardcoverSpine,
    mascotGroup,
    mascotHead,
    mascotTail,
    floatingCards,
    interactables,
    applyFinish,
    setExploded,
    dispose,
  };
}
