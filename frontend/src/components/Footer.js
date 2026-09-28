import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin } from 'lucide-react';

const linkBase = 'text-sm text-gray-600 hover:text-orange-600 transition-colors';

export const Footer = () => {
  return (
    <footer
      className="bg-white border-t border-gray-200 mt-12"
      data-testid="site-footer"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-7 sm:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1 flex flex-col gap-3">
            <Link to="/marketplace" className="inline-flex">
              <img
                src="/sendjet-wordmark.png?v=5"
                alt="SendJet"
                className="h-9 w-auto select-none"
                draggable="false"
              />
            </Link>
            <p className="text-sm text-gray-600 max-w-xs leading-relaxed">
              Smart marketplace connecting travelers with senders. Send Smart, Travel Light.
            </p>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">
              Company
            </h3>
            <ul className="space-y-2">
              <li><Link to="/about"   className={linkBase} data-testid="footer-link-about">About Us</Link></li>
              <li><Link to="/contact" className={linkBase} data-testid="footer-link-contact">Contact / Support</Link></li>
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">
              Help
            </h3>
            <ul className="space-y-2">
              <li><Link to="/faq"    className={linkBase} data-testid="footer-link-faq">FAQ</Link></li>
              <li><Link to="/safety" className={linkBase} data-testid="footer-link-safety">Safety Guidelines</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">
              Legal
            </h3>
            <ul className="space-y-2">
              <li><Link to="/legal#terms"   className={linkBase} data-testid="footer-link-terms">Terms of Service</Link></li>
              <li><Link to="/legal#privacy" className={linkBase} data-testid="footer-link-privacy">Privacy Policy</Link></li>
              <li><Link to="/impressum"     className={linkBase} data-testid="footer-link-impressum">Impressum</Link></li>
            </ul>
          </div>
        </div>

        {/* Contact line */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <a
              href="mailto:info@sendjet.de"
              className="inline-flex items-center gap-1.5 hover:text-orange-600 transition-colors"
              data-testid="footer-email"
            >
              <Mail className="h-3.5 w-3.5" />
              info@sendjet.de
            </a>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Germany
            </span>
          </div>
          <p className="text-xs text-gray-500" data-testid="footer-copyright">
            © 2026 SendJet. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
