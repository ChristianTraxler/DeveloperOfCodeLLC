// Categories follow the usual Schedule C lines for a single-member LLC.
// They are a starting point: confirm the final mapping with your tax preparer.
export const CATEGORIES = [
  { key: 'software', label: 'Software and subscriptions', short: 'Software', line: '27a', lineLabel: 'Other expenses' },
  { key: 'hosting', label: 'Hosting and domains', short: 'Hosting', line: '27a', lineLabel: 'Other expenses' },
  { key: 'equipment', label: 'Equipment', short: 'Equipment', line: '13', lineLabel: 'Depreciation and section 179' },
  { key: 'supplies', label: 'Supplies', short: 'Supplies', line: '22', lineLabel: 'Supplies' },
  { key: 'contractors', label: 'Contractors', short: 'Contractors', line: '11', lineLabel: 'Contract labor' },
  { key: 'advertising', label: 'Advertising and marketing', short: 'Advertising', line: '8', lineLabel: 'Advertising' },
  { key: 'fees', label: 'Payment and platform fees', short: 'Fees', line: '10', lineLabel: 'Commissions and fees' },
  { key: 'professional', label: 'Legal and professional', short: 'Professional', line: '17', lineLabel: 'Legal and professional services' },
  { key: 'office', label: 'Office expense', short: 'Office', line: '18', lineLabel: 'Office expense' },
  { key: 'insurance', label: 'Insurance', short: 'Insurance', line: '15', lineLabel: 'Insurance, other than health' },
  { key: 'licenses', label: 'Taxes and licenses', short: 'Licenses', line: '23', lineLabel: 'Taxes and licenses' },
  { key: 'travel', label: 'Travel', short: 'Travel', line: '24a', lineLabel: 'Travel' },
  { key: 'meals', label: 'Business meals', short: 'Meals', line: '24b', lineLabel: 'Deductible meals', rate: 0.5 },
  { key: 'vehicle', label: 'Vehicle and mileage', short: 'Vehicle', line: '9', lineLabel: 'Car and truck expenses' },
  { key: 'utilities', label: 'Phone and internet', short: 'Utilities', line: '25', lineLabel: 'Utilities' },
  { key: 'rent', label: 'Coworking and rent', short: 'Rent', line: '20b', lineLabel: 'Rent or lease, other property' },
  { key: 'education', label: 'Education and training', short: 'Education', line: '27a', lineLabel: 'Other expenses' },
  { key: 'bank', label: 'Bank fees', short: 'Bank fees', line: '27a', lineLabel: 'Other expenses' },
];

export const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
export const categoryOf = (key) => CATEGORY[key] || { key, label: key || 'Uncategorized', short: key || 'Other', line: '27a', lineLabel: 'Other expenses' };
export const deductibleCents = (e) => Math.round(e.amount_cents * (categoryOf(e.category).rate ?? 1));

const lineRank = (line) => {
  const n = parseInt(line, 10);
  const suffix = String(line).replace(/^\d+/, '');
  return n * 10 + (suffix ? suffix.charCodeAt(0) - 96 : 0);
};
export const compareLines = (a, b) => lineRank(a) - lineRank(b);

export const PAYMENT_METHODS = ['Business card', 'Business checking', 'PayPal', 'Personal card', 'Cash', 'Other'];

export const BILLING = [
  { key: 'unbilled', label: 'To bill' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'reimbursed', label: 'Repaid' },
];
export const billingLabel = (key) => (BILLING.find((b) => b.key === key) || {}).label || '';

export const CADENCES = [
  { key: 'monthly', label: 'Monthly', months: 1, per: 'a month' },
  { key: 'quarterly', label: 'Quarterly', months: 3, per: 'a quarter' },
  { key: 'annual', label: 'Annual', months: 12, per: 'a year' },
];
export const cadenceOf = (key) => CADENCES.find((c) => c.key === key) || CADENCES[0];
