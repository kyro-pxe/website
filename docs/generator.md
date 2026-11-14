# Windows answer file and Kyro profile generator

The generator is available at `/generator/`. It runs locally in the browser,
with the site's existing light, dark and system themes. The generator's
Content Security Policy forbids script network connections. Settings are
kept in memory only; reloading the page clears them.

## Supported configuration

Windows 11 24H2 and 25H2, x64, UEFI/GPT, clean installations. The guided
form covers region, image selection or an owned product key, license terms,
interactive partitioning or a confirmed disk wipe, computer-name tokens,
local accounts, automatic sign-in, documented OOBE pages, Active Directory
join, driver folders, provisioned app removal, first-logon scripts, hardware
bypass and raw component XML.

All optional settings start unset. No app removals, disk wipes, license
acceptance, account creation or hardware bypasses are enabled implicitly.
Changing a disk choice clears its wipe confirmation. Imported settings
also require a new confirmation. Unsupported hardware bypasses and
recoverable credentials produce explicit warnings before export.

The generator does not offer Windows 10, ARM64, legacy BIOS, Wi-Fi profiles,
BitLocker, multiple-disk layouts, Microsoft Entra join or privacy presets.
Raw fragments are checked for XML syntax, known token suffixes and conflicts
with generated elements, not validated against a Windows image schema.

## Downloads and imports

| File | Purpose |
| ---- | ------- |
| `autounattend.xml` | Windows answer file for installation media or Kyro. Token patterns require Kyro. |
| `<name>.kyro.json` | Exact provisional version 0 bundle consumed by the current Kyro alpha. |
| `<name>.settings.json` | Version 1 generator settings, including any clear-text passwords, for editing here later. This is not a Kyro import bundle. |

Import a bundle on the server with:

```sh
kyro profile import office-laptops.kyro.json
```

Kyro bundles contain `bundle_version`, `name`, `description`, `wipes_disk`,
`warnings`, `windows_builds` and `answer_file` only. Windows releases map to
build-number strings `26100` and `26200`. The complete file, including the
JSON wrapper, is limited to 2 MiB.

The page accepts settings JSON, version 0 bundles and bare UTF-8 XML.
Bundles and XML open in an XML editor; their content is not guessed into
form fields. XML is preserved byte for byte after UTF-8 decoding, including
its line endings. Settings files restore the guided form. Future bundle
versions and unknown bundle fields are rejected with an actionable error.

Passwords use reversible UTF-16LE Base64 encoding where Windows supports it;
domain credentials remain plain text. Encoded scripts do not support Kyro
token substitution. Custom first-logon scripts conservatively set
`wipes_disk` to true, because the generator cannot prove their disk behavior.
Kyro will require disk-change confirmation before arming a client.

## Differences from ADR 0001

[ADR 0001](adr/0001-generator-options.md) remains the original proposal.
Implementation follows it with these adjustments:

- The upstream alpha specifies bundle version 0, not the proposed version 1.
  Editable settings are a separate format, so no extra fields break Kyro's
  strict importer. Descriptions follow Kyro's 2000-byte limit.
- Microsoft starts separate `FirstLogonCommands` concurrently. Scripts are
  combined into one ordered PowerShell runner. Short runners use
  `EncodedCommand`; longer ones are staged during `specialize` using Base64
  chunks. The generator enforces the 259-character setup path limit,
  1024-character first-logon command limit and 500 setup-command limit.
- Token patterns need a literal prefix and at least one literal letter to
  prevent all-numeric names or a truncated token beginning with a hyphen.
- Custom scripts declare possible disk changes even when their commands are
  Base64 encoded. Script errors stop the combined runner.
- App lists are a convenience catalogue, not an assertion that every
  package is provisioned on every ISO. Custom package identities are allowed
  only after validation, and absent packages are skipped.

## Verification

Run the normal repository checks:

```sh
pnpm lint
pnpm build
pnpm test
```

Run browser verification separately, after building:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

The browser test starts a local Astro preview, exercises the complete form,
downloads all formats, reloads them, checks fresh wipe confirmation, error
states, scripts and fragments, reset cancellation, keyboard tabs, themes,
mobile output navigation and 200% text sizing. It rejects runtime errors or
external network requests. Sample credentials used by tests are test data.

On 2026-11-14, the unit suite passed with 86 tests, including 150 generated
Unicode cases parsed by an independent XML parser. Chromium verification
covered every section at 320, 390, 640, 800, 960, 1152 and 1440 pixels with
no horizontal page overflow. A computed contrast audit covered 1342 visible
text instances across both themes; minimum observed contrast was 5.31:1.
The browser-generated XML and version 0 bundle were accepted by the actual
`internal/profiles.Parse` function from the upstream Kyro source downloaded
on that date. No server profile store was modified.

These checks do not establish Windows Setup compatibility. No generated file
has been installed in Windows or validated with Windows System Image Manager.
The UI states this limitation. The remaining installation checks are in
[the manual test plan](testing-generator.md).

## Design decisions

Reading: a deployment tool for Windows administrators in Kyro's existing
visual language. ENERGY 2 / RHYTHM 3 / MOTION 1.

| Decision | Reason |
| -------- | ------ |
| Existing cold palette, Archivo and IBM Plex Mono | Keep the project identity; monospace identifies literal XML, scripts and package names. |
| One accent download button | Make the finished artifact the primary action. |
| Seven task sections and a separate output rail | Keep related settings together while showing their consequences. |
| Numbered square markers filled for configured sections | Extend the site's status motif to actual form state. |
| Wider output rail on large screens, stacked output below 58 rem | Keep warnings readable while allowing the form to fit smaller screens. |
| Distinct 38, 58 and 72 rem layout states | Reflow fields and navigation at the widths where they need space. |
| Site panel/control radii, no shadows or illustrations | The form and its real output supply the content; no extra visual assets are needed. |
| Warning text with amber or red emphasis | Keep destructive actions and errors readable without relying only on color. |
| No motion beyond interaction states | Nothing in the generator needs animation to explain a change. |

## Sources

- [Kyro profile specification](https://github.com/kyro-pxe/kyro/blob/main/docs/adr/0002-profiles.md)
- [Kyro importer](https://github.com/kyro-pxe/kyro/blob/main/internal/profiles/profiles.go)
- [Windows unattended setup reference](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/)
- [FirstLogonCommands concurrency](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-firstlogoncommands)
- [Setup command order limit](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-deployment-runsynchronous-runsynchronouscommand-order)
- [Driver path attributes](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-pnpcustomizationsnonwinpe-driverpaths-pathandcredentials)
- [Automatic logon count issue](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-shell-setup-autologon-logoncount)

The Schneegans generator informed the task scope. No code from that project
was copied.
