import { SystemId } from "./types";
import { BodySex, CameraPreset } from "../store/useViewerStore";

export interface TourStep {
  title: string;
  description: string;
  bodySex: BodySex;
  enabledSystems: SystemId[];
  systemOpacities?: Partial<Record<SystemId, number>>;
  structureId: string;
  cameraPreset: CameraPreset;
  isolate?: boolean;
}

export interface AnatomyTour {
  id: string;
  title: string;
  subtitle: string;
  steps: TourStep[];
}

export interface QuizQuestion {
  id: string;
  type: "find3d" | "multipleChoice";
  prompt: string;
  hint: string;
  bodySex: BodySex;
  enabledSystems: SystemId[];
  targetStructureId: string;
  targetNameEs: string;
  options?: string[]; // Para multipleChoice (4 opciones, una es targetNameEs)
  explanation: string;
}

export interface AnatomyQuiz {
  id: string;
  title: string;
  subtitle: string;
  questions: QuizQuestion[];
}

// IDs clave que muestran etiquetas (pines 3D) cuando el usuario activa "Pines 3D"
export const KEY_LANDMARK_IDS = new Set<string>([
  "FMA7486",   // Manubrio del esternón
  "FMA12519",  // Atlas (C1)
  "FMA52748",  // Mandíbula
  "FMA13322",  // Clavícula derecha
  "FMA13395",  // Escápula derecha
  "FMA23130",  // Húmero derecho
  "FMA23464",  // Radio derecho
  "FMA16202",  // Hueso sacro
  "FMA16586",  // Hueso coxal derecho
  "FMA24474",  // Fémur derecho
  "FMA24486",  // Rótula derecha
  "FMA24477",  // Tibia derecha
  "FMA13295",  // Diafragma
  "FMA13408",  // Esternocleidomastoideo derecho
  "FMA22328",  // Glúteo mayor derecho
  "FMA22354",  // Sartorio derecho
  "FMA3768",   // Arco de la aorta
  "FMA4720",   // Vena cava superior
  "FMA7238",   // Valva anterior de la válvula tricúspide
  "FMA7242",   // Valva anterior de la válvula mitral
  "FMA3941",   // Arteria carótida común derecha
  "FMA7394",   // Tráquea
  "FMA7396",   // Bronquio principal izquierdo
  "FMA7131",   // Esófago
  "FMA7148",   // Estómago
  "FMA7198",   // Páncreas
  "FMA7202",   // Vesícula biliar
  "FMA7206",   // Duodeno
  "FMA14546",  // Colon transverso
  "FMA7204",   // Riñón derecho
  "FMA7205",   // Riñón izquierdo
  "FMA15900",  // Vejiga urinaria
  "FMA9600",   // Próstata
  "FMA7196",   // Bazo
  "FMA67944",  // Cerebelo
  "FMA67943",  // Puente (protuberancia)
  "FMA86464",  // Cuerpo calloso
  "FMA258714", // Tálamo derecho
  // Femenino (HuBMAP)
  "VH_F_heart",
  "VH_F_uterus",
  "VH_F_ovary_L",
  "VH_F_fallopian_tube_L",
  "VH_F_urinary_bladder",
  "VH_F_kidney_R",
  "VH_F_liver",
  "VH_F_stomach",
  "VH_F_spleen",
  "VH_F_mammary_gland_L",
]);

