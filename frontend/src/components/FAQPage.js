import React, { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { InfoPageLayout } from './InfoPageLayout';
import JsonLd from './JsonLd';
import { buildFaqSchema } from '../lib/structuredData';

const FAQS = [
  {
    q: 'How does SendJet work?',
    a: 'Travelers post upcoming journeys by plane, car, train or bus and share their available carrying space. Senders post shipments they want delivered. Either side can request a match; once accepted, the sender pays into escrow and funds are released to the traveler after delivery is confirmed.',
  },
  {
    q: 'Is my payment safe?',
    a: 'Yes. All payments are held in Stripe escrow until the recipient confirms the parcel was delivered. If something goes wrong, your funds stay protected.',
  },
  {
    q: 'Do I need to verify my identity?',
    a: 'Yes. To keep the community safe, every user must upload an ID document. An admin reviews and approves it before you can post trips, post shipments, or request matches.',
  },
  {
    q: 'What can I send?',
    a: 'Most everyday items: gifts, documents, electronics, clothes, small parcels. Prohibited items include weapons, drugs, hazardous materials, perishables, and anything restricted by airline/customs rules.',
  },
  {
    q: 'How much does it cost?',
    a: 'The traveler sets a price per kilogram on each trip. The sender sees the total upfront before confirming. SendJet charges a small service fee on each successful delivery.',
  },
  {
    q: 'What happens if my package gets lost?',
    a: 'Use the optional insurance option when posting a shipment for high-value items. We also offer dispute resolution through our support team.',
  },
];

const FAQItem = ({ q, a, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="p-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
          aria-expanded={open}
          data-testid={`faq-question-${index}`}
        >
          <span className="font-medium text-gray-900">{q}</span>
          <ChevronDown
            className={`h-5 w-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        {open && (
          <div className="px-5 pb-5 text-sm text-gray-700 leading-relaxed" data-testid={`faq-answer-${index}`}>
            {a}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FAQPage = () => (
  <InfoPageLayout
    title="Frequently Asked Questions"
    subtitle="Quick answers to the most common questions about using SendJet."
    icon={HelpCircle}
    testId="faq-page"
  >
    <JsonLd id="faq-schema" data={buildFaqSchema(FAQS)} />
    <div className="space-y-3">
      {FAQS.map((f, i) => (
        <FAQItem key={i} q={f.q} a={f.a} index={i} />
      ))}
    </div>
  </InfoPageLayout>
);

export default FAQPage;
