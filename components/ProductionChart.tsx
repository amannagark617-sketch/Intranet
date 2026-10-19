import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { STAGE_CONFIGS } from '../constants';

interface ChartData {
  name: string;
  orders: number;
  units?: number;
}

interface ProductionChartProps {
  data: ChartData[];
  onSelectStage?: (stageName: string) => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const stageName = label as keyof typeof STAGE_CONFIGS;
    const cfg = STAGE_CONFIGS[stageName];

    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 animate-fade-in max-w-xs">
        <div className="flex items-center justify-between gap-2 mb-1.5 border-b border-slate-700 pb-1">
          <span className="text-[13px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300">
            {cfg?.stepCode || 'Stage'}
          </span>
          <span className="text-[13px] text-indigo-300 font-medium">
            {cfg?.responsible}
          </span>
        </div>
        <p className="text-[13px] font-semibold text-white">{label}</p>
        <p className="text-[13px] text-amber-300 font-semibold mt-1">
          Active Orders in progress: {payload[0].value}
        </p>
        <p className="text-[13px] text-slate-300 mt-1">
          Timeline Target: {cfg?.timeline}
        </p>
      </div>
    );
  }
  return null;
};

const ProductionChart: React.FC<ProductionChartProps> = ({ data, onSelectStage }) => {
  const hasData = data.some(item => item.orders > 0);

  return (
    <div className="w-full h-[380px] md:h-[480px]">
      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
          <p className="font-semibold text-slate-700">No orders in progress.</p>
          <p className="text-[13px] text-slate-500 mt-1">All orders are either dispatched or ready.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 15,
              left: 10,
              bottom: 10,
            }}
            layout="vertical"
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
            
            <XAxis 
              type="number" 
              stroke="#64748B" 
              fontSize={11} 
              axisLine={false} 
              tickLine={false} 
              allowDecimals={false}
            />
            
            <YAxis 
              dataKey="name" 
              type="category" 
              width={160} 
              fontSize={11} 
              tick={{ fill: '#334155', dx: -5 }} 
              interval={0} 
              tickFormatter={(value: string) => {
                const cfg = STAGE_CONFIGS[value as keyof typeof STAGE_CONFIGS];
                const code = cfg ? `[${cfg.stepCode.replace('STEP ', 'S')}] ` : '';
                const shortName = value
                  .replace('QUALITY CONTROL', 'QC')
                  .replace('OF UPHOLSTERY', '')
                  .replace('AVAILABILITY OF BOXES', 'BOX AVAIL')
                  .replace('PICTURE SHARING', 'PHOTOS');
                return `${code}${shortName}`;
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip 
              cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
              content={<CustomTooltip />}
              animationDuration={200}
            />

            <Bar 
              dataKey="orders" 
              name="Orders in progress" 
              radius={[0, 6, 6, 0]} 
              animationDuration={800}
              onClick={(entry) => onSelectStage && onSelectStage(entry.name)}
              cursor="pointer"
            >
              {data.map((entry) => {
                const cfg = STAGE_CONFIGS[entry.name as keyof typeof STAGE_CONFIGS];
                return (
                  <Cell 
                    key={`cell-${entry.name}`} 
                    fill={cfg?.color || '#4F46E5'} 
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ProductionChart;
