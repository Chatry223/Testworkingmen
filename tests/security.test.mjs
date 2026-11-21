import test from "node:test";
import assert from "node:assert/strict";
import {secureEqual} from "../src/security.js";
test("constant-time comparison accepts identical tokens",()=>assert.equal(secureEqual("secret","secret"),true));
test("comparison rejects different lengths and values",()=>{assert.equal(secureEqual("secret","secret2"),false);assert.equal(secureEqual("secret","secrex"),false);});