export const ANATOMY_TOURS: AnatomyTour[] = [
  {
    id: "tour-cardiovascular",
    title: "1. Corazón y grandes vasos",
    subtitle: "Recorrido por las válvulas cardíacas, retorno venoso y arco aórtico (5 pasos)",
    steps: [
      {
        title: "Retorno venoso: Vena cava superior",
        description:
          "La sangre desoxigenada procedente de la cabeza, el cuello, los miembros superiores y el tórax converge en la vena cava superior para desembocar en la aurícula derecha.",
        bodySex: "male",
        enabledSystems: ["circulatory", "skeletal"],
        systemOpacities: { circulatory: 1.0, skeletal: 0.25 },
        structureId: "FMA4720",
        cameraPreset: "front",
      },
      {
        title: "Paso auriculoventricular derecho: Válvula tricúspide",
        description:
          "Desde la aurícula derecha, la sangre atraviesa la válvula tricúspide (formada por las valvas anterior, posterior y septal) hacia el ventrículo derecho, impidiendo el reflujo durante la sístole.",
        bodySex: "male",
        enabledSystems: ["circulatory"],
        structureId: "FMA7238",
        cameraPreset: "front",
      },
      {
        title: "Circulación menor: Válvula pulmonar",
        description:
          "El ventrículo derecho impulsa la sangre venosa a través de las valvas semilunares de la válvula pulmonar hacia el tronco pulmonar y los pulmones para su oxigenación (hematosis).",
        bodySex: "male",
        enabledSystems: ["circulatory", "respiratory"],
        systemOpacities: { circulatory: 1.0, respiratory: 0.45 },
        structureId: "FMA7247",
        cameraPreset: "front",
      },
      {
        title: "Entrada al corazón izquierdo: Válvula mitral",
        description:
          "Tras oxigenarse en los pulmones, la sangre llega a la aurícula izquierda y pasa al ventrículo izquierdo a través de la válvula mitral (bicúspide).",
        bodySex: "male",
        enabledSystems: ["circulatory"],
        structureId: "FMA7242",
        cameraPreset: "left",
      },
      {
        title: "Salida sistémica: Arco de la aorta",
        description:
          "El ventrículo izquierdo eyecta la sangre oxigenada hacia la aorta ascendente y el arco aórtico (cayado de la aorta), de donde nacen las arterias que irrigan el encéfalo y el resto del organismo.",
        bodySex: "male",
        enabledSystems: ["circulatory", "skeletal"],
        systemOpacities: { circulatory: 1.0, skeletal: 0.25 },
        structureId: "FMA3768",
        cameraPreset: "front",
      },
    ],
  },
  {
    id: "tour-esqueleto",
    title: "2. Esqueleto axial y apendicular",
    subtitle: "Ejes de carga desde la base del cráneo hasta la rodilla y la pierna (5 pasos)",
    steps: [
      {
        title: "Soporte craneal: Atlas (C1)",
        description:
          "La primera vértebra cervical (Atlas) carece de cuerpo vertebral; sostiene los cóndilos del hueso occipital permitiendo el movimiento de flexo-extensión ('sí') de la cabeza.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        structureId: "FMA12519",
        cameraPreset: "back",
      },
      {
        title: "Peto esternocostal: Manubrio del esternón",
        description:
          "En la línea media anterior del tórax, el manubrio esternal articula ambas clavículas y el primer par de costillas, protegiendo los grandes vasos del mediastino superior.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        structureId: "FMA7486",
        cameraPreset: "front",
      },
      {
        title: "Cintura escapular: Escápula y Húmero",
        description:
          "El húmero se articula con la cavidad glenoidea de la escápula formando la articulación glenohumeral, la de mayor movilidad del cuerpo humano.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        structureId: "FMA23130",
        cameraPreset: "right",
      },
      {
        title: "Cintura pélvica: Hueso sacro y coxal",
        description:
          "El hueso sacro (fusión de S1-S5) se encaja entre los dos huesos coxales transmitiendo todo el peso de la columna vertebral hacia las articulaciones de la cadera.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        structureId: "FMA16202",
        cameraPreset: "back",
      },
      {
        title: "Miembro inferior: Fémur y Tibia",
        description:
          "El fémur —el hueso más largo y resistente del organismo— transmite la carga desde el acetábulo coxal hasta los platillos de la tibia en la rodilla.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        structureId: "FMA24474",
        cameraPreset: "front",
      },
    ],
  },
  {
    id: "tour-neuro",
    title: "3. Encéfalo y sistema nervioso central",
    subtitle: "Comisuras interhemisféricas, diencéfalo, sistema límbico y fosa posterior (4 pasos)",
    steps: [
      {
        title: "Conexión interhemisférica: Cuerpo calloso",
        description:
          "El cuerpo calloso es la mayor comisura de sustancia blanca del cerebro: más de 200 millones de fibras conectan e integran ambos hemisferios cerebrales.",
        bodySex: "male",
        enabledSystems: ["nervous"],
        structureId: "FMA86464",
        cameraPreset: "left",
        isolate: false,
      },
      {
        title: "Estación de relevo: Tálamo",
        description:
          "Situado en el centro del diencéfalo, el tálamo procesa y filtra casi toda la información sensitiva y motora antes de enviarla a la corteza cerebral.",
        bodySex: "male",
        enabledSystems: ["nervous"],
        structureId: "FMA258714",
        cameraPreset: "front",
      },
      {
        title: "Memoria y orientación: Hipocampo",
        description:
          "En la profundidad del lóbulo temporal medial, el hipocampo es indispensable para consolidar recuerdos de corto a largo plazo y crear mapas espaciales.",
        bodySex: "male",
        enabledSystems: ["nervous"],
        structureId: "FMA72713",
        cameraPreset: "right",
      },
      {
        title: "Coordinación motora: Cerebelo y Puente",
        description:
          "En la fosa craneal posterior, el cerebelo ajusta con precisión milimétrica la postura, el equilibrio y la coordinación de los movimientos voluntarios.",
        bodySex: "male",
        enabledSystems: ["nervous", "skeletal"],
        systemOpacities: { nervous: 1.0, skeletal: 0.2 },
        structureId: "FMA67944",
        cameraPreset: "back",
      },
    ],
  },
  {
    id: "tour-digestivo-urinario-fem",
    title: "4. Anatomía visceral y pélvica femenina (♀)",
    subtitle: "Exploración sobre el modelo femenino completo de HuBMAP (4 pasos)",
    steps: [
      {
        title: "Sistema respiratorio y cardiovascular femenino",
        description:
          "En el tórax femenino observamos los pulmones flanqueando el corazón en el mediastino medio y el árbol traqueobronquial.",
        bodySex: "female",
        enabledSystems: ["respiratory", "circulatory", "skeletal"],
        systemOpacities: { respiratory: 0.85, circulatory: 1.0, skeletal: 0.25 },
        structureId: "VH_F_trachea",
        cameraPreset: "front",
      },
      {
        title: "Filtración renal: Riñones y uréteres",
        description:
          "En el espacio retroperitoneal, ambos riñones filtran el plasma sanguíneo y conducen la orina por los uréteres hacia la pelvis menor.",
        bodySex: "female",
        enabledSystems: ["urinary", "skeletal"],
        systemOpacities: { urinary: 1.0, skeletal: 0.22 },
        structureId: "VH_F_renal_pelvis_L",
        cameraPreset: "front",
      },
      {
        title: "Órganos reproductores internos: Útero y trompas uterinas",
        description:
          "En la cavidad pélvica femenina, el útero se sitúa entre la vejiga urinaria (por delante) y el recto (por detrás), continuándose lateralmente con las trompas de Falopio y los ovarios.",
        bodySex: "female",
        enabledSystems: ["reproductive", "urinary", "skeletal"],
        systemOpacities: { reproductive: 1.0, urinary: 0.45, skeletal: 0.22 },
        structureId: "VH_F_uterus",
        cameraPreset: "front",
      },
      {
        title: "Glándula mamaria y sistema tegumentario",
        description:
          "En la pared torácica anterior se disponen las glándulas mamarias con sus lóbulos lactíferos, conductos galactóforos y ligamentos suspensorios.",
        bodySex: "female",
        enabledSystems: ["integumentary", "skeletal"],
        systemOpacities: { integumentary: 0.85, skeletal: 0.3 },
        structureId: "VH_F_mammary_gland_L",
        cameraPreset: "front",
      },
    ],
  },
];

