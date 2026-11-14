import { builds, defaults, passes, type Issue, type Options } from './types';
import { checkXml, validXmlText } from './xml';

type Rule = (value: unknown, path: string, issues: Issue[]) => void;
const text: Rule = (v, p, i) => {
  if (typeof v !== 'string') i.push({ path: p, message: 'Must be text.' });
  else if (v.length > 65536 || !validXmlText(v))
    i.push({ path: p, message: 'Text is too long or contains characters XML cannot represent.' });
};
const bool: Rule = (v, p, i) => {
  if (typeof v !== 'boolean') i.push({ path: p, message: 'Must be true or false.' });
};
const integer: Rule = (v, p, i) => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v))
    i.push({ path: p, message: 'Must be a whole number.' });
};
function list(rule: Rule, max = 100): Rule {
  return (v, p, i) => {
    if (!Array.isArray(v) || v.length > max) {
      i.push({ path: p, message: `Must be a list of at most ${max} items.` });
      return;
    }
    v.forEach((item, n) => rule(item, `${p}.${n}`, i));
  };
}
function shape(fields: Record<string, Rule>): Rule {
  return (v, p, i) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      i.push({ path: p, message: 'Must be an object.' });
      return;
    }
    const object = v as Record<string, unknown>;
    for (const key of Object.keys(object))
      if (!Object.hasOwn(fields, key))
        i.push({
          path: `${p}.${key}`,
          message: 'Unknown setting. Use a settings file from this generator.',
        });
    for (const [key, rule] of Object.entries(fields)) rule(object[key], p ? `${p}.${key}` : key, i);
  };
}
const fields: Record<string, Rule> = Object.fromEntries(
  Object.entries(defaults()).map(([k, v]) => [
    k,
    typeof v === 'string' ? text : typeof v === 'boolean' ? bool : integer,
  ]),
);
Object.assign(fields, {
  windowsBuilds: list(text, 2),
  accounts: list(shape({ name: text, displayName: text, password: text, group: text }), 15),
  oobe: shape({
    hideEula: bool,
    hideOem: bool,
    hideOnline: bool,
    hideWireless: bool,
    protect: text,
  }),
  domain: shape({ enabled: bool, name: text, username: text, password: text, ou: text }),
  driversPE: list(text, 20),
  driversSystem: list(text, 20),
  removeApps: list(text, 64),
  bypass: list(text, 5),
  scripts: list(shape({ kind: text, content: text }), 20),
  fragments: list(shape({ pass: text, component: text, xml: text }), 20),
});

