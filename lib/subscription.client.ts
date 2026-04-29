'use client';

import { useAuth } from '@clerk/nextjs';
import { PLANS, PLAN_LIMITS, PlanType } from '@/lib/subscription-constants';

/**
 * Client-side hook to read the current user's subscription plan.
 * Uses Clerk's has() from useAuth() — no server round-trip needed.
 *
 * Returns the plan key ('free' | 'standard' | 'pro') and the
 * corresponding limits object so UI components can gate features
 * without calling a server action.
 */
export function useUserPlan(): { plan: PlanType; limits: typeof PLAN_LIMITS[PlanType] } {
    const { has, isLoaded } = useAuth();

    if (!isLoaded || !has) {
        return { plan: PLANS.FREE, limits: PLAN_LIMITS[PLANS.FREE] };
    }

    if (has({ plan: 'pro' })) {
        return { plan: PLANS.PRO, limits: PLAN_LIMITS[PLANS.PRO] };
    }

    if (has({ plan: 'standard' })) {
        return { plan: PLANS.STANDARD, limits: PLAN_LIMITS[PLANS.STANDARD] };
    }

    return { plan: PLANS.FREE, limits: PLAN_LIMITS[PLANS.FREE] };
}
