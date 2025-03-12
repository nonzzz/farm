import http from 'node:http';
import { createServer } from 'vite-bundle-analyzer';
import type { Middleware } from 'vite-bundle-analyzer';
import {
  VisualizerModule,
  evaluateModuleGraph,
  evaluatePluginLifecycle
} from './analyze-module';
import { PluginLifecycleAnalysis } from './plugin-lifecycle';

export function createInternalServices(mod: VisualizerModule) {
  const server = createServer();
  const lifecycleAnalysis = new PluginLifecycleAnalysis();

  const middlewares: Record<string, Middleware> = {
    resouce: (c, next) => {
      const analysisModule = evaluateModuleGraph(mod.c, mod.workspaceRoot);
      c.res.writeHead(200, {
        'Content-Type': 'json/application',
        'Cache-Control': 'no-cache'
      });
      c.res.end(JSON.stringify(analysisModule, null, 2));
      next();
    },
    modules: (c, next) => {
      lifecycleAnalysis.setupCompiler(mod.c);
      const url = new URL(c.req.url || '', 'http://localhost');
      const page = parseInt(url.searchParams.get('page') || '0', 10);
      lifecycleAnalysis.flushCurrentOffset(page);
      const modules = lifecycleAnalysis.getModulesList();
      c.res.writeHead(200, {
        'Content-Type': 'json/application',
        'Cache-Control': 'no-cache'
      });
      c.res.end(
        JSON.stringify(
          {
            data: modules,
            page,
            pageSize: lifecycleAnalysis.step,
            total: Math.floor(
              lifecycleAnalysis.inspectModuleIds.size / lifecycleAnalysis.step
            )
          },
          null,
          2
        )
      );
      next();
    },
    env_info: (c, next) => {
      next();
    },
    stats: (c, next) => {
      // lifecycleAnalysis.setupCompiler(mod.c);
      // lifecycleAnalysis.getModulesList();
      const stats = evaluatePluginLifecycle(mod.c, false);
      c.res.writeHead(200, {
        'Content-Type': 'json/application',
        'Cache-Control': 'no-cache'
      });
      c.res.end(JSON.stringify(stats, null, 2));
      next();
    }
  };

  function handler(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: Function
  ) {
    const url = new URL(req.url || '', 'http://localhost');
    const middleware = middlewares[url.pathname.replace('/__visualizer/', '')];
    if (middleware) {
      return middleware(
        { req, res, query: {}, params: {} },
        next as () => void
      );
    }
    next();
  }

  return {
    handler,
    server,
    middlewares
  };
}
