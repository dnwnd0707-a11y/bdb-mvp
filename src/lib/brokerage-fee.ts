export type BrokerageTransactionType = "전세" | "월세";

export type BrokerageRateRule = {
  id: string;
  region: string;
  propertyType: "주택";
  transactionType: "임대차";
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  limitAmount: number | null;
  label: string;
  sourceUrl: string;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type BrokerageCalculation = {
  transactionAmount: number;
  legalMaxFee: number;
  rule: BrokerageRateRule;
  formulaLabel: string;
};

export const housingLeaseRateTable: BrokerageRateRule[] = [
  {
    id: "kr-housing-lease-under-50m",
    region: "전국 공통",
    propertyType: "주택",
    transactionType: "임대차",
    minAmount: 0,
    maxAmount: 50_000_000,
    rate: 0.005,
    limitAmount: 200_000,
    label: "5천만원 미만 · 상한 0.5% · 한도 20만원",
    sourceUrl: "https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003",
    effectiveFrom: "2021-10-19",
    effectiveTo: null,
  },
  {
    id: "kr-housing-lease-50m-100m",
    region: "전국 공통",
    propertyType: "주택",
    transactionType: "임대차",
    minAmount: 50_000_000,
    maxAmount: 100_000_000,
    rate: 0.004,
    limitAmount: 300_000,
    label: "5천만원 이상 1억원 미만 · 상한 0.4% · 한도 30만원",
    sourceUrl: "https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003",
    effectiveFrom: "2021-10-19",
    effectiveTo: null,
  },
  {
    id: "kr-housing-lease-100m-300m",
    region: "전국 공통",
    propertyType: "주택",
    transactionType: "임대차",
    minAmount: 100_000_000,
    maxAmount: 300_000_000,
    rate: 0.003,
    limitAmount: null,
    label: "1억원 이상 3억원 미만 · 상한 0.3%",
    sourceUrl: "https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003",
    effectiveFrom: "2021-10-19",
    effectiveTo: null,
  },
  {
    id: "kr-housing-lease-300m-600m",
    region: "전국 공통",
    propertyType: "주택",
    transactionType: "임대차",
    minAmount: 300_000_000,
    maxAmount: 600_000_000,
    rate: 0.004,
    limitAmount: null,
    label: "3억원 이상 6억원 미만 · 상한 0.4%",
    sourceUrl: "https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003",
    effectiveFrom: "2021-10-19",
    effectiveTo: null,
  },
  {
    id: "kr-housing-lease-600m-plus",
    region: "전국 공통",
    propertyType: "주택",
    transactionType: "임대차",
    minAmount: 600_000_000,
    maxAmount: null,
    rate: 0.008,
    limitAmount: null,
    label: "6억원 이상 · 상한 0.8% 이내 협의",
    sourceUrl: "https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003",
    effectiveFrom: "2021-10-19",
    effectiveTo: null,
  },
];

export function calculateLeaseTransactionAmount({
  deposit,
  monthlyRent,
}: {
  deposit: number;
  monthlyRent: number;
}) {
  if (monthlyRent <= 0) {
    return {
      amount: deposit,
      formulaLabel: "전세금 기준",
    };
  }

  const amountByHundred = deposit + monthlyRent * 100;
  if (amountByHundred < 50_000_000) {
    return {
      amount: deposit + monthlyRent * 70,
      formulaLabel: "보증금 + 월세 x 70",
    };
  }

  return {
    amount: amountByHundred,
    formulaLabel: "보증금 + 월세 x 100",
  };
}

export function calculateHousingLeaseBrokerageFee({
  deposit,
  monthlyRent,
}: {
  deposit: number;
  monthlyRent: number;
}): BrokerageCalculation {
  const transaction = calculateLeaseTransactionAmount({ deposit, monthlyRent });
  const rule = housingLeaseRateTable.find(
    (item) =>
      transaction.amount >= item.minAmount &&
      (item.maxAmount === null || transaction.amount < item.maxAmount)
  );

  if (!rule) {
    throw new Error("No brokerage fee rule matched the transaction amount.");
  }

  const rawFee = Math.floor(transaction.amount * rule.rate);
  const legalMaxFee =
    rule.limitAmount === null ? rawFee : Math.min(rawFee, rule.limitAmount);

  return {
    transactionAmount: transaction.amount,
    legalMaxFee,
    rule,
    formulaLabel: transaction.formulaLabel,
  };
}

export function clampProposedBrokerageFee(proposed: number, legalMax: number) {
  return Math.min(Math.max(proposed, 0), legalMax);
}
