import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface OnTimeData {
  name: string;
  value: number;
  color: string;
}

interface OnTimeDonutChartProps {
  data: OnTimeData[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-700 animate-fade-in text-[13px]">
        <p className="font-semibold text-white">{payload[0].name}</p>
        <p className="text-slate-300 mt-0.5">{`Orders: ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const OnTimeDonutChart: React.FC<OnTimeDonutChartProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const onTimeEntry = data.find(d => d.name === 'On Time');
  const onTimePercentage = total > 0 && onTimeEntry ? Math.round((onTimeEntry.value / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs h-full flex flex-col justify-between">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Orders Ready On Time</h2>
        <p className="text-[13px] text-slate-500 mt-0.5">Compares the day an order passed inspection with its dispatch date.</p>
      </div>

      <div className="h-48 relative flex items-center justify-center my-2">
        {total > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomTooltip />} />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-semibold text-slate-900 tabular-nums">{onTimePercentage}%</span>
              <span className="text-[13px] font-semibold text-slate-500">On Time</span>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-500 text-[13px] h-full flex items-center justify-center">
            No completed orders to analyze.
          </div>
        )}
      </div>

      <div className="flex justify-center gap-6 pt-3 border-t border-slate-100">
        {data.map(entry => (
          <div key={entry.name} className="flex items-center gap-2 text-[13px]">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }}></div>
            <div>
              <span className="text-slate-500">{entry.name}</span>
              <p className="font-semibold text-slate-800 tabular-nums">{entry.value} orders</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OnTimeDonutChart;
