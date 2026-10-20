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

  function registerEndpoint(urlPath, method = 'GET', sourceFile = '', details = {}) {
    if (!urlPath || typeof urlPath !== 'string') return;
    let clean = urlPath.trim();
    if (clean.startsWith('`') || clean.startsWith('"') || clean.startsWith("'")) {
      clean = clean.slice(1, -1);
    }
    // Filter out common asset paths
    if (/\.(png|jpe?g|gif|svg|woff2?|ttf|css|ico)(\?.*)?$/i.test(clean)) return;
    if (clean.length < 3 || clean === '/' || clean.startsWith('http://www.w3.org')) return;

    // Normalize URL
    let pathKey = clean;
    try {
      if (clean.startsWith('http://') || clean.startsWith('https://')) {
        const u = new URL(clean);
        pathKey = u.pathname;
      }
    } catch (e) {}

    const key = `${method.toUpperCase()} ${pathKey}`;
    if (!endpointsMap.has(key)) {
      endpointsMap.set(key, {
        method: method.toUpperCase(),
        path: pathKey,
        fullUrl: clean.startsWith('http') ? clean : undefined,
        sources: [sourceFile],
        parameters: details.parameters || [],
        headers: details.headers || [],
        occurrences: 1
      });
    } else {
      const existing = endpointsMap.get(key);
      existing.occurrences++;
      if (!existing.sources.includes(sourceFile)) existing.sources.push(sourceFile);
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
              registerEndpoint(req.url, method, relPath, { parameters: queryParams, headers });
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

  // Generate OpenAPI 3.0 draft specification
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Reverse-Engineered API Specification (XtraDevPilot)",
      version: "1.0.0",
      description: "Automatically extracted from client-side bundles and network captures."
    },
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
    endpoints: endpointsList,
    openApiSpec
  };
}
