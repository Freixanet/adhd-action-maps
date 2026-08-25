import { describe, expect, it } from 'vitest';
import {
  assertPathOwnedBy,
  buildSourcesObjectPath,
  isAllowedSourcesMime,
  SOURCES_STORAGE_BUCKET,
  validateOwnedStorageRef,
} from './sourcesStorage';

describe('sourcesStorage paths', () => {
  it('builds canonical owner/source/object path with exactly three segments', () => {
    const result = buildSourcesObjectPath({
      ownerId: 'user-a',
      sourceId: 'src-1',
      objectName: 'body.pdf',
    });
    expect(result).toEqual({
      ok: true,
      bucket: SOURCES_STORAGE_BUCKET,
      path: 'user-a/src-1/body.pdf',
    });
    if (result.ok) expect(result.path.split('/')).toHaveLength(3);
  });

  it('rejects /, \\, . / .. and control characters', () => {
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: 's', objectName: '../x' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: 's', objectName: 'a/b' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: 's', objectName: 'a\\b' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: '.', objectName: 'x' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: '..', objectName: 'x' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a', sourceId: 's', objectName: 'x\u0000y' }).ok
    ).toBe(false);
    expect(
      buildSourcesObjectPath({ ownerId: 'a/b', sourceId: 's', objectName: 'x' }).ok
    ).toBe(false);
  });

  it('ownership prefix checks', () => {
    expect(assertPathOwnedBy('user-a/src/file', 'user-a')).toBe(true);
    expect(assertPathOwnedBy('user-b/src/file', 'user-a')).toBe(false);
  });

  it('mime allowlist', () => {
    expect(isAllowedSourcesMime('application/pdf')).toBe(true);
    expect(isAllowedSourcesMime('application/x-msdownload')).toBe(false);
  });

  it('validateOwnedStorageRef rejects cross-tenant and unpaired fields', () => {
    expect(
      validateOwnedStorageRef({
        ownerId: 'user-a',
        sourceId: 'src-1',
        bucket: null,
        path: null,
      })
    ).toEqual({ ok: true, bucket: null, path: null });
    expect(
      validateOwnedStorageRef({
        ownerId: 'user-a',
        sourceId: 'src-1',
        bucket: 'sources',
        path: null,
      }).ok
    ).toBe(false);
    expect(
      validateOwnedStorageRef({
        ownerId: 'user-a',
        sourceId: 'src-1',
        bucket: 'other',
        path: 'user-a/src-1/x',
      }).ok
    ).toBe(false);
    expect(
      validateOwnedStorageRef({
        ownerId: 'user-a',
        sourceId: 'src-1',
        bucket: 'sources',
        path: 'user-b/src-1/x',
      }).ok
    ).toBe(false);
  });
});
