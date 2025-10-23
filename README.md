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

## Firebase configuration

The app reads its Firebase credentials from Vite environment variables prefixed with `VITE_FIREBASE_`. When the site is built
through GitHub Actions, these values are injected automatically from repository secrets – keep the following keys up to date
under **Settings → Secrets and variables → Actions**:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

The workflow defined in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) exports the secrets as environment
variables so the Firebase configuration is baked into the production bundle without relying on a checked-in `.env` file.
During local development you can create a `./.env.local` with the same variables if needed – it is ignored by Git.

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
   to the GitHub Pages environment.
3. **Custom domain** – the file [`public/CNAME`](public/CNAME) is bundled automatically so GitHub Pages keeps
   `movies.marcusboberg.se` configured. Confirm that your DNS provider has a CNAME record pointing the `movies` subdomain to
   `YOUR_GITHUB_USERNAME.github.io`. GitHub will provision the TLS certificate after the first deployment.

Once configured, the site will refresh automatically after each merge to `main`.

## Debugging Firebase sync

Open the new debug console from the floating toolbar (terminal icon) to inspect log output directly in the app. All Firebase
initialisation steps and rating synchronisation events are traced there, making it easier to follow pending queue retries and
Firestore activity without opening the browser developer tools. Use the “Rensa” button in the console to clear the history when
needed.

## Deploying to movies.marcusboberg.se (one.com)

1. **Build locally** – run `npm run build` so the latest changes are written to `dist/`.
2. **Prepare the upload folder** – inside `dist/`, ensure you have the following structure:
   ```
   dist/
     index.html
     assets/
       ...generated css/js/image assets
   ```
   Everything inside `dist/` needs to be published to one.com.
3. **Create the subdomain** – in the [one.com control panel](https://www.one.com/admin/), add the `movies` subdomain for `marcusboberg.se` and point it to a new folder (for example `movies`) under your web space. One.com will create the folder automatically if it does not exist.
4. **Upload the build** – connect via SFTP or the one.com file manager and upload the contents of `dist/` into the folder that serves `movies.marcusboberg.se` (e.g. `/movies`). Make sure `index.html` lives directly inside that folder, not nested in an extra subdirectory.
5. **Verify DNS** – if the subdomain is new, confirm that the `movies` DNS record exists in one.com's DNS panel. By default one.com creates an `A` record that points to their web hotel. After propagation (can take up to an hour), browsing to `https://movies.marcusboberg.se` should load the React app.

### Optional: automate uploads from your terminal

Create an SFTP configuration for one.com (replace the placeholders with your credentials) and save it as `~/.ssh/config`:

```
Host onecom
  HostName ssh.one.com
  User your-account@example.com
```

Then run the following from the project root whenever you need to deploy:

```bash
npm run build
sftp onecom <<'SFTP'
cd movies
lcd dist
put -r *
SFTP
```

This will upload only the freshly built assets to the `movies` folder on one.com.

## Data sources

- All film metadata and artwork references live in [`src/movies.json`](src/movies.json), so the UI loads instantly even when offline.
