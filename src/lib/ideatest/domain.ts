export const BUSINESS_MODELS = [
  "physical_product",
  "b2b_saas",
  "consumer_app",
  "service_agency",
  "marketplace",
  "local_business",
] as const;

export type BusinessModel = (typeof BUSINESS_MODELS)[number];
export type RunMode = "quick" | "full";
export type NumericInputs = Record<string, number>;

export const RUN_MODES: Record<RunMode, { buyers: number; credits: number }> = {
  quick: { buyers: 20, credits: 1 },
  full: { buyers: 100, credits: 5 },
};
export const MAX_ACTIVE_RUNS = 3;
export const MAX_BUYERS = 100;

export type FinanceField = {
  key: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
};

export const MODEL_LABELS: Record<BusinessModel, string> = {
  physical_product: "Physical product",
  b2b_saas: "B2B software",
  consumer_app: "Consumer app",
  service_agency: "Service agency",
  marketplace: "Marketplace",
  local_business: "Local business",
};

export const FINANCE_FIELDS: Record<BusinessModel, FinanceField[]> = {
  physical_product: [
    { key: "price", label: "Selling price", unit: "per unit", min: 0, step: 0.01 },
    { key: "unit_cost", label: "Cost to make or buy one", unit: "per unit", min: 0, step: 0.01 },
    { key: "units_per_day", label: "Units sold", unit: "per day", min: 0, step: 0.1 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
  b2b_saas: [
    { key: "price_per_seat", label: "Price per seat", unit: "per month", min: 0, step: 0.01 },
    { key: "seats_per_customer", label: "Seats per customer", unit: "seats", min: 1, step: 1 },
    { key: "monthly_churn_percent", label: "Monthly customer churn", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "customer_acquisition_cost", label: "Cost to acquire a customer", unit: "per customer", min: 0, step: 0.01 },
    { key: "hosting_cost_per_seat", label: "Hosting and support", unit: "per seat/month", min: 0, step: 0.01 },
    { key: "starting_customers", label: "Starting customers", unit: "customers", min: 0, step: 1 },
    { key: "new_customers_per_month", label: "New customers", unit: "per month", min: 0, step: 1 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
  consumer_app: [
    { key: "monthly_subscription_price", label: "Subscription price", unit: "per month", min: 0, step: 0.01 },
    { key: "active_users", label: "Starting active users", unit: "users", min: 0, step: 1 },
    { key: "monthly_churn_percent", label: "Monthly user churn", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "cost_per_user", label: "Cost to serve one user", unit: "per user/month", min: 0, step: 0.01 },
    { key: "new_users_per_month", label: "New users", unit: "per month", min: 0, step: 1 },
    { key: "customer_acquisition_cost", label: "Cost to acquire a user", unit: "per user", min: 0, step: 0.01 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
  service_agency: [
    { key: "hourly_rate", label: "Client hourly rate", unit: "per hour", min: 0, step: 0.01 },
    { key: "delivery_cost_per_hour", label: "Delivery cost", unit: "per hour", min: 0, step: 0.01 },
    { key: "available_hours_per_month", label: "Available delivery hours", unit: "per month", min: 0, step: 1 },
    { key: "utilization_percent", label: "Billable utilization", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "marketing_cost_per_month", label: "Sales and marketing", unit: "per month", min: 0, step: 0.01 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
  marketplace: [
    { key: "monthly_gmv", label: "Monthly transaction value", unit: "per month", min: 0, step: 0.01 },
    { key: "take_rate_percent", label: "Platform take rate", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "transaction_cost_percent", label: "Payment and transaction costs", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "gmv_growth_percent", label: "Monthly transaction growth", unit: "%", min: 0, max: 100, step: 0.1 },
    { key: "acquisition_spend_per_month", label: "Buyer and seller acquisition", unit: "per month", min: 0, step: 0.01 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
  local_business: [
    { key: "average_ticket", label: "Average sale", unit: "per transaction", min: 0, step: 0.01 },
    { key: "variable_cost_per_sale", label: "Direct cost per sale", unit: "per transaction", min: 0, step: 0.01 },
    { key: "transactions_per_day", label: "Transactions", unit: "per day", min: 0, step: 0.1 },
    { key: "open_days_per_month", label: "Days open", unit: "per month", min: 0, max: 31, step: 1 },
    { key: "fixed_monthly_cost", label: "Fixed operating costs", unit: "per month", min: 0, step: 0.01 },
  ],
};

export type MonthlyProjection = {
  month: number;
  revenue: number;
  contribution: number;
  operatingCosts: number;
  profit: number;
  cumulativeProfit: number;
};

export type Economics = {
  revenueYear1: number;
  contributionYear1: number;
  contributionMarginPercent: number;
  year1Profit: number;
  month12Profit: number;
  breakEvenUnits: number | null;
  breakEvenUnitLabel: string;
  cashNeeded: number;
  paybackMonth: number | null;
  monthly: MonthlyProjection[];
};

export function validateFinanceInputs(model: BusinessModel, inputs: NumericInputs): string | null {
  for (const field of FINANCE_FIELDS[model]) {
    const value = inputs[field.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `Enter ${field.label.toLowerCase()} to continue.`;
    }
    if (value < (field.min ?? 0) || (field.max !== undefined && value > field.max)) {
      return `${field.label} must be between ${field.min ?? 0} and ${field.max ?? "the allowed maximum"}.`;
    }
  }
  return null;
}

function monthlyValues(model: BusinessModel, inputs: NumericInputs, month: number) {
  let revenue = 0;
  let variableCost = 0;
  let acquisitionCost = 0;
  const fixedCost = inputs.fixed_monthly_cost ?? 0;

  if (model === "physical_product") {
    const units = inputs.units_per_day * 30;
    revenue = units * inputs.price;
    variableCost = units * inputs.unit_cost;
  } else if (model === "b2b_saas") {
    const churn = inputs.monthly_churn_percent / 100;
    let customers = inputs.starting_customers;
    for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
      customers = customers * (1 - churn) + inputs.new_customers_per_month;
    }
    const seats = customers * inputs.seats_per_customer;
    revenue = seats * inputs.price_per_seat;
    variableCost = seats * inputs.hosting_cost_per_seat;
    acquisitionCost = inputs.new_customers_per_month * inputs.customer_acquisition_cost;
  } else if (model === "consumer_app") {
    const churn = inputs.monthly_churn_percent / 100;
    let users = inputs.active_users;
    for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
      users = users * (1 - churn) + inputs.new_users_per_month;
    }
    revenue = users * inputs.monthly_subscription_price;
    variableCost = users * inputs.cost_per_user;
    acquisitionCost = inputs.new_users_per_month * inputs.customer_acquisition_cost;
  } else if (model === "service_agency") {
    const hours = inputs.available_hours_per_month * (inputs.utilization_percent / 100);
    revenue = hours * inputs.hourly_rate;
    variableCost = hours * inputs.delivery_cost_per_hour;
    acquisitionCost = inputs.marketing_cost_per_month;
  } else if (model === "marketplace") {
    const gmv = inputs.monthly_gmv * (1 + inputs.gmv_growth_percent / 100) ** (month - 1);
    revenue = gmv * (inputs.take_rate_percent / 100);
    variableCost = gmv * (inputs.transaction_cost_percent / 100);
    acquisitionCost = inputs.acquisition_spend_per_month;
  } else {
    const transactions = inputs.transactions_per_day * inputs.open_days_per_month;
    revenue = transactions * inputs.average_ticket;
    variableCost = transactions * inputs.variable_cost_per_sale;
  }

  const contribution = revenue - variableCost;
  const operatingCosts = fixedCost + acquisitionCost;
  return { revenue, contribution, operatingCosts, profit: contribution - operatingCosts };
}

export function calculateEconomics(model: BusinessModel, inputs: NumericInputs): Economics {
  const validationError = validateFinanceInputs(model, inputs);
  if (validationError) throw new Error(validationError);

  let cumulativeProfit = 0;
  let lowestCumulativeProfit = 0;
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const values = monthlyValues(model, inputs, month);
    cumulativeProfit += values.profit;
    lowestCumulativeProfit = Math.min(lowestCumulativeProfit, cumulativeProfit);
    return { month, ...values, cumulativeProfit };
  });

  const revenueYear1 = monthly.reduce((total, month) => total + month.revenue, 0);
  const contributionYear1 = monthly.reduce((total, month) => total + month.contribution, 0);
  const year1Profit = monthly.reduce((total, month) => total + month.profit, 0);
  const lastMonth = monthly[monthly.length - 1];
  const cashNeeded = Math.max(0, -lowestCumulativeProfit);
  const paybackMonth = cashNeeded === 0 ? 0 : (monthly.find((month) => month.cumulativeProfit >= 0)?.month ?? null);

  let breakEvenUnits: number | null = null;
  let breakEvenUnitLabel = "monthly units";
  if (model === "physical_product") {
    const marginPerUnit = inputs.price - inputs.unit_cost;
    breakEvenUnits = marginPerUnit > 0 ? Math.ceil(inputs.fixed_monthly_cost / marginPerUnit) : null;
  } else if (model === "b2b_saas") {
    const marginPerCustomer = inputs.seats_per_customer * (inputs.price_per_seat - inputs.hosting_cost_per_seat);
    const ongoingCost = inputs.fixed_monthly_cost + inputs.new_customers_per_month * inputs.customer_acquisition_cost;
    breakEvenUnits = marginPerCustomer > 0 ? Math.ceil(ongoingCost / marginPerCustomer) : null;
    breakEvenUnitLabel = "active customers";
  } else if (model === "consumer_app") {
    const marginPerUser = inputs.monthly_subscription_price - inputs.cost_per_user;
    const ongoingCost = inputs.fixed_monthly_cost + inputs.new_users_per_month * inputs.customer_acquisition_cost;
    breakEvenUnits = marginPerUser > 0 ? Math.ceil(ongoingCost / marginPerUser) : null;
    breakEvenUnitLabel = "active users";
  } else if (model === "service_agency") {
    const marginPerHour = inputs.hourly_rate - inputs.delivery_cost_per_hour;
    breakEvenUnits = marginPerHour > 0 ? Math.ceil((inputs.fixed_monthly_cost + inputs.marketing_cost_per_month) / marginPerHour) : null;
    breakEvenUnitLabel = "billable hours";
  } else if (model === "marketplace") {
    const marginRate = (inputs.take_rate_percent - inputs.transaction_cost_percent) / 100;
    breakEvenUnits = marginRate > 0 ? (inputs.fixed_monthly_cost + inputs.acquisition_spend_per_month) / marginRate : null;
    breakEvenUnitLabel = "monthly transaction value";
  } else {
    const marginPerSale = inputs.average_ticket - inputs.variable_cost_per_sale;
    breakEvenUnits = marginPerSale > 0 ? Math.ceil(inputs.fixed_monthly_cost / marginPerSale) : null;
    breakEvenUnitLabel = "monthly transactions";
  }

  return {
    revenueYear1,
    contributionYear1,
    contributionMarginPercent: revenueYear1 > 0 ? (contributionYear1 / revenueYear1) * 100 : 0,
    year1Profit,
    month12Profit: lastMonth?.profit ?? 0,
    breakEvenUnits,
    breakEvenUnitLabel,
    cashNeeded,
    paybackMonth,
    monthly,
  };
}

export type BuyerPriceAnswers = {
  price_too_cheap: number;
  price_cheap: number;
  price_expensive: number;
  price_too_expensive: number;
};

function findCurveIntersection(
  prices: number[],
  firstCurve: (price: number) => number,
  secondCurve: (price: number) => number,
): number {
  const differences = prices.map((price) => firstCurve(price) - secondCurve(price));
  for (let index = 0; index < prices.length; index += 1) {
    const price = prices[index];
    const difference = differences[index];
    if (price !== undefined && difference !== undefined && Math.abs(difference) < 1e-9) return price;
    const nextPrice = prices[index + 1];
    const nextDifference = differences[index + 1];
    if (price !== undefined && nextPrice !== undefined && difference !== undefined && nextDifference !== undefined && difference * nextDifference < 0) {
      const fraction = Math.abs(difference) / (Math.abs(difference) + Math.abs(nextDifference));
      return price + (nextPrice - price) * fraction;
    }
  }
  let closestIndex = 0;
  for (let index = 1; index < differences.length; index += 1) {
    if (Math.abs(differences[index] ?? Number.POSITIVE_INFINITY) < Math.abs(differences[closestIndex] ?? Number.POSITIVE_INFINITY)) {
      closestIndex = index;
    }
  }
  return prices[closestIndex] ?? 0;
}

export function calculateVanWestendorp(answers: BuyerPriceAnswers[]) {
  if (answers.length === 0) return null;
  const prices = Array.from(new Set(answers.flatMap((answer) => [
    answer.price_too_cheap,
    answer.price_cheap,
    answer.price_expensive,
    answer.price_too_expensive,
  ]))).sort((a, b) => a - b);
  const count = answers.length;
  const share = (matches: (answer: BuyerPriceAnswers) => boolean) =>
    answers.filter(matches).length / count;
  const tooCheap = (price: number) => share((answer) => answer.price_too_cheap >= price);
  const cheap = (price: number) => share((answer) => answer.price_cheap >= price);
  const expensive = (price: number) => share((answer) => answer.price_expensive <= price);
  const tooExpensive = (price: number) => share((answer) => answer.price_too_expensive <= price);

  return {
    point_of_marginal_cheapness: findCurveIntersection(prices, tooCheap, expensive),
    point_of_marginal_expensiveness: findCurveIntersection(prices, cheap, tooExpensive),
    optimal_price_point: findCurveIntersection(prices, tooCheap, tooExpensive),
    indifference_price: findCurveIntersection(prices, cheap, expensive),
    completed_responses: count,
  };
}

export function calculateBuyRate(answers: Array<{ would_buy: string | null }>) {
  if (answers.length === 0) return 0;
  return answers.filter((answer) => answer.would_buy === "yes").length / answers.length;
}

export type VerdictConditions = {
  positiveContribution: boolean;
  profitableYearOne: boolean;
  buyRateAboveTwentyPercent: boolean;
};

export function calculateVerdict(economics: Economics, buyRate: number) {
  const conditions: VerdictConditions = {
    positiveContribution: economics.contributionYear1 > 0,
    profitableYearOne: economics.year1Profit > 0,
    buyRateAboveTwentyPercent: buyRate > 0.2,
  };
  const passed = Object.values(conditions).filter(Boolean).length;
  const verdict = passed === 3 ? "promising" : passed === 0 ? "not_viable_yet" : "needs_work";
  return { verdict, conditions } as const;
}