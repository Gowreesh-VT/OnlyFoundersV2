"use client";

import React from 'react';
import Link, { LinkProps } from 'next/link';
import { useFeedback } from '../hooks/use-feedback';

interface FeedbackLinkProps extends LinkProps {
    children: React.ReactNode;
    className?: string;
    feedbackType?: 'success' | 'process' | 'error' | 'click' | 'light';
}

export function FeedbackLink({
    children,
    onClick,
    feedbackType = 'click',
    ...props
}: FeedbackLinkProps & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    const { trigger } = useFeedback();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        trigger(feedbackType);
        if (onClick) {
            onClick(e);
        }
    };

    return (
        <Link
            onClick={handleClick}
            {...props}
        >
            {children}
        </Link>
    );
}
