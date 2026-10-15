// api/_lib/seo-egress.mjs: a tiny local proxy for the headless browser.
//
// Every connection the browser makes (pages, scripts, fetch, WebSockets, workers) goes through
// it. It resolves the host once, refuses private addresses, and connects to the exact address it
// checked, so a site cannot point the browser at internal servers, even by changing its DNS
// answer between the check and the connection. Built-in Node modules only.

import http from 'node:http';
import net from 'node:net';
import { lookup } from 'node:dns/promises';
import { isPrivateAddress } from './seo-checks.mjs';

const ALLOWED_PORTS = new Set([80, 443, 8080, 8443]);

// The one public address to connect to for host, or null.
async function vetted(host) {
  const name = host.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(name)) return null;
  const addrs = net.isIP(name) ? [{ address: name }] : await lookup(name, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return null;
  return addrs[0].address;
}

const refuse = (socket, code = 403) => {
  try {
    socket.end(`HTTP/1.1 ${code} Forbidden\r\nConnection: close\r\n\r\n`);
  } catch {
    socket.destroy();
  }
};

// Starts the proxy on a random loopback port. Returns { port, close() }.
export async function startEgressProxy() {
  const server = http.createServer(async (req, res) => {
    // Plain http:// requests arrive with the full URL.
    let target;
    try {
      target = new URL(req.url);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const port = Number(target.port || 80);
    const ip = target.protocol === 'http:' && ALLOWED_PORTS.has(port) ? await vetted(target.hostname) : null;
    if (!ip) {
      res.writeHead(403).end();
      return;
    }
    const upstream = http.request(
      { host: ip, port, method: req.method, path: target.pathname + target.search, headers: { ...req.headers, host: target.host }, setHost: false },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  });

  // https:// and wss:// (and ws:// through some Chromium paths) arrive as CONNECT tunnels.
  const tunnel = async (req, socket, head) => {
    const [host, portText] = (req.url || '').split(/:(?=\d+$)/);
    const port = Number(portText || 443);
    const ip = ALLOWED_PORTS.has(port) ? await vetted(host || '') : null;
    if (!ip) return refuse(socket);
    const upstream = net.connect(port, ip, () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  };
  server.on('connect', tunnel);
  // ws:// upgrades sent to the proxy as absolute-URL requests are refused rather than half-handled.
  server.on('upgrade', (_req, socket) => refuse(socket));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
  };
}
