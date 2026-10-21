"""Fase 2: construye los 10 GLB por sistema desde BodyParts3D y genera metadata.json.

Entrada:
  - data/raw/bodyparts3d/isa_BP3D_4.0_obj_99.zip (2.234 archivos FJ*.obj = 1.659 estructuras FMA)
  - data/raw/bodyparts3d/*_inclusion_relation_list.txt y *_element_parts.txt
  - data/raw/z-anatomy/TA2.csv (solo consulta de términos en latín y español)
  - data/raw/hubmap/* (catálogo de órganos detallados masculinos y femeninos + crosswalk.csv)

Salida temporal (sin comprimir, para pasar por scripts/optimize.mjs):
  - data/processed/_raw_glb/<system>.glb (10 sistemas)
Salida final de metadatos:
  - data/processed/metadata.json
"""

from __future__ import annotations

import array
import csv
import json
import math
import re
import struct
import time
import zipfile
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
BP_DIR = RAIZ / "data" / "raw" / "bodyparts3d"
ZA_DIR = RAIZ / "data" / "raw" / "z-anatomy"
HB_DIR = RAIZ / "data" / "raw" / "hubmap"
OUT_RAW_GLB = RAIZ / "data" / "processed" / "_raw_glb"
OUT_META = RAIZ / "data" / "processed" / "metadata.json"

COPYRIGHT_BP3D = (
    "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 "
    "International (https://creativecommons.org/licenses/by/4.0/). "
    "Modificado por STEMENSOFT (conversión a GLB, agrupación por sistemas y compresión); "
    "distribuido bajo CC BY-SA 4.0."
)

# Colores PBR base (RGBA lineal aprox.) y rugosidad por sistema
MATERIALES_SISTEMA = {
    "skeletal":      {"color": [0.91, 0.88, 0.79, 1.0], "roughness": 0.55, "metallic": 0.05},
    "muscular":      {"color": [0.72, 0.23, 0.22, 1.0], "roughness": 0.65, "metallic": 0.05},
    "circulatory":   {"color": [0.80, 0.12, 0.16, 1.0], "roughness": 0.45, "metallic": 0.08},
    "nervous":       {"color": [0.93, 0.82, 0.45, 1.0], "roughness": 0.50, "metallic": 0.05},
    "digestive":     {"color": [0.84, 0.53, 0.42, 1.0], "roughness": 0.60, "metallic": 0.05},
    "respiratory":   {"color": [0.88, 0.56, 0.62, 1.0], "roughness": 0.55, "metallic": 0.05},
    "urinary":       {"color": [0.68, 0.36, 0.28, 1.0], "roughness": 0.50, "metallic": 0.05},
    "reproductive":  {"color": [0.82, 0.48, 0.58, 1.0], "roughness": 0.55, "metallic": 0.05},
    "lymphatic":     {"color": [0.42, 0.72, 0.46, 1.0], "roughness": 0.55, "metallic": 0.05},
    "integumentary": {"color": [0.92, 0.76, 0.65, 0.45], "roughness": 0.70, "metallic": 0.02},
}


def cargar_ta2() -> dict[str, tuple[str, str]]:
    """Devuelve {nombre_en_lower: (nombre_la, nombre_es)} desde TA2.csv."""
    mapa: dict[str, tuple[str, str]] = {}
    ruta = ZA_DIR / "TA2.csv"
    if not ruta.exists():
        return mapa
    for linea in ruta.read_text(encoding="utf-8-sig", errors="replace").splitlines()[1:]:
        linea = linea.strip().strip('"')
        partes = linea.split(";")
        if len(partes) >= 5:
            _, en, la, _, es = partes[:5]
            k = en.lower().strip()
            if k and k not in mapa:
                mapa[k] = (la.strip() or en.strip(), es.strip() or en.strip())
    return mapa


