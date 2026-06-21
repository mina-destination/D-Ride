export const getLinePath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
};

export const getAreaPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  const line = getLinePath(points);
  return `${line} L ${points[points.length - 1].x},130 L ${points[0].x},130 Z`;
};

export const formatTimeAgo = (dateStr: string, referenceDate: Date = new Date()) => {
  if (!dateStr) return 'N/A';
  const diffMs = referenceDate.getTime() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hr ago';
  if (diffHours < 24) return `${diffHours} hrs ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
};

export const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getTrend = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? { direction: 'up', value: '+100%' } : { direction: 'neutral', value: '0%' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { direction: 'up', value: `↑ ${pct}%` };
  if (pct < 0) return { direction: 'down', value: `↓ ${Math.abs(pct)}%` };
  return { direction: 'neutral', value: '0%' };
};
