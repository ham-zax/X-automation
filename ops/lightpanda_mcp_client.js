// Small process-owned native MCP client. Each publication gets a fresh isolated
// Lightpanda session; no global browser tab or background daemon is shared.
import { spawnLightpanda } from './lightpanda_runtime.js';

export class LightpandaMcpClient {
  constructor() { this.seq = 0; this.pending = new Map(); this.buffer = ''; this.child = null; }
  async connect() {
    this.child = await spawnLightpanda();
    this.child.stdin.on('error', () => { /* Child exit can race our final MCP stdin write. */ });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (this.buffer.length > 4_000_000) { this.failAll(new Error('Lightpanda MCP output limit')); return; }
      for (let end; (end = this.buffer.indexOf('\n')) >= 0;) {
        const line = this.buffer.slice(0, end).trim(); this.buffer = this.buffer.slice(end + 1);
        if (!line) continue;
        try {
          const reply = JSON.parse(line);
          const item = this.pending.get(reply.id);
          if (item) { this.pending.delete(reply.id); clearTimeout(item.timeout); reply.error ? item.reject(new Error('Lightpanda MCP tool error')) : item.resolve(reply.result); }
        } catch { /* MCP notifications may be unrelated to this request. */ }
      }
    });
    this.child.on('error', () => this.failAll(new Error('Lightpanda MCP subprocess failed')));
    this.child.on('exit', () => this.failAll(new Error('Lightpanda MCP subprocess exited')));
    try {
      await this.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'xgrowth', version: '1' } });
    } catch (error) { this.close(); throw error; }
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    return this;
  }
  request(method, params, timeoutMs = 18000) {
    if (!this.child?.stdin?.writable) return Promise.reject(new Error('Lightpanda MCP not connected'));
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('Lightpanda MCP call timed out')); }, timeoutMs);
      this.pending.set(id, { timeout, resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }
  async tool(name, args = {}, timeoutMs = 18000) {
    const value = await this.request('tools/call', { name, arguments: args }, timeoutMs);
    if (value?.isError) throw new Error(`Lightpanda ${name} rejected the operation`);
    // Native server returns structuredContent for typed values; for markdown and
    // evaluate some releases return plain text inside MCP content blocks.
    const raw = (value?.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
    return { data: value?.structuredContent ?? null, text: raw };
  }
  failAll(error) { for (const item of this.pending.values()) { clearTimeout(item.timeout); item.reject(error); } this.pending.clear(); }
  close() { if (this.child) { this.child.stdin.destroy(); this.child.kill('SIGTERM'); this.child = null; } }
}