REEMPLAZOS_ES = [
    (r"^Right\s+", "Derecho/a: "),
    (r"^Left\s+", "Izquierdo/a: "),
    (r"\bsegment of\b", "segmento de"),
    (r"\bzone of\b", "zona de"),
    (r"\bbranch of\b", "rama de"),
    (r"\btributary of\b", "tributaria de"),
    (r"\btrunk of\b", "tronco de"),
    (r"\banterior\b", "anterior"),
    (r"\bposterior\b", "posterior"),
    (r"\bsuperior\b", "superior"),
    (r"\binferior\b", "inferior"),
    (r"\bmedial\b", "medial"),
    (r"\blateral\b", "lateral"),
    (r"\binternal\b", "interno/a"),
    (r"\bexternal\b", "externo/a"),
    (r"\bmiddle\b", "medio/a"),
    (r"\bdeep\b", "profundo/a"),
    (r"\bsuperficial\b", "superficial"),
    (r"\bartery\b", "arteria"),
    (r"\bvein\b", "vena"),
    (r"\bnerve\b", "nervio"),
    (r"\bmuscle\b", "músculo"),
    (r"\bbone\b", "hueso"),
    (r"\bligament\b", "ligamento"),
    (r"\btendon\b", "tendón"),
    (r"\bcartilage\b", "cartílago"),
    (r"\bgland\b", "glándula"),
    (r"\blymph node\b", "ganglio linfático"),
]


def traducir_nombre(nombre_en: str, ta2: dict[str, tuple[str, str]]) -> tuple[str, str, str]:
    """Devuelve (side, nameLa, nameEs) para un nombre en inglés."""
    low = nombre_en.lower().strip()
    side = "median"
    if re.search(r"\bleft\b", low):
        side = "left"
    elif re.search(r"\bright\b", low):
        side = "right"

    if low in ta2:
        la, es = ta2[low]
        return side, la, es

    # Probar sin indicación de lado
    sin_lado = re.sub(r"^(left|right)\s+", "", low)
    sin_lado = re.sub(r"\b(of left|of right)\b", "of", sin_lado)
    sin_lado = re.sub(r"\b(left|right)\s+", "", sin_lado).strip()
    if sin_lado in ta2:
        la_base, es_base = ta2[sin_lado]
        if side == "left":
            return side, f"{la_base} (sinister)", f"{es_base} (izquierdo/a)"
        if side == "right":
            return side, f"{la_base} (dexter)", f"{es_base} (derecho/a)"
        return side, la_base, es_base

    # Respaldo legible
    es_aprox = nombre_en
    for pat, rep in REEMPLAZOS_ES:
        es_aprox = re.sub(pat, rep, es_aprox, flags=re.IGNORECASE)
    return side, nombre_en, es_aprox


def cargar_relaciones_bp3d():
    fj_to_fmas: dict[str, set[str]] = defaultdict(set)
    fma_names: dict[str, str] = {}
    for pref in ("partof", "isa"):
        for l in (BP_DIR / f"{pref}_element_parts.txt").read_text("utf-8").splitlines()[1:]:
            fma, en, fj = l.split("\t")
            fj_to_fmas[fj].add(fma)
            fma_names[fma] = en

    partof_parent: dict[str, str] = {}
    isa_parent: dict[str, str] = {}
    for l in (BP_DIR / "partof_inclusion_relation_list.txt").read_text("utf-8").splitlines()[1:]:
        p, pn, c, cn = l.split("\t")
        partof_parent.setdefault(c, p)
        fma_names.setdefault(p, pn)
        fma_names.setdefault(c, cn)
    for l in (BP_DIR / "isa_inclusion_relation_list.txt").read_text("utf-8").splitlines()[1:]:
        p, pn, c, cn = l.split("\t")
        isa_parent.setdefault(c, p)
        fma_names.setdefault(p, pn)
        fma_names.setdefault(c, cn)

    return fj_to_fmas, fma_names, partof_parent, isa_parent


