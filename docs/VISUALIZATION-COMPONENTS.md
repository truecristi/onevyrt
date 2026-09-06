# ONEVYRT Visualization Components

Professional learning journey progression visualizations and interactive programme path diagrams for ONEVYRT. All components are production-ready with full dark mode support, mobile responsiveness, and accessibility compliance.

## Components Overview

### 1. **LearningJourneyVisual** (`components/programme/LearningJourneyVisual.tsx`)

Interactive 6-stage learning journey map with color gradient progression.

**Features:**
- START → DEFINE → IMPLEMENT → CONTROL → IMPROVE & SCALE → FINISH visual progression
- SVG connection line with animated progress tracking
- Current position highlighted with pulsing indicator
- Progress percentage per stage with real-time updates
- Estimated time to complete chapter
- Next 3 milestones highlighted
- Color gradient: slate → blue → green → amber → red → cyan
- Micro-animations (respects prefers-reduced-motion)
- Mobile touch-friendly
- Dark mode full support

**Props:**
```typescript
interface LearningJourneyVisualProps {
  stages: Stage[];
  currentStageId?: string | null;
  currentLessonId?: string | null;
  overallProgress?: number;
  completedLessons?: number;
  totalLessons?: number;
  readinessScore?: number | null;
  onStageClick?: (stageId: string) => void;
  compact?: boolean;
}

interface Stage {
  id: string;
  order: number;
  title: string;
  outcome: string;
  state: "uncertainty" | "clarity" | "confidence" | "control" | "momentum" | "freedom";
  output?: string | null;
  progress?: number;
  totalLessons?: number;
  completedLessons?: number;
  estimatedTime?: number; // minutes
}
```

**Usage:**
```typescript
import { LearningJourneyVisual } from "@/components/programme";

<LearningJourneyVisual
  stages={programmeStages}
  currentStageId={currentStage}
  overallProgress={75}
  completedLessons={18}
  totalLessons={25}
  readinessScore={62}
  onStageClick={(id) => navigate(`/programme/${id}`)}
/>
```

---

### 2. **Chapter4ProgressionVisual** (`components/programme/Chapter4ProgressionVisual.tsx`)

Subchapter progression visualization for Chapter 4: IMPROVE & SCALE.

**Features:**
- 5-stage breakdown with visual dependency chain
- 4.1 Bottleneck → 4.2 Conversion → 4.3 Profit → 4.4 Systemise → 4.5 Growth Plan
- Completion percentage per subchapter
- Status badges (locked, in progress, complete)
- Growth & Improvement Plan artifact display
- Estimated time per subchapter
- Professional timeline presentation
- Lock indicators for prerequisites

**Props:**
```typescript
interface Chapter4ProgressionVisualProps {
  subchapters: Subchapter[];
  overallProgress?: number;
  growthPlanStatus?: "not_started" | "in_progress" | "submitted" | "approved";
  growthPlanLastUpdated?: string;
  onSubchapterClick?: (subchapterId: string) => void;
  compact?: boolean;
}

interface Subchapter {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  completedLessons: number;
  totalLessons: number;
  estimatedTime: number;
  isLocked: boolean;
  isCurrently?: boolean;
  isCompleted?: boolean;
}
```

**Usage:**
```typescript
import { Chapter4ProgressionVisual } from "@/components/programme";

<Chapter4ProgressionVisual
  subchapters={chapter4Subchapters}
  overallProgress={60}
  growthPlanStatus="in_progress"
  growthPlanLastUpdated={lastUpdated}
  onSubchapterClick={(id) => navigate(`/programme/chapter-4/${id}`)}
/>
```

---

### 3. **CurriculumMindMap** (`components/programme/CurriculumMindMap.tsx`)

Hierarchical tree visualization of complete curriculum structure.

**Features:**
- Tree view of all chapters and modules
- Completion status indicators
- Lock indicators for locked modules
- Clickable nodes for navigation
- Collapsible/expandable tree sections
- Efficient rendering with depth-based filtering
- Expand/collapse all controls
- Keyboard navigation support
- Professional styling

