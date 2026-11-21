const decoder = new TextDecoder("utf-8", { fatal: true });

export function parseVlessHeader(data) {
  if (!(data instanceof Uint8Array)) throw new TypeError("VLESS data must be Uint8Array");
  if (data.length < 18) return null;

  const version = data[0];
  const id = [...data.subarray(1, 17)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const optionLength = data[17];
  const commandIndex = 18 + optionLength;
  if (data.length <= commandIndex) return null;

  const command = data[commandIndex];
  if (command !== 1) throw new Error("Only TCP command is supported");

  const portIndex = commandIndex + 1;
  if (data.length < portIndex + 3) return null;
  const port = (data[portIndex] << 8) | data[portIndex + 1];
  if (port === 0) throw new Error("Invalid destination port");

  const addressType = data[portIndex + 2];
  let offset = portIndex + 3;
  let host;

  if (addressType === 1) {
    if (data.length < offset + 4) return null;
    host = [...data.subarray(offset, offset + 4)].join(".");
    offset += 4;
  } else if (addressType === 2) {
    if (data.length < offset + 1) return null;
    const length = data[offset++];
    if (!length) throw new Error("Empty destination hostname");
    if (data.length < offset + length) return null;
    host = decoder.decode(data.subarray(offset, offset + length));
    offset += length;
    if (host.length > 253 || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)) {
      throw new Error("Invalid destination hostname");
    }
  } else if (addressType === 3) {
    if (data.length < offset + 16) return null;
    const words = [];
    for (let i = 0; i < 16; i += 2) words.push(((data[offset + i] << 8) | data[offset + i + 1]).toString(16));
    host = words.join(":");
    offset += 16;
  } else {
    throw new Error("Unsupported address type");
  }

  return { version, id, host, port, offset };
}
