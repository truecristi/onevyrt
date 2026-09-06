/**
 * Curriculum Tree Data Structure & Utilities
 *
 * Converts flat curriculum data into a hierarchical tree structure for
 * mind-map visualization. Provides efficient traversal, filtering, and
 * status computation for large curriculum maps.
 */

import type { ProgrammeMap, NodeStatus } from "@onevyrt/engine";

/**
 * A node in the curriculum tree (chapter, module, or lesson)
 */
export interface CurriculumTreeNode {
  id: string;
  title: string;
  type: "stage" | "lesson";
  stageId: string; // which stage this belongs to
  order: number; // position within parent
  status: "locked" | "available" | "in_progress" | "completed" | "awaiting_review" | "changes_requested" | "approved";
  progress: number; // 0-100
  children: CurriculumTreeNode[];
  metadata?: {
    outcome?: string;
    toolHref?: string | null;
    estimatedTime?: number; // minutes
    depth: number;
  };
}

/**
 * Complete tree structure for rendering and navigation
 */
export interface CurriculumTree {
  root: CurriculumTreeNode;
  nodeMap: Map<string, CurriculumTreeNode>;
  depthMap: Map<number, CurriculumTreeNode[]>;
}

/** Map a ProgrammeMap node's status (the engine's "complete" / "current" /
 *  "available" / "locked") onto this tree's richer status vocabulary. */
function mapNodeStatus(status: NodeStatus): CurriculumTreeNode["status"] {
  switch (status) {
    case "complete": return "completed";
    case "current": return "in_progress";
    default: return status; // "available" | "locked"
  }
}

/**
 * Build a hierarchical tree from flat stage/lesson data
 */
export function buildCurriculumTree(
  stages: Array<{
    id: string;
    title: string;
    order: number;
    outcome?: string;
    lessons: Array<{
      id: string;
      title: string;
      status: string;
      outcome?: string;
      toolHref?: string | null;
    }>;
  }>,
  programmeMap: ProgrammeMap | null
): CurriculumTree {
  const nodeMap = new Map<string, CurriculumTreeNode>();
  const depthMap = new Map<number, CurriculumTreeNode[]>();

  // Helper to get lesson status from programme map
  const getLessonStatus = (lessonId: string) => {
    if (!programmeMap) return "available";
    for (const node of programmeMap.nodes) {
      const lesson = node.lessons.find((l) => l.id === lessonId);
      if (lesson) return lesson.status;
    }
    return "available";
  };

  // Helper to get stage node
  const getStageNode = (stageId: string) => programmeMap?.nodes.find((n) => n.stageId === stageId);

  // Helper to calculate progress percent
  const calculateProgress = (stageId: string): number => {
    const stageNode = getStageNode(stageId);
    if (!stageNode || stageNode.totalLessons === 0) return 0;
    return Math.round((stageNode.completedLessons / stageNode.totalLessons) * 100);
  };

  // Build root node (entire curriculum)
  const root: CurriculumTreeNode = {
    id: "curriculum-root",
    title: "ONEVYRT Curriculum",
    type: "stage",
    stageId: "root",
    order: 0,
    status: "available",
    progress: programmeMap?.overallPercent || 0,
    children: [],
  };

  nodeMap.set(root.id, root);
  depthMap.set(0, [root]);

  // Build stage nodes
  const stageNodes: CurriculumTreeNode[] = [];
  stages.forEach((stage) => {
    const stageNode: CurriculumTreeNode = {
      id: stage.id,
      title: stage.title,
      type: "stage",
      stageId: stage.id,
      order: stage.order,
      status: "available",
      progress: calculateProgress(stage.id),
      children: [],
      metadata: {
        outcome: stage.outcome,
        depth: 1,
      },
    };

    // Determine stage status
    const programmeStage = getStageNode(stage.id);
    if (programmeStage) {
      stageNode.status =
        programmeStage.completedLessons === programmeStage.totalLessons
          ? "completed"
          : mapNodeStatus(programmeStage.status || "available");
    }

    // Build lesson nodes
    stage.lessons.forEach((lesson) => {
      const lessonStatus = getLessonStatus(lesson.id);
      const lessonNode: CurriculumTreeNode = {
        id: lesson.id,
        title: lesson.title,
        type: "lesson",
        stageId: stage.id,
        order: stage.lessons.indexOf(lesson),
        status: lessonStatus as any,
        progress: lessonStatus === "completed" ? 100 : lessonStatus === "in_progress" ? 50 : 0,
        children: [],
        metadata: {
          outcome: lesson.outcome,
          toolHref: lesson.toolHref,
          depth: 2,
        },
      };

      nodeMap.set(lesson.id, lessonNode);
      stageNode.children.push(lessonNode);

      if (!depthMap.has(2)) depthMap.set(2, []);
      depthMap.get(2)!.push(lessonNode);
    });

    nodeMap.set(stage.id, stageNode);
    stageNodes.push(stageNode);

    if (!depthMap.has(1)) depthMap.set(1, []);
    depthMap.get(1)!.push(stageNode);
  });

  root.children = stageNodes;

  return { root, nodeMap, depthMap };
}

