/**
 * Centralized Hooks Library
 *
 * This module provides a single point of import for all custom hooks across the application.
 * Import hooks using:
 *   import { useNavigation, useTracking } from '@/lib/hooks';
 *
 * Organization:
 * - Navigation hooks: useNavigation
 * - Tracking/Analytics hooks: useTracking
 * - Feature access: useFeatureAccess
 * - Security: useCSRFToken
 * - Accessibility: useDialogA11y
 * - Studio-specific: studio/*
 */

// ============================================================================
// Navigation & Routing
// ============================================================================
export { useNavigation } from '../../hooks/useNavigation';

// ============================================================================
// Analytics & Tracking
// ============================================================================
export { useTracking } from './useTracking';

// ============================================================================
// Feature Flags & Access Control
// ============================================================================
export { useFeatureAccess } from './useFeatureAccess';

// ============================================================================
// Security
// ============================================================================
export { useCSRFToken } from './use-csrf-token';

// ============================================================================
// Accessibility
// ============================================================================
export { useDialogA11y } from '../use-dialog-a11y';

// ============================================================================
// Studio-Specific Hooks (Canvas & Editor)
// ============================================================================
// AI Connection
export { useAiConnection } from '../studio/hooks/use-ai-connection';

// Risk & Experiments
export { useRiskRegister } from '../studio/hooks/use-risk-register';
export { useExperiments } from '../studio/hooks/use-experiments';

// Studio UI & State
export { useStudioUiPrefs } from '../studio/hooks/use-studio-ui-prefs';
export { useRetargetingLoops, useChecklist, useProgram, useBlockOps, useClientValue } from '../studio/hooks/use-studio-domains';

// Business Logic
export { usePersuasion } from '../studio/hooks/use-persuasion';
export { useMoneyMachine } from '../studio/hooks/use-money-machine';

// ============================================================================
// Programme & Enrollment Hooks (in components/programme)
// ============================================================================
// Note: The following hooks are feature-specific and located with their components:
// - import { useEnrollment } from '@/components/programme/useEnrollment';

// ============================================================================
// Studio Component Hooks (in components/studio)
// ============================================================================
// Note: The following hooks are component-specific and located with their components:
// - import { useProjectComments } from '@/components/studio/useProjectComments';
// - import { useWorkspaceMembers } from '@/components/studio/useWorkspaceMembers';
// - import { useApiKeysAndWebhooks } from '@/components/studio/useApiKeysAndWebhooks';

// ============================================================================
// Type Exports
// ============================================================================
// Export types used by hooks as needed
// Example:
// export type { NavigationState } from './useNavigation';
