/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { SavedObjectsClientContract, LegacyScopedClusterClient } from 'src/core/server';
import { savedObjectsClientMock, elasticsearchServiceMock } from 'src/core/server/mocks';
import { appContextService } from '../../app_context';
import { createAppContextStartContractMock } from '../../../mocks';

jest.mock('../elasticsearch/template/template');
jest.mock('../kibana/assets/install');
jest.mock('../kibana/index_pattern/install');
jest.mock('./install');
jest.mock('./get');

import { updateCurrentWriteIndices } from '../elasticsearch/template/template';
import { installKibanaAssets } from '../kibana/assets/install';
import { installIndexPatterns } from '../kibana/index_pattern/install';
import { _installPackage } from './_install_package';

const mockedUpdateCurrentWriteIndices = updateCurrentWriteIndices as jest.MockedFunction<
  typeof updateCurrentWriteIndices
>;
const mockedGetKibanaAssets = installKibanaAssets as jest.MockedFunction<
  typeof installKibanaAssets
>;
const mockedInstallIndexPatterns = installIndexPatterns as jest.MockedFunction<
  typeof installIndexPatterns
>;

function sleep(millis: number) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

describe('_installPackage', () => {
  let soClient: jest.Mocked<SavedObjectsClientContract>;
  let callCluster: jest.Mocked<LegacyScopedClusterClient['callAsCurrentUser']>;
  beforeEach(async () => {
    soClient = savedObjectsClientMock.create();
    callCluster = elasticsearchServiceMock.createLegacyScopedClusterClient().callAsCurrentUser;
    appContextService.start(createAppContextStartContractMock());
  });
  afterEach(async () => {
    appContextService.stop();
  });
  it('handles errors from installIndexPatterns or installKibanaAssets', async () => {
    // force errors from either/both these functions
    mockedGetKibanaAssets.mockImplementation(async () => {
      throw new Error('mocked async error A: should be caught');
    });
    mockedInstallIndexPatterns.mockImplementation(async () => {
      throw new Error('mocked async error B: should be caught');
    });

    // pick any function between when those are called and when await Promise.all is defined later
    // and force it to take long enough for the errors to occur
    // @ts-expect-error about call signature
    mockedUpdateCurrentWriteIndices.mockImplementation(async () => await sleep(1000));

    const installationPromise = _installPackage({
      savedObjectsClient: soClient,
      callCluster,
      pkgName: 'abc',
      pkgVersion: '1.2.3',
      paths: [],
      removable: false,
      internal: false,
      packageInfo: {
        name: 'xyz',
        version: '4.5.6',
        description: 'test',
        type: 'x',
        categories: ['this', 'that'],
        format_version: 'string',
      },
      installType: 'install',
      installSource: 'registry',
    });

    // if we have a .catch this will fail nicely (test pass)
    // otherwise the test will fail with either of the mocked errors
    await expect(installationPromise).rejects.toThrow('mocked');
    await expect(installationPromise).rejects.toThrow('should be caught');
  });
});
