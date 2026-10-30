function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-bg': withOpacity('--surface-bg'),
        'surface-card': withOpacity('--surface-card'),
        'surface-container-lowest': withOpacity('--surface-container-lowest'),
        'surface-container-low': withOpacity('--surface-container-low'),
        'surface-container': withOpacity('--surface-container'),
        'surface-container-high': withOpacity('--surface-container-high'),
        'surface-container-highest': withOpacity('--surface-container-highest'),
        'surface-variant': withOpacity('--surface-variant'),
        'surface': withOpacity('--surface'),
        'primary': withOpacity('--primary'),
        'primary-container': withOpacity('--primary-container'),
        'primary-fixed': withOpacity('--primary-fixed'),
        'on-primary': withOpacity('--on-primary'),
        'on-primary-container': withOpacity('--on-primary-container'),
        'on-surface': withOpacity('--on-surface'),
        'on-surface-variant': withOpacity('--on-surface-variant'),
        'outline': withOpacity('--outline'),
        'outline-variant': withOpacity('--outline-variant'),
        'secondary': withOpacity('--secondary'),
        'secondary-container': withOpacity('--secondary-container'),
        'on-secondary-container': withOpacity('--on-secondary-container'),
        'text-main': withOpacity('--text-main'),
        'text-muted': withOpacity('--text-muted'),
        'alert-coral': withOpacity('--alert-coral'),
        'brand-navy': '#112240',
        'brand-cream': '#F8F6F0',
      },
      borderRadius: { DEFAULT: '1rem', lg: '2rem', xl: '3rem', full: '9999px' },
      spacing: {
        'space-xl': '32px',
        gutter: '16px',
        margin: '20px',
        'space-sm': '8px',
        'space-md': '16px',
        'space-lg': '24px',
        'space-xs': '4px',
      },
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '800' }],
        'display-eta': ['48px', { lineHeight: '48px', fontWeight: '900' }],
        'metric-display': ['32px', { lineHeight: '36px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'title-md': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      boxShadow: {
        'level-1': '0 4px 12px -2px rgba(15,23,42,.06), 0 2px 4px -1px rgba(15,23,42,.04)',
        'level-2': '0 12px 24px -4px rgba(15,23,42,.10), 0 4px 8px -2px rgba(15,23,42,.04)',
        'level-3': '0 20px 32px -8px rgba(15,23,42,.16)',
        soft: '0 10px 25px rgba(0,0,0,.05)',
      },
    },
  },
  plugins: [],
};