/**
 * Find a node by id in the tree
 */
export function findNode(tree: CurriculumTree, id: string): CurriculumTreeNode | undefined {
  return tree.nodeMap.get(id);
}

/**
 * Get all nodes at a specific depth
 */
export function getNodesByDepth(tree: CurriculumTree, depth: number): CurriculumTreeNode[] {
  return tree.depthMap.get(depth) || [];
}

/**
 * Get the path from root to a specific node
 */
export function getNodePath(tree: CurriculumTree, id: string): CurriculumTreeNode[] {
  const node = findNode(tree, id);
  if (!node) return [];

  const path: CurriculumTreeNode[] = [node];
  let current: CurriculumTreeNode | undefined = node;

  while (current && current.id !== "curriculum-root") {
    const parent = Array.from(tree.nodeMap.values()).find((n) =>
      n.children.some((c) => c.id === current!.id)
    );
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }

  return path;
}

/**
 * Filter tree nodes by status
 */
export function filterNodesByStatus(tree: CurriculumTree, statuses: string[]): CurriculumTreeNode[] {
  const results: CurriculumTreeNode[] = [];
  tree.nodeMap.forEach((node) => {
    if (statuses.includes(node.status)) {
      results.push(node);
    }
  });
  return results;
}

/**
 * Get next incomplete lesson in tree
 */
export function getNextIncompleteNode(tree: CurriculumTree): CurriculumTreeNode | null {
  const nodes = Array.from(tree.nodeMap.values()).filter((n) => n.type === "lesson");
  return nodes.find((n) => n.status !== "completed" && n.status !== "approved") || null;
}

/**
 * Get all completed nodes in tree
 */
export function getCompletedNodes(tree: CurriculumTree): CurriculumTreeNode[] {
  return Array.from(tree.nodeMap.values()).filter(
    (n) => n.status === "completed" || n.status === "approved"
  );
}

/**
 * Calculate tree statistics
 */
export function calculateTreeStats(tree: CurriculumTree): {
  totalNodes: number;
  totalLessons: number;
  completedLessons: number;
  overallProgress: number;
  stageProgress: Map<string, number>;
} {
  const lessons = Array.from(tree.nodeMap.values()).filter((n) => n.type === "lesson");
  const completedLessons = lessons.filter(
    (n) => n.status === "completed" || n.status === "approved"
  ).length;
  const stageProgress = new Map<string, number>();

  const stages = Array.from(tree.nodeMap.values()).filter((n) => n.type === "stage");
  stages.forEach((stage) => {
    const stageLessons = stage.children;
    const completedInStage = stageLessons.filter(
      (n) => n.status === "completed" || n.status === "approved"
    ).length;
    const progress =
      stageLessons.length > 0 ? Math.round((completedInStage / stageLessons.length) * 100) : 0;
    stageProgress.set(stage.id, progress);
  });

  return {
    totalNodes: tree.nodeMap.size,
    totalLessons: lessons.length,
    completedLessons,
    overallProgress: lessons.length > 0 ? Math.round((completedLessons / lessons.length) * 100) : 0,
    stageProgress,
  };
}

/**
 * Check if a node is locked based on tree structure
 */
export function isNodeLocked(node: CurriculumTreeNode, tree: CurriculumTree): boolean {
  if (node.type === "stage") {
    // A stage is locked if the previous stage isn't completed
    const stages = getNodesByDepth(tree, 1).sort((a, b) => a.order - b.order);
    const nodeIndex = stages.findIndex((s) => s.id === node.id);

    if (nodeIndex === 0) return false; // First stage is never locked

    const previousStage = stages[nodeIndex - 1]!;
    return previousStage.status !== "completed" && previousStage.status !== "approved";
  }

  if (node.type === "lesson") {
    // A lesson is locked if:
    // 1. Its stage is locked, or
    // 2. The previous lesson in its stage isn't completed
    const stageNode = findNode(tree, node.stageId);
    if (!stageNode) return true;

    if (isNodeLocked(stageNode, tree)) return true;

    const previousLesson = stageNode.children[node.order - 1];
    if (!previousLesson) return false; // First lesson in stage

    return previousLesson.status !== "completed" && previousLesson.status !== "approved";
  }

  return false;
}

/**
 * Get breadcrumb navigation for a node
 */
export function getBreadcrumbs(tree: CurriculumTree, id: string): Array<{ id: string; title: string }> {
  const path = getNodePath(tree, id);
  return path.map((n) => ({ id: n.id, title: n.title }));
}

/**
 * Export tree as JSON for serialization
 */
export function exportTreeJSON(tree: CurriculumTree): string {
  const exported = {
    root: serializeNode(tree.root),
  };
  return JSON.stringify(exported, null, 2);
}

/**
 * Helper to serialize a tree node
 */
function serializeNode(node: CurriculumTreeNode): any {
  return {
    id: node.id,
    title: node.title,
    type: node.type,
    stageId: node.stageId,
    order: node.order,
    status: node.status,
    progress: node.progress,
    metadata: node.metadata,
    children: node.children.map(serializeNode),
  };
}
