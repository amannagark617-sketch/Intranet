import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  units: string;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, units, icon, iconBgColor, iconColor }) => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 transition-all hover:border-indigo-300 hover:shadow-md">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBgColor} ${iconColor}`}>
        {icon}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
        <p className="text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{units}</p>
      </div>
    </div>
  );
};

export default StatCard;
