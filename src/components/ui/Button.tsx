
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success' | 'warning';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-semibold transition-all rounded-[var(--radius-sm)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
        secondary: "bg-slate-700 hover:bg-slate-600 text-slate-100 focus:ring-slate-500 shadow-sm",
        danger: "bg-red-600 hover:bg-red-500 text-white focus:ring-red-500 shadow-md",
        ghost: "bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-100",
        outline: "bg-transparent border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white",
        success: "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500 shadow-md",
        warning: "bg-amber-500 hover:bg-amber-400 text-white focus:ring-amber-500 shadow-md"
    };

    const sizes = {
        xs: "text-[10px] px-2 py-1 gap-1",
        sm: "text-xs px-3 py-1.5 gap-1.5",
        md: "text-sm px-4 py-2 gap-2",
        lg: "text-base px-6 py-3 gap-2.5"
    };

    return (
        <button
            className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current opacity-75" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            ) : leftIcon ? (
                leftIcon
            ) : null}

            {children}

            {rightIcon && !isLoading ? rightIcon : null}
        </button>
    );
};
