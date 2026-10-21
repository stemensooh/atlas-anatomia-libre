"""Traductor anatómico Inglés -> Español + generador de definiciones educativas en español.

Combina:
1. Diccionario exacto y normalizado de TA2.csv (7.315 entradas).
2. Diccionario de frases y términos anatómicos compuestos FMA / UBERON / HuBMAP.
3. Inversión gramatical de sintagmas nominales con 'of' ("Posterior vein of left ventricle"
   -> "Vena posterior del ventrículo izquierdo") y concordancia de género/número.
4. Generador de descripciones educativas en español (`descriptionEs`) según sistema,
   tipo de estructura, lateralidad y jerarquía.
"""

from __future__ import annotations

import re
from pathlib import Path

# Frases completas frecuentes que conviene traducir de forma exacta
FRASES_EXACTAS: dict[str, str] = {
    "arch of aorta": "Arco de la aorta (cayado aórtico)",
    "ascending aorta": "Aorta ascendente",
    "descending aorta": "Aorta descendente",
    "abdominal aorta": "Aorta abdominal",
    "thoracic aorta": "Aorta torácica",
    "descending thoracic aorta": "Aorta torácica descendente",
    "esophagus": "Esófago",
    "manubrium": "Manubrio del esternón",
    "sternum": "Esternón",
    "xiphoid process": "Apófisis xifoides",
    "linea alba": "Línea alba",
    "external ear": "Oído externo",
    "lip": "Labio",
    "interventricular foramen": "Foramen interventricular (de Monro)",
    "tricuspid valve": "Válvula tricúspide",
    "mitral valve": "Válvula mitral (bicúspide)",
    "aortic valve": "Válvula aórtica",
    "pulmonary valve": "Válvula pulmonar",
    "heart valve": "Válvula cardíaca",
    "valve": "Válvula",
    "right ventricle": "Ventrículo derecho",
    "left ventricle": "Ventrículo izquierdo",
    "right atrium": "Aurícula derecha (atrio derecho)",
    "left atrium": "Aurícula izquierda (atrio izquierdo)",
    "interventricular septum": "Tabique interventricular",
    "interatrial septum": "Tabique interauricular",
    "anterior interventricular sulcus": "Surco interventricular anterior",
    "posterior interventricular sulcus": "Surco interventricular posterior",
    "coronary sulcus": "Surco coronario",
    "coronary sinus": "Seno coronario",
    "superior vena cava": "Vena cava superior",
    "inferior vena cava": "Vena cava inferior",
    "pulmonary trunk": "Tronco pulmonar",
    "right pulmonary artery": "Arteria pulmonar derecha",
    "left pulmonary artery": "Arteria pulmonar izquierda",
    "common carotid artery": "Arteria carótida común",
    "internal carotid artery": "Arteria carótida interna",
    "external carotid artery": "Arteria carótida externa",
    "subclavian artery": "Arteria subclavia",
    "axillary artery": "Arteria axilar",
    "brachial artery": "Arteria braquial",
    "radial artery": "Arteria radial",
    "ulnar artery": "Arteria cubital (ulnar)",
    "common iliac artery": "Arteria ilíaca común",
    "internal iliac artery": "Arteria ilíaca interna",
    "external iliac artery": "Arteria ilíaca externa",
    "femoral artery": "Arteria femoral",
    "popliteal artery": "Arteria poplítea",
    "anterior tibial artery": "Arteria tibial anterior",
    "posterior tibial artery": "Arteria tibial posterior",
    "fibular artery": "Arteria peronea (fibular)",
    "celiac trunk": "Tronco celíaco",
    "superior mesenteric artery": "Arteria mesentérica superior",
    "inferior mesenteric artery": "Arteria mesentérica inferior",
    "renal artery": "Arteria renal",
    "renal vein": "Vena renal",
    "portal vein": "Vena porta hepática",
    "hepatic portal vein": "Vena porta hepática",
    "splenic vein": "Vena esplénica",
    "internal jugular vein": "Vena yugular interna",
    "external jugular vein": "Vena yugular externa",
    "anterior jugular vein": "Vena yugular anterior",
    "subclavian vein": "Vena subclavia",
    "brachiocephalic vein": "Vena braquiocefálica",
    "azygos vein": "Vena ácigos",
    "hemiazygos vein": "Vena hemiácigos",
    "great saphenous vein": "Vena safena mayor (magna)",
    "small saphenous vein": "Vena safena menor (parva)",
    "femoral vein": "Vena femoral",
    "popliteal vein": "Vena poplítea",
    "external anal sphincter": "Esfínter anal externo",
    "internal anal sphincter": "Esfínter anal interno",
    "external intercostal muscle": "Músculo intercostal externo",
    "internal intercostal muscle": "Músculo intercostal interno",
    "innermost intercostal muscle": "Músculo intercostal íntimo",
    "diaphragm": "Diafragma",
    "thoracic duct": "Conducto torácico",
    "gallbladder": "Vesícula biliar",
    "urinary bladder": "Vejiga urinaria",
    "prostate": "Próstata",
    "prostate gland": "Glándula prostática",
    "uterus": "Útero",
    "ovary": "Ovario",
    "fallopian tube": "Trompa uterina (de Falopio)",
    "placenta": "Placenta",
    "spleen": "Bazo",
    "thymus": "Timo",
    "liver": "Hígado",
    "pancreas": "Páncreas",
    "stomach": "Estómago",
    "small intestine": "Intestino delgado",
    "large intestine": "Intestino grueso",
    "duodenum": "Duodeno",
    "jejunum": "Yeyuno",
    "ileum": "Íleon",
    "cecum": "Ciego",
    "appendix": "Apéndice vermiforme",
    "ascending colon": "Colon ascendente",
    "transverse colon": "Colon transverso",
    "descending colon": "Colon descendente",
    "sigmoid colon": "Colon sigmoide",
    "rectum": "Recto",
    "anal canal": "Conducto anal",
    "trachea": "Tráquea",
    "larynx": "Laringe",
    "pharynx": "Faringe",
    "thyroid cartilage": "Cartílago tiroides",
    "cricoid cartilage": "Cartílago cricoides",
    "epiglottis": "Epiglotis",
    "epiglottic cartilage": "Cartílago epiglótico",
    "thyroid gland": "Glándula tiroides",
    "pituitary gland": "Glándula hipófisis (pituitaria)",
    "pineal gland": "Glándula pineal (epífisis)",
    "adrenal gland": "Glándula suprarrenal (adrenal)",
    "spinal cord": "Médula espinal",
    "brain": "Encéfalo",
    "cerebellum": "Cerebelo",
    "brainstem": "Tronco del encéfalo",
    "midbrain": "Mesencéfalo",
    "pons": "Puente (protuberancia anular)",
    "medulla oblongata": "Bulbo raquídeo (médula oblongada)",
    "corpus callosum": "Cuerpo calloso",
    "fornix": "Fórnix",
    "thalamus": "Tálamo",
    "hypothalamus": "Hipotálamo",
    "hippocampus": "Hipocampo",
    "amygdala": "Amígdala cerebral",
    "caudate nucleus": "Núcleo caudado",
    "putamen": "Putamen",
    "globus pallidus": "Globo pálido",
    "lateral ventricle": "Ventrículo lateral",
    "third ventricle": "Tercer ventrículo",
    "fourth ventricle": "Cuarto ventrículo",
    "cerebral aqueduct": "Acueducto cerebral (de Silvio)",
    "optic chiasm": "Quiasma óptico",
    "optic nerve": "Nervio óptico (NC II)",
    "oculomotor nerve": "Nervio oculomotor (NC III)",
    "trochlear nerve": "Nervio troclear (NC IV)",
    "trigeminal nerve": "Nervio trigémino (NC V)",
    "abducens nerve": "Nervio abducens (NC VI)",
    "facial nerve": "Nervio facial (NC VII)",
    "vestibulocochlear nerve": "Nervio vestibulococlear (NC VIII)",
    "glossopharyngeal nerve": "Nervio glosofaríngeo (NC IX)",
    "vagus nerve": "Nervio vago (NC X)",
    "accessory nerve": "Nervio accesorio (NC XI)",
    "hypoglossal nerve": "Nervio hipogloso (NC XII)",
    "sciatic nerve": "Nervio ciático (isquiático)",
    "femoral nerve": "Nervio femoral",
    "median nerve": "Nervio mediano",
    "ulnar nerve": "Nervio cubital (ulnar)",
    "radial nerve": "Nervio radial",
    "phrenic nerve": "Nervio frénico",
    "skin": "Piel",
    "skin of body": "Piel del cuerpo",
    "integumentary system layer": "Capa del sistema tegumentario",
    "subcutaneous abdominal adipose tissue": "Tejido adiposo subcutáneo abdominal",
}

