import { SaxesParser } from 'saxes';

export const namespace = 'urn:schemas-microsoft-com:unattend';
export const namespaceAttributes = `xmlns="${namespace}" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;
export function validXmlText(text: string): boolean {
  return !/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/u.test(text);
}
export function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#13;');
}
export function checkXml(xml: string, fragment = false): { error?: string; children: string[] } {
  const children: string[] = [];
  let error: string | undefined;
  let depth = 0;
  const parser = new SaxesParser({ xmlns: true });
  parser.on('error', (e) => {
    error ??= e.message;
  });
  parser.on('doctype', () => {
    error ??= 'DOCTYPE and entity declarations are not allowed.';
  });
  parser.on('processinginstruction', () => {
    error ??= 'Processing instructions are not allowed.';
  });
  parser.on('xmldecl', (declaration) => {
    if (declaration.version !== '1.0') error ??= 'Use XML version 1.0 for Windows answer files.';
    if (declaration.encoding && declaration.encoding.toLowerCase() !== 'utf-8')
      error ??= 'Save the answer file with a UTF-8 encoding declaration.';
  });
  parser.on('opentag', (tag) => {
    if (depth === 0 && (tag.local !== 'unattend' || tag.uri !== namespace))
      error ??= 'The root must be unattend in the Microsoft unattend namespace.';
    if (depth === 1) children.push(tag.local);
    depth++;
  });
  parser.on('closetag', () => {
    depth--;
  });
  try {
    parser.write(fragment ? `<unattend ${namespaceAttributes}>${xml}</unattend>` : xml).close();
  } catch (e) {
    error ??= e instanceof Error ? e.message : 'Invalid XML.';
  }
  // Kyro matches raw bytes, so entity-escaped braces remain literal text.
  for (const token of xml.matchAll(/\{\{(mac|serial|uuid|callback_url)(?::([^{}]*))?\}\}/g)) {
    const suffix = token[2];
    if (
      suffix !== undefined &&
      (token[1] === 'callback_url' || !/^[1-9][0-9]?$/.test(suffix) || Number(suffix) > 64)
    )
      error ??= `${token[0]}: Kyro token lengths must be 1 to 64; callback_url takes no length.`;
  }
  return error ? { error, children } : { children };
}

// Windows SIM uses UTF-16LE with an element-name suffix. This is reversible encoding.
export function base64Utf16(text: string): string {
  let bytes = '';
  for (let i = 0; i < text.length; i++)
    bytes += String.fromCharCode(text.charCodeAt(i) & 255, text.charCodeAt(i) >>> 8);
  return btoa(bytes);
}
export function psLiteral(text: string): string {
  return `'${text.replace(/['\u2018\u2019\u201a\u201b]/g, '$&$&')}'`;
}
