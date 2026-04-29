import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { PricingTable } from '@clerk/nextjs';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing — BookWhisper',
    description: 'Choose the plan that fits your reading journey. Upgrade to unlock more books, longer sessions, and session history.',
};

export default async function SubscriptionsPage() {
    const { userId } = await auth();
    if (!userId) redirect('/sign-in');

    return (
        <div className="clerk-subscriptions">
            <div className="mb-10 text-center">
                <h1 className="page-title font-serif">Choose Your Plan</h1>
                <p className="page-description text-[var(--text-secondary)] max-w-xl mx-auto">
                    Unlock more books, longer voice sessions, and session history.
                    Upgrade or downgrade at any time.
                </p>
            </div>

            <div className="clerk-pricing-container">
                <PricingTable newSubscriptionRedirectUrl="/" />
            </div>
        </div>
    );
}
