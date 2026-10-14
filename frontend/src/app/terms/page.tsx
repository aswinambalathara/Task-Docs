import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { CONTACT_EMAIL, OPERATOR_NAME, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Terms of Service | Tethr",
  description: "The terms that govern your use of Tethr.",
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Tethr, available at{" "}
          <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a> and operated by {OPERATOR_NAME}{" "}
          (&quot;Tethr&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or using
          Tethr, you agree to these Terms. If you do not agree, do not use the service.
        </p>
      }
    >
      <LegalSection id="service" title="1. The service">
        <p>
          Tethr lets software engineers log their tasks, outcomes and supporting evidence. It also
          lets them sync that log, and AI-generated summaries of it, to a Google Doc they own. You
          can use Tethr from the web dashboard or from AI coding assistants connected through the
          Model Context Protocol (MCP).
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Eligibility and accounts">
        <ul>
          <li>
            You must be at least 13 years old, or the minimum age required in your country, to use
            Tethr.
          </li>
          <li>
            You sign in through a third-party identity provider (Google or GitHub). You are
            responsible for keeping that account secure and for all activity under your Tethr
            account.
          </li>
          <li>
            Treat the access codes and tokens Tethr issues to your AI assistants like passwords. Do
            not share them.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-content" title="3. Your content">
        <p>
          You keep all rights to the tasks, notes and other content you put into Tethr (&quot;Your
          Content&quot;). You give us a limited permission to store, process and display Your
          Content, and to send it to the services you connect, such as your Google Doc or the AI
          summary provider. We use this permission only to run the service for you.
        </p>
        <p>
          You are responsible for Your Content. Make sure you are allowed to record and sync it. For
          example, check that logging work details in a personal Google Doc does not break your
          employer&apos;s confidentiality rules.
        </p>
      </LegalSection>

      <LegalSection id="google" title="4. Google integration">
        <p>
          Connecting Google Docs is optional. When you connect it, you allow Tethr to create and
          edit the document you choose as your sync target, as described in our{" "}
          <Link href="/privacy#google-user-data">Privacy Policy</Link>. You can disconnect at any
          time from Settings or from your Google Account permissions. Your use of Google services is
          also subject to Google&apos;s own terms.
        </p>
      </LegalSection>

      <LegalSection id="ai" title="5. AI-generated content">
        <p>
          Summaries and appraisal summaries may be written by an AI model. AI output can be
          inaccurate or incomplete. Review it before you rely on it or share it, for example in a
          performance review. You are responsible for how you use it.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use Tethr for anything unlawful, or to store content you have no right to use.</li>
          <li>
            Try to access another user&apos;s data, or probe, scan or test the service for
            vulnerabilities without our permission.
          </li>
          <li>
            Disrupt or overload the service, for example by automating requests beyond normal use or
            getting around rate limits.
          </li>
          <li>Reverse engineer, resell or sublicense the service.</li>
          <li>Upload malware or harmful code.</li>
        </ul>
      </LegalSection>

      <LegalSection id="availability" title="7. Availability and changes">
        <p>
          We may change, suspend or discontinue all or part of Tethr at any time. If a change
          significantly affects you, we will try to tell you in advance. Some features, such as AI
          summaries, have usage limits.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="8. Termination">
        <p>
          You can stop using Tethr at any time and ask us to delete your account, as described in
          the <Link href="/privacy#retention">Privacy Policy</Link>. We may suspend or end your
          access if you break these Terms or if we must to protect the service or other users.
          Content already synced to your Google Doc stays in your Google account.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="9. Disclaimer of warranties">
        <p>
          Tethr is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of
          any kind, express or implied. This includes warranties of merchantability, fitness for a
          particular purpose and non-infringement. We do not promise that the service will be
          uninterrupted or error-free, or that synced or generated content will be accurate. Keep
          your own copies of anything important.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Limitation of liability">
        <p>
          To the fullest extent the law allows, Tethr and its operator are not liable for any
          indirect, incidental, special, consequential or punitive damages. This includes loss of
          data, profits or goodwill arising from your use of the service. Our total liability for
          any claim relating to the service is limited to the amount you paid us for it in the 12
          months before the claim, or USD 50, whichever is greater.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to these Terms">
        <p>
          We may update these Terms from time to time. When we do, we will change the &quot;Last
          updated&quot; date above. If you keep using Tethr after a change takes effect, you accept
          the updated Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact">
        <p>
          If you have questions about these Terms, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