def clasificar_sistema(fjs: set[str], cid: str, ename: str,
                       fj_to_fmas: dict[str, set[str]], fma_names: dict[str, str]) -> str:
    all_fmas = {cid}
    for fj in fjs:
        all_fmas |= fj_to_fmas.get(fj, set())
    all_names = " | ".join(fma_names.get(x, "").lower() for x in all_fmas) + " | " + ename.lower()

    if any(x in all_fmas for x in ("FMA5018", "FMA23881", "FMA55107", "FMA7538", "FMA21496", "FMA86375")) and not any(
        w in all_names for w in ("laryngeal", "nasal cartilage", "trache", "bronch", "thyrohyoid", "conus elasticus")
    ):
        return "skeletal"
    if "interosseous membrane" in all_names:
        return "skeletal"

    if any(x in all_fmas for x in ("FMA5022", "FMA32558", "FMA45729", "FMA10474", "FMA9721", "FMA79063")) or any(
        w in all_names for w in ("trapezius", "linea alba", "common tendinous ring", "pterygomandibular raphe")
    ):
        return "muscular"

    if any(x in all_fmas for x in ("FMA7161", "FMA228642", "FMA50722", "FMA3710", "FMA63812", "FMA63814", "FMA3727", "FMA7232", "FMA67598")):
        if any(w in all_names for w in ("lymph", "thoracic duct", "spleen", "thymus")):
            return "lymphatic"
        return "circulatory"

    if any(x in all_fmas for x in ("FMA7158", "FMA12224")) or any(
        w in all_names for w in ("lung", "bronch", "trachea", "laryn", "nasal", "pleura", "alveol", "epiglottis", "conus elasticus", "thyrohyoid membrane")
    ):
        return "respiratory"

    if any(x in all_fmas for x in ("FMA7152", "FMA12516", "FMA14092", "FMA71856", "FMA15737")) or any(
        w in all_names for w in (
            "tooth", "gingiva", "tongue", "esophag", "stomach", "intestin", "colon", "rectum",
            "anal", "liver", "gallbladder", "pancrea", "pharyn", "salivary", "parotid",
            "submandibular", "sublingual", "biliary", "peritone", "omentum", "mesenter", "lip"
        )
    ):
        return "digestive"

    if "FMA7159" in all_fmas or any(w in all_names for w in ("kidney", "renal", "ureter", "urinary", "bladder", "urethra")):
        return "urinary"

    if "FMA7160" in all_fmas or any(
        w in all_names for w in (
            "prostate", "testis", "epididymis", "deferens", "deferent duct", "seminal",
            "penis", "scrotum", "ovary", "uterus", "vagina", "fallopian", "bulbourethral",
            "corpus cavernosum", "corpus spongiosum"
        )
    ):
        return "reproductive"

    if any(w in all_names for w in ("lymph", "spleen", "thymus", "tonsil")):
        return "lymphatic"

    if any(x in all_fmas for x in ("FMA7157", "FMA256237", "FMA11195", "FMA83143", "FMA242789")) or any(
        w in all_names for w in (
            "brain", "cerebr", "cerebell", "neural", "nerve", "neuraxis", "spinal cord",
            "mening", "dura mater", "pia mater", "arachnoid", "ventricle", "interventricular foramen",
            "thalam", "hippocamp", "putamen", "caudate", "pallidum", "amygdala", "pons", "medulla",
            "midbrain", "fornix", "corpus callosum", "chiasm", "eyeball", "eyelid", "tarsal plate",
            "cornea", "retina", "lens", "choroid", "sclera", "iris", "ciliary", "vitreous",
            "lacrimal", "cochlea", "vestibul", "semicircular", "tympanic", "auditory", "external ear",
            "pituitary", "pineal"
        )
    ):
        return "nervous"

    if any(x in all_fmas for x in ("FMA72979", "FMA74657")) or any(
        w in all_names for w in ("skin", "integument", "mammary", "nipple", "hair", "nail", "subcutaneous")
    ):
        return "integumentary"

    return "skeletal"


