import { assert } from 'chai';
import { slicePagedResults } from './persistence';

describe('slicePagedResults', () => {
  it('must return results sliced to limit and hasMoreRows true when not using cursor and more than enough items are present', () => {
    const rows = ['a', 'b', 'c'];
    const expected = { data: ['a', 'b'], hasMoreRows: true };

    assert.deepEqual(slicePagedResults(rows, 2, false), expected);
  });
  it('must return results sliced to limit and hasMoreRows false when not using cursor and just enough items are present', () => {
    const rows = ['a', 'b'];
    const expected = { data: ['a', 'b'], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 2, false), expected);
  });
  it('must return all the results it can and hasMoreRows false when not using cursor and not enough items are present', () => {
    const rows = ['a', 'b'];
    const expected = { data: ['a', 'b'], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 3, false), expected);
  });
  it('must return empty results and hasMoreRows false when not using cursor and no items are present', () => {
    const rows: string[] = [];
    const expected = { data: [], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 3, false), expected);
  });
  it('must return results sliced to limit and hasMoreRows true when using cursor and more than enough items are present', () => {
    const rows = ['a', 'b', 'c', 'd'];
    const expected = { data: ['b', 'c'], hasMoreRows: true };

    assert.deepEqual(slicePagedResults(rows, 2, true), expected);
  });
  it('must return results sliced to limit and hasMoreRows false when using cursor and just enough items are present', () => {
    const rows = ['a', 'b', 'c'];
    const expected = { data: ['b', 'c'], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 2, true), expected);
  });
  it('must return all the results it can and hasMoreRows false when using cursor and not enough items are present', () => {
    const rows = ['a', 'b'];
    const expected = { data: ['b'], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 2, true), expected);
  });
  it('must return empty results and hasMoreRows false when using cursor and no additional items are present', () => {
    const rows = ['a'];
    const expected = { data: [], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 2, true), expected);
  });
  it('must return empty results and hasMoreRows false when using cursor and no items are present', () => {
    const rows: string[] = [];
    const expected = { data: [], hasMoreRows: false };

    assert.deepEqual(slicePagedResults(rows, 2, true), expected);
  });
});
