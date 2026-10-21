"""Actualiza data/processed/metadata.json con:
1. Nombres (`nameEs`) y definiciones (`descriptionEs`) 100 % en español para todas las estructuras.
2. Catálogo completo del modelo femenino por sistemas (`femaleSystems` y `femaleStructures`).
3. Traducción al español de todas las subestructuras de los 87 órganos de HuBMAP.
"""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from fase2_construir_glb import cargar_ta2
from traductor_es import generar_descripcion_es, traducir_estructura

RAIZ = Path(__file__).resolve().parents[1]
META_PATH = RAIZ / "data" / "processed" / "metadata.json"
FEM_NODES_PATH = RAIZ / "data" / "processed" / "_female_nodes.json"
FEM_CW_PATH = RAIZ / "data" / "raw" / "hubmap" / "united-female" / "crosswalk.csv"


def limpiar_nombre_nodo_vhf(node_name: str) -> str:
    s = re.sub(r"^VH_F_", "", node_name)
    s = re.sub(r"_L$", " (left)", s)
    s = re.sub(r"_R$", " (right)", s)
    s = s.replace("_", " ")
    return s.strip()


def main() -> None:
    ta2 = cargar_ta2()
    meta = json.loads(META_PATH.read_text(encoding="utf-8"))

    # 1. Traducir nombres de las 1.658 estructuras masculinas (BodyParts3D)
    by_id: dict[str, dict] = {}
    for st in meta["structures"]:
        side, name_la, name_es = traducir_estructura(st["nameEn"], ta2)
        st["side"] = side
        st["nameLa"] = name_la
        st["nameEs"] = name_es
        by_id[st["id"]] = st

    # Generar definiciones en español con referencia al padre traducido
    for st in meta["structures"]:
        parent = by_id.get(st.get("parentId") or "")
        parent_es = parent["nameEs"] if parent else ""
        st["descriptionEs"] = generar_descripcion_es(
            st["nameEs"], st["nameLa"], st["system"], st["side"], parent_es, st["nameEn"]
        )
        st["descriptionSource"] = "STEMENSOFT — redacción educativa propia (CC BY-SA 4.0)"

    # 2. Integrar modelo femenino completo (10 sistemas extraídos de united-female)
    cw_map: dict[str, tuple[str, str]] = {}
    if FEM_CW_PATH.exists():
        with FEM_CW_PATH.open("r", encoding="utf-8", errors="replace") as f:
            for row in csv.DictReader(f):
                nn = (row.get("node_name") or "").strip()
                ont = (row.get("OntologyID") or "").strip()
                lbl = (row.get("label") or "").strip()
                if nn and nn != "/":
                    cw_map[nn] = (ont, lbl)

    if FEM_NODES_PATH.exists():
        fem_data = json.loads(FEM_NODES_PATH.read_text(encoding="utf-8"))
        fem_systems_map = fem_data.get("systems", {})
        meta["femaleSystems"] = list(fem_systems_map.values())

        fem_structures = []
        seen_ids = set()
        for item in fem_data.get("nodes", []):
            node_name = item["nodeName"]
            if node_name in seen_ids:
                continue
            seen_ids.add(node_name)
            sys_id = item["system"]
            ont_id, label_en = cw_map.get(node_name, ("", ""))
            if not label_en:
                label_en = limpiar_nombre_nodo_vhf(node_name)
            # Si el nodo termina en _L o _R y el label no indica lado, añadirlo
            if node_name.endswith("_L") and "left" not in label_en.lower():
                label_en = f"Left {label_en}"
            elif node_name.endswith("_R") and "right" not in label_en.lower():
                label_en = f"Right {label_en}"

            side, name_la, name_es = traducir_estructura(label_en, ta2)
            desc_es = generar_descripcion_es(name_es, name_la, sys_id, side, "Cuerpo femenino (HuBMAP)")
            fem_structures.append({
                "id": node_name,
                "ontologyId": ont_id or node_name,
                "meshName": node_name,
                "nameLa": name_la,
                "nameEs": name_es,
                "nameEn": label_en,
                "system": sys_id,
                "parentId": "",
                "side": side,
                "source": "hubmap",
                "license": "CC BY 4.0",
                "descriptionEs": desc_es,
            })

        meta["femaleStructuresCount"] = len(fem_structures)
        meta["femaleStructures"] = fem_structures
        FEM_NODES_PATH.unlink(missing_ok=True)

    for st in meta.get("femaleStructures", []):
        side, name_la, name_es = traducir_estructura(st["nameEn"], ta2)
        st["side"] = side
        st["nameLa"] = name_la
        st["nameEs"] = name_es
        st["descriptionEs"] = generar_descripcion_es(
            name_es, name_la, st["system"], side, "Cuerpo femenino (HuBMAP)", st["nameEn"]
        )
        st["descriptionSource"] = "STEMENSOFT — redacción educativa propia (CC BY-SA 4.0)"

    # 3. Traducir todas las subestructuras de los 87 órganos de HuBMAP
    for org in meta.get("hubmapReferenceOrgans", []):
        _, _, org_es = traducir_estructura(org["organ"].replace("-", " "), ta2)
        org["nameEs"] = org_es
        for n in org.get("nodes", []):
            en_lbl = n.get("nameEn") or n.get("nodeName") or ""
            if n["nodeName"].endswith("_L") and "left" not in en_lbl.lower():
                en_lbl = f"Left {en_lbl}"
            elif n["nodeName"].endswith("_R") and "right" not in en_lbl.lower():
                en_lbl = f"Right {en_lbl}"
            side, la, es = traducir_estructura(en_lbl, ta2)
            n["nameLa"] = la
            n["nameEs"] = es
            n["descriptionEs"] = generar_descripcion_es(es, la, org["system"], side, org_es, en_lbl)

    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"✓ metadata.json actualizado: {len(meta['structures'])} estructuras masculinas + "
        f"{meta.get('femaleStructuresCount', 0)} estructuras femeninas + "
        f"{len(meta.get('hubmapReferenceOrgans', []))} órganos HuBMAP (100 % en español)."
    )


if __name__ == "__main__":
    main()
