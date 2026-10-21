# Cómo verificar y registrar una licencia

Hazlo para **cada** recurso antes de usarlo (Fase 1 en adelante).

## 1. Verificar
1. Abre la página **oficial** del recurso (no un espejo ni un repost).
2. Busca la licencia: "License", "Terms", "Credits" o el archivo `LICENSE` del repositorio.
3. Anota el **nombre exacto y la versión** (por ejemplo, CC BY-SA 4.0, no solo "Creative Commons").
4. Comprueba que permite: uso, modificación y redistribución, sin cláusulas **NC** ni **ND**.
5. Si el recurso mezcla autores o modelos (NIH 3D, Sketchfab), revisa la licencia de **cada** archivo.
6. Si hay dudas o no hay licencia explícita, **no lo uses**.

## 2. Guardar evidencia
- Guarda una copia del texto de licencia, o una captura de pantalla con la URL y la fecha visibles, en `data/raw/<recurso>/LICENSE*`.
- Copia `data/raw/SOURCE.template.txt` a `data/raw/<recurso>/SOURCE.txt` y complétalo.

## 3. Calcular el hash de la descarga (PowerShell)
```powershell
Get-FileHash -Algorithm SHA256 .\data\raw\<recurso>\<archivo>
```
Pega el resultado en `SOURCE.txt`.

## 4. Registrar
1. Añade o actualiza la fila en [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
2. Cambia el estado de "⏳ pendiente" a "✅ verificado" y pon la fecha.
3. Si modificas el recurso, anota las **modificaciones** (la licencia CC BY exige indicar los cambios).

## 5. Obligaciones frecuentes
| Licencia | Debes |
|---|---|
| CC0 / dominio público | Nada obligatorio (se recomienda citar) |
| CC BY | Atribución, enlace a la licencia, indicar cambios |
| CC BY-SA | Lo anterior, y publicar tus derivados con la **misma licencia** |
| Cualquier NC o ND | **No usar** en este proyecto |
