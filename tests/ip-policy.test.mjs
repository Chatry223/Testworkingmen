import test from "node:test";
import assert from "node:assert/strict";
import { isBlockedIp, isBlockedDestination } from "../src/ip-policy.js";

test("blocks private and reserved IPv4 ranges",()=>{
 for(const ip of ["0.0.0.0","10.1.2.3","127.0.0.1","169.254.1.1","172.16.0.1","192.168.1.1","100.64.0.1","198.51.100.2","203.0.113.4","224.0.0.1","255.255.255.255"])assert.equal(isBlockedIp(ip),true,ip);
});
test("allows ordinary public IPv4",()=>{
 for(const ip of ["1.1.1.1","8.8.8.8","93.184.216.34"])assert.equal(isBlockedIp(ip),false,ip);
});
test("blocks IPv6 private, local, multicast and documentation ranges",()=>{
 for(const ip of ["::","::1","fc00::1","fd12:3456::1","fe80::1","ff02::1","2001:db8::1","2001:10::1","2002:c000:0201::1"])assert.equal(isBlockedIp(ip),true,ip);
});
test("blocks IPv4-mapped IPv6 even when fully expanded",()=>{
 for(const ip of ["::ffff:127.0.0.1","0:0:0:0:0:ffff:7f00:1","::ffff:0a01:0203"])assert.equal(isBlockedIp(ip),true,ip);
 assert.equal(isBlockedIp("::ffff:0808:0808"),false);
});
test("checks IPv4 embedded in NAT64 addresses",()=>{
 assert.equal(isBlockedIp("64:ff9b::7f00:1"),true);
 assert.equal(isBlockedIp("64:ff9b::0808:0808"),false);
});
test("blocks local names and sensitive destination ports",()=>{
 assert.equal(isBlockedDestination("router.local",443),true);
 assert.equal(isBlockedDestination("localhost",443),true);
 assert.equal(isBlockedDestination("example.com",445),true);
 assert.equal(isBlockedDestination("example.com",443),false);
});
test("fails closed for malformed IPv6 literals",()=>{
 assert.equal(isBlockedIp("2001:::1"),true);
});
