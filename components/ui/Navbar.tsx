"use client"
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
    useUser,
} from '@clerk/nextjs'

const navItems = [
    { label: "Library", href: "/" },
    { label: "Add new", href: "/books/new" },
    //   {label: "Pricing", href: "/"},
    //   {label: "About", href: "/"},
]

export const Navbar = () => {
    const pathname = usePathname();
    const { user } = useUser();
    return (
        <header className="w-full fixed z-50 bg-[var(--bg-primary)]">
            <div className="wrapper navebar-height py-4 flex justify-between items-center">
                <Link href="/" className="flex gap-0.5 items-center">
                    <Image src="/assets/logo.png" width={42} height={26} alt="BookWhisper" />
                    <span className="logo-text">BookWhisper</span>
                </Link>
                <nav className="w-fit flex gap-7.5 items-center">
                    {navItems.map(({ label, href }) => {
                        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                        return (
                            <Link
                                href={href}
                                key={label}
                                className={cn('nav-link-base', isActive ? 'nav-link-active' : 'text-black hover:opacity-75')}
                            >
                                {label}
                            </Link>
                        );
                    })}

                    {/* Clerk Auth Controls */}
                    <div className="flex gap-7.5 items-center">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <button className="nav-link-base text-black hover:opacity-75">Sign In</button>
                            </SignInButton>
                            <SignUpButton mode="modal">
                                <button className="nav-link-base text-black hover:opacity-75">Sign Up</button>
                            </SignUpButton>
                        </SignedOut>
                        <SignedIn>
                            <div className="nav-user-link">
                                <UserButton afterSignOutUrl="/" />
                                {user?.firstName && (
                                    <Link href="/subscriptions" className="nav-user-name">
                                        {user.firstName}
                                    </Link>
                                )}
                            </div>
                        </SignedIn>
                    </div>
                </nav>
            </div>
        </header>
    )
}
