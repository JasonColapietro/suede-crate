import { createQloo, AppError } from '../lib/qloo.mjs';
import { tools, callTool } from '../lib/discovery.mjs';
import { allowRequest, readBody, send, validateOrigin } from '../lib/http.mjs';
let qloo;
const protocols = ['2025-11-25', '2025-06-18', '2025-03-26'];
export function makeMcp(client) {
  return async (req, res) => {
    if (req.method === 'GET' || req.method === 'DELETE') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: { code: 'method_not_allowed', message: 'This stateless MCP endpoint accepts POST requests.' } }); }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: { message: 'Use POST.' } }); }
    let id = null;
    try {
      validateOrigin(req);
      allowRequest(req);
      const body = await readBody(req);
      if (!body || Array.isArray(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || (body.id !== undefined && typeof body.id !== 'string' && typeof body.id !== 'number')) return send(res, 400, { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } });
      id = body.id ?? null;
      if (body.id === undefined) { res.writeHead(202, { 'Cache-Control': 'no-store' }); return res.end(); }
      if (body.method === 'initialize') return send(res, 200, { jsonrpc: '2.0', id, result: { protocolVersion: protocols.includes(body.params?.protocolVersion) ? body.params.protocolVersion : protocols[0], capabilities: { tools: {} }, serverInfo: { name: 'suede-crate', version: '0.1.0' }, instructions: 'Resolve exact artist matches, then build and refine a music crate using Qloo. Never present taste associations as artistic influence or sound-alike evidence.' } });
      if (body.method === 'ping') return send(res, 200, { jsonrpc: '2.0', id, result: {} });
      if (body.method === 'tools/list') return send(res, 200, { jsonrpc: '2.0', id, result: { tools } });
      if (body.method === 'tools/call') {
        if (!tools.some(t => t.name === body.params?.name)) return send(res, 200, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Unknown tool' } });
        try {
          const result = await callTool(client, body.params.name, body.params.arguments);
          return send(res, 200, { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } });
        } catch (error) {
          return send(res, 200, { jsonrpc: '2.0', id, result: { isError: true, content: [{ type: 'text', text: error instanceof AppError ? error.message : 'Discovery is temporarily unavailable.' }] } });
        }
      }
      return send(res, 200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
    } catch (error) { return send(res, error instanceof AppError ? error.status : 500, { jsonrpc: '2.0', id, error: { code: -32600, message: error instanceof AppError ? error.message : 'Request failed' } }); }
  };
}
export default async function handler(req, res) { try { qloo ??= createQloo(); return makeMcp(qloo)(req, res); } catch { send(res, 503, { error: { message: 'The discovery service is not configured correctly.' } }); } }
