"""Fase 1: descarga reproducible de las fuentes 3D verificadas.

Fuentes (licencias verificadas el 2026-10-20, ver docs/ATTRIBUTIONS.md):
  - BodyParts3D (DBCLS)         -> data/raw/bodyparts3d/   CC BY 4.0
  - HuBMAP 3D Reference Organs  -> data/raw/hubmap/        CC BY 4.0
  - Z-Anatomy (solo referencia) -> data/raw/z-anatomy/     CC BY-SA 4.0
    (no se descargan sus mallas: incluyen material NC; ver D-004)

Uso:
  python scripts/fase1_descargar.py --dry-run   # lista archivos y tamaños
  python scripts/fase1_descargar.py             # descarga
Solo usa la biblioteca estándar. Reanuda: omite archivos ya descargados.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import sys
import time
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
RAW = RAIZ / "data" / "raw"
UA = {"User-Agent": "biologia-fase1/1.0 (proyecto educativo STEMENSOFT)"}
HOY = dt.date.today().isoformat()

BP3D_BASE = "https://dbarchive.biosciencedbc.jp"
BP3D_ARCHIVOS = [
    "/en/bodyparts3d/lic.html",
    "/en/bodyparts3d/download.html",
    "/data/bodyparts3d/LATEST/README_e.html",
    "/data/bodyparts3d/LATEST/isa_parts_list_e.txt",
    "/data/bodyparts3d/LATEST/partof_parts_list_e.txt",
    "/data/bodyparts3d/LATEST/partof_inclusion_relation_list.txt",
    "/data/bodyparts3d/LATEST/isa_inclusion_relation_list.txt",
    "/data/bodyparts3d/LATEST/isa_element_parts.txt",
    "/data/bodyparts3d/LATEST/partof_element_parts.txt",
    "/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip",
    "/data/bodyparts3d/LATEST/partof_BP3D_4.0_obj_99.zip",
]

ZA_BASE = "https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/HEAD"
ZA_ARCHIVOS = ["License.txt", "Readme.md", "TA2.csv"]

HUBMAP_CATALOGO = "https://lod.humanatlas.io/ref-organ"


def get_json(url: str):
    req = urllib.request.Request(url, headers={**UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def tamano(url: str) -> int:
    req = urllib.request.Request(url, headers=UA, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return int(r.headers.get("Content-Length") or 0)
    except Exception:
        return 0


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def descargar(url: str, destino: Path) -> None:
    if destino.exists() and destino.stat().st_size > 0:
        print(f"  = ya existe {destino.relative_to(RAIZ)}")
        return
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(destino.suffix + ".part")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        hecho = 0
        for bloque in iter(lambda: r.read(1 << 20), b""):
            f.write(bloque)
            hecho += len(bloque)
            if total > 5 << 20:
                print(f"\r  ↓ {destino.name}: {hecho >> 20}/{total >> 20} MB", end="")
        if total > 5 << 20:
            print()
    for intento in range(10):
        try:
            tmp.replace(destino)
            break
        except PermissionError:
            if intento == 9:
                raise
            time.sleep(0.5 * (intento + 1))
    print(f"  + {destino.relative_to(RAIZ)}")


def plan_hubmap() -> list[dict]:
    """Devuelve [{organo, version, url, archivo, licencia, cita, doi}] (GLB + crosswalk)."""
    cat = get_json(HUBMAP_CATALOGO)
    organos = [n["title"] for n in cat["@graph"] if n.get("@type") == "Catalog"]
    items = []
    for org in organos:
        try:
            meta = get_json(f"{HUBMAP_CATALOGO}/{org}/latest")
        except Exception as e:  # sin versión publicada
            print(f"  ! {org}: {e}", file=sys.stderr)
            continue
        raw = meta.get("was_derived_from", {})
        lic = f"{meta.get('license', '')} {raw.get('license', '')}"
        if "creativecommons.org/licenses/by/4.0" not in lic or any(
                x in lic.upper() for x in ("-NC", "BY-NC", "-ND", "BY-ND")):
            print(f"  ! {org}: licencia no aceptada ({lic.strip()}), se omite", file=sys.stderr)
            continue
        for d in raw.get("distributions", []):
            url = d.get("downloadUrl", "")
            if url.endswith((".glb", ".csv")):
                items.append({
                    "organo": org,
                    "version": meta.get("version", ""),
                    "url": url,
                    "archivo": f"{org}/{url.rsplit('/', 1)[-1]}",
                    "licencia": meta.get("license", ""),
                    "cita": raw.get("citation", ""),
                    "doi": raw.get("doi", ""),
                })
    return items


def escribir_source(carpeta: Path, recurso: str, url: str, version: str,
                    licencia: str, copia_lic: str, extra: list[str]) -> None:
    lineas = [
        f"Recurso: {recurso}",
        f"URL de origen: {url}",
        f"Versión: {version}",
        f"Fecha de descarga: {HOY}",
        f"Licencia (nombre y URL): {licencia}",
        f"Copia de la licencia guardada en: {copia_lic}",
        "SHA-256 de la descarga:",
    ]
    for f in sorted(p for p in carpeta.rglob("*") if p.is_file()
                    and p.name not in ("SOURCE.txt",) and not p.name.endswith(".part")):
        lineas.append(f"  {sha256(f)}  {f.relative_to(carpeta).as_posix()}  ({f.stat().st_size} bytes)")
    lineas += ["", *extra]
    (carpeta / "SOURCE.txt").write_text("\n".join(lineas) + "\n", encoding="utf-8")
    print(f"  ✓ {(carpeta / 'SOURCE.txt').relative_to(RAIZ)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print("Consultando catálogo HuBMAP…")
    hub = plan_hubmap()

    tareas = (
        [(BP3D_BASE + p, RAW / "bodyparts3d" / p.rsplit("/", 1)[-1]) for p in BP3D_ARCHIVOS]
        + [(f"{ZA_BASE}/{n}", RAW / "z-anatomy" / n) for n in ZA_ARCHIVOS]
        + [(i["url"], RAW / "hubmap" / i["archivo"]) for i in hub]
    )

    if args.dry_run:
        total = 0
        for url, dest in tareas:
            t = tamano(url)
            total += t
            print(f"{t / 1e6:9.2f} MB  {dest.relative_to(RAIZ).as_posix()}")
        print(f"{total / 1e6:9.2f} MB  TOTAL ({len(tareas)} archivos)")
        return

    for url, dest in tareas:
        descargar(url, dest)

    # Copias de licencia (nombre LICENSE* para que se versionen)
    bp = RAW / "bodyparts3d"
    (bp / "LICENSE-lic.html").write_bytes((bp / "lic.html").read_bytes())
    za = RAW / "z-anatomy"
    (za / "LICENSE-License.txt").write_bytes((za / "License.txt").read_bytes())

    escribir_source(
        bp, "BodyParts3D (Database Center for Life Science, DBCLS)",
        "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html",
        "BP3D 4.0 (LATEST, licencia actualizada 2025-02-27)",
        "CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/legalcode.en",
        "LICENSE-lic.html",
        ['Atribución exigida: "BodyParts3D, © The Database Center for Life Science '
         'licensed under CC Attribution 4.0 International".'],
    )
    escribir_source(
        za, "Z-Anatomy — Models-of-human-anatomy (solo metadatos de referencia)",
        "https://github.com/Z-Anatomy/Models-of-human-anatomy",
        "rama por defecto (HEAD) a la fecha de descarga",
        "CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/",
        "LICENSE-License.txt",
        ["NO se descargan las mallas (Z-Anatomy.zip): incluyen material CC BY-NC y CC BY-NC-SA",
         "y modelos sin licencia explícita. Ver docs/DECISIONES.md D-004.",
         "TA2.csv: tabla completa de Terminologia Anatomica 2 con traducciones. Solo consulta;",
         "no redistribuir la tabla completa (ver PLAN_PROYECTO 1.4)."],
    )

    hb = RAW / "hubmap"
    vistos: dict[str, dict] = {}
    for i in hub:
        vistos.setdefault(i["organo"], i)
    (hb / "LICENSE-CC-BY-4.0.txt").write_text(
        "Los 3D Reference Organs del HuBMAP Human Reference Atlas se publican bajo\n"
        "Creative Commons Attribution 4.0 International (CC BY 4.0)\n"
        "https://creativecommons.org/licenses/by/4.0/\n\n"
        f"Evidencia: campo \"license\" de los metadatos oficiales {HUBMAP_CATALOGO}/<organo>/latest\n"
        f"(consultado el {HOY}). Ver también hubmap/metadatos/*.json.\n", encoding="utf-8")
    meta_dir = hb / "metadatos"
    meta_dir.mkdir(exist_ok=True)
    for org in vistos:
        destino = meta_dir / f"{org}.json"
        if not destino.exists():
            destino.write_text(json.dumps(get_json(f"{HUBMAP_CATALOGO}/{org}/latest"),
                                          ensure_ascii=False, indent=2), encoding="utf-8")
    citas = [f"- {o} ({v['version']}): {v['cita']}" for o, v in sorted(vistos.items())]
    escribir_source(
        hb, "HuBMAP Human Reference Atlas — 3D Reference Object Library",
        HUBMAP_CATALOGO, "última versión de cada órgano (ver lista)",
        "CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/",
        "LICENSE-CC-BY-4.0.txt",
        ["Cita general: Browne, Schlehlein, Herr II, Quardokus, Bueckle, Börner. 2024.",
         '"HuBMAP CCF 3D Reference Object Library." https://humanatlas.io/3d-reference-library', "",
         "Citas por órgano:", *citas],
    )

    # Catálogo de fuentes
    meta = RAIZ / "data" / "metadata" / "sources.csv"
    with meta.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source_id", "recurso", "subconjunto", "version", "licencia", "url",
                    "ruta_local", "uso", "fecha_descarga"])
        w.writerow(["S02", "BodyParts3D", "isa_BP3D_4.0_obj_99", "4.0", "CC-BY-4.0",
                    BP3D_BASE + BP3D_ARCHIVOS[-2], "data/raw/bodyparts3d/isa_BP3D_4.0_obj_99.zip",
                    "mallas base", HOY])
        w.writerow(["S02", "BodyParts3D", "partof_BP3D_4.0_obj_99", "4.0", "CC-BY-4.0",
                    BP3D_BASE + BP3D_ARCHIVOS[-1], "data/raw/bodyparts3d/partof_BP3D_4.0_obj_99.zip",
                    "mallas base", HOY])
        w.writerow(["S01", "Z-Anatomy", "TA2.csv", "HEAD", "CC-BY-SA-4.0", f"{ZA_BASE}/TA2.csv",
                    "data/raw/z-anatomy/TA2.csv", "referencia de nombres (no redistribuir)", HOY])
        for i in hub:
            if i["url"].endswith(".glb"):
                w.writerow(["S03", "HuBMAP 3D Reference Organs", i["organo"], i["version"],
                            "CC-BY-4.0", i["url"], f"data/raw/hubmap/{i['archivo']}",
                            "órganos complementarios", HOY])
    print(f"  ✓ {meta.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
