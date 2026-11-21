import test from "node:test";
import assert from "node:assert/strict";
import { singBoxConfig } from "../src/singbox.js";

test("builds a complete Cloudflare-only sing-box client config",()=>{
 const config=singBoxConfig("edge.example.workers.dev",{uuid:"12345678-1234-4234-8234-123456789abc"});
 assert.equal(config.inbounds[0].type,"mixed");
 assert.equal(config.inbounds[0].listen,"127.0.0.1");
 assert.equal(config.inbounds[0].listen_port,2080);
 assert.equal(config.outbounds[0].type,"vless");
 assert.equal(config.outbounds[0].server,"edge.example.workers.dev");
 assert.equal(config.outbounds[0].server_port,443);
 assert.equal(config.outbounds[0].transport.type,"ws");
 assert.equal(config.outbounds[0].transport.path,"/ws");
 assert.equal(config.route.final,"cloudflare");
 assert.ok(config.outbounds.some(x=>x.tag==="direct"));
 assert.ok(config.outbounds.some(x=>x.tag==="block"));
});
test("only adds the relay and urltest group when explicitly configured",()=>{
 const config=singBoxConfig("edge.example.workers.dev",{uuid:"u"},"wss://relay.example.com:8443/custom");
 assert.equal(config.outbounds[1].tag,"vps-relay");
 assert.equal(config.outbounds[1].server_port,8443);
 assert.equal(config.outbounds[1].transport.path,"/custom");
 assert.equal(config.route.final,"auto");
});
test("rejects insecure or malformed relay URLs",()=>{
 assert.throws(()=>singBoxConfig("edge.example.workers.dev",{uuid:"u"},"http://relay.example.com"),/wss/);
 assert.throws(()=>singBoxConfig("edge.example.workers.dev",{uuid:"u"},"not a url"),/valid/);
});
