/**
 * Centralised JSON-LD schema objects for SendJet.
 * Update brand info here once; all pages stay in sync.
 */

const SITE_URL = 'https://sendjet.de';

export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SendJet',
  alternateName: 'SendJet — Send Smart, Travel Light',
  url: SITE_URL,
  logo: `${SITE_URL}/sendjet-logo.png`,
  image: `${SITE_URL}/icons/icon-512.png`,
  description: 'Smart marketplace connecting travelers with senders. SendJet helps users send packages faster, cheaper, and more sustainably by using available space on journeys travelers are already taking by plane, car, train or bus.',
  slogan: 'Send Smart, Travel Light',
  email: 'info@sendjet.de',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'An der Apostelkirche 4',
    addressLocality: 'Berlin',
    addressCountry: 'DE',
  },
  founder: {
    '@type': 'Person',
    name: 'Ahmed Mahgoub Ibrahim Ali',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'info@sendjet.de',
      availableLanguage: ['English', 'German', 'Arabic'],
    },
  ],
};

/**
 * Build the FAQPage schema from an array of {q, a} objects.
 * Keeps the FAQ data and the structured data in one place.
 */
export const buildFaqSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: f.a,
    },
  })),
});
