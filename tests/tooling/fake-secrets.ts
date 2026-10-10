/** A syntactically valid-looking key assembled at runtime, never committed. */
export function fakePrivateKey(): string {
  const marker = ['BEGIN', 'RSA', 'PRIVATE', 'KEY'].join(' ');
  const end = marker.replace('BEGIN', 'END');
  const body = 'MIIEowIBAAKCAQEA'.padEnd(64, 'q');
  return `-----${marker}-----\n${body}\n${body}\n-----${end}-----\n`;
}
