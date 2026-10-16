
export const PRODUCTION_STAGES = [
  'CARPENTRY',
  'CARPENTRY QUALITY CONTROL',
  'UPHOLSTERY AVAILABLE',
  'CUTTING OF UPHOLSTERY',
  'STITCHING OF UPHOLSTERY',
  'AVAILABILITY OF BOXES',
  'LINING & FOAMING',
  'UPHOLSTERY',
  'UPHOLSTERY QUALITY CONTROL',
  'FITTING',
  'QUALITY CONTROL',
  'PICTURE SHARING',
  'PACKING',
  'DISPATCH'
] as const;

export const STAGE_CONFIGS = {
  'CARPENTRY': {
    name: 'CARPENTRY',
    stepCode: 'STEP 1',
    timeline: '07 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Sourav Yadav',
    category: 'Carpentry & Framing',
    color: '#6366F1', // Indigo
  },
  'CARPENTRY QUALITY CONTROL': {
    name: 'CARPENTRY QUALITY CONTROL',
    stepCode: 'STEP 2',
    timeline: '07 Days Before Dispatch Date',
    how: 'Carpentry Q.C. Google Form',
    responsible: 'Mr. Atulendra Mishra',
    hasRemarks: true,
    category: 'Carpentry & Framing',
    color: '#8B5CF6', // Purple
  },
  'UPHOLSTERY AVAILABLE': {
    name: 'UPHOLSTERY AVAILABLE',
    stepCode: 'Purchase',
    timeline: 'Yes before 8 Days Of Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Navneet',
    category: 'Raw Material',
    color: '#EC4899', // Pink
  },
  'CUTTING OF UPHOLSTERY': {
    name: 'CUTTING OF UPHOLSTERY',
    stepCode: 'STEP 3',
    timeline: '07 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Bharat',
    category: 'Upholstery & Foaming',
    color: '#F43F5E', // Rose
  },
  'STITCHING OF UPHOLSTERY': {
    name: 'STITCHING OF UPHOLSTERY',
    stepCode: 'STEP 4',
    timeline: '6 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Bharat',
    category: 'Upholstery & Foaming',
    color: '#FB923C', // Orange
  },
  'AVAILABILITY OF BOXES': {
    name: 'AVAILABILITY OF BOXES',
    stepCode: 'Box Availability',
    timeline: '5 Days Of Dispatch Date',
    how: 'Manually',
    responsible: 'Purchase Team / Ms. Sonia',
    category: 'Raw Material',
    color: '#FBBF24', // Amber
  },
  'LINING & FOAMING': {
    name: 'LINING & FOAMING',
    stepCode: 'STEP 5',
    timeline: '6 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Bharat',
    category: 'Upholstery & Foaming',
    color: '#EAB308', // Yellow
  },
  'UPHOLSTERY': {
    name: 'UPHOLSTERY',
    stepCode: 'STEP 6',
    timeline: '5 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Bharat',
    category: 'Upholstery & Foaming',
    color: '#84CC16', // Lime
  },
  'UPHOLSTERY QUALITY CONTROL': {
    name: 'UPHOLSTERY QUALITY CONTROL',
    stepCode: 'STEP 7',
    timeline: '5 Days Before Dispatch Date',
    how: 'Upholstery Q.C.Google Form',
    responsible: 'Mr. Aakash',
    hasRemarks: true,
    category: 'Assembly & QC',
    color: '#10B981', // Emerald
  },
  'FITTING': {
    name: 'FITTING',
    stepCode: 'STEP 8',
    timeline: '3 Days Before Dispatch Date',
    how: 'Fitting Google Form',
    responsible: 'Ms. Kiran',
    category: 'Assembly & QC',
    color: '#14B8A6', // Teal
  },
  'QUALITY CONTROL': {
    name: 'QUALITY CONTROL',
    stepCode: 'STEP 9',
    timeline: '2 Days Before Dispatch Date',
    how: 'Q.C. Ready Goods',
    responsible: 'Mr. Vikas Sharma / Mr. Mohit',
    hasQtyPass: true,
    hasReasonOfFail: true,
    category: 'Assembly & QC',
    color: '#06B6D4', // Cyan
  },
  'PICTURE SHARING': {
    name: 'PICTURE SHARING',
    stepCode: 'STEP 10',
    timeline: '2 Days Before Dispatch Date',
    how: 'Manually',
    responsible: 'Mr. Rakesh Singh',
    hasAttachment: true,
    category: 'Packaging & Dispatch',
    color: '#3B82F6', // Blue
  },
  'PACKING': {
    name: 'PACKING',
    stepCode: 'STEP 11',
    timeline: '1 Days Before Dispatch Date',
    how: 'Packing Google Form',
    responsible: 'Mr. Yogender Singh',
    hasDelayDays: true,
    category: 'Packaging & Dispatch',
    color: '#6366F1', // Indigo
  },
  'DISPATCH': {
    name: 'DISPATCH',
    stepCode: 'STEP 12',
    timeline: 'On Dispatch Date',
    how: 'Dispatch Google Form',
    responsible: 'Mr. Umesh',
    category: 'Packaging & Dispatch',
    color: '#22C55E', // Green
  },
} as const;

export const STAGE_OFFSETS: { [key in typeof PRODUCTION_STAGES[number]]?: number } = {
  'UPHOLSTERY AVAILABLE': 8,
  'CARPENTRY': 7,
  'CARPENTRY QUALITY CONTROL': 7,
  'CUTTING OF UPHOLSTERY': 7,
  'STITCHING OF UPHOLSTERY': 6,
  'LINING & FOAMING': 6,
  'AVAILABILITY OF BOXES': 5,
  'UPHOLSTERY': 5,
  'UPHOLSTERY QUALITY CONTROL': 5,
  'FITTING': 3,
  'QUALITY CONTROL': 2,
  'PICTURE SHARING': 2,
  'PACKING': 1,
  'DISPATCH': 0,
};

export const RESPONSIBLE_PERSONS = [
  'All',
  'Mr. Sourav Yadav',
  'Mr. Atulendra Mishra',
  'Mr. Navneet',
  'Mr. Bharat',
  'Purchase Team / Ms. Sonia',
  'Mr. Aakash',
  'Ms. Kiran',
  'Mr. Vikas Sharma / Mr. Mohit',
  'Mr. Rakesh Singh',
  'Mr. Yogender Singh',
  'Mr. Umesh',
] as const;
