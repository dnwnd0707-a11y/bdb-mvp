import { calculateHousingLeaseBrokerageFee } from "@/lib/brokerage-fee";
import type {
  BuyerRequest,
  Message,
  Property,
  Proposal,
  Report,
  ViewingAppointment,
} from "@/lib/types";

function brokerage(deposit: number, monthlyRent: number, proposed: number) {
  const calculation = calculateHousingLeaseBrokerageFee({ deposit, monthlyRent });

  return {
    legalMaxBrokerageFee: calculation.legalMaxFee,
    proposedBrokerageFee: Math.min(proposed, calculation.legalMaxFee),
    brokerageRateLabel: calculation.rule.label,
    brokerageFormulaLabel: calculation.formulaLabel,
    brokerageRuleId: calculation.rule.id,
    brokerageSourceUrl: calculation.rule.sourceUrl,
  };
}

export const buyerRequests: BuyerRequest[] = [
  {
    id: "req-101",
    title: "대구 서구 내당동 반려견 가능한 투룸",
    buyerName: "민지",
    regions: ["대구광역시 서구 내당동", "대구광역시 서구 평리동"],
    transactionType: "월세",
    housingType: "투룸",
    depositRange: "500만-1,500만",
    rentRange: "35만-60만",
    moveIn: "2026년 7월 중순",
    rooms: "방 2 / 욕실 1",
    area: "전용 26㎡ 이상",
    floor: "2층 이상",
    direction: "남향 우선",
    parking: false,
    pets: true,
    loan: true,
    maintenanceFee: "15만 이하",
    mustHaves: ["반려견 가능", "두류역 접근", "분리형 주방"],
    memo: "둘러보기용 예시 데이터입니다. 재택근무가 많아서 채광과 소음이 중요해요.",
    status: "open",
    proposalCount: 3,
  },
  {
    id: "req-102",
    title: "대구 서구 평리동 직장인 투룸 전세",
    buyerName: "지훈",
    regions: ["대구광역시 서구 평리동", "대구광역시 서구 비산동"],
    transactionType: "전세",
    housingType: "투룸",
    depositRange: "7,000만-1억 2,000만",
    rentRange: "없음",
    moveIn: "2026년 8월 초",
    rooms: "방 2 이상",
    area: "전용 35㎡ 이상",
    floor: "엘리베이터 있으면 무관",
    direction: "무관",
    parking: true,
    pets: false,
    loan: true,
    maintenanceFee: "20만 이하",
    mustHaves: ["전세대출 가능", "주차", "신축 또는 올수리"],
    memo: "둘러보기용 예시 데이터입니다. 허위 매물 없이 바로 방문 가능한 집만 받고 싶어요.",
    status: "matched",
    proposalCount: 5,
  },
];

export const proposals: Proposal[] = [
  {
    id: "prop-501",
    requestId: "req-101",
    agentId: "agent-park-soyeon",
    officeId: "office-seogu-woori",
    agentName: "박소연 중개사",
    officeName: "서구우리공인중개사",
    message:
      "반려견 가능 조건을 우선 확인했고, 대구 서구 내당동·평리동 생활권에서 채광 좋은 집 3곳만 골랐습니다.",
    createdAt: "오늘 14:20",
    status: "new",
    properties: [
      {
        id: "home-1",
        sourceListingId: "listing-naedang-pet-two-room-001",
        title: "내당동 채광 좋은 투룸",
        addressLabel: "내당동 근처",
        photoUrls: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
        ],
        deposit: 10_000_000,
        monthlyRent: 450_000,
        price: "보증금 1,000만 / 월세 45만",
        maintenanceFee: "관리비 7만",
        area: "전용 29㎡",
        floor: "4층",
        features: ["반려견 가능", "남향", "두류역 접근"],
        roughLat: 35.8606,
        roughLng: 128.5518,
        note: "둘러보기용 예시 데이터입니다. 소음이 적은 안쪽 라인이고 거실 채광이 좋습니다.",
        ...brokerage(10_000_000, 450_000, 45_000),
      },
      {
        id: "home-2",
        sourceListingId: "listing-pyeongni-separated-kitchen-002",
        title: "평리동 분리형 주방 원룸",
        addressLabel: "평리동 근처",
        photoUrls: [
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
        ],
        deposit: 5_000_000,
        monthlyRent: 390_000,
        price: "보증금 500만 / 월세 39만",
        maintenanceFee: "관리비 6만",
        area: "전용 24㎡",
        floor: "3층",
        features: ["분리형 주방", "엘리베이터", "집주인 협의 필요"],
        roughLat: 35.8722,
        roughLng: 128.559,
        note: "둘러보기용 예시 데이터입니다. 출퇴근 동선이 좋고 관리비가 예산 안에 들어오지만, 반려동물 가능 여부는 집주인 협의 필요로 표시됩니다.",
        ...brokerage(5_000_000, 390_000, 38_000),
      },
      {
        id: "home-3",
        sourceListingId: "listing-bisan-new-two-room-003",
        title: "비산동 신축급 투룸",
        addressLabel: "비산동 근처",
        photoUrls: [
          "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80",
        ],
        deposit: 15_000_000,
        monthlyRent: 550_000,
        price: "보증금 1,500만 / 월세 55만",
        maintenanceFee: "관리비 8만",
        area: "전용 32㎡",
        floor: "5층",
        features: ["신축급", "수납 넉넉", "전세대출 상담 가능"],
        roughLat: 35.8849,
        roughLng: 128.5683,
        note: "둘러보기용 예시 데이터입니다. 예산 상단이지만 컨디션이 가장 좋습니다.",
        ...brokerage(15_000_000, 550_000, 52_000),
      },
    ],
  },
  {
    id: "prop-502",
    requestId: "req-101",
    agentId: "agent-kim-doyun",
    officeId: "office-dongne-good",
    agentName: "김도윤 중개사",
    officeName: "동네좋은공인중개사",
    message:
      "동일한 내당동 투룸을 다른 조건으로 안내하는 둘러보기용 예시입니다. 제안 중개보수를 비교해볼 수 있습니다.",
    createdAt: "오늘 15:05",
    status: "new",
    properties: [
      {
        id: "home-1-alt",
        sourceListingId: "listing-naedang-pet-two-room-001",
        title: "내당동 채광 좋은 투룸",
        addressLabel: "내당동 근처",
        photoUrls: [
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
        ],
        deposit: 10_000_000,
        monthlyRent: 450_000,
        price: "보증금 1,000만 / 월세 45만",
        maintenanceFee: "관리비 7만",
        area: "전용 29㎡",
        floor: "4층",
        features: ["반려견 가능", "남향", "두류역 접근"],
        roughLat: 35.8606,
        roughLng: 128.5518,
        note: "둘러보기용 예시 데이터입니다. 같은 원본 매물에 대해 다른 공인중개사가 제안한 사례입니다.",
        ...brokerage(10_000_000, 450_000, 70_000),
      },
    ],
  },
];