# Reemplazos de sintagmas nominales compuestos (ordenados de más específico a general)
SINTAGMAS_ES: list[tuple[str, str]] = [
    # Corazón y válvulas
    (r"\banterior leaflet\b", "valva anterior"),
    (r"\bposterior leaflet\b", "valva posterior"),
    (r"\bseptal leaflet\b", "valva septal"),
    (r"\bleaflet\b", "valva"),
    (r"\bleaf\b", "valva"),
    (r"\banterior cusp\b", "valva semilunar anterior"),
    (r"\bposterior cusp\b", "valva semilunar posterior"),
    (r"\bleft cusp\b", "valva semilunar izquierda"),
    (r"\bright cusp\b", "valva semilunar derecha"),
    (r"\bseptal cusp\b", "valva septal"),
    (r"\bcusp\b", "valva (cúspide)"),
    (r"\btricuspid valve\b", "válvula tricúspide"),
    (r"\bmitral valve\b", "válvula mitral"),
    (r"\baortic valve\b", "válvula aórtica"),
    (r"\bpulmonary valve\b", "válvula pulmonar"),
    (r"\bcardiac valve\b", "válvula cardíaca"),
    (r"\bheart valve\b", "válvula cardíaca"),
    (r"\bvalve\b", "válvula"),
    (r"\banterior papillary muscle\b", "músculo papilar anterior"),
    (r"\bposterior papillary muscle\b", "músculo papilar posterior"),
    (r"\blateral papillary muscle\b", "músculo papilar lateral"),
    (r"\bseptal papillary muscle\b", "músculo papilar septal"),
    (r"\bpapillary muscle\b", "músculo papilar"),
    (r"\bleft ventricle\b", "ventrículo izquierdo"),
    (r"\bright ventricle\b", "ventrículo derecho"),
    (r"\blateral ventricle\b", "ventrículo lateral"),
    (r"\bthird ventricle\b", "tercer ventrículo"),
    (r"\bfourth ventricle\b", "cuarto ventrículo"),
    (r"\bventricle\b", "ventrículo"),
    (r"\bleft atrium\b", "aurícula izquierda"),
    (r"\bright atrium\b", "aurícula derecha"),
    (r"\batrium\b", "aurícula (atrio)"),
    (r"\bleft auricle\b", "orejuela izquierda"),
    (r"\bright auricle\b", "orejuela derecha"),
    (r"\bauricle\b", "orejuela"),
    (r"\barch of aorta\b", "arco aórtico"),
    (r"\bascending aorta\b", "aorta ascendente"),
    (r"\bdescending aorta\b", "aorta descendente"),
    (r"\babdominal aorta\b", "aorta abdominal"),
    (r"\bthoracic aorta\b", "aorta torácica"),
    (r"\baorta\b", "aorta"),

    # Vértebras y discos intervertebrales
    (r"\bfirst cervical vertebra\b", "primera vértebra cervical (atlas, C1)"),
    (r"\bsecond cervical vertebra\b", "segunda vértebra cervical (axis, C2)"),
    (r"\bthird cervical vertebra\b", "tercera vértebra cervical (C3)"),
    (r"\bfourth cervical vertebra\b", "cuarta vértebra cervical (C4)"),
    (r"\bfifth cervical vertebra\b", "quinta vértebra cervical (C5)"),
    (r"\bsixth cervical vertebra\b", "sexta vértebra cervical (C6)"),
    (r"\bseventh cervical vertebra\b", "séptima vértebra cervical (C7)"),
    (r"\bfirst thoracic vertebra\b", "primera vértebra torácica (T1)"),
    (r"\bsecond thoracic vertebra\b", "segunda vértebra torácica (T2)"),
    (r"\bthird thoracic vertebra\b", "tercera vértebra torácica (T3)"),
    (r"\bfourth thoracic vertebra\b", "cuarta vértebra torácica (T4)"),
    (r"\bfifth thoracic vertebra\b", "quinta vértebra torácica (T5)"),
    (r"\bsixth thoracic vertebra\b", "sexta vértebra torácica (T6)"),
    (r"\bseventh thoracic vertebra\b", "séptima vértebra torácica (T7)"),
    (r"\beighth thoracic vertebra\b", "octava vértebra torácica (T8)"),
    (r"\bninth thoracic vertebra\b", "novena vértebra torácica (T9)"),
    (r"\btenth thoracic vertebra\b", "décima vértebra torácica (T10)"),
    (r"\beleventh thoracic vertebra\b", "undécima vértebra torácica (T11)"),
    (r"\btwelfth thoracic vertebra\b", "duodécima vértebra torácica (T12)"),
    (r"\bfirst lumbar vertebra\b", "primera vértebra lumbar (L1)"),
    (r"\bsecond lumbar vertebra\b", "segunda vértebra lumbar (L2)"),
    (r"\bthird lumbar vertebra\b", "tercera vértebra lumbar (L3)"),
    (r"\bfourth lumbar vertebra\b", "cuarta vértebra lumbar (L4)"),
    (r"\bfifth lumbar vertebra\b", "quinta vértebra lumbar (L5)"),
    (r"\bcervical vertebra\b", "vértebra cervical"),
    (r"\bthoracic vertebra\b", "vértebra torácica"),
    (r"\blumbar vertebra\b", "vértebra lumbar"),
    (r"\bvertebra\b", "vértebra"),
    (r"\bvertebral column\b", "columna vertebral"),
    (r"\bintervertebral disk\b", "disco intervertebral"),
    (r"\bintervertebral disc\b", "disco intervertebral"),
    (r"\bnucleus pulposus\b", "núcleo pulposo"),
    (r"\banulus fibrosus\b", "anillo fibroso"),
    (r"\bannulus fibrosus\b", "anillo fibroso"),
    (r"\bcostal cartilage\b", "cartílago costal"),
    (r"\barticular cartilage\b", "cartílago articular"),
    (r"\bnasal cartilage\b", "cartílago nasal"),
    (r"\blaryngeal cartilage\b", "cartílago laríngeo"),

    # Falanges, mano y pie
    (r"\bdistal phalanx\b", "falange distal"),
    (r"\bmiddle phalanx\b", "falange media"),
    (r"\bproximal phalanx\b", "falange proximal"),
    (r"\bphalanx\b", "falange"),
    (r"\bindex finger\b", "dedo índice"),
    (r"\bmiddle finger\b", "dedo medio"),
    (r"\bring finger\b", "dedo anular"),
    (r"\blittle finger\b", "dedo meñique"),
    (r"\bthumb\b", "pulgar"),
    (r"\bfinger\b", "dedo de la mano"),
    (r"\bbig toe\b", "dedo gordo del pie (hálux)"),
    (r"\blittle toe\b", "quinto dedo del pie (meñique)"),
    (r"\bsecond toe\b", "segundo dedo del pie"),
    (r"\bthird toe\b", "tercer dedo del pie"),
    (r"\bfourth toe\b", "cuarto dedo del pie"),
    (r"\b第五 toe\b", "quinto dedo del pie"),
    (r"\btoe\b", "dedo del pie"),
    (r"\bmetacarpal bone\b", "hueso metacarpiano"),
    (r"\bmetatarsal bone\b", "hueso metatarsiano"),
    (r"\bcarpal bone\b", "hueso del carpo"),
    (r"\btarsal bone\b", "hueso del tarso"),
    (r"\bhand\b", "mano"),
    (r"\bfoot\b", "pie"),
    (r"\bforearm\b", "antebrazo"),
    (r"\barm\b", "brazo"),
    (r"\bthigh\b", "muslo"),
    (r"\bleg\b", "pierna"),
    (r"\bknee\b", "rodilla"),
    (r"\bshoulder\b", "hombro"),
    (r"\belbow\b", "codo"),
    (r"\bwrist\b", "muñeca"),
    (r"\bankle\b", "tobillo"),
    (r"\bhip bone\b", "hueso coxal (ilíaco)"),
    (r"\bpelvis\b", "pelvis"),
    (r"\bfemur\b", "fémur"),
    (r"\btibia\b", "tibia"),
    (r"\bfibula\b", "peroné (fíbula)"),
    (r"\bpatella\b", "rótula (patela)"),
    (r"\bhumerus\b", "húmero"),
    (r"\bradius\b", "radio"),
    (r"\bulna\b", "cúbito (ulna)"),
    (r"\bclavicle\b", "clavícula"),
    (r"\bscapula\b", "escápula (omóplato)"),
    (r"\bskull\b", "cráneo"),
    (r"\bmandible\b", "mandíbula"),
    (r"\bmaxilla\b", "maxilar"),
    (r"\brib\b", "costilla"),
    (r"\bsacrum\b", "sacro"),
    (r"\bcoccyx\b", "cóccix"),

    # Dientes
    (r"\bcentral secondary incisor tooth\b", "diente incisivo central permanente"),
    (r"\blateral secondary incisor tooth\b", "diente incisivo lateral permanente"),
    (r"\bsecondary canine tooth\b", "diente canino permanente"),
    (r"\bfirst secondary premolar tooth\b", "primer diente premolar permanente"),
    (r"\bsecond secondary premolar tooth\b", "segundo diente premolar permanente"),
    (r"\bfirst secondary molar tooth\b", "primer diente molar permanente"),
    (r"\bsecond secondary molar tooth\b", "segundo diente molar permanente"),
    (r"\bthird secondary molar tooth\b", "tercer diente molar permanente (muela del juicio)"),
    (r"\btooth\b", "diente"),
    (r"\bgingiva\b", "encía"),
    (r"\bupper jaw\b", "maxilar superior"),
    (r"\blower jaw\b", "mandíbula (maxilar inferior)"),

    # Órganos y tejidos
    (r"\bmammary gland\b", "glándula mamaria"),
    (r"\bsuspensory ligament\b", "ligamento suspensorio"),
    (r"\blactiferous duct\b", "conducto galactóforo (lactífero)"),
    (r"\blactiferous sinus\b", "seno galactóforo (lactífero)"),
    (r"\bareolar tubercle\b", "tubérculo areolar"),
    (r"\bfemale areola\b", "aréola mamaria femenina"),
    (r"\bareola\b", "aréola"),
    (r"\bnipple\b", "pezón (papila mamaria)"),
    (r"\bmammary lobe\b", "lóbulo mamario"),
    (r"\badipose tissue\b", "tejido adiposo"),
    (r"\bbreast\b", "mama"),
    (r"\bkidney\b", "riñón"),
    (r"\brenal pelvis\b", "pelvis renal"),
    (r"\brenal cortex\b", "corteza renal"),
    (r"\brenal medulla\b", "médula renal"),
    (r"\brenal pyramid\b", "pirámide renal (de Malpighi)"),
    (r"\brenal papilla\b", "papila renal"),
    (r"\brenal column\b", "columna renal (de Bertin)"),
    (r"\bmajor calyx\b", "cáliz renal mayor"),
    (r"\bminor calyx\b", "cáliz renal menor"),
    (r"\bcalyx\b", "cáliz renal"),
    (r"\bureter\b", "uréter"),
    (r"\burinary bladder\b", "vejiga urinaria"),
    (r"\burethra\b", "uretra"),
    (r"\blung\b", "pulmón"),
    (r"\bmain bronchus\b", "bronquio principal"),
    (r"\blobar bronchus\b", "bronquio lobular"),
    (r"\bsegmental bronchus\b", "bronquio segmentario"),
    (r"\bbronchopulmonary segment\b", "segmento broncopulmonar"),
    (r"\bbronchial tree\b", "árbol bronquial"),
    (r"\btracheobronchial tree\b", "árbol traqueobronquial"),
    (r"\bbronchus\b", "bronquio"),
    (r"\btrachea\b", "tráquea"),
    (r"\blarynx\b", "laringe"),
    (r"\bconus elasticus\b", "cono elástico de la laringe"),
    (r"\bthyrohyoid membrane\b", "membrana tirohioidea"),
    (r"\bpalatine tonsil\b", "amígdala palatina (tonsila)"),
    (r"\blymph node\b", "ganglio linfático"),
    (r"\bspleen\b", "bazo"),
    (r"\bthymus\b", "timo"),
    (r"\bliver\b", "hígado"),
    (r"\bgallbladder\b", "vesícula biliar"),
    (r"\bbiliary tree\b", "árbol biliar"),
    (r"\bbile duct\b", "conducto biliar"),
    (r"\bpancreas\b", "páncreas"),
    (r"\bpancreatic duct\b", "conducto pancreático"),
    (r"\besophagus\b", "esófago"),
    (r"\bstomach\b", "estómago"),
    (r"\bsmall intestine\b", "intestino delgado"),
    (r"\blarge intestine\b", "intestino grueso"),
    (r"\bepiploic appendage\b", "apéndice epiploico"),
    (r"\btransverse colon\b", "colon transverso"),
    (r"\bascending colon\b", "colon ascendente"),
    (r"\bdescending colon\b", "colon descendente"),
    (r"\bsigmoid colon\b", "colon sigmoide"),
    (r"\bcolon\b", "colon"),
    (r"\bomentum\b", "epiplón (omento)"),
    (r"\bgreater omentum\b", "epiplón mayor"),
    (r"\blesser omentum\b", "epiplón menor"),
    (r"\btongue\b", "lengua"),
    (r"\bmouth\b", "cavidad oral (boca)"),
    (r"\bsalivary gland\b", "glándula salival"),
    (r"\bparotid gland\b", "glándula parótida"),
    (r"\bsubmandibular gland\b", "glándula submandibular"),
    (r"\bsublingual gland\b", "glándula sublingual"),
    (r"\bdeferent duct\b", "conducto deferente"),
    (r"\bvas deferens\b", "conducto deferente"),
    (r"\bseminal vesicle\b", "vesícula seminal"),
    (r"\btestis\b", "testículo"),
    (r"\bepididymis\b", "epidídimo"),
    (r"\bprostate\b", "próstata"),
    (r"\bulterus\b", "útero"),
    (r"\buterus\b", "útero"),
    (r"\bovary\b", "ovario"),
    (r"\bfallopian tube\b", "trompa uterina (de Falopio)"),
    (r"\buterine tube\b", "trompa uterina"),
    (r"\bvagina\b", "vagina"),

    # Sistema nervioso y ojo
    (r"\bwhite matter\b", "sustancia blanca"),
    (r"\bgray matter\b", "sustancia gris"),
    (r"\bspinal cord\b", "médula espinal"),
    (r"\bneuraxis\b", "neuroeje"),
    (r"\bbrain\b", "encéfalo"),
    (r"\bcerebral cortex\b", "corteza cerebral"),
    (r"\bcerebellar cortex\b", "corteza cerebelosa"),
    (r"\bcerebellum\b", "cerebelo"),
    (r"\bgyrus\b", "giro (circunvolución)"),
    (r"\bsulcus\b", "surco"),
    (r"\bfissure\b", "cisura (fisura)"),
    (r"\bfrontal lobe\b", "lóbulos frontal"),
    (r"\bparietal lobe\b", "lóbulo parietal"),
    (r"\btemporal lobe\b", "lóbulo temporal"),
    (r"\boccipital lobe\b", "lóbulo occipital"),
    (r"\binsula\b", "ínsula"),
    (r"\beyeball\b", "globo ocular"),
    (r"\beye\b", "ojo"),
    (r"\bcornea\b", "córnea"),
    (r"\bsclera\b", "esclerótica (esclera)"),
    (r"\bchoroid\b", "coroides"),
    (r"\bretina\b", "retina"),
    (r"\blens\b", "cristalino"),
    (r"\biris\b", "iris"),
    (r"\bciliary body\b", "cuerpo ciliar"),
    (r"\bvitreous body\b", "cuerpo vítreo"),
    (r"\banterior chamber\b", "cámara anterior"),
    (r"\bposterior chamber\b", "cámara posterior"),
    (r"\btarsal plate\b", "tarso palpebral"),
    (r"\bupper eyelid\b", "párpado superior"),
    (r"\blower eyelid\b", "párpado inferior"),
    (r"\beyelid\b", "párpado"),
    (r"\blacrimal gland\b", "glándula lagrimal"),
    (r"\blacrimal duct\b", "conducto lagrimal"),
    (r"\bcommon tendinous ring\b", "anillo tendinoso común (de Zinn)"),
    (r"\bpterygomandibular raphe\b", "rafe pterigomandibular"),

    # Músculos frecuentes
    (r"\btrapezius\b", "músculo trapecio"),
    (r"\bdeltoid\b", "músculo deltoides"),
    (r"\bpectoralis major\b", "músculo pectoral mayor"),
    (r"\bpectoralis minor\b", "músculo pectoral menor"),
    (r"\blatissimus dorsi\b", "músculo dorsal ancho"),
    (r"\bbiceps brachii\b", "músculo bíceps braquial"),
    (r"\btriceps brachii\b", "músculo tríceps braquial"),
    (r"\bbrachialis\b", "músculo braquial"),
    (r"\bbrachioradialis\b", "músculo braquiorradial"),
    (r"\bpronator teres\b", "músculo pronador redondo"),
    (r"\bpronator quadratus\b", "músculo pronador cuadrado"),
    (r"\bflexor digitorum superficialis\b", "músculo flexor superficial de los dedos"),
    (r"\bflexor digitorum profundus\b", "músculo flexor profundo de los dedos"),
    (r"\bextensor digitorum\b", "músculo extensor de los dedos"),
    (r"\bextensor carpi ulnaris\b", "músculo extensor cubital del carpo"),
    (r"\bextensor carpi radialis longus\b", "músculo extensor radial largo del carpo"),
    (r"\bextensor carpi radialis brevis\b", "músculo extensor radial corto del carpo"),
    (r"\bflexor carpi ulnaris\b", "músculo flexor cubital del carpo"),
    (r"\bflexor carpi radialis\b", "músculo flexor radial del carpo"),
    (r"\bgluteus maximus\b", "músculo glúteo mayor"),
    (r"\bgluteus medius\b", "músculo glúteo medio"),
    (r"\bgluteus minimus\b", "músculo glúteo menor"),
    (r"\bquadriceps femoris\b", "músculo cuádriceps femoral"),
    (r"\brectus femoris\b", "músculo recto femoral"),
    (r"\bvastus lateralis\b", "músculo vasto lateral"),
    (r"\bvastus medialis\b", "músculo vasto medial"),
    (r"\bvastus intermedius\b", "músculo vasto intermedio"),
    (r"\bbiceps femoris\b", "músculo bíceps femoral"),
    (r"\bsemitendinosus\b", "músculo semitendinoso"),
    (r"\bsemimembranosus\b", "músculo semimembranoso"),
    (r"\bsartorius\b", "músculo sartorio"),
    (r"\bgracilis\b", "músculo grácil"),
    (r"\bgastrocnemius\b", "músculo gastrocnemio (gemelo)"),
    (r"\bsoleus\b", "músculo sóleo"),
    (r"\btibialis anterior\b", "músculo tibial anterior"),
    (r"\btibialis posterior\b", "músculo tibial posterior"),
    (r"\blevator ani\b", "músculo elevador del ano"),
    (r"\biliococcygeus\b", "músculo iliococcígeo"),
    (r"\bpubococcygeus\b", "músculo pubococcígeo"),
    (r"\bpuborectalis\b", "músculo puborrectal"),
    (r"\bcoccygeus\b", "músculo coccígeo"),
    (r"\bsternocleidomastoid\b", "músculo esternocleidomastoideo"),
    (r"\bmasseter\b", "músculo masetero"),
    (r"\btemporalis\b", "músculo temporal"),
    (r"\brectus abdominis\b", "músculo recto del abdomen"),
    (r"\bexternal oblique\b", "músculo oblicuo externo"),
    (r"\binternal oblique\b", "músculo oblicuo interno"),
    (r"\btransversus abdominis\b", "músculo transverso del abdomen"),
    (r"\bpsoas major\b", "músculo psoas mayor"),
    (r"\biliacus\b", "músculo ilíaco"),

    # Términos estructurales generales
    (r"\binterosseous membrane\b", "membrana interósea"),
    (r"\bhepatovenous subsector\b", "subsector hepatovenoso"),
    (r"\bvascular anastomosis\b", "anastomosis vascular"),
    (r"\barterial anastomosis\b", "anastomosis arterial"),
    (r"\bvenous anastomosis\b", "anastomosis venosa"),
    (r"\banastomosis\b", "anastomosis"),
    (r"\bset of arteries\b", "conjunto de arterias"),
    (r"\bset of veins\b", "conjunto de venas"),
    (r"\bset of\b", "conjunto de"),
    (r"\bmusculature\b", "musculatura"),
    (r"\bvasculature\b", "vasculatura"),
    (r"\bblood vasculature\b", "vasculatura sanguínea"),
    (r"\bsegment of\b", "segmento de"),
    (r"\bzone of\b", "zona de"),
    (r"\bregion of\b", "región de"),
    (r"\bsubdivision of\b", "subdivisión de"),
    (r"\bwall of\b", "pared de"),
    (r"\bcavity of\b", "cavidad de"),
    (r"\bhead of\b", "cabeza de"),
    (r"\bneck of\b", "cuello de"),
    (r"\bbody of\b", "cuerpo de"),
    (r"\bbase of\b", "base de"),
    (r"\bapex of\b", "vértice (ápex) de"),
    (r"\broot of\b", "raíz de"),
    (r"\btrunk of\b", "tronco de"),
    (r"\bbranch of\b", "rama de"),
    (r"\btributary of\b", "tributaria de"),
    (r"\banterior part\b", "porción anterior"),
    (r"\bposterior part\b", "porción posterior"),
    (r"\bsuperior part\b", "porción superior"),
    (r"\binferior part\b", "porción inferior"),
    (r"\bascending part\b", "porción ascendente"),
    (r"\bdescending part\b", "porción descendente"),
    (r"\babdominal part\b", "porción abdominal"),
    (r"\bthoracic part\b", "porción torácica"),
    (r"\bcervical part\b", "porción cervical"),
    (r"\bpelvic part\b", "porción pélvica"),
    (r"\bapical part\b", "porción apical"),
    (r"\bbasal part\b", "porción basal"),
    (r"\blateral part\b", "porción lateral"),
    (r"\bmedial part\b", "porción medial"),
    (r"\bpart of\b", "porción de"),
    (r"\bpart\b", "porción"),
    (r"\blobe\b", "lóbulo"),
    (r"\bsegment\b", "segmento"),
    (r"\bcortex\b", "corteza"),
    (r"\bmedulla\b", "médula"),
    (r"\bhilum\b", "hilio"),
    (r"\bcapsule\b", "cápsula"),
    (r"\bsurface\b", "superficie"),
    (r"\bmargin\b", "borde"),
    (r"\bborder\b", "borde"),
    (r"\bangle\b", "ángulo"),
    (r"\bprocess\b", "apófisis (proceso)"),
    (r"\btubercle\b", "tubérculo"),
    (r"\btuberosity\b", "tuberosidad"),
    (r"\bcondyle\b", "cóndilo"),
    (r"\bepicondyle\b", "epicóndilo"),
    (r"\bfossa\b", "fosa"),
    (r"\bforamen\b", "foramen (agujero)"),
    (r"\bcanal\b", "conducto (canal)"),
    (r"\bduct\b", "conducto"),
    (r"\bsinus\b", "seno"),
    (r"\bplexus\b", "plexo"),
    (r"\bganglion\b", "ganglio nervioso"),
    (r"\bnucleus\b", "núcleo"),
    (r"\btract\b", "tracto (fascículo)"),
    (r"\bfasciculus\b", "fascículo"),
    (r"\bcommissure\b", "comisura"),
    (r"\bmeniscus\b", "menisco"),
    (r"\benthesis\b", "entesis"),
    (r"\bgroove\b", "surco"),
    (r"\bridge\b", "cresta"),
    (r"\bcrest\b", "cresta"),
    (r"\bspine\b", "espina"),
    (r"\bnotch\b", "escotadura (incisura)"),
    (r"\bhead\b", "cabeza"),
    (r"\bneck\b", "cuello"),
    (r"\bbody\b", "cuerpo"),
    (r"\bwall\b", "pared"),
    (r"\bcavity\b", "cavidad"),
    (r"\barch\b", "arco"),
    (r"\bring\b", "anillo"),
    (r"\btree\b", "árbol"),
    (r"\bnetwork\b", "red"),
    (r"\blayer\b", "capa"),
    (r"\btissue\b", "tejido"),
    (r"\bmembrane\b", "membrana"),
    (r"\bfascia\b", "fascia"),
    (r"\btendon\b", "tendón"),
    (r"\bligament\b", "ligamento"),
    (r"\bcartilage\b", "cartílago"),
    (r"\bbone\b", "hueso"),
    (r"\bmuscle\b", "músculo"),
    (r"\barteries\b", "arterias"),
    (r"\bartery\b", "arteria"),
    (r"\bveins\b", "venas"),
    (r"\bvein\b", "vena"),
    (r"\bnerves\b", "nervios"),
    (r"\bnerve\b", "nervio"),
    (r"\bgland\b", "glándula"),
    (r"\borgans\b", "órganos"),
    (r"\borgan\b", "órgano"),

    # Adjetivos anatómicos y ordinales
    (r"\banterolateral\b", "anterolateral"),
    (r"\banteromedial\b", "anteromedial"),
    (r"\bposterolateral\b", "posterolateral"),
    (r"\bposteromedial\b", "posteromedial"),
    (r"\bsuperolateral\b", "superolateral"),
    (r"\bsuperomedial\b", "superomedial"),
    (r"\binferolateral\b", "inferolateral"),
    (r"\binferomedial\b", "inferomedial"),
    (r"\banterior\b", "anterior"),
    (r"\bposterior\b", "posterior"),
    (r"\bsuperior\b", "superior"),
    (r"\binferior\b", "inferior"),
    (r"\bmedial\b", "medial"),
    (r"\blateral\b", "lateral"),
    (r"\bproximal\b", "proximal"),
    (r"\bdistal\b", "distal"),
    (r"\bsuperficial\b", "superficial"),
    (r"\bdeep\b", "profundo"),
    (r"\binternal\b", "interno"),
    (r"\bexternal\b", "externo"),
    (r"\bmiddle\b", "medio"),
    (r"\bcentral\b", "central"),
    (r"\bperipheral\b", "periférico"),
    (r"\bdorsal\b", "dorsal"),
    (r"\bventral\b", "ventral"),
    (r"\bpalmar\b", "palmar"),
    (r"\bplantar\b", "plantar"),
    (r"\bapical\b", "apical"),
    (r"\bbasal\b", "basal"),
    (r"\bsegmental\b", "segmentario"),
    (r"\blobar\b", "lobular"),
    (r"\binterlobar\b", "interlobular"),
    (r"\binterlobular\b", "interlobulillar"),
    (r"\bsubcutaneous\b", "subcutáneo"),
    (r"\bcutaneous\b", "cutáneo"),
    (r"\bcoronary\b", "coronario"),
    (r"\bpulmonary\b", "pulmonar"),
    (r"\bcardiac\b", "cardíaco"),
    (r"\bthoracic\b", "torácico"),
    (r"\babdominal\b", "abdominal"),
    (r"\bpelvic\b", "pélvico"),
    (r"\bcervical\b", "cervical"),
    (r"\blumbar\b", "lumbar"),
    (r"\bsacral\b", "sacro"),
    (r"\bcranial\b", "craneal"),
    (r"\bcerebral\b", "cerebral"),
    (r"\bcerebellar\b", "cerebeloso"),
    (r"\bspinal\b", "espinal"),
    (r"\bvertebral\b", "vertebral"),
    (r"\bintervertebral\b", "intervertebral"),
    (r"\bintercostal\b", "intercostal"),
    (r"\bsubcostal\b", "subcostal"),
    (r"\brenal\b", "renal"),
    (r"\bhepatic\b", "hepático"),
    (r"\bsplenic\b", "esplénico"),
    (r"\bgastric\b", "gástrico"),
    (r"\bcolic\b", "cólico"),
    (r"\brectal\b", "rectal"),
    (r"\bsigmoid\b", "sigmoideo"),
    (r"\biliac\b", "ilíaco"),
    (r"\bfemoral\b", "femoral"),
    (r"\bpopliteal\b", "poplíteo"),
    (r"\btibial\b", "tibial"),
    (r"\bfibular\b", "peroneo (fibular)"),
    (r"\bbrachial\b", "braquial"),
    (r"\bradial\b", "radial"),
    (r"\bulnar\b", "cubital (ulnar)"),
    (r"\baxillary\b", "axilar"),
    (r"\bsubclavian\b", "subclavio"),
    (r"\bcarotid\b", "carotídeo"),
    (r"\bjugular\b", "yugular"),
    (r"\bophthalmic\b", "oftálmico"),
    (r"\boptic\b", "óptico"),
    (r"\bciliary\b", "ciliar"),
    (r"\borbital\b", "orbitario"),
    (r"\bfrontal\b", "frontal"),
    (r"\bparietal\b", "parietal"),
    (r"\btemporal\b", "temporal"),
    (r"\boccipital\b", "occipital"),
    (r"\bnasal\b", "nasal"),
    (r"\boral\b", "oral"),
    (r"\blaryngeal\b", "laríngeo"),
    (r"\bpharyngeal\b", "faríngeo"),
    (r"\btracheal\b", "traqueal"),
    (r"\bbronchial\b", "bronquial"),
    (r"\bbronchopulmonary\b", "broncopulmonar"),
    (r"\buterine\b", "uterino"),
    (r"\bovarian\b", "ovárico"),
    (r"\bvaginal\b", "vaginal"),
    (r"\bprostatic\b", "prostático"),
    (r"\btesticular\b", "testicular"),
    (r"\bvesical\b", "vesical"),
    (r"\bdigital\b", "digital"),
    (r"\bproper\b", "propio"),
    (r"\bcommon\b", "común"),
    (r"\baccessory\b", "accesorio"),
    (r"\bascending\b", "ascendente"),
    (r"\bdescending\b", "descendente"),
    (r"\btransverse\b", "transverso"),
    (r"\boblique\b", "oblicuo"),
    (r"\bstraight\b", "recto"),
    (r"\bmajor\b", "mayor"),
    (r"\bminor\b", "menor"),
    (r"\bgreat\b", "mayor"),
    (r"\bsmall\b", "menor"),
    (r"\blong\b", "largo"),
    (r"\bshort\b", "corto"),
    (r"\bupper\b", "superior"),
    (r"\blower\b", "inferior"),
    (r"\bfirst\b", "primero/a"),
    (r"\bsecond\b", "segundo/a"),
    (r"\bthird\b", "tercero/a"),
    (r"\bfourth\b", "cuarto/a"),
    (r"\bfifth\b", "quinto/a"),
    (r"\bsixth\b", "sexto/a"),
    (r"\bseventh\b", "séptimo/a"),
    (r"\beighth\b", "octavo/a"),
    (r"\bninth\b", "noveno/a"),
    (r"\btenth\b", "décimo/a"),
    (r"\beleventh\b", "undécimo/a"),
    (r"\btwelfth\b", "duodécimo/a"),
    (r"\btrabecular\b", "trabecular"),
    (r"\bcompact\b", "compacto"),
    (r"\bcruciate\b", "cruzado"),
    (r"\bcollateral\b", "colateral"),
    (r"\bpatellar\b", "rotuliano (patelar)"),
    (r"\bclavicular\b", "clavicular"),
    (r"\bsternal\b", "esternal"),
    (r"\bcostal\b", "costal"),
    (r"\blumbar\b", "lumbar"),
    (r"\blumbrical\b", "lumbrical"),
    (r"\binterosseous\b", "interóseo"),
    (r"\bfemale\b", "femenino/a"),
    (r"\bmale\b", "masculino/a"),
]