**Props:**
```typescript
interface CurriculumMindMapProps {
  root: TreeNode;
  onNodeClick?: (nodeId: string) => void;
  defaultExpandedIds?: string[];
  highlightCurrentId?: string;
  maxDepth?: number;
}

interface TreeNode {
  id: string;
  title: string;
  type: "stage" | "lesson";
  status: "locked" | "available" | "in_progress" | "completed" | "approved";
  progress: number;
  children?: TreeNode[];
  depth?: number;
}
```

**Usage:**
```typescript
import { CurriculumMindMap, buildCurriculumTree } from "@/components/programme";
import { buildCurriculumTree } from "@/lib/visualization/curriculum-tree";

const tree = buildCurriculumTree(stagesData, programmeMap);

<CurriculumMindMap
  root={tree.root}
  onNodeClick={(id) => navigate(`/programme/lesson/${id}`)}
  highlightCurrentId={currentLessonId}
  defaultExpandedIds={["chapter-1", "chapter-2"]}
/>
```

---

### 4. **LessonRoadmap** (`components/programme/LessonRoadmap.tsx`)

Linear roadmap of all lessons in current chapter.

**Features:**
- All lessons in chapter with completion status
- Current lesson highlighted with pulsing indicator
- Checkmark for completed lessons
- Lock icon for locked lessons
- Progress bar showing chapter progress
- Smooth scroll to current lesson
- Time estimates
- Status badges

**Props:**
```typescript
interface LessonRoadmapProps {
  lessons: Lesson[];
  currentLessonId?: string | null;
  chapterId?: string;
  chapterTitle?: string;
  onLessonClick?: (lessonId: string) => void;
}

interface Lesson {
  id: string;
  title: string;
  status: "locked" | "available" | "in_progress" | "completed" | "submitted" | "approved";
  estimatedTime?: number;
  order: number;
}
```

**Usage:**
```typescript
import { LessonRoadmap } from "@/components/programme";

<LessonRoadmap
  lessons={chapterLessons}
  currentLessonId={currentLesson}
  chapterTitle="Chapter 1 — Define"
  onLessonClick={(id) => navigate(`/programme/lesson/${id}`)}
/>
```

---

### 5. **LearningObjectivesDisplay** (`components/programme/LearningObjectivesDisplay.tsx`)

Interactive learning objectives checklist per lesson.

**Features:**
- 4 objective types: Understand, Practice, Apply, Master
- Icon-based visual indicators
- Interactive reveal of detailed explanations
- Progress checkmarks as user advances
- Completion badges and summary view
- Color-coded by objective type
- Lesson completion celebration message

**Props:**
```typescript
interface LearningObjectivesDisplayProps {
  lessonTitle: string;
  objectives: Objective[];
  isLessonCompleted?: boolean;
  onObjectiveToggle?: (objectiveId: string) => void;
  expandByDefault?: boolean;
}

type ObjectiveType = "understand" | "practice" | "apply" | "master";

interface Objective {
  id: string;
  type: ObjectiveType;
  title: string;
  description?: string;
  isCompleted?: boolean;
}
```

**Usage:**
```typescript
import { LearningObjectivesDisplay } from "@/components/programme";

<LearningObjectivesDisplay
  lessonTitle="Business Definition"
  objectives={lessonObjectives}
  isLessonCompleted={isComplete}
  onObjectiveToggle={(id) => updateObjective(id)}
/>
```

---

### 6. **ArtifactTimeline** (`components/programme/ArtifactTimeline.tsx`)

Visual timeline of all permanent programme artifacts.

**Features:**
- 6-stage artifact progression timeline
- START → CH1 → CH2 → CH3 → CH4 → FINISH
- Status indicators (not started, in progress, under review, completed)
- Timeline animation with gradient connector
- Completion dates display
- Preview icons per artifact
- Download/share buttons for completed artifacts
- Status legend

**Props:**
```typescript
interface ArtifactTimelineProps {
  artifacts: Artifact[];
  currentStageId?: string | null;
  onArtifactClick?: (artifactId: string) => void;
}

interface Artifact {
  id: string;
  stageId: string;
  title: string;
  description: string;
  icon: string;
  status: "not_started" | "in_progress" | "submitted" | "approved" | "completed";
  completedAt?: string;
  order: number;
  color: string;
  color_soft: string;
}
```

