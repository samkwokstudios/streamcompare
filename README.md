# StreamCompare — Vercel Deployment

## Project Structure

```
streamcompare-vercel/
├── api/
│   └── chat.js          ← Serverless proxy (hides your API key)
├── public/
│   └── index.html       ← The entire app (single file)
├── package.json
├── vercel.json
└── README.md
```

## How It Works

The app runs entirely in `index.html`. When it needs streaming data, it calls `/api/chat`, which is a Vercel serverless function that forwards the request to the Anthropic API with your API key attached server-side. Your key never touches the browser.

## Deploy to Vercel (5 minutes)

### Step 1: Get an Anthropic API Key
1. Go to https://console.anthropic.com
2. Create an API key
3. Copy it — you'll need it in Step 3

### Step 2: Push to GitHub
1. Create a new GitHub repo (e.g., `streamcompare`)
2. Push this entire folder:
   ```bash
   cd streamcompare-vercel
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/streamcompare.git
   git push -u origin main
   ```

### Step 3: Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **"New Project"** → Import your `streamcompare` repo
3. **Before deploying**, click **"Environment Variables"** and add:
   - **Name:** `ANTHROPIC_API_KEY`  
   - **Value:** your API key from Step 1
4. Click **Deploy**

That's it. Your app will be live at `https://streamcompare.vercel.app` (or whatever name you chose).

## Updating

Just push to GitHub. Vercel auto-deploys on every push to `main`.

## Local Testing

```bash
npm i -g vercel
cd streamcompare-vercel
vercel env add ANTHROPIC_API_KEY  # paste your key when prompted
vercel dev
```

Opens at http://localhost:3000.

## Cost Notes

- **Vercel Hobby (free):** More than enough for personal use
- **Anthropic API:** Pay-per-use. Each comparison/search costs roughly $0.01–0.03 in API credits. Web search tool usage may incur additional costs.
- **Tip:** The app caches results per session so repeat queries don't re-fetch