def parsear_obj(raw_bytes: bytes) -> tuple[array.array, array.array, array.array]:
    """Parsea un OBJ de BodyParts3D y convierte coords (mm Z-up -> m Y-up)."""
    pos = array.array("f")
    nor = array.array("f")
    idx = array.array("I")

    for line in raw_bytes.splitlines():
        if not line or line.startswith(b"#"):
            continue
        if line.startswith(b"v "):
            parts = line.split()
            x = float(parts[1]) * 0.001
            y = float(parts[2]) * 0.001
            z = float(parts[3]) * 0.001
            # Z-up (x, y, z) -> Y-up (x, z, -y)
            pos.extend((x, z, -y))
        elif line.startswith(b"vn "):
            parts = line.split()
            nx = float(parts[1])
            ny = float(parts[2])
            nz = float(parts[3])
            rx, ry, rz = nx, nz, -ny
            ln = math.sqrt(rx * rx + ry * ry + rz * rz)
            if ln > 1e-8:
                rx, ry, rz = rx / ln, ry / ln, rz / ln
            nor.extend((rx, ry, rz))
        elif line.startswith(b"f "):
            parts = line.split()
            # f v1//vn1 v2//vn2 v3//vn3 (1-based)
            i0 = int(parts[1].split(b"/")[0]) - 1
            i1 = int(parts[2].split(b"/")[0]) - 1
            i2 = int(parts[3].split(b"/")[0]) - 1
            idx.extend((i0, i1, i2))

    # Si por alguna razón un OBJ tuviera distinto número de vn que v, rellenar normales
    if len(nor) != len(pos):
        nor = array.array("f", [0.0, 1.0, 0.0] * (len(pos) // 3))
    return pos, nor, idx


def escribir_glb_sistema(ruta_glb: Path, sistema: str, mallas: list[dict]) -> dict:
    """Empaqueta una lista de mallas [{mesh_name, cid, name_en, pos, nor, idx}] en un GLB 2.0 válido."""
    bin_chunks = bytearray()
    buffer_views = []
    accessors = []
    gltf_meshes = []
    gltf_nodes = []

    def add_chunk(data: bytes, target: int) -> tuple[int, int]:
        offset = len(bin_chunks)
        bin_chunks.extend(data)
        pad = (4 - (len(bin_chunks) % 4)) % 4
        if pad:
            bin_chunks.extend(b"\x00" * pad)
        bv_idx = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(data),
            "target": target,
        })
        return bv_idx, len(data)

    total_verts = 0
    total_tris = 0

    for m in mallas:
        pos: array.array = m["pos"]
        nor: array.array = m["nor"]
        idx: array.array = m["idx"]
        vcount = len(pos) // 3
        icount = len(idx)
        if vcount == 0 or icount == 0:
            continue

        total_verts += vcount
        total_tris += icount // 3

        xs = pos[0::3]
        ys = pos[1::3]
        zs = pos[2::3]
        min_pt = [float(min(xs)), float(min(ys)), float(min(zs))]
        max_pt = [float(max(xs)), float(max(ys)), float(max(zs))]

        bv_pos, _ = add_chunk(pos.tobytes(), 34962)  # ARRAY_BUFFER
        acc_pos = len(accessors)
        accessors.append({
            "bufferView": bv_pos,
            "componentType": 5126,  # FLOAT
            "count": vcount,
            "type": "VEC3",
            "min": min_pt,
            "max": max_pt,
        })

        bv_nor, _ = add_chunk(nor.tobytes(), 34962)
        acc_nor = len(accessors)
        accessors.append({
            "bufferView": bv_nor,
            "componentType": 5126,  # FLOAT
            "count": vcount,
            "type": "VEC3",
        })

        # Usar UNSIGNED_SHORT si cabe en < 65535 vértices para ahorrar espacio
        if vcount < 65535:
            idx16 = array.array("H", idx)
            bv_idx, _ = add_chunk(idx16.tobytes(), 34963)  # ELEMENT_ARRAY_BUFFER
            comp_type = 5123  # UNSIGNED_SHORT
        else:
            bv_idx, _ = add_chunk(idx.tobytes(), 34963)
            comp_type = 5125  # UNSIGNED_INT

        acc_idx = len(accessors)
        accessors.append({
            "bufferView": bv_idx,
            "componentType": comp_type,
            "count": icount,
            "type": "SCALAR",
        })

        mesh_idx = len(gltf_meshes)
        gltf_meshes.append({
            "name": m["mesh_name"],
            "primitives": [{
                "attributes": {
                    "POSITION": acc_pos,
                    "NORMAL": acc_nor,
                },
                "indices": acc_idx,
                "material": 0,
                "mode": 4,  # TRIANGLES
            }],
            "extras": {
                "id": m["cid"],
                "nameEn": m["name_en"],
                "system": sistema,
            },
        })

        gltf_nodes.append({
            "name": m["mesh_name"],
            "mesh": mesh_idx,
            "extras": {
                "id": m["cid"],
            },
        })

    mat_cfg = MATERIALES_SISTEMA[sistema]
    material = {
        "name": f"mat_{sistema}",
        "pbrMetallicRoughness": {
            "baseColorFactor": mat_cfg["color"],
            "metallicFactor": mat_cfg["metallic"],
            "roughnessFactor": mat_cfg["roughness"],
        },
        "doubleSided": True,
    }
    if mat_cfg["color"][3] < 1.0:
        material["alphaMode"] = "BLEND"

    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "STEMENSOFT biologia fase2_construir_glb.py",
            "copyright": COPYRIGHT_BP3D,
            "extras": {
                "source": "BodyParts3D v4.0 (DBCLS)",
                "sourceLicense": "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)",
                "projectLicense": "CC BY-SA 4.0",
                "system": sistema,
            },
        },
        "scene": 0,
        "scenes": [{
            "name": sistema,
            "nodes": list(range(len(gltf_nodes))),
        }],
        "nodes": gltf_nodes,
        "meshes": gltf_meshes,
        "materials": [material],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{
            "byteLength": len(bin_chunks),
        }],
    }

    json_bytes = json.dumps(gltf_json, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    if json_pad:
        json_bytes += b" " * json_pad

    total_length = 12 + 8 + len(json_bytes) + 8 + len(bin_chunks)
    ruta_glb.parent.mkdir(parents=True, exist_ok=True)
    with ruta_glb.open("wb") as f:
        # Cabecera GLB: magic 'glTF', version 2, length
        f.write(struct.pack("<III", 0x46546C67, 2, total_length))
        # Chunk 0: JSON
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        # Chunk 1: BIN
        f.write(struct.pack("<II", len(bin_chunks), 0x004E4942))
        f.write(bin_chunks)

    return {
        "nodes": len(gltf_nodes),
        "vertices": total_verts,
        "triangles": total_tris,
        "bytes": total_length,
    }


def clasificar_organo_hubmap(organo: str) -> str:
    o = organo.lower()
    if any(w in o for w in ("heart", "vasculature")):
        return "circulatory"
    if any(w in o for w in ("brain", "spinal-cord", "eye")):
        return "nervous"
    if any(w in o for w in ("lung", "bronchus", "trachea", "larynx")):
        return "respiratory"
    if any(w in o for w in ("liver", "pancreas", "intestine", "colon", "mouth", "omentum")):
        return "digestive"
    if any(w in o for w in ("kidney", "renal-pelvis", "ureter", "urinary-bladder")):
        return "urinary"
    if any(w in o for w in ("ovary", "uterus", "fallopian", "placenta", "prostate")):
        return "reproductive"
    if any(w in o for w in ("lymph-node", "spleen", "thymus", "tonsil")):
        return "lymphatic"
    if any(w in o for w in ("skin", "mammary", "adipose")):
        return "integumentary"
    if any(w in o for w in ("pelvis", "sternum", "manubrium", "knee", "intervertebral-disk")):
        return "skeletal"
    return "skeletal"


def catalogar_hubmap(ta2: dict[str, tuple[str, str]]) -> list[dict]:
    """Genera entradas de órganos detallados de HuBMAP para metadata.json."""
    organos_hb = []
    meta_dir = HB_DIR / "metadatos"
    if not meta_dir.exists():
        return organos_hb

    for meta_file in sorted(meta_dir.glob("*.json")):
        organo = meta_file.stem
        if organo in ("asct-b-3d-models-crosswalk",):
            continue
        carpeta = HB_DIR / organo
        glbs = list(carpeta.glob("*.glb"))
        if not glbs:
            continue
        glb_path = glbs[0]
        data = json.loads(meta_file.read_text(encoding="utf-8"))
        raw = data.get("was_derived_from", {})

        nodos = []
        cw_path = carpeta / "crosswalk.csv"
        if cw_path.exists():
            with cw_path.open("r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    node_name = (row.get("node_name") or "").strip()
                    ont_id = (row.get("OntologyID") or "").strip()
                    label = (row.get("label") or "").strip()
                    if node_name and node_name != "/":
                        _, la, es = traducir_nombre(label or node_name, ta2)
                        nodos.append({
                            "nodeName": node_name,
                            "ontologyId": ont_id,
                            "nameEn": label or node_name,
                            "nameLa": la,
                            "nameEs": es,
                        })

        sex = "female" if "female" in organo else ("male" if "male" in organo else "unspecified")
        organos_hb.append({
            "id": f"HUBMAP_{organo}",
            "organ": organo,
            "version": data.get("version", ""),
            "sex": sex,
            "system": clasificar_organo_hubmap(organo),
            "glbFile": f"data/raw/hubmap/{organo}/{glb_path.name}",
            "source": "hubmap",
            "license": "CC BY 4.0",
            "citation": raw.get("citation", ""),
            "doi": raw.get("doi", ""),
            "nodesCount": len(nodos),
            "nodes": nodos,
        })
    return organos_hb


def slug_malla(cid: str, ename: str) -> str:
    limpio = re.sub(r"[^A-Za-z0-9]+", "_", ename.strip()).strip("_")
    return f"{cid}_{limpio}"


def main() -> None:
    t0 = time.time()
    print("1/4 Cargando tablas de BodyParts3D y TA2.csv…")
    ta2 = cargar_ta2()
    fj_to_fmas, fma_names, partof_parent, isa_parent = cargar_relaciones_bp3d()

    print("2/4 Leyendo y agrupando las 2.234 mallas de isa_BP3D_4.0_obj_99.zip…")
    zip_path = BP_DIR / "isa_BP3D_4.0_obj_99.zip"
    concept_fjs: dict[str, list[tuple[str, bytes]]] = defaultdict(list)
    concept_name: dict[str, str] = {}

    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if not info.filename.endswith(".obj"):
                continue
            fj = Path(info.filename).stem
            raw_bytes = z.read(info.filename)
            cid, ename = None, None
            for line in raw_bytes.splitlines()[:25]:
                s = line.decode("utf-8", errors="replace").strip()
                if s.startswith("# Concept ID :"):
                    cid = s.split(":", 1)[1].strip()
                elif s.startswith("# English name :"):
                    ename = s.split(":", 1)[1].strip()
                elif not s.startswith("#"):
                    break
            if cid:
                concept_fjs[cid].append((fj, raw_bytes))
                concept_name[cid] = ename or fma_names.get(cid, cid)

    print(f"    -> {len(concept_fjs)} estructuras FMA únicas encontradas.")

    # Agrupar por sistema y fusionar sub-mallas del mismo Concept ID
    sistemas_mallas: dict[str, list[dict]] = defaultdict(list)
    metadata_estructuras: list[dict] = []

    for cid in sorted(concept_fjs.keys(), key=lambda x: int(re.sub(r"\D", "", x) or "0")):
        ename = concept_name[cid]
        fjs_list = concept_fjs[cid]
        fjs_set = {fj for fj, _ in fjs_list}
        sistema = clasificar_sistema(fjs_set, cid, ename, fj_to_fmas, fma_names)

        merged_pos = array.array("f")
        merged_nor = array.array("f")
        merged_idx = array.array("I")

        for _, raw_bytes in fjs_list:
            pos, nor, idx = parsear_obj(raw_bytes)
            base_v = len(merged_pos) // 3
            merged_pos.extend(pos)
            merged_nor.extend(nor)
            if base_v == 0:
                merged_idx.extend(idx)
            else:
                merged_idx.extend(i + base_v for i in idx)

        mesh_name = slug_malla(cid, ename)
        side, name_la, name_es = traducir_nombre(ename, ta2)
        parent_id = partof_parent.get(cid) or isa_parent.get(cid) or ""

        sistemas_mallas[sistema].append({
            "cid": cid,
            "name_en": ename,
            "mesh_name": mesh_name,
            "pos": merged_pos,
            "nor": merged_nor,
            "idx": merged_idx,
        })

        metadata_estructuras.append({
            "id": cid,
            "meshName": mesh_name,
            "nameLa": name_la,
            "nameEs": name_es,
            "nameEn": ename,
            "system": sistema,
            "parentId": parent_id,
            "side": side,
            "source": "bodyparts3d",
            "license": "CC BY 4.0",
            "elementFiles": sorted(fjs_set),
            "descriptionEs": "",
        })

    print("3/4 Escribiendo los 10 archivos GLB por sistema en data/processed/_raw_glb/…")
    resumen_sistemas = {}
    for sistema in MATERIALES_SISTEMA:
        mallas = sistemas_mallas.get(sistema, [])
        out_path = OUT_RAW_GLB / f"{sistema}.glb"
        stats = escribir_glb_sistema(out_path, sistema, mallas)
        resumen_sistemas[sistema] = stats
        print(
            f"  + {sistema:14s}: {stats['nodes']:4d} nodos | "
            f"{stats['vertices']:9,d} vértices | {stats['triangles']:9,d} triángulos | "
            f"{stats['bytes'] / 1e6:6.2f} MB"
        )

    print("4/4 Catalogando órganos de HuBMAP y generando data/processed/metadata.json…")
    hubmap_organos = catalogar_hubmap(ta2)

    OUT_META.parent.mkdir(parents=True, exist_ok=True)
    metadata_doc = {
        "version": "1.0.0",
        "generatedAt": "2026-10-20",
        "contentLicense": "CC BY-SA 4.0",
        "sources": {
            "bodyparts3d": {
                "name": "BodyParts3D v4.0",
                "author": "The Database Center for Life Science (DBCLS)",
                "license": "CC BY 4.0",
                "url": "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html",
                "attribution": "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
            },
            "hubmap": {
                "name": "HuBMAP CCF 3D Reference Object Library",
                "author": "HuBMAP / Human Reference Atlas",
                "license": "CC BY 4.0",
                "url": "https://humanatlas.io/3d-reference-library",
                "attribution": "Browne, Schlehlein, Herr II, Quardokus, Bueckle, Börner. 2024. HuBMAP CCF 3D Reference Object Library (CC BY 4.0)",
            },
        },
        "systems": [
            {
                "id": s,
                "glbFile": f"{s}.glb",
                "structuresCount": resumen_sistemas[s]["nodes"],
                "vertices": resumen_sistemas[s]["vertices"],
                "triangles": resumen_sistemas[s]["triangles"],
            }
            for s in MATERIALES_SISTEMA
        ],
        "structuresCount": len(metadata_estructuras),
        "structures": metadata_estructuras,
        "hubmapReferenceOrgansCount": len(hubmap_organos),
        "hubmapReferenceOrgans": hubmap_organos,
    }
    OUT_META.write_text(json.dumps(metadata_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    dt_sec = time.time() - t0
    print(f"✓ Listo en {dt_sec:.1f}s: {len(metadata_estructuras)} estructuras FMA y {len(hubmap_organos)} órganos HuBMAP en {OUT_META.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