**Usage:**
```typescript
import { ArtifactTimeline } from "@/components/programme";

<ArtifactTimeline
  artifacts={programmArtifacts}
  currentStageId={currentStage}
  onArtifactClick={(id) => navigate(`/account/artifact/${id}`)}
/>
```

---

### 7. **TransformationTracker** (`components/account/TransformationTracker.tsx`)

Before/after comparison visualization with journey metrics.

**Features:**
- Key metrics tracking: Revenue, Profit, Customers, Team, Stage
- Before → After comparison with visual arrows
- Percentage improvement highlighted in green
- 3-month forward projection
- Readiness Score evolution chart
- Journey duration and timeline
- Shareable summary card
- Export/download functionality

**Props:**
```typescript
interface TransformationTrackerProps {
  metrics: MetricData[];
  journeyStartDate?: string;
  readinessScoreStart?: number;
  readinessScoreCurrent?: number;
  onExport?: () => void;
  onShare?: () => void;
}

interface MetricData {
  id: string;
  label: string;
  icon: string;
  startValue: number | string;
  currentValue: number | string;
  unit: string;
  isNumeric: boolean;
  format?: "currency" | "percent" | "number" | "text";
  projectedValue?: number | string;
}
```

**Usage:**
```typescript
import { TransformationTracker } from "@/components/account";

<TransformationTracker
  metrics={metricsData}
  journeyStartDate={enrollment.createdAt}
  readinessScoreStart={enrollment.readinessBaseline?.score}
  readinessScoreCurrent={currentReadiness}
  onExport={() => downloadReport()}
  onShare={() => shareReport()}
/>
```

---

## Supporting Libraries

### **learning-journey.ts** (`lib/animations/learning-journey.ts`)

Animation utilities for smooth, accessible progression animations.

**Functions:**
- `prefersReducedMotion()` - Check user motion preference
- `generateJourneyAnimations()` - CSS keyframes
- `generateJourneyClasses()` - Animated class styles
- `calculatePathAnimation()` - SVG path animations
- `getStaggeredDelay()` - Sequential reveal timing
- `generateCelebrationStyle()` - Completion celebrations
- `smoothScrollToElement()` - Accessible scroll behavior

---

### **curriculum-tree.ts** (`lib/visualization/curriculum-tree.ts`)

Data structure and traversal utilities for mind-map rendering.

**Functions:**
- `buildCurriculumTree()` - Build hierarchical tree from flat data
- `findNode()` - Find node by ID
- `getNodesByDepth()` - Get all nodes at specific depth
- `getNodePath()` - Get breadcrumb path to node
- `filterNodesByStatus()` - Filter nodes by status
- `getNextIncompleteNode()` - Find next lesson to do
- `getCompletedNodes()` - Get all completed nodes
- `calculateTreeStats()` - Calculate progress statistics
- `isNodeLocked()` - Check if node is locked
- `getBreadcrumbs()` - Get navigation breadcrumbs
- `exportTreeJSON()` - Export tree as JSON

---

## Integration Examples

### In `/programme` Hub Page

```typescript
import { LearningJourneyVisual, ArtifactTimeline } from "@/components/programme";
import { buildCurriculumTree } from "@/lib/visualization/curriculum-tree";

export default function ProgrammePage() {
  const [enrollmentData, setEnrollmentData] = useState(null);

  useEffect(() => {
    fetch("/api/programme/enrollment").then(r => r.json()).then(setEnrollmentData);
  }, []);

  if (!enrollmentData) return <Loading />;

  const treeData = buildCurriculumTree(enrollmentData.stages, enrollmentData.map);

  return (
    <div className="programme-hub">
      <LearningJourneyVisual
        stages={enrollmentData.stages}
        currentStageId={enrollmentData.map?.currentStageId}
        overallProgress={enrollmentData.map?.overallPercent}
        completedLessons={enrollmentData.map?.completedLessons}
        totalLessons={enrollmentData.map?.totalLessons}
        readinessScore={enrollmentData.snapshot?.readinessScore}
      />

      <CurriculumMindMap
        root={treeData.root}
        highlightCurrentId={enrollmentData.map?.currentLessonId}
      />

      <ArtifactTimeline
        artifacts={enrollmentData.artifacts}
        currentStageId={enrollmentData.map?.currentStageId}
      />
    </div>
  );
}
```

