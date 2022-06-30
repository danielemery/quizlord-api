export function base64Encode(source: string) {
  return Buffer.from(source).toString("base64");
}

export function base64Decode(source: string) {
  return Buffer.from(source, "base64").toString("ascii");
}