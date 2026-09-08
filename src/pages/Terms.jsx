import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="privacy-page">
      <div className="privacy-content">
        <Link to="/" className="privacy-back">← Back</Link>
        <h1>Terms of Service</h1>
        <p className="privacy-date">Last updated: September 2026</p>

        <h2>1. Acceptance</h2>
        <p>By creating an account or using Tally ("the Service"), you agree to these Terms. If you do not agree, do not use the Service.</p>

        <h2>2. The Service</h2>
        <p>Tally is a time tracking and invoicing tool available on iOS, iPadOS, macOS, Android, and the web. Features vary by plan.</p>

        <h2>3. Accounts</h2>
        <p>You are responsible for maintaining the security of your account credentials. You must be 13 years of age or older to use the Service. You may not share your account or create accounts on behalf of others without their consent.</p>

        <h2>4. Plans and Payment</h2>
        <ul>
          <li><strong>Free</strong> — no payment required, subject to plan limits.</li>
          <li><strong>Pro</strong> — a one-time payment processed via Stripe. Non-refundable after 14 days.</li>
          <li><strong>Business</strong> — a recurring monthly subscription per user, processed via Stripe or Apple's StoreKit. You may cancel at any time; cancellation takes effect at the end of the current billing period.</li>
        </ul>
        <p>Prices are in USD and may change with 30 days' notice. You are responsible for any applicable taxes.</p>

        <h2>5. Free Plan Limits</h2>
        <p>The Free plan is limited to 5 clients and 7 days of session history. We reserve the right to adjust these limits with reasonable notice.</p>

        <h2>6. Acceptable Use</h2>
        <p>You may not use Tally to violate any law, infringe on the rights of others, or interfere with the Service's operation. We reserve the right to suspend or terminate accounts that violate these terms.</p>

        <h2>7. Data and Privacy</h2>
        <p>Your use of the Service is also governed by our <Link to="/privacy">Privacy Policy</Link>. You own your data. We do not sell it or use it for advertising.</p>

        <h2>8. Intellectual Property</h2>
        <p>The Tally name, logo, and software are owned by the developer. You may not copy, modify, or distribute the Service without permission.</p>

        <h2>9. Disclaimer</h2>
        <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted availability or error-free operation.</p>

        <h2>10. Limitation of Liability</h2>
        <p>To the fullest extent permitted by law, our liability for any claim arising from your use of the Service is limited to the amount you paid us in the 12 months preceding the claim.</p>

        <h2>11. Termination</h2>
        <p>You may stop using the Service and delete your account at any time from <strong>Settings</strong> inside the app. We may terminate access for violations of these Terms.</p>

        <h2>12. Changes</h2>
        <p>We may update these Terms. Continued use after notice of changes constitutes acceptance. Material changes will be communicated via email or in-app notice.</p>

        <h2>13. Contact</h2>
        <p>Questions? Email us at <a href="mailto:help@tallytimetracker.com">help@tallytimetracker.com</a>.</p>
      </div>
    </div>
  )
}