def _traducir_bloque_simple(texto: str, ta2: dict[str, tuple[str, str]]) -> str:
    """Traduce un sintagma nominal corto sin 'of' al español."""
    t = texto.strip()
    if not t:
        return ""
    low = t.lower()

    if low in FRASES_EXACTAS:
        return FRASES_EXACTAS[low]
    if low in ta2:
        return ta2[low][1]

    # Detectar prefijo Left / Right en el bloque
    lado_sufijo = ""
    if re.match(r"^left\s+", low):
        t_sin = re.sub(r"^left\s+", "", t, flags=re.IGNORECASE).strip()
        low_sin = t_sin.lower()
        lado_sufijo = " izquierdo/a"
    elif re.match(r"^right\s+", low):
        t_sin = re.sub(r"^right\s+", "", t, flags=re.IGNORECASE).strip()
        low_sin = t_sin.lower()
        lado_sufijo = " derecho/a"
    else:
        t_sin = t
        low_sin = low

    if low_sin in FRASES_EXACTAS:
        base = FRASES_EXACTAS[low_sin]
        return _aplicar_concordancia_lado(base, lado_sufijo)
    if low_sin in ta2:
        base = ta2[low_sin][1]
        return _aplicar_concordancia_lado(base, lado_sufijo)

    # Aplicar reemplazos léxicos
    res = t_sin
    for pat, rep in SINTAGMAS_ES:
        res = re.sub(pat, rep, res, flags=re.IGNORECASE)

    # Limpiar posibles 'left'/'right' internos remanentes
    res = re.sub(r"\bleft\b", "izquierdo/a", res, flags=re.IGNORECASE)
    res = re.sub(r"\bright\b", "derecho/a", res, flags=re.IGNORECASE)

    # Reordenar caso común en inglés: "<adjetivo> <sustantivo>" -> "<sustantivo> <adjetivo>"
    # cuando el sustantivo quedó al final (p. ej. "anterior valva" -> "valva anterior")
    sustantivos = (
        "arteria", "vena", "nervio", "músculo", "hueso", "ligamento", "tendón",
        "cartílago", "glándula", "ganglio linfático", "valva", "válvula",
        "ventrículo", "aurícula", "bronquio", "lóbulo", "segmento", "porción",
        "conducto", "surco", "giro", "vértebra", "falange", "diente", "cáliz renal",
    )
    for sust in sustantivos:
        m = re.match(rf"^(.+?)\s+({re.escape(sust)})$", res.strip(), flags=re.IGNORECASE)
        if m:
            mod = m.group(1).strip()
            noun = m.group(2).strip()
            res = f"{noun} {mod}"
            break

    return _aplicar_concordancia_lado(res.strip(), lado_sufijo)


