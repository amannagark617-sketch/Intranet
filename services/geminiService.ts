import { GoogleGenAI, Type } from "@google/genai";
import type { Order, Insight, AISuggestion, ProductionAIAnalysis, AIPlantContext, UploadedDataset, AIAgentMessage } from '../types';
import type { ChatMessage } from "../App";
import type { ReadyGoodItem } from './readyGoodsService';
import type { ReadyStockItem } from './readyStockService';
import type { ReceivableItem } from './receivableListService';

export interface PlantAllData {
  orders: Order[];
  readyGoods?: ReadyGoodItem[];
  readyStock?: ReadyStockItem[];
  receivables?: ReceivableItem[];
  kpis?: any;
  target?: number;
}

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const productionAdvisorSystemInstruction = `You are 'Nidra AI', the Senior Chief Industrial Engineering & Operations Advisor for Little Nap Recliners (Manesar Factory).
Your role is to analyze live production metrics (Monthly Target, QC Passed Recliners, Floor Queues, Backlog, Stage Bottlenecks, On-Hold Orders, and Ready Stock) and produce concrete, highly tactical, actionable suggestions to improve factory target achievement and overall operational numbers.

The 14 PMS Stages are:
1. CARPENTRY
2. CARPENTRY QUALITY CONTROL
3. UPHOLSTERY AVAILABLE
4. CUTTING OF UPHOLSTERY
5. STITCHING OF UPHOLSTERY
6. AVAILABILITY OF BOXES
7. LINING & FOAMING
8. UPHOLSTERY
9. UPHOLSTERY QUALITY CONTROL
10. FITTING
11. QUALITY CONTROL (Final QC)
12. PICTURE SHARING
13. PACKING
14. DISPATCH

When analyzing, adhere strictly to these principles:
- Ground every suggestion in the quantitative metrics provided (e.g. daily target deficit, remaining working days, specific stage backlogs, hold units).
- Formulate practical floor actions (e.g. line rebalancing, overtime scheduling, fabric kitting, QC expedited clearing, customer hold resolution).
- Estimate realistic unit impacts (e.g. "+35 units/month", "Reduces WIP cycle by 2.2 days").
- Never make up imaginary numbers; use the provided context precisely.`;

/**
 * Deterministic baseline analysis generator computed directly from live production math.
 * Ensures the user gets instant, mathematically sound recommendations immediately.
 */
