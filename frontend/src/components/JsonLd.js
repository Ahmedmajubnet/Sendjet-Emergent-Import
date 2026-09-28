import { useEffect } from 'react';

/**
 * Inject a JSON-LD <script type="application/ld+json"> into <head> for the lifetime of the
 * component. Search engines (Google, Bing, Brave) read this to build rich snippets.
 *
 * Usage:
 *   <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", ... }} id="org-schema" />
 */
const JsonLd = ({ data, id }) => {
  useEffect(() => {
    if (!data) return undefined;

    const scriptId = id || `jsonld-${Math.random().toString(36).slice(2)}`;

    // Remove any prior instance with the same id so re-renders don't accumulate scripts
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = scriptId;
    tag.text = JSON.stringify(data);
    document.head.appendChild(tag);

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [data, id]);

  return null;
};

export default JsonLd;
