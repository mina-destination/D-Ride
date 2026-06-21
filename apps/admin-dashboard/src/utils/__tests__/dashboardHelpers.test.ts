import { describe, it, expect } from 'vitest';
import {
  getLinePath,
  getAreaPath,
  formatTimeAgo,
  getInitials,
  getTrend,
} from '../dashboardHelpers';

describe('Dashboard Helpers', () => {
  describe('getLinePath', () => {
    it('returns empty string for empty array', () => {
      expect(getLinePath([])).toBe('');
    });

    it('returns a correct path string for a set of points', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 80 },
        { x: 100, y: 40 },
      ];
      const path = getLinePath(points);
      expect(path).toContain('M 10,20');
      expect(path).toContain('C');
      expect(path).toContain('100,40');
    });
  });

  describe('getAreaPath', () => {
    it('returns empty string for empty array', () => {
      expect(getAreaPath([])).toBe('');
    });

    it('appends area enclosing coordinates to line path', () => {
      const points = [
        { x: 10, y: 20 },
        { x: 50, y: 80 },
      ];
      const path = getAreaPath(points);
      expect(path).toContain('M 10,20');
      expect(path).toContain('L 50,130 L 10,130 Z');
    });
  });

  describe('formatTimeAgo', () => {
    const refDate = new Date('2026-06-21T12:00:00Z');

    it('returns N/A if dateStr is empty', () => {
      expect(formatTimeAgo('')).toBe('N/A');
    });

    it('returns just now for immediate differences', () => {
      const dateStr = new Date(refDate.getTime() - 20000).toISOString(); // 20 sec ago
      expect(formatTimeAgo(dateStr, refDate)).toBe('just now');
    });

    it('returns 1 min ago or diff min ago', () => {
      const dateStr1 = new Date(refDate.getTime() - 60000).toISOString();
      const dateStr5 = new Date(refDate.getTime() - 300000).toISOString();
      expect(formatTimeAgo(dateStr1, refDate)).toBe('1 min ago');
      expect(formatTimeAgo(dateStr5, refDate)).toBe('5 min ago');
    });

    it('returns hourly differences', () => {
      const dateStr1 = new Date(refDate.getTime() - 3600000).toISOString();
      const dateStr5 = new Date(refDate.getTime() - 18000000).toISOString();
      expect(formatTimeAgo(dateStr1, refDate)).toBe('1 hr ago');
      expect(formatTimeAgo(dateStr5, refDate)).toBe('5 hrs ago');
    });

    it('returns yesterday or days ago', () => {
      const dateStr1 = new Date(refDate.getTime() - 86400000).toISOString();
      const dateStr3 = new Date(refDate.getTime() - 86400000 * 3).toISOString();
      expect(formatTimeAgo(dateStr1, refDate)).toBe('yesterday');
      expect(formatTimeAgo(dateStr3, refDate)).toBe('3 days ago');
    });
  });

  describe('getInitials', () => {
    it('returns U if name is empty', () => {
      expect(getInitials('')).toBe('U');
    });

    it('returns single initial for single name', () => {
      expect(getInitials('Bishoy')).toBe('B');
    });

    it('returns double initials for full name', () => {
      expect(getInitials('Bishoy Hanna')).toBe('BH');
      expect(getInitials('John Fitzgerald Kennedy')).toBe('JF');
    });
  });

  describe('getTrend', () => {
    it('returns up +100% when previous is 0 and current is positive', () => {
      expect(getTrend(50, 0)).toEqual({ direction: 'up', value: '+100%' });
    });

    it('returns neutral 0% when previous is 0 and current is 0', () => {
      expect(getTrend(0, 0)).toEqual({ direction: 'neutral', value: '0%' });
    });

    it('calculates positive growth percentage trend', () => {
      expect(getTrend(150, 100)).toEqual({ direction: 'up', value: '↑ 50%' });
    });

    it('calculates negative decline percentage trend', () => {
      expect(getTrend(80, 100)).toEqual({ direction: 'down', value: '↓ 20%' });
    });

    it('returns neutral 0% when no change', () => {
      expect(getTrend(100, 100)).toEqual({ direction: 'neutral', value: '0%' });
    });
  });
});
