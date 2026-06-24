import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';
import logger from 'pino';
import { ModelRegistry } from './model-registry.js';

const log = logger({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export class LocalHudServer {
  private server: http.Server | null = null;
  private dropzoneDir: string;
  private port: number;
  private registry: ModelRegistry;
  private activeModelSymlink = '/opt/camera-ingest/active_model.dxnn';

  constructor(dropzoneDir: string, port = 8080, registry: ModelRegistry) {
    this.dropzoneDir = dropzoneDir;
    this.port = port;
    this.registry = registry;
  }

  public start(): void {
    this.server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname || '';

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Serve API endpoints
      if (pathname === '/api/assets') {
        this.handleGetAssets(res);
        return;
      }

      if (pathname === '/api/search') {
        const query = (parsedUrl.query.q as string || '').toLowerCase();
        this.handleSearchAssets(res, query);
        return;
      }

      if (pathname === '/api/live') {
        this.handleLiveFeedStub(res);
        return;
      }

      if (pathname === '/api/models') {
        this.handleGetModels(res);
        return;
      }

      if (pathname === '/api/models/switch') {
        const modelId = parsedUrl.query.id as string || '';
        this.handleSwitchModel(res, modelId);
        return;
      }

      // Serve static HUD Gallery HTML UI
      if (pathname === '/' || pathname === '/index.html') {
        this.serveGalleryUI(res);
        return;
      }

      // Serve individual media files for local preview
      if (pathname.startsWith('/media/')) {
        this.serveMediaFile(res, pathname);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    this.server.listen(this.port, () => {
      log.info(`[LOCAL_HUD_SERVER] Web Gallery UI and Search API live on http://localhost:${this.port}`);
    });
  }

  private handleGetAssets(res: http.ServerResponse): void {
    const assets = this.getIngestedAssets();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(assets));
  }

  private handleSearchAssets(res: http.ServerResponse, query: string): void {
    const assets = this.getIngestedAssets();
    const filtered = assets.filter(asset => {
      return (
        asset.name.toLowerCase().includes(query) ||
        asset.tags.some((tag: string) => tag.toLowerCase().includes(query))
      );
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
  }

  private handleLiveFeedStub(res: http.ServerResponse): void {
    const activeModel = this.registry.getActiveModel();
    const liveStatus = {
      stream_active: true,
      codec: 'H.264',
      fps: 30,
      resolution: '1280x720',
      active_brain: activeModel.name,
      active_brain_type: activeModel.type,
      latency_ms: 120,
      endpoint: `rtsp://alpon-edge.local:${this.port}/live`
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(liveStatus));
  }

  private handleGetModels(res: http.ServerResponse): void {
    const data = {
      active_model_id: this.registry.getActiveModel().id,
      models: this.registry.getModelsList()
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private handleSwitchModel(res: http.ServerResponse, modelId: string): void {
    const success = this.registry.setActiveModel(modelId);
    if (success) {
      const active = this.registry.getActiveModel();
      log.info(`[LOCAL_HUD_SERVER] Switched active model to: ${active.name}`);
      
      // Update the active model symlink on the Alpon host OS so the runner automatically loads it
      try {
        if (fs.existsSync(this.activeModelSymlink)) {
          fs.unlinkSync(this.activeModelSymlink);
        }
        // Create directory parent if missing
        const symlinkDir = path.dirname(this.activeModelSymlink);
        if (!fs.existsSync(symlinkDir)) {
          fs.mkdirSync(symlinkDir, { recursive: true });
        }
        // In simulation/development, the files might not exist physically, so we catch errors
        fs.symlinkSync(active.path, this.activeModelSymlink);
        log.info(`[LOCAL_HUD_SERVER] Symlinked ${active.path} -> ${this.activeModelSymlink}`);
      } catch (err: any) {
        log.warn(`[LOCAL_HUD_SERVER] Symlink creation skipped/failed on host environment: ${err.message}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', active_model: active }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Invalid model ID' }));
    }
  }

  private serveMediaFile(res: http.ServerResponse, pathname: string): void {
    const relativeFilePath = pathname.replace('/media/', '');
    const safePath = path.normalize(relativeFilePath).replace(/^(\.\.[\/\\])+/, '');
    const absoluteFilePath = path.join(this.dropzoneDir, 'processed', safePath);

    if (fs.existsSync(absoluteFilePath) && fs.statSync(absoluteFilePath).isFile()) {
      const ext = path.extname(absoluteFilePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.mp4') contentType = 'video/mp4';

      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(absoluteFilePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
    }
  }

  private getIngestedAssets(): any[] {
    const assets: any[] = [];
    const processedDir = path.join(this.dropzoneDir, 'processed');

    if (!fs.existsSync(processedDir)) return assets;

    const files = fs.readdirSync(processedDir);
    for (const file of files) {
      const filePath = path.join(processedDir, file);
      if (fs.statSync(filePath).isFile() && !file.endsWith('.json') && !file.endsWith('.csv') && !file.endsWith('.xml') && !file.endsWith('.edl')) {
        const metaPath = path.join(processedDir, `${file}.json`);
        let tags: string[] = ['media_asset'];
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (meta && Array.isArray(meta.tags)) {
              tags = meta.tags;
            }
          } catch (e) {}
        }
        assets.push({
          name: file,
          url: `/media/${file}`,
          tags: tags,
          timestamp: fs.statSync(filePath).mtime.toISOString()
        });
      }
    }
    return assets;
  }

  private serveGalleryUI(res: http.ServerResponse): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alpon X5 Edge HUD Gallery</title>
  <style>
    body {
      background-color: #0d1117;
      color: #c9d1d9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #21262d;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 24px; color: #58a6ff; }
    .controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .search-box {
      background: #161b22;
      border: 1px solid #30363d;
      color: #c9d1d9;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      width: 200px;
    }
    .model-selector {
      background: #161b22;
      border: 1px solid #30363d;
      color: #58a6ff;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .thumbnail {
      height: 150px;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .thumbnail img, .thumbnail video {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .card-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-grow: 1;
    }
    .filename {
      font-size: 14px;
      font-weight: 600;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag {
      font-size: 10px;
      background: #21262d;
      border: 1px solid #30363d;
      color: #8b949e;
      padding: 2px 6px;
      border-radius: 12px;
    }
    .tag.selected {
      background: #238636;
      color: #fff;
      border-color: #2ea44f;
    }
    .status-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0,0,0,0.6);
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <header>
    <h1>ALPON X5 EDGE HUD</h1>
    <div class="controls">
      <select class="model-selector" id="modelSelect" onchange="switchModel()">
        <!-- Models loaded dynamically -->
      </select>
      <input type="text" class="search-box" id="search" placeholder="Search assets..." onkeyup="doSearch()">
    </div>
  </header>
  <div class="grid" id="gallery">
    <!-- Dynamic Cards -->
  </div>

  <script>
    async function loadModels() {
      const response = await fetch('/api/models');
      const data = await response.json();
      const select = document.getElementById('modelSelect');
      select.innerHTML = '';
      data.models.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model.id;
        opt.textContent = model.name;
        if (model.id === data.active_model_id) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }

    async function switchModel() {
      const modelId = document.getElementById('modelSelect').value;
      const response = await fetch('/api/models/switch?id=' + modelId);
      const res = await response.json();
      if (res.status === 'success') {
        console.log('Switched model to:', res.active_model.name);
      }
    }

    async function loadAssets() {
      const response = await fetch('/api/assets');
      const assets = await response.json();
      render(assets);
    }

    async function doSearch() {
      const query = document.getElementById('search').value;
      const response = await fetch('/api/search?q=' + encodeURIComponent(query));
      const assets = await response.json();
      render(assets);
    }

    function render(assets) {
      const gallery = document.getElementById('gallery');
      gallery.innerHTML = '';
      assets.forEach(asset => {
        const isVideo = asset.name.endsWith('.mp4') || asset.name.endsWith('.mov');
        const mediaTag = isVideo 
          ? \`<video src="\${asset.url}" muted loops></video>\`
          : \`<img src="\${asset.url}" alt="" loading="lazy">\`;

        const tagElements = asset.tags.map(tag => {
          const isSel = tag === 'selected';
          return \`<span class="tag \${isSel ? 'selected' : ''}">\${tag}</span>\`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = \`
          <div class="thumbnail">
            \${mediaTag}
            <span class="status-badge">\${isVideo ? 'VIDEO' : 'PHOTO'}</span>
          </div>
          <div class="card-body">
            <div class="filename" title="\${asset.name}">\${asset.name}</div>
            <div class="tags">\${tagElements}</div>
          </div>
        \`;
        gallery.appendChild(card);
      });
    }

    loadModels();
    loadAssets();
  </script>
</body>
</html>
    `;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  public shutdown(): void {
    if (this.server) {
      this.server.close();
    }
  }
}
