# Farmers Agency Tracker — Deploy Guide

## Running Locally (Dev)

```bash
# Terminal 1 — backend (port 3001)
npm install
npm run dev

# Terminal 2 — frontend (port 5173, hot reload)
cd client
npm install
npm run dev
```

Open http://localhost:5173

---

## Running in Production (single process)

```bash
npm install
npm run build        # builds client/dist
node server.js       # serves everything on port 3001
```

Open http://localhost:3001

---

## Deploy to Railway (easiest, free tier)

1. Push to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "init"
   gh repo create farmers-tracker --public --push
   ```

2. Go to railway.app → New Project → Deploy from GitHub
3. Select your repo
4. Railway auto-detects Node.js and sets PORT
5. Add a start command in settings: `npm run build && node server.js`
6. Done — share the Railway URL with your team

**Note:** Railway's free tier sleeps after inactivity. Upgrade to Hobby ($5/mo) to keep it always on.

---

## Deploy to Render (free, always on with paid plan)

1. Push code to GitHub (same as above)
2. render.com → New → Web Service → Connect repo
3. Build Command: `npm install && npm run build`
4. Start Command: `node server.js`
5. Set Environment Variable: `NODE_ENV=production`
6. Deploy

---

## Deploy to a VPS / DigitalOcean Droplet ($6/mo)

```bash
# On your server
git clone <your-repo-url> farmers-tracker
cd farmers-tracker
npm install
npm run build

# Install PM2 to keep it running
npm install -g pm2
pm2 start server.js --name farmers-tracker
pm2 save
pm2 startup

# (Optional) Nginx reverse proxy on port 80
# sudo apt install nginx
# Configure /etc/nginx/sites-available/default to proxy_pass http://localhost:3001
```

---

## Data Persistence

Data is stored in `data.json` in the project root. Back this file up regularly.

For the VPS approach, set up a cron backup:
```bash
# crontab -e
0 2 * * * cp /path/to/farmers-tracker/data.json /backups/data-$(date +%Y%m%d).json
```