export function validateOptions(input: unknown): Issue[] {
  const issues: Issue[] = [];
  shape(fields)(input, '', issues);
  if (issues.length) return issues;
  const o = input as Options;
  const require = (condition: boolean, path: string, message: string) => {
    if (!condition) issues.push({ path, message });
  };
  const match = (value: string, regex: RegExp, path: string, message: string) =>
    require(regex.test(value), path, message);
  require(o.schemaVersion ===
    1, 'schemaVersion', 'Unsupported settings version. This generator reads version 1.');
  match(
    o.name,
    /^[a-z0-9][a-z0-9-]{0,62}$/,
    'name',
    'Use 1 to 63 lowercase letters, digits or hyphens; start with a letter or digit.',
  );
  require(new TextEncoder().encode(o.description).length <=
    2000, 'description', 'Keep the description to 2000 UTF-8 bytes.');
  require(o.windowsBuilds.length > 0 &&
    new Set(o.windowsBuilds).size === o.windowsBuilds.length &&
    o.windowsBuilds.every((b) =>
      Object.hasOwn(builds, b),
    ), 'windowsBuilds', 'Choose at least one supported Windows build without duplicates.');
  for (const key of ['language', 'userLocale', 'systemLocale'] as const)
    if (o[key])
      match(
        o[key],
        /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){1,3}$/,
        key,
        'Use a Windows locale such as en-US or de-DE.',
      );
  if (o.keyboard)
    match(
      o.keyboard,
      /^(?:[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){1,3}|[0-9a-fA-F]{4}:[0-9a-fA-F]{8})(?:;(?:[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8}){1,3}|[0-9a-fA-F]{4}:[0-9a-fA-F]{8}))*$/,
      'keyboard',
      'Use locale codes or layout IDs separated by semicolons, such as en-US;de-DE.',
    );
  if (o.timeZone)
    match(
      o.timeZone,
      /^[A-Za-z0-9 .()+-]{1,80}$/,
      'timeZone',
      'Use a Windows time zone ID, such as W. Europe Standard Time.',
    );
  require(['interactive', 'index', 'name', 'key'].includes(
    o.editionMode,
  ), 'editionMode', 'Choose an edition selection method.');
  if (o.editionMode === 'index')
    match(
      o.editionValue,
      /^[1-9][0-9]{0,3}$/,
      'editionValue',
      'Enter an image index from 1 to 9999.',
    );
  if (o.editionMode === 'name')
    require(o.editionValue.trim().length > 0 &&
      o.editionValue.length <=
        200, 'editionValue', 'Enter the exact image name, at most 200 characters.');
  if (o.editionMode === 'key')
    match(
      o.editionValue,
      /^(?:[A-Z0-9]{5}-){4}[A-Z0-9]{5}$/i,
      'editionValue',
      'Enter a product key in XXXXX-XXXXX-XXXXX-XXXXX-XXXXX format.',
    );
  require(['interactive', 'wipe'].includes(
    o.diskMode,
  ), 'diskMode', 'Choose interactive partitioning or a disk wipe.');
  if (o.diskMode === 'wipe') {
    match(o.diskNumber, /^(?:0|[1-9][0-9]?)$/, 'diskNumber', 'Enter the disk number from 0 to 99.');
    require(['basic', 'with-recovery'].includes(
      o.diskLayout,
    ), 'diskLayout', 'Choose a GPT partition layout.');
    require(o.confirmWipe, 'confirmWipe', 'Confirm that the selected disk may be erased before exporting.');
  }
  require(o.efiSize >= 300 &&
    o.efiSize <= 4096, 'efiSize', 'The EFI partition must be 300 to 4096 MB.');
  require(o.recoverySize >= 1024 &&
    o.recoverySize <= 16384, 'recoverySize', 'The recovery partition must be 1024 to 16384 MB.');
  if (o.computerName) {
    const literal = o.computerName.replace(
      /\{\{(mac|serial|uuid)(?::([1-9][0-9]?))?\}\}/g,
      (_token, _name: string, size: string | undefined) => {
        const length = size ? Number(size) : _name === 'mac' ? 12 : 64;
        require(length <= 64, 'computerName', 'Token lengths must be between 1 and 64.');
        return 'X';
      },
    );
    const literalLength = o.computerName.replace(
      /\{\{(mac|serial|uuid)(?::([1-9][0-9]?))?\}\}/g,
      '',
    ).length;
    const tokenLengths = [
      ...o.computerName.matchAll(/\{\{(mac|serial|uuid)(?::([1-9][0-9]?))?\}\}/g),
    ].reduce((n, m) => n + (m[2] ? Number(m[2]) : m[1] === 'mac' ? 12 : 64), 0);
    require(literalLength + tokenLengths <= 15 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(literal) &&
      !/^\d+$/.test(
        literal,
      ), 'computerName', 'Use a valid name up to 15 characters. Kyro tokens serial and uuid need a length, for example PC-{{serial:8}}.');
    if (tokenLengths) {
      const fixed = o.computerName.replace(/\{\{[^}]+\}\}/g, '');
      require(/^[A-Za-z0-9]/.test(o.computerName) &&
        /[A-Za-z]/.test(
          fixed,
        ), 'computerName', 'Start a token pattern with a literal letter or digit and include a literal letter, such as PC-{{mac:10}}, so every rendered name remains valid.');
    }
  }
  const accountNames = new Set<string>();
  o.accounts.forEach((a, n) => {
    const p = `accounts.${n}`;
    match(
      a.name,
      /^(?![ .])(?!.*[ .]$)[^"/\\[\]:;|=,+*?<>@\x00-\x1f]{1,20}$/,
      `${p}.name`,
      'Use a Windows local account name, 1 to 20 characters without reserved punctuation.',
    );
    require(!['administrator', 'guest', 'defaultaccount', 'wdagutilityaccount', 'system'].includes(
      a.name.toLowerCase(),
    ), `${p}.name`, 'Choose a name other than a built-in Windows account.');
    require(!accountNames.has(
      a.name.toLowerCase(),
    ), `${p}.name`, 'Account names must be unique, ignoring case.');
    accountNames.add(a.name.toLowerCase());
    require(a.displayName.length <= 256 &&
      a.password.length <= 256, p, 'Display names and passwords must be at most 256 characters.');
    require(['Administrators', 'Users'].includes(
      a.group,
    ), `${p}.group`, 'Choose administrator or standard user.');
  });
  require(!o.accounts.length ||
    o.domain.enabled ||
    o.accounts.some(
      (a) => a.group === 'Administrators',
    ), 'accounts', 'Create at least one administrator, or configure a domain join.');
  require(!o.autoLogon ||
    o.accounts.some(
      (a) => a.name === o.autoLogon,
    ), 'autoLogon', 'Choose an existing local account for automatic logon.');
  require(o.autoLogonCount >= 1 &&
    o.autoLogonCount <= 999, 'autoLogonCount', 'Choose 1 to 999 automatic logons.');
  require(['', '1', '2', '3'].includes(
    o.oobe.protect,
  ), 'oobe.protect', 'Choose a documented express settings value.');
  if (o.domain.enabled) {
    match(
      o.domain.name,
      /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/,
      'domain.name',
      'Enter the DNS domain name.',
    );
    require(o.domain.username.trim().length > 0 &&
      o.domain.password.length > 0, 'domain', 'Domain join needs a user name and password.');
  }
  for (const key of ['driversPE', 'driversSystem'] as const)
    o[key].forEach((path, n) =>
      require(path.trim().length > 0 &&
        path.length <= 259 &&
        !/[\r\n]/.test(path), `${key}.${n}`, 'Enter a folder path, at most 259 characters.'),
    );
  o.removeApps.forEach((app, n) =>
    match(
      app,
      /^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/,
      `removeApps.${n}`,
      'Use a package identity of 3 to 50 letters, digits, dots or hyphens.',
    ),
  );
  require(new Set(o.removeApps).size ===
    o.removeApps.length, 'removeApps', 'Remove duplicate package names.');
  o.scripts.forEach((s, n) => {
    require(['command', 'powershell'].includes(
      s.kind,
    ), `scripts.${n}.kind`, 'Choose command or PowerShell.');
    require(s.content.trim().length > 0 &&
      s.content.length <= (s.kind === 'command' ? 1024 : 16384), `scripts.${n}.content`, s.kind ===
      'command'
      ? 'Enter a command of at most 1024 characters.'
      : 'Enter a PowerShell script of at most 16384 characters.');
  });
  o.bypass.forEach((b) =>
    require(['TPM', 'SecureBoot', 'RAM', 'CPU', 'Storage'].includes(
      b,
    ), 'bypass', 'Choose a known hardware check.'),
  );
  require(new Set(o.bypass).size ===
    o.bypass.length, 'bypass', 'Remove duplicate hardware checks.');
  o.fragments.forEach((f, n) => {
    require((passes as readonly string[]).includes(
      f.pass,
    ), `fragments.${n}.pass`, 'Choose a supported setup pass.');
    match(
      f.component,
      /^Microsoft-Windows-[A-Za-z0-9-]{1,100}$/,
      `fragments.${n}.component`,
      'Enter a Microsoft-Windows component name.',
    );
    require(f.xml.trim().length >
      0, `fragments.${n}.xml`, 'Enter XML child elements for this component.');
    const parsed = checkXml(f.xml, true);
    require(!parsed.error, `fragments.${n}.xml`, parsed.error ?? 'Invalid XML.');
  });
  return issues;
}

export class OptionsError extends Error {
  constructor(public issues: Issue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
    this.name = 'OptionsError';
  }
}
