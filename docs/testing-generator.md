# Generator installation test plan

Browser tests, XML parsing and an accepted Kyro import do not establish that
Windows Setup accepts every generated setting. These tests remain pending.
Use disposable VMs and licensed or evaluation media; never attach a disk
containing data to a disk-wipe test.

Record the ISO build, language, setup frontend, profile settings, result,
and relevant Setup log observations for each run. Do not commit credentials
or answer files containing real secrets.

| Scenario | Expected result | Status |
| -------- | --------------- | ------ |
| Minimal profile, 24H2 and 25H2 | Unset choices remain interactive | Pending |
| Display language, formats, two keyboards and time zone | Values applied in Setup and installed system | Pending |
| Image name, index, owned product key | Correct edition selected using Kyro's setup invocation | Pending |
| Basic GPT layout on a disposable disk | EFI, MSR, Windows; install to partition 3 | Pending |
| GPT with recovery on a disposable disk | Recovery follows Windows; Windows RE enabled and usable | Pending |
| Two attached disposable disks | Only the explicitly selected disk changes | Pending |
| Unicode local password and display name | Account can sign in; name round-trips | Pending |
| German ISO with administrator and standard accounts | English group identifiers map correctly | Pending |
| Automatic logon, count 1 and count 2 | Observe Microsoft's extra-logon issue and verify final sign-in behavior | Pending |
| Individual OOBE page settings | Only configured pages hidden, online and offline | Pending |
| Domain join and organizational unit | Computer joins the intended OU with the configured name | Pending |
| Windows PE and installed-system driver folders | Drivers loaded in the intended passes | Pending |
| Selected provisioned app removal | Selected app absent for new users; other apps remain | Pending |
| Short and staged Unicode script runners | Commands run once, in order, after first sign-in | Pending |
| Failing first-logon command | Runner stops and reports failure; later scripts do not run | Pending |
| Unsupported hardware bypass, old and new setup frontends | Selected LabConfig values set before hardware checks | Pending |
| Kyro serial, MAC and UUID patterns | Client-specific names resolve and meet Windows limits | Pending |
| Raw fragments | Chosen settings accepted by Windows SIM and Setup | Pending |

Inspect `C:\Windows\Panther` and Setup logs after each run. Answer files can
remain cached there with recoverable passwords. Script staging files are
removed before the combined runner executes, but Setup failures can leave
staged data behind; treat disposable VM disks accordingly.
