import type { Metadata } from "next"
import Link from "next/link"

import { LegalPage, LegalSection } from "@/components/legal/legal-page"
import { CONTACT_EMAIL, OPERATOR_NAME, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  title: "Privacy Policy | Tethr",
  description:
    "How Tethr collects, uses, stores and deletes your data, including Google user data.",
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what information Tethr (&quot;Tethr&quot;, &quot;we&quot;,
          &quot;us&quot;), available at <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>{" "}
          and operated by {OPERATOR_NAME}, collects when you use the service, how that information
          is used and shared, and the choices you have. By using Tethr you agree to this policy.
        </p>
      }
    >
      <LegalSection id="what-tethr-does" title="1. What Tethr does">
        <p>
          Tethr is a work log for software engineers. You record tasks and contributions, along with
          their outcomes and evidence such as pull requests or commits. You can do this from the web
          dashboard or from an AI coding assistant through the Model Context Protocol (MCP). If you
          choose to, Tethr writes these entries into a Google Doc that you own, as daily tables,
          weekly summaries and monthly appraisal summaries.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="2. Information we collect">
        <p>
          <strong>Account information.</strong> We use Clerk to sign you in, through Google or
          GitHub. Clerk gives us your account identifier, name, email address and profile picture.
          Tethr never receives or stores your password.
        </p>
        <p>
          <strong>Content you create.</strong> This means the tasks and contribution entries you add
          yourself or through an MCP-connected AI assistant: titles, descriptions, project and area
          names, type, priority, status, dates, outcomes, evidence links and notes.
        </p>
        <p>
          <strong>Google integration data.</strong> If you connect Google Docs, we store the OAuth
          access and refresh tokens Google issues to Tethr, the ID and title of the document you
          picked or created for syncing, and your sync settings (cadence and sync history).
        </p>
        <p>
          <strong>MCP connection data.</strong> If you connect an AI coding assistant, we store the
          access tokens issued to that client so that it can act on your behalf.
        </p>
        <p>
          <strong>Technical data.</strong> Our servers keep standard logs (such as IP address,
          request time and errors) to run and secure the service. We do not use advertising or
          third-party analytics trackers.
        </p>
      </LegalSection>

      <LegalSection id="google-user-data" title="3. How Tethr uses Google user data">
        <p>
          You decide whether to connect Google Docs. If you do, Tethr asks for these Google OAuth
          scopes:
        </p>
        <ul>
          <li>
            <strong>Google Docs</strong> (<code>https://www.googleapis.com/auth/documents</code>):
            used to create your Tethr ledger document and to insert and update the tables and
            summaries Tethr generates in the document you chose.
          </li>
          <li>
            <strong>Google Drive, per-file access</strong> (
            <code>https://www.googleapis.com/auth/drive.file</code>): used only for files that Tethr
            creates or that you open with Tethr, so the app can create and find your ledger
            document. Tethr cannot see the other files in your Drive.
          </li>
        </ul>
        <p>
          Tethr only accesses the single document you choose as your sync target. It only writes
          Tethr-generated content (your logged tasks and their summaries) into that document. It
          does not read, index or analyze the other content of your Google Docs or Drive.
        </p>
        <p>
          <strong>Limited Use disclosure.</strong> Tethr&apos;s use and transfer to any other app of
          information received from Google APIs will adhere to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically:
        </p>
        <ul>
          <li>
            We use Google user data only to provide and improve the user-facing features described
            above.
          </li>
          <li>
            We do not sell Google user data. We do not use it for advertising, retargeting or
            interest-based ads.
          </li>
          <li>
            We do not use Google user data to develop, improve or train generalized AI or machine
            learning models.
          </li>
          <li>
            No human reads your Google user data unless you give explicit consent (for example, to
            help with a support request), it is needed for security purposes such as investigating
            abuse, or the law requires it.
          </li>
          <li>
            We do not transfer Google user data to third parties, except as needed to provide the
            service, to comply with the law, or as part of a merger or acquisition with notice to
            you.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" title="4. How we use your information">
        <ul>
          <li>To sign you in and keep your workspace separate from other users.</li>
          <li>To store, display, search and sync your tasks.</li>
          <li>
            To write daily tables, weekly summaries and monthly appraisal summaries to your chosen
            Google Doc on the schedule you configure.
          </li>
          <li>To let MCP-connected AI assistants that you authorize read and update your tasks.</li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ai-summaries" title="5. AI-generated summaries">
        <p>
          When you ask for an AI summary, or when a scheduled weekly or monthly summary runs, Tethr
          sends the relevant task entries (titles, descriptions, outcomes, evidence and similar
          fields you logged) to the Google Gemini API to generate the summary text. If you provide
          your own Gemini API key, that request is made with your key. Tethr does not send the
          content of your Google Docs or Drive files to any AI model. If AI generation is
          unavailable, Tethr uses a built-in template instead.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="6. Service providers we share data with">
        <p>
          We do not sell your personal information. We share data only with the providers that run
          Tethr, and only as much as they need to provide their service:
        </p>
        <ul>
          <li>
            <strong>Clerk</strong>: authentication and account management.
          </li>
          <li>
            <strong>Google</strong>: Google Docs and Drive APIs (for the sync you enable) and the
            Gemini API (for AI summaries).
          </li>
          <li>
            <strong>MongoDB Atlas</strong>: database hosting for your tasks and settings.
          </li>
          <li>
            <strong>Oracle Cloud Infrastructure</strong>: application server hosting.
          </li>
        </ul>
        <p>
          We may also disclose information if the law requires it, or if we must to protect the
          rights, property or safety of Tethr, our users or others.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Storage and security">
        <p>
          All traffic to Tethr is encrypted in transit with HTTPS. Google OAuth refresh tokens are
          encrypted at rest with AES-256-GCM before they are stored. Each request is authenticated
          with a signed token, and your data is only reachable from your own account. No method of
          transmission or storage is completely secure, but we work to protect your information and
          limit who can access it.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="8. Retention and deletion">
        <ul>
          <li>
            <strong>Tasks</strong> are kept until you delete them. You can delete any task from the
            dashboard at any time.
          </li>
          <li>
            <strong>Google access</strong>: when you disconnect Google Docs on the Settings page,
            Tethr deletes your stored Google tokens. You can also revoke Tethr&apos;s access at any
            time from your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>{" "}
            page. Content already written to your Google Doc belongs to you and stays there unless
            you remove it.
          </li>
          <li>
            <strong>MCP access</strong>: access tokens issued to AI assistants expire. You can ask
            us to revoke them sooner by contacting us.
          </li>
          <li>
            <strong>Account deletion</strong>: to delete your account and all associated data, email
            us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the email address on
            your account. We will delete your data within 30 days, except where the law requires us
            to keep it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-rights" title="9. Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, export or delete
          your personal information, or to object to or restrict how we process it. To use any of
          these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </LegalSection>

      <LegalSection id="children" title="10. Children">
        <p>
          Tethr is a professional tool and is not directed at children under 13, or under the
          minimum age required in your country. We do not knowingly collect information from
          children.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to this policy">
        <p>
          We may update this policy from time to time. When we do, we will change the &quot;Last
          updated&quot; date above. If the changes are significant, we will also tell you through
          the app or by email before they take effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact">
        <p>
          If you have questions about this policy or your data, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
