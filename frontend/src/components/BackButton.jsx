import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Consistent, app-wide contextual Back button.
 * - Uses router history (navigate(-1)) when the user arrived from another
 *   in-app page, so "Marketplace → Trip Details → Back" returns to Marketplace.
 * - Falls back to a sensible route on direct URL access / no history.
 * - Desktop: arrow + "Back" text. Mobile: compact arrow-only.
 */
export const BackButton = ({ fallback = '/marketplace', label = 'Back', className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // location.key is 'default' only when this is the first entry (direct load).
    if (location.key && location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      data-testid="back-button"
      aria-label="Go back"
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-orange-600 rounded-full px-2.5 sm:px-3 py-1.5 hover:bg-orange-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default BackButton;