export const ANATOMY_QUIZZES: AnatomyQuiz[] = [
  {
    id: "quiz-locomotor",
    title: "Cuestionario 1: Aparato locomotor (Huesos y músculos)",
    subtitle: "Combina búsqueda directa en el modelo 3D y preguntas de opción múltiple (5 preguntas)",
    questions: [
      {
        id: "q-loc-1",
        type: "find3d",
        prompt: "Haz clic directamente en el modelo 3D sobre el FÉMUR DERECHO.",
        hint: "Es el hueso largo del muslo derecho (a la izquierda de tu pantalla en vista frontal).",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        targetStructureId: "FMA24474",
        targetNameEs: "Hueso Fémur derecho",
        explanation:
          "¡Correcto! El fémur (FMA24474) es el hueso más largo, fuerte y voluminoso del cuerpo humano.",
      },
      {
        id: "q-loc-2",
        type: "multipleChoice",
        prompt: "¿Cómo se llama la estructura ósea resaltada en azul brillante en el centro superior del tórax?",
        hint: "Se articula con ambas clavículas y el primer par de cartílagos costales.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        targetStructureId: "FMA7486",
        targetNameEs: "Manubrio del esternón",
        options: [
          "Manubrio del esternón",
          "Hueso sacro",
          "Escápula derecha",
          "Primera vértebra cervical (Atlas)",
        ],
        explanation:
          "El manubrio del esternón (FMA7486) es la porción superior ancha del esternón que cierra por delante el estrecho torácico superior.",
      },
      {
        id: "q-loc-3",
        type: "find3d",
        prompt: "Haz clic en el modelo 3D sobre la ESCÁPULA DERECHA (omóplato derecho).",
        hint: "Rota la cámara hacia la vista posterior (espalda superior derecha).",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        targetStructureId: "FMA13395",
        targetNameEs: "Escápula derecha",
        explanation:
          "¡Muy bien! La escápula derecha (FMA13395) es un hueso plano triangular apoyado sobre la cara posterolateral de la caja torácica.",
      },
      {
        id: "q-loc-4",
        type: "multipleChoice",
        prompt: "¿Qué músculo respiratorio en forma de cúpula se encuentra resaltado separando el tórax del abdomen?",
        hint: "Es el principal músculo inspiratorio del cuerpo humano.",
        bodySex: "male",
        enabledSystems: ["muscular", "skeletal"],
        targetStructureId: "FMA13295",
        targetNameEs: "Diafragma",
        options: [
          "Diafragma",
          "Músculo glúteo mayor derecho",
          "Músculo sartorio derecho",
          "Músculo esternocleidomastoideo derecho",
        ],
        explanation:
          "El diafragma (FMA13295) se contrae y desciende durante la inspiración para expandir los pulmones.",
      },
      {
        id: "q-loc-5",
        type: "find3d",
        prompt: "Haz clic en el modelo 3D sobre el HUESO SACRO.",
        hint: "Se encuentra en la base de la columna vertebral, encajado entre los dos huesos coxales de la pelvis.",
        bodySex: "male",
        enabledSystems: ["skeletal"],
        targetStructureId: "FMA16202",
        targetNameEs: "Hueso sacro",
        explanation:
          "¡Exacto! El hueso sacro (FMA16202) está formado por la fusión de las cinco vértebras sacras (S1-S5).",
      },
    ],
  },
  {
    id: "quiz-organos-vitales",
    title: "Cuestionario 2: Órganos toracoabdominales y encéfalo",
    subtitle: "Identificación 3D de órganos digestivos, respiratorios, urinarios y del SNC (5 preguntas)",
    questions: [
      {
        id: "q-org-1",
        type: "find3d",
        prompt: "Haz clic en el modelo 3D sobre el ESTÓMAGO.",
        hint: "Órgano en forma de 'J' del sistema digestivo situado en el cuadrante superior izquierdo del abdomen.",
        bodySex: "male",
        enabledSystems: ["digestive"],
        targetStructureId: "FMA7148",
        targetNameEs: "Estómago",
        explanation:
          "¡Correcto! El estómago (FMA7148) recibe el bolo alimenticio desde el esófago y lo transforma en quimo.",
      },
      {
        id: "q-org-2",
        type: "multipleChoice",
        prompt: "¿Qué gran vaso arterial en forma de cayado aparece resaltado saliendo del corazón?",
        hint: "Da origen a los troncos arteriales que van a la cabeza y los brazos.",
        bodySex: "male",
        enabledSystems: ["circulatory"],
        targetStructureId: "FMA3768",
        targetNameEs: "Arco de la aorta (cayado aórtico)",
        options: [
          "Arco de la aorta (cayado aórtico)",
          "Vena cava superior",
          "Seno coronario",
          "Vena yugular interna derecha",
        ],
        explanation:
          "El arco de la aorta (FMA3768) distribuye la sangre oxigenada impulsada por el ventrículo izquierdo.",
      },
      {
        id: "q-org-3",
        type: "find3d",
        prompt: "Haz clic en el modelo 3D sobre el RIÑÓN DERECHO.",
        hint: "Órgano retroperitoneal del sistema urinario con forma de habichuela en el lado derecho.",
        bodySex: "male",
        enabledSystems: ["urinary"],
        targetStructureId: "FMA7204",
        targetNameEs: "Riñón derecho",
        explanation:
          "¡Excelente! El riñón derecho (FMA7204) filtra la sangre para formar la orina que desciende por el uréter derecho.",
      },
      {
        id: "q-org-4",
        type: "multipleChoice",
        prompt: "¿Qué estructura del encéfalo posterior aparece resaltada en la base posterior del cráneo?",
        hint: "Es el centro encargado de la coordinación motora, la postura y el equilibrio.",
        bodySex: "male",
        enabledSystems: ["nervous"],
        targetStructureId: "FMA67944",
        targetNameEs: "Cerebelo",
        options: [
          "Cerebelo",
          "Cuerpo calloso",
          "Tálamo derecho",
          "Hipocampo izquierdo",
        ],
        explanation:
          "El cerebelo (FMA67944) integra las vías sensitivas y motoras para coordinar con precisión los movimientos.",
      },
      {
        id: "q-org-5",
        type: "find3d",
        prompt: "Haz clic en el modelo 3D sobre la TRÁQUEA.",
        hint: "Conducto aéreo vertical situado en la línea media del cuello y mediastino superior.",
        bodySex: "male",
        enabledSystems: ["respiratory"],
        targetStructureId: "FMA7394",
        targetNameEs: "Tráquea",
        explanation:
          "¡Muy bien! La tráquea (FMA7394) conduce el aire desde la laringe hacia los bronquios principales.",
      },
    ],
  },
];
