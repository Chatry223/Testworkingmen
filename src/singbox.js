export function singBoxConfig(host,user,relayUrl) {
 const outbound=(tag,server,port,path)=>({
  type:"vless",tag,server,server_port:port,uuid:user.uuid,network:"tcp",
  tls:{enabled:true,server_name:server},
  transport:{type:"ws",path,headers:{Host:server}}
 });
 const outbounds=[outbound("cloudflare",host,443,"/ws")];
 let final="cloudflare";
 if(relayUrl){
  let relay;try{relay=new URL(relayUrl);}catch{throw new Error("RELAY_URL must be a valid wss:// URL");}
  if(relay.protocol!=="wss:"||!relay.hostname)throw new Error("RELAY_URL must use wss://");
  outbounds.push(outbound("vps-relay",relay.hostname,relay.port?Number(relay.port):443,relay.pathname||"/ws"));
  outbounds.push({type:"urltest",tag:"auto",outbounds:["cloudflare","vps-relay"],url:"https://www.gstatic.com/generate_204",interval:"2m",tolerance:150,interrupt_exist_connections:true});
  final="auto";
 }
 return {
  log:{level:"warn"},
  inbounds:[{type:"mixed",tag:"local-proxy",listen:"127.0.0.1",listen_port:2080}],
  outbounds:[...outbounds,{type:"direct",tag:"direct"},{type:"block",tag:"block"}],
  route:{auto_detect_interface:true,final}
 };
}
