/**
 * Admin UI Types
 * Shared type definitions for admin dashboard components
 */

export interface Workspace {
  id: string;
  name: string;
  freeAccessEnabled: boolean;
  ownerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditLogEntry {
  id: string;
  workspaceId: string;
  adminEmail: string;
  action: 'enabled' | 'disabled';
  timestamp: Date;
  rawAction?: string;
  rawMetadata?: Record<string, any>;
}

export interface FreeAccessAdminUIProps {
  workspaces: Workspace[];
  auditLog: AuditLogEntry[];
  onToggleFreeAccess: (workspaceId: string, enabled: boolean) => Promise<void>;
  onBulkEnable: (workspaceIds: string[]) => Promise<void>;
  loading?: boolean;
}

export interface FreeAccessToggleRequest {
  workspaceId: string;
  enabled: boolean;
}

export interface FreeAccessBulkRequest {
  workspaceIds: string[];
  enabled: boolean;
}

export interface FreeAccessToggleResponse {
  success: boolean;
  workspace: Workspace;
  message: string;
}

export interface FreeAccessBulkResponse {
  success: boolean;
  workspacesUpdated: number;
  workspaces: Workspace[];
  message: string;
}

export interface WorkspacesListResponse {
  workspaces: Workspace[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AuditLogResponse {
  auditLog: AuditLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
}

export interface ConfirmModalState {
  isOpen: boolean;
  workspaceId: string;
  workspaceName: string;
  action: 'enable' | 'disable';
}