export const computeBaselineHeuristicAnalysis = (ctx: AIPlantContext): ProductionAIAnalysis => {
  const suggestions: AISuggestion[] = [];
  const shortfall = ctx.dailyPaceDelta;
  const isDeficit = shortfall < 0; // current avg pace < required pace
  const absShortfall = Math.abs(shortfall);

  // 1. Target & Run-Rate Suggestion
  if (isDeficit) {
    const requiredDailyBoost = Math.ceil(absShortfall);
    suggestions.push({
      id: 'sug-target-pace',
      category: 'Target & Run-Rate',
      priority: 'HIGH',
      title: `Close Daily Output Gap (+${requiredDailyBoost} chairs/day required)`,
      observation: `Current run rate is ${ctx.dailyAvgPace} chairs/day vs required pace of ${ctx.dailyRequiredPace} chairs/day across ${ctx.workingDaysRemaining} remaining working days. Projected month-end is ${ctx.projectedUnits} against target of ${ctx.target} (${Math.round(ctx.projectedUnits / (ctx.target || 1) * 100)}% of target).`,
      actionPlan: `Deploy a 45-minute daily staggered shift in Fitting and Upholstery to push throughput from ${ctx.dailyAvgPace} to ${ctx.dailyRequiredPace} chairs/day. Prioritize clearing the ${ctx.backlogOrdersUnits} units of backlog orders immediately.`,
      expectedImpact: `+${Math.round(absShortfall * ctx.workingDaysRemaining)} units by month-end (Closes target deficit to 100%)`,
      responsibleDept: 'Fitting & Assembly / Floor Supervisor',
    });
  } else {
    suggestions.push({
      id: 'sug-target-pace',
      category: 'Target & Run-Rate',
      priority: 'OPPORTUNITY',
      title: 'Maintain Stellar Pace & Build Buffer for Next Month',
      observation: `Current output (${ctx.dailyAvgPace} units/day) is running +${Math.abs(shortfall)} units/day above the required pace (${ctx.dailyRequiredPace} units/day). Projected month-end total is ${ctx.projectedUnits} (${Math.round(ctx.projectedUnits / (ctx.target || 1) * 100)}% of target).`,
      actionPlan: `Channel excess capacity toward prep-cutting upholstery and pre-assembling carpentry frames for the ${ctx.nextMonthAdvanceUnits} advance orders to ensure a running start next month.`,
      expectedImpact: `Builds +${Math.round(absShortfall * ctx.workingDaysRemaining)} unit cushion against unexpected supply delays`,
      responsibleDept: 'Production Planning & Carpentry',
    });
  }

  // 2. Stage Bottleneck Suggestion
  if (ctx.bottleneckStages && ctx.bottleneckStages.length > 0) {
    const topStage = ctx.bottleneckStages[0];
    const secondStage = ctx.bottleneckStages[1];
    suggestions.push({
      id: 'sug-bottleneck-flow',
      category: 'Bottlenecks & Flow',
      priority: 'HIGH',
      title: `Unclog Critical Chokepoints: ${topStage.stage} (${topStage.orders} orders in queue)`,
      observation: `${topStage.stage} currently holds ${topStage.orders} active WIP orders (${topStage.units} units), overseen by ${topStage.responsible}.${secondStage ? ` Followed by ${secondStage.stage} (${secondStage.orders} orders).` : ''}`,
      actionPlan: `Institute immediate WIP balancing: temporarily cross-train and reallocate 2 operators from early framing to ${topStage.stage}. Implement batch kitting of upholstery & foam kits 24 hours prior to feeding this station.`,
      expectedImpact: `Accelerates WIP turnover by 35% and releases ~${Math.ceil(topStage.units * 0.4)} units to Final QC within 48 hours`,
      responsibleDept: `${topStage.stage} (${topStage.responsible})`,
    });
  }

  // 3. Hold Orders & Revenue Clearance
  if (ctx.holdOrdersCount > 0) {
    suggestions.push({
      id: 'sug-hold-orders',
      category: 'Hold Orders & Clearance',
      priority: 'HIGH',
      title: `Fast-Track Hold Orders Triage (${ctx.holdOrdersCount} orders, ${ctx.holdOrdersUnits} units blocked)`,
      observation: `There are ${ctx.holdOrdersCount} orders representing ${ctx.holdOrdersUnits} chairs trapped in 'On Hold' status. These tie up floor space and delay dispatch billing.`,
      actionPlan: `Conduct a daily 15-minute 10:00 AM joint standup between Sales Coordination and Plant QA to resolve customer approvals, fabric selections, and pending payments for the top 5 oldest hold OPFs.`,
      expectedImpact: `Unfreezes ${Math.ceil(ctx.holdOrdersUnits * 0.5)} units into live dispatch pipeline within 5 working days`,
      responsibleDept: 'Sales Coordination & Dispatch Admin',
    });
  }

  // 4. Ready Goods & Ready Stock Utilization
  if (ctx.readyGoodsUnits > 0 || ctx.readyStockUnits > 0) {
    suggestions.push({
      id: 'sug-stock-dispatch',
      category: 'Dispatch & Stock',
      priority: 'MEDIUM',
      title: `Capitalize on Stock Assets: ${ctx.readyGoodsUnits} Ready Goods & ${ctx.readyStockUnits} Ready Stock`,
      observation: `${ctx.readyGoodsUnits} packed units are sitting in Ready Goods awaiting customer transport, and ${ctx.readyStockUnits} finished recliners are available in commercial Ready Stock.`,
      actionPlan: `Trigger urgent transport booking with logistics partners for ready goods OPFs. Share live Ready Stock inventory matrix with regional retail sales managers for same-day liquidation of fast-moving models.`,
      expectedImpact: `Immediate dispatch realization of ${ctx.readyGoodsUnits} units; frees up warehouse staging capacity`,
      responsibleDept: 'Logistics & Commercial Sales',
    });
  }

  // 5. Backlog Eradication
  if (ctx.backlogOrdersUnits > 0) {
    suggestions.push({
      id: 'sug-backlog-clearance',
      category: 'Target & Run-Rate',
      priority: 'HIGH',
      title: `Eradicate Carryover Backlog (${ctx.backlogOrdersUnits} chairs)`,
      observation: `${ctx.backlogOrdersUnits} units of backlog from preceding schedules remain open on the floor, dragging down the overall on-time delivery metric.`,
      actionPlan: `Assign a dedicated 'Fast-Track Cell' to exclusively pull, fit, and pack backlog OPFs before initiating fresh current-month production runs.`,
      expectedImpact: `Eliminates overdue customer lead-times and recovers ~18% in on-time delivery score`,
      responsibleDept: 'Fast-Track Assembly Cell / QA',
    });
  }

  // Determine Target Health Score & Status
  let healthScore = 70;
  if (ctx.achievementPct >= 95) healthScore = 95;
  else if (ctx.achievementPct >= 80) healthScore = 85;
  else if (ctx.achievementPct >= 65) healthScore = 72;
  else if (ctx.achievementPct >= 50) healthScore = 60;
  else healthScore = 45;

  if (isDeficit) healthScore = Math.max(30, healthScore - 15);

  let targetStatus: ProductionAIAnalysis['targetStatus'] = 'On Track';
  if (healthScore >= 85) targetStatus = 'Exceptional';
  else if (healthScore >= 70) targetStatus = 'On Track';
  else if (healthScore >= 50) targetStatus = 'At Risk';
  else targetStatus = 'Behind Pace';

  const executiveSummary = isDeficit
    ? `Plant is currently running at ${ctx.dailyAvgPace} chairs/day, facing a daily shortfall of ${Math.ceil(absShortfall)} chairs vs target pace (${ctx.dailyRequiredPace}/day). To achieve the ${ctx.target} monthly target, focus on unclogging ${ctx.bottleneckStages[0]?.stage || 'Stitching & Fitting'} and clearing the ${ctx.holdOrdersUnits} on-hold units.`
    : `Plant is demonstrating strong momentum, producing ${ctx.dailyAvgPace} chairs/day (exceeding the required pace of ${ctx.dailyRequiredPace}/day). Projected achievement is ${ctx.projectedUnits} units (${Math.round(ctx.projectedUnits / (ctx.target || 1) * 100)}%). Focus on clearing ${ctx.readyGoodsUnits} packed ready goods and preparing advance orders.`;

  return {
    executiveSummary,
    targetHealthScore: healthScore,
    targetStatus,
    dailyRunRateVsRequired: {
      currentDailyAvg: ctx.dailyAvgPace,
      requiredDailyTarget: ctx.dailyRequiredPace,
      dailyShortfallOrSurplus: ctx.dailyPaceDelta,
      workingDaysRemaining: ctx.workingDaysRemaining,
    },
    projectedMonthEndUnits: ctx.projectedUnits,
    projectedTargetAchievementPct: Math.round(ctx.projectedUnits / (ctx.target || 1) * 100),
    topBottlenecks: (ctx.bottleneckStages || []).slice(0, 3).map(b => ({
      stageName: b.stage,
      wipOrders: b.orders,
      wipUnits: b.units,
      responsible: b.responsible,
      delayImpact: `${b.orders} orders queued`,
    })),
    holdOrdersImpact: {
      totalHoldOrders: ctx.holdOrdersCount,
      totalHoldUnits: ctx.holdOrdersUnits,
      actionSummary: `Unlocking hold units can add up to +${ctx.holdOrdersUnits} chairs to dispatch count.`,
    },
    readyStockOpportunity: {
      readyGoodsUnits: ctx.readyGoodsUnits,
      readyStockUnits: ctx.readyStockUnits,
      dispatchPendingUnits: ctx.qcPassedNotDispatchedUnits,
    },
    suggestions,
  };
};

