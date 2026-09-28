import React from 'react';
import { Scale } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { InfoPageLayout } from './InfoPageLayout';
import JsonLd from './JsonLd';
import { ORGANIZATION_SCHEMA } from '../lib/structuredData';

/**
 * Impressum — required by German law (§ 5 TMG).
 * This is a placeholder skeleton; final legal details will be filled in before public launch.
 */
const ImpressumPage = () => (
  <InfoPageLayout
    title="Impressum"
    subtitle="Angaben gemäß § 5 TMG — Legal notice required by German law."
    icon={Scale}
    testId="impressum-page"
  >
    <JsonLd id="organization-schema" data={ORGANIZATION_SCHEMA} />
    <Card>
      <CardContent className="p-6 sm:p-8 space-y-4">
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Anbieter / Provider</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            SendJet<br />
            An der Apostelkirche 4<br />
            Berlin, Germany
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Vertreten durch / Represented by</h3>
          <p className="text-sm text-gray-700">Ahmed Mahgoub Ibrahim Ali</p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Kontakt / Contact</h3>
          <p className="text-sm text-gray-700">
            E-Mail:{' '}
            <a href="mailto:info@sendjet.de" className="text-orange-600 underline">info@sendjet.de</a>
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Registereintrag / Commercial Register</h3>
          <p className="text-sm text-gray-700">
            Eintragung im Handelsregister: [HRB-Nummer]<br />
            Registergericht: [Amtsgericht]
          </p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Umsatzsteuer-ID / VAT ID</h3>
          <p className="text-sm text-gray-700">[USt-IdNr. gemäß § 27 a Umsatzsteuergesetz]</p>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Verantwortlich für den Inhalt / Responsible for content</h3>
          <p className="text-sm text-gray-700">Ahmed Mahgoub Ibrahim Ali — same address as above</p>
        </section>

        <section className="pt-4 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Haftungsausschluss / Disclaimer</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte
            externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber
            verantwortlich.
          </p>
        </section>
      </CardContent>
    </Card>
  </InfoPageLayout>
);

export default ImpressumPage;
