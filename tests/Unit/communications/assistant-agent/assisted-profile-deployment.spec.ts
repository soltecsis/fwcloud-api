import { expect } from 'chai';
import type { AbstractApplication } from '../../../../src/fonaments/abstract-application';
import { isAssistedProfileDeploymentEnabled } from '../../../../src/communications/assistant-agent/assisted-profile-deployment.config';

function fakeApplication(value: unknown): AbstractApplication {
  return {
    config: {
      get: (key: string): unknown => {
        if (key === 'assisted_profile.enabled') {
          return value;
        }
        return undefined;
      },
    },
  } as unknown as AbstractApplication;
}

describe('isAssistedProfileDeploymentEnabled', () => {
  it('returns true only when the config value is the boolean true', () => {
    expect(isAssistedProfileDeploymentEnabled(fakeApplication(true))).to.equal(true);
  });

  it('returns false when the config value is false', () => {
    expect(isAssistedProfileDeploymentEnabled(fakeApplication(false))).to.equal(false);
  });

  it('returns false when the config value is missing/undefined', () => {
    expect(isAssistedProfileDeploymentEnabled(fakeApplication(undefined))).to.equal(false);
  });

  it('returns false for truthy-but-not-boolean values, refusing to coerce', () => {
    expect(isAssistedProfileDeploymentEnabled(fakeApplication('true'))).to.equal(false);
    expect(isAssistedProfileDeploymentEnabled(fakeApplication(1))).to.equal(false);
  });
});
