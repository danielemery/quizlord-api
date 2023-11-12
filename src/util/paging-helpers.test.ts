import { slicePagedResults, getPagedQuery } from './paging-helpers';

describe('util', () => {
  describe('paging-helpers', () => {
    describe('slicePagedResults', () => {
      it('must return results sliced to limit and hasMoreRows true when not using cursor and more than enough items are present', () => {
        const rows = ['a', 'b', 'c'];
        const expected = { data: ['a', 'b'], hasMoreRows: true };

        expect(slicePagedResults(rows, 2, false)).toEqual(expected);
      });
      it('must return results sliced to limit and hasMoreRows false when not using cursor and just enough items are present', () => {
        const rows = ['a', 'b'];
        const expected = { data: ['a', 'b'], hasMoreRows: false };

        expect(slicePagedResults(rows, 2, false)).toEqual(expected);
      });
      it('must return all the results it can and hasMoreRows false when not using cursor and not enough items are present', () => {
        const rows = ['a', 'b'];
        const expected = { data: ['a', 'b'], hasMoreRows: false };

        expect(slicePagedResults(rows, 3, false)).toEqual(expected);
      });
      it('must return empty results and hasMoreRows false when not using cursor and no items are present', () => {
        const rows: string[] = [];
        const expected = { data: [], hasMoreRows: false };

        expect(slicePagedResults(rows, 3, false)).toEqual(expected);
      });
      it('must return results sliced to limit and hasMoreRows true when using cursor and more than enough items are present', () => {
        const rows = ['a', 'b', 'c', 'd'];
        const expected = { data: ['b', 'c'], hasMoreRows: true };

        expect(slicePagedResults(rows, 2, true)).toEqual(expected);
      });
      it('must return results sliced to limit and hasMoreRows false when using cursor and just enough items are present', () => {
        const rows = ['a', 'b', 'c'];
        const expected = { data: ['b', 'c'], hasMoreRows: false };

        expect(slicePagedResults(rows, 2, true)).toEqual(expected);
      });
      it('must return all the results it can and hasMoreRows false when using cursor and not enough items are present', () => {
        const rows = ['a', 'b'];
        const expected = { data: ['b'], hasMoreRows: false };

        expect(slicePagedResults(rows, 2, true)).toEqual(expected);
      });
      it('must return empty results and hasMoreRows false when using cursor and no additional items are present', () => {
        const rows = ['a'];
        const expected = { data: [], hasMoreRows: false };

        expect(slicePagedResults(rows, 2, true)).toEqual(expected);
      });
      it('must return empty results and hasMoreRows false when using cursor and no items are present', () => {
        const rows: string[] = [];
        const expected = { data: [], hasMoreRows: false };

        expect(slicePagedResults(rows, 2, true)).toEqual(expected);
      });
    });
    describe('getPagedQuery', () => {
      it('must take limit plus one extra (the extra is to allow slicePagedResults to know whether there are more results)', () => {
        const expected = {
          take: 11,
        };
        const actual = getPagedQuery(10);

        expect(actual).toEqual(expected);
      });
      it('must include cursor and two extra (the futher extra is because the first result will be the cursor itself and will be sliced)', () => {
        const expected = {
          cursor: { id: 'fake-cursor' },
          take: 12,
        };
        const actual = getPagedQuery(10, 'fake-cursor');

        expect(actual).toEqual(expected);
      });
    });
  });
});
