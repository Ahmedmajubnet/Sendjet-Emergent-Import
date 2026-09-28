import React from 'react';
import { Shield, CheckCircle2, AlertTriangle, Ban } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { InfoPageLayout } from './InfoPageLayout';
import { Reveal } from './motion/Reveal';
import { FloatWrap } from './motion/FloatWrap';
import TrustStats from './TrustStats';

const SAFETY_PHOTO = 'https://images.pexels.com/photos/32642491/pexels-photo-32642491.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=1200';

const allowedRules = [
  'Verify the sender / traveler identity before meeting.',
  'Inspect the parcel together before pickup so both sides agree on what is being sent.',
  'Keep the parcel sealed and visible during the trip.',
  'Use SendJet escrow payments — never pay outside the platform.',
  'Communicate through the in-app chat for safety and dispute records.',
];

const prohibitedItems = [
  'Drugs, controlled substances, or any illegal items.',
  'Weapons, ammunition, explosives, or hazardous materials.',
  'Live animals or perishable food items.',
  'Cash, large amounts of jewelry, or items prohibited by customs.',
  'Anything banned by the airline or destination country.',
];

const SafetyPage = () => (
  <InfoPageLayout
    title="Safety Guidelines"
    subtitle="Simple rules that keep both senders and travelers safe on every SendJet delivery."
    icon={Shield}
    testId="safety-page"
  >
    <Reveal>
      <FloatWrap distance={8} duration={6}>
        <div className="rounded-3xl overflow-hidden shadow-soft aspect-[16/7]">
          <img src={SAFETY_PHOTO} alt="Identity verification and secure documents" loading="lazy" className="w-full h-full object-cover" />
        </div>
      </FloatWrap>
    </Reveal>

    <Reveal delay={0.1}>
      <TrustStats />
    </Reveal>

    <Reveal delay={0.15}>
      <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Good practices</h3>
            </div>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed list-disc pl-5">
              {allowedRules.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </Reveal>

    <Reveal delay={0.2}>
      <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
        <Card>
          <CardContent className="p-6 sm:p-8 space-y-3">
            <div className="flex items-center gap-2">
              <Ban className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Prohibited items</h3>
            </div>
            <ul className="space-y-2 text-gray-700 text-sm leading-relaxed list-disc pl-5">
              {prohibitedItems.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </Reveal>

    <Reveal delay={0.25}>
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-6 sm:p-8 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">If something feels wrong</h3>
          </div>
          <p className="text-sm text-gray-700">
            Refuse the parcel and contact SendJet support immediately at{' '}
            <a className="text-orange-600 underline font-medium" href="mailto:info@sendjet.de">info@sendjet.de</a>.
            You are never obligated to carry an item that makes you uncomfortable.
          </p>
        </CardContent>
      </Card>
    </Reveal>
  </InfoPageLayout>
);

export default SafetyPage;
