import { expect } from 'chai';
import {
  NOOP_OBSERVER,
  createObservationLogger,
  recordObservationSafely,
  safeAgentIdentifier,
} from '../../../../src/communications/assistant-agent/assistant-agent.utils';

describe('Assistant agent utilities', () => {
  it('accepts only safe identifiers and supports one forbidden value', () => {
    expect(safeAgentIdentifier('request-1')).to.equal('request-1');
    expect(safeAgentIdentifier('')).to.equal(undefined);
    expect(safeAgentIdentifier('request\n1')).to.equal(undefined);
    expect(safeAgentIdentifier('a'.repeat(513))).to.equal(undefined);
    expect(safeAgentIdentifier('secret', 'secret')).to.equal(undefined);
  });

  it('uses a no-op observer when no application is available', () => {
    expect(createObservationLogger(null, 'test', () => false)).to.equal(NOOP_OBSERVER);
  });

  it('logs observations at the selected severity', () => {
    const info: string[] = [];
    const warnings: string[] = [];
    const observer = createObservationLogger<{ outcome: string }>(
      {
        logger: () => ({
          info: (message: string) => info.push(message),
          warn: (message: string) => warnings.push(message),
        }),
      },
      'assistant-agent.test',
      (observation) => observation.outcome !== 'success',
    );

    observer.record({ outcome: 'success' });
    observer.record({ outcome: 'failed' });

    expect(info).to.deep.equal(['assistant-agent.test {"outcome":"success"}']);
    expect(warnings).to.deep.equal(['assistant-agent.test {"outcome":"failed"}']);
  });

  it('isolates request handling from observer failures', () => {
    expect(() =>
      recordObservationSafely(
        {
          record: () => {
            throw new Error('observer failed');
          },
        },
        { type: 'test' },
      ),
    ).not.to.throw();
  });
});
