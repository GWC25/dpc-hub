# GitHub Setup Instructions

## Quick Start — Push to GitHub in 5 Minutes

### Option 1: Create New Repository (Recommended)

#### Step 1: Create Repository on GitHub
1. Go to https://github.com/new
2. Repository name: `dpc-evidence-hub`
3. Description: "Digital Pedagogy Coach Evidence System — Weston College Group"
4. Public or Private: **Your choice**
5. Do NOT initialize with README (we have one)
6. Click "Create repository"

#### Step 2: Clone Repository to Your Computer
```bash
git clone https://github.com/[your-username]/dpc-evidence-hub.git
cd dpc-evidence-hub
```

#### Step 3: Copy Files
```bash
# Copy all files from the dpc-evidence-hub folder you downloaded
# Into the newly cloned repository folder
# (Should match exactly)
```

Verify structure:
```bash
ls -la
# Should show: README.md, BUILD.md, hub.html, index.html, css/, js/, data/, docs/, .gitignore
```

#### Step 4: Push to GitHub
```bash
git add .
git commit -m "Initial DPC Evidence Hub v3.0 — Complete capture + documentation"
git push origin main
```

**Done!** Your code is now on GitHub.

---

### Option 2: Using GitHub Desktop (Easier for Non-Developers)

1. Download GitHub Desktop from https://desktop.github.com/
2. Sign in with your GitHub account
3. Click **"Create a New Repository on your Hard Drive"**
4. Repository name: `dpc-evidence-hub`
5. Local path: Choose where to save
6. Click **"Create Repository"**
7. Copy all files from downloaded folder into this new folder
8. GitHub Desktop will show all files as "Changes"
9. Click **"Commit to main"** (bottom left)
10. Enter message: "Initial DPC Evidence Hub v3.0"
11. Click **"Publish repository"** (top right)
12. Make it public or private
13. Click **"Publish"**

**Done!** Your code is now on GitHub.

---

### Option 3: GitHub Web Upload (No Git Required)

1. Go to https://github.com/new
2. Create repository `dpc-evidence-hub` (same as above)
3. After creation, click **"uploading an existing file"** link
4. Drag & drop all files from dpc-evidence-hub folder
5. Commit changes

**Done!** Your code is now on GitHub.

---

## Enable GitHub Pages (Make it Live)

Once files are pushed to GitHub:

1. Go to **Settings** tab of your repository
2. Scroll to **Pages** section (left sidebar)
3. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click **Save**
5. Wait 1-2 minutes
6. GitHub will show: "Your site is live at `https://[username].github.io/dpc-evidence-hub/`"

Then access your app at:
```
https://[username].github.io/dpc-evidence-hub/hub.html
```

---

## What You Have

All 15 files organized for GitHub:

```
dpc-evidence-hub/
├── .gitignore
├── README.md
├── BUILD.md
├── hub.html                    ← Main app
├── index.html                  ← Landing page
├── css/
│   └── hub.css                 ← Styles
├── js/
│   ├── webparts.js             ← Form components
│   ├── templates.js            ← Template assembler
│   └── hub.js                  ← App logic
├── data/
│   ├── config.json             ← Configuration
│   └── areas.json              ← Curriculum areas
└── docs/
    ├── SETUP.md
    ├── CONFIG.md
    ├── DATA.md
    └── WEBPARTS.md
```

---

## Testing Locally Before Push

Before pushing to GitHub, test locally:

### Test 1: Direct Open
```
Open hub.html directly in browser
Click "Load Config"
Should load without errors
```

### Test 2: Local Server
```bash
# In the dpc-evidence-hub folder:
python3 -m http.server 8000

# Then visit: http://localhost:8000/hub.html
```

### Test 3: Verify All Files Load
Open DevTools (F12):
- Console: No red errors
- Network: All CSS/JS files load (green status)

---

## After Pushing

### Share with Others
Give them the URL:
```
https://[username].github.io/dpc-evidence-hub/hub.html
```

They can use it immediately (no installation needed).

### Keep Updated
If you make changes locally:
```bash
git add .
git commit -m "Describe what changed"
git push origin main
```

Changes go live in ~30 seconds.

---

## Troubleshooting

**"fatal: not a git repository"**
- Make sure you're in the dpc-evidence-hub folder
- Run: `git status` to verify

**Hub won't load on GitHub Pages**
- Check Settings > Pages is set to `main` branch, `/` folder
- Wait 1-2 minutes for GitHub to deploy
- Hard refresh (Ctrl+Shift+R)

**Files not showing on GitHub**
- Check .gitignore isn't excluding them
- Run `git add -f [filename]` to force add

**Still not working?**
- Open repository on GitHub
- Click "Upload files" button
- Drag & drop all files directly

---

## GitHub Repository Settings (Recommended)

After creating repository, consider:

**Settings > General:**
- ✅ "Automatically delete head branches" — Clean up automatically

**Settings > Pages:**
- ✅ GitHub Pages enabled
- ✅ Main branch / root folder

**Settings > About:**
- ✅ Add description
- ✅ Add topics: `education`, `digital-pedagogy`, `coaching`, `evidence`
- ✅ Add website link (if you have one)

---

## Next Steps

1. **Create GitHub account** (if you don't have one): https://github.com/signup
2. **Create repository** using instructions above
3. **Push code**
4. **Enable GitHub Pages**
5. **Test at** `https://[username].github.io/dpc-evidence-hub/hub.html`
6. **Start using** — the hub is live!

---

## Support

- GitHub Help: https://docs.github.com/
- GitHub Pages Guide: https://pages.github.com/
- Git Basics: https://git-scm.com/book/en/v2/Getting-Started

---

## Questions?

All files are ready to push. Just follow the steps above and you'll have a live, working DPC Evidence Hub accessible from anywhere.

Good luck! 🚀
