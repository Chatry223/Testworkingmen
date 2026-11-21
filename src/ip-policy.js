function parseIPv4(value) {
  const parts=value.split(".");
  if(parts.length!==4)return null;
  const nums=parts.map(part=>/^(0|[1-9][0-9]{0,2})$/.test(part)?Number(part):-1);
  return nums.every(n=>n>=0&&n<=255)?nums:null;
}

function parseIPv6(value) {
  let input=value.toLowerCase().replace(/^\[|\]$/g,"");
  if(input.includes("%")||!input.includes(":"))return null;
  const dotted=input.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if(dotted){
    const v4=parseIPv4(dotted[1]);if(!v4)return null;
    const tail=[((v4[0]<<8)|v4[1]).toString(16),((v4[2]<<8)|v4[3]).toString(16)];
    input=input.slice(0,input.length-dotted[1].length)+tail.join(":");
  }
  if((input.match(/::/g)||[]).length>1)return null;
  const halves=input.split("::");
  const left=halves[0]?halves[0].split(":"):[];
  const right=halves.length===2&&halves[1]?halves[1].split(":"):[];
  if([...left,...right].some(word=>! /^[0-9a-f]{1,4}$/.test(word)))return null;
  const missing=8-left.length-right.length;
  if((halves.length===1&&missing!==0)||(halves.length===2&&missing<1))return null;
  const words=[...left,...Array(missing).fill("0"),...right].map(x=>parseInt(x,16));
  return words.length===8?words:null;
}

export function isBlockedIp(ip) {
  const v4=parseIPv4(ip);
  if(v4){
    const [a,b,c]=v4;
    return a===0||a===10||a===127||a>=224||
      (a===100&&b>=64&&b<=127)||(a===169&&b===254)||
      (a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168||b===88&&c===99))||
      (a===198&&(b===18||b===19||b===51&&c===100))||
      (a===203&&b===0&&(c===0||c===113));
  }
  const v6=parseIPv6(ip);
  if(!v6)return ip.includes(":");
  const [a,b,c,d,e,f,g,h]=v6;
  if(v6.every(x=>x===0)||(v6.slice(0,7).every(x=>x===0)&&h===1))return true;
  if((a&0xfe00)===0xfc00||(a&0xffc0)===0xfe80||(a&0xff00)===0xff00)return true;
  if(a===0x2001&&b===0x0db8)return true;
  if(a===0x2001&&(b&0xfff0)===0x0010)return true;
  if(a===0x2002)return true;
  const mapped=v6.slice(0,5).every(x=>x===0)&&v6[5]===0xffff;
  const nat64=v6.slice(0,6).every((x,i)=>x===[0x0064,0xff9b,0,0,0,0][i]);
  if(mapped||nat64){
    const embedded=[v6[6]>>8,v6[6]&255,v6[7]>>8,v6[7]&255];
    return isBlockedIp(embedded.join("."));
  }
  if(a===0x0064&&b===0xff9b&&c===0x0001)return true;
  return false;
}

export function isBlockedDestination(host,port) {
  const value=host.toLowerCase().replace(/^\[|\]$/g,"").replace(/\.$/,"");
  if(["localhost","localhost.localdomain"].includes(value)||
     value.endsWith(".localhost")||value.endsWith(".local")||
     value.endsWith(".internal")||value.endsWith(".test")||
     value.endsWith(".invalid")||value.endsWith(".example"))return true;
  if(isBlockedIp(value))return true;
  if([25,135,137,138,139,445].includes(port))return true;
  return false;
}
