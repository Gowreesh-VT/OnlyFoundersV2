"use client";

import React from 'react';
import { useFeedback } from '../hooks/use-feedback';
import { Volume2, VolumeX } from 'lucide-react'; // Assuming lucide-react is installed as per package.json

interface FeedbackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    feedbackType?: 'success' | 'process' | 'error' | 'click' | 'light';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    fullWidth?: boolean;
}

export function FeedbackButton({
    children,
    onClick,
    feedbackType = 'click',
    variant = 'primary',
    fullWidth = false,
    className = '',
    ...props
}: FeedbackButtonProps) {
    const { trigger } = useFeedback();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        trigger(feedbackType);
        if (onClick) {
            onClick(e);
        }
    };

    const baseStyles = "inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary: "bg-white text-black hover:bg-gray-100 shadow-sm",
        secondary: "bg-gray-800 text-white hover:bg-gray-700",
        outline: "border border-gray-600 text-gray-200 hover:bg-gray-800",
        ghost: "text-gray-400 hover:text-white hover:bg-white/10"
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
        <button
            onClick={handleClick}
            className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
