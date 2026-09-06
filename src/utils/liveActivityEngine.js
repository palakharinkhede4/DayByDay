/**
 * DayByDay Live Activity Engine - Disabled per user request
 * Ongoing notification bar and Dynamic Island live updates are completely removed.
 */

export const isLiveActivitySupported = () => false;

export const requestLiveActivityPermission = async () => false;

export const startOrUpdateLiveActivity = async () => {};

export const stopLiveActivity = async () => {};
