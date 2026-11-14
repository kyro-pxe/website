const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test('aligns account fields with and without helper text', async ({ page }) => {
  await page.goto('http://127.0.0.1:4392/generator/');
  await page.getByRole('tab', { name: /^Accounts/ }).click();
  await page.getByRole('button', { name: 'Add local account', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    await page.locator('[data-theme-control]').selectOption(theme);
    for (const width of [390, 640, 960, 1200, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const password = await page.getByLabel(/^Password/).boundingBox();
      const accountType = await page.getByRole('combobox', { name: /^Account type/ }).boundingBox();
      if (Math.abs(password.x - accountType.x) > 1) {
        expect(Math.abs(password.y - accountType.y)).toBeLessThan(1);
      }
      expect(Math.abs(password.height - accountType.height)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});

test('keeps account values in sync with change-only autofill and explains invalid names', async ({
  page,
}, testInfo) => {
  await page.goto('http://127.0.0.1:4392/generator/');
  await page.getByRole('tab', { name: /^Accounts/ }).click();
  await page.getByRole('button', { name: 'Add local account', exact: true }).click();
  await page.locator('fieldset').evaluate(
    (fieldset, values) => {
      const inputs = fieldset.querySelectorAll('input');
      values.forEach((value, index) => {
        inputs[index].value = value;
        inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
    ['admin', 'admin', 'Sample-only-password'],
  );
  await expect(page.locator('.g-errors')).toHaveCount(0);
  await page.locator('[data-theme-control]').selectOption('light');
  await page
    .locator('.g-form-panel')
    .screenshot({ path: testInfo.outputPath('account-fields.png') });
  await expect(page.getByRole('heading', { name: 'No warnings', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /^Sign in automatically as/ })).toHaveValue('');
  await page.getByRole('combobox', { name: /^Sign in automatically as/ }).selectOption('admin');
  await page.getByRole('combobox', { name: /^Download format/ }).selectOption('xml');
  await page.locator('.g-preview summary').click();
  await expect(page.locator('.g-preview code')).toContainText('<Name>admin</Name>');
  await expect(page.locator('.g-preview code')).toContainText('<DisplayName>admin</DisplayName>');
  await expect(page.locator('.g-preview code')).toContainText(
    Buffer.from('Sample-only-passwordPassword', 'utf16le').toString('base64'),
  );

  const name = page.getByLabel(/^Account name/);
  await name.fill('admin|');
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'No warnings', exact: true })).toHaveCount(0);
  await expect(page.locator('.g-download')).toBeDisabled();
  await name.fill('admin');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.g-errors')).toHaveCount(0);
  await page.getByRole('tab', { name: /^System/ }).click();
  await page.getByRole('checkbox', { name: /^Join a domain/ }).check();
  await page
    .locator('.g-group')
    .filter({ has: page.getByRole('heading', { name: 'Active Directory domain', exact: true }) })
    .evaluate(
      (group, values) => {
        group.querySelectorAll('input:not([type="checkbox"])').forEach((input, index) => {
          input.value = values[index];
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      },
      [
        'ad.example.test',
        'sample-join-user',
        'Sample-only-domain-password',
        'OU=Devices,DC=ad,DC=example,DC=test',
      ],
    );
  await expect(page.locator('.g-errors')).toHaveCount(0);
  await expect(page.locator('.g-preview code')).toContainText(
    '<JoinDomain>ad.example.test</JoinDomain>',
  );
  await expect(page.locator('.g-preview code')).toContainText(
    '<Username>sample-join-user</Username>',
  );
});

test('generates, reviews, downloads and reloads a complete deployment profile', async ({
  page,
}, testInfo) => {
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('http://127.0.0.1:4392/generator/');
  await page.getByRole('button', { name: 'Download Kyro profile', exact: true }).waitFor();
  const tab = async (name) => page.getByRole('tab', { name: new RegExp('^' + name) }).click();
  const input = (name) => page.getByLabel(new RegExp('^' + name));
  const select = (name) => page.getByRole('combobox', { name: new RegExp('^' + name) });
  const check = (name) => page.getByRole('checkbox', { name: new RegExp('^' + name) });
  const download = async (path) => {
    const p = page.waitForEvent('download');
    await page.locator('.g-download').click();
    const d = await p;
    await d.saveAs(path);
    return fs.readFile(path, 'utf8');
  };
  await input('Profile name').fill('browser-tested');
  await input('Description').fill('Sample configuration for browser verification');
  await check('25H2').uncheck();
  await check('25H2').check();
  await input('Profile name').fill('../invalid');
  await expect(page.locator('.g-download')).toBeDisabled();
  await input('Profile name').fill('browser-tested');
  await page.getByRole('button', { name: 'Next: Region', exact: true }).click();
  await select('Windows display language').selectOption('de-DE');
  await input('Regional format').fill('en-GB');
  await input('System locale').fill('de-DE');
  await input('Keyboard layouts').fill('de-DE;en-US');
  await input('Time zone').fill('W. Europe Standard Time');
  await tab('Windows Setup');
  await select('Image selection').selectOption('key');
  await page.getByLabel(/^Product key/).fill('AAAAA-BBBBB-CCCCC-DDDDD-EEEEE');
  await select('Image selection').selectOption('index');
  await input('Image index').fill('6');
  await select('Image selection').selectOption('name');
  await input('Exact image name').fill('Windows 11 Pro');
  await check('Accept Microsoft').check();
  await select('Partitioning').selectOption('wipe');
  await expect(page.locator('.g-download')).toBeDisabled();
  await input('Disk number').fill('0');
  await select('GPT layout').selectOption('basic');
  await check('I authorize erasing').check();
  await page.getByRole('spinbutton', { name: 'EFI partition (MB)', exact: true }).fill('350');
  await expect(check('I authorize erasing')).not.toBeChecked();
  await select('GPT layout').selectOption('with-recovery');
  await page.getByRole('spinbutton', { name: 'Recovery partition (MB)', exact: true }).fill('1200');
  await check('I authorize erasing').check();
  await tab('Accounts');
  for (const pattern of ['mac:10', 'uuid:8', 'serial:8'])
    await page.getByRole('button', { name: 'Use PC-{{' + pattern + '}}', exact: true }).click();
  await page.getByRole('button', { name: 'Add local account', exact: true }).click();
  await input('Account name').fill('deploy');
  await expect(select('Sign in automatically as')).toHaveValue('');
  await input('Display name').fill('Deployment <&>');
  await page.getByLabel(/^Password/).fill('Sample-only-ä-password');
  await select('Account type').selectOption('Users');
  await expect(page.locator('.g-download')).toBeDisabled();
  await select('Account type').selectOption('Administrators');
  await select('Sign in automatically as').selectOption('deploy');
  await page.getByRole('spinbutton', { name: 'Requested sign-in count' }).fill('1');
  await page.getByRole('button', { name: 'Add local account', exact: true }).click();
  await page.getByRole('button', { name: 'Remove account 2', exact: true }).click();
  await tab('System');
  for (const name of ['Hide the license', 'Hide OEM', 'Hide online', 'Hide wireless'])
    await check(name).check();
  await select('Express settings').selectOption('1');
  await select('Express settings').selectOption('2');
  await select('Express settings').selectOption('3');
  await check('Join a domain').check();
  await input('DNS domain').fill('ad.example.test');
  await input('Join account').fill('sample-join-user');
  await page.getByLabel(/^Join password/).fill('Sample-only-domain-password');
  await input('Organizational unit').fill('OU=Devices,DC=ad,DC=example,DC=test');
  await input('Windows PE drivers').fill('\\\\server\\share\\drivers');
  await input('Installed system drivers').fill('C:\\Drivers');
  await input('Installed system drivers').press('Tab');
  await tab('Apps & scripts');
  await check('Microsoft.BingNews').check();
  await check('Clipchamp.Clipchamp').check();
  await check('Clipchamp.Clipchamp').uncheck();
  await input('Additional package').fill('Custom.App');
  await input('Additional package').press('Tab');
  await page.getByRole('button', { name: 'Add first-logon script', exact: true }).click();
  await input('PowerShell script').fill("Write-Output 'Sample test 世界'");
  await page.getByRole('button', { name: 'Add first-logon script', exact: true }).click();
  await select('Script type').nth(1).selectOption('command');
  await input('Command line').fill('echo Sample test');
  await page.getByRole('button', { name: 'Move up', exact: true }).nth(1).click();
  await page.getByRole('button', { name: 'Move down', exact: true }).nth(0).click();
  await page.getByRole('button', { name: 'Add first-logon script', exact: true }).click();
  await page.getByRole('button', { name: 'Remove script 3', exact: true }).click();
  await tab('Advanced');
  for (const name of ['TPM', 'Secure Boot', 'RAM', 'CPU', 'Storage']) {
    await check('Bypass ' + name).check();
  }
  await page.getByRole('button', { name: 'Add XML fragment', exact: true }).click();
  await select('Setup pass').selectOption('specialize');
  await input('Component name').fill('Microsoft-Windows-Shell-Setup');
  await input('Child elements').fill('<RegisteredOwner>Sample &amp; test</RegisteredOwner>');
  await page.getByRole('button', { name: 'Add XML fragment', exact: true }).click();
  await page.getByRole('button', { name: 'Remove fragment 2', exact: true }).click();
  await expect(page.locator('.g-errors')).toHaveCount(0);
  await expect(page.locator('.g-download')).toBeDisabled();
  await check('I have reviewed the warnings').check();
  await page.locator('.g-preview summary').click();
  await expect(page.locator('.g-preview pre')).toBeVisible();
  await page.locator('.g-preview summary').click();
  const bundle = JSON.parse(
    await download(testInfo.outputPath('kyro-generator-browser.kyro.json')),
  );
  if (
    bundle.bundle_version !== 0 ||
    !bundle.wipes_disk ||
    bundle.windows_builds.join(',') !== '26100,26200'
  )
    throw Error('Bad bundle');
  await select('Download format').selectOption('xml');
  const xml = await download(testInfo.outputPath('kyro-generator-browser.xml'));
  if (xml !== bundle.answer_file) throw Error('XML mismatch');
  await select('Download format').selectOption('settings');
  await download(testInfo.outputPath('kyro-generator-browser.settings.json'));
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Reset configuration', exact: true }).click();
  await input('Profile name').fill('must-reset');
  await page
    .locator('input[type=file]')
    .setInputFiles(testInfo.outputPath('kyro-generator-browser.settings.json'));
  await expect(input('Profile name')).toHaveValue('browser-tested');
  await tab('Windows Setup');
  await expect(check('I authorize erasing')).not.toBeChecked();
  await check('I authorize erasing').check();
  await page
    .locator('input[type=file]')
    .setInputFiles(testInfo.outputPath('kyro-generator-browser.kyro.json'));
  await expect(input('Answer file XML')).toHaveValue(xml);
  await expect(page.locator('.g-download')).toBeDisabled();
  await check('I have reviewed and accept').check();
  await check('I have reviewed the warnings').check();
  await expect(page.locator('.g-download')).toBeEnabled();
  await input('Answer file XML').fill('<bad>');
  await expect(page.locator('.g-download')).toBeDisabled();
  await input('Answer file XML').fill(xml);
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"bundle_version":7}'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported');
  await page
    .locator('input[type=file]')
    .setInputFiles(testInfo.outputPath('kyro-generator-browser.xml'));
  await expect(input('Answer file XML')).toHaveValue(xml);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Reset configuration', exact: true }).click();
  await page.getByRole('tab', { name: /^Profile/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /^Region/ })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /^Advanced/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: /^Profile/ })).toBeFocused();
  for (const theme of ['light', 'dark', 'auto']) {
    await page.locator('[data-theme-control]').selectOption(theme);
    if (theme !== 'auto') await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: 'Review output', exact: true }).click();
  await expect(page.locator('#g-output')).toBeInViewport();
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error('Zoom overflow');
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  const external = requests.filter(
    (url) => !url.startsWith('http://127.0.0.1:4392/') && !url.startsWith('blob:'),
  );
  if (external.length) throw Error('External requests: ' + external.join(','));
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: fields, conditions, scripts, fragments, warning acknowledgments, 3 downloads, settings/bundle/XML imports, malformed import, wipe reconfirmation, reset/cancel/Escape, keyboard tabs, all themes, mobile review link, 200% text, no external requests, no runtime/CSP errors.',
  );
});
