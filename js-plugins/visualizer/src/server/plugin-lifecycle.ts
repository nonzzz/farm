import type { Compiler } from '@farmfe/core';
import type {
  CompilationFlowStats,
  HookStats,
  InspectModuleInfo,
  StatsMetadata
} from './interface';
import { ModuleCache } from './ttl';

// For development mode, HMR needs to be considered

// Architecture principle
// 1. The plugin lifecycle is divided into two parts: the first part is the analysis phase, and the second part is the visualization phase.
// 2. The analysis phase is responsible for analyzing the module graph and generating the necessary data.
// 3. Split the analysis phase and the visualization phase to ensure that the analysis phase is not affected by the visualization phase.
// 4. Cut the analysis data into small pieces and send it to the client for visualization.

const asserts = {
  missingCompiler: (c: Compiler | null) => {
    if (!c) {
      throw new Error(`[@farmfe/plugin-visualizer]: Compiler isn't setup.`);
    }
  }
};

// Port from v1. rust side.
const HOOK_ORDER: Record<string, number> = {
  update_modules: 0,
  resolve: 1,
  load: 2,
  transform: 3,
  parse: 4,
  process_module: 5,
  analyze_deps: 6,
  finalize_module: 7,
  build_end: 8,
  optimize_module_graph: 9,
  analyze_module_graph: 10,
  partial_bundling: 11,
  render_resource_pot_modules: 12,
  render_resource_pot: 13,
  generate_resources: 14
};

function compareHookOrder(a: string, b: string): number {
  return (HOOK_ORDER[a] ?? Infinity) - (HOOK_ORDER[b] ?? Infinity);
}

export class DefaultMap<K, V> extends Map<K, V> {
  private defaultValue: V;

  constructor(defaultValue: V);
  constructor(entries?: readonly (readonly [K, V])[], defaultValue?: V);
  constructor(
    defaultValueOrEntries?: V | readonly (readonly [K, V])[],
    defaultValue?: V
  ) {
    if (Array.isArray(defaultValueOrEntries)) {
      super(defaultValueOrEntries);
      this.defaultValue = defaultValue as V;
    } else {
      super();
      this.defaultValue = defaultValueOrEntries as V;
    }
  }

  get(key: K): V {
    if (!this.has(key)) {
      this.set(key, this.defaultValue);
    }
    return super.get(key);
  }

  setDefaultValue(value: V): void {
    this.defaultValue = value;
  }
}

export class PluginLifecycleAnalysis {
  c: Compiler | null;
  workspaceRoot: string;
  inspectModuleIds: DefaultMap<string, boolean>;
  step: number;
  lazy: boolean;
  private currentOffset: number;
  private moduleCache: ModuleCache<InspectModuleInfo[]>;
  constructor() {
    this.c = null;
    this.workspaceRoot = process.cwd();
    this.inspectModuleIds = new DefaultMap(true);
    this.step = 20;
    this.currentOffset = 0;
    this.lazy = false;
    this.moduleCache = new ModuleCache(50, 5 * 60 * 1000);
  }
  setupCompiler(c: Compiler) {
    if (!this.c) {
      this.c = c;
    }
  }
  getModulesList() {
    asserts.missingCompiler(this.c);
    const originalStats = JSON.parse(this.c.stats()) as StatsMetadata;
    const { initialCompilationFlowStats, hmrCompilationFlowStats } =
      originalStats;
    const currentPage = Math.floor(this.currentOffset / this.step);
    if (hmrCompilationFlowStats.length > 0) {
      this.moduleCache.clear();
      return this.readByStep(hmrCompilationFlowStats);
    }

    if (this.lazy) {
      const cached = this.moduleCache.get(currentPage);
      if (cached) {
        return cached;
      }
    }
    // Record these IDS for later use
    if (!this.lazy) {
      for (const moduleId in initialCompilationFlowStats.moduleGraphStats
        .modules) {
        this.inspectModuleIds.get(moduleId);
      }
      this.lazy = true;
    }
    const result = this.readByStep([initialCompilationFlowStats]);
    this.moduleCache.set(currentPage, result);
    return result;
  }
  readByStep(compilationFlowStats: CompilationFlowStats[]) {
    const results: Record<string, InspectModuleInfo> = {};
    const allModules = Array.from(this.inspectModuleIds.keys());
    const begin = this.currentOffset;
    const end = Math.min(begin + this.step, allModules.length);
    const currentStepModules = new Set(allModules.slice(begin, end));
    this.currentOffset = end;

    if (this.currentOffset >= allModules.length) {
      this.currentOffset = 0;
    }

    for (const flowStats of compilationFlowStats) {
      const {
        hookStatsMap,
        moduleGraphStats: { edges }
      } = flowStats;

      // Modify hookStatsMap in place to improve subsequent queries
      for (const hookName in hookStatsMap) {
        // @ts-expect-error should be fixed
        let hookGraphics = hookStatsMap[hookName] as HookStats[];

        // Partition the array in place
        let writeIndex = 0;
        const matched: HookStats[] = [];

        for (let readIndex = 0; readIndex < hookGraphics.length; readIndex++) {
          const hook = hookGraphics[readIndex];

          if (currentStepModules.has(hook.moduleId)) {
            matched.push(hook);
            if (!results[hook.moduleId]) {
              const deps = edges[hook.moduleId];
              results[hook.moduleId] = {
                id: hook.moduleId,
                deps: deps ? Array.from(new Set(deps.map(([id]) => id))) : [],
                plugins: [],
                totalTime: 0,
                invokeCount: 0
              };
            }
            results[hook.moduleId].plugins.push(hook);
            results[hook.moduleId].totalTime += hook.duration;
            results[hook.moduleId].invokeCount++;
          } else {
            hookGraphics[writeIndex] = hook;
            writeIndex++;
          }
        }

        hookGraphics.length = writeIndex;
      }
    }

    for (const moduleId in results) {
      results[moduleId].plugins.sort((a, b) =>
        compareHookOrder(a.hookName, b.hookName)
      );
    }

    return Object.values(results);
  }
  refresh() {
    this.lazy = false;
    this.currentOffset = 0;
  }
  flushCurrentOffset(page: number) {
    this.currentOffset = page * this.step;
  }
}
