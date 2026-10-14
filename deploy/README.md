# Deploying Tethr

Push to `main` → [deploy.yml](../.github/workflows/deploy.yml) runs CI, builds `linux/arm64` images
on GitHub's ARM runners, pushes them to GHCR as `sha-<commit>`, and SSHes into the VM, where
the server's shared `deploy.sh` pulls that tag, waits for the health checks, and rolls back if they fail.

This folder holds **Tethr's files only**. The server itself (deploy user, `deploy.sh`, certbot,
the Nginx catch-all, the port registry) is set up once from the server config, which is kept
separately from this repo; do that first. Tethr's entry there: app `tethr`, ports 3000 and 8000.

| Server path | What | Owner / mode |
|---|---|---|
| `/opt/apps/tethr/compose.yaml` | Live compose file, sent by CI on every deploy | `deploy` |
| `/opt/apps/tethr/.env` | `TAG=sha-…` of the running version (`.prev` files hold the one before) | `deploy` |
| `/opt/apps/tethr/api.env`, `web.env` | Runtime secrets, written by hand on the server, never in Git | `root:deploy 640` |
| `/etc/nginx/sites-available/tethr.conf`, `/etc/nginx/snippets/tethr-tls.conf` | Reverse proxy, downloaded from this repo | `root` |
| `/etc/letsencrypt/live/tethr/` | HTTPS certificate for all three hostnames, renewed by certbot's timer | `root` |

| Hostname | Serves |
|---|---|
| `tethr.aswin-ambalathara.space` | Public homepage, `/privacy` and `/terms` (same web container; other paths redirect to `app.`) |
| `app.tethr.aswin-ambalathara.space` | Web app (container port 3000); `/api/v1` is proxied to the API by Next.js |
| `api.tethr.aswin-ambalathara.space` | API and MCP server (container port 8000); MCP clients connect to `https://api.tethr.aswin-ambalathara.space/sse` |

## DNS

At the domain's DNS provider:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `tethr` | `80.225.251.247` | 300 |
| A | `app.tethr` | `80.225.251.247` | 300 |
| A | `api.tethr` | `80.225.251.247` | 300 |

Check from any machine: `nslookup app.tethr.aswin-ambalathara.space 1.1.1.1` should answer `80.225.251.247`.
Clerk's production records (step "Clerk production" below) are added here too.

## One-time Tethr setup on the server

Run on the VM as the `ubuntu` user, after the server-wide setup. Step 4 downloads from `main`, so
merge this folder first.

**1. App folder and secrets**

```bash
sudo install -d -o deploy -g deploy -m 750 /opt/apps/tethr
cd /opt/apps/tethr
sudo install -m 640 -o root -g deploy /dev/null api.env
sudo install -m 640 -o root -g deploy /dev/null web.env
sudoedit api.env    # paste the contents of your local backend/.env (production values)
sudoedit web.env    # CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY from frontend/.env
```

Locally, `backend/.env` and `frontend/.env` hold the production values and `.env.local` the
development ones (it overrides `.env`); none of them is committed or copied into an image.
The production values that differ from development:

```ini
ENVIRONMENT=production
DEBUG=False
DEV_MOCK_AUTH=False
DATABASE_NAME=tethr_prod       # same Atlas cluster as development, separate database
TOKEN_ENCRYPTION_KEY=...       # its own random key, never the development one
BACKEND_URL=https://api.tethr.aswin-ambalathara.space
FRONTEND_URL=https://app.tethr.aswin-ambalathara.space
CORS_ORIGINS=["https://app.tethr.aswin-ambalathara.space"]
MCP_SSE_URL=https://api.tethr.aswin-ambalathara.space/sse
GOOGLE_REDIRECT_URI=https://app.tethr.aswin-ambalathara.space/settings
# From the Clerk instance whose keys the web app uses
CLERK_ISSUER=https://clerk.tethr.aswin-ambalathara.space
CLERK_JWKS_URL=https://clerk.tethr.aswin-ambalathara.space/.well-known/jwks.json
```

MongoDB Atlas must allow connections from `80.225.251.247` (Atlas → Network Access).