def _aplicar_concordancia_lado(base: str, lado_sufijo: str) -> str:
    if not lado_sufijo:
        return base
    low = base.lower()
    es_femenino = any(
        low.startswith(w)
        for w in (
            "arteria", "vena", "valva", "válvula", "aurícula", "glándula",
            "falange", "vértebra", "costilla", "clavícula", "escápula",
            "rótula", "tibia", "fíbula", "mano", "pierna", "rodilla",
            "muñeca", "pelvis", "cadera", "córnea", "retina", "coroides",
            "esclerótica", "cámara", "párpado", "amígdala", "trompa",
            "cavidad", "pared", "porción", "rama", "tributaria", "raíz",
            "corteza", "médula", "cápsula", "superficie", "fosa", "cresta",
            "espina", "escotadura", "membrana", "fascia", "mama", "aréola",
        )
    )
    if "izquierdo" in lado_sufijo:
        return f"{base} {'izquierda' if es_femenino else 'izquierdo'}"
    if "derecho" in lado_sufijo:
        return f"{base} {'derecha' if es_femenino else 'derecho'}"
    return base + lado_sufijo


def traducir_estructura(nombre_en: str, ta2: dict[str, tuple[str, str]]) -> tuple[str, str, str]:
    """Devuelve (side, nameLa, nameEs) totalmente en español para cualquier nombre en inglés."""
    limpio = nombre_en.strip()
    low = limpio.lower()

    side = "median"
    if re.search(r"(\bleft\b|_l$|\(l\))", low):
        side = "left"
    elif re.search(r"(\bright\b|_r$|\(r\))", low):
        side = "right"

    # 1. Coincidencia directa en diccionario exacto o TA2
    if low in FRASES_EXACTAS:
        es = FRASES_EXACTAS[low]
        la = ta2.get(low, (limpio, es))[0]
        return side, la, _capitalizar(es)

    if low in ta2:
        la, es = ta2[low]
        return side, la, _capitalizar(es)

    # 2. Coincidencia en TA2 o FRASES_EXACTAS quitando Left/Right inicial
    sin_lado = re.sub(r"^(left|right)\s+", "", low)
    sin_lado = re.sub(r"\b(of left|of right)\b", "of", sin_lado)
    sin_lado_full = re.sub(r"\b(left|right)\s+", "", sin_lado).strip()

    if sin_lado_full in FRASES_EXACTAS or sin_lado_full in ta2:
        if sin_lado_full in FRASES_EXACTAS:
            es_base = FRASES_EXACTAS[sin_lado_full]
            la_base = ta2.get(sin_lado_full, (limpio, es_base))[0]
        else:
            la_base, es_base = ta2[sin_lado_full]

        if side == "left":
            es_fin = _aplicar_concordancia_lado(es_base, " izquierdo/a")
            la_fin = f"{la_base} (sinister)"
        elif side == "right":
            es_fin = _aplicar_concordancia_lado(es_base, " derecho/a")
            la_fin = f"{la_base} (dexter)"
        else:
            es_fin = es_base
            la_fin = la_base
        return side, la_fin, _capitalizar(es_fin)

    # 3. Si contiene " of ", traducir cada bloque separadamente ("A of B of C" -> "A de B de C")
    if " of " in low:
        partes = re.split(r"\s+of\s+", limpio, flags=re.IGNORECASE)
        partes_es = [_traducir_bloque_simple(p, ta2) for p in partes]
        unido = partes_es[0]
        for sig in partes_es[1:]:
            if sig.lower().startswith(("el ", "hígado", "encéfalo", "ojo", "útero", "ovario", "corazón", "pulmón", "riñón", "ventrículo", "atrio", "estómago", "colon", "intestino", "fémur", "húmero", "radio", "cúbito", "esternón", "cráneo", "cuello", "brazo", "antebrazo", "muslo", "pie", "cuerpo", "tórax", "abdomen")):
                unido += f" del {sig}"
            elif sig.lower().startswith(("la ", "aorta", "arteria", "vena", "válvula", "aurícula", "tráquea", "laringe", "faringe", "médula", "mano", "pierna", "rodilla", "cabeza", "pelvis", "escápula", "clavícula", "mandíbula", "vejiga", "próstata", "mama", "lengua", "piel", "columna")):
                unido += f" de la {sig}"
            else:
                unido += f" de {sig}"
        la_aprox = ta2.get(sin_lado_full, (limpio, unido))[0]
        return side, la_aprox, _capitalizar(unido)

    # 4. Bloque simple sin 'of'
    es_simple = _traducir_bloque_simple(limpio, ta2)
    la_aprox = ta2.get(sin_lado_full, (limpio, es_simple))[0]
    return side, la_aprox, _capitalizar(es_simple)


