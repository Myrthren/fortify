import Link from "next/link";
import { Nav } from "@/components/nav";

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-10">Last updated: May 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            When you use Fortify we collect the following categories of information:
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Discord profile data.</strong> Authentication is handled via Discord OAuth.
            When you connect your Discord account we receive your Discord user ID, username, avatar, and the email
            address associated with your Discord account.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Account &amp; subscription data.</strong> We store your subscription tier,
            billing status, credit balance, and account preferences in our database.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Usage data.</strong> We collect information about how you use the Service,
            including features accessed, queries submitted, AI-generated outputs produced, and timestamps of activity.
            This data is used to improve the Service and enforce fair-use limits.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Payment information.</strong> Payments are processed by PayPal. We do not
            store your full payment card details. We receive transaction confirmations, subscription status updates,
            and PayPal account identifiers from PayPal.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Connected third-party account data.</strong> If you connect external accounts
            (such as Shopify stores, Stripe accounts, Meta Pages, Google accounts, or TikTok accounts), we store the
            relevant OAuth tokens and access credentials in encrypted form. We access data from those platforms only as
            required to perform the automation features you have explicitly enabled.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">User-submitted content.</strong> This includes any text, URLs, video files, or
            other materials you upload or submit through the Service, such as media files for the Virality Engine or
            ICP descriptions for Lead Sourcing.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Log and device data.</strong> We may collect server logs including IP
            addresses, browser type, operating system, and referring URLs for security, debugging, and abuse
            prevention purposes.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We use the information we collect for the following purposes:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>To provide, maintain, and improve the Service and its features.</li>
            <li>To authenticate your identity and manage your account.</li>
            <li>To process payments and manage your subscription.</li>
            <li>To perform AI-powered automations and analyses you request (e.g., lead scoring, virality analysis).</li>
            <li>To send you transactional emails such as subscription confirmations, payment receipts, and critical
            service notifications.</li>
            <li>To enforce our Terms of Service and Acceptable Use policy.</li>
            <li>To comply with applicable legal obligations.</li>
            <li>To detect and prevent fraud, abuse, and security incidents.</li>
            <li>To analyse aggregate usage trends (using anonymised or pseudonymised data) to improve the Service.</li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We process your personal data on the following legal bases under the UK GDPR: (a) performance of a
            contract — processing necessary to deliver the Service you have subscribed to; (b) legitimate interests
            — security, fraud prevention, and product improvement; (c) consent — where you have explicitly opted in
            (e.g., connecting third-party accounts); (d) legal obligation — where required by law.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">3. Data Sharing</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">We do not sell your personal data.</strong> We do not share your personal
            information with third parties for their own marketing purposes.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We share data with the following categories of third-party service processors, solely as necessary to
            operate the Service:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-text">PayPal</strong> &mdash; payment processing and subscription billing.
            </li>
            <li>
              <strong className="text-text">Anthropic (Claude API)</strong> &mdash; AI language model processing for
              generating outreach hooks, content ideas, lead analysis, and other AI-powered features. Queries may
              include contextual data you provide to the relevant features.
            </li>
            <li>
              <strong className="text-text">Apify</strong> &mdash; web scraping and data extraction infrastructure
              used for competitor monitoring, review scraping, and trend signal collection.
            </li>
            <li>
              <strong className="text-text">Brave Search</strong> &mdash; web search API used for lead sourcing and
              content discovery.
            </li>
            <li>
              <strong className="text-text">Meta (Facebook / Instagram)</strong> &mdash; when you connect your Meta
              accounts, we exchange data with Meta&rsquo;s APIs to retrieve page data, ad account data, and post
              performance metrics.
            </li>
            <li>
              <strong className="text-text">Google (YouTube)</strong> &mdash; when you connect your Google account,
              we access YouTube channel data and comment data through the YouTube Data API.
            </li>
            <li>
              <strong className="text-text">Shopify</strong> &mdash; when you connect your Shopify store, we access
              order data, customer data, and product data necessary for review monitoring and payment rescue features.
            </li>
            <li>
              <strong className="text-text">Stripe</strong> &mdash; when you connect your Stripe account, we access
              payment and subscription data for the payment recovery automation feature.
            </li>
            <li>
              <strong className="text-text">Discord</strong> &mdash; authentication provider; we receive your Discord
              profile data on login.
            </li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We may also disclose your information if required to do so by law, court order, or government authority,
            or where we believe disclosure is necessary to protect the rights, property, or safety of Fortify, our
            users, or the public.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">4. Data Retention</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We retain your personal data for as long as your account is active or as needed to provide the Service. If
            you cancel your account, we will delete or anonymise your personal data within 90 days, except where we
            are required to retain it for legal, regulatory, or legitimate business purposes (such as financial records
            for tax compliance, which we retain for 7 years as required by UK law).
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            AI-generated outputs and generation logs are retained for up to 12 months for debugging and quality
            improvement purposes, after which they are deleted or anonymised.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Connected third-party account tokens are deleted when you disconnect an integration or close your account.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">5. Your Rights (GDPR)</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            As a user based in the UK or European Economic Area, you have the following rights under the UK GDPR and
            applicable data protection law:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-text">Right of access.</strong> You may request a copy of the personal data we
              hold about you.
            </li>
            <li>
              <strong className="text-text">Right to rectification.</strong> You may request that we correct inaccurate
              or incomplete personal data.
            </li>
            <li>
              <strong className="text-text">Right to erasure.</strong> You may request that we delete your personal
              data (&ldquo;right to be forgotten&rdquo;), subject to our legal obligations to retain certain data.
            </li>
            <li>
              <strong className="text-text">Right to data portability.</strong> You may request a copy of your data in
              a structured, commonly used, machine-readable format.
            </li>
            <li>
              <strong className="text-text">Right to restrict processing.</strong> You may request that we restrict the
              processing of your personal data in certain circumstances.
            </li>
            <li>
              <strong className="text-text">Right to object.</strong> You may object to processing based on our
              legitimate interests.
            </li>
            <li>
              <strong className="text-text">Right to withdraw consent.</strong> Where processing is based on consent,
              you may withdraw that consent at any time.
            </li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            To exercise any of these rights, please email{" "}
            <a href="mailto:privacy@fortify-io.com" className="underline hover:text-text transition-colors">
              privacy@fortify-io.com
            </a>
            . We will respond within 30 days. You also have the right to lodge a complaint with the Information
            Commissioner&rsquo;s Office (ICO) in the UK if you believe your data has been handled unlawfully.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">6. Cookies</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Fortify uses cookies and similar technologies to maintain your authenticated session and remember your
            preferences. We use session cookies (which expire when you close your browser) and persistent cookies
            (which remain for a defined period to keep you logged in).
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We do not use third-party advertising cookies or tracking pixels for behavioural advertising purposes. You
            can configure your browser to refuse cookies; however, doing so may prevent you from logging in to or
            using the Service.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">7. Third-Party Services</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            The Service integrates with third-party platforms and APIs. When you connect or use those integrations,
            your data is also subject to the privacy policies of those third parties. We encourage you to review the
            privacy policies of any third-party service you connect:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>Discord: discord.com/privacy</li>
            <li>PayPal: paypal.com/privacy</li>
            <li>Anthropic: anthropic.com/privacy</li>
            <li>Meta: facebook.com/privacy/policy</li>
            <li>Google / YouTube: policies.google.com/privacy</li>
            <li>Shopify: shopify.com/legal/privacy</li>
            <li>Stripe: stripe.com/privacy</li>
            <li>Apify: apify.com/privacy-policy</li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We are not responsible for the privacy practices of third-party services. Connecting a third-party account
            is optional; features that rely on that integration will be unavailable if you choose not to connect.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">8. Children&rsquo;s Privacy</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            The Service is intended solely for users who are 18 years of age or older. We do not knowingly collect
            personal data from individuals under the age of 18. If we become aware that we have collected data from a
            person under 18, we will delete that data promptly. If you believe we have inadvertently collected data
            from a minor, please contact us at{" "}
            <a href="mailto:privacy@fortify-io.com" className="underline hover:text-text transition-colors">
              privacy@fortify-io.com
            </a>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you by
            email and/or by posting a notice within the Service. The &ldquo;Last updated&rdquo; date at the top of
            this page reflects when the policy was last revised.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Continued use of the Service after changes take effect constitutes your acceptance of the revised policy.
            If you do not agree to the updated policy, you should stop using the Service and close your account.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Fortify operates from England, United Kingdom. If you have any questions, concerns, or requests relating
            to this Privacy Policy or our data practices, please contact us:
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Email:</strong>{" "}
            <a href="mailto:privacy@fortify-io.com" className="underline hover:text-text transition-colors">
              privacy@fortify-io.com
            </a>
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            For general support enquiries, contact{" "}
            <a href="mailto:support@fortify-io.com" className="underline hover:text-text transition-colors">
              support@fortify-io.com
            </a>
            .
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You also have the right to lodge a complaint with the Information Commissioner&rsquo;s Office (ICO):
            ico.org.uk
          </p>
        </section>
      </main>
    </>
  );
}
