import React from 'react';
import { Mail, MessageCircle, Clock, MapPin } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { InfoPageLayout } from './InfoPageLayout';

const ContactPage = () => (
  <InfoPageLayout
    title="Contact & Support"
    subtitle="We are here to help. Reach us through any of the channels below."
    icon={MessageCircle}
    testId="contact-page"
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Email</h3>
          </div>
          <p className="text-sm text-gray-600">For general inquiries, partnerships, and support requests.</p>
          <a
            href="mailto:info@sendjet.de"
            className="inline-block text-orange-600 font-medium text-sm hover:underline"
            data-testid="contact-email-link"
          >
            info@sendjet.de
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Response time</h3>
          </div>
          <p className="text-sm text-gray-600">We aim to reply within 24 hours on business days.</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="p-6 space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-orange-500" />
            <h3 className="font-semibold text-gray-900">Office</h3>
          </div>
          <p className="text-sm text-gray-600">
            SendJet operates from Germany. Postal address details available on the{' '}
            <a href="/impressum" className="text-orange-600 underline">Impressum</a> page.
          </p>
        </CardContent>
      </Card>
    </div>
  </InfoPageLayout>
);

export default ContactPage;
