import { AnatomyStructure, SystemId } from "./types";

export interface TreeBranchNode {
  type: "branch";
  id: string;
  label: string;
  system: SystemId;
  level: number;
  allItemIds: string[];
  children: TreeNodeItem[];
}

export interface TreeLeafNode {
  type: "leaf";
  id: string;
  structure: AnatomyStructure;
  level: number;
}

export type TreeNodeItem = TreeBranchNode | TreeLeafNode;

/**
 * Determina la ruta jerárquica anatómica de una estructura dentro de su sistema.
 * Retorna [Nivel2, Nivel3 (opcional)]
 */
export function getStructureHierarchyPath(s: AnatomyStructure): string[] {
  const sys = s.system;
  const name = `${s.nameEs} ${s.nameEn} ${s.nameLa} ${s.id}`.toLowerCase();

  if (sys === "skeletal") {
    if (
      hasAny(name, [
        "craneo",
        "cráneo",
        "skull",
        "frontal",
        "parietal",
        "temporal",
        "occipital",
        "esfenoid",
        "sphenoid",
        "etmoid",
        "ethmoid",
        "maxilar",
        "maxilla",
        "mandibula",
        "mandíbula",
        "mandible",
        "cigomatico",
        "cigomático",
        "zygomatic",
        "nasal",
        "lagrimal",
        "lacrimal",
        "vomer",
        "vómer",
        "cornete",
        "palatino",
        "palatine",
        "hioides",
        "hyoid",
        "oido",
        "oído",
        "ear",
        "martillo",
        "yunque",
        "estribo",
        "malleus",
        "incus",
        "stapes",
        "sutura",
        "calvaria",
        "vertex",
        "bregma",
        "pterion",
        "inion",
        "lambda",
        "asterion",
      ])
    ) {
      return ["Cráneo y cara"];
    }

    if (
      hasAny(name, [
        "vertebra",
        "vértebra",
        "columna",
        "cervical",
        "toracica",
        "torácica",
        "lumbar",
        "sacro",
        "sacrum",
        "coccix",
        "cóccix",
        "coccyx",
        "intervertebral",
        "axis",
        "atlas",
      ])
    ) {
      return ["Columna vertebral"];
    }

    if (
      hasAny(name, [
        "costilla",
        "rib",
        "costal",
        "esternon",
        "esternón",
        "sternum",
        "xifoides",
        "xiphoid",
        "manubrio",
        "manubrium",
        "torax",
        "tórax",
        "thorax",
      ])
    ) {
      return ["Caja torácica y esternón"];
    }

    if (
      hasAny(name, [
        "clavicula",
        "clavícula",
        "clavicle",
        "escapula",
        "escápula",
        "scapula",
        "humero",
        "húmero",
        "humerus",
        "radio",
        "radius",
        "cubito",
        "cúbito",
        "ulna",
        "carpo",
        "carpal",
        "escafoides",
        "scaphoid",
        "semilunar",
        "lunate",
        "piramidal",
        "triquetr",
        "pisiforme",
        "pisiform",
        "trapecio",
        "trapezium",
        "trapezoide",
        "trapezoid",
        "capitate",
        "ganchoso",
        "hamate",
        "metacarpo",
        "metacarpal",
        "falange",
        "phalanx",
        "antebrazo",
        "forearm",
        "brazo",
        "arm",
        "mano",
        "hand",
        "pulgar",
        "thumb",
        "índice",
        "index",
        "anular",
        "ring",
        "meñique",
        "little finger",
        "interósea",
        "interosseous",
      ])
    ) {
      if (
        hasAny(name, [
          "mano",
          "hand",
          "carpo",
          "carpal",
          "metacarpo",
          "metacarpal",
          "falange",
          "phalanx",
          "pulgar",
          "thumb",
          "índice",
          "index",
          "anular",
          "ring",
          "meñique",
          "little",
          "escafoides",
          "semilunar",
          "piramidal",
          "triquetr",
          "pisiform",
          "trapec",
          "capitate",
          "hamate",
        ])
      ) {
        return ["Miembro superior", "Mano y dedos"];
      }
      if (
        hasAny(name, [
          "radio",
          "radius",
          "cubito",
          "cúbito",
          "ulna",
          "antebrazo",
          "forearm",
          "interósea",
        ])
      ) {
        return ["Miembro superior", "Antebrazo"];
      }
      return ["Miembro superior", "Hombro y brazo"];
    }

    if (
      hasAny(name, [
        "pelvis",
        "coxal",
        "ilion",
        "ilium",
        "isquion",
        "ischium",
        "pubis",
        "femur",
        "fémur",
        "rotula",
        "rótula",
        "patella",
        "tibia",
        "perone",
        "peroné",
        "fibula",
        "tarso",
        "tarsal",
        "calcaneo",
        "calcáneo",
        "calcaneus",
        "astragalo",
        "astrágalo",
        "talus",
        "navicular",
        "cuboides",
        "cuboid",
        "cuneiforme",
        "cuneiform",
        "metatarso",
        "metatarsal",
        "pie",
        "foot",
        "acetabulum",
        "acetábulo",
        "toe",
        "hallux",
        "menisco",
        "meniscus",
        "sesamoid",
      ])
    ) {
      if (
        hasAny(name, [
          "pie",
          "foot",
          "tarso",
          "tarsal",
          "calcaneo",
          "astragalo",
          "navicular",
          "cuboid",
          "cuneiform",
          "metatarso",
          "toe",
          "hallux",
        ])
      ) {
        return ["Pelvis y miembro inferior", "Pie y dedos"];
      }
      if (
        hasAny(name, ["tibia", "perone", "peroné", "fibula", "pierna", "leg"])
      ) {
        return ["Pelvis y miembro inferior", "Pierna"];
      }
      return ["Pelvis y miembro inferior", "Pelvis, cadera y muslo"];
    }

    return ["Esqueleto general"];
  }

  if (sys === "muscular") {
    if (
      hasAny(name, [
        "cabeza",
        "head",
        "cara",
        "facial",
        "cuello",
        "neck",
        "masetero",
        "masseter",
        "temporal",
        "fronto",
        "occipito",
        "orbicular",
        "orbicularis",
        "cigomatico",
        "cigomático",
        "zygomaticus",
        "buccinador",
        "risorio",
        "mentoniano",
        "escaleno",
        "scalene",
        "esternocleidomastoideo",
        "sternocleidomastoid",
        "esternohioideo",
        "omohioideo",
        "tirohioideo",
        "constrictor",
        "pterigoideo",
        "pterygoid",
        "milohioideo",
        "genihioideo",
        "digastrico",
        "digástrico",
        "esplenio de la cabeza",
        "platisma",
        "platysma",
        "galea",
        "auricular",
        "nasal",
        "depresor",
      ])
    ) {
      return ["Cabeza y cuello"];
    }

    if (
      hasAny(name, [
        "pectoral",
        "intercostal",
        "diafragma",
        "diaphragm",
        "rectus abdominis",
        "recto del abdomen",
        "oblicuo",
        "oblique",
        "transversus abdominis",
        "subcostal",
        "transversus thoracis",
        "linea alba",
        "línea alba",
        "ombligo",
        "cremáster",
        "cremaster",
        "serrato anterior",
        "serratus anterior",
        "piramidal del abdomen",
        "torácic",
        "thoracic",
      ])
    ) {
      return ["Tórax y abdomen"];
    }

    if (
      hasAny(name, [
        "dorso",
        "back",
        "trapecio",
        "trapezius",
        "dorsal",
        "latissimus",
        "romboides",
        "rhomboid",
        "esplenio",
        "splenius",
        "erector",
        "iliocostal",
        "longisimo",
        "longissimus",
        "espinoso",
        "spinalis",
        "semiespinoso",
        "rotadores",
        "interespinos",
        "multifido",
        "multífido",
        "cuadrado lumbar",
        "serrato posterior",
      ])
    ) {
      return ["Dorso y columna"];
    }

    if (
      hasAny(name, [
        "deltoides",
        "deltoid",
        "supraespinoso",
        "infraespinoso",
        "redondo menor",
        "redondo mayor",
        "teres",
        "subescapular",
        "biceps braquial",
        "bíceps braquial",
        "biceps brachii",
        "braquial",
        "brachial",
        "coracobraquial",
        "triceps braquial",
        "tríceps braquial",
        "triceps brachii",
        "anconeo",
        "ancóneo",
        "pronador",
        "pronator",
        "supinador",
        "supinator",
        "braquiorradial",
        "brachioradialis",
        "flexor radial",
        "flexor cubital",
        "flexor carpi",
        "extensor carpi",
        "extensor radial",
        "extensor cubital",
        "palmar",
        "abductor del pulgar",
        "flexor del pulgar",
        "oponente",
        "opponens",
        "lumbrical",
        "interoseo",
        "interóseo",
        "interosseus",
        "mano",
        "hand",
        "brazo",
        "arm",
        "forearm",
        "antebrazo",
        "abductor digiti",
        "retináculo",
      ])
    ) {
      if (
        hasAny(name, [
          "mano",
          "hand",
          "pulgar",
          "thumb",
          "palmar",
          "lumbrical",
          "interoseo",
          "interóseo",
          "oponente",
          "retináculo",
        ])
      ) {
        return ["Miembro superior", "Mano y dedos"];
      }
      if (
        hasAny(name, [
          "antebrazo",
          "forearm",
          "pronador",
          "supinador",
          "braquiorradial",
          "flexor",
          "extensor",
        ])
      ) {
        return ["Miembro superior", "Antebrazo"];
      }
      return ["Miembro superior", "Hombro y brazo"];
    }

    if (
      hasAny(name, [
        "gluteo",
        "glúteo",
        "gluteus",
        "piriforme",
        "piriformis",
        "obturador",
        "obturator",
        "gemelo",
        "gemellus",
        "cuadrado femoral",
        "tensor de la fascia",
        "sartorio",
        "sartorius",
        "cuadriceps",
        "cuádriceps",
        "recto femoral",
        "vasto",
        "vastus",
        "gracil",
        "grácil",
        "gracilis",
        "pectineo",
        "pectíneo",
        "aductor",
        "adductor",
        "biceps femoral",
        "bíceps femoral",
        "semitendinoso",
        "semimembranoso",
        "tibial",
        "gastrocnemio",
        "gastrocnemius",
        "soleo",
        "sóleo",
        "soleus",
        "plantar",
        "plantaris",
        "popliteo",
        "poplíteo",
        "peroneo",
        "fibularis",
        "pie",
        "foot",
        "muslo",
        "thigh",
        "pierna",
        "leg",
        "calcáneo",
        "calcaneus",
        "psoas",
        "ilíaco",
        "iliacus",
      ])
    ) {
      if (
        hasAny(name, [
          "pie",
          "foot",
          "plantar",
          "dedos del pie",
          "hallux",
          "calcáneo",
        ])
      ) {
        return ["Pelvis y miembro inferior", "Pie y dedos"];
      }
      if (
        hasAny(name, [
          "tibial",
          "gastrocnemio",
          "soleo",
          "sóleo",
          "peroneo",
          "pierna",
          "popliteo",
        ])
      ) {
        return ["Pelvis y miembro inferior", "Pierna y pantorrilla"];
      }
      return ["Pelvis y miembro inferior", "Glúteo y muslo"];
    }

    return ["Musculatura general"];
  }

  if (sys === "circulatory") {
    if (
      hasAny(name, [
        "corazon",
        "corazón",
        "heart",
        "coronari",
        "ventriculo",
        "ventrículo",
        "ventricle",
        "auricula",
        "aurícula",
        "atrium",
        "valvula",
        "válvula",
        "valve",
        "miocardio",
        "pericardio",
        "seno coronario",
        "cono arterioso",
        "septal",
        "cardiac vein",
        "cardiaca",
        "cardíaca",
        "marginal vein",
        "vena marginal",
        "fossa ovalis",
        "conus",
      ])
    ) {
      return ["Corazón y vasos coronarios"];
    }

    if (
      hasAny(name, [
        "aorta",
        "carotida",
        "carótida",
        "carotid",
        "subclavia",
        "subclavian",
        "yugular",
        "jugular",
        "cava",
        "braquiocefalic",
        "braquiocefálic",
        "brachiocephalic",
        "vertebral",
        "seno sagital",
        "seno transverso",
        "seno dural",
        "cerebral",
        "basilar",
        "facial",
        "lingual",
        "maxilar",
        "maxillary",
        "temporal superficial",
        "occipital",
        "oftalmica",
        "oftálmica",
        "cabeza",
        "cuello",
        "tirocervical",
        "costocervical",
        "cervical profunda",
        "angular",
        "supraescapular",
      ])
    ) {
      return ["Grandes vasos, cabeza y cuello"];
    }

    if (
      hasAny(name, [
        "axilar",
        "axillary",
        "braquial",
        "brachial",
        "radial",
        "cubital",
        "ulnar",
        "interose",
        "interóse",
        "palmar",
        "arco palmar",
        "digitales de la mano",
        "cefalica",
        "cefálica",
        "cephalic",
        "basilica",
        "basílica",
        "basilic",
        "miembro superior",
        "antebrazo",
        "mano",
        "dorsal de la escápula",
      ])
    ) {
      return ["Vasos del miembro superior"];
    }

    if (
      hasAny(name, [
        "iliac",
        "ilíac",
        "femoral",
        "poplite",
        "poplíte",
        "tibial",
        "fibular",
        "perone",
        "peronea",
        "safena",
        "saphenous",
        "plantar",
        "dorsal del pie",
        "digitales del pie",
        "glute",
        "glúte",
        "pudend",
        "miembro inferior",
        "muslo",
        "pierna",
        "pie",
      ])
    ) {
      return ["Vasos de pelvis y miembro inferior"];
    }

    if (
      hasAny(name, [
        "pulmonar",
        "pulmonary",
        "intercostal",
        "toracic",
        "torácic",
        "thoracic",
        "celiac",
        "celíac",
        "mesenteric",
        "mesentéric",
        "renal",
        "hepatic",
        "hepátic",
        "splenic",
        "esplénic",
        "gastric",
        "gástric",
        "porta",
        "azigos",
        "ázigos",
        "azygos",
        "hemizigos",
        "lumbar",
        "frenic",
        "frénic",
        "phrenic",
        "suprarrenal",
        "subcostal",
        "esophageal",
        "segmental",
      ])
    ) {
      return ["Tronco, tórax y abdomen"];
    }

    return ["Vasos del tronco y sistémicos"];
  }

  if (sys === "nervous") {
    if (
      hasAny(name, [
        "cerebro",
        "cerebrum",
        "hemisferio",
        "corteza",
        "cortex",
        "frontal",
        "parietal",
        "temporal",
        "occipital",
        "insula",
        "hipocampo",
        "amigdala",
        "amígdala",
        "cuerpo calloso",
        "fornix",
        "fórnix",
        "circunvolución",
        "gyrus",
        "surco",
        "sulcus",
        "lóbulo",
        "lobule",
        "meninge",
        "duramadre",
        "aracnoides",
        "piamadre",
      ])
    ) {
      return ["Encéfalo y corteza cerebral"];
    }

    if (
      hasAny(name, [
        "talamo",
        "tálamo",
        "thalamus",
        "hipotalamo",
        "hipotálamo",
        "hipofisis",
        "hipófisis",
        "pituitaria",
        "epifisis",
        "epífisis",
        "pineal",
        "estriado",
        "putamen",
        "caudado",
        "globo palido",
        "globo pálido",
        "nucleo basal",
        "núcleo basal",
        "ventriculo lateral",
        "ventrículo lateral",
        "tercer ventriculo",
        "tercer ventrículo",
        "coroideo",
      ])
    ) {
      return ["Diencéfalo y núcleos basales"];
    }

    if (
      hasAny(name, [
        "tronco",
        "mesencefalo",
        "mesencéfalo",
        "puente",
        "pons",
        "bulbo",
        "medulla oblongata",
        "cerebelo",
        "cerebellum",
        "cuarto ventriculo",
        "cuarto ventrículo",
        "oliva",
      ])
    ) {
      return ["Tronco encefálico y cerebelo"];
    }

    if (
      hasAny(name, [
        "ojo",
        "eye",
        "retina",
        "ciliar",
        "coroides",
        "cornea",
        "córnea",
        "cristalino",
        "lente",
        "iris",
        "pupila",
        "parpado",
        "párpado",
        "conjuntiva",
        "fovea",
        "fóvea",
        "macula",
        "mácula",
        "sclera",
        "esclera",
        "ora serrata",
        "schlemm",
        "oido",
        "oído",
        "ear",
        "coclea",
        "cóclea",
        "vestibulo",
        "vestíbulo",
        "timpanico",
        "timpánico",
      ])
    ) {
      return ["Órganos de los sentidos (Ojo y oído)"];
    }

    if (
      hasAny(name, [
        "medula espinal",
        "médula espinal",
        "spinal cord",
        "nervio",
        "nerve",
        "plexo",
        "plexus",
        "raiz",
        "raíz",
        "ganglio",
        "espinal",
      ])
    ) {
      return ["Médula espinal y nervios"];
    }

    return ["Sistema nervioso general"];
  }

  if (sys === "digestive") {
    if (
      hasAny(name, [
        "boca",
        "oral",
        "diente",
        "tooth",
        "lengua",
        "tongue",
        "sublingual",
        "submandibular",
        "parotida",
        "parótida",
        "faringe",
        "pharynx",
        "esofago",
        "esófago",
        "esophagus",
        "paladar",
      ])
    ) {
      return ["Cavidad oral, faringe y esófago"];
    }

    if (
      hasAny(name, [
        "estomago",
        "estómago",
        "stomach",
        "gastric",
        "gástric",
        "cardias",
        "piloro",
        "píloro",
        "duodeno",
        "duodenum",
      ])
    ) {
      return ["Estómago y duodeno"];
    }

    if (
      hasAny(name, [
        "higado",
        "hígado",
        "liver",
        "hepatic",
        "hepátic",
        "vesicula",
        "vesícula",
        "gallbladder",
        "biliar",
        "coledoco",
        "colédoco",
        "cistico",
        "cístico",
        "pancreas",
        "páncreas",
      ])
    ) {
      return ["Hígado, vías biliares y páncreas"];
    }

    if (
      hasAny(name, [
        "yeyuno",
        "jejunum",
        "ileon",
        "íleon",
        "ileum",
        "ciego",
        "cecum",
        "apendice",
        "apéndice",
        "appendix",
        "colon",
        "recto",
        "rectum",
        "ano",
        "anus",
        "peritoneo",
        "omento",
      ])
    ) {
      return ["Intestino delgado y colon"];
    }

    return ["Tubo digestivo"];
  }

  if (sys === "respiratory") {
    if (
      hasAny(name, [
        "nariz",
        "nasal",
        "seno frontal",
        "seno maxilar",
        "seno esfenoidal",
        "seno etmoidal",
        "faringe",
        "choana",
        "coana",
      ])
    ) {
      return ["Vías aéreas superiores"];
    }

    if (
      hasAny(name, [
        "laringe",
        "larynx",
        "tiroides",
        "cricoides",
        "aritenoides",
        "corniculado",
        "cuneiforme",
        "epiglotis",
        "glotis",
        "cuerda vocal",
      ])
    ) {
      return ["Laringe y fonación"];
    }

    if (
      hasAny(name, [
        "traquea",
        "tráquea",
        "trachea",
        "bronquio",
        "bronchus",
        "carina",
        "bronquial",
      ])
    ) {
      return ["Tráquea y árbol bronquial"];
    }

    if (
      hasAny(name, [
        "pulmon",
        "pulmón",
        "lung",
        "pleura",
        "lobulo pulmonar",
        "lóbulo pulmonar",
      ])
    ) {
      return ["Pulmones y pleuras"];
    }

    return ["Vías respiratorias"];
  }

  if (sys === "urinary") {
    if (
      hasAny(name, [
        "riñon",
        "riñón",
        "kidney",
        "renal",
        "suprarrenal",
        "adrenal",
        "capsula renal",
        "cápsula renal",
        "corteza renal",
      ])
    ) {
      return ["Riñones y glándulas suprarrenales"];
    }
    return ["Vías urinarias y vejiga"];
  }

  if (sys === "reproductive") {
    if (
      hasAny(name, [
        "ovario",
        "utero",
        "útero",
        "vagina",
        "trompa",
        "cervix",
        "cérvix",
        "clitoris",
        "clítoris",
        "vulva",
        "mama",
      ])
    ) {
      return ["Órganos reproductores femeninos"];
    }
    if (
      hasAny(name, [
        "testiculo",
        "testículo",
        "epididimo",
        "epidídimo",
        "prostata",
        "próstata",
        "pene",
        "deferente",
        "seminal",
        "escroto",
      ])
    ) {
      return ["Órganos reproductores masculinos"];
    }
    return ["Órganos reproductores"];
  }

  if (sys === "lymphatic") {
    if (hasAny(name, ["bazo", "spleen", "timo", "thymus"])) {
      return ["Bazo y timo"];
    }
    return ["Ganglios y vasos linfáticos"];
  }

  if (sys === "integumentary") {
    return ["Piel y anejos cutáneos"];
  }

  return ["Estructuras anatómicas"];
}

