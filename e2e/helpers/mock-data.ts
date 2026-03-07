export function makeNewsItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `news-${i}`,
    title: `Test News Article ${i + 1}`,
    url: `https://example.com/article-${i}`,
    source: 'TestSource',
    timestamp: new Date(Date.now() - i * 60_000),
    category: 'tech-news',
  }));
}

export function makeTickerData(
  overrides?: Partial<{ symbol: string; price: number; change: number; changePercent: number }>[],
) {
  const defaults = [
    { symbol: 'AAPL', price: 185.50, change: 2.30, changePercent: 1.25 },
    { symbol: 'GOOGL', price: 142.80, change: -1.10, changePercent: -0.76 },
    { symbol: 'MSFT', price: 420.15, change: 5.60, changePercent: 1.35 },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides?.[i] }));
}

export function makeRiskScores(
  overrides?: Partial<{ country: string; score: number; trend: string }>[]
) {
  const defaults = [
    { country: 'Country-A', score: 3.0, trend: 'stable' as const, components: { conflict: 2, unrest: 3, economic: 4 } },
    { country: 'Country-B', score: 7.5, trend: 'rising' as const, components: { conflict: 8, unrest: 7, economic: 7 } },
  ];
  return defaults.map((d, i) => ({ ...d, ...overrides?.[i] }));
}

export function makeAIBrief(text: string) {
  return {
    summary: text,
    timestamp: new Date().toISOString(),
  };
}
