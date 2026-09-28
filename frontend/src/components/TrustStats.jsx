import React, { useEffect, useState } from 'react';
import { CheckCircle2, Users, Plane, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from './ui/card';
import { AnimatedCounter } from './motion/AnimatedCounter';
import axios from 'axios';

/**
 * Live trust counters pulled from GET /api/stats/public.
 * Rendered on the Safety page as social proof for anonymous visitors.
 */
const TrustStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    axios.get('/stats/public')
      .then((res) => { if (alive) setStats(res.data); })
      .catch(() => { /* stats are best-effort; page still renders without them */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const items = [
    { key: 'deliveries_done',  label: 'Deliveries completed', icon: CheckCircle2, color: 'text-green-600' },
    { key: 'verified_users',   label: 'Verified members',      icon: Users,        color: 'text-orange-600' },
    { key: 'active_trips',     label: 'Live trips right now',  icon: Plane,        color: 'text-blue-600' },
    { key: 'total_shipments',  label: 'Parcels posted',        icon: Package,      color: 'text-purple-600' },
  ];

  return (
    <Card className="border-l-4 border-l-green-500" data-testid="trust-stats-card">
      <CardContent className="p-6 sm:p-8 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">SendJet in numbers</h3>
        <p className="text-sm text-gray-600">
          Every counter below is pulled live from the platform right now — no marketing fluff.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map(({ key, label, icon: Icon, color }, idx) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              whileHover={{ y: -4, scale: 1.03 }}
              className="rounded-xl bg-white border border-gray-100 p-4 shadow-soft"
              data-testid={`trust-stat-${key}`}
            >
              <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }} className="inline-block">
                <Icon className={`h-5 w-5 ${color} mb-2`} />
              </motion.div>
              <p className="text-2xl font-bold text-gray-900 leading-none">
                {loading ? '—' : <AnimatedCounter value={stats?.[key] ?? 0} />}
              </p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrustStats;
