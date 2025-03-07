import { ModuleList } from './module-list';

export function Inspect() {
  // temporary resolution just for check ui render.
  return (
    <div stylex={{ height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
      <ModuleList />
    </div>
  );
}
