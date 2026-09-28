import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Shared layout for all SendJet info / static pages (About, FAQ, Safety, Contact, Impressum).
 * Provides a consistent branded header, "Back" button, and roomy content area.
 *
 * Usage:
 *   <InfoPageLayout title="About Us" subtitle="..." icon={Info}>
 *     ...your section content...
 *   </InfoPageLayout>
 */
export const InfoPageLayout = ({ title, subtitle, icon: Icon, children, testId }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    if (location.key && location.key !== 'default') navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white" data-testid={testId}>
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="info-page-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-800 truncate">{title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <header className="text-center space-y-3">
          {Icon && (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 mx-auto">
              <Icon className="h-7 w-7" />
            </div>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">{title}</h2>
          {subtitle && (
            <p className="text-base text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
          )}
        </header>

        <div className="space-y-6">{children}</div>

        {/* Placeholder notice — remove this block once real content is published */}
        <div className="mt-8 p-4 bg-orange-50 border border-orange-100 rounded-xl text-sm text-orange-800 text-center">
          📝 This is a placeholder layout. Final content will be published soon.
          For urgent questions please email{' '}
          <a href="mailto:info@sendjet.de" className="underline font-semibold">info@sendjet.de</a>.
        </div>
      </div>
    </div>
  );
};

export default InfoPageLayout;
