import React from 'react';
import { Info, Globe, Heart, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { InfoPageLayout } from './InfoPageLayout';
import { Reveal } from './motion/Reveal';
import { FloatWrap } from './motion/FloatWrap';
import JsonLd from './JsonLd';
import { ORGANIZATION_SCHEMA } from '../lib/structuredData';

const COMMUNITY_PHOTO = 'https://images.unsplash.com/photo-1609868714484-2b2556006301?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400&auto=format&fit=crop';

const AboutPage = () => (
  <InfoPageLayout
    title="About SendJet"
    subtitle="Send Smart, Travel Light — a marketplace that turns available space on existing journeys into flexible, community-powered deliveries."
    icon={Info}
    testId="about-page"
  >
    <JsonLd id="organization-schema" data={ORGANIZATION_SCHEMA} />

    <Reveal>
      <FloatWrap distance={8} duration={6}>
        <div className="rounded-3xl overflow-hidden shadow-soft aspect-[16/7]">
          <img src={COMMUNITY_PHOTO} alt="SendJet community of travelers and senders" loading="lazy" className="w-full h-full object-cover" />
        </div>
      </FloatWrap>
    </Reveal>

    <Reveal delay={0.1}>
      <Card>
        <CardContent className="p-6 sm:p-8 space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Our Mission</h3>
          <p className="text-gray-700 leading-relaxed">
            Every day people travel with unused space in cars, bags and luggage while
            millions of senders pay premium prices to ship small parcels. SendJet
            connects the two: senders save, travelers earn, and the planet sees
            fewer dedicated freight trips.
          </p>
        </CardContent>
      </Card>
    </Reveal>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[
        { Icon: Globe, title: 'Global', body: 'Cross-border parcels through trusted travelers worldwide.' },
        { Icon: Heart, title: 'Community-first', body: 'Verified identities, ratings, and escrow payments keep everyone safe.' },
        { Icon: Sparkles, title: 'Sustainable', body: 'Using journeys that are already happening instead of creating unnecessary extra trips.' },
      ].map(({ Icon, title, body }, idx) => (
        <Reveal key={title} delay={idx * 0.1}>
          <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
            <Card>
              <CardContent className="p-5 space-y-2">
                <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }} className="inline-block">
                  <Icon className="h-7 w-7 text-orange-500" />
                </motion.div>
                <h4 className="font-semibold text-gray-900">{title}</h4>
                <p className="text-sm text-gray-600">{body}</p>
              </CardContent>
            </Card>
          </motion.div>
        </Reveal>
      ))}
    </div>
  </InfoPageLayout>
);

export default AboutPage;