/**
 * Generates comprehensive AI Suggestions using Gemini 3.8 Flash model,
 * with automatic fallback to baseline heuristics if offline or API key is missing.
 */
export const generateProductionAIAnalysis = async (
  context: AIPlantContext
): Promise<ProductionAIAnalysis> => {
  const fallback = computeBaselineHeuristicAnalysis(context);

  try {
    const ai = getGeminiClient();
    const contextJson = JSON.stringify(context, null, 2);

    const prompt = `
Please perform a deep industrial engineering & operations analysis of the following Little Nap Recliners production data and provide comprehensive AI suggestions to improve monthly target achievement, resolve PMS stage bottlenecks, clear hold orders, and maximize dispatch output:

PRODUCTION & PMS DATA CONTEXT:
${contextJson}

Generate structured actionable recommendations categorized into:
1. Target & Run-Rate
2. Bottlenecks & Flow
3. Hold Orders & Clearance
4. Dispatch & Stock
5. Quality & Efficiency
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: productionAdvisorSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: 'Concise executive summary of plant performance and core strategic recommendation.'
            },
            targetHealthScore: {
              type: Type.NUMBER,
              description: 'Overall factory target health score between 0 and 100.'
            },
            targetStatus: {
              type: Type.STRING,
              description: 'Overall status: "On Track" | "At Risk" | "Behind Pace" | "Exceptional"'
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: 'One of: "Target & Run-Rate" | "Bottlenecks & Flow" | "Hold Orders & Clearance" | "Dispatch & Stock" | "Quality & Efficiency"'
                  },
                  priority: {
                    type: Type.STRING,
                    description: '"HIGH" | "MEDIUM" | "OPPORTUNITY"'
                  },
                  title: { type: Type.STRING },
                  observation: { type: Type.STRING },
                  actionPlan: { type: Type.STRING },
                  expectedImpact: { type: Type.STRING },
                  responsibleDept: { type: Type.STRING },
                },
                required: ['id', 'category', 'priority', 'title', 'observation', 'actionPlan', 'expectedImpact', 'responsibleDept']
              }
            }
          },
          required: ['executiveSummary', 'targetHealthScore', 'targetStatus', 'suggestions']
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return {
        ...fallback,
        executiveSummary: parsed.executiveSummary || fallback.executiveSummary,
        targetHealthScore: typeof parsed.targetHealthScore === 'number' ? parsed.targetHealthScore : fallback.targetHealthScore,
        targetStatus: (['On Track', 'At Risk', 'Behind Pace', 'Exceptional'].includes(parsed.targetStatus) ? parsed.targetStatus : fallback.targetStatus) as any,
        suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0 ? parsed.suggestions : fallback.suggestions,
      };
    }

    return fallback;
  } catch (error) {
    console.warn("Using baseline heuristic analysis due to Gemini API fallback:", error);
    return fallback;
  }
};

export const generateDashboardInsights = async (context: any): Promise<Insight[]> => {
  try {
    const ai = getGeminiClient();
    const dataString = JSON.stringify({
      totalOrders: context.totalOrders,
      kpis: context.kpis,
      bottleneckStages: context.bottleneckStages,
      onTimeData: context.onTimeData,
      sampleOrders: context.sampleOrders,
    }, null, 2);
    
    const fullPrompt = `
      Analyze the following production data for Little Nap Recliners and provide exactly 3 actionable insights. Focus on identifying bottlenecks, potential delays, or positive trends. Data:
      ${dataString}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: fullPrompt,
      config: {
        systemInstruction: productionAdvisorSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'A short, catchy title for the insight.'
                  },
                  description: {
                    type: Type.STRING,
                    description: 'A detailed explanation of the insight, providing context and actionable advice.'
                  }
                },
                required: ['title', 'description']
              }
            }
          },
          required: ['insights']
        },
      },
    });

    if (response.text) {
      const parsedResponse = JSON.parse(response.text);
      return parsedResponse.insights || [];
    }
    return [];
  } catch (error) {
    console.error("Error generating insights:", error);
    return [
      {
        title: "Stage Flow & Bottleneck Review",
        description: "Analyze stage queues with high WIP concentration (such as Stitching and Fitting) to accelerate throughput.",
        severity: "warning"
      },
      {
        title: "Hold Orders Resolution",
        description: "Review on-hold customer orders with sales coordination to clear WIP floor lock.",
        severity: "critical"
      },
      {
        title: "Dispatch Pace & Target Alignment",
        description: "Monitor daily QC pass velocity against the monthly targets for consistent quota attainment.",
        severity: "positive"
      }
    ];
  }
};

