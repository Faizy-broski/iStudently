# Jahbadh Lab: hosting the experiment files on lab.istudent.ly

The client delivered ~1,800 self-contained HTML experiments (physics, chemistry, biology, Earth and space, 3D models, simulations, "how things work", a lab designer). They are about 1.5 GB unpacked (about 580 MB compressed in transit), so they are **not in git**. They live in one static folder on the server, served on their own domain, **https://lab.istudent.ly**. The repo only has the code and the catalog generator.

- Web only (decided 2026-11-27): plugin `jahbadh_lab` (Settings > Plugins), pages `/{admin|teacher|student|parent}/resources/jahbadh-lab` (catalog) and `/.../[code]` (player, an iframe pointing at lab.istudent.ly). Users sign in to the platform as usual.
- The app does not show it (`mobile/src/features/portal/web-only-plugins.ts`).
- No backend, no database and no progress tracking (the labs post `{source:'jahbadh-lab', event, ...}` messages to the page; the player only reads the `lang` one).
- **Access:** the platform menu is limited to schools with the plugin on, but the files themselves are public: anyone who has a lab.istudent.ly link (or opens https://lab.istudent.ly, the client's own launcher) can use them without signing in.

## Files

```
/var/www/jahbadh-lab/          (any folder; the name is up to you)
  catalog.json                 generated, see below
  P-E-001.html … TOOL-001.html one file per experiment (1,800 files)
  index.html                   the lab's own launcher (also usable on its own at /lab/index.html)
```

`catalog.json` is the only file the platform needs besides the experiments. Its shape is fixed (`packages/shared-types/src/jahbadh-lab.ts`):
`{version:1, generated_at, count, subjects[], groups[], levels[], experiments[{code, ar, en, fr, subject, group, level?, kind}]}`. An experiment opens at `https://lab.istudent.ly/<code>.html?lang=ar|en|fr`.

## One-time setup

1. Unzip **both** archives into the **same** folder (they each contain a `lab/` directory; the 1,800 files must end up side by side):
   ```sh
   sudo mkdir -p /var/www/jahbadh-lab
   unzip -q jahbadh-EXP-part1-physics-index.zip -d /tmp/lab1
   unzip -q jahbadh-EXP-part2-chem-bio-sims-earth-anatomy-math-newsections.zip -d /tmp/lab2
   sudo cp -R /tmp/lab1/lab/. /var/www/jahbadh-lab/
   sudo cp -R /tmp/lab2/lab/. /var/www/jahbadh-lab/
   ```
   Part 1 contains `index.html` (the launcher that lists all 1,800 experiments with their names and groups); part 2 has none. Check the count: `ls /var/www/jahbadh-lab/*.html | wc -l` should print 1801 (1,800 experiments + `index.html`).
2. Generate the catalog (Node 20+, from the repo root; it only **reads** the HTML as text and never runs it):
   ```sh
   npx tsx packages/shared-utils/scripts/jahbadh-lab-catalog.ts /tmp/lab1/lab /tmp/lab2/lab --out /var/www/jahbadh-lab/catalog.json
   ```
   (Passing the unpacked folders, or the merged folder, both work. With several folders a code found twice is reported and the first folder wins.) The coverage report is printed to stderr: counts per subject, files named from their own text, files with no name (the code is used), files without an index entry, and index entries without a file. For the delivery of 2026-11-24 the report is clean: 1,800 experiments, 11 subjects, 54 groups, 3 stages, every file named by the index.
3. Point the domain at the server and serve the folder (below), then open `https://lab.istudent.ly/catalog.json` and `https://lab.istudent.ly/P-E-001.html` to check.
4. Build and deploy the web (`NEXT_PUBLIC_LAB_BASE_URL` already defaults to `https://lab.istudent.ly`).
5. In the platform: super admin > school > Module access must allow Resources (it does by default), then each school admin turns the plugin **Jahbadh Lab** on under Settings > Plugins.

## DNS and certificate

1. Add a DNS **A record** `lab` for `istudent.ly` pointing at the server's IP (the same VPS is fine).
2. After the nginx block below is in place: `sudo certbot --nginx -d lab.istudent.ly`.

## nginx

A new file such as `/etc/nginx/sites-available/lab.istudent.ly`:

```nginx
server {
    listen 80;                            # certbot adds the 443 block
    server_name lab.istudent.ly;

    root /var/www/jahbadh-lab;
    index index.html;

    gzip on;                              # the HTML is ~850 KB each; gzip cuts it to ~1/3
    gzip_types text/html application/json;
    gzip_min_length 1024;

    # The portal reads the catalog from another domain: without this CORS header the page shows
    # "Could not reach the lab server".
    location = /catalog.json {
        add_header Access-Control-Allow-Origin "https://istudent.ly" always;
        add_header Cache-Control "no-cache" always;
    }

    location / {
        # only the portal may embed the labs; do NOT send X-Frame-Options (it cannot name another domain)
        add_header Content-Security-Policy "frame-ancestors 'self' https://istudent.ly" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri $uri/ =404;
    }
}
```

Then `sudo ln -s /etc/nginx/sites-available/lab.istudent.ly /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`.

If the portal is also reached as `https://www.istudent.ly`, add that origin to `frame-ancestors`, and replace the CORS line with a `map $http_origin` that echoes the allowed origins.

Favourites: the catalog's favourites are kept on istudent.ly, and the star inside an experiment is kept on lab.istudent.ly, so they are two separate lists.

## Refreshing when the client sends new batches

The client delivers the lab in batches (zip files of `lab/*.html`). For each new delivery:

1. Unzip it and copy the files over `/var/www/jahbadh-lab/` (new codes are added, updated files replace the old ones; if the batch has a newer `index.html`, copy that too, since it carries the names).
2. Re-run the catalog command from step 2 above, pointing at the merged folder, then reload the portal page (the catalog is revalidated on every visit, so no deploy is needed).
3. Read the report: files "without an index entry" are named from their own text or by their code. Ask the client for an updated `index.html` if there are many.

## Local development

The web points at `https://lab.istudent.ly` by default, which does not allow `localhost`. To test locally, serve the files yourself and override the address:

```sh
ln -s /path/to/merged/lab frontend/public/lab              # git-ignored
echo 'NEXT_PUBLIC_LAB_BASE_URL=/lab' >> frontend/.env.local
```

Generate `catalog.json` into that folder as in step 2. **Never commit the lab files** (the repo ignores the client's archive folder and `frontend/public/lab`).

## Security notes

- The experiment files are written by the client; the catalog generator treats them as untrusted text (parsed with string/JSON handling only).
- Because they are served from a different domain than the portal, scripts in them cannot read the portal's storage or sign-in session. Keep it that way: never serve them from istudent.ly itself.
- The player embeds them with a sandbox (no top-navigation) and only reads `postMessage` from its own iframe.
- Experiment codes are validated (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) before they are put in a URL.
