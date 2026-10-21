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
    (r"\bbranches\b", "ramas"),
    (r"\bbranch\b", "rama"),
    (r"\btributary of\b", "tributaria de"),
    (r"\btributaries\b", "tributarias"),
    (r"\btributary\b", "tributaria"),
    (r"\bjunction\b", "unión"),
    (r"\bileocecal\b", "ileocecal"),
    (r"\bcircumflex\b", "circunfleja"),
    (r"\bmarginal\b", "marginal"),
    (r"\bdiagonal\b", "diagonal"),
    (r"\bconus\b", "del cono arterial"),
    (r"\bventricular\b", "ventricular"),
    (r"\batrial\b", "auricular (atrial)"),
    (r"\bsternocostal\b", "esternocostal"),
    (r"\bacromial\b", "acromial"),
    (r"\bhumeral\b", "humeral"),
    (r"\bureteric\b", "ureteral"),
    (r"\bcalcaneal\b", "calcánea"),
    (r"\bset\b", "conjunto"),
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
            "falange", "vértebra", "costilla", "primera costilla", "segunda costilla",
            "tercera costilla", "cuarta costilla", "quinta costilla", "sexta costilla",
            "séptima costilla", "octava costilla", "novena costilla", "décima costilla",
            "undécima costilla", "duodécima costilla", "clavícula", "escápula",
            "rótula", "patela", "tibia", "fíbula", "ulna", "mano", "pierna", "rodilla",
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


