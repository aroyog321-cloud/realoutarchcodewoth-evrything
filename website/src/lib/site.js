// Who runs OUTARCH, for the legal and contact pages. Dodo Payments checks these
// pages before it approves a merchant, so fill every field before applying:
// the name and address must match the business details given to Dodo Payments.
// Empty fields are left out of the pages rather than shown blank.
export const SITE = {
  product: 'OUTARCH',
  // The registered business or proprietor name, exactly as given to Dodo Payments.
  legalName: '',
  // A postal address customers can write to.
  address: '',
  // Shown on the contact page. When empty, the support email saved in
  // Supabase (app_config.support_email) is used instead.
  supportEmail: 'outarch54@gmail.com',
  supportPhone: '',
  // The courts and law that apply to the terms.
  jurisdiction: 'India',
  // The date the policies below were last changed.
  policiesUpdated: '1 October 2026',
};

export function operatorName() {
  return SITE.legalName || SITE.product;
}
