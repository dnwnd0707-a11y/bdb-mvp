export type Role = "buyer" | "agent" | "admin";

export type AgentKind = "representative" | "affiliated";

export type AgentApprovalStatus = "none" | "pending_admin" | "pending_representative" | "approved";

export type RequestStatus = "open" | "matched" | "closed";

export type BuyerRequest = {
  id: string;
  title: string;
  buyerName: string;
  regions: string[];
  transactionType: "전세" | "월세" | "둘 다 가능";
  housingType: string;
  depositRange: string;
  rentRange: string;
  budgetSummary?: string;
  moveIn: string;
  rooms: string;
  area: string;
  floor: string;
  direction: string;
  parking: boolean;
  pets: boolean;
  loan: boolean;
  maintenanceFee: string;
  mustHaves: string[];
  memo: string;
  status: RequestStatus;
  proposalCount: number;
};

export type Property = {
  id: string;
  sourceListingId?: string;
  title: string;
  addressLabel: string;
  photoUrls: string[];
  deposit: number;
  monthlyRent: number;
  price: string;
  maintenanceFee: string;
  area: string;
  floor: string;
  features: string[];
  roughLat: number;
  roughLng: number;
  note: string;
  legalMaxBrokerageFee: number;
  proposedBrokerageFee: number;
  brokerageRateLabel: string;
  brokerageFormulaLabel: string;
  brokerageRuleId: string;
  brokerageSourceUrl: string;
};

export type Proposal = {
  id: string;
  requestId: string;
  agentId?: string;
  officeId?: string;
  agentName: string;
  officeName: string;
  message: string;
  createdAt: string;
  properties: Property[];
  status: "new" | "chatting" | "hidden";
};

export type Message = {
  id: string;
  roomId: string;
  sender: "buyer" | "agent";
  body: string;
  createdAt: string;
  hidden?: boolean;
};

export type Report = {
  id: string;
  target: string;
  reason: string;
  status: "open" | "reviewing" | "resolved";
};

export type ViewingAppointment = {
  id: string;
  proposalId: string;
  buyerName: string;
  agentName: string;
  scheduledFor: string;
  viewingFee: number;
  status: "requested" | "confirmed" | "completed" | "credited" | "forfeited";
};
