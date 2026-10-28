import * as THREE from "three";

// Colores por pieza para los órganos HuBMAP (D-030). Sus GLB pintan todas las mallas con un único
// material, así que se asigna un color didáctico por tipo de estructura según el nombre del nodo
// (convenciones de los atlas: arterias rojas, venas azules, hueso marfil, nervios amarillos...).
// Las reglas se prueban en orden: la primera que coincide gana (p. ej. "pulmonary_valve" es
// válvula, no arteria; "intervertebral_disk" es cartílago, no vértebra).
const RULES: Array<[RegExp, string]> = [
  // Corazón
  [/valve/, "#efe2b8"],
  [/papillary_muscle/, "#f08fa8"],
  [/atrium/, "#e06a62"],
  [/ventricle(?!_branch)/, "#a8343e"],
  [/septum/, "#c8775a"],
  // Vasos
  [/lymph(atic)?_vessel/, "#7cc36b"],
  [/vein|vena_cava|coronary_sinus|schlemm/, "#3a6fd1"],
  [/arter|aort|celiac_trunk|pulmonary_trunk|vasculature/, "#d63031"],
  // Sistema nervioso
  [/nerve|spinal_cord|optic_(tract|chiasm|radiation)|dura_mater/, "#f2c94c"],
  // Cartílago y discos (antes que hueso)
  [/cartilage|meniscus|disk|nucleus_pulposus|carina/, "#a9cbe0"],
  // Ligamentos y tendones
  [/ligament|tendon|frenulum/, "#d8bf74"],
  // Músculo
  [/muscle|rectus|oblique|cricothyroid|arytenoid|thyroepiglott|vocalis|stroma/, "#b8453c"],
  // Hueso y dientes
  [
    /bone|vertebra|femur|tibia|fibula|patella|ilium|ischium|pubis|sacrum|coccyx|sternum|manubrium|mandible|hyoid|condyle|tooth|teeth/,
    "#e9dcc0",
  ],
  // Riñón y vías urinarias
  [/capsule/, "#d9a08a"],
  [/cortex_of_kidney|renal_column/, "#c4584b"],
  [/renal_(medulla|pyramid)/, "#8e2f3a"],
  [/renal_papilla/, "#b75a72"],
  [/calyx|renal_pelvis|ureter|urethra/, "#e3c25b"],
  // Vías biliares y pancreáticas
  [/bile|cystic_duct|hepatic_duct|pancreatic_duct|biliary|gallbladder/, "#5aa05a"],
  // Ojo
  [/sclera|cornea/, "#eeeae2"],
  [/pupil/, "#1f1a1a"],
  [/iris|choroid/, "#7b4a2a"],
  [/lens|vitreous|aqueous/, "#cfe6ef"],
  [/retina|macula|fovea/, "#d9605a"],
  // Ganglio linfático
  [/follicle|paracortex|medulla_of_lymph/, "#8bc34a"],
  // Tejidos superficiales y glándulas
  [/fat|adipose/, "#f3d77a"],
  [/skin|nipple|areola/, "#e8b896"],
  [/mucosa|gingiv|ginviva|tongue|palate|papillae/, "#e07a8a"],
  [/gland|thymus|tonsil|lactiferous|mammary_lobes/, "#e9a66b"],
];

// Para lo que no encaja en ninguna regla (lóbulos del hígado, giros del cerebro, tramos del
// colon...): tonos bien distintos entre sí, elegidos por el nombre para que sean estables.
const FALLBACK = [
  "#e07a5f", "#81b29a", "#f2cc8f", "#6d8fc9", "#c98bb9", "#4fb3a9",
  "#e5989b", "#9c89b8", "#a3c46c", "#f4a259", "#5e9fd1", "#d4a5a5",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hubmapPartColor(nodeName: string): THREE.Color {
  const name = nodeName.toLowerCase().replace(/^vh_[mf]_/, "");
  const h = hash(name);
  const rule = RULES.find(([re]) => re.test(name));
  if (!rule) return new THREE.Color(FALLBACK[h % FALLBACK.length]);
  // Piezas del mismo tipo (las 4 válvulas, los 2 ventrículos) con un matiz de luz distinto
  // para que se distingan cuando se tocan.
  return new THREE.Color(rule[1]).offsetHSL(0, 0, ((h % 5) - 2) * 0.05);
}
