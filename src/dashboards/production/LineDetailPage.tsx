import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Activity, Clock, Users, Gauge } from 'lucide-react';
import { useLineDetail } from '../../data/queries';
import Sparkline from '../../widgets/Sparkline';

// Full-page drill-down for a single production line: /production/line/:lineId
export const LineDetailPage: React.FC = () => {
  const { lineId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useLineDetail(lineId);

  const statusColor =
    data?.status === 'Healthy' ? '#22c55e' : data?.status === 'At Risk' ? '#eab308' : '#ff4c4c';

  return (
    <div className="w-full min-h-screen bg-[#08111a] text-[#f8fafc] p-6 flex flex-col gap-6">
      {/* Breadcrumb / back */}
      <button
        onClick={() => navigate('/production')}
        className="flex items-center gap-1.5 text-[#97a7bb] hover:text-white w-fit text-sm font-bold"
      >
        <ChevronLeft size={16} /> Production
        <span className="text-[#1d324b]">/</span>
        <span className="text-[#06b6d4]">{data?.name ?? lineId}</span>
      </button>

      {isLoading && <div className="text-[#52607f]">Loading line detail…</div>}
      {isError && <div className="text-[#ff4c4c]">Failed to load line {lineId}.</div>}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black">{data.name}</h1>
            <span
              className="text-sm font-black px-3 py-1 rounded"
              style={{ color: statusColor, background: `${statusColor}22` }}
            >
              {data.status}
            </span>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile icon={<Gauge size={16} />} label="Achievement" value={`${data.achPct}%`} />
            <StatTile icon={<Activity size={16} />} label="OEE" value={`${data.oee}%`} />
            <StatTile icon={<Clock size={16} />} label="Downtime" value={data.downtime} />
            <StatTile icon={<Users size={16} />} label="Operators" value={String(data.operators)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly output */}
            <section className="border border-[#1d324b] bg-[#0e1424] rounded-xl p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#97a7bb] mb-4">
                Hourly Output
              </h2>
              <Sparkline
                data={data.hourlyOutput.map((h) => h.units)}
                stroke={statusColor}
                fluid
                height={64}
              />
              <div className="flex justify-between text-[11px] text-[#52607f] font-mono mt-2">
                {data.hourlyOutput.map((h) => (
                  <span key={h.hour}>{h.hour}</span>
                ))}
              </div>
            </section>

            {/* Downtime reasons */}
            <section className="border border-[#1d324b] bg-[#0e1424] rounded-xl p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#97a7bb] mb-4">
                Top Downtime Reasons
              </h2>
              <div className="flex flex-col gap-3">
                {data.topDowntimeReasons.map((r) => (
                  <div key={r.reason} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-[#f8fafc]">{r.reason}</span>
                      <span className="font-mono text-white">{r.minutes}m</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#142337] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, r.minutes * 3)}%`,
                          background: statusColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

const StatTile: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => (
  <div className="border border-[#1d324b] bg-[#0e1424] rounded-xl p-4 flex flex-col gap-2">
    <span className="flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider text-[#97a7bb]">
      {icon} {label}
    </span>
    <span className="text-2xl font-black font-mono text-white">{value}</span>
  </div>
);

export default LineDetailPage;