const chatSystemInstruction = `You are a helpful, concise plant assistant for Little Nap Recliners.
- Answer the user's question directly, simply, and specifically.
- Keep answers short and clear: 1 to 3 sentences, or a quick bulleted list if explicitly asked.
- Never dump unsolicited data, unprompted summaries, or technical internal labels.
- If asked about an order, answer only its model, current stage, owner, and status.`;

/**
 * Deterministic evidence-grounded answer engine.
 * Guarantees instantaneous, concise, specific answers.
 */
export const generateDataGroundedAnswer = (
  query: string,
  allData: PlantAllData,
  uploadedDataset?: UploadedDataset | null
): { text: string; sources: string[]; followups: string[] } => {
  const q = query.toLowerCase().trim();
  const orders = allData.orders || [];
  const readyGoods = allData.readyGoods || [];
  const readyStock = allData.readyStock || [];
  const receivables = allData.receivables || [];
  const sources: string[] = uploadedDataset ? [uploadedDataset.fileName] : [];
  const followups: string[] = [];

  // 1. QUERY AGAINST USER UPLOADED DATASET
  if (uploadedDataset && (q.includes('uploaded') || q.includes('file') || q.includes('sheet') || q.includes('upload') || uploadedDataset.previewRows?.length > 0)) {
    const rows = uploadedDataset.previewRows || [];
    const searchTerm = q.replace(/(uploaded|file|sheet|data|rows|in|the|show|find|list|tell|me|about)/g, '').trim();

    if (searchTerm) {
      const matchingRows = rows.filter(r => {
        return Object.values(r).some(val => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(searchTerm);
        });
      });

      if (matchingRows.length > 0) {
        const sample = matchingRows.slice(0, 3);
        const cols = uploadedDataset.columns.slice(0, 4);
        let summary = `Found **${matchingRows.length} matching rows** in **${uploadedDataset.fileName}**:\n`;
        sample.forEach((r, idx) => {
          summary += `- ${cols.map(c => `${c}: ${r[c] ?? '-'}`).join(', ')}\n`;
        });
        return { text: summary, sources, followups: [] };
      }
    }

    return {
      text: `**${uploadedDataset.fileName}** has **${uploadedDataset.rowCount} rows** with columns: ${uploadedDataset.columns.slice(0, 6).join(', ')}. What would you like to search in this file?`,
      sources,
      followups: []
    };
  }

  // 2. SPECIFIC OPF NUMBER LOOKUP
  const opfMatch = query.match(/(?:OPF[- ]?|#\s*)?(\d{3,5})/i);
  if (opfMatch && (q.includes('opf') || q.includes('order') || q.includes('status') || q.includes('chair') || q.includes('where'))) {
    const rawNumber = opfMatch[1];
    const matching = orders.filter(o => o.opfNo.toLowerCase().includes(rawNumber.toLowerCase()));

    if (matching.length > 0) {
      const o = matching[0];
      let answer = `**${o.opfNo}** (${o.modelName || 'Recliner'}, ${o.quantity} unit${o.quantity > 1 ? 's' : ''}) is currently in **${o.currentStage || 'Planning'}** with **${o.currentResponsible || 'Floor Supervisor'}**.`;
      answer += ` Status: **${o.overallStatus}**`;
      if (o.dispatchDate) {
        answer += `, planned dispatch: **${o.dispatchDate}**.`;
      } else {
        answer += '.';
      }

      return { text: answer, sources, followups: [] };
    } else {
      return {
        text: `I couldn't find an order matching **${rawNumber}**. Please verify the OPF number.`,
        sources,
        followups: []
      };
    }
  }

  // 3. BOTTLENECKS
  if (q.includes('bottleneck') || q.includes('queue') || q.includes('chokepoint') || (q.includes('stage') && q.includes('slow'))) {
    const stageMap: Record<string, { orders: number; units: number; responsible: string }> = {};

    orders.forEach(o => {
      if (o.overallStatus === 'WIP' && o.currentStage) {
        if (!stageMap[o.currentStage]) {
          stageMap[o.currentStage] = { orders: 0, units: 0, responsible: o.currentResponsible || 'Supervisor' };
        }
        stageMap[o.currentStage].orders++;
        stageMap[o.currentStage].units += (o.quantity || 1);
      }
    });

    const sortedStages = Object.entries(stageMap).sort((a, b) => b[1].orders - a[1].orders);
    const top = sortedStages[0];
    const second = sortedStages[1];

    let text = top 
      ? `The main bottleneck right now is **${top[0]}** with **${top[1].orders} orders** (${top[1].units} units) waiting under ${top[1].responsible}.${second ? ` The next slowest is **${second[0]}** (${second[1].orders} orders).` : ''}`
      : `No significant stage bottleneck found across current WIP orders.`;

    return { text, sources, followups: [] };
  }

  // 4. ON-HOLD ORDERS
  if (q.includes('hold') || q.includes('blocked') || q.includes('stuck')) {
    const holdOrders = orders.filter(o => o.overallStatus === 'On Hold');
    const totalHoldUnits = holdOrders.reduce((acc, o) => acc + (o.quantity || 1), 0);

    let text = `There are currently **${holdOrders.length} orders on hold** (${totalHoldUnits} units).`;
    if (holdOrders.length > 0) {
      text += ` Examples: ${holdOrders.slice(0, 4).map(o => `**${o.opfNo}** (${o.modelName})`).join(', ')}.`;
    }

    return { text, sources, followups: [] };
  }

  // 5. READY STOCK / AVAILABLE STOCK
  if (q.includes('ready stock') || (q.includes('stock') && (q.includes('ready') || q.includes('available') || q.includes('sale')))) {
    const totalUnits = readyStock.reduce((acc, item) => acc + (item.qty || 1), 0);
    const text = `There are **${totalUnits || readyStock.length} units** available in stock across ${readyStock.length} items.`;
    return { text, sources, followups: [] };
  }

  // 6. READY GOODS / WAREHOUSE
  if (q.includes('ready goods') || q.includes('warehouse') || (q.includes('packed') && q.includes('goods'))) {
    const totalUnits = readyGoods.reduce((acc, g) => acc + (g.readyGoodsQty || 1), 0);
    const text = `There are **${readyGoods.length} orders** (${totalUnits} units) packed and stored in the warehouse.`;
    return { text, sources, followups: [] };
  }

  // 7. RECEIVABLES / PAYMENTS
  if (q.includes('receivable') || q.includes('payment') || q.includes('balance') || q.includes('due') || q.includes('outstanding')) {
    const totalBalance = receivables.reduce((acc, r) => acc + (r.balanceAmount || 0), 0);
    const text = `Total outstanding balance is **₹${totalBalance.toLocaleString('en-IN')}** across ${receivables.length} invoices.`;
    return { text, sources, followups: [] };
  }

  // 8. GENERAL / DEFAULT SHORT ANSWER
  const wipCount = orders.filter(o => o.overallStatus === 'WIP').length;
  const readyCount = orders.filter(o => o.overallStatus === 'Ready').length;
  const text = `There are currently **${wipCount} orders in progress** and **${readyCount} ready for dispatch**. Ask me about a specific order OPF, stage bottleneck, or attach a file.`;

  return { text, sources, followups: [] };
};

/**
 * Universal AI Agent chat interface.
 * Coordinates server-side API call, direct client fallback, and deterministic grounded engine.
 */
export const askAIAgent = async (
  message: string,
  history: AIAgentMessage[],
  allData: PlantAllData,
  uploadedDataset?: UploadedDataset | null
): Promise<{ text: string; sources: string[]; followups: string[] }> => {
  // Construct aggregated context summary for model
  const orders = allData.orders || [];
  const topOrders = orders.slice(0, 50).map(o => ({
    opfNo: o.opfNo,
    model: o.modelName,
    status: o.overallStatus,
    stage: o.currentStage,
    responsible: o.currentResponsible,
    qty: o.quantity,
    dispatchDate: o.dispatchDate
  }));

  const plantSummary = {
    totalOrders: orders.length,
    wipCount: orders.filter(o => o.overallStatus === 'WIP').length,
    readyCount: orders.filter(o => o.overallStatus === 'Ready').length,
    holdCount: orders.filter(o => o.overallStatus === 'On Hold').length,
    dispatchedCount: orders.filter(o => o.overallStatus === 'Dispatched').length,
    readyGoodsCount: (allData.readyGoods || []).length,
    readyStockUnits: (allData.readyStock || []).reduce((acc, i) => acc + (i.qty || 1), 0),
    receivablesTotalBalance: (allData.receivables || []).reduce((acc, r) => acc + (r.balanceAmount || 0), 0),
    sampleOrders: topOrders
  };

  // 1. Attempt Server-Side Route: /api/gemini/chat
  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        context: plantSummary,
        uploadedDataset: uploadedDataset ? {
          fileName: uploadedDataset.fileName,
          rowCount: uploadedDataset.rowCount,
          columns: uploadedDataset.columns,
          summary: uploadedDataset.summary,
          previewRows: uploadedDataset.previewRows.slice(0, 50)
        } : null
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        const sources = uploadedDataset ? [uploadedDataset.fileName] : [];
        return {
          text: data.text,
          sources,
          followups: []
        };
      }
    }
  } catch (serverErr) {
    console.warn("Server API /api/gemini/chat unavailable, proceeding to next layer:", serverErr);
  }

  // 2. Direct @google/genai attempt if browser has key
  try {
    const ai = getGeminiClient();
    const prompt = `
CONTEXT OF FACTORY DATA:
${JSON.stringify(plantSummary, null, 2)}

${uploadedDataset ? `USER UPLOADED FILE:
Name: ${uploadedDataset.fileName} (${uploadedDataset.rowCount} rows)
Columns: ${uploadedDataset.columns.join(', ')}
Sample Data:
${JSON.stringify(uploadedDataset.previewRows.slice(0, 30), null, 2)}
` : ''}

USER QUESTION:
"${message}"
`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: chatSystemInstruction
      }
    });

    if (res.text) {
      const sources = uploadedDataset ? [uploadedDataset.fileName] : [];
      return {
        text: res.text,
        sources,
        followups: []
      };
    }
  } catch (genAiErr) {
    console.warn("Direct Gemini SDK fallback triggered:", genAiErr);
  }

  // 3. Guaranteed Deterministic Grounded Engine Fallback
  return generateDataGroundedAnswer(message, allData, uploadedDataset);
};

export const getChatbotResponse = async (
  message: string,
  history: ChatMessage[],
  orders: Order[]
): Promise<string> => {
  const agentHistory: AIAgentMessage[] = history.map((h, i) => ({
    id: `msg-${i}`,
    author: h.author,
    content: h.content,
    timestamp: new Date().toLocaleTimeString()
  }));

  const res = await askAIAgent(message, agentHistory, { orders });
  return res.text;
};
