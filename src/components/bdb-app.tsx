"use client";

import { KakaoMap } from "@/components/kakao-map";
import {
  calculateHousingLeaseBrokerageFee,
  clampProposedBrokerageFee,
} from "@/lib/brokerage-fee";
import {
  buyerRequests as initialRequests,
  agentFeedProperties as initialAgentFeedProperties,
  messages as initialMessages,
  proposals as initialProposals,
  reports as initialReports,
  viewingAppointments as initialViewingAppointments,
} from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/client";
import type {
  BuyerRequest,
  AgentKind,
  AgentApprovalStatus,
  Message,
  Property,
  Proposal,
  Report,
  Role,
  ViewingAppointment,
} from "@/lib/types";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Home,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  ReceiptText,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  Upload,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const roleCopy: Record<Role, string> = {
  buyer: "수요자",
  agent: "공인중개사",
  admin: "관리자",
};

const roleDescriptions: Record<Role, string> = {
  buyer: "조건을 올리고 맞춤 제안을 비교합니다.",
  agent: "승인 후 요청서를 보고 매물 묶음과 중개보수를 제안합니다.",
  admin: "인증 심사, 신고 처리, 매물 상태와 법정 상한 기준을 관리합니다.",
};

const roleHeroCopy: Record<Role, { chips: string[]; title: string; description: string }> = {
  buyer: {
    chips: ["전월세 주거 MVP", "매물·중개보수 비교", "무료 방문예약"],
    title: "원하는 조건을 등록하고, 제안 중개보수까지 비교하세요.",
    description:
      "임차인은 조건등록, 제안 확인, 비교, 방문예약을 무료로 이용합니다. 계약 체결 시에는 선택한 공인중개사에게 사전에 제안받은 법정 범위 내 중개보수를 지급합니다.",
  },
  agent: {
    chips: ["인증 중개사 전용", "무료 매물등록", "성과형 이용료"],
    title: "실제 고객 요청에 맞춰 매물과 중개보수를 제안하세요.",
    description:
      "공인중개사는 가입, 매물등록, 고객 요청 확인, 제안까지 무료로 이용합니다. 계약 성사 시에만 BDB에 성과형 플랫폼 이용료를 정산하는 구조입니다.",
  },
  admin: {
    chips: ["인증 심사", "허위매물 관리", "법정 상한 기준"],
    title: "공인중개사 인증과 신고·상한 기준을 관리하세요.",
    description:
      "관리자는 공인중개사와 중개사무소 인증, 소속 공인중개사 승인, 허위매물 신고 처리, 이용자 제재, 30일 갱신과 법정 중개보수 상한 기준을 관리합니다.",
  },
};

const roleFocusCards: Record<Role, Array<[string, string]>> = {
  buyer: [
    ["수요자 이용 안내", "조건등록, 제안 비교, 채팅, 무료 방문예약을 BDB 플랫폼 이용료 없이 확인합니다."],
    ["신뢰 장치", "자격과 소속이 확인된 공인중개사가 실제 매물사진과 제안 중개보수를 함께 보냅니다."],
  ],
  agent: [
    ["인증 상태", "공인중개사와 중개사무소 인증 후 고객 요청 확인, 제안, 채팅, 방문예약 관리를 사용할 수 있습니다."],
    ["중개보수 제안", "법정 상한요율 이내에서 제안 중개보수와 예상 원화 금액을 함께 제시합니다."],
  ],
  admin: [
    ["인증 심사", "대표 공인중개사와 중개사무소를 심사하고 소속 공인중개사의 대표 승인을 관리합니다."],
    ["신고·상한 관리", "허위매물 숨김, 이용자 제재, 30일 갱신, 법정 중개보수 상한 기준을 관리합니다."],
  ],
};

const agentKindCopy: Record<AgentKind, string> = {
  representative: "대표 공인중개사",
  affiliated: "소속 공인중개사",
};

const formatter = new Intl.NumberFormat("ko-KR");

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[7rem] rounded-lg border border-[#d9d0c0] bg-white px-4 py-3 text-center">
      <p className="text-2xl font-bold leading-none text-[#20251f]">{value}</p>
      <p className="mt-2 whitespace-nowrap text-xs font-semibold text-[#677064]">{label}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#cfd8c9] bg-[#edf6ef] px-3 py-1 text-xs font-semibold text-[#33523a]">
      {children}
    </span>
  );
}

function DemoDataLabel() {
  return (
    <p className="mt-2 text-xs font-semibold text-[#8a7350]">
      둘러보기용 예시 데이터
    </p>
  );
}

function PhotoTile({
  src,
  label,
  className = "",
}: {
  src: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      role="img"
      className={`aspect-[4/3] w-full rounded-lg border border-[#d9d0c0] bg-cover bg-center ${className}`}
      style={{ backgroundImage: `url("${src}")` }}
    />
  );
}

function BrokerageFeeBox({
  legalMax,
  proposed,
  rateLabel,
  formulaLabel,
}: {
  legalMax: number;
  proposed: number;
  rateLabel: string;
  formulaLabel: string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-[#e4d7bb] bg-white px-3 py-3">
      <p className="text-xs font-bold text-[#6b5a16]">중개보수 제안</p>
      <div className="mt-2 grid gap-2 text-sm text-[#586155]">
        <div className="flex items-center justify-between gap-3">
          <span>법정 최대</span>
          <strong className="text-[#20251f]">{formatter.format(legalMax)}원</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>중개사 제안</span>
          <strong className="text-[#2f6f45]">{formatter.format(proposed)}원</strong>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#677064]">
        {formulaLabel} · {rateLabel}
      </p>
    </div>
  );
}

function ConditionBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const style =
    tone === "success"
      ? "border-[#b8d7c4] bg-[#EAF2EE] text-[#183F35]"
      : tone === "warning"
        ? "border-[#ead580] bg-[#fff8db] text-[#6b5a16]"
        : tone === "danger"
          ? "border-[#efc2bd] bg-[#fff3f1] text-[#C84B45]"
          : "border-[#DEE4E0] bg-white text-[#69736F]";
  const icon = tone === "success" ? <Check size={15} aria-hidden="true" /> : <Siren size={15} aria-hidden="true" />;

  return (
    <span className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-extrabold ${style}`}>
      {icon}
      {label}
    </span>
  );
}

function ConditionCheckRow({ item }: { item: ConditionCheck }) {
  const style =
    item.status === "fulfilled"
      ? "text-[#183F35]"
      : item.status === "negotiation"
        ? "text-[#6b5a16]"
        : item.status === "unmet"
          ? "text-[#C84B45]"
          : "text-[#69736F]";
  const statusLabel =
    item.status === "fulfilled"
      ? "충족"
      : item.status === "negotiation"
        ? "협의 필요"
        : item.status === "unmet"
          ? "불충족"
          : "확인 필요";
  const icon =
    item.status === "fulfilled" ? (
      <Check size={15} aria-hidden="true" />
    ) : (
      <Siren size={15} aria-hidden="true" />
    );

  return (
    <li className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[#DEE4E0] bg-white px-3 py-2 text-xs font-bold ${style}`}>
      <span className="min-w-0 truncate text-[#1D2723]">{item.label}</span>
      <span className="inline-flex shrink-0 items-center gap-1">
        {icon}
        {statusLabel}
      </span>
    </li>
  );
}

