import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, AlertTriangle } from 'lucide-react';
import { useDefectDetail } from '../../data/queries';
import Sparkline from '../../widgets/Sparkline';

// Full-page drill-down for a defect root-cause view: /quality/defect/:defectCode
export const DefectDetailPage: React.FC = () => {
  const { defectCode = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useDefectDetail(defectCode);

  return (
    <div className="w-full min-h-screen bg-[#02070e] text-[#f8fafc] p-6 flex flex-col gap-6">
      <button
        onClick={() => navigate('/quality')}
        className="flex items-center gap-1.5 text-[#8fa0b5] hover:text-white w-fit text-sm font-bold"
      >
        <ChevronLeft size={16} /> Quality
        <span className="text-[#142337]">/</span>
        <span className="text-[#06b6d4]">{data?.name ?? defectCode}</span>
      </button>

      {isLoading && <div className="text-[#526a8a]">Loading defect analysis…</div>}
      {isError && <div className="text-[#ef4444]">Failed to load defect {defectCode}.</div>}

      {data && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black flex items-center gap-2">
              <AlertTriangle size={22} className="text-[#f97316]" /> {data.name}
            </h1>
            <span className="text-sm font-black px-3 py-1 rounded bg-[#3b82f6]/15 text-[#3b82f6] font-mono">
              {data.ppm} PPM
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Root cause breakdown */}
            <section className="bg-[#070e17] border border-[#142337] rounded-xl p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-[#8fa0b5] mb-4">
                Root Cause Breakdown
              </h2>
              <div className="flex flex-col gap-3">
                {data.rootCauses.map((rc) => (
                  <div key={rc.cause} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm font-bold">
                      <span>{rc.cause}</span>
                      <span className="font-mono text-white">{rc.sharePct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#142337] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#06b6d4] rounded-full"
                        style={{ width: `${rc.sharePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Trend + affected lines */}
            <section className="bg-[#070e17] border border-[#142337] rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-[#8fa0b5] mb-3">
                  PPM Trend (6 periods)
                </h2>
                <Sparkline data={data.trend} stroke="#f97316" fluid height={56} />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[#8fa0b5] mb-2">
                  Affected Lines
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.affectedLines.map((l) => (
                    <span
                      key={l}
                      className="text-xs font-bold px-2.5 py-1 rounded bg-[#0a1523] border border-[#1b3252] text-white"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* AI recommendation */}
          <div className="bg-[#06b6d4]/5 border border-[#06b6d4]/20 rounded-xl p-4 flex items-start gap-2 text-sm">
            <Sparkles size={16} className="text-[#06b6d4] flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">AI Recommendation: </strong>
              <span className="text-[#8fa0b5]">{data.recommendation}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default DefectDetailPage;
