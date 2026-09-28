import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Shield, FileText, CreditCard, Scale } from 'lucide-react';

const LegalPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white" data-testid="legal-page">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="legal-back-btn">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-bold text-gray-800">SendJet Legal</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="#terms" className="block">
            <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
              <CardContent className="p-5 flex items-center gap-3">
                <FileText className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-800">Terms of Use</p>
                  <p className="text-xs text-gray-500">Platform rules</p>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="#privacy" className="block">
            <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
              <CardContent className="p-5 flex items-center gap-3">
                <Shield className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-semibold text-gray-800">Privacy Policy</p>
                  <p className="text-xs text-gray-500">Data protection</p>
                </div>
              </CardContent>
            </Card>
          </a>
          <a href="#payment" className="block">
            <Card className="hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
              <CardContent className="p-5 flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-green-500" />
                <div>
                  <p className="font-semibold text-gray-800">Payment Agreement</p>
                  <p className="text-xs text-gray-500">Transaction terms</p>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Last Updated */}
        <p className="text-sm text-gray-500 text-center">Last updated: April 5, 2026</p>

        {/* Intro */}
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-700 leading-relaxed">
              Welcome to SendJet. By creating an account or using our platform, you agree to the following terms, privacy practices, and payment conditions.
            </p>
          </CardContent>
        </Card>

        {/* Section 1: About */}
        <section id="terms">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-500" />
            Terms of Use
          </h2>

          <div className="space-y-5">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">1. About SendJet</h3>
                <p className="text-gray-700 leading-relaxed">
                  SendJet is a peer-to-peer (P2P) marketplace platform that connects individuals ("Senders") who wish to send packages with travelers ("Travelers") who are already traveling to the same destination.
                </p>
                <p className="text-gray-700 leading-relaxed mt-2">
                  SendJet acts only as an intermediary platform and does not transport, store, or handle any packages.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">2. User Accounts</h3>
                <p className="text-gray-700 mb-3">By registering, you confirm that:</p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold mt-0.5">-</span>
                    You are at least 18 years old
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold mt-0.5">-</span>
                    All information provided is accurate and up to date
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-500 font-bold mt-0.5">-</span>
                    You are responsible for maintaining the security of your account
                  </li>
                </ul>
                <p className="text-gray-600 text-sm mt-3 italic">
                  SendJet reserves the right to suspend or terminate accounts that violate these terms.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">3. User Responsibilities</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-semibold text-blue-800 mb-2">Senders agree to:</p>
                    <ul className="space-y-1.5 text-blue-900 text-sm">
                      <li>- Provide accurate and complete information about the package</li>
                      <li>- Properly package items</li>
                      <li>- Not send prohibited or illegal items</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="font-semibold text-green-800 mb-2">Travelers agree to:</p>
                    <ul className="space-y-1.5 text-green-900 text-sm">
                      <li>- Transport packages responsibly</li>
                      <li>- Follow airline and customs regulations</li>
                      <li>- Deliver packages as agreed</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-3">4. Prohibited Items</h3>
                <p className="text-gray-700 mb-3">Users are strictly prohibited from sending or transporting:</p>
                <div className="bg-red-50 rounded-lg p-4">
                  <ul className="space-y-1.5 text-red-800 text-sm">
                    <li>- Illegal drugs or substances</li>
                    <li>- Weapons or explosives</li>
                    <li>- Hazardous or dangerous materials</li>
                    <li>- Cash, financial instruments, or illegal goods</li>
                    <li>- Any item restricted by local or international laws</li>
                  </ul>
                </div>
                <p className="text-gray-600 text-sm mt-3 italic">
                  SendJet is not responsible for any legal consequences arising from prohibited items.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">6. Tracking and Communication</h3>
                <p className="text-gray-700 leading-relaxed">
                  SendJet may provide shipment tracking based on status updates (milestones) and messaging between users. SendJet does not guarantee real-time tracking accuracy.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">8. Disclaimer of Liability</h3>
                <p className="text-gray-700 mb-3">SendJet is not responsible for:</p>
                <ul className="space-y-1.5 text-gray-700 text-sm">
                  <li>- Loss, damage, or delay of packages</li>
                  <li>- Actions or misconduct of users</li>
                  <li>- Any disputes between users</li>
                  <li>- Legal issues related to transported items</li>
                </ul>
                <p className="text-sm text-gray-600 mt-3 font-medium">All use of the platform is at the user's own risk.</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">9. Disputes</h3>
                <p className="text-gray-700 leading-relaxed">
                  SendJet may assist in resolving disputes but is not obligated to enforce any outcome.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">10. Account Suspension</h3>
                <p className="text-gray-700 leading-relaxed">
                  SendJet may suspend or terminate accounts that violate these terms or misuse the platform.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">11. Modifications</h3>
                <p className="text-gray-700 leading-relaxed">
                  SendJet reserves the right to update these terms at any time. Continued use of the platform means acceptance of changes.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 2: Privacy */}
        <section id="privacy">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-500" />
            Privacy Policy
          </h2>

          <div className="space-y-5">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">7. Privacy and Data Protection</h3>
                <p className="text-gray-700 mb-4">
                  SendJet collects and processes personal data in accordance with applicable data protection laws (including GDPR).
                </p>

                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-semibold text-blue-800 mb-2">We may collect:</p>
                    <ul className="space-y-1 text-blue-900 text-sm">
                      <li>- Name, email, phone number</li>
                      <li>- Location data (if enabled)</li>
                      <li>- Messages within the platform</li>
                      <li>- Transaction data</li>
                    </ul>
                  </div>

                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="font-semibold text-indigo-800 mb-2">Data is used to:</p>
                    <ul className="space-y-1 text-indigo-900 text-sm">
                      <li>- Operate and improve the platform</li>
                      <li>- Match users</li>
                      <li>- Process payments</li>
                    </ul>
                  </div>

                  <p className="text-gray-700 font-medium">We do not sell personal data.</p>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="font-semibold text-gray-800 mb-2">Data may be shared with:</p>
                    <ul className="space-y-1 text-gray-700 text-sm">
                      <li>- Payment providers (e.g., Stripe)</li>
                      <li>- Legal authorities if required</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="font-semibold text-green-800 mb-2">Users have the right to:</p>
                    <ul className="space-y-1 text-green-900 text-sm">
                      <li>- Access their data</li>
                      <li>- Request correction or deletion</li>
                      <li>- Withdraw consent</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3: Payment */}
        <section id="payment">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-green-500" />
            Payment Agreement
          </h2>

          <div className="space-y-5">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">5. Payments and Fees</h3>
                <p className="text-gray-700 mb-3">All payments are processed through third-party providers such as Stripe.</p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold mt-0.5">-</span>
                    Payments may be held temporarily until delivery is confirmed
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold mt-0.5">-</span>
                    SendJet may deduct a service fee from transactions
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 font-bold mt-0.5">-</span>
                    Users agree to comply with the terms of the payment provider
                  </li>
                </ul>
                <p className="text-gray-600 text-sm mt-3 italic">
                  SendJet does not directly hold or manage funds outside of the payment system.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Governing Law & Contact */}
        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Scale className="h-5 w-5 text-gray-600" />
                  12. Governing Law
                </h3>
                <p className="text-gray-700">These terms are governed by the laws of the EU.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">13. Contact</h3>
                <p className="text-gray-700">
                  For any questions, please contact:{' '}
                  <a href="mailto:info@sendjet.de" className="text-orange-600 hover:underline font-medium">
                    info@sendjet.de
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agreement Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center">
          <p className="text-gray-800 font-medium">
            By creating an account, you confirm that you have read and agree to these Terms of Use, Privacy Policy, and Payment Agreement.
          </p>
        </div>

        <div className="text-center pb-8">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} SendJet. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
