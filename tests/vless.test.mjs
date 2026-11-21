import test from "node:test";
import assert from "node:assert/strict";
import {parseVlessHeader} from "../src/protocol/vless.js";
test("parses a VLESS IPv4 TCP header",()=>{
 const b=new Uint8Array(27); b[0]=0; for(let i=1;i<=16;i++)b[i]=i;
 b[17]=0;b[18]=1;b[19]=1;b[20]=187;b[21]=1;b.set([1,2,3,4],22);
 const h=parseVlessHeader(b);
 assert.equal(h.host,"1.2.3.4");assert.equal(h.port,443);assert.equal(h.offset,26);
});
test("rejects unsupported commands",()=>{
 const b=new Uint8Array(27);b[18]=2;
 assert.throws(()=>parseVlessHeader(b),/Only TCP/);
});
