export interface PresetInfo {
  name: string;
  description: string;
  domain: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  sourceCount: number;
}

export const PRESETS: PresetInfo[] = [
  {
    name: 'blank',
    description: 'Empty dashboard ready for customization',
    domain: 'general',
    difficulty: 'beginner',
    sourceCount: 0,
  },
  {
    name: 'tech-minimal',
    description: 'Track tech news from Hacker News, TechCrunch, and Ars Technica',
    domain: 'technology',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'tech-full',
    description: 'Comprehensive tech intelligence with AI analysis',
    domain: 'technology',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'finance-minimal',
    description: 'Basic financial news monitoring',
    domain: 'finance',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'finance-full',
    description: 'Full financial intelligence with market data',
    domain: 'finance',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'cyber-minimal',
    description: 'Basic cybersecurity threat monitoring',
    domain: 'cybersecurity',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'cyber-full',
    description: 'Comprehensive cybersecurity intelligence',
    domain: 'cybersecurity',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'climate-minimal',
    description: 'Basic climate and environmental monitoring',
    domain: 'climate',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'climate-full',
    description: 'Comprehensive climate intelligence dashboard',
    domain: 'climate',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'geopolitics-minimal',
    description: 'Basic geopolitical news monitoring',
    domain: 'geopolitics',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'geopolitics-full',
    description: 'Full geopolitical intelligence dashboard',
    domain: 'geopolitics',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'health-minimal',
    description: 'Basic health and medical news monitoring',
    domain: 'health',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'health-full',
    description: 'Comprehensive health intelligence dashboard',
    domain: 'health',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
  {
    name: 'korea-minimal',
    description: 'Korean news and tech monitoring',
    domain: 'korea',
    difficulty: 'beginner',
    sourceCount: 3,
  },
  {
    name: 'korea-full',
    description: 'Comprehensive Korean intelligence dashboard',
    domain: 'korea',
    difficulty: 'intermediate',
    sourceCount: 8,
  },
];

export function getPreset(name: string): PresetInfo | undefined {
  return PRESETS.find((p) => p.name === name);
}

export function getPresetNames(): string[] {
  return PRESETS.map((p) => p.name);
}
