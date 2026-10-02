import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CalendarCheck, Check, Clock, Crown, CurrencyInr, Info, ShieldCheck, Sparkle,
} from '@phosphor-icons/react';
import { Link } from '../lib/router.jsx';
import { Button, Reveal } from '../components/ui.jsx';

export default function UpgradePolicyPage() {
  return (
    <div className="mx-auto max-w-[920px] px-5 pb-28 pt-36 md:px-8">
      <Reveal>
        <Link to="/checkout" className="inline-flex items-center gap-1.5 text-[14px] text-fg-muted hover:text-fg">
          <ArrowLeft size={15} /> Back to checkout
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-violet/15 text-brand-violet shadow-[inset_0_0_0_1px_rgba(155,123,255,0.4)]">
            <Crown size={24} weight="fill" />
          </span>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-brand-violet">Plan Transparency</p>
            <h1 className="display text-[clamp(2.2rem,4.5vw,3.2rem)]">Plan Upgrade & Credit Conversion</h1>
          </div>
        </div>
        <p className="lede mt-4 text-[16.5px] leading-relaxed text-fg-muted">
          When you upgrade from <strong>Pro</strong> to <strong>Ultimate</strong>, every single day and rupee of your remaining Pro plan is protected and converted into pro-rated Ultimate days. No money is lost, and no time is wasted.
        </p>
      </Reveal>

      {/* Overview Banner */}
      <Reveal delay={0.06} className="mt-8">
        <div className="card relative overflow-hidden p-7 sm:p-9" style={{ background: 'linear-gradient(135deg, rgba(155,123,255,0.15), rgba(47,123,255,0.08) 50%, rgba(255,255,255,0.02))' }}>
          <h2 className="flex items-center gap-2 text-[20px] font-semibold text-fg">
            <ShieldCheck size={22} className="text-brand-mint" />
            The 100% Value Guarantee
          </h2>
          <p className="mt-3 text-[14.5px] leading-relaxed text-fg-soft">
            Because Ultimate includes all Pro features plus unlimited everything, you do not need two separate paid plans. Instead, your unused Pro balance is calculated to the second and converted into its exact equivalent in Ultimate days, which are added directly on top of your new purchase.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <p className="text-[13px] text-fg-dim">1. Value Assessment</p>
              <p className="mt-1 text-[15px] font-medium text-fg">Remaining Pro Days</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">Valued at ₹23.33/day (or ₹19.18 annual)</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <p className="text-[13px] text-fg-dim">2. Conversion Ratio</p>
              <p className="mt-1 text-[15px] font-medium text-brand-mint">70% Value Credit</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">₹700 Pro ÷ ₹1,000 Ultimate = 0.70</p>
            </div>
            <div className="rounded-xl bg-black/30 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <p className="text-[13px] text-fg-dim">3. Total Extension</p>
              <p className="mt-1 text-[15px] font-medium text-brand-violet">New Time + Bonus Credit</p>
              <p className="mt-0.5 text-[12.5px] text-fg-muted">Merged into one extended expiration date</p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Pricing and Daily Rates */}
      <Reveal delay={0.1} className="mt-10">
        <h2 className="text-[22px] font-semibold text-fg">Daily Rate Breakdown</h2>
        <p className="mt-1 text-[14.5px] text-fg-muted">Our rates are fixed and transparent across all billing periods:</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-line-soft text-[12.5px] text-fg-dim">
                <th className="pb-3 font-medium">Plan Tier</th>
                <th className="pb-3 font-medium">Billing Period</th>
                <th className="pb-3 font-medium">Price (INR, + taxes)</th>
                <th className="pb-3 font-medium">Price (USD, + taxes)</th>
                <th className="pb-3 font-medium">Daily Rate (Base)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              <tr>
                <td className="py-3 font-medium text-fg">Pro Monthly</td>
                <td className="py-3 text-fg-muted">30 Days</td>
                <td className="py-3 font-mono text-fg">₹700 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-fg">$7.30 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-brand-mint">₹23.33 / day</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-fg">Pro Annual</td>
                <td className="py-3 text-fg-muted">365 Days (2 mo. free)</td>
                <td className="py-3 font-mono text-fg">₹7,000 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-fg">$73.00 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-brand-mint">₹19.18 / day</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-fg">Ultimate Monthly</td>
                <td className="py-3 text-fg-muted">30 Days</td>
                <td className="py-3 font-mono text-fg">₹1,000 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-fg">$10.42 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-brand-violet">₹33.33 / day</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-fg">Ultimate Annual</td>
                <td className="py-3 text-fg-muted">365 Days (2 mo. free)</td>
                <td className="py-3 font-mono text-fg">₹10,000 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-fg">$104.20 <span className="text-[12px] text-fg-dim">+ taxes</span></td>
                <td className="py-3 font-mono text-brand-violet">₹27.40 / day</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* Real-World Scenarios */}
      <Reveal delay={0.14} className="mt-12">
        <h2 className="text-[22px] font-semibold text-fg">Upgrade Examples & Scenarios</h2>
        <div className="mt-5 flex flex-col gap-5">
          
          {/* Scenario 1 */}
          <div className="card p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-sky/15 px-2.5 py-0.5 text-[12px] font-semibold text-brand-sky">Example 1</span>
              <h3 className="text-[17px] font-semibold text-fg">Monthly Pro → Monthly Ultimate Upgrade</h3>
            </div>
            <p className="mt-2 text-[14px] text-fg-muted">
              You purchased 1 month of Pro (30 days / ₹700). On the same day, you decide to upgrade to Ultimate (₹1,000).
            </p>
            <div className="mt-4 rounded-field bg-white/[0.02] p-4 text-[13.5px] leading-relaxed text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <p>• <strong>Unused Pro Credit:</strong> 30 days × 70% = <strong>21 days of Ultimate</strong></p>
              <p className="mt-1">• <strong>New Ultimate Purchase:</strong> 30 days</p>
              <p className="mt-1 font-semibold text-brand-mint">• <strong>Total Ultimate Duration:</strong> 30 + 21 = <strong>51 Days of Ultimate</strong></p>
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="card p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-violet/15 px-2.5 py-0.5 text-[12px] font-semibold text-brand-violet">Example 2</span>
              <h3 className="text-[17px] font-semibold text-fg">Annual Pro → Annual Ultimate Upgrade (Mid-Year)</h3>
            </div>
            <p className="mt-2 text-[14px] text-fg-muted">
              You bought 1 Year of Pro (₹7,000) and have 300 days left when you upgrade to 1 Year of Ultimate (₹10,000).
            </p>
            <div className="mt-4 rounded-field bg-white/[0.02] p-4 text-[13.5px] leading-relaxed text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <p>• <strong>Unused Pro Value:</strong> 300 days × ₹19.18/day = ₹5,753.42</p>
              <p className="mt-1">• <strong>Converted Ultimate Days:</strong> ₹5,753.42 ÷ ₹27.40/day = <strong>210 days of Ultimate</strong></p>
              <p className="mt-1">• <strong>New Annual Purchase:</strong> 365 days</p>
              <p className="mt-1 font-semibold text-brand-mint">• <strong>Total Ultimate Duration:</strong> 365 + 210 = <strong>575 Days (~19 Months)</strong></p>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="card p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-mint/15 px-2.5 py-0.5 text-[12px] font-semibold text-brand-mint">Example 3</span>
              <h3 className="text-[17px] font-semibold text-fg">Same-Day Annual Pro + Annual Ultimate Purchase</h3>
            </div>
            <p className="mt-2 text-[14px] text-fg-muted">
              You bought Annual Pro (₹7,000) and immediately purchased Annual Ultimate (₹10,000) on the same date.
            </p>
            <div className="mt-4 rounded-field bg-white/[0.02] p-4 text-[13.5px] leading-relaxed text-fg-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <p>• <strong>Converted Pro Credit:</strong> 365 days × 70% = <strong>255.5 days of Ultimate</strong></p>
              <p className="mt-1">• <strong>New Annual Purchase:</strong> 365 days</p>
              <p className="mt-1 font-semibold text-brand-mint">• <strong>Total Ultimate Duration:</strong> 365 + 255.5 = <strong>620.5 Days (~1 Year, 8.5 Months)</strong></p>
              <p className="mt-1 text-fg-dim">Total money paid: ₹17,000 = exactly 620.5 days at ₹27.40/day.</p>
            </div>
          </div>

        </div>
      </Reveal>

      {/* Frequently Asked Questions */}
      <Reveal delay={0.18} className="mt-12">
        <h2 className="text-[22px] font-semibold text-fg">Frequently Asked Questions</h2>
        <div className="mt-5 space-y-4">
          <div className="card p-6">
            <h4 className="font-medium text-fg">Why is time added instead of just changing the plan?</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">
              Because you are paying the standard full price for the new Ultimate tier, your previous payment is not forfeited. Converting the previous payment into pro-rated Ultimate time ensures you receive every single minute of service you paid for.
            </p>
          </div>

          <div className="card p-6">
            <h4 className="font-medium text-fg">Can I downgrade from Ultimate to Pro?</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">
              To prevent accidental losses and redundant charges, the checkout system locks downgrades while an Ultimate plan is active. You can switch to Pro any time after your active Ultimate duration concludes.
            </p>
          </div>

          <div className="card p-6">
            <h4 className="font-medium text-fg">How is my agreement recorded?</h4>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">
              Before completing checkout for an upgrade, you must check the agreement box confirming the calculated duration. This acceptance timestamp and day calculation are permanently recorded in your account receipt on our secure database.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.2} className="mt-12 text-center">
        <Button to="/checkout" variant="primary" size="lg">Return to Checkout</Button>
      </Reveal>
    </div>
  );
}
