import fs from 'node:fs';
import path from 'node:path';

/**
 * Scans JavaScript and HAR content to discover API endpoints, query params, and methods.
 * Generates structured endpoint catalog and OpenAPI 3.0 draft specification.
 */
export function scanEndpoints(inputDirOrFile) {
  const resolved = path.resolve(process.cwd(), inputDirOrFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Target path not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  const filesToScan = [];

  if (stat.isDirectory()) {
    function collect(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) collect(full);
        else if (ent.name.endsWith('.js') || ent.name.endsWith('.ts') || ent.name.endsWith('.har') || ent.name.endsWith('.json')) {
          filesToScan.push(full);
        }
      }
    }
    collect(resolved);
  } else {
    filesToScan.push(resolved);
  }

  const endpointsMap = new Map();

  // Static assets are never API endpoints. Covers scripts, styles, fonts, images, media, maps.
  const STATIC_EXT = /\.(js|mjs|cjs|map|wasm|css|png|jpe?g|gif|svg|ico|webp|avif|bmp|woff2?|ttf|eot|otf|mp4|webm|mov|mp3|wav|ogg|pdf|txt|xml)(\?.*)?$/i;
  const STATIC_MIME = /^(application\/javascript|text\/javascript|text\/css|font\/|image\/(?!svg\+xml.*json)|video\/|audio\/)/i;
  // Positive signal that a path is a real API even if other heuristics are unsure.
  const API_PATH = /\/(api|v[0-9]+|graphql|gql|auth|oauth|rest|rpc|webhook|session|track(?:ing)?|event|collect|beacon|query|search|feed|graph)(\b|\/|$)/i;

  function hostOf(u) {
    try { return new URL(u).host; } catch (e) { return ''; }
  }
  // Approximate registrable domain (eTLD+1) for first/third-party comparison.
  function regDomain(host) {
    if (!host) return '';
    const parts = host.split('.').filter(Boolean);
    return parts.length <= 2 ? host : parts.slice(-2).join('.');
  }

  function registerEndpoint(urlPath, method = 'GET', sourceFile = '', details = {}) {
    if (!urlPath || typeof urlPath !== 'string') return;
    let clean = urlPath.trim();
    if (clean.startsWith('`') || clean.startsWith('"') || clean.startsWith("'")) {
      clean = clean.slice(1, -1);
    }
    if (clean.length < 3 || clean === '/' || clean.startsWith('http://www.w3.org')) return;

    const isAbsolute = clean.startsWith('http://') || clean.startsWith('https://');
    let pathKey = clean;
    let host = details.host || '';
    try {
      if (isAbsolute) { const u = new URL(clean); pathKey = u.pathname; host = u.host; }
    } catch (e) {}

    // Reject static assets by extension or response content-type, unless the path
    // clearly looks like an API (e.g. a JSON API served with a generic type).
    const mime = (details.mime || '').toLowerCase();
    const looksApi = API_PATH.test(pathKey) || /json|graphql/.test(mime) || method.toUpperCase() !== 'GET';
    if (!looksApi && (STATIC_EXT.test(pathKey) || (mime && STATIC_MIME.test(mime)))) return;

    const key = `${method.toUpperCase()} ${host}${pathKey}`;
    if (!endpointsMap.has(key)) {
      endpointsMap.set(key, {
        method: method.toUpperCase(),
        path: pathKey,
        host,
        fullUrl: isAbsolute ? clean : undefined,
        contentType: mime || undefined,
        sources: sourceFile ? [sourceFile] : [],
        parameters: details.parameters || [],
        headers: details.headers || [],
        occurrences: 1
      });
    } else {
      const existing = endpointsMap.get(key);
      existing.occurrences++;
      if (sourceFile && !existing.sources.includes(sourceFile)) existing.sources.push(sourceFile);
    }
  }

  for (const f of filesToScan) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      const relPath = path.relative(process.cwd(), f);

      // Check if file is HAR
      if (f.endsWith('.har') || (f.endsWith('.json') && content.includes('"log"') && content.includes('"entries"'))) {
        try {
          const parsed = JSON.parse(content);
          const entries = parsed.log?.entries || parsed.raw_result?.har?.log?.entries || [];
          for (const entry of entries) {
            const req = entry.request;
            if (req && req.url) {
              const method = req.method || 'GET';
              const queryParams = (req.queryString || []).map(q => q.name);
              const headers = (req.headers || []).map(h => h.name).filter(h => /auth|api|token|session|csrf/i.test(h));
              const mime = ((entry.response && entry.response.content && entry.response.content.mimeType) || '').split(';')[0];
              registerEndpoint(req.url, method, relPath, { parameters: queryParams, headers, mime });
            }
          }
          continue;
        } catch (e) {}
      }

      // JavaScript / TypeScript regex endpoint extraction
      // 1. fetch(..., { method: ... })
      const fetchRegex = /fetch\(\s*["'`](\/[a-zA-Z0-9_\-\/]+|https?:\/\/[^"'`\s]+)["'`]\s*(?:,\s*\{[^}]*method\s*:\s*["'](GET|POST|PUT|DELETE|PATCH)["'][^}]*\})?/gi;
      let m;
      while ((m = fetchRegex.exec(content)) !== null) {
        const url = m[1];
        const method = (m[2] || 'GET').toUpperCase();
        registerEndpoint(url, method, relPath);
      }

      // 2. axios.get, axios.post, axios.delete, axios.put, etc.
      const axiosRegex = /axios\.(get|post|put|delete|patch)\(\s*["'`](\/[a-zA-Z0-9_\-\/]+|https?:\/\/[^"'`\s]+)["'`]/gi;
      while ((m = axiosRegex.exec(content)) !== null) {
        const method = m[1].toUpperCase();
        const url = m[2];
        registerEndpoint(url, method, relPath);
      }

      // 3. API path patterns like "/api/v1/users", "/auth/login", "/v1/graphql"
      const apiPathRegex = /["'](\/(?:api|v[0-9]|auth|graphql|webhook|user|account)\/[a-zA-Z0-9_\-\/]+)["']/gi;
      while ((m = apiPathRegex.exec(content)) !== null) {
        registerEndpoint(m[1], 'GET', relPath);
      }
    } catch (e) {}
  }

  const endpointsList = Array.from(endpointsMap.values());

  // Determine the primary (first-party) host: the registrable domain hosting the most endpoints.
  const domainCounts = new Map();
  for (const ep of endpointsList) {
    const rd = regDomain(ep.host);
    if (rd) domainCounts.set(rd, (domainCounts.get(rd) || 0) + 1);
  }
  const primaryDomain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  for (const ep of endpointsList) {
    ep.firstParty = !!ep.host && regDomain(ep.host) === primaryDomain;
  }

  // Host / server summary
  const hostCounts = new Map();
  for (const ep of endpointsList) {
    if (ep.host) hostCounts.set(ep.host, (hostCounts.get(ep.host) || 0) + ep.occurrences);
  }
  const topHosts = [...hostCounts.entries()].sort((a, b) => b[1] - a[1]).map(([host, count]) => ({ host, count }));
  const servers = [...new Set(endpointsList.filter(e => e.host).map(e => `https://${e.host}`))].map(url => ({ url }));

  const firstParty = endpointsList.filter(e => e.firstParty);
  const methods = {};
  for (const ep of endpointsList) methods[ep.method] = (methods[ep.method] || 0) + 1;

  const summary = {
    totalEndpoints: endpointsList.length,
    firstPartyCount: firstParty.length,
    thirdPartyCount: endpointsList.length - firstParty.length,
    hostCount: hostCounts.size,
    primaryDomain,
    methods,
    topHosts: topHosts.slice(0, 15),
    firstPartyEndpoints: firstParty.slice(0, 50).map(e => `${e.method} ${e.host}${e.path}`)
  };

  // Generate OpenAPI 3.0 draft specification
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Reverse-Engineered API Specification (XtraDevPilot)",
      version: "1.0.0",
      description: "Automatically extracted from client-side bundles and network captures."
    },
    servers,
    paths: {}
  };

  for (const ep of endpointsList) {
    const p = ep.path.startsWith('/') ? ep.path : `/${ep.path}`;
    if (!openApiSpec.paths[p]) {
      openApiSpec.paths[p] = {};
    }
    const methodLower = ep.method.toLowerCase();
    openApiSpec.paths[p][methodLower] = {
      summary: `Discovered endpoint ${ep.method} ${p}`,
      parameters: ep.parameters.map(paramName => ({
        name: paramName,
        in: "query",
        schema: { type: "string" }
      })),
      responses: {
        "200": {
          description: "Successful response"
        }
      }
    };
  }

  return {
    totalEndpoints: endpointsList.length,
    summary,
    endpoints: endpointsList,
    openApiSpec
  };
}
