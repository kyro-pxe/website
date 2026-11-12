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
  build: {
    // Styles as files, never inline. A strict Content Security Policy on
    // the generator page depends on this.
    inlineStylesheets: 'never',
  },
  integrations: [
    // Starlight renders the documentation in src/content/docs/. The home
    // page, the generator and the 404 page are standalone pages in src/pages/.
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
      favicon: '/favicon.svg',
      customCss: ['./src/styles/tokens.css', './src/styles/starlight.css'],
      components: {
        Header: './src/components/starlight/Header.astro',
        Footer: './src/components/starlight/Footer.astro',
        ThemeProvider: './src/components/starlight/ThemeProvider.astro',
        ThemeSelect: './src/components/starlight/ThemeSelect.astro',
      },
      // The 404 page is src/pages/404.astro.
      disable404Route: true,
      // No search while there is no documentation to search. Remove this
      // line when the first documentation pages exist.
      pagefind: false,
      expressiveCode: {
        styleOverrides: { borderRadius: '0' },
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
