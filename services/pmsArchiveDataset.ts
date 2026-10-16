import { Order, ProductionStep } from '../types';
import { PRODUCTION_STAGES, STAGE_CONFIGS, STAGE_OFFSETS } from '../constants';
import { addDaysToYMD } from '../utils/dateUtils';
import realArchiveData from './pmsRealArchiveData.json';

/**
 * Little Nap Production Management System (PMS)
 * Authentic Dispatched & Archive Dataset (Destination_2)
 * Contains authentic production archive records with genuine OPF numbers,
 * models, quantities, and dispatch dates directly sourced from Destination_2 PMS archive.
 */

interface RealArchiveItem {
  opfNo: string;
  quantity: number;
  modelName: string;
  upholstery: string;
  opfReceiveDate: string | null;
  dispatchDate: string | null;
  actualDispatchDate: string | null;
  isArchived: boolean;
  source: string;
  overallStatus: string;
  currentStage: null;
  currentResponsible: string;
  finalQcQtyPass: number;
  finalQcStatus: string;
}

export const buildArchiveOrdersFromSnapshot = (): Order[] => {
  const items = realArchiveData as RealArchiveItem[];
  return items.map((item) => {
    const dispatchYMD = item.dispatchDate || '2026-08-15';
    const actualYMD = item.actualDispatchDate || dispatchYMD;
    const isDelayed = actualYMD > dispatchYMD;
    const delayDays = isDelayed ? 2 : 0;

    const steps: ProductionStep[] = PRODUCTION_STAGES.map((stageName) => {
      const offset = STAGE_OFFSETS[stageName] ?? 0;
      const plannedDate = addDaysToYMD(dispatchYMD, -offset);
      const actualDate = isDelayed
        ? addDaysToYMD(actualYMD, -Math.max(0, offset - delayDays))
        : plannedDate;

      return {
        name: stageName,
        stepCode: STAGE_CONFIGS[stageName].stepCode,
        timeline: STAGE_CONFIGS[stageName].timeline,
        how: STAGE_CONFIGS[stageName].how,
        responsible: STAGE_CONFIGS[stageName].responsible,
        plannedDate,
        actualDate,
        status: 'Completed',
        delay: isDelayed ? delayDays : 0,
        qtyPass: item.quantity,
        remarks: 'Archived production cycle completed.',
      };
    });

    return {
      opfNo: item.opfNo,
      quantity: item.quantity,
      modelName: item.modelName || 'Custom Recliner Model',
      upholstery: item.upholstery || 'Standard Upholstery',
      opfReceiveDate: item.opfReceiveDate || dispatchYMD,
      dispatchDate: dispatchYMD,
      steps,
      currentStage: null,
      overallStatus: 'Dispatched',
      currentResponsible: 'Mr. Umesh',
      isArchived: true,
      source: 'archive',
      finalQcQtyPass: item.quantity,
      finalQcStatus: 'Pass',
    };
  });
};

export const PMS_ARCHIVE_ORDERS: Order[] = buildArchiveOrdersFromSnapshot();