**2. Deploy key**, pinned so it can only deploy Tethr. On your own machine, not the server:

```bash
ssh-keygen -t ed25519 -N "" -C "tethr-github-actions" -f tethr-deploy
```

On the server:

```bash
echo 'restrict,command="/opt/deploy/deploy.sh --only tethr" <contents of tethr-deploy.pub>' |
  sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null
```

The private key `tethr-deploy` goes into GitHub (below); delete the local copy afterwards.

**3. HTTPS certificate** (needs the DNS records resolving; the server's catch-all answers the challenge)

```bash
sudo certbot certonly --webroot -w /var/www/html --cert-name tethr \
  --deploy-hook "systemctl reload nginx" \
  -d tethr.aswin-ambalathara.space -d app.tethr.aswin-ambalathara.space \
  -d api.tethr.aswin-ambalathara.space
sudo certbot renew --dry-run
```

**4. Nginx**

```bash
base=https://raw.githubusercontent.com/aswinambalathara/Task-Docs/main/deploy/nginx
sudo curl -fsSL -o /etc/nginx/snippets/tethr-tls.conf "$base/tethr-tls.conf"
sudo curl -fsSL -o /etc/nginx/sites-available/tethr.conf "$base/tethr.conf"
sudo ln -s /etc/nginx/sites-available/tethr.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Clerk production

Clerk's Free plan includes a production instance. In the Clerk dashboard, create the production
instance with the domain `tethr.aswin-ambalathara.space`, add the CNAME records it lists (such as
`clerk.tethr`) at the DNS provider, and wait for Clerk to verify them. For Google sign-in, Clerk's
production instance needs your own Google OAuth client; Clerk shows the redirect URI to register.

Then swap the keys: `pk_live_…` into the `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` variable and `web.env`,
`sk_live_…` into `web.env`, the production issuer/JWKS URLs into `api.env`, and run the Deploy
workflow manually with no commit so the web image is rebuilt with the new key.

## Google OAuth (Docs integration)

In the Google Cloud console, add `https://app.tethr.aswin-ambalathara.space/settings` as an
authorized redirect URI. On the consent screen, the home page is `https://tethr.aswin-ambalathara.space`,
the privacy policy `/privacy` and the terms of service `/terms` on that host, and the authorized
domain is `aswin-ambalathara.space`. Leaving the OAuth consent screen in **Testing** makes Google expire refresh
tokens after 7 days, which breaks scheduled syncs; for private use, set it to **In production**
without verification (you will see an "unverified app" warning when connecting, which is expected).

## GitHub settings

**Settings → Environments → New environment `production`**, deployment branches limited to `main`:

| Kind | Name | Value |
|---|---|---|
| Secret | `DEPLOY_SSH_KEY` | Contents of the private key `tethr-deploy` |
| Secret | `DEPLOY_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 80.225.251.247`, after checking its fingerprint matches `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server |
| Variable | `DEPLOY_HOST` | `80.225.251.247` |
| Variable | `HEALTH_URL` | `https://api.tethr.aswin-ambalathara.space/health` |

**Settings → Secrets and variables → Actions → Variables** (repository level; baked into the web
image at build time, so changing one needs a manual "Run workflow" with no commit to rebuild):

| Variable | Value now |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.tethr.aswin-ambalathara.space` |
| `NEXT_PUBLIC_MCP_SSE_URL` | `https://api.tethr.aswin-ambalathara.space/sse` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` (or `pk_test_…` until Clerk production is verified) |

After the first build, open each package (`tethr-api`, `tethr-web`) under your GitHub profile →
Packages → Package settings and set its visibility to **Public**, so the VM can pull without a
registry login. If the first deploy failed to pull before that, re-run the failed job.

## Day to day

- **Deploy:** merge or push to `main`.
- **Roll back:** Actions → Deploy → Run workflow, with the full SHA of an earlier commit. It
  redeploys that commit's images and compose file without rebuilding.
- **On the server:** `sudo -u deploy /opt/deploy/deploy.sh status tethr`, or `rollback tethr` to
  return to the previous version.
- **Logs:** `sudo docker logs -f tethr-api-1` (or `tethr-web-1`).