export const agentFeedProperties: Property[] = [
  {
    id: "feed-home-1",
    sourceListingId: "listing-naedang-pet-two-room-001",
    title: "내당동 반려동물 가능 투룸",
    addressLabel: "내당동 근처",
    photoUrls: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    ],
    deposit: 10_000_000,
    monthlyRent: 450_000,
    price: "보증금 1,000만 / 월세 45만",
    maintenanceFee: "관리비 7만",
    area: "전용 29㎡",
    floor: "4층",
    features: ["반려동물 가능", "두류역 접근", "분리형 주방"],
    roughLat: 35.8606,
    roughLng: 128.5518,
    note: "둘러보기용 예시 데이터입니다. 사무소 피드에 무료 등록된 매물입니다.",
    ...brokerage(10_000_000, 450_000, 45_000),
  },
  {
    id: "feed-home-2",
    sourceListingId: "listing-pyeongni-jeonse-two-room-004",
    title: "평리동 직장인 투룸 전세",
    addressLabel: "평리동 근처",
    photoUrls: [
      "https://images.unsplash.com/photo-1560448204-61dc36dc98c8?auto=format&fit=crop&w=900&q=80",
    ],
    deposit: 95_000_000,
    monthlyRent: 0,
    price: "전세 9,500만",
    maintenanceFee: "관리비 8만",
    area: "전용 36㎡",
    floor: "3층",
    features: ["전세대출 가능", "주차 협의", "집주인 협의 필요"],
    roughLat: 35.8722,
    roughLng: 128.559,
    note: "둘러보기용 예시 데이터입니다. BDB를 통한 계약 성사 시에만 성과형 플랫폼 이용료가 정산됩니다. 반려동물 가능 여부는 집주인 협의 필요로 표시됩니다.",
    ...brokerage(95_000_000, 0, 280_000),
  },
];

export const messages: Message[] = [
  {
    id: "msg-1",
    roomId: "prop-501",
    sender: "agent",
    body: "세 매물 모두 둘러보기용 예시 데이터이며, 오늘 기준 방문 가능한 흐름을 가정했습니다. 어느 시간대가 편하세요?",
    createdAt: "14:22",
  },
  {
    id: "msg-2",
    roomId: "prop-501",
    sender: "buyer",
    body: "첫 번째 집과 세 번째 집을 비교해서 보고 싶어요.",
    createdAt: "14:25",
  },
];

export const reports: Report[] = [
  {
    id: "report-1",
    target: "제안 prop-501",
    reason: "정확한 주소를 채팅 전에 요구함",
    status: "reviewing",
  },
];

export const viewingAppointments: ViewingAppointment[] = [
  {
    id: "view-1",
    proposalId: "prop-501",
    buyerName: "민지",
    agentName: "박소연 중개사",
    scheduledFor: "내일 15:00",
    viewingFee: 0,
    status: "confirmed",
  },
];
