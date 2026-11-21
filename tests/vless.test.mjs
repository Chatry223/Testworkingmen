import test from "node:test";
import assert from "node:assert/strict";
import { parseVlessHeader } from "../src/protocol/vless.js";

function ipv4Header({ command = 1, host = [1,2,3,4], port = 443 } = {}) {
  const b = new Uint8Array(26);
  b[0] = 0;
  for (let i = 1; i <= 16; i++) b[i] = i;
  b[17] = 0; b[18] = command;
  b[19] = (port >> 8) & 255; b[20] = port & 255;
  b[21] = 1; b.set(host, 22);
  return b;
}

test("parses a VLESS IPv4 TCP header and formats UUID for D1 lookup", () => {
  const h = parseVlessHeader(ipv4Header());
  assert.equal(h.host, "1.2.3.4");
  assert.equal(h.port, 443);
  assert.equal(h.offset, 26);
  assert.equal(h.id, "01020304-0506-0708-090a-0b0c0d0e0f10");
});

test("returns null for a fragmented header", () => {
  const full = ipv4Header();
  assert.equal(parseVlessHeader(full.subarray(0, 10)), null);
  assert.equal(parseVlessHeader(full.subarray(0, 25)), null);
});

test("rejects unsupported commands and zero ports", () => {
  assert.throws(() => parseVlessHeader(ipv4Header({ command: 2 })), /Only TCP/);
  assert.throws(() => parseVlessHeader(ipv4Header({ port: 0 })), /port/);
});

test("parses a domain destination", () => {
  const domain = new TextEncoder().encode("example.com");
  const b = new Uint8Array(22 + 1 + domain.length);
  b[0] = 0; b[17] = 0; b[18] = 1; b[19] = 1; b[20] = 187; b[21] = 2;
  b[22] = domain.length; b.set(domain, 23);
  const h = parseVlessHeader(b);
  assert.equal(h.host, "example.com");
  assert.equal(h.port, 443);
  assert.equal(h.offset, 23 + domain.length);
});
