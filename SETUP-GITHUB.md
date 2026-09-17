# Cómo publicar este proyecto en GitHub (repo privado)

Hacé esto **una sola vez** desde tu PC (o desde GitHub.com). Después, en
escritorio y laptop solo usás `git pull`.

## Opción A — Desde la web (más simple)

1. Entrá a https://github.com/new
2. Owner: tu usuario u organización (`benicioalonso-afa`, etc.)
3. Nombre sugerido: `tribunal-desktop`
4. Visibilidad: **Private**
5. **No** marques “Add a README” (ya tenemos archivos)
6. Create repository
7. En la carpeta del proyecto:

```bash
cd tribunal-desktop
git remote add origin https://github.com/TU_USUARIO/tribunal-desktop.git
git branch -M main
git push -u origin main
```

## Opción B — Con GitHub CLI

```bash
cd tribunal-desktop
gh repo create tribunal-desktop --private --source=. --remote=origin --push
```

## En la otra máquina

```bash
git clone https://github.com/TU_USUARIO/tribunal-desktop.git
cd tribunal-desktop
npm install
npm run dev
```

## Día a día (ya no hace falta ZIP)

En la máquina donde modificás:

```bash
git add -A
git commit -m "Descripción del cambio"
git push
```

En la otra:

```bash
git pull
npm install   # si cambió package-lock.json
npm run dev
```

## Importante

- Este repo es **independiente** de `tribunal-app`. No mezclar historiales.
- No subas `.env` (está en `.gitignore`).
- OneDrive no hace falta si usás este remoto privado.
