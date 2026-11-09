export function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes: ArrayBuffer) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
}

export function constantTimeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
