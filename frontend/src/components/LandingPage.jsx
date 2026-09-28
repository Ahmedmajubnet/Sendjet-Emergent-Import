import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../App';
import Navbar from './Navbar';
import { Reveal } from './motion/Reveal';
import { FloatWrap } from './motion/FloatWrap';
import { ShieldCheck, Compass, Users, MapPin, Clock, Check, DollarSign, Lock } from 'lucide-react';

const PHOTOS = {
  collageMain: 'https://images.unsplash.com/photo-1778411602745-5db9ca798215?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200&auto=format&fit=crop',
  collageSecondary: 'https://images.unsplash.com/photo-1502301197179-65228ab57f78?crop=entropy&cs=srgb&fm=jpg&q=85&w=900&auto=format&fit=crop',
  collageTertiary: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?crop=entropy&cs=srgb&fm=jpg&q=85&w=900&auto=format&fit=crop',
  whySupport: 'https://images.unsplash.com/photo-1553697388-94e804e2f0f6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200&auto=format&fit=crop',
  communityBg: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800&auto=format&fit=crop',
};

/**
 * SendJet Landing Page — first impression for anonymous visitors.
 *
 * Design language: Airbnb / Wise / Booking.com — warm hospitality, editorial serif
 * headlines (Fraunces), generous whitespace, human photography, no fintech metaphors.
 *
 * Progressive engagement:
 *   - The two hero CTAs route unauthenticated users to /auth?next=<intent-url>
 *   - The "Browse Marketplace" tertiary link stays anonymous
 */
