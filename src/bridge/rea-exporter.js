import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Exports XtraDevPilot live browser observation into REA (Reverse Engineer Anything)
 * canonical Evidence bundle format (schema io.github.morluto/rea).
 */
export function buildReaEvidenceBundle(options = {}) {
  const {
    tabInfo = {},
    harLog = {},
    domSnapshot = '',
    storage = {},
    cookies = [],
    endpoints = [],
    reconstruction = null
  } = options;

  const timestamp = new Date().toISOString();
  const pageUrl = tabInfo.url || 'about:blank';
  const pageTitle = tabInfo.title || 'Untitled Page';

  const rawJson = JSON.stringify({ pageUrl, timestamp, entriesCount: harLog.entries?.length || 0 });
  const evidenceId = 'ev_' + crypto.createHash('sha256').update(rawJson).digest('hex').substring(0, 16);

  const evidenceRecord = {
    evidence_id: evidenceId,
    schema_version: "2.0.0",
    created_at: timestamp,
    provider: {
      id: "io.github.xtradevpilot.bridge",
      name: "XtraDevPilot Authenticated Chrome Bridge",
      version: "2.0.2"
    },
    operation: "observe_web_session",
    subject: {
      type: "web_page",
      url: pageUrl,
      title: pageTitle,
      tabId: tabInfo.id || null
    },
    coverage: {
      scope: "authenticated_session",
      status: "complete"
    },
    normalized_result: {
      page: {
        url: pageUrl,
        title: pageTitle,
        domLengthBytes: Buffer.byteLength(domSnapshot || '', 'utf8')
      },
      network: {
        totalRequests: harLog.entries?.length || 0,
        harVersion: harLog.version || "1.2"
      },
      storage: {
        localStorageKeys: Object.keys(storage.localStorage || {}),
        sessionStorageKeys: Object.keys(storage.sessionStorage || {}),
        cookiesCount: cookies.length || 0
      },
      discoveredEndpoints: endpoints.slice(0, 50),
      reconstructionSummary: reconstruction ? {
        totalFiles: reconstruction.totalFiles,
        totalSizeKB: reconstruction.totalSizeKB,
        detectedTechStack: reconstruction.detectedTechStack
      } : null
    },
    raw_result: {
      har: harLog,
      cookies,
      domSample: domSnapshot ? domSnapshot.slice(0, 5000) : ''
    },
    limitations: []
  };

  return evidenceRecord;
}

/**
 * Saves a REA Evidence bundle to file.
 */
export function exportReaEvidenceToFile(evidenceData, outputPath) {
  const target = path.resolve(process.cwd(), outputPath || 'xtradevpilot-rea-evidence.json');
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(target, JSON.stringify(evidenceData, null, 2), 'utf8');
  return {
    savedTo: target,
    sizeBytes: fs.statSync(target).size,
    evidenceId: evidenceData.evidence_id
  };
}
