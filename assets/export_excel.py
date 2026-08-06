from pathlib import Path
import shutil

excels = Path("excels")
destino = Path("frontend/public/excels/horarios.xlsx")

archivos = [f for f in excels.iterdir() if f.is_file()]

if len(archivos) == 1:
    shutil.copy(archivos[0], destino)
else:
    print("Muchos archivos")
