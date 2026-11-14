import { describe, expect, it } from 'vitest';
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import fc from 'fast-check';
import { defaults, type Options } from './types';
import { generateUnattend } from './generate';
import { exportBundle, exportSettings, inspectImported, parseImport } from './bundle';
import { base64Utf16, checkXml, namespace, validXmlText } from './xml';
import { OptionsError, validateOptions } from './validate';

function document(xml: string) {
  const doc = new DOMParser({ onError: onErrorStopParsing }).parseFromString(
    xml,
    'application/xml',
  );
  expect(doc.documentElement?.namespaceURI).toBe(namespace);
  return doc;
}
function fullOptions(): Options {
  return {
    ...defaults(),
    name: 'office-laptops',
    description: 'Deployment profile',
    language: 'de-DE',
    userLocale: 'de-DE',
    systemLocale: 'de-DE',
    keyboard: 'de-DE;en-US',
    timeZone: 'W. Europe Standard Time',
    acceptEula: true,
    editionMode: 'name',
    editionValue: 'Windows 11 Pro',
    diskMode: 'wipe',
    diskNumber: '0',
    diskLayout: 'with-recovery',
    confirmWipe: true,
    computerName: 'PC-{{serial:8}}',
    accounts: [
      {
        name: 'deploy',
        displayName: 'Deployment & support',
        password: 'päss🔑<&',
        group: 'Administrators',
      },
    ],
    autoLogon: 'deploy',
    autoLogonCount: 1,
    oobe: { hideEula: true, hideOem: true, hideOnline: true, hideWireless: true, protect: '3' },
    domain: {
      enabled: true,
      name: 'ad.example.test',
      username: 'join-user',
      password: '<&"secret',
      ou: 'OU=Devices,DC=ad,DC=example,DC=test',
    },
    driversPE: ['\\\\server\\share\\Drivers & Tools'],
    driversSystem: ['C:\\Drivers'],
    removeApps: ['Microsoft.BingNews'],
    scripts: [
      { kind: 'powershell', content: "Write-Output 'Hello 世界'" },
      { kind: 'command', content: 'echo Done' },
    ],
    bypass: ['TPM', 'SecureBoot'],
    fragments: [],
  };
}

