# Cómo configurar el Excel de descarga

## ¿Dónde se deja?

Hay un directorio en la raíz del repositorio llamado `excels/`. La idea es dejar ahí únicamente un archivo Excel, que será el que esté disponible para descargar.

> [!WARNING]
> El directorio `excels/` debe tener únicamente un archivo.

El despliegue en Vercel usa como directorio raíz `frontend/`, por lo que no detecta lo que está en `excels/` (al ser un directorio externo). En cambio, revisa:

```bash
frontend/public/excels/ # Desde la raíz del repositorio
```

Ese es el directorio que contiene el Excel que finalmente se va a hacer público. Para facilitar la tarea de copiar el Excel final desde `excels/` hacia `frontend/public/excels/` (donde queda el archivo público y final), se crearon scripts que hacen todo el proceso de copiar, renombrar en el nuevo directorio y dejar todo listo para pushear.

## Scripts

Son únicamente 2 scripts: uno en Python y otro en Bash. Se usan para el cambio de excels.

> [!WARNING]
> El script de Bash no se encuentra funcionando en estos momentos, por lo que se recomienda usar únicamente el script de Python.
