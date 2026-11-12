// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// The canonical URL. Override with SITE_URL for preview deployments
// (for example on Cloudflare Pages), so sitemap and canonical links match.
const site = process.env.SITE_URL ?? 'https://kyro-pxe.sh';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Kyro',
      description:
        'Kyro is an open-source PXE server for booting Windows 11 ISOs. This site holds its documentation and an autounattend.xml generator.',
      // English only for now. Content lives at the root of src/content/docs/.
      // To add German, add `de: { label: 'Deutsch', lang: 'de' }` here and put
      // the translated pages in src/content/docs/de/.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
      logo: {
        // Placeholder until Kyro has a logo.
        src: './src/assets/logo-placeholder.svg',
        alt: '',
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      components: {
        // Dark by default instead of following the system preference.
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'Kyro on GitHub',
          href: 'https://github.com/kyro-pxe/kyro',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/kyro-pxe/website/edit/main/',
      },
      // Starlight's footer credit links to an external site; leave it out.
      credits: false,
    }),
  ],
});
