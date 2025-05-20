import React from "react";
import { Navbar } from "@/components/landing-page/navbar";
import { Footer } from "@/components/landing-page/footer";

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen flex flex-col bg-black">
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 pb-12 pt-28 text-gray-200">
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <div className="space-y-8">
          <section>
            <p className="text-sm text-gray-400 mb-4">
              Last Updated: {new Date().toLocaleDateString()}
            </p>
            <p className="mb-4">
              Welcome to Trakure! Your privacy is important to us. This Privacy
              Policy explains how Trakure ("we," "us," or "our") collects, uses,
              shares, and protects information in relation to our
              software-as-a-service application (the "Service").
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Information We Collect
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Information You Provide Us:
                </h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li>
                    <span className="font-medium">Account Information:</span>{" "}
                    When you sign up for Trakure, we collect information such as
                    your name, email address, organization name, and password.
                  </li>
                  <li>
                    <span className="font-medium">Payment Information:</span> If
                    you subscribe to a paid plan, our third-party payment
                    processor (e.g., Dodo Payments) will collect your payment
                    information. We do not store your full credit card details.
                  </li>
                  <li>
                    <span className="font-medium">Workflow Data:</span>{" "}
                    Information you input into the Service, including details
                    about your orders, items (SKUs, dimensions, etc.), workflow
                    stages, sub-stages, remarks, packaging materials, and
                    uploaded images.
                  </li>
                  <li>
                    <span className="font-medium">Communications:</span> If you
                    contact us directly, we may receive additional information
                    about you.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Information We Collect Automatically:
                </h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li>
                    <span className="font-medium">Usage Data:</span> We may
                    collect information about how you use the Service, such as
                    features accessed, actions taken, time spent on pages, and
                    error logs.
                  </li>
                  <li>
                    <span className="font-medium">
                      Device and Connection Information:
                    </span>{" "}
                    We may collect information about the device you use to
                    access the Service, such as IP address, operating system,
                    browser type, and device identifiers.
                  </li>
                  <li>
                    <span className="font-medium">
                      Cookies and Similar Technologies:
                    </span>{" "}
                    We use cookies to operate and administer our Service, gather
                    usage data, and improve your experience.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Provide, operate, maintain, and improve the Service.</li>
              <li>Process your transactions and manage your subscription.</li>
              <li>
                Send you transactional communications, including service
                announcements, technical notices, updates, and support messages.
              </li>
              <li>
                Respond to your comments, questions, and requests, and provide
                customer service.
              </li>
              <li>
                Monitor and analyze trends, usage, and activities in connection
                with our Service.
              </li>
              <li>Personalize the Service.</li>
              <li>
                For compliance purposes, including enforcing our Terms of
                Service, or other legal rights.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. How We Share Your Information
            </h2>
            <p className="mb-4">
              We do not sell your personal information. We may share information
              as follows:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                <span className="font-medium">With Service Providers:</span> We
                may share information with third-party vendors and service
                providers that perform services on our behalf (e.g., payment
                processing by Dodo Payments, email delivery by Resend, hosting
                by Supabase/Vercel, analytics). These service providers will
                only have access to the information necessary to perform these
                limited functions.
              </li>
              <li>
                <span className="font-medium">For Legal Reasons:</span> We may
                disclose your information if required to do so by law or in the
                good faith belief that such action is necessary to comply with a
                legal obligation, protect and defend our rights or property,
                prevent fraud, act in urgent circumstances to protect the
                personal safety of users of the Service, or protect against
                legal liability.
              </li>
              <li>
                <span className="font-medium">Business Transfers:</span> If we
                are involved in a merger, acquisition, financing,
                reorganization, bankruptcy, or sale of all or a portion of our
                assets, your information may be sold or transferred as part of
                that transaction.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Data Security
            </h2>
            <p>
              We implement reasonable technical and organizational measures to
              protect the information we collect. However, no internet or email
              transmission is ever fully secure or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Data Retention
            </h2>
            <p>
              We retain your information for as long as your account is active
              or as needed to provide you the Service, comply with our legal
              obligations, resolve disputes, and enforce our agreements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Your Choices
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>
                You can access and update your account information through your
                account settings.
              </li>
              <li>
                You may opt-out of marketing communications by following the
                unsubscribe instructions in those emails.
              </li>
              <li>
                You can typically remove or reject cookies through your browser
                settings.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. International Data Transfers
            </h2>
            <p>
              If you are located outside India and choose to use the Service,
              your information may be transferred to India, and processed there.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Children's Privacy
            </h2>
            <p>
              Our Service is not directed to individuals under the age of 18. We
              do not knowingly collect personal information from children under
              18.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the "Last Updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy, please
              contact us at{" "}
              <a
                href="mailto:support@trakure.com"
                className="text-blue-400 hover:text-blue-300"
              >
                support@trakure.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