# Banco de +115 descripciones fisiológicas y anatómicas detalladas (redacción propia STEMENSOFT, CC BY-SA 4.0)
DESCRIPCIONES_CLAVE: list[tuple[str, str]] = [
    # Sistema esquelético
    (r"\bfemur\b", "Es el hueso más largo, voluminoso y resistente del esqueleto humano. Forma el esqueleto del muslo: su cabeza esférica se articula proximalmente con el acetábulo del hueso coxal (articulación de la cadera) y sus cóndilos distales se articulan con la tibia y la rótula en la rodilla."),
    (r"\btibia\b", "Segundo hueso más largo del cuerpo, situado en la parte medial y anterior de la pierna. Soporta la mayor parte del peso corporal transmitido desde el fémur hacia el hueso astrágalo del tobillo."),
    (r"\bfibula\b", "Hueso largo y delgado situado en la cara lateral de la pierna, paralelo a la tibia. Actúa principalmente como sitio de inserción muscular y estabilizador lateral de la articulación del tobillo (maléolo lateral)."),
    (r"\bpatella\b", "Mayor hueso sesamoideo del cuerpo humano, alojado en el espesor del tendón del músculo cuádriceps femoral. Protege la cara anterior de la articulación de la rodilla y aumenta el brazo de palanca en la extensión de la pierna."),
    (r"\bhumerus\b", "Hueso largo del brazo que se extiende desde la articulación glenohumeral (hombro), donde su cabeza se articula con la escápula, hasta el codo, donde su tróclea y capítulo se articulan con el cúbito y el radio."),
    (r"\bradius\b", "Hueso largo lateral del antebrazo (del lado del pulgar). Su cabeza cilíndrica rota sobre el capítulo humeral y la escotadura radial del cúbito permitiendo los movimientos de pronación y supinación de la mano."),
    (r"\bulna\b", "Hueso largo medial del antebrazo (del lado del meñique). Su extremo proximal presenta el olécranon y la escotadura troclear, formando la bisagra principal de la articulación del codo con el húmero."),
    (r"\bclavicle\b", "Hueso alargado en forma de 'S' itálica que conecta el manubrio del esternón con el acromion de la escápula, actuando como puntal que mantiene el hombro separado del tórax y permite la amplitud de movimiento del miembro superior."),
    (r"\bscapula\b", "Hueso plano y triangular apoyado sobre la cara posterolateral superior de la caja torácica (entre la 2.ª y la 7.ª costilla). Su cavidad glenoidea recibe la cabeza del húmero y presta inserción a 17 músculos."),
    (r"\bmanubrium\b", "Porción superior y más ancha del esternón. Se articula con ambas clavículas y con los dos primeros pares de cartílagos costales, formando el límite anterior del estrecho torácico superior."),
    (r"\bsternum\b", "Hueso plano e impar situado en la línea media anterior del tórax. Junto con las costillas y los cartílagos costales conforma la caja torácica que protege el corazón, los grandes vasos y los pulmones."),
    (r"\bxiphoid\b", "Porción cartilaginosa u ósea inferior y más pequeña del esternón. Sirve como punto de inserción clave para el músculo diafragma, la línea alba y los músculos rectos del abdomen."),
    (r"\batlas\b|\bfirst cervical vertebra\b", "Primera vértebra cervical (C1), desprovista de cuerpo vertebral y apófisis espinosa. Sostiene el peso del cráneo articulándose con los cóndilos occipitales (permitiendo el movimiento de afirmación de la cabeza)."),
    (r"\baxis\b|\bsecond cervical vertebra\b", "Segunda vértebra cervical (C2), caracterizada por su apófisis odontoides (diente del axis), que actúa como pivote vertical alrededor del cual rota el atlas junto con la cabeza."),
    (r"\bcervical vertebra\b", "Vértebra de la región del cuello (C1-C7). Se caracteriza por poseer forámenes transversos por donde ascienden las arterias y venas vertebrales hacia el encéfalo."),
    (r"\bthoracic vertebra\b", "Vértebra del segmento dorsal o torácico (T1-T12). Presenta carillas costales en el cuerpo y en las apófisis transversas para articularse con las costillas y formar la jaula torácica."),
    (r"\blumbar vertebra\b", "Vértebra robusta del segmento inferior de la espalda (L1-L5). Su cuerpo voluminoso soporta gran parte del peso del tronco y permite amplios movimientos de flexión y extensión."),
    (r"\bsacrum\b", "Hueso triangular formado por la fusión de las cinco vértebras sacras (S1-S5). Se encaja como una cuña entre ambos huesos coxales cerrando posteriormente la cintura pélvica y transmitiendo el peso del tronco a los miembros inferiores."),
    (r"\bcoccyx\b", "Pequeño hueso triangular caudal formado por la fusión de 3 a 5 vértebras coccígeas rudimentarias. Presta inserción a ligamentos sacrococcígeos y a músculos del suelo pélvico."),
    (r"\bhip bone\b|\bpelvis\b", "Hueso plano y ancho de la cintura pélvica formado por la fusión del ilion, el isquion y el pubis. Aloja los órganos pélvicos y forma el acetábulo para la articulación coxofemoral."),
    (r"\bmandible\b", "Único hueso móvil del cráneo, con forma de herradura. Aloja los dientes inferiores en su proceso alveolar y se articula con los huesos temporales en la articulación temporomandibular (ATM) para la masticación."),
    (r"\bmaxilla\b", "Hueso par que forma la parte central del macizo facial, el paladar duro, el piso de la órbita, las paredes laterales de la cavidad nasal y aloja la arcada dentaria superior."),
    (r"\bvomer\b", "Hueso laminar impar de la línea media que forma la porción posteroinferior del tabique nasal óseo, separando ambas fosas nasales."),
    (r"\brib\b", "Hueso plano y arqueado que se extiende desde la columna vertebral torácica hacia la pared anterior del tórax, protegiendo los órganos intratorácicos y participando en la mecánica ventilatoria."),
    (r"\bcostal cartilage\b", "Barra de cartílago hialino que prolonga el extremo anterior de las costillas hacia el esternón, dotando de elasticidad a la caja torácica durante la inspiración y espiración."),
    (r"\bintervertebral disk\b", "Estructura fibrocartilaginosa interpuesta entre los cuerpos vertebrales adyacentes. Consta de un núcleo pulposo gelatinoso central y un anillo fibroso periférico que amortiguan las cargas axiales."),
    (r"\bmetacarpal\b", "Uno de los cinco huesos largos que conforman el esqueleto de la palma de la mano, articulándose proximalmente con el carpo y distalmente con las falanges proximales."),
    (r"\bmetatarsal\b", "Uno de los cinco huesos largos del antepié que conectan el tarso con las falanges de los dedos y forman los arcos longitudinal y transverso del pie."),
    (r"\bphalanx\b", "Hueso largo miniatura que conforma el esqueleto articulado de los dedos de la mano o del pie (falanges proximal, media y distal)."),

    # Sistema muscular
    (r"\bdiaphragm\b", "Principal músculo inspiratorio, con forma de doble cúpula musculotendinosa que separa la cavidad torácica de la abdominal. Al contraerse desciende y aumenta el volumen intratorácico permitiendo la entrada de aire a los pulmones."),
    (r"\bdeltoid\b", "Músculo triangular y voluminoso que envuelve la articulación del hombro (porciones clavicular, acromial y espinal). Es el principal abductor del brazo, además de participar en su flexión, extensión y rotación."),
    (r"\bpectoralis major\b", "Músculo ancho y superficial de la región anterosuperior del tórax (porciones clavicular, esternocostal y abdominal). Actúa como potente aductor, flexor y rotador medial del húmero."),
    (r"\bpectoralis minor\b", "Músculo triangular profundo al pectoral mayor que va de la 3.ª-5.ª costilla a la apófisis coracoides de la escápula; desciende y estabiliza la cintura escapular y actúa como músculo inspiratorio accesorio."),
    (r"\btrapezius\b", "Amplio músculo superficial del dorso superior y nuca. Sus fibras descendentes elevan la escápula, las transversas la retraen hacia la columna y las ascendentes la deprimen, rotando la cavidad glenoidea hacia arriba."),
    (r"\bsternocleidomastoid\b", "Músculo robusto y oblicuo del cuello que une el manubrio esternal y la clavícula con la apófisis mastoides temporal. Su contracción unilateral inclina la cabeza hacia el mismo lado y la rota hacia el lado opuesto."),
    (r"\bbiceps brachii\b", "Músculo anterior del brazo con dos cabezas proximales (corta coracoidea y larga supraglenoidea). Es el principal supinador del antebrazo y un potente flexor de la articulación del codo."),
    (r"\btriceps brachii\b", "Músculo posterior del brazo con tres cabezas (larga, lateral y medial) que se insertan en el olécranon del cúbito. Es el principal extensor del antebrazo en la articulación del codo."),
    (r"\blatissimus dorsi\b", "Músculo dorsal ancho de la espalda inferior que converge hacia el húmero. Es un potente extensor, aductor y rotador medial del brazo (fundamental al trepar, remar o nadar)."),
    (r"\bgluteus maximus\b", "El músculo más voluminoso y pesado del cuerpo humano, situado en la región glútea superficial. Es el principal extensor y rotador lateral del muslo, indispensable para ponerse de pie, subir escaleras y mantener la bipedestación."),
    (r"\bgluteus medius\b|\bgluteus minimus\b", "Músculo abductor y rotador medial de la cadera. Durante la marcha estabiliza la pelvis impidiendo que caiga hacia el lado del miembro que despega del suelo."),
    (r"\bsartorius\b", "El músculo más largo del cuerpo humano; cruza oblicuamente la cara anterior del muslo desde la espina ilíaca anterosuperior hasta la tibia medial (pata de ganso), flexionando cadera y rodilla."),
    (r"\bquadriceps\b|\brectus femoris\b|\bvastus\b", "Integrante del cuádriceps femoral en el compartimento anterior del muslo. Es el gran extensor de la articulación de la rodilla, imprescindible para caminar, correr y saltar."),
    (r"\bbiceps femoris\b", "Músculo isquiotibial posterolateral del muslo con cabeza larga y corta. Flexiona la pierna en la rodilla, la rota lateralmente y extiende el muslo en la cadera."),
    (r"\bgastrocnemius\b|\bsoleus\b", "Músculo del tríceps sural en la pantorrilla que se inserta en el calcáneo mediante el tendón de Aquiles. Produce la flexión plantar del pie al impulsar el cuerpo durante la marcha y el salto."),
    (r"\btibialis anterior\b", "Músculo principal del compartimento anterior de la pierna; realiza la dorsiflexión y la inversión del pie, evitando que la punta del pie arrastre durante la fase de balanceo de la marcha."),
    (r"\bintercostal\b", "Músculo laminar dispuesto en los espacios intercostales que moviliza y estabiliza las costillas durante los movimientos respiratorios de inspiración y espiración."),
    (r"\bexternal oblique\b|\binternal oblique\b|\brectus abdominis\b|\blinea alba\b", "Estructura de la pared anterolateral del abdomen que comprime y protege las vísceras abdominales, interviene en la espiración forzada y flexiona o rota el tronco."),
    (r"\blevator ani\b|\biliococcygeus\b|\bpubococcygeus\b|\bpuborectalis\b", "Componente muscular del diafragma pélvico (suelo pélvico) que sostiene las vísceras abdominopélvicas y participa en los mecanismos de continencia urinaria y fecal."),

    # Sistema circulatorio y corazón
    (r"\bleft ventricle\b", "Cámara cardíaca de paredes gruesas y musculares que recibe sangre oxigenada desde la aurícula izquierda a través de la válvula mitral y la impulsa a alta presión hacia la aorta para irrigar todo el organismo (circulación sistémica)."),
    (r"\bright ventricle\b", "Cámara cardíaca anteroinferior que recibe sangre venosa desoxigenada desde la aurícula derecha a través de la válvula tricúspide y la bombea a través de la válvula pulmonar hacia los pulmones (circulación menor)."),
    (r"\bright atrium\b", "Cavidad cardíaca posterosuperior derecha donde desembocan la vena cava superior, la vena cava inferior y el seno coronario, recogiendo el retorno venoso sistémico."),
    (r"\bleft atrium\b", "Cavidad cardíaca posterior que recibe la sangre recién oxigenada procedente de los pulmones a través de las cuatro venas pulmonares y la conduce hacia el ventrículo izquierdo."),
    (r"\btricuspid valve\b", "Válvula auriculoventricular derecha formada por tres valvas (anterior, posterior y septal) sujetas por cuerdas tendinosas a los músculos papilares; impide el reflujo de sangre del ventrículo derecho a la aurícula derecha durante la sístole."),
    (r"\bmitral valve\b", "Válvula auriculoventricular izquierda (bicúspide), provista de las valvas anterior y posterior; garantiza el flujo unidireccional de sangre oxigenada desde la aurícula izquierda al ventrículo izquierdo."),
    (r"\baortic valve\b", "Válvula semilunar situada a la salida del ventrículo izquierdo en el origen de la aorta ascendente; consta de tres valvas semilunares que se cierran en diástole evitando la regurgitación aórtica."),
    (r"\bpulmonary valve\b", "Válvula semilunar situada entre el cono arterial del ventrículo derecho y el tronco pulmonar; consta de tres valvas semilunares que impiden el retorno sanguíneo desde la arteria pulmonar."),
    (r"\bpapillary muscle\b", "Proyección muscular cónica de la pared interna ventricular en la que se insertan las cuerdas tendinosas; se contrae en sístole para evitar el prolapso de las valvas mitral o tricúspide."),
    (r"\bascending aorta\b", "Primer tramo de la arteria aorta que nace en el ventrículo izquierdo; de sus senos aórticos de Valsalva se originan las arterias coronarias derecha e izquierda que irrigan el miocardio."),
    (r"\barch of aorta\b", "Segundo segmento curvado de la aorta en el mediastino superior; da origen a los tres grandes troncos arteriales supraaórticos: tronco braquiocefálico, arteria carótida común izquierda y arteria subclavia izquierda."),
    (r"\bdescending aorta\b|\bthoracic aorta\b|\babdominal aorta\b", "Tramo principal de la arteria aorta que desciende por el tórax y el abdomen distribuyendo ramas parietales y viscerales para todos los órganos toracoabdominales antes de bifurcarse en las arterias ilíacas comunes."),
    (r"\bcoronary artery\b", "Arteria encargada de la irrigación nutricional del propio músculo cardíaco (miocardio); nace en la raíz de la aorta ascendente."),
    (r"\bcoronary sinus\b", "Conducto venoso principal del corazón alojado en el surco coronario posterior; recoge la mayor parte de la sangre venosa del miocardio y la drena directamente en la aurícula derecha."),
    (r"\bsuperior vena cava\b", "Gran tronco venoso del mediastino superior que retorna a la aurícula derecha toda la sangre desoxigenada procedente de la cabeza, el cuello, los miembros superiores y el tórax."),
    (r"\binferior vena cava\b", "La vena de mayor calibre del cuerpo humano; asciende por el retroperitoneo recogiendo el retorno venoso de los miembros inferiores, la pelvis y el abdomen hasta desembocar en la aurícula derecha."),
    (r"\bcarotid artery\b", "Arteria principal del cuello encargada de llevar sangre oxigenada hacia las estructuras craneofaciales (carótida externa) y hacia el encéfalo y la órbita (carótida interna)."),
    (r"\bjugular vein\b", "Vena colectora principal del cuello que drena la sangre venosa del encéfalo, la cara y la región cervical hacia las venas subclavias y braquiocefálicas."),

    # Sistema respiratorio
    (r"\btrachea\b", "Conducto aéreo fibrocartilaginoso de unos 10-12 cm reforzado por anillos hialinos en forma de 'C'; comunica la laringe con los bronquios principales derecho e izquierdo en la carina traqueal."),
    (r"\bmain bronchus\b|\bbronchus\b|\bbronchial\b", "Vía aérea de conducción del árbol traqueobronquial que transporta el aire inspirado hacia los lóbulos y segmentos broncopulmonares hasta alcanzar los alvéolos."),
    (r"\blung\b|\bbronchopulmonary\b", "Órgano esencial del aparato respiratorio alojado en las cavidades pleurales del tórax, donde se produce la hematosis (intercambio de oxígeno y dióxido de carbono entre el aire alveolar y la sangre capilar)."),
    (r"\blarynx\b|\bcricoid\b|\bthyroid cartilage\b|\bconus elasticus\b|\bthyrohyoid\b", "Estructura cartilaginosa y muscular de la vía aérea superior que conecta la faringe con la tráquea, protege la vía respiratoria durante la deglución y aloja las cuerdas vocales para la fonación."),

    # Sistema digestivo
    (r"\besophagus\b", "Tubo muscular de unos 25 cm que atraviesa el cuello, el mediastino posterior y el hiato esofágico del diafragma para impulsar el bolo alimenticio desde la faringe hasta el estómago mediante ondas peristálticas."),
    (r"\bstomach\b", "Porción dilatada en forma de 'J' del tubo digestivo situada entre el esófago y el duodeno; realiza la digestión mecánica y química del bolo alimenticio mediante el jugo gástrico (ácido clorhídrico y pepsina) transformándolo en quimo."),
    (r"\bduodenum\b", "Primera porción fija del intestino delgado (en forma de 'C' alrededor de la cabeza del páncreas); recibe el quimo ácido del estómago junto con la bilis hepática y las enzimas pancreáticas para iniciar la absorción intestinal."),
    (r"\bjejunum\b|\bileum\b|\bsmall intestine\b", "Segmento del intestino delgado provisto de pliegues circulares, vellosidades y microvellosidades que multiplican la superficie mucosa para la absorción de nutrientes, agua y electrolitos."),
    (r"\bcolon\b|\blarge intestine\b|\bappendix\b|\bileocecal\b|\brectum\b", "Tramo del intestino grueso encargado de absorber agua y electrolitos, albergar la microbiota intestinal, sintetizar vitaminas (como la K) y compactar y conducir el bolo fecal hacia su evacuación."),
    (r"\bliver\b|\bhepatic\b|\bhepatovenous\b", "La glándula más voluminosa del organismo (situada en el hipocondrio derecho); desempeña funciones metabólicas centrales, desintoxicación, almacenamiento de glucógeno, síntesis de proteínas plasmáticas y producción de bilis."),
    (r"\bgallbladder\b|\bcystic duct\b|\bbiliary\b", "Reservorio piriforme situado en la cara visceral del hígado que almacena y concentra la bilis entre las comidas y la vierte al duodeno a través del conducto cístico y el colédoco para emulsionar las grasas."),
    (r"\bpancreas\b|\bpancreatic\b", "Glándula mixta retroperitoneal: su porción exocrina secreta jugo pancreático rico en bicarbonato y enzimas digestivas (amilasa, lipasa, tripsina) hacia el duodeno, y sus islotes endocrinos secretan insulina y glucagón a la sangre."),
    (r"\btongue\b|\bgingiva\b|\btooth\b|\bmouth\b|\bsalivary\b|\bparotid\b|\bsubmandibular\b", "Estructura de la cavidad oral que participa en la masticación, insalivación, articulación del habla, sentido del gusto e inicio de la deglución."),

    # Sistema urinario y reproductor
    (r"\bkidney\b|\brenal\b", "Órgano par retroperitoneal con forma de habichuela que filtra el plasma sanguíneo a través de más de un millón de nefronas para eliminar desechos metabólicos (urea, creatinina), regular la presión arterial, el pH y el equilibrio hidrosalino."),
    (r"\bureter\b", "Conducto muscular retroperitoneal de 25-30 cm que transporta la orina desde la pelvis renal hasta la vejiga urinaria mediante contracciones peristálticas rítmicas."),
    (r"\burinary bladder\b", "Órgano muscular hueco subperitoneal (músculo detrusor) situado en la pelvis menor que actúa como reservorio distensible de la orina procedente de los uréteres hasta el momento de la micción."),
    (r"\burethra\b", "Conducto fibromuscular terminal de las vías urinarias que evacua la orina desde la vejiga urinaria hacia el exterior (y en el varón conduce además el líquido seminal)."),
    (r"\btestis\b|\bdeferent\b|\bprostate\b|\bseminal\b", "Órgano del aparato reproductor masculino encargado de la espermatogénesis, la síntesis de andrógenos (testosterona) o la producción y conducción del plasma seminal."),
    (r"\bovary\b|\buterus\b|\bfallopian\b|\bvagina\b|\bplacenta\b|\bmammary\b", "Órgano del aparato reproductor femenino implicado en la ovogénesis, la secreción de estrógenos y progesterona, la fecundación, la gestación o la lactancia."),

    # Sistema linfático e inmunitario
    (r"\bspleen\b", "Mayor órgano linfoide del cuerpo, situado en el hipocondrio izquierdo; filtra la sangre eliminando eritrocitos envejecidos (hemocateresis), almacena plaquetas y activa linfocitos T y B en la respuesta inmunitaria."),
    (r"\bthymus\b|\blymph\b|\bthoracic duct\b|\btonsil\b", "Órgano o conducto del sistema linfoinmunitario responsable de la maduración de linfocitos T, el filtrado de la linfa o su retorno hacia el torrente venoso."),

    # Sistema nervioso y órganos de los sentidos
    (r"\bcerebellum\b", "Órgano del encéfalo posterior alojado en la fosa craneal posterior; coordina la precisión de los movimientos voluntarios, el equilibrio postural, el tono muscular y el aprendizaje motor."),
    (r"\bpons\b|\bmedulla oblongata\b|\bmidbrain\b", "División del tronco del encéfalo que conecta el cerebro y el cerebelo con la médula espinal, contiene núcleos de pares craneales y regula funciones vitales automáticas (respiración y ritmo cardíaco)."),
    (r"\bthalamus\b|\bhypothalamus\b", "Núcleo central del diencéfalo: el tálamo actúa como estación de relevo de las vías sensitivas y motoras hacia la corteza cerebral, mientras que el hipotálamo regula el sistema autónomo, la temperatura y la hipófisis."),
    (r"\bhippocampus\b|\bamygdala\b|\bfornix\b", "Estructura clave del sistema límbico en el lóbulo temporal medial, esencial para la consolidación de la memoria declarativa, la orientación espacial y el procesamiento emocional."),
    (r"\bcorpus callosum\b", "Mayor comisura de sustancia blanca del cerebro, formada por más de 200 millones de axones mielinizados que interconectan ambos hemisferios cerebrales derecho e izquierdo coordinando sus funciones."),
    (r"\bcaudate\b|\bputamen\b|\bpallidum\b", "Núcleo de los ganglios basales del telencéfalo implicado en la planificación, iniciación y modulación fina del movimiento voluntario y hábitos motores."),
    (r"\bgyrus\b|\bcerebral cortex\b|\bwhite matter\b|\bgray matter\b", "Estructura del telencéfalo involucrada en el procesamiento sensorial, motor, del lenguaje y las funciones cognitivas superiores."),
    (r"\bspinal cord\b", "Cordón nervioso cilíndrico del sistema nervioso central alojado dentro del conducto vertebral; conduce impulsos aferentes (sensitivos) y eferentes (motores) entre el encéfalo y el resto del cuerpo e integra los arcos reflejos."),
    (r"\bpituitary\b", "Glándula hipófisis ('glándula maestra' endocrina), situada en la silla turca del hueso esfenoides bajo el control del hipotálamo; secreta hormonas que regulan el crecimiento, la tiroides, la corteza suprarrenal y las gónadas."),
    (r"\beyeball\b|\bcornea\b|\bretina\b|\blens\b|\bchoroid\b|\bsclera\b|\biris\b|\boptic\b", "Estructura del órgano de la visión: los medios transparentes (córnea y cristalino) enfocan la luz sobre los fotorreceptores de la retina (conos y bastones), que transducen las imágenes en impulsos enviados por el nervio óptico."),

    # Sistema tegumentario
    (r"\bskin\b|\bintegument\b", "Órgano más extenso del cuerpo humano; constituye una barrera física e inmunológica frente al exterior, regula la temperatura corporal mediante la sudoración y la vasomotricidad y aloja receptores táctiles y térmicos."),
]


def generar_descripcion_es(
    name_es: str,
    name_la: str,
    system: str,
    side: str,
    parent_name_es: str = "",
    name_en: str = "",
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

    busqueda = f"{name_en} {name_la}".lower()
    detalle_fisiologico = ""
    for patron, texto in DESCRIPCIONES_CLAVE:
        if re.search(patron, busqueda):
            detalle_fisiologico = f" {texto}"
            break

    return (
        f"{name_es}{la_txt} es una estructura perteneciente a {desc_sis}, "
        f"{lado_txt}.{padre_txt}{detalle_fisiologico}"
    )

