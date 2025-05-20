import React from "react";
import { Navbar } from "@/components/landing-page/navbar";
import { Footer } from "@/components/landing-page/footer";

export default function TermsOfService() {
  return (
    <main className="min-h-screen flex flex-col bg-black">
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto px-4 pb-12 pt-28 text-gray-200">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <div className="space-y-8">
          <section>
            <p className="text-sm text-gray-400 mb-4">
              Last Updated: {new Date().toLocaleDateString()}
            </p>
            <p className="mb-4">
              Welcome to Trakure! These Terms of Service ("Terms") govern your
              access to and use of the Trakure software-as-a-service application
              (the "Service") provided by Trakure ("we," "us," or "our"). Please
              read these Terms carefully.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="mb-4">
              By creating an account, accessing, or using the Service, you agree
              to be bound by these Terms and our Privacy Policy. If you do not
              agree to these Terms, do not use the Service. If you are using the
              Service on behalf of an organization, you are agreeing to these
              Terms for that organization and promising that you have the
              authority to bind that organization to these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              2. Description of Service
            </h2>
            <p className="mb-4">
              Trakure provides a platform for export firms to document and track
              items through their internal production workflows, manage rework,
              set packaging reminders, and generate related documentation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              3. User Accounts
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Account Creation:
                </h3>
                <p>
                  You must provide accurate and complete information when
                  creating an account. You are responsible for maintaining the
                  confidentiality of your account password and for all
                  activities that occur under your account.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Account Responsibilities:
                </h3>
                <p>
                  You are responsible for all data and content you upload or
                  input into the Service ("User Content"). You represent and
                  warrant that you have all necessary rights to your User
                  Content and that its use in connection with the Service does
                  not violate any applicable laws or rights of third parties.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  User Roles:
                </h3>
                <p>
                  The Service allows an "Owner" to manage the organization's
                  account and invite "Workers." The Owner is responsible for
                  managing user access and permissions within their
                  organization.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              4. Use of the Service
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  License:
                </h3>
                <p>
                  Subject to these Terms, we grant you a limited, non-exclusive,
                  non-transferable, and revocable license to use the Service for
                  your internal business purposes.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Acceptable Use:
                </h3>
                <p>
                  You agree not to misuse the Service or help anyone else to do
                  so. This includes, but is not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 pl-4 mt-2">
                  <li>Violating any laws or regulations.</li>
                  <li>
                    Infringing on the intellectual property rights of others.
                  </li>
                  <li>
                    Uploading or transmitting malicious code, viruses, or
                    harmful data.
                  </li>
                  <li>
                    Attempting to gain unauthorized access to the Service or its
                    related systems.
                  </li>
                  <li>
                    Interfering with or disrupting the integrity or performance
                    of the Service.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              5. Fees and Payment
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Subscription Fees:
                </h3>
                <p>
                  Certain features of the Service may require payment of
                  subscription fees. All fees are as quoted on the Trakure
                  website or as otherwise agreed in writing.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Payment:
                </h3>
                <p>
                  You agree to pay all applicable fees for your subscription. We
                  use a third-party payment processor (e.g., Dodo Payments for
                  Trakure's subscription management) to handle payments.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Changes to Fees:
                </h3>
                <p>
                  We reserve the right to change our fees upon reasonable prior
                  notice.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">Taxes:</h3>
                <p>
                  You are responsible for all applicable taxes associated with
                  your subscription.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              6. Term and Termination
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">Term:</h3>
                <p>
                  These Terms remain in effect as long as you use the Service.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Termination:
                </h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li>You may terminate your account at any time.</li>
                  <li>
                    We may suspend or terminate your access to the Service at
                    any time, with or without cause, and with or without notice,
                    for any reason, including, but not limited to, a breach of
                    these Terms.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Effect of Termination:
                </h3>
                <p>
                  Upon termination, your right to use the Service will
                  immediately cease. We may delete your User Content from our
                  systems, though we may retain certain data as required by law
                  or for legitimate business purposes.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              7. Intellectual Property
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-white mb-2">Our IP:</h3>
                <p>
                  We own all rights, title, and interest in and to the Service,
                  including all related intellectual property rights.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-white mb-2">
                  Your User Content:
                </h3>
                <p>
                  You retain ownership of your User Content. You grant us a
                  worldwide, non-exclusive, royalty-free license to use,
                  reproduce, modify, and display your User Content solely as
                  necessary to provide and improve the Service.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              8. Disclaimers
            </h2>
            <p className="uppercase">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT
              NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT
              THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY
              SECURE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              9. Limitation of Liability
            </h2>
            <p className="uppercase mb-4">
              TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT WILL TRAKURE,
              ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, SUPPLIERS, OR
              LICENSORS BE LIABLE FOR (A) ANY INDIRECT, INCIDENTAL, SPECIAL,
              PUNITIVE, COVER, OR CONSEQUENTIAL DAMAGES (INCLUDING, WITHOUT
              LIMITATION, DAMAGES FOR LOST PROFITS, REVENUE, GOODWILL, USE, OR
              CONTENT) HOWEVER CAUSED, UNDER ANY THEORY OF LIABILITY, INCLUDING,
              WITHOUT LIMITATION, CONTRACT, TORT, WARRANTY, NEGLIGENCE, OR
              OTHERWISE, EVEN IF WE HAVE BEEN ADVISED AS TO THE POSSIBILITY OF
              SUCH DAMAGES.
            </p>
            <p className="uppercase">
              OUR AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE
              WILL NOT EXCEED THE GREATER OF ONE HUNDRED U.S. DOLLARS ($100) OR
              THE AMOUNTS PAID BY YOU TO US FOR THE PAST TWELVE MONTHS OF THE
              SERVICE IN QUESTION.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              10. Indemnification
            </h2>
            <p>
              You agree to indemnify and hold harmless Trakure and its officers,
              directors, employees, and agents from and against any claims,
              disputes, demands, liabilities, damages, losses, and costs and
              expenses, including, without limitation, reasonable legal and
              accounting fees arising out of or in any way connected with (i)
              your access to or use of the Service, (ii) your User Content, or
              (iii) your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              11. Governing Law
            </h2>
            <p>
              These Terms shall be governed by the laws of India, without regard
              to its conflict of laws principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              12. Changes to Terms
            </h2>
            <p>
              We may modify these Terms from time to time. If we make material
              changes, we will provide you with notice (e.g., by email or by
              posting a notice on the Service). Your continued use of the
              Service after such notice constitutes your acceptance of the
              modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">
              13. Contact Us
            </h2>
            <p>
              If you have any questions about these Terms, please contact us at{" "}
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