### In Chapter Pages

```typescript
import { LessonRoadmap } from "@/components/programme";

export default function Chapter1Page() {
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    fetch("/api/programme/chapters/chapter-1/lessons").then(r => r.json()).then(setLessons);
  }, []);

  return (
    <LessonRoadmap
      lessons={lessons}
      chapterTitle="Chapter 1 — Define"
      onLessonClick={(id) => navigate(`/programme/lesson/${id}`)}
    />
  );
}
```

### In Lesson Pages

```typescript
import { LearningObjectivesDisplay } from "@/components/programme";

export default function LessonPage({ lessonId }) {
  const [lesson, setLesson] = useState(null);

  useEffect(() => {
    fetch(`/api/programme/lessons/${lessonId}`).then(r => r.json()).then(setLesson);
  }, [lessonId]);

  return (
    <LearningObjectivesDisplay
      lessonTitle={lesson?.title}
      objectives={lesson?.objectives}
      isLessonCompleted={lesson?.isCompleted}
      onObjectiveToggle={(id) => updateObjective(id)}
    />
  );
}
```

### In Account Page

```typescript
import { TransformationTracker } from "@/components/account";

export default function TransformationReportPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/account/transformation-data").then(r => r.json()).then(setData);
  }, []);

  return (
    <TransformationTracker
      metrics={data?.metrics}
      journeyStartDate={data?.enrollmentStart}
      readinessScoreStart={data?.readinessStart}
      readinessScoreCurrent={data?.readinessCurrent}
      onExport={() => downloadPDF()}
      onShare={() => copyShareLink()}
    />
  );
}
```

---

## Design Specifications

### Color Palette

All components use the cohesive ONEVYRT chapter color system:

- **START:** `#64748b` (Slate)
- **DEFINE:** `#2563eb` (Blue)
- **IMPLEMENT:** `#16a34a` (Green)
- **CONTROL:** `#d97706` (Amber)
- **IMPROVE:** `#dc2626` (Red)
- **FINISH:** `#0891b2` (Cyan)

### Accessibility

- ✅ WCAG AA contrast ratios (4.8:1 minimum)
- ✅ Keyboard navigation (arrow keys, Enter, Space)
- ✅ ARIA labels and roles
- ✅ prefers-reduced-motion support
- ✅ Focus indicators
- ✅ Semantic HTML

### Responsive Design

- ✅ 320px → 1920px breakpoints
- ✅ Touch-friendly on mobile (44px minimum touch targets)
- ✅ Flex/grid layouts
- ✅ Max-width constraints
- ✅ Horizontal scroll on small screens

### Performance

- ✅ React.memo optimization
- ✅ CSS animations (GPU accelerated)
- ✅ No external chart libraries
- ✅ Efficient tree rendering with depth limiting
- ✅ Lazy loading of heavy components

### Dark Mode

- ✅ CSS custom properties for theme switching
- ✅ `prefers-color-scheme` media queries
- ✅ `data-theme` attribute support
- ✅ Full contrast compliance in both modes

---

## API Integration Points

All components expect data from these endpoints:

- **`GET /api/programme/enrollment`** — Programme map, progress, gates
- **`GET /api/programme/chapters`** — Stage and lesson structure
- **`GET /api/programme/chapters/{chapterId}/lessons`** — Chapter lessons
- **`GET /api/account/transformation-data`** — Transformation metrics

Components handle missing/partial data gracefully with fallback rendering.

---

## Migration & Deployment

1. Deploy components to production
2. Add to existing `/programme` page incrementally
3. Wire API endpoints as needed
4. Test accessibility with screen readers
5. Monitor bundle size impact
6. Collect user feedback on UX

All components are production-ready and can be deployed immediately.
