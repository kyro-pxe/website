# ADR 0001: Generator option set, output rules and UI framework for v1

- **Status:** Proposed on 2026-11-12. Waiting for maintainer review. Nothing
  described here is implemented.
- **Date:** 2026-11-12
- **Deciders:** Kyro maintainers

> **Evidence level.** The settings below were checked against Microsoft's
> public unattend reference, listed under [References](#references). No
> answer file produced by this design has been run through Windows Setup yet.
> Windows System Image Manager, the only tool that validates an answer file
> against an image, does not run on Linux. Every behaviour that the
> documentation does not state is collected under
> [To validate](#to-validate) and goes into the manual test plan
> (`docs/testing-generator.md`, written in a later step). If a test
> contradicts this record, the record is revised.

## Context

The Kyro website gets a generator for Windows `autounattend.xml` files at
`/generator`. It runs entirely in the browser. The user downloads the result
as plain XML or as a Kyro bundle (`.kyro.json`) and imports it into Kyro.
Kyro treats the XML as an opaque file and only substitutes the tokens
`{{mac}}`, `{{serial}}` and `{{uuid}}` when it serves the file.

This record fixes three things before any code is written: which options v1
offers, the rules for turning them into XML, and the UI framework.

## Principles

1. **Documented settings only.** v1 emits settings from Microsoft's unattend
   reference. The single exception is the LabConfig bypass, which is opt-in
   and labelled as unsupported.
2. **Unset means absent.** An option the user leaves alone produces no XML.
   There are no hidden tweaks, no preselected app removals and no silent
   privacy or telemetry changes. The generated file contains what the form
   shows and nothing else.
3. **Destructive and unsupported behaviour needs its own field.** Wiping a
   disk and bypassing hardware checks are never the result of a default or of
   another option.
4. **Every secret produces a warning.** The generator cannot make an answer
   file confidential, so it says so each time.
5. **User text never becomes code.** Text typed by the user reaches XML as
   escaped character data. It reaches a command line only as Base64 or after
   passing an allowlist grammar. See [Escaping](#escaping-strategy).
6. **Deterministic.** The same options and generator version give
   byte-identical XML and bundle output. No timestamps, no random values.
7. **Kyro stays ignorant.** Nothing in the output requires Kyro to understand
   generator options.

## Target

- Windows 11, releases 24H2 and 25H2.
- x86-64 only (`processorArchitecture="amd64"`). Kyro's primary path is UEFI
  x86-64. ARM64 is not in v1.
- Clean installation through Windows Setup. No upgrade, no Sysprep, no audit
  mode.
- UEFI with GPT. Windows 11 does not install in legacy BIOS mode without a
  bypass, so MBR layouts are not offered.

## Option set for v1

Each group can be left out entirely. "Interactive" below means that the
generator emits nothing and Windows Setup asks the user as usual.

| Group | Options | Pass and component |
| ----- | ------- | ------------------ |
| Profile | name, description, target builds | Bundle metadata only, not in the XML |
| Language and region | display language, formats, system locale, keyboards, time zone | `windowsPE` International-Core-WinPE, `oobeSystem` International-Core, `specialize` Shell-Setup |
| License terms | accept the license terms during Setup | `windowsPE` Setup |
| Edition | interactive, image index, image name, or own product key | `windowsPE` Setup |
| Disk | interactive, or wipe one disk with a UEFI/GPT preset | `windowsPE` Setup |
| Computer name | not set, static, or pattern with Kyro tokens | `specialize` Shell-Setup |
| Local accounts | interactive, or a list of accounts; optional automatic logon | `oobeSystem` Shell-Setup |
| OOBE | individual documented page skips | `oobeSystem` Shell-Setup |
| Domain join | off, or join with credentials | `specialize` UnattendedJoin |
| Driver paths | folders for Windows PE and for the installed system | `windowsPE` PnpCustomizationsWinPE, `offlineServicing` PnpCustomizationsNonWinPE |
| App removal | list of provisioned app packages chosen by the user | `specialize` Deployment |
| First-logon scripts | ordered commands and PowerShell scripts | `oobeSystem` Shell-Setup |
| Hardware check bypass | opt-in LabConfig values, one per check | `windowsPE` Setup |
| Raw XML | user-supplied fragments, passed through unchanged | Any pass, any component |

### Profile

`name` (required), `description` (optional, at most 500 characters) and
`windowsBuilds` (non-empty subset of `24H2`, `25H2`). They are written to the
bundle. They are not written into the XML, so renaming a profile does not
change the answer file.

### Language and region

- Display language (`UILanguage`), regional format (`UserLocale`), system
  locale (`SystemLocale`) and one or more keyboards (`InputLocale`), written
  to both `windowsPE` and `oobeSystem`. Setup's own language
  (`SetupUILanguage`) is set to the display language.
- Time zone (`TimeZone`), a Windows time zone name such as
  `W. Europe Standard Time`.
- The form offers lists taken from Microsoft's published tables and fills
  the three locale fields from the display language as a convenience. The
  core logic takes all values explicitly.
- Values are checked against a strict pattern. A value that matches the
  pattern but is not in the known list is accepted with a warning, because
  the lists can lag behind Windows.
- A display language must exist in the image. The generator cannot check
  that, so it says so once.

### License terms

One checkbox, off by default: accept the Microsoft Software License Terms
during Setup (`UserData/AcceptEula`). The form states that ticking it accepts
the terms for every machine installed with the file. Without it, Setup shows
the license page. Hiding the license page in OOBE is a separate option.

### Edition

- **Interactive.** Setup asks.
- **Image index** or **image name**, written as
  `ImageInstall/OSImage/InstallFrom/MetaData` with `/IMAGE/INDEX` or
  `/IMAGE/NAME`. Index is a positive integer. The form explains how to list
  the images of an ISO with `DISM /Get-ImageInfo`.
- **Own product key**, written as `UserData/ProductKey/Key`. Microsoft
  documents this key as the one that selects the image to install. The key
  is validated by format only and produces a secret warning.

The generator ships no product keys. See
[open question 2](#open-questions-for-the-maintainer).

### Disk

- **Interactive** (default). Setup shows its disk page. Nothing is emitted.
- **Wipe and partition.** Requires three explicit fields with no defaults: the
  disk number, the layout preset, and `confirmWipe: true`. Without the
  confirmation the options are invalid and no XML is produced. With it, the
  output always carries a `disk-wipe` warning that names the disk number.

Presets, both GPT with a FAT32 EFI system partition and a 16 MB Microsoft
reserved partition:

| Preset | Partitions | How it is created |
| ------ | ---------- | ----------------- |
| `basic` | EFI, MSR, Windows (rest of the disk) | `DiskConfiguration` elements, fully declarative |
| `with-recovery` | EFI, MSR, Windows, recovery (at the end) | `diskpart` script run from `windowsPE` `RunSynchronous` |

- `with-recovery` is the layout Microsoft documents as the default for UEFI
  PCs. Microsoft requires the recovery partition directly after the Windows
  partition. `DiskConfiguration` can only extend the last partition it
  creates, so it cannot express "the rest of the disk minus the recovery
  partition". The preset therefore writes a `diskpart` script that follows
  Microsoft's published sample: create the Windows partition, shrink it,
  create the recovery partition with type ID
  `DE94BBA4-06D1-4D40-A16A-BFD50179D6AC`. The script consists of fixed text
  and validated integers. No user text reaches it.
- `basic` has no recovery partition. Microsoft states that the recovery
  partition must be separate from the Windows partition to support booting
  BitLocker-encrypted partitions and automatic failover. The form says so.
- Sizes are options with documented defaults: EFI 300 MB (Microsoft's
  minimum is 200 MB, or 300 MB on 4K native drives), recovery 1024 MB
  (Microsoft recommends at least 990 MB for partitions created by a custom
  script).
- Both presets set `InstallTo` to the Windows partition of the chosen disk.

### Computer name

- **Not set.** Windows generates a name.
- **Static.** 1 to 15 characters from `A-Z`, `a-z`, `0-9` and `-`, not
  starting or ending with `-`, not digits only. This is stricter than
  Microsoft's rule (15 bytes, a list of forbidden characters, must pass DNS
  validation). The stricter rule is easy to explain and always valid.
- **Pattern.** Literal characters as above plus the Kyro tokens `{{mac}}`,
  `{{serial}}` and `{{uuid}}`, each with an optional length such as
  `{{serial:15}}`. The form offers the tokens as buttons and states that a
  Windows computer name has at most 15 characters.

Pattern rules:

- The generator computes the longest name a pattern can produce and rejects
  the pattern if that exceeds 15. `{{serial}}` and `{{uuid}}` have no upper
  bound that fits, so they need a length. `{{mac}}` is assumed to be 12
  characters. See [open question 1](#open-questions-for-the-maintainer).
- A pattern only works when Kyro serves the file. Windows Setup would reject
  a literal `{{serial:8}}` as a name. Using a pattern therefore adds a
  warning to the output, and the plain XML download repeats it.
- Kyro substitutes tokens in the whole file. If token-like text appears in
  any other field, such as a script, the generator warns that Kyro will
  replace it. v1 has no way to write a literal `{{mac}}`.

### Local accounts

- **Interactive.** OOBE asks. Nothing is emitted.
- **List of accounts.** Each has a name, an optional display name, a group
  (`Administrators` or `Users`) and a password.
  - Names are validated against Windows' rules for local user names and
    against the built-in account names. Duplicates are rejected without
    regard to case.
  - At least one account must be in `Administrators`, unless a domain join is
    configured. In that case a missing administrator is a warning.
  - An empty password is allowed and produces a warning.
- **Automatic logon** (optional): one of the listed accounts and a count.
  Needed if first-logon scripts should run without someone signing in. It
  writes the account's password a second time and produces its own warning.

Passwords are written the way Windows System Image Manager hides them:
`PlainText` is `false` and `Value` is the Base64 form of the UTF-16LE
password with the element name appended. Microsoft's own example uses this
form. It is an encoding, not encryption, and anyone can reverse it. It is
chosen because it is what Setup's tooling produces and because Base64 needs
no XML escaping. The warning text says plainly that the password is
recoverable.

### OOBE

Only settings that Microsoft documents for client editions, each a separate
choice with no default:

- `HideEULAPage`
- `HideOEMRegistrationScreen`
- `HideOnlineAccountScreens`
- `HideWirelessSetupInOOBE`
- `ProtectYourPC`, where the form shows what each value means. Value 3 turns
  the express settings off, values 1 and 2 turn them on.

Not offered: `HideLocalAccountScreen` (documented as applying to Windows
Server only), `NetworkLocation`, `SkipMachineOOBE` and `SkipUserOOBE`.
Registry-based workarounds for the network or account requirement are not
part of v1.

### Domain join

Off by default. When enabled: domain name, user name, password, and an
optional organizational unit (`MachineObjectOU`).

- The schema has no hidden form for this password. It is written as plain
  text and escaped for XML.
- The output always carries a warning that recommends an account that may
  only join computers to one organizational unit.
- Not in v1: offline domain join (`Provisioning/AccountData`). It avoids a
  reusable credential, but each blob is valid for one computer, which does
  not fit a profile that serves many machines. `UnsecureJoin` and
  `MachinePassword` are not offered either.

### Driver paths

Two lists of folders: one for Windows PE (`PnpCustomizationsWinPE`, drivers
needed during Setup) and one for the installed system
(`PnpCustomizationsNonWinPE`, `offlineServicing` pass). Paths are escaped as
XML text. v1 does not write credentials for network paths.

### App removal

A list of provisioned app package names. The form offers a catalogue built
from Microsoft's published list of apps provisioned in Windows 11, filtered
by the selected builds, with nothing ticked. Other names can be typed in.

- Each name must match the package identity grammar (letters, digits, `.`
  and `-`, 3 to 50 characters). Anything else is rejected, so a name can
  never break out of the command it is placed in.
- Each package becomes one `RunSynchronousCommand` in the `specialize` pass
  that calls `Remove-AppxProvisionedPackage -Online` for that name. The
  `specialize` pass runs before any user profile exists, so the apps are not
  installed for the accounts created afterwards. Each command stays under the
  documented limit of 259 characters.
- A name that is not present in the image removes nothing and does not stop
  Setup.

### First-logon scripts

An ordered list. Each entry is one of:

- **Command.** One command line, at most 1024 characters (Microsoft's limit
  for `CommandLine`). It is written as given, escaped for XML only. The
  quoting inside is the user's own.
- **PowerShell script.** Any text up to a size limit. It is transported as
  Base64, so its content needs no quoting at all:
  - If the encoded script fits into one command line, it is passed with
    `powershell.exe -EncodedCommand`.
  - Otherwise preceding commands append Base64 chunks to a file in the
    user's temporary folder, and a final command decodes, runs and deletes
    it. Only fixed text and Base64 characters appear in these commands.

Microsoft documents that first-logon commands may not run when the first
user is not an administrator. The generator warns when scripts exist and the
first account is a standard user, and notes that scripts wait for a first
sign-in unless automatic logon is configured.

Consulted prior art: the generator by Christoph Schneegans stores script
files inside the answer file and extracts them during Setup. That idea was
known to the author of this record from general use of that tool. Its source
was not consulted and no code is taken from it. The design here uses a
different mechanism (Base64 on the command line) that relies only on
documented elements.

### Hardware check bypass (LabConfig)

Off by default. When enabled, the user picks individual checks: TPM, Secure
Boot, RAM, CPU, storage. Each becomes a `reg add` command for
`HKLM\SYSTEM\Setup\LabConfig` in `windowsPE` `RunSynchronous`, as described
in Kyro's ADR 0001.

- The output always carries a `labconfig-bypass` warning: Microsoft does not
  support Windows 11 on hardware below its requirements, states that such
  devices are not entitled to updates, and the mechanism is undocumented and
  can stop working with any release.
- Kyro has its own per-image switch for the same bypass. The form mentions
  it so that users do not enable both without noticing.

### Raw XML fragments

For settings the form does not cover. Each fragment has a pass, a component
name, and XML that becomes child content of that component.

- **Unchanged.** A fragment is inserted byte for byte. It is not reformatted,
  re-indented, re-escaped or stripped. A test asserts that the output
  contains the exact input string. If a user's fragment already contains
  LabConfig commands, it stays as it is, whether the built-in switch is on or
  off.
- **Checked, not rewritten.** Before insertion a fragment must be well-formed
  XML, use only namespace prefixes that the document declares, and contain no
  document type declaration or processing instruction. A fragment that fails
  is rejected with the position of the problem. It is never repaired.
- **Placement.** If the generator emits the same component in the same pass,
  the fragment is appended inside it. Otherwise the generator creates the
  component element around it.
- **Conflicts are errors.** If a fragment's top-level element is one that the
  generator also emits in that component (for example `RunSynchronous` while
  the LabConfig switch is on), generation fails with a message that names
  both sources. The generator does not merge.
- Raw XML always adds a note that its content was not checked beyond being
  well-formed. If a fragment mentions `LabConfig`, the bypass warning is
  added as well.

## Not in v1

Listed so that nobody assumes they exist: Wi-Fi profiles, BitLocker,
registry or privacy presets, enabling the built-in Administrator, product
key catalogue, ARM64, BIOS/MBR layouts, layouts for several disks or dual
boot, credentials for driver paths, offline domain join, Microsoft Entra
join, language pack installation, Windows 10 and Windows Server.

## Windows build compatibility

- The supported builds are 24H2 and 25H2. Microsoft delivers 25H2 as an
  enablement package on top of 24H2, and both share one servicing branch.
  For every setting in v1 the two builds use the same components and
  elements.
- **The XML is therefore identical for both builds in v1.** The build
  selection affects three things: the `windowsBuilds` field of the bundle,
  the app catalogue shown in the form, and build-specific warnings.
- The core keeps a small table of per-build facts (`builds.ts`). An option
  that differs between builds reads from that table. When a later release
  diverges, the table is the single place to change, and the golden tests
  gain a file per build.
- Generated commands avoid tools that Microsoft has removed from current
  Windows 11 releases (WMIC, PowerShell 2.0). They use only `reg.exe`,
  `cmd.exe`, `diskpart.exe` and Windows PowerShell 5.1 cmdlets.
- Windows 11 24H2 introduced a new Setup front end. Which front end runs is
  decided by how Setup is started, which is Kyro's side. The test plan covers
  the answer file with both.

## Output format and determinism

- UTF-8 without a byte order mark, `\n` line endings, two-space indentation,
  the declaration `<?xml version="1.0" encoding="utf-8"?>`.
- Passes appear in Setup's processing order. Components within a pass and
  elements within a component appear in a fixed order defined in code, never
  in the order of object keys.
- Empty passes and empty components are not written.
- The XML contains no version number, date or profile name.
- The bundle is serialized with a fixed key order and two-space indentation.
  `generator.version` comes from `package.json`.

## Escaping strategy

User input reaches four kinds of output. Each has one rule.

| Context | Rule |
| ------- | ---- |
| XML text and attributes | Escape `&`, `<` and `>` everywhere, and `"`, tab, CR and LF in attributes. Because `>` is always escaped, `]]>` cannot occur. The generator emits no CDATA sections. Characters that XML 1.0 cannot represent (most control characters, unpaired surrogates, U+FFFE, U+FFFF) are rejected with an error, never dropped. |
| Command lines | User text is never interpolated. It appears only as Base64 (scripts) or after an allowlist grammar (package names, integers). |
| Raw XML | Not escaped and not altered. Checked for well-formedness, then inserted. CDATA inside a fragment is the user's and passes through. |
| Bundle JSON | `JSON.stringify`. On load, options are validated like fresh input. Nothing from a bundle is inserted into the page as HTML. |

Two quoting helpers exist for defence in depth and are covered by property
tests, even though v1 only feeds them validated input:

- A PowerShell single-quoted literal, which doubles `'` and the typographic
  quotation marks that PowerShell also accepts as string delimiters.
- A CDATA writer that splits `]]>`, in case a later version needs CDATA.

There is deliberately no helper that quotes arbitrary text for `cmd.exe`.
Its rules for `%`, `^`, `!` and quotes depend on context, and the design
above never needs it.

## Validation, errors and warnings

The core is pure TypeScript in `src/lib/unattend/` with no DOM access:

```ts
validateOptions(input: unknown): Issue[];            // empty means valid
generateUnattend(options: Options): { xml: string; warnings: Warning[] };
```

- `generateUnattend` throws a typed error with the list of issues if the
  options are invalid. It never returns partial XML.
- Validation is strict. Unknown keys, wrong types and out-of-range values are
  errors, each with the path of the field and a sentence a user can act on.
- The options object carries its own `schemaVersion`, so a later generator
  can migrate older bundles.
- Validators are written by hand. A schema library would be the largest
  dependency of the core for a fixed set of about fifty fields.

Warnings have a stable `code`, a `severity` (`info` or `warning`) and a
message. Planned codes:

| Code | When |
| ---- | ---- |
| `plaintext-password` | Any password is in the file. States that it is only encoded, stays in `C:\Windows\Panther`, and is served by Kyro over unauthenticated HTTP and SMB. |
| `domain-join-credentials` | Domain join is enabled. |
| `autologon` | Automatic logon is enabled. |
| `empty-password` | An account has an empty password. |
| `product-key` | A product key is in the file. |
| `disk-wipe` | A disk will be wiped. Names the disk number. |
| `labconfig-bypass` | The bypass is enabled or a raw fragment mentions LabConfig. |
| `kyro-tokens` | The computer name uses tokens, so the file needs Kyro. |
| `token-outside-computer-name` | Token-like text appears elsewhere. |
| `raw-xml` | Raw fragments are present. |
| `first-logon-needs-admin` | Scripts exist and the first user is not an administrator. |
| `eula-accepted` | The license terms are accepted by the file. |
| `unknown-value` | A language, time zone or app name is not in the known lists. |

## Bundle handling

- Download as `autounattend.xml` or as `<name>.kyro.json` following bundle
  spec v1. The generator does not change the spec.
- Loading a bundle: check `format` and `version`, validate `options` like
  fresh input, fill the form, then regenerate. If the regenerated XML differs
  from the `xml` in the bundle (older generator version or a file edited by
  hand), the page says so and shows which one it will keep on the next
  download: the regenerated one.
- A loaded bundle can contain a confirmed disk wipe or secrets. After
  loading, the page lists the warnings of the loaded profile before anything
  can be downloaded again.
- `options` contains passwords in clear text, because the form needs them to
  reload. See [open question 3](#open-questions-for-the-maintainer).

## UI framework

**Decision: Preact, with hooks, without a state library or component kit.**

| Criterion | Preact | Svelte 5 | No framework |
| --------- | ------ | -------- | ------------ |
| Runtime dependencies of the package | none | 15 | none |
| Type checking | TSX, checked by the same `astro check` run as the rest | separate `svelte-check` and language tooling | same as Preact |
| Shipped size for a small form (measured spike) | about 6 kB gzip for core and hooks | not measured | smallest |
| Fit for a form with about fifty dependent fields | good | good | poor: hand-written DOM updates are where escaping mistakes happen |
| License | MIT | MIT | not applicable |

- The generator handles passwords, so a short dependency list matters more
  than usual. Preact has no dependencies of its own. Svelte's package brings
  its compiler and fifteen dependencies into the build.
- Preact components are TypeScript functions. One type checker covers the
  core, the form and the Astro pages.
- Text rendered through JSX is escaped by construction. The XML preview is
  rendered as text. `dangerouslySetInnerHTML` is not used anywhere.
- All logic lives in the framework-free core. The form only holds state and
  calls the core, so replacing the framework later would not touch the
  generator.

**How it is mounted.** The page `/generator` is a standalone Astro page with
its own small layout, not a Starlight page, and the form is mounted from a
bundled module script instead of an Astro `client:*` directive. Both follow
from the strict Content Security Policy that step 5 requires:

- A Starlight page carries inline scripts and inline styles (theme switch,
  sidebar state, search). The first placeholder for `/generator`, which was a
  Starlight page, had ten inline scripts and sixteen inline `style`
  attributes. A policy without
  `'unsafe-inline'` would need a hash for each script, cannot allow the
  style attributes at all, and the search would need network access.
- Astro's `client:*` directives add an inline bootstrap script and an inline
  style to the page. A spike confirmed this. Mounting the same component from
  a bundled module produced a page with no inline code at all.
- Astro 7 can generate a hash-based policy (`security.csp`). It applies to
  the whole site and so depends on Starlight working under it. Keeping the
  generator page free of inline code is simpler and can be tested: a test
  reads the built `generator/index.html` and fails on any inline script,
  inline style, event handler attribute or external URL.

The policy is delivered as a `<meta>` element, because GitHub Pages cannot
set response headers, and additionally through `public/_headers` for
Cloudflare Pages.

## Test strategy

Detailed in step 6. Decisions that affect dependencies:

- vitest for unit, golden-file and determinism tests.
- An independent XML parser as a development dependency acts as the oracle
  in tests: every generated document must parse, and text must round-trip.
  The generator's own fragment checker is not used to judge the generator's
  output.
- Property tests for escaping use a property-testing library as a
  development dependency (fast-check, MIT), because shrinking failing inputs
  is what makes escaping bugs readable.
- No schema validation in CI. Microsoft's schema comes from the Windows
  image through Windows SIM. Correctness against real Setup is covered by
  the manual plan with the evaluation ISO in QEMU with OVMF.

## Consequences

- A user who leaves everything alone gets an almost empty file. The form has
  to make "what do I need for a fully unattended install" discoverable
  without ticking things for the user.
- Fully unattended installs require the disk wipe option. That is inherent,
  and the explicit confirmation stays.
- The raw XML feature needs a small XML well-formedness checker in the core.
  It is the most security-sensitive parsing code in the generator and gets
  property tests.
- The `with-recovery` preset and the chunked script transport depend on
  behaviour in Windows PE and Setup that only a real installation can
  confirm.

## To validate

These go into `docs/testing-generator.md`. Until a test has passed, the
corresponding option is labelled "untested" in the form.

1. `MetaData` image selection works when Setup is started the way Kyro
   starts it, and whether multi-edition media still asks for a key.
2. The `basic` preset installs, and where Windows RE ends up without a
   recovery partition.
3. The `with-recovery` preset: Setup sees the partitions created by
   `diskpart` in `RunSynchronous`, installs to partition 3 and places
   Windows RE on the recovery partition.
4. Local accounts with the encoded password can sign in, including passwords
   with non-ASCII characters.
5. The group name `Administrators` works on non-English media (German
   evaluation ISO).
6. `Remove-AppxProvisionedPackage -Online` works in the `specialize` pass.
7. Both script transports run at first logon, including a script with
   non-ASCII text.
8. Each OOBE setting hides what it claims on 24H2 and on 25H2.
9. Domain join with a name set through `ComputerName` in the same pass.
10. The LabConfig values are in place before Setup checks the hardware, with
    both Setup front ends.
11. Driver paths are honoured in both passes.

## Open questions for the maintainer

1. **Token details in bundle spec v1.** The generator has to compute the
   longest possible computer name, and Kyro has to produce valid names. The
   spec does not say:
   - the format of `{{mac}}` (assumed here: 12 hexadecimal characters
     without separators, which fits; with separators it would be 17
     characters and contain characters that are invalid in a name),
   - whether `{{uuid}}` contains hyphens,
   - whether a length keeps the first or the last characters,
   - whether Kyro removes characters from serial numbers that are invalid in
     a computer name, and what it does with empty or placeholder serials,
   - whether there is a way to write a literal `{{mac}}`.
2. **Product keys.** Microsoft publishes generic keys that select an edition
   without activating it. Offering them would make edition selection easier.
   This record does not include them, because shipping any product key is a
   legal decision for the maintainer.
3. **Passwords in bundle `options`.** They are stored in clear text so that a
   bundle can be reloaded completely. The `xml` field already contains the
   same passwords in a reversible form, so removing them from `options` adds
   little protection and costs the reload feature. The alternative is to
   leave them out and ask again after loading.
4. **Warning severities.** The spec example shows `"warning"`. This record
   uses `info` and `warning`. Kyro needs to accept both.
5. **License of generated files.** The generated XML contains text from this
   GPL-licensed repository (command lines, the `diskpart` script). A
   statement that generated files are not covered by the site's license
   would remove any doubt for users.

## References

- Microsoft, "Unattended Windows Setup Reference":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/>
- Microsoft, "ComputerName":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-computername>
- Microsoft, "FirstLogonCommands, CommandLine":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-firstlogoncommands-synchronouscommand-commandline>
- Microsoft, "Microsoft-Windows-Deployment, RunSynchronousCommand, Path":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-deployment-runsynchronous-runsynchronouscommand-path>
- Microsoft, "Microsoft-Windows-Setup, RunSynchronousCommand, Path":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-setup-runsynchronous-runsynchronouscommand-path>
- Microsoft, "OOBE":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-oobe>
- Microsoft, "ProtectYourPC":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-oobe-protectyourpc>
- Microsoft, "LocalAccount" (includes the encoded password example):
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-useraccounts-localaccounts-localaccount>
- Microsoft, "ImageInstall, MetaData":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-setup-imageinstall-osimage-installfrom-metadata>
- Microsoft, "UserData, ProductKey":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-setup-userdata-productkey>
- Microsoft, "UnattendedJoin, Identification":
  <https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-unattendedjoin-identification>
- Microsoft, "UEFI/GPT-based hard drive partitions":
  <https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/configure-uefigpt-based-hard-drive-partitions>
- Microsoft, "Windows Setup Automation Overview" (answer file caching in
  `%WINDIR%\Panther`, sensitive data):
  <https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/windows-setup-automation-overview>
- Microsoft, "What's new in Windows 11, version 25H2 for IT pros"
  (enablement package, PowerShell 2.0 and WMIC removal):
  <https://learn.microsoft.com/en-us/windows/whats-new/whats-new-windows-11-version-25h2>
- Microsoft, "Releasing Windows 11, version 25H2 to the Release Preview
  Channel" (shared servicing branch with 24H2):
  <https://blogs.windows.com/windows-insider/2025/08/29/releasing-windows-11-version-25h2-to-the-release-preview-channel/>
- Microsoft, "Overview of apps on Windows client devices" (provisioned apps
  per release):
  <https://learn.microsoft.com/en-us/windows/application-management/overview-windows-apps>
- Kyro, ADR 0001 "How Windows Setup gets its install source" (LabConfig
  bypass, Setup front ends) and the security model:
  <https://github.com/kyro-pxe/kyro/tree/main/docs>