describe('Windows answer files', () => {
  it('omits every unset setting, with no hidden installation changes', () => {
    const result = generateUnattend(defaults());
    const doc = document(result.xml);
    expect(doc.getElementsByTagName('settings').length).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.wipesDisk).toBe(false);
  });
  it('writes passes in order, driver namespaces, selection and install target correctly', () => {
    const result = generateUnattend(fullOptions());
    const doc = document(result.xml);
    expect(
      Array.from(doc.getElementsByTagName('settings')).map((n) => n.getAttribute('pass')),
    ).toEqual(['windowsPE', 'offlineServicing', 'specialize', 'oobeSystem']);
    expect(doc.getElementsByTagName('ComputerName')[0]?.textContent).toBe('PC-{{serial:8}}');
    expect(doc.getElementsByTagName('MetaData')[0]?.textContent).toContain('/IMAGE/NAME');
    expect(doc.getElementsByTagName('InstallTo')[0]?.textContent).toContain('3');
    expect(
      doc
        .getElementsByTagName('PathAndCredentials')[0]
        ?.getAttributeNS('http://schemas.microsoft.com/WMIConfig/2002/State', 'keyValue'),
    ).toBe('1');
    expect(
      doc.getElementsByTagName('PathAndCredentials')[0]?.getElementsByTagName('Path')[0]
        ?.textContent,
    ).toBe('\\\\server\\share\\Drivers & Tools');
    expect(result.wipesDisk).toBe(true);
    for (const command of Array.from(doc.getElementsByTagName('RunSynchronousCommand')))
      expect(command.getElementsByTagName('Path')[0]!.textContent!.length).toBeLessThanOrEqual(259);
    expect(
      Array.from(doc.getElementsByTagName('CommandLine')).every(
        (n) => n.textContent!.length <= 1024,
      ),
    ).toBe(true);
  });
  it('does not put metadata in the answer file and is deterministic', () => {
    const o = fullOptions();
    const result = generateUnattend(o);
    expect(
      generateUnattend({
        ...o,
        name: 'renamed',
        description: 'Another description',
        windowsBuilds: ['25H2'],
      }).xml,
    ).toBe(result.xml);
    expect(generateUnattend(o)).toEqual(result);
    expect(exportBundle(o, result)).toBe(exportBundle(o, generateUnattend(o)));
  });
  it('encodes Unicode passwords exactly as UTF-16LE, without claiming encryption', () => {
    const o = fullOptions();
    const result = generateUnattend(o);
    const doc = document(result.xml);
    const values = Array.from(doc.getElementsByTagName('Value')).map((n) => n.textContent);
    const expected = Buffer.from(o.accounts[0]!.password + 'Password', 'utf16le').toString(
      'base64',
    );
    expect(values.filter((v) => v === expected)).toHaveLength(2);
    expect(result.warnings.find((w) => w.code === 'plaintext-password')?.message).toContain(
      'recoverable',
    );
    expect(doc.getElementsByTagName('Password')[0]?.textContent).toContain('<&"secret');
  });
  it('uses a single ordered first-logon runner and transports large scripts within command limits', () => {
    const o = fullOptions();
    o.scripts = [
      { kind: 'powershell', content: "Write-Output 'αβ世界'\n".repeat(500) },
      { kind: 'command', content: 'echo done' },
    ];
    const result = generateUnattend(o);
    const doc = document(result.xml);
    expect(
      doc.getElementsByTagName('FirstLogonCommands')[0]?.getElementsByTagName('SynchronousCommand')
        .length,
    ).toBe(1);
    const paths = Array.from(doc.getElementsByTagName('RunSynchronousCommand')).map(
      (n) => n.getElementsByTagName('Path')[0]!.textContent!,
    );
    expect(paths.every((p) => p.length <= 259)).toBe(true);
    const chunks = paths
      .filter((p) => p.includes('kyro-firstlogon.b64" echo'))
      .map((p) => p.split(' echo ')[1]);
    const decoded = Buffer.from(chunks.join(''), 'base64').toString('utf16le');
    expect(decoded).toContain(o.scripts[0]!.content);
    expect(decoded.indexOf('αβ世界')).toBeLessThan(decoded.indexOf('echo done'));
    expect(doc.getElementsByTagName('CommandLine')[0]!.textContent!.length).toBeLessThanOrEqual(
      1024,
    );
  });
  it('marks arbitrary scripts as potentially destructive even when they are encoded', () => {
    const result = generateUnattend({
      ...defaults(),
      scripts: [{ kind: 'powershell', content: 'Clear-Disk -Number 0' }],
    });
    expect(result.xml).not.toContain('Clear-Disk');
    expect(result.wipesDisk).toBe(true);
  });
  it('rejects combined scripts that exceed the 500 setup-command limit', () => {
    expect(() =>
      generateUnattend({
        ...defaults(),
        scripts: Array.from({ length: 3 }, () => ({
          kind: 'powershell' as const,
          content: '#'.repeat(16000),
        })),
      }),
    ).toThrow(/500 setup commands/);
  });
  it('requires every disk choice plus a current wipe confirmation', () => {
    for (const partial of [
      {},
      { diskNumber: '0' },
      { diskNumber: '0', diskLayout: 'basic' as const },
      { diskNumber: '0', diskLayout: 'basic' as const, confirmWipe: false },
    ]) {
      expect(() => generateUnattend({ ...defaults(), diskMode: 'wipe', ...partial })).toThrow(
        OptionsError,
      );
    }
    const result = generateUnattend({
      ...defaults(),
      diskMode: 'wipe',
      diskNumber: '2',
      diskLayout: 'basic',
      confirmWipe: true,
    });
    const doc = document(result.xml);
    expect(doc.getElementsByTagName('WillWipeDisk')[0]?.textContent).toBe('true');
    expect(result.warnings.find((w) => w.code === 'disk-wipe')?.message).toContain('Disk 2');
  });
  it('escapes arbitrary representable text and round-trips with an independent XML parser', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.integer({ min: 0, max: 0x10ffff }), { maxLength: 80 })
          .map((chars) => String.fromCodePoint(...chars))
          .filter(validXmlText),
        (value) => {
          const o = {
            ...defaults(),
            accounts: [
              {
                name: 'deploy',
                displayName: value,
                password: value,
                group: 'Administrators' as const,
              },
            ],
          };
          const xml = generateUnattend(o).xml;
          const doc = document(xml);
          if (value) expect(doc.getElementsByTagName('DisplayName')[0]?.textContent).toBe(value);
          expect(base64Utf16(value)).toBe(Buffer.from(value, 'utf16le').toString('base64'));
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe('validation and advanced XML', () => {
  it.each(['\u0000', '\u0001', '\ud800', '\udfff', '\ufffe', '\uffff'])(
    'rejects XML-invalid text %j',
    (value) => {
      expect(validateOptions({ ...defaults(), description: value }).length).toBeGreaterThan(0);
    },
  );
  it.each([
    null,
    [],
    {},
    { ...defaults(), unexpected: true },
    { ...defaults(), accounts: [{ name: 12 }] },
    { ...defaults(), efiSize: NaN },
  ])('rejects malformed input without generating partial output', (input) => {
    expect(validateOptions(input).length).toBeGreaterThan(0);
    expect(() => generateUnattend(input as Options)).toThrow(OptionsError);
  });
  it.each([
    'PC-{{serial}}',
    'PC-{{uuid}}',
    'PC-{{mac:64}}',
    '{{mac}}',
    '{{serial:8}}',
    '12-{{mac:8}}',
    '{{mac:0}}',
    '{{unknown:3}}',
    '12345',
    '-PC',
    'PC-',
    'ABCDEFGHIJKLMNOP',
  ])('rejects invalid or overlong names: %s', (computerName) => {
    expect(
      validateOptions({ ...defaults(), computerName }).some((i) => i.path === 'computerName'),
    ).toBe(true);
  });
  it.each(['PC-{{serial:8}}', 'PC-{{mac:10}}', 'X'.repeat(15), 'PC-{{mac}}'])(
    'accepts valid names: %s',
    (computerName) => {
      expect(validateOptions({ ...defaults(), computerName })).toEqual([]);
    },
  );
  it('rejects duplicate and built-in users and package-name command injection', () => {
    const o = fullOptions();
    o.accounts.push({ ...o.accounts[0]!, name: 'DEPLOY' });
    o.removeApps = ["App';Remove-Item C:\\ -Recurse;"];
    expect(validateOptions(o).map((i) => i.path)).toEqual(
      expect.arrayContaining(['accounts.1.name', 'removeApps.0']),
    );
    o.accounts = [{ ...o.accounts[0]!, name: 'Administrator' }];
    expect(validateOptions(o).some((i) => i.path === 'accounts.0.name')).toBe(true);
  });
  it('preserves fragments byte for byte, including whitespace and CDATA', () => {
    const fragment = '<RegisteredOwner>\n  <![CDATA[Owner <&>]]>\n</RegisteredOwner>';
    const result = generateUnattend({
      ...defaults(),
      fragments: [
        { pass: 'specialize', component: 'Microsoft-Windows-Shell-Setup', xml: fragment },
      ],
    });
    expect(result.xml).toContain(fragment);
    document(result.xml);
  });
  it.each([
    '<!DOCTYPE test><A/>',
    '<?run x?><A/>',
    '<A>',
    '<x:A/>',
    '<A>&unknown;</A>',
    '</unattend><A/>',
    '<?xml version="1.0"?><A/>',
  ])('rejects unsafe or malformed fragments: %s', (xml) => {
    expect(checkXml(xml, true).error).toBeDefined();
  });
  it('rejects conflicting generated or raw child elements', () => {
    expect(() =>
      generateUnattend({
        ...defaults(),
        computerName: 'WORKSTATION',
        fragments: [
          {
            pass: 'specialize',
            component: 'Microsoft-Windows-Shell-Setup',
            xml: '<ComputerName>OTHER</ComputerName>',
          },
        ],
      }),
    ).toThrow(/conflicts/);
    expect(() =>
      generateUnattend({
        ...defaults(),
        fragments: [
          {
            pass: 'specialize',
            component: 'Microsoft-Windows-Shell-Setup',
            xml: '<TimeZone>UTC</TimeZone><TimeZone>UTC</TimeZone>',
          },
        ],
      }),
    ).toThrow(/conflicts/);
  });
  it('checks known Kyro token suffixes on raw bytes and preserves escaped literals', () => {
    for (const token of ['{{mac:0}}', '{{uuid:65}}', '{{serial:01}}', '{{callback_url:8}}']) {
      expect(checkXml(`<unattend xmlns="${namespace}">${token}</unattend>`).error).toContain(
        'token lengths',
      );
    }
    expect(
      checkXml(`<unattend xmlns="${namespace}">&#123;&#123;mac:0}}</unattend>`).error,
    ).toBeUndefined();
  });
});

describe('current Kyro alpha bundles and imports', () => {
  it('exports the exact v0 contract, numeric build strings and no unknown fields', () => {
    const o = fullOptions();
    const result = generateUnattend(o);
    const bundle = JSON.parse(exportBundle(o, result));
    expect(Object.keys(bundle)).toEqual([
      'bundle_version',
      'name',
      'description',
      'wipes_disk',
      'warnings',
      'windows_builds',
      'answer_file',
    ]);
    expect(bundle.bundle_version).toBe(0);
    expect(bundle.windows_builds).toEqual(['26100', '26200']);
    expect(bundle.wipes_disk).toBe(true);
    expect(bundle.answer_file).toBe(result.xml);
    const imported = parseImport(JSON.stringify(bundle));
    expect(imported.kind).toBe('profile');
    if (imported.kind === 'profile') expect(imported.profile.xml).toBe(result.xml);
  });
  it('round-trips settings and requires fresh destructive confirmation', () => {
    const o = fullOptions();
    const loaded = parseImport(exportSettings(o));
    expect(loaded.kind).toBe('settings');
    if (loaded.kind === 'settings') expect(loaded.options).toEqual({ ...o, confirmWipe: false });
  });
  it('preserves bare XML on import and rejects invalid roots and DTDs', () => {
    const xml = generateUnattend(defaults()).xml;
    const imported = parseImport(xml);
    if (imported.kind === 'profile') expect(imported.profile.xml).toBe(xml);
    expect(() => parseImport('<root/>')).toThrow(/root/);
    expect(() => parseImport(xml.replace('utf-8', 'UTF-16'))).toThrow(/UTF-8/);
    expect(() => parseImport('<!DOCTYPE unattend>' + xml.replace(/<\?xml[^>]*>/, ''))).toThrow(
      /DOCTYPE/,
    );
    expect(inspectImported(xml).wipesDisk).toBe(false);
  });
  it.each([
    { bundle_version: 1 },
    { bundle_version: 0, answer_file: '<unattend/>', wipes_disk: false, extra: true },
    { bundle_version: 0, answer_file: 'x' },
    { format: 'kyro-generator-settings', version: 7 },
  ])('rejects unsupported or malformed bundles', (data) => {
    expect(() => parseImport(JSON.stringify(data))).toThrow();
  });
  it('enforces file size, including the complete JSON wrapper', () => {
    expect(() => parseImport(' '.repeat(2 * 1024 * 1024 + 1))).toThrow(/2 MiB/);
    expect(() =>
      exportBundle(defaults(), {
        xml: 'a'.repeat(2 * 1024 * 1024),
        warnings: [],
        wipesDisk: false,
      }),
    ).toThrow(/2 MiB/);
  });
});