def _capitalizar(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return s
    return s[0].upper() + s[1:]


DESCRIPCION_SISTEMA: dict[str, str] = {
    "skeletal": "el sistema esquelético, encargado del soporte estructural, la protección de órganos internos y el anclaje biomecánico para el movimiento",
    "muscular": "el sistema muscular, responsable de generar fuerza contráctil, mantener la postura y producir el movimiento corporal",
    "circulatory": "el sistema cardiovascular y circulatorio, encargado del transporte de sangre, oxígeno y nutrientes a través del organismo",
    "nervous": "el sistema nervioso y sensorial, encargado de la recepción de estímulos, el procesamiento de información y la coordinación motora y autónoma",
    "digestive": "el sistema digestivo, responsable de la ingestión, digestión, absorción de nutrientes y excreción",
    "respiratory": "el sistema respiratorio, encargado de la ventilación pulmonar y del intercambio gaseoso de oxígeno y dióxido de carbono",
    "urinary": "el sistema urinario (excretor), responsable de la filtración sanguínea, el equilibrio hidroelectrolítico y la formación y conducción de la orina",
    "reproductive": "el sistema reproductor, constituido por las gónadas, conductos y órganos reproductivos",
    "lymphatic": "el sistema linfático e inmunitario, encargado del drenaje de la linfa y la defensa inmunológica del cuerpo",
    "integumentary": "el sistema tegumentario, que recubre y protege el organismo frente al medio externo",
}


def generar_descripcion_es(
    name_es: str,
    name_la: str,
    system: str,
    side: str,
    parent_name_es: str = "",
) -> str:
    """Genera una descripción anatómica educativa en español para la ficha del visor."""
    desc_sis = DESCRIPCION_SISTEMA.get(system, "el cuerpo humano")
    lado_txt = (
        "situada en el lado izquierdo (hemisferio/mitad siniestra)"
        if side == "left"
        else "situada en el lado derecho (hemisferio/mitad diestra)"
        if side == "right"
        else "de disposición medial o impar"
    )
    padre_txt = (
        f" Forma parte anatómica de «{parent_name_es}»."
        if parent_name_es and parent_name_es.lower() != name_es.lower()
        else ""
    )
    la_txt = (
        f" (en latín anatómico: *{name_la}*)"
        if name_la and name_la.lower() != name_es.lower()
        else ""
    )
    return (
        f"{name_es}{la_txt} es una estructura perteneciente a {desc_sis}, "
        f"{lado_txt}.{padre_txt}"
    )
