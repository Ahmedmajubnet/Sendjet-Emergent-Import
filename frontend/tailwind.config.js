/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                // Heading font: Manrope — heavy, punchy grotesque for bold, confident headlines.
                // `serif` is kept as an alias so existing `font-serif` heading classes map to Manrope.
                heading: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                serif: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                soft: '0 8px 30px rgba(0,0,0,0.04)',
                lift: '0 20px 40px rgba(0,0,0,0.08)',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                // ---- SendJet launch palette (Airbnb/Wise-inspired warm hospitality) ----
                cream: '#FDFAF5',
                'cream-alt': '#F5EFE6',
                ink: '#1F1A17',
                ink2: '#5C534D',
                ink3: '#8A817C',
                brand: '#FF6B00',
                'brand-hover': '#E66000',
                'brand-light': '#FFF0E5',
                forest: '#2C5545',
                terra: '#E2725B',
                hairline: '#EBE5D9',
                // ---- Radix / shadcn design tokens ----
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            },
            keyframes: {
                'accordion-down': {
                    from: { height: '0' },
                    to: { height: 'var(--radix-accordion-content-height)' }
                },
                'accordion-up': {
                    from: { height: 'var(--radix-accordion-content-height)' },
                    to: { height: '0' }
                },
                'marquee-drift': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'marquee-drift': 'marquee-drift 60s linear infinite'
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
};
