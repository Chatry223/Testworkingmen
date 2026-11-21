export function parseVlessHeader(data) {
 if(data.length<24)throw new Error("Incomplete VLESS header");
 const version=data[0], id=[...data.slice(1,17)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const optLen=data[17], command=data[18+optLen];
 if(command!==1)throw new Error("Only TCP command is supported");
 const port=(data[19+optLen]<<8)|data[20+optLen], type=data[21+optLen];
 let offset=22+optLen, host;
 if(type===1){host=[...data.slice(offset,offset+4)].join(".");offset+=4;}
 else if(type===2){const n=data[offset++];host=new TextDecoder().decode(data.slice(offset,offset+n));offset+=n;}
 else if(type===3){host=[...data.slice(offset,offset+16)].map((v,i)=>i%2?"":v.toString(16).padStart(2,"0")).join(":");offset+=16;}
 else throw new Error("Unsupported address type");
 return {version,id,host,port,offset};
}