function ConditionDetails({ conditionStatus }: { conditionStatus: ReturnType<typeof getConditionStatus> }) {
  const allItems = [
    ...conditionStatus.must.items,
    ...conditionStatus.priority.items,
  ];

  if (allItems.length === 0) {
    return (
      <p className="mt-3 rounded-xl border border-[#DEE4E0] bg-white px-3 py-2 text-xs font-bold text-[#69736F]">
        조건별 충족 여부는 매물 상세 확인이 필요합니다.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-2">
      {conditionStatus.must.total > 0 ? (
        <p className="text-xs font-extrabold text-[#183F35]">
          필수조건 {conditionStatus.must.fulfilled}/{conditionStatus.must.total}개 충족
        </p>
      ) : null}
      <ul className="grid gap-2">
        {allItems.map((item) => (
          <ConditionCheckRow key={`${item.label}-${item.status}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

type ConditionCheckStatus = "fulfilled" | "unmet" | "negotiation" | "unknown";

type ConditionCheck = {
  label: string;
  status: ConditionCheckStatus;
};

type ConditionStatusSummary = {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  fulfilled: number;
  total: number;
  items: ConditionCheck[];
};

type TransactionChoice = "월세" | "전세" | "둘 다 가능";
type BuyerTab = "home" | "request" | "proposals" | "chat" | "appointments";
type AgentTab = "home" | "requests" | "properties" | "sent" | "appointments" | "office";
type AgentProposalStep = 0 | 1 | 2 | 3;
type PropertyFilter = "all" | "active" | "renewal" | "completed";
type ProposalComparisonItem = {
  comparisonId: string;
  proposalId: string;
  property: Property;
  agentId: string;
  officeId: string;
  agentName: string;
  officeName: string;
  message: string;
  createdAt: string;
  sourceListingId: string;
};

type BuyerWizardData = {
  transactionType: TransactionChoice;
  regions: string[];
  monthlyDepositMax: number;
  monthlyRentMax: number;
  monthlyMaintenanceMax: number;
  jeonseDepositMax: number;
  jeonseMaintenanceMax: number;
  budgetFlexible: boolean;
  roomStructures: string[];
  buildingTypes: string[];
  moveInType: "즉시 입주" | "날짜 선택" | "일정 협의 가능";
  moveInDate: string;
  moveInFlexible: boolean;
  occupants: "1명" | "2명" | "3명 이상";
  occupantCount: number;
  parkingNeed: "주차 필요 없음" | "있으면 좋음" | "반드시 필요";
  carCount: "차량 1대" | "차량 2대 이상";
  hasLargeCar: boolean;
  petStatus: "반려동물 없음" | "함께 입주 예정";
  petTypes: string[];
  catCount: number;
  dogCount: number;
  otherPetCount: number;
  otherPetType: string;
  dogSize: "" | "소형견" | "중형견" | "대형견";
  petMemo: string;
  elevatorNeed: "상관없음" | "있으면 좋음" | "반드시 필요";
  avoidFloors: string[];
  officetelFloor: "저층 제외" | "고층 선호" | "층수 상관없음";
  sunlight: "상관없음" | "잘 들면 좋음" | "반드시 잘 들어야 함";
  southFacing: boolean;
  optionMode: "옵션 상관없음" | "필요한 옵션 직접 선택" | "풀옵션 선호";
  appliances: string[];
  safetyImportance: "상관없음" | "있으면 좋음" | "중요함";
  safetyItems: string[];
  avoidEnvironments: string[];
  nearbyFacilities: string[];
  facilityDistance: "도보 5분 이내" | "도보 10분 이내" | "가까우면 좋음";
  commuteMode: "출퇴근 조건 없음" | "기준 지역·역 입력";
  commuteBase: string;
  commuteTransport: "도보" | "대중교통" | "자가용";
  commuteTime: "10분" | "20분" | "30분" | "40분 이상";
  interiorNeeds: string[];
  loanNeed: "필요 없음" | "가능하면 좋음" | "반드시 가능한 집";
  guaranteeNeed: "상관없음" | "가입 가능한 집 선호" | "가입 가능한 집만 제안받기";
  topPriorities: string[];
  allowPartialMatch: boolean;
};

type BuyerWizardSubmit = {
  title: string;
  transactionType: TransactionChoice;
  regions: string[];
  depositRange: string;
  rentRange: string;
  budgetSummary: string;
  moveIn: string;
  rooms: string;
  area: string;
  floor: string;
  direction: string;
  parking: boolean;
  parkingDescription: string;
  pets: boolean;
  loan: boolean;
  maintenanceFee: string;
  mustHaves: string[];
  preferredConditions: string[];
  negotiableConditions: string[];
  monthlyFixedCost?: number;
  allowPartialMatch: boolean;
  petDescription: string;
  livingConditionGroups: Array<[string, string]>;
  memo: string;
};

const daeguSeoRegions = ["대구 서구 전체", "내당동", "평리동", "비산동", "중리동", "원대동"];
const wizardSteps = [
  "거래유형",
  "희망지역",
  "예산",
  "방 구조",
  "입주",
  "주차·반려동물",
  "층수·채광",
  "생활조건",
  "대출·보증보험",
  "우선순위",
  "최종 확인",
];
const wizardStepDescriptions = [
  "월세, 전세, 전월세 가능 여부만 먼저 정해주세요.",
  "대구 서구 안에서 제안을 받고 싶은 동네를 고릅니다.",
  "중개사가 바로 판단할 수 있도록 월 고정비와 전세 예산을 함께 봅니다.",
  "원룸·투룸 중심으로 구조와 건물 유형을 좁힙니다.",
  "입주 가능 시기와 함께 살 인원을 알려주세요.",
  "주차와 반려동물 조건은 제안 가능 여부를 가르는 핵심 조건입니다.",
  "층수, 엘리베이터, 채광처럼 현장에서 꼭 확인할 조건을 정합니다.",
  "옵션, 보안, 주변 환경을 성격별로 나눠 고릅니다.",
  "전세를 포함한 경우 대출과 보증보험 가능 여부를 확인합니다.",
  "중개사가 가장 먼저 맞춰야 할 조건을 3개까지 정합니다.",
  "공개 전 요청서 내용을 한 번에 확인합니다.",
];
const roomStructureOptions = ["원룸", "1.5룸", "투룸", "구조 상관없음"];
const buildingTypeOptions = ["일반 원·투룸", "오피스텔", "상관없음"];
const applianceOptions = ["에어컨", "냉장고", "세탁기", "취사시설", "옷장", "침대", "전자레인지", "TV"];
const safetyOptions = ["공동현관 출입통제", "CCTV", "비디오폰·인터폰", "방범창", "큰길과 가까운 위치", "밤길이 밝은 위치"];
const environmentOptions = ["대로변", "술집·유흥가 주변", "음식점이 많은 건물", "공사장 주변", "철도·지상철 주변", "소음은 크게 상관없음"];
const facilityOptions = ["지하철역", "버스정류장", "편의점", "마트", "공원", "병원·약국", "빨래방", "특별히 없음"];
const interiorOptions = ["분리형 주방", "베란다·세탁 공간", "수납공간", "화장실 창문", "큰 창문", "신축·리모델링", "내부 구조 상관없음"];
const priorityOptions = ["채광", "엘리베이터", "층수", "옵션·가전", "보안·안전", "조용한 주변", "가까운 편의시설", "출퇴근 이동"];
const petTypeOptions = ["고양이", "강아지", "기타"];

const initialBuyerWizardData: BuyerWizardData = {
  transactionType: "월세",
  regions: ["내당동", "평리동"],
  monthlyDepositMax: 1000,
  monthlyRentMax: 45,
  monthlyMaintenanceMax: 7,
  jeonseDepositMax: 9500,
  jeonseMaintenanceMax: 8,
  budgetFlexible: true,
  roomStructures: ["투룸"],
  buildingTypes: ["일반 원·투룸"],
  moveInType: "일정 협의 가능",
  moveInDate: "2026-09-15",
  moveInFlexible: true,
  occupants: "1명",
  occupantCount: 3,
  parkingNeed: "있으면 좋음",
  carCount: "차량 1대",
  hasLargeCar: false,
  petStatus: "반려동물 없음",
  petTypes: [],
  catCount: 1,
  dogCount: 1,
  otherPetCount: 1,
  otherPetType: "",
  dogSize: "",
  petMemo: "",
  elevatorNeed: "상관없음",
  avoidFloors: ["반지하 제외"],
  officetelFloor: "층수 상관없음",
  sunlight: "잘 들면 좋음",
  southFacing: true,
  optionMode: "필요한 옵션 직접 선택",
  appliances: ["에어컨", "냉장고", "세탁기"],
  safetyImportance: "있으면 좋음",
  safetyItems: ["공동현관 출입통제", "CCTV"],
  avoidEnvironments: ["술집·유흥가 주변"],
  nearbyFacilities: ["지하철역", "편의점"],
  facilityDistance: "도보 10분 이내",
  commuteMode: "출퇴근 조건 없음",
  commuteBase: "반월당역",
  commuteTransport: "대중교통",
  commuteTime: "30분",
  interiorNeeds: ["분리형 주방", "수납공간"],
  loanNeed: "가능하면 좋음",
  guaranteeNeed: "가입 가능한 집 선호",
  topPriorities: ["채광", "조용한 주변"],
  allowPartialMatch: true,
};

function formatManwon(value: number) {
  return `${formatter.format(value)}만원`;
}

function formatWon(value: number) {
  return `${formatter.format(Math.max(0, value))}원`;
}

function getPropertyTransactionType(property: Property) {
  return property.monthlyRent > 0 ? "월세" : "전세";
}

function parseMaintenanceFeeWon(label: string) {
  const match = label.match(/([\d,.]+)\s*만/);
  if (!match) return 0;
  return Math.round(Number(match[1].replace(/,/g, "")) * 10_000);
}

function getPropertyMonthlyFixedCost(property: Property) {
  return property.monthlyRent + parseMaintenanceFeeWon(property.maintenanceFee);
}

function getPropertyBudgetLabel(property: Property) {
  return getPropertyTransactionType(property) === "월세"
    ? `보증금 ${formatManwon(property.deposit / 10_000)} · 월세 ${formatManwon(property.monthlyRent / 10_000)}`
    : `전세보증금 ${formatManwon(property.deposit / 10_000)}`;
}

function getPropertyMaintenanceLabel(property: Property) {
  const fixedCost = getPropertyMonthlyFixedCost(property);
  return `${property.maintenanceFee} · 월 고정 ${formatManwon(fixedCost / 10_000)}`;
}

function isCompatiblePropertyForRequest(property: Property, request?: BuyerRequest) {
  if (!request || request.transactionType === "둘 다 가능") return true;
  return getPropertyTransactionType(property) === request.transactionType;
}

function getConditionStatus(property: Property, request?: BuyerRequest) {
  const buildSummary = (
    items: ConditionCheck[],
    emptyLabel: string,
    fulfilledLabel: string,
    unmetLabel: string
  ): ConditionStatusSummary => {
    const fulfilled = items.filter((item) => item.status === "fulfilled").length;
    const total = items.length;

    if (total === 0) {
      return {
        label: emptyLabel,
        tone: "neutral",
        fulfilled,
        total,
        items,
      };
    }

    if (fulfilled === total) {
      return {
        label: fulfilledLabel,
        tone: "success",
        fulfilled,
        total,
        items,
      };
    }

    if (items.some((item) => item.status === "unmet")) {
      return {
        label: unmetLabel,
        tone: "danger",
        fulfilled,
        total,
        items,
      };
    }

    if (items.some((item) => item.status === "negotiation")) {
      return {
        label: "협의 필요",
        tone: "warning",
        fulfilled,
        total,
        items,
      };
    }

    return {
      label: "확인 필요",
      tone: "neutral",
      fulfilled,
      total,
      items,
    };
  };

  if (!request) {
    return {
      must: buildSummary([], "확인 필요", "모두 충족", "일부 불충족"),
      priority: buildSummary([], "확인 필요", "충족", "확인 필요"),
    };
  }

  const featureText = property.features.join(" ");
  const getCheckStatus = (condition: string): ConditionCheckStatus => {
    const trimmed = condition.trim();
    if (!trimmed) return "unknown";
    if (trimmed.includes("반려") && featureText.includes("집주인 협의 필요")) return "negotiation";
    if (trimmed.includes("반려") && (featureText.includes("반려견 가능") || featureText.includes("반려동물 가능"))) return "fulfilled";
    if (trimmed.includes("반려")) return "unmet";
    if (property.features.some((feature) => feature === trimmed || feature.includes(trimmed))) return "fulfilled";
    if (trimmed.includes("주방") && featureText.includes("분리형 주방")) return "fulfilled";
    if (trimmed.includes("역 접근") && property.features.some((feature) => feature === trimmed)) return "fulfilled";
    if (trimmed.includes("신축") && (featureText.includes("신축") || featureText.includes("올수리"))) return "fulfilled";
    if (trimmed.includes("주차") && property.features.some((feature) => feature.includes("주차"))) return "fulfilled";
    if (trimmed.includes("대출") && property.features.some((feature) => feature.includes("대출"))) return "fulfilled";
    if (trimmed.includes("주방") || trimmed.includes("역 접근") || trimmed.includes("신축") || trimmed.includes("올수리") || trimmed.includes("주차") || trimmed.includes("대출")) return "unmet";
    return "unknown";
  };
  const mustItems = request.mustHaves.filter((condition) => {
    if (condition.startsWith("우선조건:") || condition.startsWith("협의조건:")) return false;
    if (condition.startsWith("요청 만료일:")) return false;
    if (condition.includes(":")) return false;
    if (condition === "조건 외 제안 허용" || condition === "필수조건 모두 충족한 매물만") return false;
    return true;
  }).map((condition) => ({
    label: condition,
    status: getCheckStatus(condition),
  }));
  const priorityText =
    request.mustHaves.find((condition) => condition.startsWith("우선조건:"))?.replace("우선조건: ", "") ??
    "";
  const priorityItems = priorityText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      label: item,
      status: item.includes("채광") && featureText.includes("남향") ? "fulfilled" as const : getCheckStatus(item),
    }));

  return {
    must: buildSummary(mustItems, "확인 필요", "모두 충족", "일부 불충족"),
    priority: buildSummary(priorityItems, "확인 필요", "충족", "확인 필요"),
  };
}

function toggleExclusive(current: string[], value: string, allValue: string, limit?: number) {
  if (value === allValue) return [allValue];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current.filter((item) => item !== allValue), value];
  return typeof limit === "number" ? next.slice(0, limit) : next;
}

function addDaysLabel(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function describePetDetails(data: BuyerWizardData) {
  if (data.petStatus === "반려동물 없음") return "반려동물 없음";

  const details = [
    data.petTypes.includes("고양이") ? `고양이 ${data.catCount}마리` : "",
    data.petTypes.includes("강아지") ? `${data.dogSize} ${data.dogCount}마리` : "",
    data.petTypes.includes("기타")
      ? `${data.otherPetType.trim() || "기타 반려동물"} ${data.otherPetCount}마리`
      : "",
  ].filter(Boolean);

  return details.length > 0 ? details.join("·") : "반려동물 정보 미입력";
}

function getPetValidationMessage(data: BuyerWizardData) {
  if (data.petStatus === "반려동물 없음") return "";
  if (data.petTypes.length === 0) return "반려동물 종류를 1개 이상 선택해주세요.";
  if (data.petTypes.includes("고양이") && data.catCount < 1) return "고양이 마릿수를 입력해주세요.";
  if (data.petTypes.includes("강아지") && data.dogCount < 1) return "강아지 마릿수를 입력해주세요.";
  if (data.petTypes.includes("강아지") && !data.dogSize) return "강아지 크기를 선택해주세요.";
  if (data.petTypes.includes("기타") && !data.otherPetType.trim()) return "기타 반려동물 종류를 입력해주세요.";
  if (data.petTypes.includes("기타") && data.otherPetCount < 1) return "기타 반려동물 마릿수를 입력해주세요.";
  return "";
}

function describeSunlightCondition(data: BuyerWizardData) {
  const details = [
    data.sunlight !== "상관없음" ? data.sunlight : "",
    data.southFacing ? "남향 계열 선호" : "",
  ].filter(Boolean);

  return details.length > 0 ? `채광(${details.join("·")})` : "채광";
}

function OptionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
        selected
          ? "border-[#356556] bg-[#EAF2EE] font-extrabold text-[#183F35] shadow-sm"
          : "border-[#DEE4E0] bg-white font-bold text-[#1D2723] hover:border-[#356556] hover:bg-[#F7F5EF]"
      }`}
    >
      <span>{children}</span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-[#356556] bg-[#356556] text-white" : "border-[#DEE4E0] text-transparent"
        }`}
        aria-hidden="true"
      >
        <Check size={13} />
      </span>
    </button>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  quickValues,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  quickValues: number[];
}) {
  return (
    <label className="grid gap-2 rounded-xl border border-[#DEE4E0] bg-white p-3 text-sm font-bold text-[#356556]">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="text-xs font-extrabold text-[#183F35]">{formatManwon(value)}</span>
      </span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="min-h-12 rounded-xl border border-[#DEE4E0] bg-white px-3 text-[#1D2723]"
      />
      <span className="flex flex-wrap gap-2">
        {quickValues.map((quickValue) => (
          <button
            key={quickValue}
            type="button"
            onClick={() => onChange(quickValue)}
            className="min-h-8 rounded-full border border-[#DEE4E0] bg-white px-3 py-1 text-xs font-extrabold text-[#356556] hover:border-[#356556] hover:bg-[#EAF2EE]"
          >
            {formatManwon(quickValue)}
          </button>
        ))}
      </span>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  quickValues,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  quickValues: number[];
  unit: string;
}) {
  const formatter = new Intl.NumberFormat("ko-KR");

  return (
    <label className="grid gap-2 rounded-xl border border-[#DEE4E0] bg-white p-3 text-sm font-bold text-[#356556]">
      <span className="flex items-center justify-between gap-3">
        {label}
        <span className="text-xs font-extrabold text-[#183F35]">
          {formatter.format(value)}
          {unit}
        </span>
      </span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        className="min-h-12 rounded-xl border border-[#DEE4E0] bg-white px-3 text-[#1D2723]"
      />
      <span className="flex flex-wrap gap-2">
        {quickValues.map((quickValue) => (
          <button
            key={quickValue}
            type="button"
            onClick={() => onChange(quickValue)}
            className="min-h-8 rounded-full border border-[#DEE4E0] bg-white px-3 py-1 text-xs font-extrabold text-[#356556] hover:border-[#356556] hover:bg-[#EAF2EE]"
          >
            {formatter.format(quickValue)}
            {unit}
          </button>
        ))}
      </span>
    </label>
  );
}

function BuyerRequestWizard({ onSubmit }: { onSubmit: (data: BuyerWizardSubmit) => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<BuyerWizardData>(initialBuyerWizardData);
  const [validationMessage, setValidationMessage] = useState("");
  const [priorityWarning, setPriorityWarning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<BuyerWizardSubmit | null>(null);
  const [requestStatus, setRequestStatus] = useState<"제안 대기" | "요청 종료">("제안 대기");
  const [expiresAt, setExpiresAt] = useState("");
  const progress = Math.round(((stepIndex + 1) / wizardSteps.length) * 100);
  const showMonthly = data.transactionType === "월세" || data.transactionType === "둘 다 가능";
  const showJeonse = data.transactionType === "전세" || data.transactionType === "둘 다 가능";
  const hasOnlyOfficetel = data.buildingTypes.length === 1 && data.buildingTypes[0] === "오피스텔";
  const monthlyFixedCost = data.monthlyRentMax + data.monthlyMaintenanceMax;
  const normalizedRegions = data.regions.includes("대구 서구 전체")
    ? ["대구광역시 서구 전체"]
    : data.regions.map((region) => `대구광역시 서구 ${region}`);

  function patch(next: Partial<BuyerWizardData>) {
    setData((current) => ({ ...current, ...next }));
    setValidationMessage("");
  }

  function buildSummary(): BuyerWizardSubmit {
    const titleRegions = data.regions.includes("대구 서구 전체")
      ? "대구 서구"
      : `대구 서구 ${data.regions.slice(0, 2).join("·")}`;
    const titleTransaction = data.transactionType === "둘 다 가능" ? "전월세" : data.transactionType;
    const budgetSummary = [
      showMonthly ? `월세 보증금 ${formatManwon(data.monthlyDepositMax)} 이하` : "",
      showMonthly ? `월세 ${formatManwon(data.monthlyRentMax)} 이하` : "",
      showMonthly ? `관리비 ${formatManwon(data.monthlyMaintenanceMax)} 이하` : "",
      showMonthly ? `월 고정 ${formatManwon(monthlyFixedCost)}` : "",
      showJeonse ? `전세보증금 ${formatManwon(data.jeonseDepositMax)} 이하` : "",
      showJeonse ? `전세 관리비 ${formatManwon(data.jeonseMaintenanceMax)} 이하` : "",
    ].filter(Boolean).join(" · ");
    const rooms = data.roomStructures.includes("구조 상관없음")
      ? "구조 상관없음"
      : data.roomStructures.join(", ");
    const moveIn =
      data.moveInType === "날짜 선택"
        ? `${data.moveInDate}${data.moveInFlexible ? " 전후 2주 조정 가능" : ""}`
        : data.moveInType;
    const petDescription = describePetDetails(data);
    const parkingDescription = data.parkingNeed === "주차 필요 없음"
      ? "주차 필요 없음"
      : `${data.parkingNeed} · ${data.carCount}${data.hasLargeCar ? " · SUV·대형차" : ""}`;
    const optionSummary =
      data.optionMode === "옵션 상관없음"
        ? "상관없음"
        : data.optionMode === "풀옵션 선호"
          ? "풀옵션 선호"
          : data.appliances.join(", ") || "직접 선택 없음";
    const safetySummary =
      data.safetyImportance === "상관없음"
        ? "상관없음"
        : data.safetyItems.join(", ") || `보안·안전 ${data.safetyImportance}`;
    const avoidEnvironmentSummary =
      data.avoidEnvironments.includes("소음은 크게 상관없음")
        ? "소음은 크게 상관없음"
        : data.avoidEnvironments.join(", ") || "없음";
    const facilitySummary =
      data.nearbyFacilities.includes("특별히 없음")
        ? "특별히 없음"
        : `${data.nearbyFacilities.join(", ") || "없음"} · ${data.facilityDistance}`;
    const livingConditionGroups: Array<[string, string]> = [
      ["필요한 옵션", optionSummary],
      ["보안 선호", safetySummary],
      ["피하고 싶은 환경", avoidEnvironmentSummary],
      ["가까우면 좋은 시설", facilitySummary],
    ];
    const mustHaves = [
      data.transactionType,
      ...normalizedRegions,
      showMonthly ? `월 고정 주거비 ${formatManwon(monthlyFixedCost)} 이하` : "",
      showJeonse ? `전세보증금 ${formatManwon(data.jeonseDepositMax)} 이하` : "",
      data.petStatus === "함께 입주 예정" ? `반려동물 가능 · ${petDescription}` : "",
      data.parkingNeed === "반드시 필요" ? "주차 반드시 필요" : "",
      data.loanNeed === "반드시 가능한 집" ? "전세자금대출 가능 필수" : "",
      data.guaranteeNeed === "가입 가능한 집만 제안받기" ? "전세보증금 반환보증 가입 가능" : "",
    ].filter(Boolean);
    const sunlightCondition = describeSunlightCondition(data);
    const preferredConditions = [
      ...data.topPriorities.map((priority) =>
        priority === "채광" ? sunlightCondition : priority
      ),
      !data.topPriorities.includes("채광") && sunlightCondition !== "채광" ? sunlightCondition : "",
      data.elevatorNeed !== "상관없음" && !hasOnlyOfficetel ? `엘리베이터 ${data.elevatorNeed}` : "",
      ...data.appliances,
      ...data.safetyItems,
      ...data.nearbyFacilities.filter((item) => item !== "특별히 없음"),
    ].filter(Boolean);
    const negotiableConditions = [
      data.budgetFlexible ? "마음에 드는 집이면 예산 조정 가능" : "",
      data.allowPartialMatch ? "미충족 조건이 명확하면 조건 외 제안 허용" : "필수조건 모두 충족한 매물만",
      data.commuteMode === "기준 지역·역 입력"
        ? `${data.commuteBase} 기준 ${data.commuteTransport} ${data.commuteTime} 이내`
        : "",
    ].filter(Boolean);

    return {
      title: `${titleRegions} ${rooms} ${titleTransaction} 찾습니다`,
      transactionType: data.transactionType,
      regions: normalizedRegions,
      depositRange: showMonthly
        ? `월세 보증금 ${formatManwon(data.monthlyDepositMax)} 이하`
        : `전세보증금 ${formatManwon(data.jeonseDepositMax)} 이하`,
      rentRange: showMonthly ? `월세 ${formatManwon(data.monthlyRentMax)} 이하` : "없음",
      budgetSummary,
      moveIn,
      rooms,
      area: data.buildingTypes.join(", "),
      floor: hasOnlyOfficetel ? data.officetelFloor : data.avoidFloors.join(", "),
      direction: `${data.sunlight}${data.southFacing ? " · 남향 계열 선호" : ""}`,
      parking: data.parkingNeed !== "주차 필요 없음",
      parkingDescription,
      pets: data.petStatus === "함께 입주 예정",
      loan: data.loanNeed !== "필요 없음",
      maintenanceFee: showMonthly
        ? `월세 관리비 ${formatManwon(data.monthlyMaintenanceMax)} 이하`
        : `전세 관리비 ${formatManwon(data.jeonseMaintenanceMax)} 이하`,
      mustHaves,
      preferredConditions,
      negotiableConditions,
      monthlyFixedCost: showMonthly ? monthlyFixedCost : undefined,
      allowPartialMatch: data.allowPartialMatch,
      petDescription,
      livingConditionGroups,
      memo: `둘러보기용 예시 데이터입니다. 필수: ${mustHaves.join(", ")} / 우선: ${preferredConditions
        .slice(0, 3)
        .join(", ")} / 생활조건: ${livingConditionGroups.map(([label, value]) => `${label}: ${value}`).join(" / ")} / 협의: ${negotiableConditions.join(", ")}`,
    };
  }

  const summary = buildSummary();

  function nextStep() {
    if (stepIndex === 5) {
      const petError = getPetValidationMessage(data);
      if (petError) {
        setValidationMessage(petError);
        return;
      }
    }
    setStepIndex((current) => Math.min(current + 1, wizardSteps.length - 1));
  }

  function previousStep() {
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function choosePriority(item: string) {
    setData((current) => {
      if (
        !current.topPriorities.includes(item) &&
        current.topPriorities.length >= 3
      ) {
        setPriorityWarning(
          "우선조건은 최대 3개까지 선택할 수 있습니다. 다른 조건을 선택하려면 기존 조건 하나를 해제해주세요."
        );
        return current;
      }

      setPriorityWarning("");
      return {
        ...current,
        topPriorities: current.topPriorities.includes(item)
          ? current.topPriorities.filter((priority) => priority !== item)
          : [...current.topPriorities, item],
      };
    });
  }

  function submitRequest() {
    if (isSubmitting || submittedSummary) return;

    const nextSummary = buildSummary();
    const nextExpiresAt = addDaysLabel(new Date(), 14);
    setIsSubmitting(true);
    setRequestStatus("제안 대기");
    setExpiresAt(nextExpiresAt);

    window.setTimeout(() => {
      onSubmit(nextSummary);
      setSubmittedSummary(nextSummary);
      setIsSubmitting(false);
    }, 250);
  }

  if (submittedSummary) {
    return (
      <div className="mt-5 grid gap-5">
        <div className="rounded-lg border border-[#b9c7b4] bg-[#edf6ef] p-5">
          <p className="text-sm font-bold text-[#2f6f45]">조건 등록 완료</p>
          <h3 className="mt-2 text-2xl font-bold text-[#20251f]">
            조건 등록이 완료되었습니다
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#586155]">
            선택한 지역의 인증된 공인중개사가 조건을 확인하고 매물을 제안합니다.
          </p>
        </div>
        <div className="grid gap-3 rounded-lg border border-[#d9d0c0] bg-white p-4 text-sm leading-6 text-[#586155]">
          <p>
            <strong className="text-[#20251f]">요청서 제목</strong> ·{" "}
            {submittedSummary.title}
          </p>
          <p>
            <strong className="text-[#20251f]">공개기간</strong> · 14일
          </p>
          <p>
            <strong className="text-[#20251f]">현재 상태</strong> · {requestStatus}
          </p>
          <p>
            <strong className="text-[#20251f]">받은 제안 수</strong> · 0건
          </p>
          <p>
            <strong className="text-[#20251f]">요청 만료 예정일</strong> ·{" "}
            {expiresAt}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setValidationMessage("아래 공인중개사 제안 비교 영역에서 내 요청서를 확인할 수 있습니다.")}
            className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 py-2 text-sm font-bold text-[#20251f]"
          >
            내 요청서 보기
          </button>
          <button
            type="button"
            onClick={() => {
              setSubmittedSummary(null);
              setStepIndex(0);
              setValidationMessage("");
            }}
            className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 py-2 text-sm font-bold text-[#20251f]"
          >
            조건 수정
          </button>
          <button
            type="button"
            onClick={() => setRequestStatus("요청 종료")}
            className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 py-2 text-sm font-bold text-[#20251f]"
          >
            요청 종료
          </button>
          <button
            type="button"
            onClick={() => setExpiresAt(addDaysLabel(new Date(), 28))}
            className="min-h-11 rounded-lg bg-[#2f6f45] px-3 py-2 text-sm font-bold text-white"
          >
            14일 연장
          </button>
        </div>
        {validationMessage ? (
          <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] p-3 text-sm font-bold text-[#6b5a16]">
            {validationMessage}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5">
      <div className="rounded-2xl border border-[#DEE4E0] bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-extrabold text-[#356556]">
              조건 등록 · {stepIndex + 1} / {wizardSteps.length} · 예상 2분
            </p>
            <h3 className="text-balance mt-1 text-xl font-extrabold text-[#1D2723]">
              {wizardSteps[stepIndex]}
            </h3>
            <p className="mt-1 text-sm font-medium leading-6 text-[#69736F]">
              {wizardStepDescriptions[stepIndex]}
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#EAF2EE] px-3 py-1 text-xs font-extrabold text-[#183F35]">
            {progress}% 완료
          </span>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#DEE4E0]">
          <div
            className="h-2 rounded-full bg-[#356556] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex gap-1.5 overflow-hidden" aria-hidden="true">
          {wizardSteps.map((step, index) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                index <= stepIndex ? "bg-[#356556]" : "bg-[#DEE4E0]"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 sm:p-5">
        {stepIndex === 0 ? (
          <div className="grid gap-4">
            <h3 className="text-balance text-2xl font-extrabold">어떤 방식의 집을 찾고 있나요?</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["월세", "전세", "둘 다 가능"] as TransactionChoice[]).map((choice) => (
                <OptionButton
                  key={choice}
                  selected={data.transactionType === choice}
                  onClick={() => patch({ transactionType: choice })}
                >
                  {choice}
                </OptionButton>
              ))}
            </div>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-4">
            <h3 className="text-balance text-2xl font-extrabold">희망 지역을 골라주세요</h3>
            <p className="text-sm font-medium leading-6 text-[#69736F]">
              초기 실증지역은 대구광역시 서구입니다. 법정동 기준으로 최대 3개까지 선택할 수 있습니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {daeguSeoRegions.map((region) => (
                <OptionButton
                  key={region}
                  selected={data.regions.includes(region)}
                  onClick={() =>
                    patch({
                      regions: toggleExclusive(
                        data.regions,
                        region,
                        "대구 서구 전체",
                        3
                      ),
                    })
                  }
                >
                  {region}
                </OptionButton>
              ))}
            </div>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">예산을 만원 단위로 알려주세요</h3>
            {showMonthly ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <MoneyField label="보증금 최대" value={data.monthlyDepositMax} onChange={(value) => patch({ monthlyDepositMax: value })} quickValues={[500, 1000, 1500]} />
                <MoneyField label="월세 최대" value={data.monthlyRentMax} onChange={(value) => patch({ monthlyRentMax: value })} quickValues={[35, 45, 50, 60]} />
                <MoneyField label="관리비 최대" value={data.monthlyMaintenanceMax} onChange={(value) => patch({ monthlyMaintenanceMax: value })} quickValues={[5, 7, 10]} />
              </div>
            ) : null}
            {showMonthly ? (
              <p className="rounded-xl border border-[#DEE4E0] bg-white p-4 text-sm font-medium leading-6 text-[#69736F]">
                <strong className="text-[#1D2723]">월세 요약</strong> · 보증금 {formatManwon(data.monthlyDepositMax)} 이하 · 월세 {formatManwon(data.monthlyRentMax)} 이하 · 관리비 {formatManwon(data.monthlyMaintenanceMax)} 이하 · 월 고정지출 <strong className="text-[#183F35]">{formatManwon(monthlyFixedCost)}</strong>
              </p>
            ) : null}
            {showJeonse ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField label="전세보증금 최대" value={data.jeonseDepositMax} onChange={(value) => patch({ jeonseDepositMax: value })} quickValues={[7000, 9500, 12000]} />
                <MoneyField label="전세 관리비 최대" value={data.jeonseMaintenanceMax} onChange={(value) => patch({ jeonseMaintenanceMax: value })} quickValues={[5, 8, 10]} />
              </div>
            ) : null}
            {showJeonse ? (
              <p className="rounded-xl border border-[#DEE4E0] bg-white p-4 text-sm font-medium leading-6 text-[#69736F]">
                <strong className="text-[#1D2723]">전세 요약</strong> · 전세보증금 {formatManwon(data.jeonseDepositMax)} 이하 · 관리비 {formatManwon(data.jeonseMaintenanceMax)} 이하 · 월 고정지출 <strong className="text-[#183F35]">{formatManwon(data.jeonseMaintenanceMax)}</strong>
              </p>
            ) : null}
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#DEE4E0] bg-white px-3 text-sm font-bold">
              <input type="checkbox" checked={data.budgetFlexible} onChange={(event) => patch({ budgetFlexible: event.target.checked })} />
              마음에 드는 집이면 예산 조정 가능
            </label>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">방 구조와 건물 유형을 골라주세요</h3>
            <div>
              <p className="mb-3 text-sm font-bold text-[#54715b]">방 구조 · 복수 선택</p>
              <div className="grid gap-3 sm:grid-cols-4">
                {roomStructureOptions.map((option) => (
                  <OptionButton key={option} selected={data.roomStructures.includes(option)} onClick={() => patch({ roomStructures: toggleExclusive(data.roomStructures, option, "구조 상관없음") })}>
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-bold text-[#54715b]">건물 유형 · 복수 선택</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {buildingTypeOptions.map((option) => (
                  <OptionButton key={option} selected={data.buildingTypes.includes(option)} onClick={() => patch({ buildingTypes: toggleExclusive(data.buildingTypes, option, "상관없음") })}>
                    {option}
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {stepIndex === 4 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">입주 일정과 인원을 알려주세요</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["즉시 입주", "날짜 선택", "일정 협의 가능"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.moveInType === choice} onClick={() => patch({ moveInType: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.moveInType === "날짜 선택" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" value={data.moveInDate} onChange={(event) => patch({ moveInDate: event.target.value })} className="min-h-12 rounded-lg border border-[#d9d0c0] px-3" />
                <label className="flex min-h-12 items-center gap-2 rounded-lg border border-[#d9d0c0] bg-white px-3 text-sm font-bold">
                  <input type="checkbox" checked={data.moveInFlexible} onChange={(event) => patch({ moveInFlexible: event.target.checked })} />
                  선택 날짜에서 앞뒤 2주까지 조정 가능
                </label>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {(["1명", "2명", "3명 이상"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.occupants === choice} onClick={() => patch({ occupants: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.occupants === "3명 이상" ? (
              <NumberField label="입주 인원수" value={data.occupantCount} onChange={(value) => patch({ occupantCount: value })} quickValues={[3, 4, 5]} unit="명" />
            ) : null}
          </div>
        ) : null}

        {stepIndex === 5 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">주차와 반려동물 조건을 알려주세요</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["주차 필요 없음", "있으면 좋음", "반드시 필요"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.parkingNeed === choice} onClick={() => patch({ parkingNeed: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.parkingNeed !== "주차 필요 없음" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {(["차량 1대", "차량 2대 이상"] as const).map((choice) => (
                  <OptionButton key={choice} selected={data.carCount === choice} onClick={() => patch({ carCount: choice })}>
                    {choice}
                  </OptionButton>
                ))}
                <label className="flex min-h-12 items-center gap-2 rounded-lg border border-[#d9d0c0] bg-white px-3 text-sm font-bold">
                  <input type="checkbox" checked={data.hasLargeCar} onChange={(event) => patch({ hasLargeCar: event.target.checked })} />
                  SUV·대형차
                </label>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {(["반려동물 없음", "함께 입주 예정"] as const).map((choice) => (
                <OptionButton
                  key={choice}
                  selected={data.petStatus === choice}
                  onClick={() =>
                    patch({
                      petStatus: choice,
                      petTypes: choice === "함께 입주 예정" ? [] : data.petTypes,
                    })
                  }
                >
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.petStatus === "함께 입주 예정" ? (
              <div className="grid gap-4">
                <div className={`rounded-lg border p-3 ${validationMessage ? "border-[#c84632] bg-[#fff5f1]" : "border-transparent p-0"}`}>
                  <p className="mb-3 text-sm font-bold text-[#54715b]">반려동물 종류 · 복수 선택</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {petTypeOptions.map((petType) => (
                      <OptionButton
                        key={petType}
                        selected={data.petTypes.includes(petType)}
                        onClick={() => patch({ petTypes: toggleExclusive(data.petTypes, petType, "") })}
                      >
                        {petType}
                      </OptionButton>
                    ))}
                  </div>
                  {validationMessage === "반려동물 종류를 1개 이상 선택해주세요." ? (
                    <p className="mt-3 text-sm font-bold text-[#c84632]">
                      {validationMessage}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.petTypes.includes("고양이") ? (
                    <NumberField label="고양이 마릿수" value={data.catCount} onChange={(value) => patch({ catCount: value })} quickValues={[1, 2, 3]} unit="마리" />
                  ) : null}
                  {data.petTypes.includes("강아지") ? (
                    <>
                      <NumberField label="강아지 마릿수" value={data.dogCount} onChange={(value) => patch({ dogCount: value })} quickValues={[1, 2, 3]} unit="마리" />
                      <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                        강아지 크기
                        <select value={data.dogSize} onChange={(event) => patch({ dogSize: event.target.value as BuyerWizardData["dogSize"] })} className={`min-h-12 rounded-lg border px-3 ${validationMessage === "강아지 크기를 선택해주세요." ? "border-[#c84632] bg-[#fff5f1]" : "border-[#d9d0c0]"}`}>
                          <option value="">강아지 크기 선택</option>
                          <option>소형견</option>
                          <option>중형견</option>
                          <option>대형견</option>
                        </select>
                        {validationMessage === "강아지 크기를 선택해주세요." ? (
                          <span className="text-sm font-bold text-[#c84632]">
                            {validationMessage}
                          </span>
                        ) : null}
                      </label>
                    </>
                  ) : null}
                  {data.petTypes.includes("기타") ? (
                    <>
                      <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                        기타 반려동물 종류
                        <input value={data.otherPetType} onChange={(event) => patch({ otherPetType: event.target.value })} placeholder="예: 토끼" className="min-h-12 rounded-lg border border-[#d9d0c0] px-3" />
                      </label>
                      <NumberField label="기타 반려동물 마릿수" value={data.otherPetCount} onChange={(value) => patch({ otherPetCount: value })} quickValues={[1, 2, 3]} unit="마리" />
                    </>
                  ) : null}
                </div>
                <input value={data.petMemo} onChange={(event) => patch({ petMemo: event.target.value })} placeholder="반려동물 추가 설명(선택)" className="min-h-12 rounded-lg border border-[#d9d0c0] px-3" />
              </div>
            ) : null}
            {validationMessage && !["반려동물 종류를 1개 이상 선택해주세요.", "강아지 크기를 선택해주세요."].includes(validationMessage) ? (
              <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] p-3 text-sm font-bold text-[#6b5a16]">
                {validationMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {stepIndex === 6 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">
              {hasOnlyOfficetel ? "오피스텔 층수와 채광 조건을 정해주세요" : "층수·엘리베이터·채광 조건을 정해주세요"}
            </h3>
            {!hasOnlyOfficetel ? (
              <div>
                <p className="mb-3 text-sm font-bold text-[#54715b]">엘리베이터</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["상관없음", "있으면 좋음", "반드시 필요"] as const).map((choice) => (
                    <OptionButton key={choice} selected={data.elevatorNeed === choice} onClick={() => patch({ elevatorNeed: choice })}>
                      {choice}
                    </OptionButton>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-3 text-sm font-bold text-[#54715b]">{hasOnlyOfficetel ? "오피스텔 층수" : "피하고 싶은 층"}</p>
              {hasOnlyOfficetel ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["저층 제외", "고층 선호", "층수 상관없음"] as const).map((choice) => (
                    <OptionButton key={choice} selected={data.officetelFloor === choice} onClick={() => patch({ officetelFloor: choice })}>
                      {choice}
                    </OptionButton>
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {["반지하 제외", "1층 제외", "4층 이상 제외", "옥탑방 제외", "층수 상관없음"].map((choice) => (
                    <OptionButton key={choice} selected={data.avoidFloors.includes(choice)} onClick={() => patch({ avoidFloors: toggleExclusive(data.avoidFloors, choice, "층수 상관없음") })}>
                      {choice}
                    </OptionButton>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["상관없음", "잘 들면 좋음", "반드시 잘 들어야 함"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.sunlight === choice} onClick={() => patch({ sunlight: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            <label className="flex min-h-12 items-center gap-2 rounded-lg border border-[#d9d0c0] bg-white px-3 text-sm font-bold">
              <input type="checkbox" checked={data.southFacing} onChange={(event) => patch({ southFacing: event.target.checked })} />
              남향 계열 선호
            </label>
          </div>
        ) : null}

        {stepIndex === 7 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">생활 조건을 골라주세요</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["옵션 상관없음", "필요한 옵션 직접 선택", "풀옵션 선호"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.optionMode === choice} onClick={() => patch({ optionMode: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.optionMode !== "옵션 상관없음" ? (
              <div className="grid gap-2 sm:grid-cols-4">
                {applianceOptions.map((item) => (
                  <OptionButton key={item} selected={data.appliances.includes(item)} onClick={() => patch({ appliances: toggleExclusive(data.appliances, item, "") })}>
                    {item}
                  </OptionButton>
                ))}
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {(["상관없음", "있으면 좋음", "중요함"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.safetyImportance === choice} onClick={() => patch({ safetyImportance: choice })}>
                  보안·안전 {choice}
                </OptionButton>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {safetyOptions.map((item) => (
                <OptionButton key={item} selected={data.safetyItems.includes(item)} onClick={() => patch({ safetyItems: toggleExclusive(data.safetyItems, item, "") })}>
                  {item}
                </OptionButton>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {environmentOptions.map((item) => (
                <OptionButton key={item} selected={data.avoidEnvironments.includes(item)} onClick={() => patch({ avoidEnvironments: toggleExclusive(data.avoidEnvironments, item, "소음은 크게 상관없음") })}>
                  {item}
                </OptionButton>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {facilityOptions.map((item) => (
                <OptionButton key={item} selected={data.nearbyFacilities.includes(item)} onClick={() => patch({ nearbyFacilities: toggleExclusive(data.nearbyFacilities, item, "특별히 없음") })}>
                  {item}
                </OptionButton>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["도보 5분 이내", "도보 10분 이내", "가까우면 좋음"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.facilityDistance === choice} onClick={() => patch({ facilityDistance: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["출퇴근 조건 없음", "기준 지역·역 입력"] as const).map((choice) => (
                <OptionButton key={choice} selected={data.commuteMode === choice} onClick={() => patch({ commuteMode: choice })}>
                  {choice}
                </OptionButton>
              ))}
            </div>
            {data.commuteMode === "기준 지역·역 입력" ? (
              <div className="grid gap-3 sm:grid-cols-4">
                <input value={data.commuteBase} onChange={(event) => patch({ commuteBase: event.target.value })} className="min-h-12 rounded-lg border border-[#d9d0c0] px-3" aria-label="기준 지역 또는 역" />
                <select value={data.commuteTransport} onChange={(event) => patch({ commuteTransport: event.target.value as BuyerWizardData["commuteTransport"] })} className="min-h-12 rounded-lg border border-[#d9d0c0] px-3">
                  <option>도보</option>
                  <option>대중교통</option>
                  <option>자가용</option>
                </select>
                <select value={data.commuteTime} onChange={(event) => patch({ commuteTime: event.target.value as BuyerWizardData["commuteTime"] })} className="min-h-12 rounded-lg border border-[#d9d0c0] px-3">
                  <option>10분</option>
                  <option>20분</option>
                  <option>30분</option>
                  <option>40분 이상</option>
                </select>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              {interiorOptions.map((item) => (
                <OptionButton key={item} selected={data.interiorNeeds.includes(item)} onClick={() => patch({ interiorNeeds: toggleExclusive(data.interiorNeeds, item, "내부 구조 상관없음") })}>
                  {item}
                </OptionButton>
              ))}
            </div>
          </div>
        ) : null}

        {stepIndex === 8 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">대출·보증보험 조건을 확인해주세요</h3>
            {showJeonse ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["필요 없음", "가능하면 좋음", "반드시 가능한 집"] as const).map((choice) => (
                    <OptionButton key={choice} selected={data.loanNeed === choice} onClick={() => patch({ loanNeed: choice })}>
                      전세자금대출 {choice}
                    </OptionButton>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["상관없음", "가입 가능한 집 선호", "가입 가능한 집만 제안받기"] as const).map((choice) => (
                    <OptionButton key={choice} selected={data.guaranteeNeed === choice} onClick={() => patch({ guaranteeNeed: choice })}>
                      {choice}
                    </OptionButton>
                  ))}
                </div>
                <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] p-4 text-sm leading-6 text-[#6b5a16]">
                  실제 대출 및 보증 가입 가능 여부는 금융기관과 보증기관의 심사 결과에 따라 달라질 수 있습니다.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-[#d9d0c0] bg-white p-4 text-sm leading-6 text-[#586155]">
                월세만 선택해 전세자금대출과 반환보증 질문은 생략됩니다.
              </p>
            )}
          </div>
        ) : null}

        {stepIndex === 9 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">가장 중요한 선호조건을 최대 3개 골라주세요</h3>
            <p className="text-sm font-bold text-[#54715b]">
              {data.topPriorities.length}/3개 선택
            </p>
            <div className="grid gap-3 sm:grid-cols-4">
              {priorityOptions.map((item) => (
                <OptionButton key={item} selected={data.topPriorities.includes(item)} onClick={() => choosePriority(item)}>
                  {item}
                </OptionButton>
              ))}
            </div>
            {priorityWarning ? (
              <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] p-3 text-sm font-bold text-[#6b5a16]">
                {priorityWarning}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionButton selected={!data.allowPartialMatch} onClick={() => patch({ allowPartialMatch: false })}>
                아니요, 필수조건을 모두 충족한 매물만
              </OptionButton>
              <OptionButton selected={data.allowPartialMatch} onClick={() => patch({ allowPartialMatch: true })}>
                예, 충족하지 않는 조건이 명확히 표시되면 받아보기
              </OptionButton>
            </div>
            <p className="rounded-lg border border-[#d9d0c0] bg-white p-4 text-sm leading-6 text-[#586155]">
              조건 외 제안 허용 시 예시는 “총 12개 조건 중 10개 충족 · 미충족 조건: 남향 선호, 지하철역 도보 10분”처럼 명확히 표시됩니다.
            </p>
          </div>
        ) : null}

        {stepIndex === 10 ? (
          <div className="grid gap-5">
            <h3 className="text-balance text-2xl font-extrabold">최종 확인</h3>
            <div className="rounded-lg border border-[#d9d0c0] bg-white p-4">
              <p className="text-sm font-semibold text-[#54715b]">자동 요청서 제목</p>
              <h4 className="mt-2 text-xl font-bold">{summary.title}</h4>
            </div>
            {[
              ["거래유형", summary.transactionType, 0],
              ["희망 지역", summary.regions.join(" · "), 1],
              ["주택 유형", `${summary.rooms} · ${data.buildingTypes.join(", ")}`, 3],
              ["보증금·월세 범위", summary.budgetSummary, 2],
              ["관리비 및 월 고정지출", showMonthly ? `월 고정지출 ${formatManwon(monthlyFixedCost)}` : `월 고정지출 ${formatManwon(data.jeonseMaintenanceMax)}`, 2],
              ["필수 조건", summary.mustHaves.join(", "), 9],
              ["선호 조건", summary.preferredConditions.slice(0, 6).join(", ") || "없음", 9],
              ["제외 조건", `${summary.floor} · 피하고 싶은 환경: ${summary.livingConditionGroups.find(([label]) => label === "피하고 싶은 환경")?.[1] ?? "없음"}`, 6],
            ].map(([title, value, target]) => (
              <div key={title} className="rounded-xl border border-[#DEE4E0] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-[#356556]">{title}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-[#69736F]">{value}</p>
                  </div>
                  <button type="button" onClick={() => setStepIndex(Number(target))} className="min-h-10 rounded-xl border border-[#DEE4E0] px-3 py-2 text-sm font-extrabold">
                    수정
                  </button>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-[#DEE4E0] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-2">
                  <p className="text-sm font-extrabold text-[#356556]">옵션·보안·주변 환경</p>
                  {summary.livingConditionGroups.map(([label, value]) => (
                    <p key={label} className="text-sm font-medium leading-6 text-[#69736F]">
                      <strong className="text-[#1D2723]">{label}</strong>: {value}
                    </p>
                  ))}
                </div>
                <button type="button" onClick={() => setStepIndex(7)} className="min-h-10 rounded-xl border border-[#DEE4E0] px-3 py-2 text-sm font-extrabold">
                  수정
                </button>
              </div>
            </div>
            <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] p-4 text-sm leading-6 text-[#6b5a16]">
              등록한 조건은 선택 지역의 인증된 공인중개사에게만 공개됩니다. 연락처와 정확한 목적지 등의 개인정보는 공개되지 않습니다. 요청서는 기본 14일 동안 공개하고 만료 전에 연장할 수 있습니다.
            </p>
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-3 z-10 -mx-1 flex flex-col-reverse gap-3 rounded-lg border border-[#d9d0c0] bg-[#f7f4ee]/95 p-2 shadow-[0_12px_32px_rgba(32,37,31,0.16)] backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <button
          type="button"
          onClick={previousStep}
          disabled={stepIndex === 0}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#DEE4E0] bg-white px-4 py-3 font-extrabold text-[#1D2723] disabled:text-[#9ba397]"
        >
          이전
        </button>
        {stepIndex < wizardSteps.length - 1 ? (
          <button
            type="button"
            onClick={nextStep}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#356556] px-4 py-3 font-extrabold text-white"
          >
            다음
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submitRequest}
            disabled={isSubmitting || Boolean(submittedSummary)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#356556] px-4 py-3 font-extrabold text-white disabled:bg-[#9ba397]"
          >
            {isSubmitting ? "조건을 등록하고 있습니다" : "이 조건으로 매물 제안받기"}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

type BdbAppProps = {
  initialPreviewMode?: boolean;
  initialPreviewRoleSpecified?: boolean;
  initialRole?: Role;
};

export function BdbApp({
  initialPreviewMode = false,
  initialPreviewRoleSpecified = false,
  initialRole = "buyer",
}: BdbAppProps) {
  const agentProposalFlowRef = useRef<HTMLElement | null>(null);
  const [entryMode, setEntryMode] = useState<"gate" | "previewStart" | "onboarding" | "app">(
    initialPreviewMode ? (initialPreviewRoleSpecified ? "app" : "previewStart") : "gate"
  );
  const [isPreviewMode, setIsPreviewMode] = useState(initialPreviewMode);
  const [role, setRole] = useState<Role>(initialPreviewMode ? initialRole : "buyer");
  const [buyerTab, setBuyerTab] = useState<BuyerTab>("home");
  const [agentTab, setAgentTab] = useState<AgentTab>("home");
  const [agentProposalStep, setAgentProposalStep] = useState<AgentProposalStep>(0);
  const [isAgentProposalFlow, setIsAgentProposalFlow] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilter>("all");
  const [onboardingRole, setOnboardingRole] = useState<Role>("buyer");
  const [agentKind, setAgentKind] = useState<AgentKind>("representative");
  const [profileName, setProfileName] = useState("데모 사용자");
  const [profilePhone, setProfilePhone] = useState("010-0000-0000");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [officeName, setOfficeName] = useState("서구좋은공인중개사");
  const [licenseNumber, setLicenseNumber] = useState("27170-2026-00123");
  const [representativeLicenseNumber, setRepresentativeLicenseNumber] =
    useState("27170-2026-00123");
  const [agentApprovalStatus, setAgentApprovalStatus] =
    useState<AgentApprovalStatus>("approved");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState("req-101");
  const [requests, setRequests] = useState(initialRequests);
  const [proposals, setProposals] = useState(initialProposals);
  const [messages, setMessages] = useState(initialMessages);
  const [reports, setReports] = useState(initialReports);
  const [appointments, setAppointments] = useState(initialViewingAppointments);
  const [agentProperties, setAgentProperties] = useState(initialAgentFeedProperties);
  const [feedPhotoUrls, setFeedPhotoUrls] = useState<string[]>([]);
  const [feedPhotoError, setFeedPhotoError] = useState("");
  const [selectedProposalPropertyIds, setSelectedProposalPropertyIds] = useState<string[]>([]);
  const [proposalBrokerageFees, setProposalBrokerageFees] = useState<Record<string, string>>({});
  const [proposalFeeErrors, setProposalFeeErrors] = useState<Record<string, string>>({});
  const [proposalSelectionError, setProposalSelectionError] = useState("");
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [selectedComparisonIds, setSelectedComparisonIds] = useState<string[]>([]);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [comparisonNotice, setComparisonNotice] = useState("");
  const [completedPropertyIds, setCompletedPropertyIds] = useState<string[]>([]);
  const [renewalNeededPropertyIds, setRenewalNeededPropertyIds] = useState<string[]>([
    initialAgentFeedProperties[1]?.id ?? "",
  ]);
  const [notice, setNotice] = useState(
    initialPreviewMode
      ? "둘러보기 모드입니다. 실제 저장 없이 데모 데이터로 흐름을 확인합니다."
      : "BDB의 조건등록과 매물제안·비교 서비스는 무료입니다. 임대차계약 체결 시 선택한 공인중개사에게 사전에 제안받은 법정 범위 내 중개보수가 발생합니다."
  );

  const activeRequest = requests.find((request) => request.id === activeRequestId);
  const visibleProposals = proposals.filter(
    (proposal) => proposal.requestId === activeRequestId
  );
  const selectedProposal = visibleProposals[0];
  const proposalComparisonItems: ProposalComparisonItem[] = visibleProposals.flatMap((proposal) =>
    proposal.properties.map((property) => ({
      comparisonId: `${proposal.id}:${property.id}`,
      proposalId: proposal.id,
      property,
      agentId: proposal.agentId ?? proposal.agentName,
      officeId: proposal.officeId ?? proposal.officeName,
      agentName: proposal.agentName,
      officeName: proposal.officeName,
      message: proposal.message,
      createdAt: proposal.createdAt,
      sourceListingId: property.sourceListingId ?? property.id,
    }))
  );
  const selectedComparisonItems = proposalComparisonItems.filter((item) =>
    selectedComparisonIds.includes(item.comparisonId)
  );
  const selectedComparisonSourceIds = selectedComparisonItems.map(
    (item) => item.sourceListingId
  );
  const comparisonSourceIdCounts = selectedComparisonSourceIds.reduce<Record<string, number>>(
    (counts, sourceId) => ({
      ...counts,
      [sourceId]: (counts[sourceId] ?? 0) + 1,
    }),
    {}
  );
  const isSameListingComparison =
    selectedComparisonItems.length >= 2 &&
    new Set(selectedComparisonSourceIds).size === 1;
  const lowestSelectedBrokerageFee = Math.min(
    ...selectedComparisonItems.map((item) => item.property.proposedBrokerageFee)
  );
  const showBuyerDashboard = role === "buyer";
  const showAgentDashboard = role === "agent";
  const showAdminDashboard = role === "admin";
  const showBrokerReviewDashboard = role === "admin";
  const isAgentBlocked =
    !isPreviewMode && role === "agent" && agentApprovalStatus !== "approved";
  const approvalLabel =
    agentApprovalStatus === "pending_admin"
      ? "관리자 승인 대기"
      : agentApprovalStatus === "pending_representative"
        ? "대표 승인 대기"
        : agentApprovalStatus === "approved"
          ? "승인 완료"
          : "승인 필요 없음";

  useEffect(() => {
    async function loadSessionProfile() {
      if (initialPreviewMode) {
        setIsAuthenticated(false);
        setIsPreviewMode(true);
        setEntryMode(initialPreviewRoleSpecified ? "app" : "previewStart");
        setRole(initialRole);
        return;
      }

      const supabase = createClient();
      if (!supabase) return;

      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          setIsAuthenticated(false);
          return;
        }

        setIsAuthenticated(true);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name, phone")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile) {
          const metadata = user.user_metadata ?? {};
          setProfileAvatarUrl(
            String(metadata.avatar_url ?? metadata.picture ?? metadata.profile_image_url ?? "")
          );
          setProfileName(
            String(metadata.name ?? metadata.full_name ?? metadata.nickname ?? profileName)
          );
          setProfilePhone(String(metadata.phone_number ?? metadata.phone ?? profilePhone));
          setEntryMode("onboarding");
          return;
        }

        const savedRole = profile.role as Role;
        setRole(savedRole);
        setProfileName(profile.display_name ?? profileName);
        setProfilePhone(profile.phone ?? profilePhone);
        setProfileAvatarUrl(
          String(
            user.user_metadata?.avatar_url ??
              user.user_metadata?.picture ??
              user.user_metadata?.profile_image_url ??
              ""
          )
        );

        if (savedRole === "agent") {
          const { data: agentProfile } = await supabase
            .from("agent_profiles")
            .select("agent_kind, verification_status, affiliation_status")
            .eq("profile_id", user.id)
            .maybeSingle();

          if (agentProfile?.agent_kind) {
            setAgentKind(agentProfile.agent_kind as AgentKind);
          }

          if (agentProfile?.verification_status === "approved") {
            setAgentApprovalStatus("approved");
          } else if (agentProfile?.agent_kind === "affiliated") {
            setAgentApprovalStatus("pending_representative");
          } else {
            setAgentApprovalStatus("pending_admin");
          }
        }

        setIsPreviewMode(false);
        setEntryMode("app");
      } catch {
        setIsAuthenticated(false);
        setIsPreviewMode(false);
      }
    }

    loadSessionProfile();
    // Only bootstrap from the auth session once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashboardStats = useMemo(
    () => ({
      openRequests: requests.filter((request) => request.status === "open").length,
      proposalTotal: proposals.reduce(
        (total, proposal) => total + proposal.properties.length,
        0
      ),
      reportsOpen: reports.filter((report) => report.status !== "resolved").length,
      appointmentTotal: appointments.length,
      feedTotal: agentProperties.length,
      renewalNeeded: renewalNeededPropertyIds.filter(Boolean).length,
      activeProposals: proposals.filter((proposal) => proposal.status !== "hidden").length,
    }),
    [agentProperties.length, appointments.length, proposals, renewalNeededPropertyIds, reports, requests]
  );

  const filteredAgentProperties = agentProperties.filter((property) => {
    if (propertyFilter === "completed") return completedPropertyIds.includes(property.id);
    if (propertyFilter === "renewal") return renewalNeededPropertyIds.includes(property.id);
    if (propertyFilter === "active") return !completedPropertyIds.includes(property.id);
    return true;
  });
  const selectedProposalProperties = agentProperties.filter((property) =>
    selectedProposalPropertyIds.includes(property.id)
  );
  const proposalCompatibleProperties = agentProperties.filter((property) =>
    isCompatiblePropertyForRequest(property, activeRequest)
  );

  useEffect(() => {
    if (!isAgentProposalFlow) return;
    window.requestAnimationFrame(() => {
      agentProposalFlowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isAgentProposalFlow, activeRequestId]);

  async function signInWithKakao() {
    const supabase = createClient();

    if (!supabase) {
      setNotice(
        "Supabase 환경변수가 아직 없어서 실제 카카오 로그인 대신 데모 세션으로 표시합니다."
      );
      setIsPreviewMode(false);
      setEntryMode("onboarding");
      return;
    }

    window.location.href = "/auth/kakao/start";
  }

  function switchPreviewRole(nextRole: Role) {
    setRole(nextRole);
    clearComparisonSelection();
    if (nextRole === "buyer") {
      setBuyerTab("home");
    } else if (nextRole === "agent") {
      setAgentTab("home");
    }
    if (isPreviewMode) {
      window.history.replaceState(null, "", `/?preview=1&role=${nextRole}`);
    }
    setNotice(
      `둘러보기 데모: ${roleCopy[nextRole]} 화면입니다. 실제 저장 없이 데모 데이터로 흐름을 확인합니다.`
    );
  }

  function startPreviewExperience(nextRole: Role) {
    setRole(nextRole);
    setIsPreviewMode(true);
    clearComparisonSelection();
    setBuyerTab(nextRole === "buyer" ? "request" : "home");
    setAgentTab(nextRole === "agent" ? "requests" : "home");
    setEntryMode("app");
    window.history.replaceState(null, "", `/?preview=1&role=${nextRole}`);
    setNotice(
      `둘러보기 데모: ${roleCopy[nextRole]} 핵심 흐름을 확인합니다. 실제 저장 없이 데모 데이터로 진행합니다.`
    );
  }

  async function signOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    setIsAuthenticated(false);
    setIsPreviewMode(false);
    setEntryMode("gate");
    setRole("buyer");
    setBuyerTab("home");
    setAgentTab("home");
    setOnboardingRole("buyer");
    setProfileAvatarUrl("");
  }

  function createRequest(requestData: BuyerWizardSubmit) {
    const newRequestId = "req-demo-wizard";
    const newRequest: BuyerRequest = {
      id: newRequestId,
      title: requestData.title,
      buyerName: "데모 수요자",
      regions: requestData.regions,
      transactionType: requestData.transactionType,
      housingType: requestData.rooms,
      depositRange: requestData.depositRange,
      rentRange: requestData.rentRange,
      budgetSummary: requestData.budgetSummary,
      moveIn: requestData.moveIn,
      rooms: requestData.rooms,
      area: requestData.area,
      floor: requestData.floor,
      direction: requestData.direction,
      parking: requestData.parking,
      pets: requestData.pets,
      loan: requestData.loan,
      maintenanceFee: requestData.maintenanceFee,
      mustHaves: [
        ...requestData.mustHaves,
        `우선조건: ${requestData.preferredConditions.slice(0, 3).join(", ") || "없음"}`,
        `협의조건: ${requestData.negotiableConditions.join(", ") || "없음"}`,
        ...requestData.livingConditionGroups.map(
          ([label, value]) => `${label}: ${value}`
        ),
        `요청 만료일: 등록일로부터 14일`,
        requestData.allowPartialMatch ? "조건 외 제안 허용" : "필수조건 모두 충족한 매물만",
      ],
      memo: requestData.memo,
      status: "open",
      proposalCount: 0,
    };

    setRequests((current) => [
      newRequest,
      ...current.filter((request) => request.id !== newRequestId),
    ]);
    setActiveRequestId(newRequest.id);
    setNotice("조건 요청서가 생성되었습니다. 선택 지역의 인증된 공인중개사에게 14일 동안 노출됩니다.");
  }

  function resetAgentProposalDraft() {
    setIsAgentProposalFlow(false);
    setAgentProposalStep(0);
    setSelectedProposalPropertyIds([]);
    setProposalBrokerageFees({});
    setProposalFeeErrors({});
    setProposalSelectionError("");
    setIsCreatingProposal(false);
  }

  function startAgentProposal(requestId: string) {
    setActiveRequestId(requestId);
    setSelectedProposalPropertyIds([]);
    setProposalBrokerageFees({});
    setProposalFeeErrors({});
    setProposalSelectionError("");
    setAgentProposalStep(0);
    setIsAgentProposalFlow(true);
  }

  function toggleProposalProperty(property: Property) {
    if (!isCompatiblePropertyForRequest(property, activeRequest)) return;

    setSelectedProposalPropertyIds((current) =>
      current.includes(property.id)
        ? current.filter((id) => id !== property.id)
        : [...current, property.id]
    );
    setProposalSelectionError("");
  }

  function getProposalBrokerageFeeError(property: Property, rawValue?: string) {
    const value = Number(rawValue ?? "");

    if (!rawValue) return "제안 중개보수를 입력해주세요.";
    if (!Number.isFinite(value)) return "숫자만 입력해주세요.";
    if (value <= 0) return "0원보다 큰 금액을 입력해주세요.";
    if (value > property.legalMaxBrokerageFee) {
      return `법정 최대 중개보수 ${formatWon(property.legalMaxBrokerageFee)}을 초과할 수 없습니다.`;
    }

    return "";
  }

  function updateProposalBrokerageFee(property: Property, value: string) {
    const valueWithoutFormatting = value.replace(/[,\s원]/g, "");
    const hasNegativeSign = valueWithoutFormatting.includes("-");
    const hasInvalidCharacters = Boolean(valueWithoutFormatting) && !/^\d+$/.test(valueWithoutFormatting);
    const numericOnly = hasNegativeSign ? "" : value.replace(/[^\d]/g, "");
    const nextError = hasNegativeSign
      ? "0원보다 큰 금액을 입력해주세요."
      : hasInvalidCharacters
      ? "숫자만 입력해주세요."
      : getProposalBrokerageFeeError(property, numericOnly);

    setProposalBrokerageFees((current) => ({
      ...current,
      [property.id]: numericOnly,
    }));
    setProposalFeeErrors((current) => {
      const next = { ...current };
      if (nextError) {
        next[property.id] = nextError;
      } else {
        delete next[property.id];
      }
      return next;
    });
  }

  function validateProposalBrokerageFees() {
    const nextErrors: Record<string, string> = {};

    selectedProposalProperties.forEach((property) => {
      const rawValue = proposalBrokerageFees[property.id];
      const error = getProposalBrokerageFeeError(property, rawValue);

      if (error) nextErrors[property.id] = error;
    });

    setProposalFeeErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function isProposalBrokerageDraftValid() {
    return (
      selectedProposalProperties.length > 0 &&
      selectedProposalProperties.every((property) => {
        const rawValue = proposalBrokerageFees[property.id];
        return !proposalFeeErrors[property.id] && !getProposalBrokerageFeeError(property, rawValue);
      })
    );
  }

  function goNextAgentProposalStep() {
    if (agentProposalStep === 1 && selectedProposalPropertyIds.length === 0) {
      setProposalSelectionError("제안할 매물을 1개 이상 선택해주세요.");
      return;
    }

    if (agentProposalStep === 2 && !validateProposalBrokerageFees()) {
      return;
    }

    setAgentProposalStep((current) => Math.min(3, current + 1) as AgentProposalStep);
  }

  function toggleComparisonItem(comparisonId: string) {
    setSelectedComparisonIds((current) => {
      if (current.includes(comparisonId)) {
        setComparisonNotice("");
        return current.filter((id) => id !== comparisonId);
      }

      if (current.length >= 3) {
        setComparisonNotice("최대 3개까지 비교할 수 있습니다.");
        return current;
      }

      setComparisonNotice("");
      return [...current, comparisonId];
    });
  }

  function clearComparisonSelection() {
    setSelectedComparisonIds([]);
    setIsComparisonMode(false);
    setComparisonNotice("");
  }

  function openComparisonMode() {
    if (selectedComparisonIds.length < 2) {
      setComparisonNotice("2개 이상 선택해주세요.");
      return;
    }

    setIsComparisonMode(true);
    setComparisonNotice("");
  }

  function createProposal() {
    const request = activeRequest;
    if (!request) return;
    if (isCreatingProposal) return;

    if (isAgentBlocked) {
      setNotice("승인 대기 중인 공인중개사는 매물 제안을 보낼 수 없습니다.");
      return;
    }

    if (selectedProposalProperties.length === 0) {
      setAgentProposalStep(1);
      setProposalSelectionError("제안할 매물을 1개 이상 선택해주세요.");
      return;
    }

    if (!validateProposalBrokerageFees()) {
      setAgentProposalStep(2);
      return;
    }

    setIsCreatingProposal(true);
    const newProposalId = `prop-${proposals.length + 501}`;
    const proposal: Proposal = {
      id: newProposalId,
      requestId: request.id,
      agentName: "김도윤 중개사",
      officeName: "동네좋은공인중개사",
      message: `예산과 필수 조건을 기준으로 바로 방문 가능한 매물 ${selectedProposalProperties.length}곳을 묶었습니다.`,
      createdAt: "방금",
      status: "new",
      properties: selectedProposalProperties.map((property) => {
        const calculation = calculateHousingLeaseBrokerageFee({
          deposit: property.deposit,
          monthlyRent: property.monthlyRent,
        });

        return {
          ...property,
          id: `${newProposalId}-${property.id}`,
          legalMaxBrokerageFee: calculation.legalMaxFee,
          proposedBrokerageFee: Number(proposalBrokerageFees[property.id]),
          brokerageRateLabel: calculation.rule.label,
          brokerageFormulaLabel: calculation.formulaLabel,
          brokerageRuleId: calculation.rule.id,
          brokerageSourceUrl: calculation.rule.sourceUrl,
        };
      }),
    };

    setProposals((current) => [proposal, ...current]);
    setRequests((current) =>
      current.map((item) =>
        item.id === request.id
          ? { ...item, proposalCount: item.proposalCount + 1, status: "matched" }
          : item
      )
    );
    setNotice("중개사 제안 묶음이 생성되었습니다.");
    setSelectedProposalPropertyIds([]);
    setProposalBrokerageFees({});
    setProposalFeeErrors({});
    setProposalSelectionError("");
    setIsCreatingProposal(false);
    setAgentTab("sent");
    setAgentProposalStep(0);
    setIsAgentProposalFlow(false);
  }

  function handleFeedPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 6);

    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      setFeedPhotoError("매물 사진은 이미지 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    const oversizedFile = files.find((file) => file.size > 3 * 1024 * 1024);
    if (oversizedFile) {
      setFeedPhotoError("매물 사진은 파일당 3MB 이하로 업로드해주세요.");
      event.target.value = "";
      return;
    }

    const urls = files.map((file) => URL.createObjectURL(file));
    setFeedPhotoError("");
    setFeedPhotoUrls(urls);
    setNotice(`${files.length}장의 피드 매물 사진이 준비되었습니다.`);
  }

  function publishFeedProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAgentBlocked) {
      setNotice("승인 대기 중인 공인중개사는 매물 피드를 등록할 수 없습니다.");
      return;
    }

    if (feedPhotoUrls.length === 0) {
      setNotice("피드 매물도 사진을 1장 이상 올려야 등록할 수 있습니다.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const deposit = Number(form.get("deposit") || 30_000_000);
    const monthlyRent = Number(form.get("monthlyRent") || 1_200_000);
    const calculation = calculateHousingLeaseBrokerageFee({ deposit, monthlyRent });
    const proposedBrokerageFee = Number(form.get("proposedBrokerageFee") || 90_000);

    if (proposedBrokerageFee > calculation.legalMaxFee) {
      setNotice("피드 매물의 제안 중개보수는 자동 계산된 법정 최대보수 이하로 입력해야 합니다.");
      return;
    }

    const property = {
      id: `feed-home-${agentProperties.length + 1}`,
      title: String(form.get("title") || "새 피드 매물"),
      addressLabel: String(form.get("addressLabel") || "동네 근처"),
      photoUrls: feedPhotoUrls,
      deposit,
      monthlyRent,
      price: String(form.get("price") || "가격 협의"),
      maintenanceFee: String(form.get("maintenanceFee") || "관리비 확인 필요"),
      area: String(form.get("area") || "면적 확인 필요"),
      floor: String(form.get("floor") || "층수 확인 필요"),
      features: String(form.get("features") || "사진 등록, 무료 피드")
        .split(",")
        .map((feature) => feature.trim())
        .filter(Boolean),
      roughLat: 35.8606,
      roughLng: 128.5518,
      legalMaxBrokerageFee: calculation.legalMaxFee,
      proposedBrokerageFee: clampProposedBrokerageFee(
        proposedBrokerageFee,
        calculation.legalMaxFee
      ),
      brokerageRateLabel: calculation.rule.label,
      brokerageFormulaLabel: calculation.formulaLabel,
      brokerageRuleId: calculation.rule.id,
      brokerageSourceUrl: calculation.rule.sourceUrl,
      note: "둘러보기용 예시 데이터입니다. 중개사 피드에 무료 등록된 매물입니다.",
    };

    setAgentProperties((current) => [property, ...current]);
    setFeedPhotoUrls([]);
    setFeedPhotoError("");
    setPropertyFilter("active");
    setNotice(
      "매물이 사무소 피드에 무료 등록되었습니다. BDB 플랫폼 이용료는 이 앱을 통해 계약이 성사될 때만 발생합니다."
    );
    event.currentTarget.reset();
  }

  function sendMessage() {
    if (!selectedProposal) return;

    if (isAgentBlocked) {
      setNotice("승인 대기 중인 공인중개사는 채팅을 시작할 수 없습니다.");
      return;
    }

    const newMessage: Message = {
      id: `msg-${messages.length + 1}`,
      roomId: selectedProposal.id,
      sender: role === "agent" ? "agent" : "buyer",
      body:
        role === "agent"
          ? "방문 가능 시간을 알려주시면 동선을 정리해드릴게요."
          : "제안 감사합니다. 첫 번째 매물의 관리비 포함 항목을 알고 싶어요.",
      createdAt: "방금",
    };
    setMessages((current) => [...current, newMessage]);
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === selectedProposal.id ? { ...proposal, status: "chatting" } : proposal
      )
    );
  }

  function addReport(target: string) {
    const report: Report = {
      id: `report-${reports.length + 1}`,
      target,
      reason: "데모 신고: 허위 또는 부적절한 정보 확인 요청",
      status: "open",
    };
    setReports((current) => [report, ...current]);
    setNotice("신고가 관리자 검토 목록에 추가되었습니다.");
  }

  function requestViewing(proposal: Proposal) {
    if (isAgentBlocked) {
      setNotice("승인 대기 중인 공인중개사는 방문 안내를 진행할 수 없습니다.");
      return;
    }

    const appointment: ViewingAppointment = {
      id: `view-${appointments.length + 1}`,
      proposalId: proposal.id,
      buyerName: activeRequest?.buyerName ?? "데모 수요자",
      agentName: proposal.agentName,
      scheduledFor: "방문 시간 조율 중",
      viewingFee: 0,
      status: "requested",
    };

    setAppointments((current) => [appointment, ...current]);
    setNotice(
      "방문예약이 생성되었습니다. BDB의 방문예약은 무료이며, 계약 체결 시에는 사전에 제안받은 중개보수가 발생합니다."
    );
  }

  function resolveReport(reportId: string) {
    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? { ...report, status: "resolved" } : report
      )
    );
  }

  function hideProposal(proposalId: string) {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, status: "hidden" } : proposal
      )
    );
  }

  async function completeOnboarding(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (isSavingProfile) return;

    setIsSavingProfile(true);

    const supabase = createClient();
    if (supabase && onboardingRole !== "admin") {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (user) {
        setIsAuthenticated(true);
        const metadata = user.user_metadata ?? {};
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: user.id,
          role: onboardingRole,
          display_name: profileName,
          phone: profilePhone,
          kakao_subject: user.identities?.[0]?.identity_data?.sub ?? user.id,
          kakao_email: user.email ?? metadata.email ?? null,
          kakao_phone: metadata.phone_number ?? metadata.phone ?? profilePhone,
        });

        if (profileError) {
          setNotice(`프로필 저장 실패: ${profileError.message}`);
          setIsSavingProfile(false);
          return;
        }

        if (onboardingRole === "agent") {
          let representativeProfileId: string | null = null;

          if (agentKind === "affiliated") {
            const { data: representative, error: representativeError } = await supabase
              .from("agent_profiles")
              .select("profile_id")
              .eq("license_number", representativeLicenseNumber)
              .eq("agent_kind", "representative")
              .eq("verification_status", "approved")
              .maybeSingle();

            if (representativeError) {
              setNotice(`대표 공인중개사 조회 실패: ${representativeError.message}`);
              setIsSavingProfile(false);
              return;
            }

            if (!representative) {
              setNotice("승인된 대표 공인중개사를 찾지 못했습니다. 등록번호를 확인해 주세요.");
              setIsSavingProfile(false);
              return;
            }

            representativeProfileId = representative.profile_id;
          }

          const { error: agentError } = await supabase.from("agent_profiles").upsert({
            profile_id: user.id,
            agent_kind: agentKind,
            representative_profile_id: representativeProfileId,
            affiliation_status: agentKind === "affiliated" ? "pending" : "none",
            office_name: officeName,
            representative_name: profileName,
            license_number: licenseNumber,
            service_regions: ["대구광역시 서구"],
            verification_status: "pending",
          });

          if (agentError) {
            setNotice(`공인중개사 프로필 저장 실패: ${agentError.message}`);
            setIsSavingProfile(false);
            return;
          }

          if (agentKind === "affiliated" && representativeProfileId) {
            const { error: affiliationError } = await supabase
              .from("agent_affiliation_requests")
              .upsert({
                affiliated_profile_id: user.id,
                representative_profile_id: representativeProfileId,
                office_name: officeName,
                affiliated_license_number: licenseNumber,
                status: "pending",
              });

            if (affiliationError) {
              setNotice(`소속 승인 요청 저장 실패: ${affiliationError.message}`);
              setIsSavingProfile(false);
              return;
            }
          }
        }
      }
    }

    setRole(onboardingRole);
    setIsPreviewMode(false);
    setAgentApprovalStatus(
      onboardingRole !== "agent"
        ? "none"
        : agentKind === "representative"
          ? "pending_admin"
          : "pending_representative"
    );
    setNotice(
      onboardingRole === "agent"
        ? agentKind === "representative"
          ? "대표 공인중개사 프로필이 생성되었습니다. 관리자 승인 전에는 제안/채팅/방문 안내 기능이 제한됩니다."
          : "소속 공인중개사 가입 신청이 생성되었습니다. 대표 공인중개사의 승인 전에는 제안/채팅/방문 안내 기능이 제한됩니다."
        : onboardingRole === "admin"
          ? "관리자 데모 세션으로 진입했습니다. 중개사 승인과 신고 처리를 확인할 수 있습니다."
          : "수요자 프로필이 생성되었습니다. 요청서를 작성하고 제안을 비교할 수 있습니다."
    );
    setIsSavingProfile(false);
    setEntryMode("app");
  }

  if (entryMode === "gate") {
    const previewHomes = initialAgentFeedProperties.slice(0, 2);

    return (
      <main className="app-shell bg-[#F7F5EF] px-4 py-4 text-[#1D2723] sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-10">
          <header className="flex min-h-16 flex-col gap-4 rounded-2xl border border-[#DEE4E0] bg-white/88 px-4 py-4 soft-shadow sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFD84D] text-[#183F35]">
                <Home size={23} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold tracking-[0]">복덕방 BDB</p>
                <p className="text-xs font-semibold text-[#69736F]">대구 원룸·투룸 전월세 역매칭</p>
              </div>
            </div>
            <nav aria-label="랜딩 페이지 섹션" className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#356556]">
              <a href="#service" className="min-h-11 rounded-xl px-3 py-3 hover:bg-[#EAF2EE]">
                서비스 소개
              </a>
              <a href="#how-it-works" className="min-h-11 rounded-xl px-3 py-3 hover:bg-[#EAF2EE]">
                이용 방법
              </a>
              <a href="#trust" className="min-h-11 rounded-xl px-3 py-3 hover:bg-[#EAF2EE]">
                신뢰 장치
              </a>
            </nav>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex">
              <button
                onClick={signInWithKakao}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-4 py-3 text-sm font-extrabold text-[#183F35] transition hover:bg-[#f2c936]"
              >
                <KeyRound size={18} aria-hidden="true" />
                카카오로 시작하기
              </button>
              <Link
                href="/?preview=1"
                onClick={() => {
                  setRole("buyer");
                  setIsPreviewMode(true);
                  setNotice("둘러보기 모드입니다. 실제 저장 없이 데모 데이터로 흐름을 확인합니다.");
                  setEntryMode("app");
                }}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#356556] bg-white px-4 py-3 text-sm font-extrabold text-[#183F35] transition hover:bg-[#EAF2EE]"
              >
                <Search size={18} aria-hidden="true" />
                둘러보기
              </Link>
            </div>
          </header>

          <section
            id="service"
            className="grid items-center gap-8 py-6 lg:grid-cols-[minmax(0,0.59fr)_minmax(360px,0.41fr)] lg:py-12"
          >
            <div className="min-w-0">
              <p className="inline-flex min-h-9 items-center rounded-full border border-[#DEE4E0] bg-white px-3 text-sm font-extrabold text-[#356556]">
                디지털 복덕방, BDB
              </p>
              <h1 className="text-balance mt-5 max-w-3xl text-[32px] font-extrabold leading-[40px] tracking-[0] text-[#1D2723] sm:text-[44px] sm:leading-[52px] lg:text-[48px] lg:leading-[56px]">
                방을 찾지 말고, 원하는 조건만 등록하세요
              </h1>
              <p className="mt-5 max-w-2xl text-base font-medium leading-[26px] text-[#69736F]">
                대구 원룸·투룸을 찾는 사용자가 원하는 조건을 등록하면, 자격과 소속이 확인된
                공인중개사가 실제 사진이 있는 매물과 법정 상한 내 중개보수를 제안합니다.
                마음에 드는 집과 공인중개사를 비교하고 방문하세요.
              </p>
              <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                <button
                  onClick={signInWithKakao}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#f2c936]"
                >
                  <KeyRound size={19} aria-hidden="true" />
                  카카오로 조건 등록하기
                </button>
                <Link
                  href="/?preview=1"
                  onClick={() => {
                    setRole("buyer");
                    setIsPreviewMode(true);
                    setNotice("둘러보기 모드입니다. 실제 저장 없이 데모 데이터로 흐름을 확인합니다.");
                    setEntryMode("app");
                  }}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#356556] bg-white px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#EAF2EE]"
                >
                  <Search size={19} aria-hidden="true" />
                  로그인 없이 둘러보기
                </Link>
              </div>
              <p className="mt-5 max-w-2xl rounded-2xl border border-[#DEE4E0] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#69736F]">
                BDB의 조건등록과 매물제안·비교 서비스는 무료입니다. 임대차계약 체결 시
                선택한 공인중개사에게 사전에 제안받은 법정 범위 내 중개보수가 발생합니다.
              </p>
            </div>

            <aside className="min-w-0 rounded-[24px] border border-[#DEE4E0] bg-white p-4 soft-shadow sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-[#356556]">예시 화면</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-[0] text-[#1D2723]">
                    조건에 맞는 제안 비교
                  </h2>
                </div>
                <span className="rounded-full bg-[#EAF2EE] px-3 py-1 text-xs font-extrabold text-[#183F35]">
                  둘러보기
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFD84D] text-[#183F35]">
                    <MapPin size={19} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-[#1D2723]">
                      대구 서구 평리동 · 월세 · 반려동물 가능 · 주차 필요
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-[#69736F]">
                      둘러보기용 예시 데이터입니다. 정확한 주소 대신 동네와 대략 위치만 보여줍니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {previewHomes.map((property, index) => (
                  <article
                    key={property.id}
                    className="grid min-w-0 gap-3 rounded-2xl border border-[#DEE4E0] bg-white p-3 sm:grid-cols-[112px_minmax(0,1fr)]"
                  >
                    <PhotoTile
                      src={property.photoUrls[0]}
                      label={`${property.title} 예시 사진`}
                      className="min-h-28 rounded-xl border-[#DEE4E0]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#DEE4E0] bg-[#EAF2EE] px-2.5 py-1 text-xs font-extrabold text-[#183F35]">
                          <Check size={13} aria-hidden="true" />
                          인증 중개사
                        </span>
                        <span className="text-xs font-bold text-[#69736F]">제안 {index + 1}</span>
                      </div>
                      <h3 className="mt-2 font-extrabold text-[#1D2723]">{property.title}</h3>
                      <p className="mt-1 text-sm font-semibold text-[#356556]">{property.price}</p>
                      <p className="mt-1 text-sm text-[#69736F]">
                        {property.maintenanceFee} · {property.area} · {property.floor}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                        {property.features.slice(0, 2).map((feature) => (
                          <span key={feature} className="rounded-full bg-[#F7F5EF] px-2.5 py-1 text-[#69736F]">
                            {feature}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 inline-flex items-center gap-1 text-sm font-extrabold text-[#183F35]">
                        <ReceiptText size={16} aria-hidden="true" />
                        제안 중개보수 {formatter.format(property.proposedBrokerageFee)}원
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </section>

          <section id="how-it-works" className="grid gap-4 md:grid-cols-3">
            {[
              [
                "1",
                "원하는 조건 등록",
                "지역, 예산, 반려동물, 주차처럼 방을 고를 때 중요한 조건을 먼저 정리합니다.",
              ],
              [
                "2",
                "매물과 중개보수 비교",
                "인증된 공인중개사가 실제 매물사진과 제안 중개보수를 함께 보냅니다.",
              ],
              [
                "3",
                "마음에 드는 집만 방문 예약",
                "제안을 비교한 뒤 실제로 보고 싶은 집만 골라 무료로 방문 일정을 잡습니다.",
              ],
            ].map(([step, title, description]) => (
              <article key={title} className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow">
                <p className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFD84D] text-sm font-extrabold text-[#183F35]">
                  {step}
                </p>
                <h2 className="mt-4 text-xl font-extrabold tracking-[0] text-[#1D2723]">{title}</h2>
                <p className="mt-2 text-sm font-medium leading-6 text-[#69736F]">{description}</p>
              </article>
            ))}
          </section>

          <section id="trust" className="rounded-[24px] border border-[#DEE4E0] bg-[#183F35] p-5 text-white soft-shadow sm:p-7">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-extrabold text-[#FFD84D]">신뢰 장치</p>
                <h2 className="text-balance mt-2 text-[28px] font-extrabold leading-9 tracking-[0]">
                  비교는 가볍게, 거래 기준은 분명하게
                </h2>
              </div>
              <p className="max-w-xl text-sm font-medium leading-6 text-white/78">
                임차인의 무료 이용과 공인중개사의 인증, 실제 사진, 법정 상한 내 중개보수 제안을
                한 화면에서 확인할 수 있도록 설계했습니다.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                "임차인 플랫폼 이용료 0원",
                "공인중개사 자격 및 중개사무소 인증",
                "실제 매물사진 필수",
                "법정 상한 내 중개보수 제안",
              ].map((item) => (
                <div key={item} className="flex min-h-20 items-start gap-3 rounded-2xl border border-white/12 bg-white/8 p-4">
                  <Check className="mt-0.5 shrink-0 text-[#FFD84D]" size={18} aria-hidden="true" />
                  <p className="text-sm font-extrabold leading-6">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 pb-8 lg:grid-cols-2">
            {[
              [
                "공인중개사 안내",
                "보유매물을 무료로 등록하고 실제로 집을 찾는 고객에게 조건에 맞는 매물과 중개보수를 제안합니다. BDB를 통한 계약 성사 시에만 성과형 플랫폼 이용료가 발생합니다.",
              ],
              [
                "관리자 안내",
                "공인중개사와 중개사무소 인증, 신고처리, 허위매물 관리 및 법정 중개보수 상한요율 관리를 담당합니다.",
              ],
            ].map(([title, description]) => (
              <article
                key={title}
                className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow"
              >
                <p className="text-sm font-extrabold text-[#356556]">{title}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[#69736F]">{description}</p>
              </article>
            ))}
          </section>
        </div>
      </main>
    );
  }

  if (entryMode === "previewStart") {
    return (
      <main className="app-shell bg-[#F7F5EF] px-4 py-5 text-[#1D2723] sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-2xl border border-[#DEE4E0] bg-white px-4 py-4 soft-shadow sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFD84D] text-[#183F35]">
                <Home size={23} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-extrabold tracking-[0]">복덕방 BDB</p>
                  <span className="rounded-full border border-[#e4d7bb] bg-[#fff8db] px-2.5 py-1 text-xs font-bold text-[#6b5a16]">
                    둘러보기 데모
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#69736F]">대구 원룸·투룸 전월세 역매칭</p>
              </div>
            </div>
            <button
              type="button"
              onClick={signInWithKakao}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-extrabold text-[#183F35]"
            >
              <KeyRound size={17} aria-hidden="true" />
              카카오 로그인
            </button>
          </header>

          <section className="grid items-center gap-6 rounded-[24px] border border-[#DEE4E0] bg-white p-5 soft-shadow sm:p-7 lg:grid-cols-[minmax(0,0.56fr)_minmax(320px,0.44fr)]">
            <div className="min-w-0">
              <p className="inline-flex min-h-9 items-center rounded-full border border-[#DEE4E0] bg-[#EAF2EE] px-3 text-sm font-extrabold text-[#183F35]">
                디지털 복덕방, BDB
              </p>
              <h1 className="text-balance mt-4 text-[32px] font-extrabold leading-[40px] tracking-[0] text-[#1D2723] sm:text-[44px] sm:leading-[52px]">
                원하는 집을 올리면, 동네 공인중개사가 먼저 제안합니다
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-[#69736F]">
                수많은 매물을 직접 검색하는 대신 원하는 지역·예산·생활조건을 등록하세요.
                인증된 공인중개사가 조건에 맞는 실제 매물과 제안 중개보수를 보내드립니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["임차인 이용 무료", "공인중개사 인증", "매물·중개보수 비교"].map((item) => (
                  <span
                    key={item}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#DEE4E0] bg-white px-3 text-sm font-extrabold text-[#356556]"
                  >
                    <Check size={15} aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4">
              <div className="rounded-2xl border border-[#DEE4E0] bg-white p-4">
                <p className="text-xs font-extrabold text-[#69736F]">기존 플랫폼</p>
                <p className="mt-2 text-lg font-extrabold text-[#1D2723]">
                  등록된 매물을 고객이 직접 검색
                </p>
              </div>
              <div className="rounded-2xl border border-[#183F35] bg-[#EAF2EE] p-4">
                <p className="text-xs font-extrabold text-[#356556]">BDB</p>
                <p className="mt-2 text-lg font-extrabold text-[#183F35]">
                  고객의 조건에 맞춰 공인중개사가 매물을 역제안
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-[24px] border border-[#183F35] bg-white p-5 soft-shadow sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[#356556]">수요자 체험</p>
                  <h2 className="mt-2 text-2xl font-extrabold text-[#1D2723]">집을 찾고 있어요</h2>
                </div>
                <span className="rounded-full bg-[#FFD84D] px-3 py-1 text-xs font-extrabold text-[#183F35]">
                  추천
                </span>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-[#69736F]">
                원하는 집의 조건을 등록하고 여러 공인중개사의 매물과 중개보수를 비교합니다.
              </p>
              <p className="mt-4 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] px-4 py-3 text-xs font-extrabold leading-5 text-[#356556]">
                조건 등록 → 공인중개사 제안 확인 → 매물·중개보수 비교 → 무료 방문 예약
              </p>
              <button
                type="button"
                onClick={() => startPreviewExperience("buyer")}
                className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#f2c936]"
              >
                수요자 체험 시작
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </article>

            <article className="rounded-[24px] border border-[#DEE4E0] bg-white p-5 soft-shadow sm:p-6">
              <div>
                <p className="text-sm font-extrabold text-[#356556]">공인중개사 체험</p>
                <h2 className="mt-2 text-2xl font-extrabold text-[#1D2723]">고객에게 매물을 제안할게요</h2>
              </div>
              <p className="mt-3 text-sm font-medium leading-6 text-[#69736F]">
                실제 고객의 조건을 확인하고 보유 매물과 중개보수를 제안합니다.
              </p>
              <p className="mt-4 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] px-4 py-3 text-xs font-extrabold leading-5 text-[#356556]">
                고객 조건 확인 → 보유 매물 선택 → 중개보수 제안 → 상담·방문 연결
              </p>
              <button
                type="button"
                onClick={() => startPreviewExperience("agent")}
                className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-[#356556] bg-white px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#EAF2EE]"
              >
                공인중개사 체험 시작
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </article>
          </section>

          <footer className="flex flex-col gap-3 pb-4 text-sm font-semibold text-[#69736F] sm:flex-row sm:items-center sm:justify-between">
            <p>BDB는 동네 부동산의 친근한 이름인 ‘복덕방’에서 시작한 서비스명입니다.</p>
            <button
              type="button"
              onClick={() => startPreviewExperience("admin")}
              className="inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-sm font-extrabold text-[#356556] hover:bg-[#EAF2EE]"
            >
              관리자 화면 둘러보기
            </button>
          </footer>
        </div>
      </main>
    );
  }

  if (entryMode === "onboarding") {
    return (
      <main className="app-shell flex items-center justify-center px-4 py-6 text-[#20251f] sm:px-6 lg:px-8">
        <section className="w-full max-w-4xl rounded-lg border border-[#d9d0c0] bg-white/95 p-6 soft-shadow sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#54715b]">BDB 온보딩</p>
              <h1 className="text-3xl font-bold leading-tight">어떤 역할로 시작할까요?</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#586155]">
                실제 서비스에서는 카카오 로그인에서 받은 이름/연락처를 우선 채우고,
                부족한 정보는 이 화면에서 보완합니다. 대표 공인중개사는 관리자 승인,
                소속 공인중개사는 대표 승인 후 제안 기능을 사용할 수 있습니다.
              </p>
            </div>
            <button
              onClick={() => setEntryMode("gate")}
              className="min-h-10 rounded-lg border border-[#d9d0c0] px-3 text-sm font-bold"
            >
              이전
            </button>
          </div>

          <form onSubmit={completeOnboarding} className="mt-6 grid gap-5">
            {notice ? (
              <p className="rounded-lg border border-[#d9d0c0] bg-[#fbfaf6] px-4 py-3 text-sm font-semibold text-[#4f5a4d]">
                {notice}
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              {(["buyer", "agent", "admin"] as Role[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setOnboardingRole(item)}
                  className={`rounded-lg border p-4 text-left transition ${
                    onboardingRole === item
                      ? "border-[#2f6f45] bg-[#edf6ef]"
                      : "border-[#d9d0c0] bg-white hover:bg-[#fbfaf6]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{roleCopy[item]}</p>
                    {item === "buyer" ? (
                      <UserRound size={20} aria-hidden="true" />
                    ) : item === "agent" ? (
                      <BadgeCheck size={20} aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={20} aria-hidden="true" />
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#677064]">
                    {roleDescriptions[item]}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 rounded-lg border border-[#d9d0c0] bg-[#fbfaf6] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                표시 이름
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 text-[#20251f]"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                연락처
                <input
                  value={profilePhone}
                  onChange={(event) => setProfilePhone(event.target.value)}
                  className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 text-[#20251f]"
                />
              </label>

              {onboardingRole === "agent" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2 sm:col-span-2">
                    <p className="text-sm font-semibold text-[#4f5a4d]">가입 유형</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(["representative", "affiliated"] as AgentKind[]).map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setAgentKind(item)}
                          className={`rounded-lg border p-4 text-left transition ${
                            agentKind === item
                              ? "border-[#2f6f45] bg-[#edf6ef]"
                              : "border-[#d9d0c0] bg-white"
                          }`}
                        >
                          <p className="font-bold">{agentKindCopy[item]}</p>
                          <p className="mt-2 text-sm leading-6 text-[#677064]">
                            {item === "representative"
                              ? "사무소 대표로 가입하고 관리자의 승인을 받습니다."
                              : "이미 등록된 대표 공인중개사에게 소속 승인을 요청합니다."}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                    사무소명
                    <input
                      value={officeName}
                      onChange={(event) => setOfficeName(event.target.value)}
                      className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 text-[#20251f]"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d]">
                    {agentKind === "representative" ? "대표 중개사 등록번호" : "내 중개사 등록번호"}
                    <input
                      value={licenseNumber}
                      onChange={(event) => setLicenseNumber(event.target.value)}
                      className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 text-[#20251f]"
                    />
                  </label>
                  {agentKind === "affiliated" ? (
                    <label className="grid gap-2 text-sm font-semibold text-[#4f5a4d] sm:col-span-2">
                      승인 요청할 대표 중개사 등록번호
                      <input
                        value={representativeLicenseNumber}
                        onChange={(event) =>
                          setRepresentativeLicenseNumber(event.target.value)
                        }
                        className="min-h-11 rounded-lg border border-[#d9d0c0] bg-white px-3 text-[#20251f]"
                      />
                    </label>
                  ) : null}
                  <label className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#b9c7b4] bg-[#edf6ef] p-4 text-center text-sm font-semibold text-[#33523a] sm:col-span-2">
                    <Upload size={22} aria-hidden="true" />
                    {agentKind === "representative"
                      ? "중개사무소 등록증 업로드"
                      : "소속 공인중개사 확인 서류 업로드"}
                    <input type="file" className="sr-only" />
                  </label>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => completeOnboarding()}
              disabled={isSavingProfile}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-4 py-3 font-bold text-white transition hover:bg-[#265b39] disabled:bg-[#9ba397]"
            >
              {isSavingProfile ? "저장 중" : `${roleCopy[onboardingRole]}로 시작하기`}
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell px-4 py-5 text-[#20251f] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[#d9d0c0] bg-white/90 px-4 py-4 soft-shadow lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#ffe24a] text-[#20251f]">
              <Home size={25} aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#54715b]">복덕방 BDB</p>
                {isPreviewMode ? (
                  <span className="rounded-full border border-[#e4d7bb] bg-[#fff8db] px-2.5 py-1 text-xs font-bold text-[#6b5a16]">
                    둘러보기 데모
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold text-[#20251f] sm:text-3xl">
                조건을 올리면, 동네 중개사가 제안합니다
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAuthenticated ? (
              <div className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d9d0c0] bg-[#f7f4ee] px-3 py-2">
                {profileAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileAvatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2f6f45] text-white">
                    <UserRound size={17} aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#20251f]">{profileName}</p>
                  <p className="text-xs font-semibold text-[#54715b]">{roleCopy[role]}</p>
                </div>
                <button
                  onClick={signOut}
                  className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-[#677064] transition hover:bg-white hover:text-[#20251f]"
                  title="로그아웃"
                  aria-label="로그아웃"
                >
                  <LogOut size={16} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <button
              onClick={signInWithKakao}
              className={`${isAuthenticated ? "hidden" : "inline-flex"} min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fee500] px-4 py-2 text-sm font-bold text-[#20251f] transition hover:bg-[#f4db00]`}
            >
              <KeyRound size={17} aria-hidden="true" />
              카카오 로그인
            </button>
            {isPreviewMode ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-[#677064]">둘러보기 역할 전환</p>
                <div className="flex flex-wrap gap-1 rounded-lg border border-[#d9d0c0] bg-[#f7f4ee] p-1">
                  {(["buyer", "agent", "admin"] as Role[]).map((item) => (
                    <Link
                      key={item}
                      href={`/?preview=1&role=${item}`}
                      role="button"
                      aria-pressed={role === item}
                      onClick={(event) => {
                        event.preventDefault();
                        switchPreviewRole(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          switchPreviewRole(item);
                        }
                      }}
                      className={`min-h-10 rounded-md border px-3 text-sm font-semibold transition ${
                        role === item
                          ? "border-[#203927] bg-[#2f6f45] text-white shadow-sm"
                          : "border-transparent text-[#4f5a4d] hover:border-[#d9d0c0] hover:bg-white"
                      }`}
                    >
                      {roleCopy[item]}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-lg border border-[#d9d0c0] bg-[#f7f4ee] px-3 text-sm font-bold text-[#2f6f45]">
                {roleCopy[role]} 대시보드
              </span>
            )}
          </div>
        </header>

        {showBuyerDashboard ? (
          <section className="grid gap-4">
            <div className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-8 items-center rounded-full bg-[#EAF2EE] px-3 text-xs font-extrabold text-[#183F35]">
                      수요자 모드
                    </span>
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-[#DEE4E0] bg-white px-3 text-xs font-extrabold text-[#356556]">
                      <BadgeCheck size={14} aria-hidden="true" />
                      인증 공인중개사 제안
                    </span>
                  </div>
                  <h2 className="text-balance mt-4 text-[28px] font-extrabold leading-9 tracking-[0] text-[#1D2723] sm:text-[36px] sm:leading-[44px]">
                    원하는 집의 조건을 알려주세요
                  </h2>
                  <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[#69736F]">
                    조건을 등록하면 인증된 공인중개사가 실제 매물과 제안 중개보수를 보내드립니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBuyerTab("request")}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#f2c936]"
                >
                  <Plus size={19} aria-hidden="true" />
                  {activeRequest ? "조건 수정하기" : "조건 등록하기"}
                </button>
              </div>

              {notice ? (
                <p className="mt-4 rounded-xl border border-[#DEE4E0] bg-[#F7F5EF] px-4 py-3 text-sm font-semibold leading-6 text-[#69736F]">
                  {notice}
                </p>
              ) : null}
            </div>

            <nav
              aria-label="수요자 메뉴"
              className="sticky top-2 z-20 -mx-4 border-y border-[#DEE4E0] bg-[#F7F5EF]/96 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:soft-shadow"
            >
              <div className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap sm:gap-2">
                {([
                  ["home", "홈"],
                  ["request", "조건 등록"],
                  ["proposals", "받은 제안"],
                  ["chat", "채팅"],
                  ["appointments", "방문 예약"],
                ] as Array<[BuyerTab, string]>).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setBuyerTab(tab);
                      if (tab !== "proposals") {
                        clearComparisonSelection();
                      }
                    }}
                    aria-pressed={buyerTab === tab}
                    className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 text-xs font-extrabold transition sm:px-4 sm:text-sm ${
                      buyerTab === tab
                        ? "border-[#183F35] bg-[#EAF2EE] text-[#183F35] shadow-sm"
                        : "border-transparent bg-transparent text-[#69736F] hover:border-[#DEE4E0] hover:bg-white"
                    }`}
                  >
                    {buyerTab === tab ? <Check size={15} className="mr-1 hidden sm:block" aria-hidden="true" /> : null}
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {buyerTab === "home" ? (
              <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <article className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#356556]">활성 요청 요약</p>
                      <h3 className="mt-1 text-xl font-extrabold text-[#1D2723]">
                        {activeRequest?.title ?? "등록된 요청이 없습니다"}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#FFD84D] px-3 py-1 text-xs font-extrabold text-[#183F35]">
                      제안 {activeRequest?.proposalCount ?? 0}
                    </span>
                  </div>
                  {activeRequest ? (
                    <>
                      <DemoDataLabel />
                      <div className="mt-4 grid gap-3 text-sm leading-6 text-[#69736F]">
                        <p>
                          <strong className="text-[#1D2723]">거래유형</strong> · {activeRequest.transactionType}
                        </p>
                        <p>
                          <strong className="text-[#1D2723]">희망 지역</strong> · {activeRequest.regions.join(" · ")}
                        </p>
                        <p>
                          <strong className="text-[#1D2723]">예산</strong> ·{" "}
                          {activeRequest.budgetSummary ?? `${activeRequest.depositRange} · ${activeRequest.rentRange} · ${activeRequest.maintenanceFee}`}
                        </p>
                        <p>
                          <strong className="text-[#1D2723]">필수 조건</strong> ·{" "}
                          {activeRequest.mustHaves.slice(0, 4).join(", ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBuyerTab("request")}
                        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#356556] bg-white px-4 py-2 text-sm font-extrabold text-[#183F35] hover:bg-[#EAF2EE]"
                      >
                        수정하기
                      </button>
                    </>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-[#69736F]">
                      조건 등록 탭에서 원하는 지역과 예산, 필수 조건을 먼저 알려주세요.
                    </p>
                  )}
                </article>

                <article className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#356556]">최근 받은 제안</p>
                      <h3 className="mt-1 text-xl font-extrabold text-[#1D2723]">
                        비교할 제안 {visibleProposals.length}건
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBuyerTab("proposals")}
                      className="min-h-10 rounded-xl border border-[#DEE4E0] px-3 text-sm font-extrabold text-[#183F35] hover:bg-[#EAF2EE]"
                    >
                      전체 제안 보기
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {visibleProposals.slice(0, 3).map((proposal) => {
                      const firstProperty = proposal.properties[0];
                      return (
                        <button
                          key={proposal.id}
                          type="button"
                          onClick={() => setBuyerTab("proposals")}
                          className="grid min-w-0 gap-3 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-3 text-left transition hover:border-[#356556] sm:grid-cols-[96px_minmax(0,1fr)]"
                        >
                          <PhotoTile
                            src={firstProperty.photoUrls[0]}
                            label={`${firstProperty.title} 대표 사진`}
                            className="min-h-24 rounded-xl border-[#DEE4E0]"
                          />
                          <span className="min-w-0">
                            <span className="block font-extrabold text-[#1D2723]">
                              {proposal.officeName} · {firstProperty.title}
                            </span>
                            <span className="mt-1 block text-sm font-semibold text-[#356556]">
                              {firstProperty.price}
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-[#69736F]">
                              {firstProperty.maintenanceFee} · 제안 중개보수 {formatter.format(firstProperty.proposedBrokerageFee)}원
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              </section>
            ) : null}
          </section>
        ) : showAgentDashboard ? (
          <section className="grid gap-4">
            <div className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[#EAF2EE] px-3 text-xs font-extrabold text-[#183F35]">
                      <BadgeCheck size={14} aria-hidden="true" />
                      인증 공인중개사
                    </span>
                    <span className="inline-flex min-h-8 items-center rounded-full border border-[#DEE4E0] bg-white px-3 text-xs font-extrabold text-[#356556]">
                      {officeName}
                    </span>
                    <span className="inline-flex min-h-8 items-center rounded-full border border-[#DEE4E0] bg-white px-3 text-xs font-extrabold text-[#356556]">
                      {approvalLabel}
                    </span>
                  </div>
                  <h2 className="text-balance mt-4 text-[28px] font-extrabold leading-9 tracking-[0] text-[#1D2723] sm:text-[36px] sm:leading-[44px]">
                    조건에 맞는 고객에게 매물을 제안하세요
                  </h2>
                  <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-[#69736F]">
                    실제로 집을 찾는 고객의 조건을 확인하고, 적합한 매물과 중개보수를 제안할 수 있습니다.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[20rem]">
                  <button
                    type="button"
                    onClick={() => setAgentTab("requests")}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#f2c936]"
                  >
                    <Search size={19} aria-hidden="true" />
                    고객 요청 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentTab("properties")}
                    className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-[#356556] bg-white px-5 py-3 font-extrabold text-[#183F35] transition hover:bg-[#EAF2EE]"
                  >
                    <Building2 size={19} aria-hidden="true" />
                    매물 등록하기
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="새 고객 요청" value={`${dashboardStats.openRequests}`} />
                <Stat label="진행 제안" value={`${dashboardStats.activeProposals}`} />
                <Stat label="등록 매물" value={`${dashboardStats.feedTotal}`} />
                <Stat label="방문 일정" value={`${dashboardStats.appointmentTotal}`} />
                <Stat label="갱신 필요" value={`${dashboardStats.renewalNeeded}`} />
              </div>

              {notice ? (
                <p className="mt-4 rounded-xl border border-[#DEE4E0] bg-[#F7F5EF] px-4 py-3 text-sm font-semibold leading-6 text-[#69736F]">
                  {notice}
                </p>
              ) : null}
            </div>

            <nav
              aria-label="공인중개사 메뉴"
              className="sticky top-2 z-20 -mx-4 border-y border-[#DEE4E0] bg-[#F7F5EF]/96 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:soft-shadow"
            >
              <div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-2">
                {([
                  ["home", "홈"],
                  ["requests", "고객 요청"],
                  ["properties", "매물 관리"],
                  ["sent", "보낸 제안"],
                  ["appointments", "방문 일정"],
                  ["office", "사무소 정보"],
                ] as Array<[AgentTab, string]>).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setAgentTab(tab);
                      resetAgentProposalDraft();
                    }}
                    aria-pressed={agentTab === tab}
                    className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 text-xs font-extrabold transition sm:px-4 sm:text-sm ${
                      agentTab === tab
                        ? "border-[#183F35] bg-[#EAF2EE] text-[#183F35] shadow-sm"
                        : "border-transparent bg-transparent text-[#69736F] hover:border-[#DEE4E0] hover:bg-white"
                    }`}
                  >
                    {agentTab === tab ? <Check size={15} className="mr-1 hidden sm:block" aria-hidden="true" /> : null}
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {agentTab === "home" ? (
              <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <article className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-[#356556]">최근 고객 요청</p>
                      <h3 className="mt-1 text-xl font-extrabold text-[#1D2723]">
                        제안 가능한 요청 {requests.length}건
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgentTab("requests")}
                      className="min-h-10 rounded-xl border border-[#DEE4E0] px-3 text-sm font-extrabold text-[#183F35] hover:bg-[#EAF2EE]"
                    >
                      전체 요청 보기
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {requests.slice(0, 3).map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => {
                          setActiveRequestId(request.id);
                          setAgentTab("requests");
                        }}
                        className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 text-left transition hover:border-[#356556]"
                      >
                        <span className="block font-extrabold text-[#1D2723]">{request.title}</span>
                        <span className="mt-2 block text-sm leading-6 text-[#69736F]">
                          {request.transactionType} · {request.regions.join(" · ")} · {request.budgetSummary ?? `${request.depositRange} · ${request.rentRange}`}
                        </span>
                        <span className="mt-2 inline-flex rounded-full bg-[#FFD84D] px-3 py-1 text-xs font-extrabold text-[#183F35]">
                          받은 제안 {request.proposalCount}건
                        </span>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow">
                  <p className="text-sm font-extrabold text-[#356556]">확인이 필요한 항목</p>
                  <div className="mt-4 grid gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPropertyFilter("renewal");
                        setAgentTab("properties");
                      }}
                      className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 text-left"
                    >
                      <span className="block font-extrabold text-[#1D2723]">
                        30일 갱신 확인 · {dashboardStats.renewalNeeded}건
                      </span>
                      <span className="mt-1 block text-sm text-[#69736F]">
                        갱신이 필요한 매물은 매물 관리에서 상태를 확인하세요.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentTab("appointments")}
                      className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 text-left"
                    >
                      <span className="block font-extrabold text-[#1D2723]">
                        예정된 방문 일정 · {dashboardStats.appointmentTotal}건
                      </span>
                      <span className="mt-1 block text-sm text-[#69736F]">
                        날짜순 목록으로 고객 방문 일정을 확인합니다.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAgentTab("sent")}
                      className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 text-left"
                    >
                      <span className="block font-extrabold text-[#1D2723]">
                        채팅 중인 제안 확인
                      </span>
                      <span className="mt-1 block text-sm text-[#69736F]">
                        답변이 필요한 대화는 보낸 제안 화면에서 바로 이어갑니다.
                      </span>
                    </button>
                  </div>
                </article>
              </section>
            ) : null}
          </section>
        ) : (
        <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  {roleHeroCopy[role].chips.map((chip) => (
                    <Chip key={chip}>{chip}</Chip>
                  ))}
                </div>
                <h2 className="mt-4 text-3xl font-bold leading-tight text-[#20251f] sm:text-4xl">
                  {roleHeroCopy[role].title}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#586155]">
                  {roleHeroCopy[role].description}
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[23rem]">
                <Stat label="열린 요청" value={`${dashboardStats.openRequests}`} />
                <Stat label="추천 매물" value={`${dashboardStats.proposalTotal}`} />
                <Stat label="피드 매물" value={`${dashboardStats.feedTotal}`} />
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-[#e4d7bb] bg-[#fff8db] px-4 py-3 text-sm leading-6 text-[#6b5a16]">
              {notice}
            </p>
          </div>

          <div className="rounded-lg border border-[#d9d0c0] bg-[#203927] p-5 text-white soft-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#ffe24a]">현재 역할</p>
                <h2 className="mt-2 text-2xl font-bold">{roleCopy[role]}</h2>
                <p className="mt-2 text-sm leading-6 text-[#dce8d9]">
                  {roleDescriptions[role]}
                </p>
              </div>
              <ShieldCheck className="text-[#ffe24a]" size={28} aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {roleFocusCards[role].map(([title, description]) => (
                <div key={title} className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-semibold text-[#ffe24a]">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#e9f0e7]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {showAgentDashboard && agentTab === "properties" ? (
        <section className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">중개사 매물 피드</p>
                <h2 className="text-xl font-bold">등록은 무료, 계약 성사 시 정산</h2>
              </div>
              <Building2 size={22} aria-hidden="true" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ["active", "새 매물 등록"],
                ["all", "전체"],
                ["active", "등록 중"],
                ["renewal", "갱신 필요"],
                ["completed", "계약 완료"],
              ] as Array<[PropertyFilter, string]>).map(([filter, label]) => (
                <button
                  key={`${filter}-${label}`}
                  type="button"
                  onClick={() => setPropertyFilter(filter)}
                  className={`min-h-10 rounded-xl border px-3 text-sm font-extrabold ${
                    propertyFilter === filter && label !== "새 매물 등록"
                      ? "border-[#183F35] bg-[#EAF2EE] text-[#183F35]"
                      : "border-[#DEE4E0] bg-white text-[#69736F]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <form onSubmit={publishFeedProperty} className="mt-5 grid gap-3">
              <p className="text-sm font-extrabold text-[#356556]">1. 기본 정보</p>
              <input
                name="title"
                placeholder="매물 제목"
                className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                defaultValue="우리 사무소 추천 투룸"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="addressLabel"
                  placeholder="대략 위치"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="내당동 근처"
                />
                <input
                  name="price"
                  placeholder="가격"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="보증금 1,000만 / 월세 45만"
                />
                <p className="text-sm font-extrabold text-[#356556] sm:col-span-2">2. 거래 및 가격</p>
                <input
                  name="deposit"
                  type="number"
                  inputMode="numeric"
                  placeholder="보증금(원)"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="10000000"
                />
                <input
                  name="monthlyRent"
                  type="number"
                  inputMode="numeric"
                  placeholder="월세(원)"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="450000"
                />
                <input
                  name="maintenanceFee"
                  placeholder="관리비"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="관리비 7만"
                />
                <p className="text-sm font-extrabold text-[#356556] sm:col-span-2">3. 건물·층수 정보</p>
                <input
                  name="area"
                  placeholder="면적"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="전용 29㎡"
                />
                <input
                  name="floor"
                  placeholder="층수"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="4층"
                />
                <p className="text-sm font-extrabold text-[#356556] sm:col-span-2">4. 옵션 및 특징</p>
                <input
                  name="features"
                  placeholder="특징, 쉼표로 구분"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="반려동물 가능, 두류역 접근, 분리형 주방"
                />
              </div>
              <p className="text-sm font-extrabold text-[#356556]">6. 중개보수 정보</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  name="proposedBrokerageFee"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="50000"
                  placeholder="제안 중개보수"
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                  defaultValue="45000"
                />
                <div className="rounded-lg border border-[#DEE4E0] bg-[#F7F5EF] px-4 py-3 text-sm leading-6 text-[#586155]">
                  예시 입력값 45,000원 · 법정 상한 이하에서 제안합니다.
                </div>
              </div>
              <p className="rounded-lg border border-[#e4d7bb] bg-[#fff8db] px-4 py-3 text-sm leading-6 text-[#6b5a16]">
                요율표로 법정 최대보수를 자동 계산합니다. 중개사는 계산된 최대보수
                이하에서 더 낮은 중개보수를 제안할 수 있습니다.
              </p>
              <p className="text-sm font-extrabold text-[#356556]">5. 사진 등록</p>
              <label className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#b9c7b4] bg-[#edf6ef] p-4 text-center text-sm font-semibold text-[#33523a]">
                <Upload size={22} aria-hidden="true" />
                피드 매물 사진 업로드 · 이미지 파일 · 파일당 3MB 이하
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleFeedPhotos}
                />
              </label>
              {feedPhotoError ? (
                <p className="rounded-xl border border-[#C84B45] bg-[#fff3f1] px-3 py-2 text-sm font-extrabold text-[#C84B45]">
                  {feedPhotoError}
                </p>
              ) : null}
              {feedPhotoUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {feedPhotoUrls.map((photoUrl, index) => (
                    <PhotoTile
                      key={photoUrl}
                      src={photoUrl}
                      label={`피드 업로드 사진 ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
              <p className="text-sm font-extrabold text-[#356556]">7. 최종 확인</p>
              <div className="rounded-lg border border-[#DEE4E0] bg-white px-4 py-3 text-sm leading-6 text-[#586155]">
                등록 전 제목, 위치, 가격, 사진, 제안 중개보수를 확인합니다. 둘러보기에서는
                실제 저장 없이 화면 안의 데모 매물만 추가됩니다.
              </div>
              <button
                disabled={isAgentBlocked}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-4 py-2 font-bold text-white disabled:bg-[#9ba397]"
              >
                {isAgentBlocked ? `${approvalLabel} 중` : "무료로 피드 등록"}
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">
                  {showBuyerDashboard ? "중개사 매물 피드 둘러보기" : "다방/직방형 피드"}
                </p>
                <h2 className="text-xl font-bold">
                  {showBuyerDashboard
                    ? "인증 중개사가 올린 원룸·투룸 예시 매물"
                    : "사무소가 보유 매물을 쌓아두는 공간"}
                </h2>
              </div>
              <span className="rounded-full bg-[#fff8db] px-3 py-1 text-xs font-bold text-[#6b5a16]">
                등록비 0원 · 계약 성사 시 성과형 이용료
              </span>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {filteredAgentProperties.map((property) => (
                <article
                  key={property.id}
                  className="rounded-lg border border-[#d9d0c0] bg-[#fbfaf6] p-4"
                >
                  <PhotoTile
                    src={property.photoUrls[0]}
                    label={`${property.title} 대표 사진`}
                    className="mb-3"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{property.title}</h3>
                      <DemoDataLabel />
                      <p className="mt-1 text-sm text-[#677064]">{property.addressLabel}</p>
                    </div>
                    <MapPin size={18} aria-hidden="true" />
                  </div>
                  <span className="mt-3 inline-flex rounded-full bg-[#edf6ef] px-3 py-1 text-xs font-bold text-[#33523a]">
                    {completedPropertyIds.includes(property.id)
                      ? "계약 완료"
                      : renewalNeededPropertyIds.includes(property.id)
                        ? "갱신 필요"
                        : "등록 중"}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-[#2f6f45]">
                    {property.price}
                  </p>
                  <p className="mt-1 text-sm text-[#677064]">
                    {property.area} · {property.floor} · {property.maintenanceFee}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {property.features.map((feature) => (
                      <Chip key={feature}>{feature}</Chip>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#586155]">{property.note}</p>
                  <BrokerageFeeBox
                    legalMax={property.legalMaxBrokerageFee}
                    proposed={property.proposedBrokerageFee}
                    rateLabel={property.brokerageRateLabel}
                    formulaLabel={property.brokerageFormulaLabel}
                  />
                  {showAgentDashboard ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        onClick={() => {
                          setRenewalNeededPropertyIds((current) =>
                            current.filter((id) => id !== property.id)
                          );
                          setNotice(`${property.title} 매물 상태를 30일 갱신했습니다.`);
                        }}
                        disabled={isAgentBlocked}
                        className="min-h-10 rounded-lg border border-[#d9d0c0] bg-white px-3 text-sm font-bold text-[#20251f] disabled:bg-[#ece8dc] disabled:text-[#9ba397]"
                      >
                        30일 갱신
                      </button>
                      <button
                        onClick={() => {
                          setCompletedPropertyIds((current) =>
                            current.includes(property.id) ? current : [...current, property.id]
                          );
                          setNotice(`${property.title} 매물을 계약 완료 상태로 처리했습니다.`);
                        }}
                        disabled={isAgentBlocked}
                        className="min-h-10 rounded-lg bg-[#20251f] px-3 text-sm font-bold text-white disabled:bg-[#9ba397]"
                      >
                        계약 완료
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {((showBuyerDashboard && buyerTab === "request") || (showAgentDashboard && agentTab === "requests")) ? (
        <section
          ref={showAgentDashboard ? agentProposalFlowRef : undefined}
          className={
            showBuyerDashboard
              ? "grid gap-4"
              : isAgentProposalFlow
                ? "mx-auto grid w-full max-w-[980px] gap-4"
                : "grid gap-4 xl:grid-cols-[0.95fr_1.05fr]"
          }
        >
          {showBuyerDashboard ? (
          <div className="mx-auto w-full max-w-[800px] rounded-2xl border border-[#DEE4E0] bg-white p-5 soft-shadow sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#356556]">조건 등록</p>
                <h2 className="text-xl font-extrabold text-[#1D2723]">나의 조건 등록 및 수정</h2>
              </div>
              <Plus size={22} aria-hidden="true" />
            </div>
            <BuyerRequestWizard onSubmit={createRequest} />
          </div>
          ) : null}

          {showAgentDashboard ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">조건 매칭 요청서</p>
                <h2 className="text-xl font-bold">고객 요청 목록</h2>
              </div>
              {!isAgentProposalFlow ? (
                <div className="flex flex-wrap gap-2">
                  {["지역", "월세·전세", "원룸·투룸", "보유 매물 조건"].map((filter) => (
                    <span
                      key={filter}
                      className="inline-flex min-h-9 items-center rounded-full border border-[#DEE4E0] bg-[#F7F5EF] px-3 text-xs font-extrabold text-[#69736F]"
                    >
                      {filter}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {!isAgentProposalFlow ? (
            <div className="mt-5 grid gap-3">
              {requests.map((request) => (
                <article
                  key={request.id}
                  className={`rounded-lg border p-4 text-left transition ${
                    activeRequestId === request.id
                      ? "border-[#2f6f45] bg-[#edf6ef]"
                      : "border-[#d9d0c0] bg-white hover:bg-[#fbfaf6]"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">{request.title}</p>
                      <DemoDataLabel />
                      <p className="mt-1 text-sm text-[#677064]">
                        {request.regions.join(" · ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-[#ffe24a] px-3 py-1 text-xs font-bold">
                      제안 {request.proposalCount}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip>{request.transactionType}</Chip>
                    <Chip>{request.housingType}</Chip>
                    <Chip>{request.depositRange}</Chip>
                    <Chip>{request.rentRange}</Chip>
                  </div>
                  <p className="mt-3 rounded-lg border border-[#e4d7bb] bg-[#fff8db] px-3 py-2 text-xs font-semibold leading-5 text-[#6b5a16]">
                    {request.budgetSummary ?? `${request.depositRange} · ${request.rentRange} · ${request.maintenanceFee}`}
                  </p>
                  <div className="mt-3 grid gap-2 rounded-lg border border-[#d9d0c0] bg-white/80 p-3 text-xs leading-5 text-[#586155]">
                    <p>
                      <strong className="text-[#20251f]">필수조건:</strong>{" "}
                      {request.mustHaves
                        .filter((item) => !["월세", "전세", "둘 다 가능"].includes(item) && !item.startsWith("대구광역시") && !item.startsWith("우선조건:") && !item.startsWith("협의조건:") && !item.startsWith("요청 만료일:") && !item.startsWith("필요한 옵션:") && !item.startsWith("보안 선호:") && !item.startsWith("피하고 싶은 환경:") && !item.startsWith("가까우면 좋은 시설:") && item !== "조건 외 제안 허용" && item !== "필수조건 모두 충족한 매물만")
                        .slice(0, 4)
                        .join(", ")}
                    </p>
                    {["필요한 옵션", "보안 선호", "피하고 싶은 환경", "가까우면 좋은 시설"].map((label) => {
                      const value = request.mustHaves
                        .find((item) => item.startsWith(`${label}:`))
                        ?.replace(`${label}: `, "");
                      return value ? (
                        <p key={label}>
                          <strong className="text-[#20251f]">{label}:</strong>{" "}
                          {value}
                        </p>
                      ) : null;
                    })}
                    <p>
                      <strong className="text-[#20251f]">우선조건</strong> ·{" "}
                      {request.mustHaves.find((item) => item.startsWith("우선조건:"))?.replace("우선조건: ", "") ?? "채광, 조용한 주변"}
                    </p>
                    <p>
                      <strong className="text-[#20251f]">협의 가능</strong> ·{" "}
                      {request.mustHaves.find((item) => item.startsWith("협의조건:"))?.replace("협의조건: ", "") ?? "예산 조정 가능"}
                    </p>
                    <p>
                      <strong className="text-[#20251f]">요청 만료일</strong> · 등록일로부터 14일 ·{" "}
                      {request.mustHaves.includes("조건 외 제안 허용")
                        ? "조건 외 제안 허용"
                        : "필수조건 모두 충족한 매물만"}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setActiveRequestId(request.id)}
                      className="min-h-11 rounded-xl border border-[#DEE4E0] bg-white px-4 py-2 text-sm font-extrabold text-[#183F35]"
                    >
                      요청 자세히 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startAgentProposal(request.id);
                      }}
                      className="min-h-11 rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-extrabold text-[#183F35]"
                    >
                      매물 제안하기
                    </button>
                  </div>
                </article>
              ))}
            </div>
            ) : (
              <div className="mt-5 grid gap-5">
                <div className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-extrabold text-[#356556]">
                        매물 제안 · {agentProposalStep + 1} / 4
                      </p>
                      <h3 className="mt-1 text-xl font-extrabold text-[#1D2723]">
                        {["고객 요청 확인", "제안할 매물 선택", "중개보수 입력", "최종 확인 및 전송"][agentProposalStep]}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetAgentProposalDraft();
                      }}
                      className="min-h-10 rounded-xl border border-[#DEE4E0] bg-white px-3 text-sm font-extrabold"
                    >
                      고객 요청으로 돌아가기
                    </button>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-[#DEE4E0]">
                    <div
                      className="h-2 rounded-full bg-[#356556]"
                      style={{ width: `${((agentProposalStep + 1) / 4) * 100}%` }}
                    />
                  </div>
                </div>

                {activeRequest ? (
                  <div className="rounded-2xl border border-[#DEE4E0] bg-white p-4">
                    {agentProposalStep === 0 ? (
                      <div className="grid gap-3 text-sm leading-6 text-[#69736F]">
                        <p><strong className="text-[#1D2723]">거래유형</strong> · {activeRequest.transactionType}</p>
                        <p><strong className="text-[#1D2723]">희망 지역</strong> · {activeRequest.regions.join(" · ")}</p>
                        <p><strong className="text-[#1D2723]">예산</strong> · {activeRequest.budgetSummary ?? `${activeRequest.depositRange} · ${activeRequest.rentRange} · ${activeRequest.maintenanceFee}`}</p>
                        <p><strong className="text-[#1D2723]">필수 조건</strong> · {activeRequest.mustHaves.slice(0, 5).join(", ")}</p>
                        <p><strong className="text-[#1D2723]">우선 조건</strong> · {activeRequest.mustHaves.find((item) => item.startsWith("우선조건:"))?.replace("우선조건: ", "") ?? "채광, 조용한 주변"}</p>
                        <p><strong className="text-[#1D2723]">협의 가능 조건</strong> · {activeRequest.mustHaves.find((item) => item.startsWith("협의조건:"))?.replace("협의조건: ", "") ?? "예산 조정 가능"}</p>
                      </div>
                    ) : null}

                    {agentProposalStep === 1 ? (
                      <div className="grid gap-3">
                        <p className="text-sm leading-6 text-[#69736F]">
                          {activeRequest.transactionType === "둘 다 가능"
                            ? "월세와 전세 매물을 모두 선택할 수 있습니다."
                            : `${activeRequest.transactionType} 요청이므로 ${activeRequest.transactionType} 매물만 선택할 수 있습니다.`}
                        </p>
                        {proposalSelectionError || selectedProposalPropertyIds.length === 0 ? (
                          <p className="rounded-xl border border-[#C84B45] bg-[#fff3f1] px-3 py-2 text-sm font-extrabold text-[#C84B45]">
                            {proposalSelectionError || "제안할 매물을 1개 이상 선택해주세요."}
                          </p>
                        ) : null}
                        {agentProperties.map((property) => {
                          const isCompatible = isCompatiblePropertyForRequest(property, activeRequest);
                          const isSelected = selectedProposalPropertyIds.includes(property.id);

                          return (
                          <label
                            key={property.id}
                            className={`grid gap-3 rounded-2xl border p-3 transition sm:grid-cols-[132px_minmax(0,1fr)] ${
                              isSelected
                                ? "border-[#183F35] bg-[#EAF2EE]"
                                : isCompatible
                                  ? "border-[#DEE4E0] bg-[#F7F5EF] hover:border-[#356556]"
                                  : "border-[#DEE4E0] bg-[#f2f0ea] opacity-60"
                            }`}
                          >
                            <PhotoTile src={property.photoUrls[0]} label={`${property.title} 대표 사진`} className="min-h-28 rounded-xl border-[#DEE4E0]" />
                            <span className="min-w-0">
                              <span className="flex items-start gap-2 font-extrabold text-[#1D2723]">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isCompatible}
                                  onChange={() => toggleProposalProperty(property)}
                                  className="mt-1 h-4 w-4"
                                  aria-label={`${property.title} 선택`}
                                />
                                {isSelected ? <Check size={18} className="mt-0.5 shrink-0 text-[#183F35]" aria-hidden="true" /> : null}
                                {property.title}
                              </span>
                              <span className="mt-2 flex flex-wrap gap-2">
                                <Chip>{getPropertyTransactionType(property)}</Chip>
                                {!isCompatible ? <Chip>거래유형 불일치</Chip> : null}
                              </span>
                              <span className="mt-2 block text-sm leading-6 text-[#69736F]">
                                {property.addressLabel} · {getPropertyBudgetLabel(property)}
                              </span>
                              <span className="mt-1 block text-sm leading-6 text-[#69736F]">
                                {getPropertyMaintenanceLabel(property)}
                              </span>
                              <span className="mt-2 flex flex-wrap gap-2">
                                {property.features.slice(0, 3).map((feature) => (
                                  <Chip key={feature}>{feature}</Chip>
                                ))}
                              </span>
                            </span>
                          </label>
                          );
                        })}
                        {proposalCompatibleProperties.length === 0 ? (
                          <p className="rounded-xl border border-[#C84B45] bg-[#fff3f1] px-3 py-2 text-sm font-extrabold text-[#C84B45]">
                            이 요청의 거래유형과 맞는 보유 매물이 없습니다.
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setAgentTab("properties");
                            resetAgentProposalDraft();
                          }}
                          className="min-h-11 rounded-xl border border-[#356556] bg-white px-4 py-2 text-sm font-extrabold text-[#183F35]"
                        >
                          적합한 매물이 없으면 새 매물 등록하기
                        </button>
                      </div>
                    ) : null}

                    {agentProposalStep === 2 ? (
                      <div className="grid gap-3">
                        <p className="text-sm leading-6 text-[#69736F]">
                          선택한 매물의 실제 거래금액 기준으로 법정 최대 중개보수를 계산하고, 그 이하에서 제안 금액을 입력합니다.
                        </p>
                        {selectedProposalProperties.map((property) => {
                          const rawProposedValue = proposalBrokerageFees[property.id] ?? "";
                          const proposedValue = Number(rawProposedValue || 0);
                          const saving = property.legalMaxBrokerageFee - proposedValue;
                          const displayedFeeError =
                            proposalFeeErrors[property.id] || getProposalBrokerageFeeError(property, rawProposedValue);
                          return (
                            <article
                              key={property.id}
                              className={`grid gap-3 rounded-2xl border bg-[#F7F5EF] p-3 sm:grid-cols-[132px_minmax(0,1fr)] ${
                                displayedFeeError ? "border-[#C84B45]" : "border-[#DEE4E0]"
                              }`}
                            >
                              <PhotoTile src={property.photoUrls[0]} label={`${property.title} 대표 사진`} className="min-h-28 rounded-xl border-[#DEE4E0]" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-extrabold text-[#1D2723]">{property.title}</h4>
                                  <Chip>{getPropertyTransactionType(property)}</Chip>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm leading-6 text-[#69736F] sm:grid-cols-2">
                                  <p><strong className="text-[#1D2723]">거래금액</strong> · {getPropertyBudgetLabel(property)}</p>
                                  <p><strong className="text-[#1D2723]">관리비</strong> · {property.maintenanceFee}</p>
                                  <p><strong className="text-[#1D2723]">월 고정지출</strong> · {formatManwon(getPropertyMonthlyFixedCost(property) / 10_000)}</p>
                                  <p><strong className="text-[#1D2723]">법정 최대</strong> · {formatWon(property.legalMaxBrokerageFee)}</p>
                                </div>
                                <label className="mt-3 grid gap-2 text-sm font-extrabold text-[#1D2723]">
                                  공인중개사가 제안할 중개보수
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={
                                      proposalBrokerageFees[property.id]
                                        ? formatter.format(Number(proposalBrokerageFees[property.id]))
                                        : ""
                                    }
                                    onChange={(event) =>
                                      updateProposalBrokerageFee(property, event.target.value)
                                    }
                                    className={`min-h-12 rounded-xl border bg-white px-3 text-base font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                                      displayedFeeError
                                        ? "border-[#C84B45] focus:ring-[#C84B45]"
                                        : "border-[#DEE4E0] focus:ring-[#183F35]"
                                    }`}
                                    placeholder="예: 45,000"
                                    aria-invalid={Boolean(displayedFeeError)}
                                    aria-describedby={`proposal-fee-error-${property.id}`}
                                  />
                                </label>
                                {displayedFeeError ? (
                                  <p id={`proposal-fee-error-${property.id}`} className="mt-2 text-sm font-extrabold text-[#C84B45]">
                                    {displayedFeeError}
                                  </p>
                                ) : null}
                                {!displayedFeeError ? (
                                  <p className="mt-2 text-sm leading-6 text-[#69736F]">
                                    입력 금액: {formatWon(proposedValue)} ·
                                    법정 최대 대비 절감 {formatWon(Math.max(0, saving))}
                                  </p>
                                ) : null}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}

                    {agentProposalStep === 3 ? (
                      <div className="grid gap-4">
                        <div className="rounded-xl border border-[#DEE4E0] bg-[#F7F5EF] p-4 text-sm leading-6 text-[#69736F]">
                          <p><strong className="text-[#1D2723]">고객 요청</strong> · {activeRequest.title}</p>
                          <p><strong className="text-[#1D2723]">희망 지역</strong> · {activeRequest.regions.join(" · ")}</p>
                          <p><strong className="text-[#1D2723]">제안 설명</strong> · 예산과 필수 조건을 기준으로 바로 방문 가능한 매물 {selectedProposalProperties.length}곳을 묶었습니다.</p>
                        </div>
                        {selectedProposalProperties.map((property) => {
                          const proposedValue = Number(proposalBrokerageFees[property.id] || 0);
                          const saving = property.legalMaxBrokerageFee - proposedValue;
                          return (
                            <article
                              key={property.id}
                              className="grid gap-3 rounded-2xl border border-[#DEE4E0] bg-white p-3 sm:grid-cols-[132px_minmax(0,1fr)]"
                            >
                              <PhotoTile src={property.photoUrls[0]} label={`${property.title} 대표 사진`} className="min-h-28 rounded-xl border-[#DEE4E0]" />
                              <div className="min-w-0 text-sm leading-6 text-[#69736F]">
                                <h4 className="text-base font-extrabold text-[#1D2723]">{property.title}</h4>
                                <p><strong className="text-[#1D2723]">거래금액</strong> · {getPropertyBudgetLabel(property)}</p>
                                <p><strong className="text-[#1D2723]">관리비 및 월 고정지출</strong> · {getPropertyMaintenanceLabel(property)}</p>
                                <p><strong className="text-[#1D2723]">법정 최대 중개보수</strong> · {formatWon(property.legalMaxBrokerageFee)}</p>
                                <p><strong className="text-[#1D2723]">제안 중개보수</strong> · {formatWon(proposedValue)}</p>
                                <p><strong className="text-[#1D2723]">절감금액</strong> · {formatWon(Math.max(0, saving))}</p>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="sticky bottom-3 z-10 flex flex-col-reverse gap-2 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF]/95 p-2 backdrop-blur sm:static sm:flex-row sm:justify-between sm:border-0 sm:bg-transparent sm:p-0">
                  <button
                    type="button"
                    onClick={() => setAgentProposalStep((current) => Math.max(0, current - 1) as AgentProposalStep)}
                    disabled={agentProposalStep === 0}
                    className="min-h-12 rounded-xl border border-[#DEE4E0] bg-white px-4 py-2 font-extrabold disabled:text-[#9ba397]"
                  >
                    이전
                  </button>
                  {agentProposalStep < 3 ? (
                    <button
                      type="button"
                      onClick={goNextAgentProposalStep}
                      disabled={
                        (agentProposalStep === 1 && selectedProposalPropertyIds.length === 0) ||
                        (agentProposalStep === 2 && !isProposalBrokerageDraftValid())
                      }
                      className="min-h-12 rounded-xl bg-[#356556] px-4 py-2 font-extrabold text-white disabled:bg-[#9ba397]"
                    >
                      다음
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={createProposal}
                      disabled={isAgentBlocked || isCreatingProposal}
                      className="min-h-12 rounded-xl bg-[#FFD84D] px-4 py-2 font-extrabold text-[#183F35] disabled:bg-[#d8d0a2]"
                    >
                      {isCreatingProposal ? "제안 전송 중" : "이 내용으로 제안 보내기"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          ) : null}
        </section>
        ) : null}

        {((showBuyerDashboard && (buyerTab === "proposals" || buyerTab === "chat")) || (showAgentDashboard && agentTab === "sent")) ? (
        <section className={showBuyerDashboard ? "grid gap-4" : "grid gap-4 xl:grid-cols-[1.25fr_0.75fr]"}>
          {(!showBuyerDashboard || buyerTab === "proposals") ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">
                  {showBuyerDashboard ? "공인중개사의 매물 제안 확인" : "보낸 제안 관리"}
                </p>
                <h2 className="text-xl font-bold">
                  {showBuyerDashboard ? "매물·중개보수 비교" : "매물·중개보수 제안 현황"}
                </h2>
              </div>
              <Search size={22} aria-hidden="true" />
            </div>
            {showBuyerDashboard && !isComparisonMode ? (
              <div className="mt-4 rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-[#183F35]">
                      비교할 제안 {selectedComparisonIds.length}/3개 선택
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#69736F]">
                      {selectedComparisonIds.length < 2
                        ? "2개 이상 선택해주세요."
                        : "선택한 매물과 제안 중개보수를 비교할 수 있습니다."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openComparisonMode}
                    disabled={selectedComparisonIds.length < 2}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-extrabold text-[#183F35] disabled:bg-[#d8d0a2] disabled:text-[#69736F]"
                  >
                    선택한 제안 비교하기
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
                {comparisonNotice ? (
                  <p className="mt-3 text-sm font-extrabold text-[#C84B45]">{comparisonNotice}</p>
                ) : null}
              </div>
            ) : null}
            {showBuyerDashboard && isComparisonMode ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-extrabold text-[#356556]">제안 비교</p>
                      <h3 className="mt-1 text-2xl font-extrabold text-[#1D2723]">제안 비교</h3>
                      <p className="mt-2 text-sm leading-6 text-[#69736F]">
                        매물 조건과 공인중개사가 제안한 중개보수를 비교해보세요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setIsComparisonMode(false)}
                        className="min-h-11 rounded-xl border border-[#DEE4E0] bg-white px-4 py-2 text-sm font-extrabold text-[#183F35]"
                      >
                        받은 제안으로 돌아가기
                      </button>
                      <button
                        type="button"
                        onClick={clearComparisonSelection}
                        className="min-h-11 rounded-xl border border-[#DEE4E0] bg-white px-4 py-2 text-sm font-extrabold text-[#69736F]"
                      >
                        비교 선택 초기화
                      </button>
                    </div>
                  </div>
                  {isSameListingComparison ? (
                    <p className="mt-4 rounded-xl border border-[#ead580] bg-[#fff8db] px-4 py-3 text-sm font-extrabold leading-6 text-[#6b5a16]">
                      동일한 매물에 대한 공인중개사 제안입니다.
                    </p>
                  ) : null}
                </div>

                {isSameListingComparison ? (
                  <div className="grid gap-4">
                    <article className="rounded-2xl border border-[#DEE4E0] bg-white p-4 soft-shadow">
                      {(() => {
                        const conditionStatus = getConditionStatus(selectedComparisonItems[0].property, activeRequest);
                        return (
                          <>
                      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                        <PhotoTile
                          src={selectedComparisonItems[0].property.photoUrls[0]}
                          label={`${selectedComparisonItems[0].property.title} 대표 사진`}
                          className="min-h-36 rounded-xl"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xl font-extrabold text-[#1D2723]">
                            {selectedComparisonItems[0].property.title}
                          </h4>
                          <DemoDataLabel />
                          <div className="mt-3 grid gap-2 text-sm leading-6 text-[#69736F] sm:grid-cols-2">
                            <p><strong className="text-[#1D2723]">위치</strong> · {selectedComparisonItems[0].property.addressLabel}</p>
                            <p><strong className="text-[#1D2723]">거래유형</strong> · {getPropertyTransactionType(selectedComparisonItems[0].property)}</p>
                            <p><strong className="text-[#1D2723]">거래금액</strong> · {getPropertyBudgetLabel(selectedComparisonItems[0].property)}</p>
                            <p><strong className="text-[#1D2723]">관리비</strong> · {selectedComparisonItems[0].property.maintenanceFee}</p>
                            <p><strong className="text-[#1D2723]">월 고정지출</strong> · {formatManwon(getPropertyMonthlyFixedCost(selectedComparisonItems[0].property) / 10_000)}</p>
                            <p><strong className="text-[#1D2723]">면적·층수</strong> · {selectedComparisonItems[0].property.area} · {selectedComparisonItems[0].property.floor}</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ConditionBadge label={`필수조건: ${conditionStatus.must.label}`} tone={conditionStatus.must.tone} />
                        <ConditionBadge label={`우선조건: ${conditionStatus.priority.label}`} tone={conditionStatus.priority.tone} />
                      </div>
                      <ConditionDetails conditionStatus={conditionStatus} />
                          </>
                        );
                      })()}
                    </article>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {selectedComparisonItems.map((item) => {
                        const saving = item.property.legalMaxBrokerageFee - item.property.proposedBrokerageFee;
                        return (
                          <article key={item.comparisonId} className="rounded-2xl border border-[#DEE4E0] bg-white p-4 soft-shadow">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-extrabold text-[#1D2723]">{item.officeName}</p>
                                <p className="mt-1 text-sm font-semibold text-[#69736F]">{item.agentName}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Chip>인증 공인중개사</Chip>
                                {item.property.proposedBrokerageFee === lowestSelectedBrokerageFee ? (
                                  <span className="inline-flex min-h-7 items-center rounded-full bg-[#FFD84D] px-3 text-xs font-extrabold text-[#183F35]">
                                    가장 낮은 제안
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-4 grid gap-2 text-sm leading-6 text-[#69736F]">
                              <p><strong className="text-[#1D2723]">법정 최대 중개보수</strong> · {formatWon(item.property.legalMaxBrokerageFee)}</p>
                              <p><strong className="text-[#1D2723]">제안 중개보수</strong> · {formatWon(item.property.proposedBrokerageFee)}</p>
                              <p><strong className="text-[#1D2723]">절감금액</strong> · {formatWon(Math.max(0, saving))}</p>
                              <p className="line-clamp-3">{item.message}</p>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <button onClick={sendMessage} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-4 py-2 font-bold text-white">
                                <MessageCircle size={17} aria-hidden="true" />
                                채팅하기
                              </button>
                              <button onClick={() => requestViewing(visibleProposals.find((proposal) => proposal.id === item.proposalId)!)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fee500] px-4 py-2 font-bold text-[#20251f]">
                                <ReceiptText size={17} aria-hidden="true" />
                                무료 방문 예약
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-3">
                    {selectedComparisonItems.map((item) => {
                      const conditionStatus = getConditionStatus(item.property, activeRequest);
                      const saving = item.property.legalMaxBrokerageFee - item.property.proposedBrokerageFee;
                      const sameListingCount = comparisonSourceIdCounts[item.sourceListingId] ?? 0;
                      const sameListingLowestFee =
                        sameListingCount > 1
                          ? Math.min(
                              ...selectedComparisonItems
                                .filter((comparisonItem) => comparisonItem.sourceListingId === item.sourceListingId)
                                .map((comparisonItem) => comparisonItem.property.proposedBrokerageFee)
                            )
                          : null;
                      return (
                        <article key={item.comparisonId} className="rounded-2xl border border-[#DEE4E0] bg-white p-4 soft-shadow">
                          <PhotoTile src={item.property.photoUrls[0]} label={`${item.property.title} 대표 사진`} className="min-h-36 rounded-xl" />
                          <h4 className="mt-4 text-lg font-extrabold text-[#1D2723]">{item.property.title}</h4>
                          <DemoDataLabel />
                          {sameListingCount > 1 ? (
                            <span className="mt-2 inline-flex min-h-7 items-center rounded-full border border-[#ead580] bg-[#fff8db] px-3 text-xs font-extrabold text-[#6b5a16]">
                              동일 매물
                            </span>
                          ) : null}
                          <div className="mt-3 grid gap-2 text-sm leading-6 text-[#69736F]">
                            <p><strong className="text-[#1D2723]">위치</strong> · {item.property.addressLabel}</p>
                            <p><strong className="text-[#1D2723]">거래유형</strong> · {getPropertyTransactionType(item.property)}</p>
                            <p><strong className="text-[#1D2723]">거래금액</strong> · {getPropertyBudgetLabel(item.property)}</p>
                            <p><strong className="text-[#1D2723]">관리비</strong> · {item.property.maintenanceFee}</p>
                            <p><strong className="text-[#1D2723]">월 고정지출</strong> · {formatManwon(getPropertyMonthlyFixedCost(item.property) / 10_000)}</p>
                            <p><strong className="text-[#1D2723]">면적·층수</strong> · {item.property.area} · {item.property.floor}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <ConditionBadge label={`필수조건: ${conditionStatus.must.label}`} tone={conditionStatus.must.tone} />
                            <ConditionBadge label={`우선조건: ${conditionStatus.priority.label}`} tone={conditionStatus.priority.tone} />
                            <Chip>인증 공인중개사</Chip>
                            {sameListingLowestFee !== null && item.property.proposedBrokerageFee === sameListingLowestFee ? (
                              <span className="inline-flex min-h-8 items-center rounded-full bg-[#FFD84D] px-3 text-xs font-extrabold text-[#183F35]">
                                가장 낮은 제안
                              </span>
                            ) : null}
                          </div>
                          <ConditionDetails conditionStatus={conditionStatus} />
                          <div className="mt-4 grid gap-2 text-sm leading-6 text-[#69736F]">
                            <p><strong className="text-[#1D2723]">공인중개사</strong> · {item.officeName} · {item.agentName}</p>
                            <p><strong className="text-[#1D2723]">법정 최대 중개보수</strong> · {formatWon(item.property.legalMaxBrokerageFee)}</p>
                            <p><strong className="text-[#1D2723]">제안 중개보수</strong> · {formatWon(item.property.proposedBrokerageFee)}</p>
                            <p><strong className="text-[#1D2723]">절감금액</strong> · {formatWon(Math.max(0, saving))}</p>
                          </div>
                          <div className="mt-4 grid gap-2">
                            <button onClick={sendMessage} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-4 py-2 font-bold text-white">
                              <MessageCircle size={17} aria-hidden="true" />
                              채팅하기
                            </button>
                            <button onClick={() => requestViewing(visibleProposals.find((proposal) => proposal.id === item.proposalId)!)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fee500] px-4 py-2 font-bold text-[#20251f]">
                              <ReceiptText size={17} aria-hidden="true" />
                              무료 방문 예약
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : visibleProposals.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-[#c8beae] p-8 text-center text-[#677064]">
                아직 이 요청서에 도착한 제안이 없습니다.
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {visibleProposals.map((proposal) => (
                  <article
                    key={proposal.id}
                    className={`rounded-lg border p-4 ${
                      proposal.status === "hidden"
                        ? "border-[#e7b9b1] bg-[#fff3f1]"
                        : "border-[#d9d0c0] bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">
                          {proposal.officeName} · {proposal.agentName}
                        </p>
                        <DemoDataLabel />
                        <p className="line-clamp-2 mt-1 text-sm leading-6 text-[#586155]">
                          {proposal.message}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#edf6ef] px-3 py-1 text-xs font-bold text-[#33523a]">
                        {proposal.createdAt}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {proposal.properties.map((property) => {
                        const comparisonId = `${proposal.id}:${property.id}`;
                        const isSelectedForComparison = selectedComparisonIds.includes(comparisonId);
                        return (
                        <div
                          key={property.id}
                          className={`rounded-lg border p-4 transition ${
                            isSelectedForComparison
                              ? "border-[#183F35] bg-[#EAF2EE]"
                              : "border-[#d9d0c0] bg-[#fbfaf6]"
                          }`}
                        >
                          <div className="mb-3 grid grid-cols-2 gap-2">
                            {property.photoUrls.slice(0, 2).map((photoUrl, index) => (
                              <PhotoTile
                                key={photoUrl}
                                src={photoUrl}
                                label={`${property.title} 사진 ${index + 1}`}
                                className={`${
                                  property.photoUrls.length === 1 ? "col-span-2" : ""
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <Building2 size={20} aria-hidden="true" />
                            <span className="text-xs font-semibold text-[#677064]">
                              {property.addressLabel}
                            </span>
                          </div>
                          <h3 className="mt-3 font-bold">{property.title}</h3>
                          <DemoDataLabel />
                          {showBuyerDashboard ? (
                            <button
                              type="button"
                              onClick={() => toggleComparisonItem(comparisonId)}
                              aria-pressed={isSelectedForComparison}
                              className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#183F35] focus:ring-offset-2 ${
                                isSelectedForComparison
                                  ? "border-[#183F35] bg-white text-[#183F35]"
                                  : "border-[#DEE4E0] bg-white text-[#356556]"
                              }`}
                            >
                              {isSelectedForComparison ? <Check size={17} aria-hidden="true" /> : null}
                              비교하기
                            </button>
                          ) : null}
                          <p className="mt-2 text-sm font-semibold text-[#2f6f45]">
                            {property.price}
                          </p>
                          <p className="mt-1 text-sm font-bold text-[#183F35]">
                            월 고정지출{" "}
                            {formatter.format(
                              Math.round(property.monthlyRent / 10000) +
                                Number(property.maintenanceFee.match(/\d+/)?.[0] ?? 0)
                            )}
                            만원
                          </p>
                          <p className="mt-1 text-sm text-[#677064]">
                            {property.area} · {property.floor} · {property.maintenanceFee}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {property.features.map((feature) => (
                              <Chip key={feature}>{feature}</Chip>
                            ))}
                          </div>
                          <p className="line-clamp-3 mt-3 text-sm leading-6 text-[#586155]">
                            {property.note}
                          </p>
                          <button
                            type="button"
                            onClick={() => setNotice(`${property.title} 상세 정보는 데모 카드 안의 사진, 가격, 조건 일치 항목으로 확인합니다.`)}
                            className="mt-2 min-h-9 text-sm font-extrabold text-[#356556]"
                          >
                            자세히 보기
                          </button>
                          <BrokerageFeeBox
                            legalMax={property.legalMaxBrokerageFee}
                            proposed={property.proposedBrokerageFee}
                            rateLabel={property.brokerageRateLabel}
                            formulaLabel={property.brokerageFormulaLabel}
                          />
                        </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_16rem]">
                      <KakaoMap
                        lat={proposal.properties[0].roughLat}
                        lng={proposal.properties[0].roughLng}
                        label={proposal.properties[0].addressLabel}
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={sendMessage}
                          disabled={isAgentBlocked}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-4 py-2 font-bold text-white disabled:bg-[#9ba397]"
                        >
                          <MessageCircle size={17} aria-hidden="true" />
                          제안별 채팅
                        </button>
                        {showBuyerDashboard ? (
                          <>
                            <button
                              onClick={() => requestViewing(proposal)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fee500] px-4 py-2 font-bold text-[#20251f]"
                            >
                              <ReceiptText size={17} aria-hidden="true" />
                              무료 방문예약
                            </button>
                            <button
                              onClick={() => addReport(`제안 ${proposal.id}`)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9d0c0] bg-white px-4 py-2 font-bold text-[#a94230]"
                            >
                              <Siren size={17} aria-hidden="true" />
                              허위매물 신고
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() =>
                              setNotice("방문예약 상태를 확인했습니다. 매물 갱신과 계약 완료 처리는 관리 카드에서 진행합니다.")
                            }
                            disabled={isAgentBlocked}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#fee500] px-4 py-2 font-bold text-[#20251f] disabled:bg-[#d8d0a2]"
                          >
                            <ReceiptText size={17} aria-hidden="true" />
                            방문예약 관리
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {showBuyerDashboard && !isComparisonMode && selectedComparisonItems.length > 0 ? (
              <div className="sticky bottom-3 z-20 mt-5 rounded-2xl border border-[#183F35] bg-white/95 p-3 shadow-[0_12px_32px_rgba(24,63,53,0.16)] backdrop-blur">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#183F35]">
                      제안 {selectedComparisonItems.length}개 선택
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedComparisonItems.map((item) => {
                        const label =
                          (comparisonSourceIdCounts[item.sourceListingId] ?? 0) > 1
                            ? item.officeName
                            : item.property.title;
                        return (
                          <span
                            key={item.comparisonId}
                            className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[#DEE4E0] bg-[#F7F5EF] px-3 py-1 text-xs font-extrabold text-[#69736F]"
                          >
                            <span className="min-w-0 truncate">{label}</span>
                            <span className="shrink-0 text-[#183F35]">{formatWon(item.property.proposedBrokerageFee)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={clearComparisonSelection}
                      className="min-h-11 rounded-xl border border-[#DEE4E0] bg-white px-4 py-2 text-sm font-extrabold text-[#69736F]"
                    >
                      선택 초기화
                    </button>
                    <button
                      type="button"
                      onClick={openComparisonMode}
                      disabled={selectedComparisonItems.length < 2}
                      className="min-h-11 rounded-xl bg-[#FFD84D] px-4 py-2 text-sm font-extrabold text-[#183F35] disabled:bg-[#d8d0a2] disabled:text-[#69736F]"
                    >
                      비교하기
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          ) : null}

          {(!showBuyerDashboard || buyerTab === "chat") ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">채팅</p>
                <h2 className="text-xl font-bold">제안별 1:1 대화</h2>
              </div>
              <MessageCircle size={22} aria-hidden="true" />
            </div>
            <div className="mt-5 flex min-h-[28rem] flex-col justify-between rounded-lg border border-[#d9d0c0] bg-[#f7f4ee] p-3">
              <div className="grid gap-3">
                {messages
                  .filter((message) => message.roomId === selectedProposal?.id)
                  .map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 ${
                        message.sender === "buyer"
                          ? "ml-auto bg-[#ffe24a] text-[#20251f]"
                          : "bg-white text-[#20251f]"
                      }`}
                    >
                      <p>{message.body}</p>
                      <p className="mt-1 text-xs opacity-70">{message.createdAt}</p>
                    </div>
                  ))}
              </div>
              <button
                onClick={sendMessage}
                disabled={!selectedProposal}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#20251f] px-4 py-2 font-bold text-white disabled:bg-[#9ba397]"
              >
                데모 메시지 보내기
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </div>
          ) : null}
        </section>
        ) : null}

        {((showBuyerDashboard && buyerTab === "appointments") || (showAgentDashboard && agentTab === "appointments")) ? (
        <section className={showBuyerDashboard ? "grid gap-4" : "grid gap-4"}>
          {showAgentDashboard ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-[#203927] p-5 text-white soft-shadow">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 text-[#ffe24a]" size={26} aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-[#ffe24a]">방문 일정 관리</p>
                <h2 className="mt-2 text-2xl font-bold">방문 약속과 고객 대화를 함께 확인합니다</h2>
                <p className="mt-3 text-sm leading-6 text-[#dce8d9]">
                  날짜순으로 방문 요청을 확인하고, 필요한 경우 제안 채팅으로 바로 이어가
                  일정과 조건을 조율합니다.
                </p>
              </div>
            </div>
          </div>
          ) : null}

          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">방문예약</p>
                <h2 className="text-xl font-bold">무료 예약과 중개보수 확인</h2>
              </div>
              <ReceiptText size={22} aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="rounded-lg border border-[#d9d0c0] bg-[#fbfaf6] p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">
                        {appointment.buyerName} · {appointment.agentName}
                      </p>
                      <p className="mt-1 text-sm text-[#677064]">
                        {appointment.scheduledFor} · BDB 예약비 0원
                      </p>
                    </div>
                    <span className="rounded-full bg-[#edf6ef] px-3 py-1 text-xs font-bold text-[#33523a]">
                      {appointment.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#586155]">
                    계약 체결 시에는 선택한 공인중개사에게 사전에 제안받은 법정 범위
                    내 중개보수가 발생합니다.
                  </p>
                  {showAgentDashboard ? (
                    <button
                      type="button"
                      onClick={() => setAgentTab("sent")}
                      className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#183F35] bg-white px-3 text-sm font-bold text-[#183F35]"
                    >
                      채팅 바로가기
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        {((showAgentDashboard && agentTab === "office") || showAdminDashboard || showBrokerReviewDashboard) ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {showAgentDashboard && agentTab === "office" ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">중개사 온보딩</p>
                <h2 className="text-xl font-bold">서류 업로드 후 승인 대기</h2>
              </div>
              <Upload size={22} aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["사무소명", "대표자명", "중개사 등록번호", "담당 지역"].map((label) => (
                <input
                  key={label}
                  placeholder={label}
                  className="min-h-11 rounded-lg border border-[#d9d0c0] px-3"
                />
              ))}
            </div>
            <label className="mt-3 flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#b9c7b4] bg-[#edf6ef] p-4 text-center text-sm font-semibold text-[#33523a]">
              <Upload size={22} aria-hidden="true" />
              사업자등록증 또는 중개사무소 등록증 업로드
              <input type="file" className="sr-only" />
            </label>
            <div className="mt-5 grid gap-3">
              <div className="rounded-lg border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                <p className="text-sm font-extrabold text-[#183F35]">대표 공인중개사</p>
                <p className="mt-2 text-sm leading-6 text-[#586155]">
                  공인중개사 자격, 중개사무소 등록, 사업자 또는 등록증 서류 확인 후
                  관리자가 승인합니다.
                </p>
              </div>
              <div className="rounded-lg border border-[#DEE4E0] bg-[#F7F5EF] p-4">
                <p className="text-sm font-extrabold text-[#183F35]">소속 공인중개사</p>
                <p className="mt-2 text-sm leading-6 text-[#586155]">
                  소속 중개사무소를 선택하고 대표 공인중개사의 승인과 관리자 승인을 받은 뒤
                  고객 요청 열람과 매물 제안이 가능합니다.
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#677064]">
              승인 상태가 `approved`가 되기 전에는 요청서 열람과 제안 생성이 제한됩니다.
            </p>
          </div>
          ) : null}

          {(showAdminDashboard || showBrokerReviewDashboard) ? (
          <div className="rounded-lg border border-[#d9d0c0] bg-white/95 p-5 soft-shadow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#54715b]">관리자</p>
                <h2 className="text-xl font-bold">중개사무소 인증 심사 · 신고 관리</h2>
              </div>
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3">
              <div className="rounded-lg border border-[#d9d0c0] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                        <p className="font-bold">서구우리공인중개사</p>
                        <p className="text-sm text-[#677064]">등록번호 27170-2026-00123</p>
                  </div>
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-3 py-2 text-sm font-bold text-white">
                    <Check size={16} aria-hidden="true" />
                    승인
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-[#d9d0c0] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">소속 승인 요청 · 이서준 공인중개사</p>
                    <p className="text-sm text-[#677064]">
                      대표 등록번호 {representativeLicenseNumber}로 소속 승인을 요청했습니다.
                    </p>
                  </div>
                  <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#2f6f45] px-3 py-2 text-sm font-bold text-white">
                    <Check size={16} aria-hidden="true" />
                    대표 승인
                  </button>
                </div>
              </div>
              {reports.map((report) => (
                <div key={report.id} className="rounded-lg border border-[#d9d0c0] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold">{report.target}</p>
                      <p className="mt-1 text-sm leading-6 text-[#677064]">
                        {report.reason}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#a94230]">
                        상태: {report.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectedProposal && hideProposal(selectedProposal.id)}
                        className="min-h-10 rounded-lg border border-[#d9d0c0] px-3 text-sm font-bold"
                      >
                        숨김
                      </button>
                      <button
                        onClick={() => resolveReport(report.id)}
                        className="min-h-10 rounded-lg bg-[#20251f] px-3 text-sm font-bold text-white"
                      >
                        해결
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-[#d9d0c0] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">허위매물 영구 이용 제한</p>
                    <p className="mt-1 text-sm leading-6 text-[#677064]">
                      고의적인 허위매물 신고가 확정되면 매물을 숨기고 해당 이용자를 제재합니다.
                    </p>
                  </div>
                  <button className="min-h-10 rounded-lg bg-[#20251f] px-3 text-sm font-bold text-white">
                    제재 처리
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-[#d9d0c0] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">매물 갱신·계약 상태 관리</p>
                    <p className="mt-1 text-sm leading-6 text-[#677064]">
                      매물은 30일마다 상태 갱신이 필요하며, 계약 완료 매물은 노출을 중단합니다.
                    </p>
                  </div>
                  <button className="min-h-10 rounded-lg border border-[#d9d0c0] px-3 text-sm font-bold">
                    상태 확인
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-[#d9d0c0] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-bold">중개보수 법정 상한 기준 관리</p>
                    <p className="mt-1 text-sm leading-6 text-[#677064]">
                      공인중개사가 제안하는 중개보수가 법정 상한 이내인지 기준표를 관리합니다.
                    </p>
                  </div>
                  <button className="min-h-10 rounded-lg border border-[#d9d0c0] px-3 text-sm font-bold">
                    기준표 관리
                  </button>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </section>
        ) : null}
      </div>
    </main>
  );
}
