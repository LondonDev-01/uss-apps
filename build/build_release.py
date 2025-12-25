#!/usr/bin/env python3
"""Script para generar un único ejecutable versionado.

Funcionamiento:
- Lee la versión actual desde `../VERSION` (formato MAJOR.MINOR)
- Incrementa MINOR: si MINOR==9 -> MAJOR+=1, MINOR=0
- Ejecuta PyInstaller para crear un binario --onefile (Linux runner por defecto)
- Limpia `dist/` dejando solamente el ejecutable nuevo nombrado `UniHorarioUSS_v{MAJOR}.{MINOR}`

Nota: Para generar builds Windows/Mac se deben usar runners/hosts correspondientes (GitHub Actions puede hacerlo).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / 'VERSION'
DIST = ROOT / 'dist'
LAUNCHER = ROOT / 'launcher_desktop.py'

def read_version():
    if not VERSION_FILE.exists():
        return 1, 0
    s = VERSION_FILE.read_text().strip()
    parts = s.split('.')
    return int(parts[0]), int(parts[1])

def write_version(major, minor):
    VERSION_FILE.write_text(f"{major}.{minor}\n")

def increment_version(major, minor):
    if minor >= 9:
        return major + 1, 0
    return major, minor + 1

def build_linux(out_name: str):
    # Requiere pyinstaller instalado
    cmd = [sys.executable, '-m', 'PyInstaller', '--onefile', '--name', out_name, str(LAUNCHER)]
    print('Ejecutando:', ' '.join(cmd))
    subprocess.check_call(cmd)

def clean_and_move(out_name: str):
    if DIST.exists():
        for p in DIST.iterdir():
            try:
                if p.is_file():
                    p.unlink()
                else:
                    # remove dir
                    import shutil
                    shutil.rmtree(p)
            except Exception:
                pass
    DIST.mkdir(parents=True, exist_ok=True)
    # PyInstaller coloca el binario en 'dist/{out_name}'
    built = Path('dist') / out_name
    if built.exists():
        print(f'Generado: {built}')
    else:
        print('No se encontró el binario esperado en dist/. Revisa PyInstaller output.')

def main():
    major, minor = read_version()
    major, minor = increment_version(major, minor)
    new_version = f"{major}.{minor}"
    out_name = f"UniHorarioUSS_v{new_version}"
    print('Version nueva:', new_version)
    build_linux(out_name)
    clean_and_move(out_name)
    write_version(major, minor)
    print('Build completado:', out_name)

if __name__ == '__main__':
    main()
