'use client';

import { useQuery } from '@tanstack/react-query';

import { Cell, ErrorMessage, Loading, PageTitle, Table } from '../../components/ui';
import { valueLabel } from '../../lib/format';
import { useAdminApi } from '../../lib/session';
import { useHasRole } from '../shell/AdminShell';
import { ConfigVersions } from './ConfigVersions';

/**
 * The active Product configuration (docs/09 → Configuration). Support reads it; admins also
 * review, propose, and activate versions (D6.3, owner decision 8).
 */
export function ConfigView() {
  const api = useAdminApi();
  const isAdmin = useHasRole('admin');
  const config = useQuery({ queryKey: ['config'], queryFn: () => api.config() });
  if (config.isError) {
    return <ErrorMessage error={config.error} onRetry={() => void config.refetch()} />;
  }
  if (!config.data) return <Loading label="Loading the configuration" />;
  return (
    <>
      <PageTitle>{`Configuration v${config.data.version} (active)`}</PageTitle>
      <Table head={['Key', 'Value']}>
        {Object.entries(config.data.values)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <tr key={key}>
              <Cell>
                <code>{key}</code>
              </Cell>
              <Cell>
                <code>{valueLabel(value)}</code>
              </Cell>
            </tr>
          ))}
      </Table>
      {isAdmin ? <ConfigVersions activeValues={config.data.values} /> : null}
    </>
  );
}