const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Track landing view (PostHog auto-captures pageviews, but we also mark it explicitly).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.posthog) {
      window.posthog.capture('landing_view');
    }
    document.title = 'SendJet · Send parcels with people already going your way';
  }, []);

  // Handler for auth-gated CTAs. Routes through /auth with a `next` intent.
  const gotoWithAuth = (nextPath, action) => (e) => {
    e?.preventDefault();
    if (isAuthenticated) {
      navigate(nextPath);
    } else {
      const q = new URLSearchParams({ next: nextPath });
      if (action) q.set('action', action);
      navigate(`/auth?${q.toString()}`);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <Navbar />

      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-10 md:pt-20 md:pb-16">
          <div className="grid md:grid-cols-2 gap-7 sm:gap-10 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 0.77, 0.3, 0.97] }}
            >
              <h1 className="font-serif font-extrabold text-[2.15rem] sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.06] tracking-tight text-ink break-words">
                Send it with someone<br className="hidden sm:inline" />
                <span className="text-brand">already going your way.</span>
              </h1>
              <p className="mt-4 sm:mt-5 text-base sm:text-lg text-ink2 max-w-xl leading-relaxed">
                Find people already traveling by plane, car, train or bus, agree on the details together, and move small parcels along journeys that are already happening.
              </p>

              <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <motion.button
                  data-testid="hero-cta-travel"
                  onClick={gotoWithAuth('/create-trip', 'post-trip')}
                  whileHover={{ scale: 1.04, boxShadow: '0 12px 24px rgba(0,0,0,0.12)' }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full sm:w-auto inline-flex justify-center items-center bg-brand hover:bg-brand-hover text-white rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium shadow-sm transition"
                >
                  Travel &amp; Earn
                </motion.button>
                <motion.button
                  data-testid="hero-cta-send"
                  onClick={gotoWithAuth('/create-shipment', 'post-shipment')}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full sm:w-auto inline-flex justify-center items-center bg-white border border-hairline hover:border-ink text-ink rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium transition"
                >
                  Send a Package
                </motion.button>
                <Link
                  to="/marketplace"
                  data-testid="hero-cta-browse"
                  className="inline-flex items-center justify-center gap-1 text-ink font-medium hover:text-brand transition self-center sm:ml-2 py-2"
                >
                  Browse Marketplace <span aria-hidden="true">→</span>
                </Link>
              </div>

              <p className="mt-5 text-sm text-ink3">No account required to browse the marketplace.</p>
            </motion.div>

            <motion.div
              className="relative"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 0.77, 0.3, 0.97] }}
            >
              <FloatWrap distance={10} duration={5}>
                <motion.div
                  className="aspect-[4/3] sm:aspect-[4/5] rounded-3xl overflow-hidden shadow-lift hero-fade bg-cream-alt"
                  whileHover={{ scale: 1.015 }}
                  transition={{ duration: 0.4 }}
                >
                  <img
                    className="w-full h-full object-cover"
                    alt="Traveler on a journey, looking ahead with a sense of possibility"
                    loading="eager"
                    fetchPriority="high"
                    src="https://images.unsplash.com/photo-1769837636747-1e3825ee974c?crop=entropy&cs=srgb&fm=jpg&w=1600&q=90&auto=format&fit=crop"
                  />
                </motion.div>
              </FloatWrap>
              <FloatWrap distance={7} duration={3.6} delay={0.3} className="mt-3 sm:mt-0 sm:absolute sm:-left-8 sm:bottom-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.6, type: 'spring', stiffness: 180 }}
                  className="bg-white rounded-2xl shadow-soft border border-hairline p-3.5 sm:p-4 flex items-center gap-3 w-full sm:w-auto sm:max-w-[260px]"
                >
                  <motion.div
                    whileHover={{ rotate: 12, scale: 1.15 }}
                    className="w-10 h-10 rounded-full bg-brand-light grid place-items-center"
                  >
                    <ShieldCheck className="w-5 h-5 text-brand" strokeWidth={1.5} />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-ink leading-tight">Payments held in escrow</p>
                    <p className="text-xs text-ink2 mt-0.5">Released only on delivery.</p>
                  </div>
                </motion.div>
              </FloatWrap>
            </motion.div>
          </div>
        </div>

        {/* ============== TRUST STRIP ============== */}
        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 md:pb-16" delay={0.15}>
          <div className="bg-white border border-hairline/60 rounded-2xl md:rounded-full shadow-soft grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline px-2 py-2 md:py-3">
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <motion.span whileHover={{ scale: 1.2, rotate: 8 }} className="inline-flex flex-shrink-0">
                <Compass className="w-5 h-5 text-brand" strokeWidth={1.5} />
              </motion.span>
              <div>
                <p className="text-sm font-semibold text-ink">Browse without an account</p>
                <p className="text-xs text-ink2">Explore listings freely — sign up only when you post or pay.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <motion.span whileHover={{ scale: 1.2, rotate: 8 }} className="inline-flex flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-brand" strokeWidth={1.5} />
              </motion.span>
              <div>
                <p className="text-sm font-semibold text-ink">Trusted profiles</p>
                <p className="text-xs text-ink2">Profiles, reviews and verification steps help build trust as people use SendJet.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <motion.span whileHover={{ scale: 1.2, rotate: 8 }} className="inline-flex flex-shrink-0">
                <Lock className="w-5 h-5 text-brand" strokeWidth={1.5} />
              </motion.span>
              <div>
                <p className="text-sm font-semibold text-ink">Secure escrow payments</p>
                <p className="text-xs text-ink2">Your money is safe until the parcel is successfully delivered.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ============== ACTIVITY STRIP ============== */}
      <section className="bg-cream-alt/70 border-y border-hairline overflow-hidden">
        <div className="py-4 sm:py-6">
          <div className="marquee-track font-serif text-ink2 text-sm sm:text-lg">
            {['London → Nairobi', 'Berlin → Cairo', 'Dubai → Manila', 'Toronto → Lagos', 'Singapore → Sydney', 'Istanbul → Karachi', 'Paris → São Paulo', 'Tokyo → Los Angeles']
              .concat(['London → Nairobi', 'Berlin → Cairo', 'Dubai → Manila', 'Toronto → Lagos', 'Singapore → Sydney', 'Istanbul → Karachi', 'Paris → São Paulo', 'Tokyo → Los Angeles'])
              .map((route, idx) => (
                <span key={idx} className="whitespace-nowrap">{route}</span>
              ))}
          </div>
        </div>
      </section>

      {/* ============== PHOTO COLLAGE ============== */}
      <section className="py-12 sm:py-16 md:py-24 overflow-hidden" data-testid="landing-photo-collage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-xl mb-10 md:mb-14">
            <h2 className="font-serif font-extrabold text-3xl sm:text-4xl leading-tight tracking-tight text-ink">
              Every trip and every parcel has a face behind it.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <Reveal delay={0.05} className="sm:col-span-2 md:col-span-2 row-span-2 h-full">
              <FloatWrap distance={8} duration={6} className="h-full">
                <div className="h-full min-h-[220px] sm:min-h-[280px] rounded-3xl overflow-hidden shadow-soft">
                  <img src={PHOTOS.collageMain} alt="Friends preparing for a journey" loading="lazy" className="w-full h-full object-cover" />
                </div>
              </FloatWrap>
            </Reveal>
            <Reveal delay={0.15}>
              <FloatWrap distance={6} duration={5} delay={0.2}>
                <div className="aspect-square rounded-3xl overflow-hidden shadow-soft">
                  <img src={PHOTOS.collageSecondary} alt="Packing a suitcase before a trip" loading="lazy" className="w-full h-full object-cover" />
                </div>
              </FloatWrap>
            </Reveal>
            <Reveal delay={0.25}>
              <FloatWrap distance={6} duration={5.5} delay={0.4}>
                <div className="aspect-square rounded-3xl overflow-hidden shadow-soft">
                  <img src={PHOTOS.collageTertiary} alt="Handing over a parcel to a traveler" loading="lazy" className="w-full h-full object-cover" />
                </div>
              </FloatWrap>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section id="how" className="py-14 sm:py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="font-serif font-extrabold text-3xl sm:text-5xl leading-tight tracking-tight text-ink">
              Three simple steps to a delivered package.
            </h2>
          </Reveal>
          <div className="mt-9 sm:mt-14 grid md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { Icon: MapPin, num: '01', title: 'Post a journey or a parcel', body: "Share where you're going — by plane, car, train or bus — or describe what you need sent. Browsing stays open without an account." },
              { Icon: Users, num: '02', title: 'Find someone going your way', body: 'Review profiles and trust badges, chat directly, ask questions, and agree on the details together.' },
              { Icon: Check, num: '03', title: 'Follow the handoff', body: 'Use the delivery milestones and payment flow available for your match so both sides know what happens next.' }
            ].map(({ Icon, num, title, body }, idx) => (
              <Reveal key={num} delay={idx * 0.12}>
                <motion.div
                  whileHover={{ y: -8, rotate: idx % 2 === 0 ? -0.8 : 0.8, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="bg-white rounded-3xl p-5 sm:p-8 shadow-soft border border-hairline/60"
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    className="w-11 h-11 rounded-full bg-brand-light grid place-items-center mb-6"
                  >
                    <Icon className="w-5 h-5 text-brand" strokeWidth={1.5} />
                  </motion.div>
                  <p className="text-sm text-ink3 mb-2">Step {num}</p>
                  <h3 className="font-serif text-2xl text-ink leading-snug mb-3">{title}</h3>
                  <p className="text-ink2 leading-relaxed">{body}</p>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============== WHY SENDJET ============== */}
      <section className="py-14 sm:py-20 md:py-28 bg-cream-alt/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-9 sm:gap-14 items-start">
            <Reveal x={-24} y={0}>
              <h2 className="font-serif font-extrabold text-3xl sm:text-5xl leading-tight tracking-tight text-ink">
                A global community turning available space on everyday journeys into human parcel delivery.
              </h2>
              <p className="mt-6 text-lg text-ink2 leading-relaxed max-w-md">
                SendJet is a marketplace where everyday travelers can help move parcels along routes they are already taking. Profiles, reviews and verification badges make completed trust steps visible before people decide to match.
              </p>
              <FloatWrap distance={8} duration={6} className="mt-8 max-w-md">
                <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-soft">
                  <img src={PHOTOS.whySupport} alt="Two travelers comparing passports and boarding passes" loading="lazy" className="w-full h-full object-cover" />
                </div>
              </FloatWrap>
            </Reveal>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: 'Community-first', body: 'Real people helping real people, on real journeys.' },
                { title: 'Trust that grows with every journey', body: 'Profiles, reviews and verification steps help people build confidence as they use SendJet.' },
                { title: 'Payment protection', body: 'Where escrow is used, funds are released according to the delivery flow.' },
                { title: 'Transparent pricing', body: 'Agree on a price together. No surges, no hidden fees.' }
              ].map((tile, idx) => (
                <Reveal key={tile.title} delay={idx * 0.1}>
                  <motion.div
                    whileHover={{ y: -6, scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="bg-white rounded-3xl p-6 border border-hairline/60 shadow-soft"
                  >
                    <h4 className="font-serif text-xl text-ink mb-2">{tile.title}</h4>
                    <p className="text-ink2 text-sm leading-relaxed">{tile.body}</p>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============== VALUE PROPOSITIONS STRIP ============== */}
      <section className="py-12 sm:py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { Icon: DollarSign, title: 'Agree on the price.', body: 'You and your traveler decide together. No surge pricing, no algorithms.' },
              { Icon: Clock, title: 'Track every step.', body: "Pickup, in-transit, handoff — you'll know exactly where your parcel is." },
              { Icon: Check, title: 'Pay on delivery.', body: 'Funds are held in escrow and released only when the parcel is safely handed over.' }
            ].map(({ Icon, title, body }, idx) => (
              <Reveal key={title} delay={idx * 0.1} className="text-center md:text-left">
                <motion.div
                  whileHover={{ scale: 1.2, rotate: -10 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="w-12 h-12 rounded-full bg-brand-light grid place-items-center mx-auto md:mx-0 mb-4"
                >
                  <Icon className="w-6 h-6 text-brand" strokeWidth={1.5} />
                </motion.div>
                <p className="font-serif text-2xl text-ink">{title}</p>
                <p className="mt-2 text-ink2 leading-relaxed">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============== COMMUNITY ============== */}
      <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
        <img
          src={PHOTOS.communityBg}
          alt="Diverse group of SendJet community members"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/75 via-ink/70 to-ink/85" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="font-serif font-extrabold text-3xl sm:text-5xl leading-tight tracking-tight text-white">
              Help us build the first global<br className="hidden sm:inline" /> traveler-powered delivery community.
            </h2>
            <p className="mt-6 text-lg text-white/80 leading-relaxed max-w-2xl mx-auto">
              SendJet is brand new — and we&apos;re inviting the very first travelers and senders to shape it with us.
              Every early member helps us build a warmer, more connected way to move packages across the world.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
            <motion.button
              data-testid="community-cta-travel"
              onClick={gotoWithAuth('/create-trip', 'post-trip')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-brand hover:bg-brand-hover text-white rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium shadow-sm transition"
            >
              Travel &amp; Earn
            </motion.button>
            <motion.button
              data-testid="community-cta-send"
              onClick={gotoWithAuth('/create-shipment', 'post-shipment')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="w-full sm:w-auto inline-flex justify-center items-center bg-white/95 border border-white hover:bg-white text-ink rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium transition"
            >
              Send a Package
            </motion.button>
          </Reveal>
          <p className="mt-6 text-sm text-white/90">Real member stories will appear here as our first deliveries complete.</p>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section id="faq" className="py-14 sm:py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-9 sm:mb-14">
            <h2 className="font-serif font-extrabold text-3xl sm:text-5xl leading-tight tracking-tight text-ink">
              Everything you might be wondering.
            </h2>
          </Reveal>
          <div className="space-y-2">
            <FaqItem defaultOpen question="How does SendJet work?">
              SendJet is a marketplace that connects senders with travelers already traveling their route.
              You post either a trip (as a traveler) or a package (as a sender), find a match,
              agree on a price, and the parcel travels with a fellow traveler by plane, car, train or bus. Payment is
              held in escrow and released only when the recipient confirms delivery.
            </FaqItem>
            <FaqItem question="Is my package safe with a stranger?">
              Check each profile for the verification steps that person has completed, read reviews, keep communication inside SendJet, and only continue when the handoff details are clear to both sides.
            </FaqItem>
            <FaqItem question="Do I need an account to browse?">
              No. You can browse the marketplace, open any trip or parcel, and read profiles freely.
              You&apos;ll only be asked to sign up when you want to post, message, or pay.
            </FaqItem>
            <FaqItem question="How is the price decided?">
              The sender and traveler can agree on a per-kilogram or fixed price, depending on the journey. Any platform fee shown in the payment flow should be visible before payment is confirmed.
            </FaqItem>
          </div>
          <div className="text-center mt-8">
            <Link to="/faq" className="text-ink font-medium hover:text-brand transition" data-testid="faq-see-all">
              See all questions →
            </Link>
          </div>
        </div>
      </section>

      {/* ============== FINAL CTA ============== */}
      <section className="py-12 sm:py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-brand-light rounded-[26px] sm:rounded-[32px] px-5 py-10 sm:px-8 sm:py-14 md:px-16 md:py-20 text-center relative overflow-hidden">
            <div className="blob-a absolute -top-10 -left-10 w-56 h-56 rounded-full bg-white/40 blur-3xl pointer-events-none" />
            <div className="blob-b absolute -bottom-16 -right-10 w-64 h-64 rounded-full bg-brand/20 blur-3xl pointer-events-none" />
            <Reveal className="relative">
              <h2 className="font-serif font-extrabold text-3xl sm:text-5xl leading-tight tracking-tight text-ink max-w-2xl mx-auto">
                Ready to travel light — or send with heart?
              </h2>
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
                <motion.button
                  data-testid="final-cta-travel"
                  onClick={gotoWithAuth('/create-trip', 'post-trip')}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full sm:w-auto inline-flex justify-center items-center bg-brand hover:bg-brand-hover text-white rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium shadow-sm transition"
                >
                  Travel &amp; Earn
                </motion.button>
                <motion.button
                  data-testid="final-cta-send"
                  onClick={gotoWithAuth('/create-shipment', 'post-shipment')}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="w-full sm:w-auto inline-flex justify-center items-center bg-white border border-hairline hover:border-ink text-ink rounded-full px-7 sm:px-8 py-3.5 sm:py-4 font-medium transition"
                >
                  Send a Package
                </motion.button>
                <Link
                  to="/marketplace"
                  data-testid="final-cta-browse"
                  className="text-ink font-medium hover:text-brand transition sm:ml-2 py-2"
                >
                  Browse Marketplace →
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

    </div>
  );
};

const FaqItem = ({ question, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-hairline/60 shadow-soft">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-ink">{question}</span>
        <span className={`text-ink3 transition-transform text-2xl leading-none ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      {open && <p className="px-4 sm:px-6 pb-5 sm:pb-6 text-ink2 leading-relaxed">{children}</p>}
    </div>
  );
};

export default LandingPage;
