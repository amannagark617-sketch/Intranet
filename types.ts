import { PRODUCTION_STAGES } from './constants';

export type ProductionStepName = typeof PRODUCTION_STAGES[number];

export interface StageDefinition {
  name: ProductionStepName;
  stepCode: string; // e.g. 'STEP 1', 'STEP 2', 'Purchase', 'STEP 3'
  timeline: string; // e.g. '07 Days Before Dispatch Date'
  how: string; // e.g. 'Manually', 'Carpentry Q.C. Google Form'
  responsible: string; // e.g. 'Mr. Sourav Yadav'
  formName?: string;
  hasRemarks?: boolean;
  hasQtyPass?: boolean;
  hasReasonOfFail?: boolean;
  hasAttachment?: boolean;
  hasDelayDays?: boolean;
  category: 'Carpentry & Framing' | 'Raw Material' | 'Upholstery & Foaming' | 'Assembly & QC' | 'Packaging & Dispatch';
  color: string;
}

export interface ProductionStep {
  name: ProductionStepName;
  stepCode: string;
  timeline: string;
  how: string;
  responsible: string;
  plannedDate: string | null;
  actualDate: string | null;
  status: 'Completed' | 'In Progress' | 'Pending' | 'Delayed' | 'Failed QC';
  delay: number | null;
  remarks?: string | null;
  qtyPass?: number | null;
  reasonOfFail?: string | null;
  attachment?: string | null;
  delayDays?: number | null;
}

export interface Order {
  dispatchDate: string | null;
  opfNo: string;
  quantity: number;
  modelName: string;
  upholstery: string;
  opfReceiveDate?: string | null;
  steps: ProductionStep[];
  currentStage: ProductionStepName | null;
  overallStatus: 'WIP' | 'On Hold' | 'Dispatched' | 'Ready' | 'Delayed';
  currentResponsible?: string;
  isArchived?: boolean;
  source?: 'live' | 'archive';
  finalQcQtyPass?: number | null;
  finalQcStatus?: string | null;
}

export interface Insight {
  title: string;
  description: string;
  severity?: 'normal' | 'warning' | 'critical' | 'positive';
}

export interface AISuggestion {
  id: string;
  category: 'Target & Run-Rate' | 'Bottlenecks & Flow' | 'Hold Orders & Clearance' | 'Dispatch & Stock' | 'Quality & Efficiency';
  priority: 'HIGH' | 'MEDIUM' | 'OPPORTUNITY';
  title: string;
  observation: string;
  actionPlan: string;
  expectedImpact: string;
  responsibleDept: string;
}

export interface ProductionAIAnalysis {
  executiveSummary: string;
  targetHealthScore: number;
  targetStatus: 'On Track' | 'At Risk' | 'Behind Pace' | 'Exceptional';
  dailyRunRateVsRequired: {
    currentDailyAvg: number;
    requiredDailyTarget: number;
    dailyShortfallOrSurplus: number;
    workingDaysRemaining: number;
  };
  projectedMonthEndUnits: number;
  projectedTargetAchievementPct: number;
  topBottlenecks: Array<{
    stageName: string;
    wipOrders: number;
    wipUnits: number;
    responsible: string;
    delayImpact: string;
  }>;
  holdOrdersImpact: {
    totalHoldOrders: number;
    totalHoldUnits: number;
    actionSummary: string;
  };
  readyStockOpportunity: {
    readyGoodsUnits: number;
    readyStockUnits: number;
    dispatchPendingUnits: number;
  };
  suggestions: AISuggestion[];
}

export interface AIPlantContext {
  selectedMonth: string;
  target: number;
  achievedQcPassed: number;
  achievementPct: number;
  workingDaysTotal: number;
  workingDaysElapsed: number;
  workingDaysRemaining: number;
  dailyAvgPace: number;
  dailyRequiredPace: number;
  dailyPaceDelta: number;
  projectedUnits: number;
  totalFloorQueueOrders: number;
  totalFloorQueueUnits: number;
  currentMonthQueueUnits: number;
  backlogOrdersUnits: number;
  nextMonthAdvanceUnits: number;
  holdOrdersCount: number;
  holdOrdersUnits: number;
  dispatchedMonthlyTotal: number;
  readyGoodsUnits: number;
  readyStockUnits: number;
  qcPassedNotDispatchedUnits: number;
  bottleneckStages: Array<{
    stage: string;
    orders: number;
    units: number;
    responsible: string;
  }>;
  topHoldReasons?: string[];
  rejectionRatePct?: number;
}

export interface FinalQcRecord {
  timestamp: string; // e.g. "04-Jun-2024 11:40:42"
  dateYMD: string; // e.g. "2024-06-04"
  monthKey: string; // e.g. "2024-06"
  opfNo: string;
  factoryNo: string;
  totalQuantity: number;
  passQuantity: number;
  rejectedQuantity: number;
  qcInspector: string;
  productImageUrls: string[];
  status: 'Pass' | 'Rejected';
  passRemarks: string;
}

export interface QcMonthlyAggregate {
  monthKey: string; // "2025-09"
  monthDisplay: string; // "Sep 2025"
  target: number;
  achieved: number; // passQuantity sum
  dispatched: number;
  achPct: number;
  dispPct: number;
  totalBatchSubmissions: number;
  passedUnits: number;
  rejectedUnits: number;
}

export interface UploadedDataset {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columns: string[];
  summary: string;
  previewRows: Record<string, any>[];
  rawTextContext?: string;
  uploadedAt: string;
}

export interface AIAgentMessage {
  id: string;
  author: 'user' | 'ai';
  content: string;
  timestamp: string;
  sourcesCited?: string[];
  suggestedFollowups?: string[];
  isThinking?: boolean;
}


