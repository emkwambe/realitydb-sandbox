import { useEffect, useRef, useState } from 'react';
import { getExperiment } from '../services/cloudSandboxService';
import { EvidenceChart } from './ExperimentUI';

interface Props {
  evidenceId: string;
  experimentSlug: string;
  title: string | null;
  onClose: () => void;
}

interface ResolvedChart {
  chartType: 'bar' | 'line' | 'pie';
  xKey: string;
  yKey: string;
  rows: any[];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// A chart evidence block only stores axis config (chartType/xKey/yKey) —
// the actual rows live in its paired result_table block. Fetching the full
// parent Experiment here (rather than a dedicated endpoint) reuses the
// existing public getExperiment() call, which already resolves evidence.
export function ChartFullscreenModal({ evidenceId, experimentSlug, title, onClose }: Props) {
  const [chart, setChart] = useState<ResolvedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getExperiment(experimentSlug).then((exp) => {
      const evidence = (exp?.evidence as any[]) || [];
      const block = evidence.find((e) => e.id === evidenceId);
      const source = block ? evidence.find((e) => e.id === block.data.sourceEvidenceId) : null;
      setChart(block ? { chartType: block.data.chartType, xKey: block.data.xKey, yKey: block.data.yKey, rows: source?.data?.rows || [] } : null);
      setLoading(false);
    });
  }, [evidenceId, experimentSlug]);

  function handleDownload(format: 'png' | 'svg') {
    const svg = chartWrapRef.current?.querySelector('svg');
    if (!svg) return;
    const svgStr = new XMLSerializer().serializeToString(svg);

    if (format === 'svg') {
      downloadBlob(new Blob([svgStr], { type: 'image/svg+xml' }), `${title || 'chart'}.svg`);
      return;
    }

    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth * scale;
      canvas.height = svg.clientHeight * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0a0e14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
      }
      canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${title || 'chart'}.png`); });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function handleCopyLink() {
    const url = `${window.location.origin}${window.location.pathname}#discover/visualizations/${evidenceId}`;
    navigator.clipboard.writeText(url);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-bg-card border border-[var(--border)] rounded-xl p-6 max-w-3xl w-full max-h-[85vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">{title || 'Untitled visualization'}</h3>
          <button onClick={onClose} className="text-xs text-[var(--muted)] hover:text-white">Close</button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && chart && (
          <>
            <div ref={chartWrapRef}>
              <EvidenceChart chartType={chart.chartType} xKey={chart.xKey} yKey={chart.yKey} rows={chart.rows} height={420} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => handleDownload('png')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors">Download PNG</button>
              <button onClick={() => handleDownload('svg')} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors">Download SVG</button>
              <button onClick={handleCopyLink} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors">Copy link</button>
            </div>
          </>
        )}

        {!loading && !chart && <p className="text-sm text-[var(--muted)]">Could not load this visualization.</p>}
      </div>
    </div>
  );
}