function hasAny(text: string, keywords: string[]): boolean {
  for (let i = 0; i < keywords.length; i++) {
    if (text.includes(keywords[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Construye el árbol jerárquico recursivo de un sistema anatómico.
 */
export function buildSystemHierarchy(
  systemId: SystemId,
  structures: AnatomyStructure[]
): TreeNodeItem[] {
  // 1. Agrupar las estructuras según su ruta jerárquica
  type IntermediateMap = Map<string, { leaves: AnatomyStructure[]; sub: Map<string, AnatomyStructure[]> }>;
  const topGroups: IntermediateMap = new Map();

  for (const st of structures) {
    const path = getStructureHierarchyPath(st);
    const l2 = path[0] || "General";
    const l3 = path[1];

    if (!topGroups.has(l2)) {
      topGroups.set(l2, { leaves: [], sub: new Map() });
    }
    const g = topGroups.get(l2)!;

    if (l3) {
      if (!g.sub.has(l3)) {
        g.sub.set(l3, []);
      }
      g.sub.get(l3)!.push(st);
    } else {
      g.leaves.push(st);
    }
  }

  // 2. Convertir los grupos a nodos TreeBranchNode y TreeLeafNode
  const result: TreeNodeItem[] = [];

  // Ordenar grupos de nivel 2 alfabéticamente
  const sortedL2Keys = Array.from(topGroups.keys()).sort((a, b) =>
    a.localeCompare(b, "es")
  );

  for (const l2Key of sortedL2Keys) {
    const g = topGroups.get(l2Key)!;
    const l2BranchId = `${systemId}/${l2Key}`;
    const l2Children: TreeNodeItem[] = [];
    const l2AllIds: string[] = [];

    // Subgrupos de nivel 3 (si existen)
    const sortedL3Keys = Array.from(g.sub.keys()).sort((a, b) =>
      a.localeCompare(b, "es")
    );

    for (const l3Key of sortedL3Keys) {
      const l3Leaves = g.sub.get(l3Key)!;
      // Ordenar hojas en español
      l3Leaves.sort((a, b) => a.nameEs.localeCompare(b.nameEs, "es"));
      const l3ItemIds = l3Leaves.map((s) => s.id);
      l2AllIds.push(...l3ItemIds);

      const l3Children: TreeNodeItem[] = l3Leaves.map((st) => ({
        type: "leaf" as const,
        id: st.id,
        structure: st,
        level: 4,
      }));

      const l3BranchNode: TreeBranchNode = {
        type: "branch",
        id: `${l2BranchId}/${l3Key}`,
        label: l3Key,
        system: systemId,
        level: 3,
        allItemIds: l3ItemIds,
        children: l3Children,
      };

      l2Children.push(l3BranchNode);
    }

    // Hojas directas de nivel 2
    if (g.leaves.length > 0) {
      g.leaves.sort((a, b) => a.nameEs.localeCompare(b.nameEs, "es"));
      for (const st of g.leaves) {
        l2AllIds.push(st.id);
        l2Children.push({
          type: "leaf",
          id: st.id,
          structure: st,
          level: sortedL3Keys.length > 0 ? 3 : 2,
        });
      }
    }

    const l2BranchNode: TreeBranchNode = {
      type: "branch",
      id: l2BranchId,
      label: l2Key,
      system: systemId,
      level: 2,
      allItemIds: l2AllIds,
      children: l2Children,
    };

    result.push(l2BranchNode);
  }

  return result;
}
