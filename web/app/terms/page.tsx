import Link from "next/link";
import { Nav } from "@/components/nav";

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-10">Last updated: May 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            By accessing or using Fortify (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service
            (&ldquo;Terms&rdquo;). If you do not agree to all of these Terms, do not access or use the Service. These Terms
            constitute a legally binding agreement between you (&ldquo;User&rdquo;, &ldquo;you&rdquo;) and Fortify
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You must be at least 18 years of age to use the Service. By using the Service you represent and warrant that
            you are 18 or older and have the legal capacity to enter into a binding contract. If you are using the Service
            on behalf of a business or other legal entity, you represent that you have authority to bind that entity to
            these Terms.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You acknowledge that a valid Discord account is required to authenticate with Fortify. By connecting your
            Discord account you consent to our use of your Discord profile data (including username, avatar, and email)
            as described in our{" "}
            <Link href="/privacy" className="underline hover:text-text transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Fortify is a SaaS business automation platform that provides tools including but not limited to: lead
            sourcing and scoring, review monitoring and response, competitor alerting, payment recovery automation,
            content inspiration via social trend analysis, YouTube comment intelligence, virality scoring and
            cross-platform publishing, and other AI-powered business workflows.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            The Service integrates with third-party platforms including Meta (Facebook, Instagram), Google, Shopify,
            Stripe, TikTok, YouTube, Discord, Apify, and Anthropic&rsquo;s Claude AI. Data sourced from these
            third-party APIs is provided for informational and automation purposes. We do not guarantee the accuracy,
            completeness, or timeliness of data obtained from third-party sources.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with
            reasonable notice where practical. We may add or remove third-party integrations, change AI models, or
            adjust rate limits as our underlying service providers update their offerings.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Access to Fortify requires authentication via Discord OAuth. You are responsible for maintaining the
            security of your Discord account and for all activities that occur under your Fortify account. You must
            notify us immediately at{" "}
            <a href="mailto:support@fortify-io.com" className="underline hover:text-text transition-colors">
              support@fortify-io.com
            </a>{" "}
            if you suspect unauthorised access.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You may not share your account credentials, transfer your account to another person, or operate multiple
            accounts for the same individual or entity without our prior written consent. Accounts found to be shared
            or fraudulently duplicated may be suspended without refund.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You agree to provide accurate and complete information when setting up your account and to keep your
            connected integrations (Shopify stores, Stripe keys, Meta pages, etc.) current and authorised. You are
            solely responsible for the connected accounts and any actions taken on those platforms through Fortify.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">4. Subscription &amp; Billing</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Fortify is offered on the following subscription plans:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>
              <strong className="text-text">Pro</strong> &mdash; £29.00 per month
            </li>
            <li>
              <strong className="text-text">Elite</strong> &mdash; £79.00 per month
            </li>
            <li>
              <strong className="text-text">Apex</strong> &mdash; £199.00 per month
            </li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Subscriptions are billed monthly in advance via PayPal. By subscribing you authorise us to charge the
            applicable fee to your PayPal account on a recurring monthly basis until you cancel. Prices are quoted
            inclusive of any applicable taxes unless otherwise stated.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">No Refund Policy.</strong> All subscription fees are non-refundable. There
            are no refunds or credits for partial months of service, plan downgrades, or unused features. If you cancel
            your subscription, your access to paid features will continue until the end of the current billing period,
            after which your account will revert to the free tier or be deactivated.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We reserve the right to change our pricing at any time. We will provide at least 30 days&rsquo; advance
            notice of any price increase via email or in-app notification. Continued use of the Service after a price
            change takes effect constitutes your agreement to the new price.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Certain features within the Service consume &ldquo;credits&rdquo; that are allocated per subscription tier.
            Credits are consumed per operation (e.g., lead sourcing searches, AI-generated content). Credits do not
            roll over between billing periods and have no monetary value. We reserve the right to adjust credit
            allocations as part of plan updates.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">5. Acceptable Use</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not use
            the Service:
          </p>
          <ul className="text-text-muted text-sm leading-relaxed mb-3 list-disc list-inside space-y-1 pl-2">
            <li>
              To send unsolicited bulk communications, spam, or any form of mass outreach that violates applicable
              anti-spam laws (including but not limited to the UK PECR, CAN-SPAM, or GDPR).
            </li>
            <li>
              To engage in any illegal activity, including but not limited to fraud, harassment, defamation, or
              violation of any intellectual property rights.
            </li>
            <li>
              To scrape, crawl, or systematically extract data from third-party platforms in a manner that violates
              their respective terms of service.
            </li>
            <li>
              To reverse engineer, decompile, disassemble, or attempt to derive the source code of the Service.
            </li>
            <li>
              To attempt to gain unauthorised access to any part of the Service, its servers, or any connected
              third-party systems.
            </li>
            <li>
              To use the Service to generate, distribute, or publish content that is defamatory, discriminatory,
              obscene, or otherwise harmful.
            </li>
            <li>
              To resell, sublicense, or commercially exploit the Service or its outputs without our prior written
              consent.
            </li>
            <li>
              To use automated scripts, bots, or tools to interact with the Service in ways not supported by the
              official interface, except through our published APIs.
            </li>
          </ul>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We reserve the right to suspend or terminate your account without notice if we determine, in our sole
            discretion, that you have violated this Acceptable Use policy. We may also report suspected illegal
            activity to appropriate law enforcement authorities.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            The Service, including its software, design, text, graphics, logos, and all content created by Fortify, is
            owned by or licensed to us and is protected by UK and international intellectual property laws. Nothing in
            these Terms grants you any right to use our trademarks, logos, or brand assets without our prior written
            consent.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You retain ownership of any content, data, or materials you upload to the Service (&ldquo;User
            Content&rdquo;). By uploading User Content, you grant us a non-exclusive, worldwide, royalty-free licence
            to use, process, and store that content solely as necessary to provide the Service to you. We will not sell
            your User Content to third parties.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            AI-generated outputs produced by the Service (such as lead hooks, outreach drafts, review responses, and
            content ideas) are provided to you for your use. You are responsible for reviewing AI-generated content
            before publishing or sending it. We make no representations about the originality of AI outputs, and you
            assume full responsibility for any such content you publish.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">7. Privacy</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Your use of the Service is also governed by our{" "}
            <Link href="/privacy" className="underline hover:text-text transition-colors">
              Privacy Policy
            </Link>
            , which is incorporated into these Terms by reference. By using the Service, you consent to the collection
            and use of your information as described in the Privacy Policy.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            When you connect third-party accounts (such as Shopify, Stripe, Meta, or Google), you authorise us to
            access data from those platforms on your behalf as necessary to provide the Service features you have
            enabled. You are responsible for ensuring you have the legal right to share such data with us and that
            doing so does not violate the terms of service of those platforms.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">No Warranties.</strong> The Service is provided &ldquo;as is&rdquo; and
            &ldquo;as available&rdquo; without warranties of any kind, whether express or implied, including but not
            limited to warranties of merchantability, fitness for a particular purpose, non-infringement, or
            uninterrupted or error-free operation. We do not warrant that the Service will meet your specific
            requirements or that data obtained through the Service is accurate or up to date.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Limitation.</strong> To the maximum extent permitted by applicable law,
            Fortify and its officers, directors, employees, and agents shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages arising out of or in connection with your use of
            the Service, even if we have been advised of the possibility of such damages.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            In no event shall our aggregate liability to you for all claims arising from or related to the Service
            exceed the total subscription fees you paid to us in the three (3) months immediately preceding the event
            giving rise to the claim. This limitation applies regardless of the form of the claim, whether in contract,
            tort (including negligence), strict liability, or otherwise.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Some jurisdictions do not allow the exclusion of certain warranties or limitations on liability. In those
            jurisdictions, our liability is limited to the maximum extent permitted by law.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            You may cancel your subscription at any time through your account settings or by contacting us at{" "}
            <a href="mailto:support@fortify-io.com" className="underline hover:text-text transition-colors">
              support@fortify-io.com
            </a>
            . Cancellation will take effect at the end of your current billing period. No refunds will be issued for
            the remaining period.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We reserve the right to suspend or terminate your access to the Service at any time, with or without
            cause, and with or without notice, if we determine that you have violated these Terms or if we are required
            to do so by law. In cases of serious breach (such as fraudulent activity, abuse of the platform, or illegal
            use), we may terminate immediately without issuing a refund.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Upon termination, your right to use the Service immediately ceases. We may delete your data after a
            reasonable retention period. Provisions of these Terms that by their nature should survive termination
            (including intellectual property, limitation of liability, and governing law) shall survive.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            These Terms and any disputes arising from or in connection with them shall be governed by and construed in
            accordance with the laws of England and Wales, without regard to conflict of law principles.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Any legal action or proceeding arising under these Terms shall be brought exclusively in the courts of
            England and Wales, and you irrevocably consent to the personal jurisdiction and venue therein. This does not
            affect any statutory rights you may have as a consumer under applicable UK law.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We reserve the right to update or modify these Terms at any time. When we make material changes, we will
            notify you by email to the address associated with your account and/or by posting a prominent notice within
            the Service. The &ldquo;Last updated&rdquo; date at the top of this page indicates when the Terms were last
            revised.
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            Your continued use of the Service after the effective date of any changes constitutes your acceptance of
            the revised Terms. If you do not agree to the updated Terms, you must stop using the Service and cancel
            your subscription before the effective date.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            <strong className="text-text">Email:</strong>{" "}
            <a href="mailto:support@fortify-io.com" className="underline hover:text-text transition-colors">
              support@fortify-io.com
            </a>
          </p>
          <p className="text-text-muted text-sm leading-relaxed mb-3">
            We aim to respond to all enquiries within 2 business days.
          </p>
        </section>
      </main>
    </>
  );
}
