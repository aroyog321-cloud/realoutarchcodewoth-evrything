import React from 'react';
import { ArrowRight, Envelope, MapPin, Phone } from '@phosphor-icons/react';
import { Reveal } from '../components/ui.jsx';
import { useCatalog } from '../lib/catalog.js';
import { Link, useRouter } from '../lib/router.jsx';
import { SITE, operatorName } from '../lib/site.js';
import { LEGAL_UPDATED, POLICIES, fillPolicyText, policyByPath } from '../legal/outarchPolicies.js';

// The Legal & privacy section. The policy text is shared with the desktop app
// (src/legal/outarchPolicies.js, copied from the app by scripts/sync-legal.cjs),
// so the site and Settings > Legal & privacy always say the same thing. The
// business details come from src/lib/site.js.
//
// Refunds, delivery and contact are the pages the payment provider reviews;
// they predate the shared policies and stay as they were.

function useSupport() {
  const { supportEmail } = useCatalog();
  return SITE.supportEmail || supportEmail || '';
}

function ContactLine() {
  const email = useSupport();
  return email
    ? <a className="link-underline text-fg" href={`mailto:${email}`}>{email}</a>
    : <>us through the <Link className="link-underline text-fg" to="/contact">contact page</Link></>;
}

const H = ({ children, id }) => <h2 id={id} className="mt-12 scroll-mt-28 text-[21px] font-semibold tracking-[-0.01em] text-fg">{children}</h2>;
const P = ({ children }) => <p className="mt-4 text-[15.5px] leading-[1.75] text-fg-muted">{children}</p>;
const UL = ({ items }) => <ul className="mt-4 space-y-2.5">{items.map((item, index) => <li key={index} className="flex gap-3 text-[15.5px] leading-[1.7] text-fg-muted"><span className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-brand-sky"/><span>{item}</span></li>)}</ul>;

const slug = text => String(text).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Fills the operator and jurisdiction, and turns {contact} into a real link.
function Rich({ text }) {
  const filled = fillPolicyText(text, { operator: operatorName(), jurisdiction: SITE.jurisdiction });
  const parts = filled.split('{contact}');
  return parts.map((part, index) => <React.Fragment key={index}>{part}{index < parts.length - 1 ? <ContactLine/> : null}</React.Fragment>);
}

function PolicyBody({ policy }) {
  return <>
    {policy.sections.length > 4 ? <nav aria-label="On this page" className="mt-8 rounded-card p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
      <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-fg-dim">On this page</p>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {policy.sections.map(section => <li key={section.heading}><Link to={`${policy.path}#${slug(section.heading)}`} className="link-underline text-[14px] text-fg-muted hover:text-fg">{section.heading}</Link></li>)}
      </ul>
    </nav> : null}
    {policy.sections.map(section => <section key={section.heading}>
      <H id={slug(section.heading)}>{section.heading}</H>
      {section.blocks.map((block, index) => Array.isArray(block)
        ? <UL key={index} items={block.map((item, at) => <Rich key={at} text={item}/>)}/>
        : <P key={index}><Rich text={block}/></P>)}
    </section>)}
  </>;
}

const COMMERCIAL_POLICIES = [
  {
    id: 'refunds',
    path: '/refunds',
    title: 'Refunds and cancellation',
    summary: 'How refunds, cancellations, billing disputes, and non-recurring purchases are handled via Dodo Payments.',
  },
  {
    id: 'delivery',
    path: '/delivery',
    title: 'Delivery',
    summary: 'Instant digital delivery, desktop app download, software licensing, and immediate plan activation.',
  },
  {
    id: 'upgrades',
    path: '/upgrades',
    title: 'Plan upgrade & credit conversion',
    summary: 'How unused Pro subscription time is prorated, calculated, and converted into Ultimate credit days.',
  },
  {
    id: 'contact',
    path: '/contact',
    title: 'Contact',
    summary: 'Official support channels for billing assistance, account inquiries, security reports, and privacy requests.',
  },
];

const ALL_HUB_POLICIES = [...POLICIES, ...COMMERCIAL_POLICIES];

// /legal: every policy, one card each.
function LegalHub() {
  return <>
    <P>How OUTARCH works with your code, your data, and your purchases, in plain words. The core documents are also available in the desktop app under Settings &gt; Legal &amp; privacy.</P>

    <div className="mt-8 space-y-10">
      <div>
        <h2 className="text-[18px] font-semibold text-fg">Terms, Licenses &amp; Privacy</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {POLICIES.slice(0, 6).map(policy => <Link key={policy.id} to={policy.path} className="card group flex flex-col gap-2 p-5 transition-colors hover:bg-white/[0.03]">
            <span className="flex items-center justify-between gap-3 text-[16px] font-medium text-fg">{policy.title}<ArrowRight size={16} className="shrink-0 text-fg-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg"/></span>
            <span className="text-[14px] leading-relaxed text-fg-muted"><Rich text={policy.summary}/></span>
          </Link>)}
        </div>
      </div>

      <div>
        <h2 className="text-[18px] font-semibold text-fg">AI, Data &amp; Security</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {POLICIES.slice(6).map(policy => <Link key={policy.id} to={policy.path} className="card group flex flex-col gap-2 p-5 transition-colors hover:bg-white/[0.03]">
            <span className="flex items-center justify-between gap-3 text-[16px] font-medium text-fg">{policy.title}<ArrowRight size={16} className="shrink-0 text-fg-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg"/></span>
            <span className="text-[14px] leading-relaxed text-fg-muted"><Rich text={policy.summary}/></span>
          </Link>)}
        </div>
      </div>

      <div>
        <h2 className="text-[18px] font-semibold text-fg">Billing, Purchases &amp; Fulfillment</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {COMMERCIAL_POLICIES.map(policy => <Link key={policy.id} to={policy.path} className="card group flex flex-col gap-2 p-5 transition-colors hover:bg-white/[0.03]">
            <span className="flex items-center justify-between gap-3 text-[16px] font-medium text-fg">{policy.title}<ArrowRight size={16} className="shrink-0 text-fg-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg"/></span>
            <span className="text-[14px] leading-relaxed text-fg-muted"><Rich text={policy.summary}/></span>
          </Link>)}
        </div>
      </div>
    </div>

    <H>Questions</H>
    <P>For anything about these documents, or to use your privacy rights, contact <ContactLine/>.</P>
  </>;
}

function Refunds() {
  return <>
    <P>This Refund &amp; Cancellation Policy explains how refunds, cancellations, and payments are handled for OUTARCH products and services.</P>
    <P>By purchasing or using a paid OUTARCH product or service, you acknowledge and agree to this policy together with the <Link className="link-underline text-fg" to="/terms">OUTARCH Terms of Service</Link> and <Link className="link-underline text-fg" to="/privacy">Privacy Policy</Link>.</P>

    <H>1. General Refund Policy</H>
    <P>OUTARCH purchases are <strong>generally non-refundable</strong>.</P>
    <P>OUTARCH provides digitally delivered software and access. Once a purchase has been successfully completed and the applicable product, plan, or access period has been made available, payments are generally considered final.</P>
    <P>OUTARCH does not offer a voluntary 7-day, 14-day, 30-day, or other money-back guarantee. We do not generally provide refunds for:</P>
    <UL items={[
      'Change of mind after purchase',
      'Failure to use the product or service',
      'Unused access or unused paid-plan time',
      'Partial use of a purchased plan',
      'Personal preference regarding the product',
      'Failure to use particular features included in the purchased plan',
      'Purchasing a plan and subsequently deciding that a different plan would have been preferable',
      'Downgrading or changing plans after purchase',
      'Temporary service interruptions or scheduled maintenance',
      "Issues caused by the customer's device, operating system, network, third-party software, or other circumstances outside OUTARCH's reasonable control",
    ]}/>
    <P>However, nothing in this policy excludes or limits any statutory consumer rights, remedies, guarantees, or protections that cannot legally be excluded or limited under applicable law.</P>

    <H>2. Prepaid Fixed-Term Access (No Automatic Renewals)</H>
    <P>Website paid plans (Pro and Ultimate) are sold as prepaid fixed-term access for periods of <strong>1 month or 12 months</strong>.</P>
    <P>OUTARCH does <strong>not</strong> currently use automatic subscription renewal or automatic recurring billing for purchases made through the OUTARCH website. A customer is not automatically charged again simply because they previously purchased an OUTARCH plan.</P>
    <P>If OUTARCH introduces automatic renewals, recurring billing, or another automatic payment mechanism in the future, the applicable checkout, account, billing, and plan terms will clearly disclose that functionality before it applies to the customer, and appropriate cancellation tools will be provided.</P>

    <H>3. Cancellation of a Purchase or Plan</H>
    <P>Because OUTARCH currently does not automatically renew website purchases, there is generally no recurring subscription payment that a customer needs to cancel.</P>
    <P>If a customer wishes to stop using OUTARCH, they may discontinue use of the applicable product or service. Discontinuing use does not automatically create a right to a refund for a purchase that has already been completed, subject to applicable law.</P>
    <P>If OUTARCH introduces recurring billing in the future, cancellation of future recurring charges will be handled through the applicable OUTARCH account, billing portal, checkout system, or payment provider.</P>

    <H>4. Statutory Rights &amp; Legal Remedies</H>
    <P>Nothing in this policy is intended to exclude, restrict, or waive any consumer rights, remedies, guarantees, or protections that cannot legally be excluded or waived under applicable law.</P>
    <P>Where applicable law requires OUTARCH to provide a refund, replacement, correction, or another remedy, OUTARCH will comply with the applicable legal requirements.</P>
    <P>This may include circumstances involving a legally recognized defect, deficiency, material failure to provide the service as represented, or another circumstance for which a remedy is legally required.</P>

    <H>5. Technical Problems and Service Issues</H>
    <P>If you experience a significant technical problem that prevents you from reasonably accessing or using OUTARCH, please contact OUTARCH support at <a className="link-underline text-fg" href="mailto:outarch54@gmail.com">outarch54@gmail.com</a>.</P>
    <P>OUTARCH will investigate the issue and attempt to resolve the technical problem. Where appropriate or legally required, remedies may include technical assistance, restoration of access, replacement, credit, refund, or another remedy in accordance with applicable law.</P>
    <P>A temporary outage, scheduled maintenance, third-party service interruption, isolated technical issue, or problem caused by the customer's environment does not automatically create an entitlement to a refund, without limiting mandatory legal protections.</P>

    <H>6. Promotional Offers and Discounts</H>
    <P>Promotional prices, discounts, credits, trials, or other special offers may have additional terms displayed at the time of purchase. Unless expressly stated otherwise, a promotional offer does not create a separate right to a refund. Any specific terms displayed with a promotional offer will apply to that offer to the extent permitted by applicable law.</P>

    <H>7. Microsoft Store Purchases</H>
    <P>If OUTARCH is purchased through the Microsoft Store, the transaction is separate and subject to Microsoft's applicable Store terms, refund procedures, and applicable law.</P>
    <P>For purchases processed directly by Microsoft, refund eligibility and the applicable refund process are determined by Microsoft under its policies and applicable law. Customers who purchased OUTARCH through the Microsoft Store should use the applicable Microsoft Store support or refund process.</P>

    <H>8. Merchant of Record &amp; Dodo Payments</H>
    <P>OUTARCH uses <strong>Dodo Payments</strong>, which acts as OUTARCH's Merchant of Record and payment provider for applicable website transactions.</P>
    <P>Dodo Payments operates global payment infrastructure for digital products and securely processes transactions, checkout flows, fraud and risk management, tax compliance (such as GST/VAT), invoices, chargebacks, and Merchant of Record obligations depending on the applicable transaction. The use of a Merchant of Record does not remove or limit any consumer rights that apply to the transaction under applicable law.</P>

    <H>9. Refund Requests &amp; Investigation</H>
    <P>If you believe that you are legally entitled to a refund, or believe that a payment was processed incorrectly, contact OUTARCH support as soon as reasonably possible at <a className="link-underline text-fg" href="mailto:outarch54@gmail.com">outarch54@gmail.com</a>.</P>
    <P>Please provide, where available:</P>
    <UL items={[
      'The email address associated with your OUTARCH account',
      'Order or transaction reference ID (from your account billing history)',
      'Date of purchase',
      'Plan purchased (Pro or Ultimate, 1-month or 12-month)',
      'Description of the issue',
      'Relevant payment and billing details',
    ]}/>
    <P>OUTARCH may request additional details reasonably necessary to investigate the request. Submitting a refund request does not automatically guarantee that a refund will be issued.</P>

    <H>10. Approved Refunds &amp; Settlement Timing</H>
    <P>Where OUTARCH approves a refund, or where a refund is required by applicable law, the refund will generally be processed through the original payment method through Dodo Payments or the applicable payment provider's refund mechanism.</P>
    <P>The time required for the refunded amount to appear in a customer's account may vary depending on the payment provider, bank, card network, or financial institution. OUTARCH does not control the processing time of a customer's bank or card issuer.</P>

    <H>11. Chargebacks and Payment Disputes</H>
    <P>Customers are encouraged to contact OUTARCH support at <a className="link-underline text-fg" href="mailto:outarch54@gmail.com">outarch54@gmail.com</a> before initiating a payment dispute or chargeback so that the issue can be reviewed and, where appropriate, resolved.</P>
    <P>Nothing in this section limits or restricts any statutory rights a customer may have under applicable law or applicable payment-network rules.</P>

    <H>12. Living Documents &amp; Policy Updates</H>
    <P>These policies are living documents and may be updated, expanded, or revised as OUTARCH's products, features, services, payment methods, integrations, legal requirements, and business practices evolve. The version applicable to a particular transaction, service, or activity will generally be the version in effect at the relevant time, subject to applicable law.</P>
    <P>OUTARCH may introduce new features, services, payment options, subscription models, automatic renewals, recurring billing, cancellation mechanisms, or other functionality in the future. If such changes affect a customer's rights, obligations, billing, privacy, data handling, or use of OUTARCH, the relevant policy, terms, checkout flow, or applicable disclosure will be updated accordingly before or when the change becomes applicable, as required by law.</P>

    <H>13. Contact &amp; Support</H>
    <P>For questions regarding payments, plans, cancellations, billing, or refund requests, please contact OUTARCH at <a className="link-underline text-fg" href="mailto:outarch54@gmail.com">outarch54@gmail.com</a> or through the <Link className="link-underline text-fg" to="/contact">contact page</Link> on the official OUTARCH website.</P>
    <P className="mt-8 text-[14px] text-fg-dim">This policy should be read together with the <Link className="link-underline text-fg" to="/terms">OUTARCH Terms of Service</Link> and <Link className="link-underline text-fg" to="/privacy">Privacy Policy</Link>.</P>
  </>;
}

function Delivery() {
  return <>
    <P>OUTARCH is software and a digital service. Nothing is shipped physically.</P>
    <H>How you receive it</H>
    <UL items={[
      'The desktop app is downloaded from this website and is free to install.',
      'A paid plan is delivered to your OUTARCH account the moment Dodo Payments confirms your payment, usually within a few seconds.',
      'The desktop app reads your plan when it starts, when its window gets focus, and every five minutes. Pressing Open OUTARCH after paying makes it check straight away.',
    ]}/>
    <H>If your plan does not appear</H>
    <P>Open your account page to see the plan and the payment. If the payment shows as paid but the plan has not changed within 24 hours, write to <ContactLine/> with your order reference and we will switch it on or refund you.</P>
  </>;
}

function Contact() {
  const email = useSupport();
  const rows = [
    email ? [Envelope, 'Email', <a key="e" className="link-underline text-fg" href={`mailto:${email}`}>{email}</a>] : null,
    SITE.supportPhone ? [Phone, 'Phone', <a key="p" className="link-underline text-fg" href={`tel:${SITE.supportPhone.replace(/\s/g, '')}`}>{SITE.supportPhone}</a>] : null,
    SITE.address ? [MapPin, 'Address', <span key="a" className="text-fg">{operatorName()}, {SITE.address}</span>] : null,
  ].filter(Boolean);
  return <>
    <P>Questions about the app, your account, your data, a payment or a security issue: we answer within 2 working days.</P>
    <div className="mt-8 grid gap-4">
      {rows.length ? rows.map(([Icon, label, value]) => <div key={label} className="card flex items-center gap-4 p-5">
        <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-brand-blue/15 text-brand-sky"><Icon size={20} weight="duotone"/></span>
        <div><p className="text-[13px] text-fg-dim">{label}</p><p className="text-[16px]">{value}</p></div>
      </div>) : <div className="card p-5 text-[15px] text-fg-muted">Contact details are being added. Please check back shortly.</div>}
    </div>
    <P>For payment questions, include the email of your account and the order reference from your account's billing history. To report a security vulnerability, put "Security" in the subject and see the <Link className="link-underline text-fg" to="/security">security policy</Link>. To delete your account or ask about your data, write from the email address on your account.</P>
  </>;
}

const OTHER_PAGES = {
  '/legal': ['Legal & privacy', LegalHub],
  '/refunds': ['Refunds and cancellation', Refunds],
  '/delivery': ['Delivery', Delivery],
  '/contact': ['Contact', Contact],
};

export default function LegalPage() {
  const { path } = useRouter();
  const policy = policyByPath(path);
  const [title, Body] = policy ? [policy.title, null] : OTHER_PAGES[path] || OTHER_PAGES['/legal'];
  const dated = path !== '/contact' && path !== '/legal';
  return <article className="mx-auto max-w-[760px] px-5 pb-24 pt-36 md:px-8">
    <Reveal>
      {path !== '/legal' ? <Link to="/legal" className="text-[13.5px] text-fg-dim hover:text-fg">Legal & privacy</Link> : null}
      <h1 className="display mt-2 text-[clamp(2.2rem,5vw,3.6rem)]">{title}</h1>
    </Reveal>
    {dated ? <p className="mt-4 text-[14px] text-fg-dim">Last updated {policy ? LEGAL_UPDATED : SITE.policiesUpdated}</p> : null}
    {/* The body is not wrapped in Reveal: a policy is taller than the screen, and
        an in-view threshold on something that tall would never be reached. */}
    <div className="mt-6">{policy ? <PolicyBody policy={policy}/> : <Body/>}</div>
    <nav className="mt-16 flex flex-wrap gap-2 border-t border-line-soft pt-8" aria-label="Policies">
      {[['/legal', 'All policies'], ...ALL_HUB_POLICIES.map(item => [item.path, item.title])].map(([to, label]) => <Link key={to} to={to} aria-current={to === path ? 'page' : undefined} className={`chip ${to === path ? 'text-fg shadow-[inset_0_0_0_1px_rgba(106,166,255,0.6)]' : 'hover:text-fg'}`}>{label}</Link>)}
    </nav>
  </article>;
}
