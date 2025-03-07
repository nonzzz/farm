import { apis } from '../../shared';
import { useEffect, useMemo, useState } from 'react';
import type { CompilationFlowStats } from '../../../server/interface';
import { FileIcon } from './file-icon';
import { colors } from '../../themes/color.stylex';
import { useVirtualList } from './use-virtual';

interface ModuleItemProps {
  filename: string;
  metadata: any;
}

function ModuleItem(props: ModuleItemProps) {
  const { filename, metadata } = props;
  return (
    <div
      stylex={{
        padding: '6px 12px',
        textAlign: 'left',
        fontSize: '16px',
        height: '60px',
        boxSizing: 'border-box',
        width: '100%',
        cursor: 'pointer',
        borderBottom: `1px solid ${colors.accents_2}`
      }}
    >
      <div stylex={{ display: 'flex', alignItems: 'center' }}>
        <FileIcon filename={filename} />
        <span
          stylex={{
            marginLeft: '12px'
          }}
        >
          {filename}
        </span>
      </div>
    </div>
  );
}

export function ModuleList() {
  const [stats, setStats] = useState<CompilationFlowStats>(Object.create(null));

  useEffect(() => {
    apis.getStats().then((res) => {
      setStats(res as CompilationFlowStats);
    });
  }, []);

  const modules = useMemo(() => {
    if (!stats.moduleGraphStats) return [];
    return Object.entries(stats.moduleGraphStats.modules);
  }, [stats]);

  const { containerProps, wrapperProps, virtualItems } = useVirtualList(
    modules,
    {
      itemHeight: 60,
      overscan: 5
    }
  );

  return (
    <div
      {...containerProps}
      stylex={{
        userSelect: 'none',
        height: '100vh'
      }}
    >
      <div {...wrapperProps}>
        {virtualItems.map(({ index, start, item }) => (
          <div
            key={item[0]}
            stylex={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${start}px)`,
              width: '100%'
            }}
          >
            <ModuleItem filename={item[0]} metadata={item[1]} />
          </div>
        ))}
      </div>
    </div>
  );
}
