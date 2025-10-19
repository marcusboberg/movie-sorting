# Movie Sorting

A Vite + React experience for browsing a curated stack of films and quickly giving each title a score.

## Getting started

1. Install dependencies
   ```bash
   npm install
   ```
2. Start the development server
   ```bash
   npm run dev
   ```

## Build for production

```bash
npm run build
```

The compiled site is emitted to `dist/` and is ready to be uploaded to any static web host.

## Deploying to movies.marcusboberg.se with GitHub Pages

The repository ships with a GitHub Actions workflow that builds the site and publishes it to GitHub Pages, keeping the custom
domain `movies.marcusboberg.se` online without any manual uploads.

1. **Enable GitHub Pages** – in _Settings → Pages_, choose "GitHub Actions" as the deployment source. The workflow in
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) will now be allowed to publish.
2. **Commit and push** – any push to `main` (or a manual workflow dispatch) runs the build and deploys the contents of `dist/`
   to the GitHub Pages environment. Since the Pages site is generated during the workflow run, there is no need to keep a
   prebuilt `docs/` folder in the repository anymore.
3. **Custom domain** – the file [`public/CNAME`](public/CNAME) is bundled automatically so GitHub Pages keeps
   `movies.marcusboberg.se` configured. Confirm that your DNS provider has a CNAME record pointing the `movies` subdomain to
   `YOUR_GITHUB_USERNAME.github.io`. GitHub will provision the TLS certificate after the first deployment.

Once configured, the site will refresh automatically after each merge to `main`.

## Data sources

- All film metadata and artwork references live in [`src/movies.json`](src/movies.json), so the UI loads instantly even when offline.
